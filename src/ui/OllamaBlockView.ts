import { Notice, MarkdownPostProcessorContext, setIcon } from 'obsidian';
import { OllamaBlockSettings } from '../types';
import { OllamaService } from '../services/OllamaService';
import { BlockManager } from '../logic/BlockManager';

export class OllamaBlockView {
    private el: HTMLElement;
    private service: OllamaService;
    private manager: BlockManager;
    private ctx: MarkdownPostProcessorContext;
    private blockSettings: OllamaBlockSettings;

    private components: any = {};

    constructor(el: HTMLElement, service: OllamaService, manager: BlockManager, ctx: MarkdownPostProcessorContext, blockSettings: OllamaBlockSettings) {
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

    private createLayout() {
        const container = this.el.createDiv({ cls: 'ollama-container' });
        container.style.cssText = 'padding: 12px; background: var(--background-secondary); border-radius: 8px; margin: 10px 0;';

        const headerRow = container.createDiv({ cls: 'ollama-header' });
        headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;';
        headerRow.createEl('label', { text: 'Prompt:', cls: 'setting-item-name' }).style.cssText = 'font-weight: 600; margin-right: 16px;';

        const controlsRow = headerRow.createDiv({ cls: 'ollama-controls' });
        controlsRow.style.cssText = 'display: flex; align-items: center; gap: 16px;';

        const modelLabel = controlsRow.createEl('label', { text: 'Model:', cls: 'setting-item-name' });
        modelLabel.style.cssText = 'font-size: var(--font-smaller); font-weight: 500;';

        const modelDropdown = controlsRow.createEl('select', { cls: 'ollama-model-dropdown dropdown' });
        modelDropdown.style.cssText = 'padding: 4px 32px 4px 12px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller); line-height: 1.5; cursor: pointer; min-width: 160px; width: fit-content; max-width: 400px; height: auto;';

        let advancedButton: HTMLButtonElement | null = null;
        let configTextarea: HTMLTextAreaElement | null = null;
        let configDisplay: HTMLDivElement | null = null;

        if (this.blockSettings.hasYaml) {
            advancedButton = controlsRow.createEl('button', { cls: 'ollama-advanced-button' });
            setIcon(advancedButton, 'settings');
            advancedButton.style.cssText = 'padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; display: flex; align-items: center; justify-content: center;';
            advancedButton.title = 'Advanced Settings';

            configDisplay = container.createDiv({ cls: 'ollama-config-display' });
            configDisplay.style.cssText = 'display: none; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 12px; margin-bottom: 12px; font-size: var(--font-smaller);';

            configTextarea = configDisplay.createEl('textarea', { attr: { rows: 8, placeholder: 'YAML configuration...' } });
            configTextarea.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); resize: vertical; font-family: var(--font-monospace); font-size: var(--font-smaller);';
            configTextarea.value = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
        }

        const promptContainer = container.createDiv({ cls: 'ollama-prompt-container' });
        promptContainer.style.cssText = 'position: relative; width: 100%; margin-bottom: 12px;';

        const promptInput = promptContainer.createEl('div', { cls: 'ollama-prompt-input', attr: { contenteditable: 'true', 'data-placeholder': 'Enter prompt... (Ctrl+Enter)' } });
        promptInput.innerHTML = this.blockSettings.prompt;
        promptInput.style.cssText = 'width: 100%; padding: 8px; padding-bottom: 30px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); overflow: auto; min-height: 80px; white-space: pre-wrap; word-wrap: break-word;';

        const copyButton = promptContainer.createEl('button', { cls: 'ollama-copy-button' });
        setIcon(copyButton, 'copy');
        copyButton.style.cssText = 'position: absolute; bottom: 8px; right: 8px; padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; opacity: 0.6; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;';
        copyButton.title = 'Copy prompt';
        copyButton.addEventListener('mouseenter', () => copyButton.style.opacity = '1');
        copyButton.addEventListener('mouseleave', () => copyButton.style.opacity = '0.6');

        const buttonContainer = container.createDiv({ cls: 'ollama-button-container' });
        buttonContainer.style.cssText = 'display: flex; gap: 10px; align-items: center; justify-content: flex-start;';

        const submitButton = buttonContainer.createEl('button', { text: 'Generate', cls: 'mod-cta' });
        submitButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;';

        const cancelButton = buttonContainer.createEl('button', { text: 'Stop', cls: 'mod-warning' });
        cancelButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; display: none;';

        // Responses container moved to buttonContainer
        const responsesContainer = buttonContainer.createDiv({ cls: 'ollama-responses-control' });
        responsesContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: auto;';
        responsesContainer.createEl('label', { text: 'Responses:', cls: 'setting-item-name' }).style.cssText = 'font-size: var(--font-smaller);';

        const initialResponses = this.blockSettings.yamlConfig.num_responses || 1;
        const responsesSlider = responsesContainer.createEl('input', { cls: 'ollama-responses-slider', attr: { type: 'range', min: '1', max: '20', value: initialResponses.toString(), step: '1' } });
        responsesSlider.style.cssText = 'width: 100px; cursor: pointer;';

        const responsesInput = responsesContainer.createEl('input', { cls: 'ollama-responses-input', attr: { type: 'number', min: '1', max: '20', value: initialResponses.toString() } });
        responsesInput.style.cssText = 'width: 50px; padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller);';

        const responsesWrapper = container.createDiv({ cls: 'ollama-responses-wrapper' });
        responsesWrapper.style.cssText = 'margin-top: 12px; display: none; flex-direction: column; gap: 8px;';

        this.components = { modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, submitButton, cancelButton, responsesWrapper };
    }

