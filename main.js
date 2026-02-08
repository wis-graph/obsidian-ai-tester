"use strict";
const obsidian = require("obsidian");
const DEFAULT_SETTINGS = {
  model: "llama2",
  serverUrl: "http://localhost:11434"
};
const DEFAULT_BLOCK_CONFIG = {
  model: "",
  temperature: 0.7,
  max_tokens: 4096,
  stop_sequences: [],
  top_p: 0.9,
  frequency_penalty: 0,
  presence_penalty: 0,
  num_responses: 1
};
class OllamaServiceImpl {
  constructor(settings) {
    this.modelsCache = null;
    this.settings = settings;
  }
  async fetchModels() {
    if (this.modelsCache)
      return this.modelsCache;
    try {
      const response = await obsidian.requestUrl({
        url: `${this.settings.serverUrl}/api/tags`,
        method: "GET"
      });
      if (response.status !== 200) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      this.modelsCache = response.json;
      return this.modelsCache;
    } catch (error) {
      console.error("Error fetching models:", error);
      throw error;
    }
  }
  clearCache() {
    this.modelsCache = null;
  }
  getSettings() {
    return this.settings;
  }
  async streamOllamaResponse(prompt, model, yamlConfig, abortController, onChunk, onDone) {
    var _a;
    const requestBody = {
      model,
      prompt,
      stream: true,
      options: {
        temperature: yamlConfig.temperature,
        num_predict: yamlConfig.max_tokens,
        stop: yamlConfig.stop_sequences,
        top_p: yamlConfig.top_p,
        frequency_penalty: yamlConfig.frequency_penalty,
        presence_penalty: yamlConfig.presence_penalty
      }
    };
    Object.keys(requestBody.options).forEach((key) => requestBody.options[key] === void 0 && delete requestBody.options[key]);
    const response = await fetch(`${this.settings.serverUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
    if (!reader)
      throw new Error("Failed to read response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim() === "")
          continue;
        try {
          const data = JSON.parse(line);
          if (data.response)
            onChunk(data.response);
          if (data.done)
            onDone(data);
        } catch (e) {
          console.error("Error parsing JSON line:", line, e);
        }
      }
    }
  }
}
class BlockManager {
  constructor(app) {
    this.app = app;
  }
  parseBlock(source) {
    const trimmedSource = source.trim();
    const yamlMatch = trimmedSource.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    let config = {
      yamlConfig: { ...DEFAULT_BLOCK_CONFIG },
      prompt: trimmedSource,
      hasYaml: false
    };
    if (yamlMatch) {
      config.hasYaml = true;
      try {
        const parsedYaml = obsidian.parseYaml(yamlMatch[1]);
        config.yamlConfig = { ...DEFAULT_BLOCK_CONFIG, ...parsedYaml };
        config.prompt = yamlMatch[2].trim();
      } catch (error) {
        console.error("Error parsing YAML:", error);
        new obsidian.Notice("YAML parsing error, using default settings");
      }
    }
    return config;
  }
  validateConfig(config) {
    const errors = [];
    const ranges = {
      temperature: [0, 2],
      max_tokens: [1, 2e4],
      top_p: [0, 1],
      frequency_penalty: [0, 2],
      presence_penalty: [0, 2],
      num_responses: [1, 20]
    };
    for (const [key, range] of Object.entries(ranges)) {
      if (config[key] !== void 0 && (config[key] < range[0] || config[key] > range[1])) {
        errors.push(`${key} must be between ${range[0]} and ${range[1]}`);
      }
    }
    return errors;
  }
  async updateFileBlock(el, ctx, newPrompt, newYaml) {
    const sectionInfo = ctx.getSectionInfo(el);
    if (!sectionInfo)
      throw new Error("Could not get section info");
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!view)
      throw new Error("No active markdown view");
    const editor = view.editor;
    const { lineStart, lineEnd } = sectionInfo;
    const updatedBlockContent = newYaml ? `---
${newYaml}
---
${newPrompt}` : newPrompt;
    const startPos = { line: lineStart + 1, ch: 0 };
    const endPos = { line: lineEnd, ch: 0 };
    editor.replaceRange(updatedBlockContent + "\n", startPos, endPos);
    new obsidian.Notice("Block synced to file");
  }
  generateYamlFromConfig(config) {
    const lines = [];
    const default_config = DEFAULT_BLOCK_CONFIG;
    for (const key in default_config) {
      if (config[key] !== void 0 && config[key] !== default_config[key]) {
        const value = config[key];
        if (Array.isArray(value)) {
          lines.push(`${key}: ${JSON.stringify(value)}`);
        } else if (typeof value === "string") {
          if (value.includes(":") || value.includes("#") || value === "") {
            lines.push(`${key}: "${value}"`);
          } else {
            lines.push(`${key}: ${value}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    }
    return lines.length > 0 ? lines.join("\n") : "";
  }
}
class OllamaBlockView {
  constructor(el, service, manager, ctx, blockSettings) {
    this.components = {};
    this.el = el;
    this.service = service;
    this.manager = manager;
    this.ctx = ctx;
    this.blockSettings = blockSettings;
  }
  render() {
    this.el.empty();
    this.createLayout();
    this.initializeController();
  }
  createLayout() {
    const container = this.el.createDiv({ cls: "ollama-container" });
    container.style.cssText = "padding: 12px; background: var(--background-secondary); border-radius: 8px; margin: 10px 0;";
    const headerRow = container.createDiv({ cls: "ollama-header" });
    headerRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;";
    headerRow.createEl("label", { text: "Prompt:", cls: "setting-item-name" }).style.cssText = "font-weight: 600; margin-right: 16px;";
    const controlsRow = headerRow.createDiv({ cls: "ollama-controls" });
    controlsRow.style.cssText = "display: flex; align-items: center; gap: 16px;";
    const modelLabel = controlsRow.createEl("label", { text: "Model:", cls: "setting-item-name" });
    modelLabel.style.cssText = "font-size: var(--font-smaller); font-weight: 500;";
    const modelDropdown = controlsRow.createEl("select", { cls: "ollama-model-dropdown dropdown" });
    modelDropdown.style.cssText = "padding: 4px 32px 4px 12px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller); line-height: 1.5; cursor: pointer; min-width: 160px; width: fit-content; max-width: 400px; height: auto;";
    let advancedButton = null;
    let configTextarea = null;
    let configDisplay = null;
    if (this.blockSettings.hasYaml) {
      advancedButton = controlsRow.createEl("button", { cls: "ollama-advanced-button" });
      obsidian.setIcon(advancedButton, "settings");
      advancedButton.style.cssText = "padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; display: flex; align-items: center; justify-content: center;";
      advancedButton.title = "Advanced Settings";
      configDisplay = container.createDiv({ cls: "ollama-config-display" });
      configDisplay.style.cssText = "display: none; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 12px; margin-bottom: 12px; font-size: var(--font-smaller);";
      configTextarea = configDisplay.createEl("textarea", { attr: { rows: 8, placeholder: "YAML configuration..." } });
      configTextarea.style.cssText = "width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); resize: vertical; font-family: var(--font-monospace); font-size: var(--font-smaller);";
      configTextarea.value = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
    }
    const promptContainer = container.createDiv({ cls: "ollama-prompt-container" });
    promptContainer.style.cssText = "position: relative; width: 100%; margin-bottom: 12px;";
    const promptInput = promptContainer.createEl("div", { cls: "ollama-prompt-input", attr: { contenteditable: "true", "data-placeholder": "Enter prompt... (Ctrl+Enter)" } });
    promptInput.innerHTML = this.blockSettings.prompt;
    promptInput.style.cssText = "width: 100%; padding: 8px; padding-bottom: 30px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); overflow: auto; min-height: 80px; white-space: pre-wrap; word-wrap: break-word;";
    const copyButton = promptContainer.createEl("button", { cls: "ollama-copy-button" });
    obsidian.setIcon(copyButton, "copy");
    copyButton.style.cssText = "position: absolute; bottom: 8px; right: 8px; padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; opacity: 0.6; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;";
    copyButton.title = "Copy prompt";
    copyButton.addEventListener("mouseenter", () => copyButton.style.opacity = "1");
    copyButton.addEventListener("mouseleave", () => copyButton.style.opacity = "0.6");
    const buttonContainer = container.createDiv({ cls: "ollama-button-container" });
    buttonContainer.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: flex-start;";
    const submitButton = buttonContainer.createEl("button", { text: "Generate", cls: "mod-cta" });
    submitButton.style.cssText = "padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;";
    const cancelButton = buttonContainer.createEl("button", { text: "Stop", cls: "mod-warning" });
    cancelButton.style.cssText = "padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; display: none;";
    const responsesContainer = buttonContainer.createDiv({ cls: "ollama-responses-control" });
    responsesContainer.style.cssText = "display: flex; align-items: center; gap: 8px; margin-left: auto;";
    responsesContainer.createEl("label", { text: "Responses:", cls: "setting-item-name" }).style.cssText = "font-size: var(--font-smaller);";
    const initialResponses = this.blockSettings.yamlConfig.num_responses || 1;
    const responsesSlider = responsesContainer.createEl("input", { cls: "ollama-responses-slider", attr: { type: "range", min: "1", max: "20", value: initialResponses.toString(), step: "1" } });
    responsesSlider.style.cssText = "width: 100px; cursor: pointer;";
    const responsesInput = responsesContainer.createEl("input", { cls: "ollama-responses-input", attr: { type: "number", min: "1", max: "20", value: initialResponses.toString() } });
    responsesInput.style.cssText = "width: 50px; padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller);";
    const responsesWrapper = container.createDiv({ cls: "ollama-responses-wrapper" });
    responsesWrapper.style.cssText = "margin-top: 12px; display: none; flex-direction: column; gap: 8px;";
    this.components = { modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, submitButton, cancelButton, responsesWrapper };
  }
  initializeController() {
    const { modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, submitButton, cancelButton, responsesWrapper } = this.components;
    let abortController = null;
    const populate = async () => {
      try {
        const res = await this.service.fetchModels();
        modelDropdown.innerHTML = "";
        res.models.forEach((m) => {
          modelDropdown.createEl("option", { value: m.name, text: m.name });
        });
        const initialModel = this.blockSettings.yamlConfig.model || this.service.getSettings().model;
        if (initialModel) {
          modelDropdown.value = initialModel;
        }
      } catch (e) {
        new obsidian.Notice("Failed to load models");
      }
    };
    populate();
    const updateModelInYaml = this.debounce((modelName) => {
      this.blockSettings.yamlConfig.model = modelName;
      const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
      if (configTextarea)
        configTextarea.value = newYaml;
    }, 1e3);
    modelDropdown.addEventListener("change", () => {
      updateModelInYaml(modelDropdown.value);
    });
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const text = promptInput.innerText.trim();
        if (text) {
          await navigator.clipboard.writeText(text);
          new obsidian.Notice("Prompt copied to clipboard");
        }
      });
    }
    if (advancedButton) {
      advancedButton.addEventListener("click", () => {
        const isHidden = configDisplay.style.display === "none";
        configDisplay.style.display = isHidden ? "block" : "none";
        advancedButton.style.background = isHidden ? "var(--background-modifier-active-hover)" : "transparent";
      });
      configTextarea.addEventListener("input", this.debounce(() => {
        this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), configTextarea.value.trim());
      }, 1e3));
    }
    const updateResponseCount = this.debounce((val) => {
      this.blockSettings.yamlConfig.num_responses = val;
      const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
      if (configTextarea)
        configTextarea.value = newYaml;
    }, 1e3);
    responsesSlider.addEventListener("input", () => {
      responsesInput.value = responsesSlider.value;
      updateResponseCount(parseInt(responsesSlider.value));
    });
    responsesInput.addEventListener("input", () => {
      responsesSlider.value = responsesInput.value;
      updateResponseCount(parseInt(responsesInput.value));
    });
    promptInput.addEventListener("input", this.debounce(() => {
      const yaml = this.blockSettings.hasYaml ? configTextarea.value : "";
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), yaml);
    }, 1e3));
    submitButton.addEventListener("click", async () => {
      const prompt = promptInput.innerText.trim();
      if (!prompt)
        return new obsidian.Notice("Prompt empty");
      const count = parseInt(responsesInput.value) || 1;
      submitButton.disabled = true;
      submitButton.textContent = "Generating...";
      cancelButton.style.display = "block";
      responsesWrapper.style.display = "flex";
      responsesWrapper.innerHTML = "";
      abortController = new AbortController();
      for (let i = 0; i < count; i++) {
        const item = responsesWrapper.createDiv({ cls: "ollama-response-item" });
        item.style.cssText = "background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 12px;";
        const content = item.createDiv();
        const outputPre = content.createEl("pre", { cls: "ollama-output" });
        outputPre.style.cssText = "white-space: pre-wrap; font-size: var(--font-smaller);";
        const currentModel = modelDropdown.value;
        try {
          await this.service.streamOllamaResponse(prompt, currentModel, this.blockSettings.yamlConfig, abortController, (chunk) => {
            outputPre.textContent += chunk;
          }, (final) => {
          });
        } catch (e) {
          if (e.name === "AbortError")
            break;
          content.createDiv({ text: `Error: ${e.message}` }).style.color = "var(--text-error)";
        }
      }
      submitButton.disabled = false;
      submitButton.textContent = "Generate";
      cancelButton.style.display = "none";
    });
    cancelButton.addEventListener("click", () => abortController === null || abortController === void 0 ? void 0 : abortController.abort());
  }
  debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
}
class OllamaSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  async display() {
    const { containerEl } = this;
    containerEl.empty();
    new obsidian.Setting(containerEl).setName("Ollama Model").setDesc("Select model to use for generation").addDropdown(async (dropdown) => {
      dropdown.addOption("", "Loading models...");
      try {
        const response = await this.plugin.ollamaService.fetchModels();
        const selectEl = dropdown.selectEl;
        while (selectEl.options.length > 0) {
          selectEl.remove(0);
        }
        if (response.models.length === 0) {
          dropdown.addOption("", "No models found");
        } else {
          response.models.forEach((model) => {
            dropdown.addOption(model.name, `${model.name} (${model.details.parameter_size}, ${model.details.quantization_level})`);
          });
        }
        dropdown.setValue(this.plugin.settings.model);
      } catch (error) {
        console.error(error);
        dropdown.setValue(this.plugin.settings.model);
        new obsidian.Notice("Failed to fetch models from Ollama server");
      }
      dropdown.onChange(async (value) => {
        if (!value)
          return;
        this.plugin.settings.model = value;
        await this.plugin.saveSettings();
      });
    });
    new obsidian.Setting(containerEl).setName("Server URL").setDesc("The URL of your Ollama server").addText((text) => text.setPlaceholder("http://localhost:11434").setValue(this.plugin.settings.serverUrl).onChange(async (value) => {
      this.plugin.settings.serverUrl = value;
      this.plugin.ollamaService.clearCache();
      await this.plugin.saveSettings();
    }));
  }
}
class ObsidianOllamaTestPlugin extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    console.log("Obsidian Ollama Test plugin loading (Modular)...");
    await this.loadSettings();
    this.ollamaService = new OllamaServiceImpl(this.settings);
    this.blockManager = new BlockManager(this.app);
    this.addSettingTab(new OllamaSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor("ollama", (source, el, ctx) => {
      const blockSettings = this.blockManager.parseBlock(source);
      const view = new OllamaBlockView(el, this.ollamaService, this.blockManager, ctx, blockSettings);
      view.render();
    });
  }
  async onunload() {
    console.log("Obsidian Ollama Test plugin unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
}
module.exports = ObsidianOllamaTestPlugin;
