"use strict";
const obsidian = require("obsidian");
const DEFAULT_SETTINGS = {
  activeProvider: "ollama",
  ollama: {
    serverUrl: "http://localhost:11434",
    model: "llama3"
  },
  openai: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.2"
  },
  gemini: {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3-pro"
  },
  grok: {
    apiKey: "",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4.1"
  },
  glm: {
    apiKey: "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7"
  },
  kimi: {
    apiKey: "",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k"
  }
};
const DEFAULT_BLOCK_CONFIG = {
  provider: "ollama",
  model: "",
  temperature: 0.7,
  max_tokens: 4096,
  stop_sequences: [],
  top_p: 0.9,
  frequency_penalty: 0,
  presence_penalty: 0,
  num_responses: 1
};
class OllamaProvider {
  constructor(settings) {
    this.id = "ollama";
    this.name = "Ollama";
    this.settings = settings;
  }
  async fetchModels() {
    try {
      const response = await obsidian.requestUrl({
        url: `${this.settings.serverUrl}/api/tags`,
        method: "GET"
      });
      if (response.status !== 200) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      const ollamaRes = response.json;
      return {
        models: ollamaRes.models.map((m) => ({
          id: m.name,
          name: m.name
        }))
      };
    } catch (error) {
      console.error("Error fetching models from Ollama:", error);
      throw error;
    }
  }
  async streamResponse(prompt, model, config, abortController, onChunk, onDone) {
    var _a;
    const requestBody = {
      model,
      prompt,
      stream: true,
      options: {
        temperature: config.temperature,
        num_predict: config.max_tokens,
        stop: config.stop_sequences,
        top_p: config.top_p,
        frequency_penalty: config.frequency_penalty,
        presence_penalty: config.presence_penalty
      }
    };
    Object.keys(requestBody.options).forEach(
      (key) => requestBody.options[key] === void 0 && delete requestBody.options[key]
    );
    const response = await fetch(`${this.settings.serverUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const reader = (_a = response.body) == null ? void 0 : _a.getReader();
    if (!reader) throw new Error("Failed to read response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim() === "") continue;
        try {
          const data = JSON.parse(line);
          if (data.response) onChunk(data.response);
          if (data.done) {
            onDone({
              response: data.response,
              done: true,
              model: data.model,
              total_duration: data.total_duration,
              prompt_eval_count: data.prompt_eval_count,
              eval_count: data.eval_count
            });
          }
        } catch (e) {
          console.error("Error parsing JSON line:", line, e);
        }
      }
    }
  }
}
class OpenAICompatibleProvider {
  constructor(id, name, settings, modelPrefixes = []) {
    this.id = id;
    this.name = name;
    this.settings = settings;
    this.modelPrefixes = modelPrefixes;
  }
  async fetchModels() {
    if (!this.settings.apiKey) {
      return { models: [{ id: this.settings.model, name: this.settings.model }] };
    }
    try {
      const response = await fetch(`${this.settings.baseUrl}/models`, {
        headers: {
          "Authorization": `Bearer ${this.settings.apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      const data = await response.json();
      let models = data.data || [];
      if (this.modelPrefixes.length > 0) {
        models = models.filter(
          (m) => this.modelPrefixes.some((prefix) => m.id.toLowerCase().startsWith(prefix.toLowerCase()))
        );
      }
      return {
        models: models.map((m) => ({
          id: m.id,
          name: m.id
        }))
      };
    } catch (error) {
      console.error(`Error fetching models from ${this.name}:`, error);
      return { models: [{ id: this.settings.model, name: this.settings.model }] };
    }
  }
  async streamResponse(prompt, model, config, abortController, onChunk, onDone) {
    var _a, _b, _c, _d, _e;
    const startTime = Date.now();
    const requestBody = {
      model: model || this.settings.model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      stream_options: { include_usage: true },
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      stop: config.stop_sequences,
      top_p: config.top_p,
      frequency_penalty: config.frequency_penalty,
      presence_penalty: config.presence_penalty
    };
    const response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`${this.name} API error: ${((_a = err.error) == null ? void 0 : _a.message) || response.statusText}`);
    }
    const reader = (_b = response.body) == null ? void 0 : _b.getReader();
    if (!reader) throw new Error("Failed to read response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
        if (trimmedLine.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmedLine.slice(6));
            if (data.usage) {
              onDone({
                response: "",
                done: true,
                model,
                prompt_eval_count: data.usage.prompt_tokens,
                eval_count: data.usage.completion_tokens,
                total_duration: (Date.now() - startTime) * 1e6
              });
              continue;
            }
            const content = (_d = (_c = data.choices[0]) == null ? void 0 : _c.delta) == null ? void 0 : _d.content;
            if (content) onChunk(content);
            if (((_e = data.choices[0]) == null ? void 0 : _e.finish_reason) && !data.usage) {
              onDone({
                response: "",
                done: true,
                model: data.model || model,
                total_duration: (Date.now() - startTime) * 1e6
              });
            }
          } catch (e) {
            console.error(`Error parsing ${this.name} stream chunk:`, trimmedLine, e);
          }
        }
      }
    }
  }
}
class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(settings) {
    super("openai", "OpenAI", settings, ["gpt-", "o1-", "o3-", "o4-", "o5-"]);
  }
}
class GeminiProvider extends OpenAICompatibleProvider {
  constructor(settings) {
    super("gemini", "Gemini", settings, ["gemini-"]);
  }
}
class GrokProvider extends OpenAICompatibleProvider {
  constructor(settings) {
    super("grok", "Grok", settings, ["grok-"]);
  }
}
class GLMProvider extends OpenAICompatibleProvider {
  constructor(settings) {
    super("glm", "GLM", settings, ["glm-"]);
  }
}
class KimiProvider extends OpenAICompatibleProvider {
  constructor(settings) {
    super("kimi", "Kimi", settings, ["moonshot-"]);
  }
}
class LLMService {
  constructor(settings) {
    this.providers = /* @__PURE__ */ new Map();
    this.settings = settings;
    this.initializeProviders();
  }
  initializeProviders() {
    const ollama = new OllamaProvider(this.settings.ollama);
    const openai = new OpenAIProvider(this.settings.openai);
    const gemini = new GeminiProvider(this.settings.gemini);
    const grok = new GrokProvider(this.settings.grok);
    const glm = new GLMProvider(this.settings.glm);
    const kimi = new KimiProvider(this.settings.kimi);
    this.providers.set(ollama.id, ollama);
    this.providers.set(openai.id, openai);
    this.providers.set(gemini.id, gemini);
    this.providers.set(grok.id, grok);
    this.providers.set(glm.id, glm);
    this.providers.set(kimi.id, kimi);
  }
  getProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider ${id} not found`);
    return provider;
  }
  getEnabledProviders() {
    return Array.from(this.providers.values());
  }
  getSettings() {
    return this.settings;
  }
  updateSettings(settings) {
    this.settings = settings;
    this.initializeProviders();
  }
}
class BlockManager {
  constructor(app) {
    this.sessionFocus = { lineStart: null, ch: null, file: null };
    this.app = app;
  }
  parseBlock(source) {
    const trimmedSource = source.trim();
    const yamlMatch = trimmedSource.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*)|$)/);
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
        config.prompt = (yamlMatch[2] || "").trim();
      } catch (error) {
        console.error("Error parsing YAML:", error);
        config.hasYaml = false;
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
    if (!sectionInfo) throw new Error("Could not get section info");
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!view) throw new Error("No active markdown view");
    const editor = view.editor;
    const { lineStart, lineEnd } = sectionInfo;
    const updatedBlockContent = newYaml ? `---
${newYaml}
---
${newPrompt}` : newPrompt;
    const startPos = { line: lineStart + 1, ch: 0 };
    const endPos = { line: lineEnd, ch: 0 };
    editor.replaceRange(updatedBlockContent + "\n", startPos, endPos);
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
    this.restoreFocus();
  }
  createLayout() {
    const container = this.el.createDiv({ cls: "ollama-container" });
    container.style.cssText = "padding: 12px; background: var(--background-secondary); border-radius: 8px; margin: 10px 0;";
    const headerRow = container.createDiv({ cls: "ollama-header" });
    headerRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;";
    headerRow.createEl("label", { text: "Prompt:", cls: "setting-item-name" }).style.cssText = "font-weight: 600; margin-right: 16px;";
    const controlsRow = headerRow.createDiv({ cls: "ollama-controls" });
    controlsRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
    const providerDropdown = controlsRow.createEl("select", { cls: "ollama-provider-dropdown dropdown" });
    providerDropdown.style.cssText = "padding: 4px 12px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller); cursor: pointer;";
    const providers = this.service.getEnabledProviders();
    providers.forEach((p) => {
      providerDropdown.createEl("option", { value: p.id, text: p.name });
    });
    providerDropdown.value = this.blockSettings.yamlConfig.provider || this.service.getSettings().activeProvider;
    const modelLabel = controlsRow.createEl("label", { text: "Model:", cls: "setting-item-name" });
    modelLabel.style.cssText = "font-size: var(--font-smaller); font-weight: 500; font-family: var(--font-interface); margin-left: 8px;";
    const modelDropdown = controlsRow.createEl("select", { cls: "ollama-model-dropdown dropdown" });
    modelDropdown.style.cssText = "padding: 4px 32px 4px 12px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller); line-height: 1.5; cursor: pointer; min-width: 140px; width: fit-content; max-width: 300px; height: auto;";
    let advancedButton = null;
    let configTextarea = null;
    let configDisplay = null;
    if (this.blockSettings.hasYaml) {
      advancedButton = controlsRow.createEl("button", { cls: "ollama-advanced-button" });
      obsidian.setIcon(advancedButton, "settings");
      advancedButton.style.cssText = "padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; display: flex; align-items: center; justify-content: center; margin-left: 4px;";
      advancedButton.title = "Advanced Settings";
      configDisplay = container.createDiv({ cls: "ollama-config-display" });
      configDisplay.style.cssText = "display: none; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 12px; margin-bottom: 12px; font-size: var(--font-smaller);";
      configTextarea = configDisplay.createEl("textarea", { attr: { rows: 8, placeholder: "YAML configuration..." } });
      configTextarea.style.cssText = "width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); resize: vertical; font-family: var(--font-monospace); font-size: var(--font-smaller);";
      configTextarea.value = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
    }
    const promptContainer = container.createDiv({ cls: "ollama-prompt-container" });
    promptContainer.style.cssText = "position: relative; width: 100%; margin-bottom: 12px;";
    const promptInput = promptContainer.createEl("div", { cls: "ollama-prompt-input", attr: { contenteditable: "true", "data-placeholder": "Enter prompt..." } });
    promptInput.innerHTML = this.blockSettings.prompt;
    promptInput.style.cssText = "width: 100%; padding: 12px; padding-bottom: 45px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary); color: var(--text-normal); overflow: auto; min-height: 100px; white-space: pre-wrap; word-wrap: break-word; outline: none; transition: border-color 0.2s;";
    promptInput.addEventListener("focus", () => promptInput.style.borderColor = "var(--interactive-accent)");
    promptInput.addEventListener("blur", () => promptInput.style.borderColor = "var(--background-modifier-border)");
    const actionButtons = promptContainer.createDiv({ cls: "ollama-action-buttons" });
    actionButtons.style.cssText = "position: absolute; bottom: 10px; right: 10px; display: flex; gap: 8px; align-items: center;";
    const copyButton = actionButtons.createEl("button", { cls: "ollama-copy-button" });
    obsidian.setIcon(copyButton, "copy");
    copyButton.style.cssText = "width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.9; transition: all 0.2s; display: flex; align-items: center; justify-content: center; color: var(--text-normal);";
    copyButton.title = "Copy prompt";
    const copyIcon = copyButton.querySelector("svg");
    if (copyIcon) {
      copyIcon.style.width = "28px";
      copyIcon.style.height = "28px";
    }
    copyButton.addEventListener("mouseenter", () => {
      copyButton.style.opacity = "1";
      copyButton.style.background = "var(--background-modifier-border-hover)";
      copyButton.style.transform = "scale(1.05)";
    });
    copyButton.addEventListener("mouseleave", () => {
      copyButton.style.opacity = "0.9";
      copyButton.style.background = "var(--background-modifier-border)";
      copyButton.style.transform = "scale(1)";
    });
    const saveButton = actionButtons.createEl("button", { cls: "ollama-save-button" });
    obsidian.setIcon(saveButton, "save");
    saveButton.style.cssText = "width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.9; transition: all 0.2s; display: flex; align-items: center; justify-content: center; color: var(--text-normal);";
    saveButton.title = "Save prompt (Ctrl+S)";
    const saveIcon = saveButton.querySelector("svg");
    if (saveIcon) {
      saveIcon.style.width = "24px";
      saveIcon.style.height = "24px";
    }
    saveButton.addEventListener("mouseenter", () => {
      saveButton.style.opacity = "1";
      saveButton.style.background = "var(--interactive-accent)";
      saveButton.style.color = "var(--text-on-accent)";
      saveButton.style.transform = "scale(1.05)";
    });
    saveButton.addEventListener("mouseleave", () => {
      saveButton.style.opacity = "0.9";
      saveButton.style.background = "var(--background-modifier-border)";
      saveButton.style.color = "var(--text-normal)";
      saveButton.style.transform = "scale(1)";
    });
    const clearButton = actionButtons.createEl("button", { cls: "ollama-clear-button" });
    obsidian.setIcon(clearButton, "trash");
    clearButton.style.cssText = "width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.9; transition: all 0.2s; display: flex; align-items: center; justify-content: center; color: var(--text-normal);";
    clearButton.title = "Clear prompt";
    const clearIcon = clearButton.querySelector("svg");
    if (clearIcon) {
      clearIcon.style.width = "28px";
      clearIcon.style.height = "28px";
    }
    clearButton.addEventListener("mouseenter", () => {
      clearButton.style.opacity = "1";
      clearButton.style.background = "var(--text-error)";
      clearButton.style.color = "white";
      clearButton.style.transform = "scale(1.05)";
    });
    clearButton.addEventListener("mouseleave", () => {
      clearButton.style.opacity = "0.9";
      clearButton.style.background = "var(--background-modifier-border)";
      clearButton.style.color = "var(--text-normal)";
      clearButton.style.transform = "scale(1)";
    });
    const submitButton = actionButtons.createEl("button", { cls: "ollama-submit-button mod-cta" });
    obsidian.setIcon(submitButton, "send");
    submitButton.style.cssText = "width: 42px; height: 42px; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; padding: 0;";
    submitButton.title = "Generate (Enter)";
    const submitIcon = submitButton.querySelector("svg");
    if (submitIcon) {
      submitIcon.style.width = "20px";
      submitIcon.style.height = "20px";
    }
    const buttonContainer = container.createDiv({ cls: "ollama-button-container" });
    buttonContainer.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: flex-start;";
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
    this.components = { providerDropdown, modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, clearButton, submitButton, saveButton, responsesWrapper };
  }
  initializeController() {
    const { providerDropdown, modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, clearButton, submitButton, saveButton, responsesWrapper } = this.components;
    let abortController = null;
    let isGenerating = false;
    const updateSubmitButtonState = () => {
      const hasContent = promptInput.innerText.trim().length > 0;
      if (isGenerating) {
        submitButton.disabled = false;
        submitButton.style.opacity = "1";
        submitButton.style.backgroundColor = "var(--text-error)";
        submitButton.style.color = "white";
        obsidian.setIcon(submitButton, "square");
        const icon = submitButton.querySelector("svg");
        if (icon) {
          icon.style.width = "14px";
          icon.style.height = "14px";
        }
        submitButton.title = "Stop generating";
      } else {
        submitButton.disabled = !hasContent;
        submitButton.style.opacity = hasContent ? "1" : "0.4";
        submitButton.style.backgroundColor = hasContent ? "var(--interactive-accent)" : "var(--background-modifier-border)";
        submitButton.style.color = hasContent ? "var(--text-on-accent)" : "var(--text-muted)";
        obsidian.setIcon(submitButton, "send");
        const icon = submitButton.querySelector("svg");
        if (icon) {
          icon.style.width = "20px";
          icon.style.height = "20px";
        }
        submitButton.title = hasContent ? "Generate (Enter)" : "Enter prompt to generate";
      }
    };
    updateSubmitButtonState();
    const populateModels = async () => {
      try {
        const providerId = providerDropdown.value;
        const provider = this.service.getProvider(providerId);
        const res = await provider.fetchModels();
        modelDropdown.innerHTML = "";
        res.models.forEach((m) => {
          modelDropdown.createEl("option", { value: m.id, text: m.name });
        });
        const savedModel = this.blockSettings.yamlConfig.model;
        const defaultModel = providerId === "ollama" ? this.service.getSettings().ollama.model : this.service.getSettings().openai.model;
        modelDropdown.value = savedModel || defaultModel;
      } catch (e) {
        new obsidian.Notice("Failed to load models for selected provider");
      }
    };
    populateModels();
    providerDropdown.addEventListener("change", async () => {
      const providerId = providerDropdown.value;
      this.blockSettings.yamlConfig.provider = providerId;
      this.blockSettings.yamlConfig.model = "";
      const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
      if (configTextarea) configTextarea.value = newYaml;
      await populateModels();
    });
    modelDropdown.addEventListener("change", () => {
      this.blockSettings.yamlConfig.model = modelDropdown.value;
      const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
      if (configTextarea) configTextarea.value = newYaml;
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
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        promptInput.innerText = "";
        updateSubmitButtonState();
        const yaml = this.blockSettings.hasYaml ? configTextarea.value : "";
        this.manager.updateFileBlock(this.el, this.ctx, "", yaml);
        new obsidian.Notice("Prompt cleared");
      });
    }
    if (advancedButton) {
      advancedButton.addEventListener("click", () => {
        const isHidden = configDisplay.style.display === "none";
        configDisplay.style.display = isHidden ? "block" : "none";
        advancedButton.style.background = isHidden ? "var(--background-modifier-active-hover)" : "transparent";
      });
      configTextarea.addEventListener("blur", () => {
        this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), configTextarea.value.trim());
      });
    }
    const updateResponseCount = this.debounce((val) => {
      this.blockSettings.yamlConfig.num_responses = val;
      const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
      if (configTextarea) configTextarea.value = newYaml;
    }, 1e3);
    responsesSlider.addEventListener("input", () => {
      responsesInput.value = responsesSlider.value;
      updateResponseCount(parseInt(responsesSlider.value));
    });
    responsesInput.addEventListener("input", () => {
      responsesSlider.value = responsesInput.value;
      updateResponseCount(parseInt(responsesInput.value));
    });
    const startGeneration = async () => {
      if (isGenerating) {
        abortController == null ? void 0 : abortController.abort();
        return;
      }
      const prompt = promptInput.innerText.trim();
      if (!prompt) return;
      isGenerating = true;
      updateSubmitButtonState();
      const count = parseInt(responsesInput.value) || 1;
      responsesWrapper.style.display = "flex";
      responsesWrapper.innerHTML = "";
      abortController = new AbortController();
      const providerId = providerDropdown.value;
      const provider = this.service.getProvider(providerId);
      try {
        for (let i = 0; i < count; i++) {
          const item = responsesWrapper.createDiv({ cls: "ollama-response-item" });
          item.style.cssText = "background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; position: relative; min-height: 42px;";
          const content = item.createDiv();
          const outputPre = content.createEl("pre", { cls: "ollama-output" });
          outputPre.style.cssText = "white-space: pre-wrap; font-size: var(--font-smaller); font-family: var(--font-monospace); margin: 0; padding-right: 30px; line-height: 1.4;";
          const copyRespButton = item.createEl("button", { cls: "ollama-response-copy-button" });
          obsidian.setIcon(copyRespButton, "copy");
          copyRespButton.style.cssText = "position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.15; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; color: var(--text-normal); padding: 0;";
          copyRespButton.title = "Copy response";
          const copyIcon = copyRespButton.querySelector("svg");
          if (copyIcon) {
            copyIcon.style.width = "18px";
            copyIcon.style.height = "18px";
          }
          item.addEventListener("mouseenter", () => {
            if (copyRespButton.style.opacity !== "1") copyRespButton.style.opacity = "0.4";
          });
          item.addEventListener("mouseleave", () => {
            if (copyRespButton.style.opacity !== "1") copyRespButton.style.opacity = "0.15";
          });
          copyRespButton.addEventListener("mouseenter", () => {
            copyRespButton.style.opacity = "1";
            copyRespButton.style.background = "var(--interactive-accent)";
            copyRespButton.style.color = "var(--text-on-accent)";
            copyRespButton.style.transform = "scale(1.1)";
          });
          copyRespButton.addEventListener("mouseleave", () => {
            copyRespButton.style.opacity = "0.4";
            copyRespButton.style.background = "var(--background-modifier-border)";
            copyRespButton.style.color = "var(--text-normal)";
            copyRespButton.style.transform = "scale(1)";
          });
          copyRespButton.addEventListener("click", async (e) => {
            e.stopPropagation();
            await navigator.clipboard.writeText(outputPre.textContent || "");
            new obsidian.Notice("Response copied");
            obsidian.setIcon(copyRespButton, "check");
            const checkIcon = copyRespButton.querySelector("svg");
            if (checkIcon) {
              checkIcon.style.width = "18px";
              checkIcon.style.height = "18px";
            }
            setTimeout(() => {
              obsidian.setIcon(copyRespButton, "copy");
              const resetIcon = copyRespButton.querySelector("svg");
              if (resetIcon) {
                resetIcon.style.width = "18px";
                resetIcon.style.height = "18px";
              }
            }, 2e3);
          });
          const statsDiv = item.createDiv({ cls: "ollama-stats" });
          statsDiv.style.cssText = "position: absolute; bottom: 6px; right: 10px; font-size: 9px; color: var(--text-muted); opacity: 0.5; pointer-events: none;";
          try {
            let statsShown = false;
            await provider.streamResponse(prompt, modelDropdown.value, this.blockSettings.yamlConfig, abortController, (chunk) => {
              outputPre.textContent += chunk;
            }, (final) => {
              if (final.total_duration && !statsShown) {
                statsShown = true;
                const durationSec = (final.total_duration / 1e9).toFixed(2);
                const totalTokens = (final.prompt_eval_count || 0) + (final.eval_count || 0);
                statsDiv.textContent = `${totalTokens} tkn | ${durationSec}s`;
              }
            });
          } catch (e) {
            if (e.name === "AbortError") break;
            content.createDiv({ text: `Error: ${e.message}` }).style.color = "var(--text-error)";
            break;
          }
        }
      } finally {
        isGenerating = false;
        updateSubmitButtonState();
      }
    };
    submitButton.addEventListener("click", startGeneration);
    const manualSave = async () => {
      const yaml = this.blockSettings.hasYaml ? configTextarea.value : "";
      await this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), yaml);
      new obsidian.Notice("Saved");
    };
    saveButton.addEventListener("click", manualSave);
    promptInput.addEventListener("input", () => {
      updateSubmitButtonState();
    });
    promptInput.addEventListener("blur", () => {
      const yaml = this.blockSettings.hasYaml ? configTextarea.value : "";
      this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), yaml);
    });
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        startGeneration();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        manualSave();
      }
    });
    const trackFocus = () => {
      const section = this.ctx.getSectionInfo(this.el);
      if (!section) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(promptInput);
      preRange.setEnd(range.startContainer, range.startOffset);
      const offset = preRange.toString().length;
      this.manager.sessionFocus = {
        lineStart: section.lineStart,
        ch: offset,
        file: this.ctx.sourcePath
      };
    };
    promptInput.addEventListener("keyup", trackFocus);
    promptInput.addEventListener("mouseup", trackFocus);
    promptInput.addEventListener("focus", trackFocus);
  }
  restoreFocus() {
    const { promptInput } = this.components;
    const section = this.ctx.getSectionInfo(this.el);
    const focus = this.manager.sessionFocus;
    if (section && focus.lineStart === section.lineStart && focus.file === this.ctx.sourcePath) {
      promptInput.focus();
      if (focus.ch !== null) {
        const selection = window.getSelection();
        const range = document.createRange();
        let currentOffset = 0;
        let targetNode = null;
        let targetOffset = 0;
        const findNode = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const len = node.length;
            if (currentOffset + len >= focus.ch) {
              targetNode = node;
              targetOffset = focus.ch - currentOffset;
              return true;
            }
            currentOffset += len;
          } else {
            for (let i = 0; i < node.childNodes.length; i++) {
              if (findNode(node.childNodes[i])) return true;
            }
          }
          return false;
        };
        findNode(promptInput);
        if (targetNode) {
          range.setStart(targetNode, targetOffset);
          range.collapse(true);
          selection == null ? void 0 : selection.removeAllRanges();
          selection == null ? void 0 : selection.addRange(range);
        } else {
          range.selectNodeContents(promptInput);
          range.collapse(false);
          selection == null ? void 0 : selection.removeAllRanges();
          selection == null ? void 0 : selection.addRange(range);
        }
      }
    }
  }
  debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
}
class LLMSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "General Settings" });
    new obsidian.Setting(containerEl).setName("Active Provider").setDesc("Select the AI provider to use by default").addDropdown((dropdown) => {
      dropdown.addOption("ollama", "Ollama (Local)").addOption("openai", "OpenAI").addOption("gemini", "Gemini (Google)").addOption("grok", "Grok (xAI)").addOption("glm", "GLM (Zhipu AI)").addOption("kimi", "Kimi (Moonshot AI)").setValue(this.plugin.settings.activeProvider).onChange(async (value) => {
        this.plugin.settings.activeProvider = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    const activeProvider = this.plugin.settings.activeProvider;
    if (activeProvider === "ollama") {
      this.renderOllamaSettings(containerEl);
    } else {
      const providerNames = {
        openai: "OpenAI",
        gemini: "Gemini",
        grok: "Grok",
        glm: "GLM (Zhipu)",
        kimi: "Kimi (Moonshot)"
      };
      this.renderGenericSettings(containerEl, activeProvider, providerNames[activeProvider]);
    }
  }
  renderOllamaSettings(containerEl) {
    containerEl.createEl("h3", { text: "Ollama Settings" });
    new obsidian.Setting(containerEl).setName("Ollama Server URL").setDesc("The URL where your Ollama server is running").addText((text) => text.setPlaceholder("http://localhost:11434").setValue(this.plugin.settings.ollama.serverUrl).onChange(async (value) => {
      this.plugin.settings.ollama.serverUrl = value;
      await this.plugin.saveSettings();
    }));
    new obsidian.Setting(containerEl).setName("Default Model").setDesc("Default model for newly created blocks").addDropdown(async (dropdown) => {
      dropdown.addOption("", "Loading models...");
      try {
        const provider = this.plugin.llmService.getProvider("ollama");
        const response = await provider.fetchModels();
        dropdown.selectEl.innerHTML = "";
        response.models.forEach((m) => {
          dropdown.addOption(m.id, m.name);
        });
        dropdown.setValue(this.plugin.settings.ollama.model);
      } catch (e) {
        dropdown.addOption("", "Could not load models");
      }
      dropdown.onChange(async (value) => {
        this.plugin.settings.ollama.model = value;
        await this.plugin.saveSettings();
      });
    });
  }
  renderGenericSettings(containerEl, providerId, name) {
    containerEl.createEl("h3", { text: `${name} Settings` });
    const settings = this.plugin.settings[providerId];
    new obsidian.Setting(containerEl).setName("API Key").setDesc(`Your ${name} API key`).addText((text) => text.setPlaceholder("API Key").setValue(settings.apiKey).onChange(async (value) => {
      settings.apiKey = value;
      await this.plugin.saveSettings();
    }).inputEl.type = "password");
    new obsidian.Setting(containerEl).setName("Base URL").setDesc("Custom endpoint URL").addText((text) => text.setPlaceholder("https://...").setValue(settings.baseUrl).onChange(async (value) => {
      settings.baseUrl = value;
      await this.plugin.saveSettings();
    }));
    new obsidian.Setting(containerEl).setName("Default Model").setDesc(`Default model for ${name}`).addDropdown(async (dropdown) => {
      dropdown.addOption("", "Loading models...");
      try {
        const provider = this.plugin.llmService.getProvider(providerId);
        const response = await provider.fetchModels();
        dropdown.selectEl.innerHTML = "";
        response.models.forEach((m) => {
          dropdown.addOption(m.id, m.name);
        });
        dropdown.setValue(settings.model);
      } catch (e) {
        dropdown.addOption("", "Could not load models");
      }
      dropdown.onChange(async (value) => {
        settings.model = value;
        await this.plugin.saveSettings();
      });
    });
  }
}
class AITesterPlugin extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    console.log("AI Tester plugin loading...");
    await this.loadSettings();
    this.llmService = new LLMService(this.settings);
    this.blockManager = new BlockManager(this.app);
    this.addSettingTab(new LLMSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor("ai-tester", (source, el, ctx) => {
      const blockSettings = this.blockManager.parseBlock(source);
      const view = new OllamaBlockView(el, this.llmService, this.blockManager, ctx, blockSettings);
      view.render();
    });
  }
  async onunload() {
    console.log("AI Tester plugin unloaded");
  }
  async loadSettings() {
    var _a, _b;
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    if (loadedData && (loadedData.model || loadedData.serverUrl)) {
      if (loadedData.model && !((_a = loadedData.ollama) == null ? void 0 : _a.model)) {
        this.settings.ollama.model = loadedData.model;
      }
      if (loadedData.serverUrl && !((_b = loadedData.ollama) == null ? void 0 : _b.serverUrl)) {
        this.settings.ollama.serverUrl = loadedData.serverUrl;
      }
      await this.saveSettings();
    }
  }
  async saveSettings() {
    const sanitizedSettings = {};
    const validKeys = Object.keys(DEFAULT_SETTINGS);
    validKeys.forEach((key) => {
      sanitizedSettings[key] = this.settings[key];
    });
    await this.saveData(sanitizedSettings);
    this.llmService.updateSettings(this.settings);
  }
}
module.exports = AITesterPlugin;