    private initializeController() {
        const { modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, submitButton, cancelButton, responsesWrapper } = this.components;
        let abortController: AbortController | null = null;

        // Model population
        const populate = async () => {
            try {
                const res = await this.service.fetchModels();
                modelDropdown.innerHTML = '';
                res.models.forEach(m => {
                    modelDropdown.createEl('option', { value: m.name, text: m.name });
                });

                // Set initial value from YAML or fallback to global default
                const initialModel = this.blockSettings.yamlConfig.model || this.service.getSettings().model;
                if (initialModel) {
                    modelDropdown.value = initialModel;
                }
            } catch (e) { new Notice('Failed to load models'); }
        };
        populate();

        const updateModelInYaml = this.debounce((modelName: string) => {
            this.blockSettings.yamlConfig.model = modelName;
            const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
            this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
            if (configTextarea) configTextarea.value = newYaml;
        }, 1000);

        modelDropdown.addEventListener('change', () => {
            updateModelInYaml(modelDropdown.value);
        });
        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                const text = promptInput.innerText.trim();
                if (text) {
                    await navigator.clipboard.writeText(text);
                    new Notice('Prompt copied to clipboard');
                }
            });
        }
        if (advancedButton) {
            advancedButton.addEventListener('click', () => {
                const isHidden = configDisplay.style.display === 'none';
                configDisplay.style.display = isHidden ? 'block' : 'none';
                advancedButton.style.background = isHidden ? 'var(--background-modifier-active-hover)' : 'transparent';
            });
            configTextarea.addEventListener('input', this.debounce(() => {
                this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), configTextarea.value.trim());
            }, 1000));
        }

        const updateResponseCount = this.debounce((val: number) => {
            this.blockSettings.yamlConfig.num_responses = val;
            const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
            this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
            if (configTextarea) configTextarea.value = newYaml;
        }, 1000);

        responsesSlider.addEventListener('input', () => {
            responsesInput.value = responsesSlider.value;
            updateResponseCount(parseInt(responsesSlider.value));
        });
        responsesInput.addEventListener('input', () => {
            responsesSlider.value = responsesInput.value;
            updateResponseCount(parseInt(responsesInput.value));
        });

        promptInput.addEventListener('input', this.debounce(() => {
            const yaml = this.blockSettings.hasYaml ? configTextarea.value : '';
            this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), yaml);
        }, 1000));

        submitButton.addEventListener('click', async () => {
            const prompt = promptInput.innerText.trim();
            if (!prompt) return new Notice('Prompt empty');

            const count = parseInt(responsesInput.value) || 1;
            submitButton.disabled = true;
            submitButton.textContent = 'Generating...';
            cancelButton.style.display = 'block';
            responsesWrapper.style.display = 'flex';
            responsesWrapper.innerHTML = '';

            abortController = new AbortController();

            for (let i = 0; i < count; i++) {
                const item = responsesWrapper.createDiv({ cls: 'ollama-response-item' });
                item.style.cssText = 'background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 12px;';
                const content = item.createDiv();
                const outputPre = content.createEl('pre', { cls: 'ollama-output' });
                outputPre.style.cssText = 'white-space: pre-wrap; font-size: var(--font-smaller);';

                // Use the model from the dropdown (which is synced with YAML)
                const currentModel = modelDropdown.value;

                try {
                    await this.service.streamOllamaResponse(prompt, currentModel, this.blockSettings.yamlConfig, abortController, (chunk) => {
                        outputPre.textContent += chunk;
                    }, (final) => { /* Stats logic could go here */ });
                } catch (e) {
                    if (e.name === 'AbortError') break;
                    content.createDiv({ text: `Error: ${e.message}` }).style.color = 'var(--text-error)';
                }
            }

            submitButton.disabled = false;
            submitButton.textContent = 'Generate';
            cancelButton.style.display = 'none';
        });

        cancelButton.addEventListener('click', () => abortController?.abort());
    }

    private debounce(fn: Function, wait: number) {
        let t: any;
        return (...args: any[]) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }
}
