import { Notice, MarkdownPostProcessorContext, setIcon } from 'obsidian';
import { LLMBlockSettings, ProviderType, LLMModel } from '../types';
import { LLMService } from '../services/LLMService';
import { BlockManager } from '../logic/BlockManager';

export class OllamaBlockView {
    private el: HTMLElement;
    private service: LLMService;
    private manager: BlockManager;
    private ctx: MarkdownPostProcessorContext;
    private blockSettings: LLMBlockSettings;

    private components: any = {};

    constructor(el: HTMLElement, service: LLMService, manager: BlockManager, ctx: MarkdownPostProcessorContext, blockSettings: LLMBlockSettings) {
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

    private createLayout() {
        const container = this.el.createDiv({ cls: 'ollama-container' });
        container.style.cssText = 'padding: 12px; background: var(--background-secondary); border-radius: 8px; margin: 10px 0;';

        const headerRow = container.createDiv({ cls: 'ollama-header' });
        headerRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;';
        headerRow.createEl('label', { text: 'Prompt:', cls: 'setting-item-name' }).style.cssText = 'font-weight: 600; margin-right: 16px;';

        const controlsRow = headerRow.createDiv({ cls: 'ollama-controls' });
        controlsRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        // Provider Selection
        const providerDropdown = controlsRow.createEl('select', { cls: 'ollama-provider-dropdown dropdown' });
        providerDropdown.style.cssText = 'padding: 4px 12px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller); cursor: pointer;';

        const providers = this.service.getEnabledProviders();
        providers.forEach(p => {
            providerDropdown.createEl('option', { value: p.id, text: p.name });
        });
        providerDropdown.value = this.blockSettings.yamlConfig.provider || this.service.getSettings().activeProvider;

        // Model Selection
        const modelLabel = controlsRow.createEl('label', { text: 'Model:', cls: 'setting-item-name' });
        modelLabel.style.cssText = 'font-size: var(--font-smaller); font-weight: 500; font-family: var(--font-interface); margin-left: 8px;';

        const modelDropdown = controlsRow.createEl('select', { cls: 'ollama-model-dropdown dropdown' });
        modelDropdown.style.cssText = 'padding: 4px 32px 4px 12px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: var(--font-smaller); line-height: 1.5; cursor: pointer; min-width: 140px; width: fit-content; max-width: 300px; height: auto;';

        let advancedButton: HTMLButtonElement | null = null;
        let configTextarea: HTMLTextAreaElement | null = null;
        let configDisplay: HTMLDivElement | null = null;

        if (this.blockSettings.hasYaml) {
            advancedButton = controlsRow.createEl('button', { cls: 'ollama-advanced-button' });
            setIcon(advancedButton, 'settings');
            advancedButton.style.cssText = 'padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; display: flex; align-items: center; justify-content: center; margin-left: 4px;';
            advancedButton.title = 'Advanced Settings';

            configDisplay = container.createDiv({ cls: 'ollama-config-display' });
            configDisplay.style.cssText = 'display: none; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 12px; margin-bottom: 12px; font-size: var(--font-smaller);';

            configTextarea = configDisplay.createEl('textarea', { attr: { rows: 8, placeholder: 'YAML configuration...' } });
            configTextarea.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); resize: vertical; font-family: var(--font-monospace); font-size: var(--font-smaller);';
            configTextarea.value = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
        }

        const promptContainer = container.createDiv({ cls: 'ollama-prompt-container' });
        promptContainer.style.cssText = 'position: relative; width: 100%; margin-bottom: 12px;';

        const promptInput = promptContainer.createEl('div', { cls: 'ollama-prompt-input', attr: { contenteditable: 'true', 'data-placeholder': 'Enter prompt...' } });
        promptInput.innerHTML = this.blockSettings.prompt;
        promptInput.style.cssText = 'width: 100%; padding: 12px; padding-bottom: 45px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary); color: var(--text-normal); overflow: auto; min-height: 100px; white-space: pre-wrap; word-wrap: break-word; outline: none; transition: border-color 0.2s;';
        promptInput.addEventListener('focus', () => promptInput.style.borderColor = 'var(--interactive-accent)');
        promptInput.addEventListener('blur', () => promptInput.style.borderColor = 'var(--background-modifier-border)');

        const actionButtons = promptContainer.createDiv({ cls: 'ollama-action-buttons' });
        actionButtons.style.cssText = 'position: absolute; bottom: 10px; right: 10px; display: flex; gap: 8px; align-items: center;';

        const copyButton = actionButtons.createEl('button', { cls: 'ollama-copy-button' });
        setIcon(copyButton, 'copy');
        copyButton.style.cssText = 'width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.9; transition: all 0.2s; display: flex; align-items: center; justify-content: center; color: var(--text-normal);';
        copyButton.title = 'Copy prompt';
        const copyIcon = copyButton.querySelector('svg');
        if (copyIcon) { copyIcon.style.width = '28px'; copyIcon.style.height = '28px'; }

        copyButton.addEventListener('mouseenter', () => {
            copyButton.style.opacity = '1';
            copyButton.style.background = 'var(--background-modifier-border-hover)';
            copyButton.style.transform = 'scale(1.05)';
        });
        copyButton.addEventListener('mouseleave', () => {
            copyButton.style.opacity = '0.9';
            copyButton.style.background = 'var(--background-modifier-border)';
            copyButton.style.transform = 'scale(1)';
        });

        const clearButton = actionButtons.createEl('button', { cls: 'ollama-clear-button' });
        setIcon(clearButton, 'trash');
        clearButton.style.cssText = 'width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.9; transition: all 0.2s; display: flex; align-items: center; justify-content: center; color: var(--text-normal);';
        clearButton.title = 'Clear prompt';
        const clearIcon = clearButton.querySelector('svg');
        if (clearIcon) { clearIcon.style.width = '28px'; clearIcon.style.height = '28px'; }

        clearButton.addEventListener('mouseenter', () => {
            clearButton.style.opacity = '1';
            clearButton.style.background = 'var(--text-error)';
            clearButton.style.color = 'white';
            clearButton.style.transform = 'scale(1.05)';
        });
        clearButton.addEventListener('mouseleave', () => {
            clearButton.style.opacity = '0.9';
            clearButton.style.background = 'var(--background-modifier-border)';
            clearButton.style.color = 'var(--text-normal)';
            clearButton.style.transform = 'scale(1)';
        });

        const submitButton = actionButtons.createEl('button', { cls: 'ollama-submit-button mod-cta' });
        setIcon(submitButton, 'send');
        submitButton.style.cssText = 'width: 42px; height: 42px; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; padding: 0;';
        submitButton.title = 'Generate (Enter)';
        const submitIcon = submitButton.querySelector('svg');
        if (submitIcon) { submitIcon.style.width = '20px'; submitIcon.style.height = '20px'; }

        const saveButton = actionButtons.createEl('button', { cls: 'ollama-save-button' });
        setIcon(saveButton, 'save');
        saveButton.style.cssText = 'width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer; background: var(--background-modifier-border); opacity: 0.9; transition: all 0.2s; display: flex; align-items: center; justify-content: center; color: var(--text-normal);';
        saveButton.title = 'Save prompt (Ctrl+S)';
        const saveIcon = saveButton.querySelector('svg');
        if (saveIcon) { saveIcon.style.width = '24px'; saveIcon.style.height = '24px'; }

        saveButton.addEventListener('mouseenter', () => {
            saveButton.style.opacity = '1';
            saveButton.style.background = 'var(--interactive-accent)';
            saveButton.style.color = 'var(--text-on-accent)';
            saveButton.style.transform = 'scale(1.05)';
        });
        saveButton.addEventListener('mouseleave', () => {
            saveButton.style.opacity = '0.9';
            saveButton.style.background = 'var(--background-modifier-border)';
            saveButton.style.color = 'var(--text-normal)';
            saveButton.style.transform = 'scale(1)';
        });

        const buttonContainer = container.createDiv({ cls: 'ollama-button-container' });
        buttonContainer.style.cssText = 'display: flex; gap: 10px; align-items: center; justify-content: flex-start;';

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

        this.components = { providerDropdown, modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, clearButton, submitButton, saveButton, responsesWrapper };
    }

    private initializeController() {
        const { providerDropdown, modelDropdown, advancedButton, configDisplay, configTextarea, responsesSlider, responsesInput, promptInput, copyButton, clearButton, submitButton, saveButton, responsesWrapper } = this.components;
        let abortController: AbortController | null = null;
        let isGenerating = false;

        const updateSubmitButtonState = () => {
            const hasContent = promptInput.innerText.trim().length > 0;
            if (isGenerating) {
                submitButton.disabled = false;
                submitButton.style.opacity = '1';
                submitButton.style.backgroundColor = 'var(--text-error)';
                submitButton.style.color = 'white';
                setIcon(submitButton, 'square');
                const icon = submitButton.querySelector('svg');
                if (icon) { icon.style.width = '14px'; icon.style.height = '14px'; }
                submitButton.title = 'Stop generating';
            } else {
                submitButton.disabled = !hasContent;
                submitButton.style.opacity = hasContent ? '1' : '0.4';
                submitButton.style.backgroundColor = hasContent ? 'var(--interactive-accent)' : 'var(--background-modifier-border)';
                submitButton.style.color = hasContent ? 'var(--text-on-accent)' : 'var(--text-muted)';
                setIcon(submitButton, 'send');
                const icon = submitButton.querySelector('svg');
                if (icon) { icon.style.width = '20px'; icon.style.height = '20px'; }
                submitButton.title = hasContent ? 'Generate (Enter)' : 'Enter prompt to generate';
            }
        };

        updateSubmitButtonState();

        const populateModels = async () => {
            try {
                const providerId = providerDropdown.value;
                const provider = this.service.getProvider(providerId);
                const res = await provider.fetchModels();

                modelDropdown.innerHTML = '';
                res.models.forEach((m: LLMModel) => {
                    modelDropdown.createEl('option', { value: m.id, text: m.name });
                });

                const savedModel = this.blockSettings.yamlConfig.model;
                const defaultModel = providerId === 'ollama' ? this.service.getSettings().ollama.model : this.service.getSettings().openai.model;

                modelDropdown.value = savedModel || defaultModel;
            } catch (e) {
                new Notice('Failed to load models for selected provider');
            }
        };

        populateModels();

        providerDropdown.addEventListener('change', async () => {
            const providerId = providerDropdown.value as ProviderType;
            this.blockSettings.yamlConfig.provider = providerId;
            this.blockSettings.yamlConfig.model = ''; // Reset model on provider change

            const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
            this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
            if (configTextarea) configTextarea.value = newYaml;

            await populateModels();
        });

        modelDropdown.addEventListener('change', () => {
            this.blockSettings.yamlConfig.model = modelDropdown.value;
            const newYaml = this.manager.generateYamlFromConfig(this.blockSettings.yamlConfig);
            this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), newYaml);
            if (configTextarea) configTextarea.value = newYaml;
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

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                promptInput.innerText = '';
                updateSubmitButtonState();
                const yaml = this.blockSettings.hasYaml ? configTextarea.value : '';
                this.manager.updateFileBlock(this.el, this.ctx, '', yaml);
                new Notice('Prompt cleared');
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

        const startGeneration = async () => {
            if (isGenerating) {
                abortController?.abort();
                return;
            }

            const prompt = promptInput.innerText.trim();
            if (!prompt) return;

            isGenerating = true;
            updateSubmitButtonState();

            const count = parseInt(responsesInput.value) || 1;
            responsesWrapper.style.display = 'flex';
            responsesWrapper.innerHTML = '';

            abortController = new AbortController();
            const providerId = providerDropdown.value;
            const provider = this.service.getProvider(providerId);

            try {
                for (let i = 0; i < count; i++) {
                    const item = responsesWrapper.createDiv({ cls: 'ollama-response-item' });
                    item.style.cssText = 'background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 12px; margin-bottom: 8px;';
                    const content = item.createDiv();
                    const outputPre = content.createEl('pre', { cls: 'ollama-output' });
                    outputPre.style.cssText = 'white-space: pre-wrap; font-size: var(--font-smaller); font-family: var(--font-monospace);';

                    try {
                        let statsShown = false;
                        const footerContainer = item.createDiv({ cls: 'ollama-response-footer' });
                        footerContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8px; border-top: 1px solid var(--background-modifier-border); padding-top: 4px; position: relative;';

                        const copyRespButton = footerContainer.createEl('button', { cls: 'ollama-response-copy-button' });
                        setIcon(copyRespButton, 'copy');
                        copyRespButton.style.cssText = 'padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; opacity: 0.3; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;';
                        copyRespButton.title = 'Copy response';
                        copyRespButton.addEventListener('mouseenter', () => copyRespButton.style.opacity = '1');
                        copyRespButton.addEventListener('mouseleave', () => copyRespButton.style.opacity = '0.3');
                        copyRespButton.addEventListener('click', async () => {
                            await navigator.clipboard.writeText(outputPre.textContent || '');
                            new Notice('Response copied');
                        });

                        const statsDiv = footerContainer.createDiv({ cls: 'ollama-stats' });
                        statsDiv.style.cssText = 'font-size: 10px; color: var(--text-muted);';

                        await provider.streamResponse(prompt, modelDropdown.value, this.blockSettings.yamlConfig, abortController, (chunk) => {
                            outputPre.textContent += chunk;
                        }, (final) => {
                            if (final.total_duration && !statsShown) {
                                statsShown = true;
                                const durationSec = (final.total_duration / 1e9).toFixed(2);
                                const totalTokens = (final.prompt_eval_count || 0) + (final.eval_count || 0);
                                statsDiv.textContent = `Tokens: ${totalTokens} | Time: ${durationSec}s`;
                            }
                        });
                    } catch (e) {
                        if (e.name === 'AbortError') break;
                        content.createDiv({ text: `Error: ${e.message}` }).style.color = 'var(--text-error)';
                        break;
                    }
                }
            } finally {
                isGenerating = false;
                updateSubmitButtonState();
            }
        };

        submitButton.addEventListener('click', startGeneration);

        const manualSave = async () => {
            const yaml = this.blockSettings.hasYaml ? configTextarea.value : '';
            await this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), yaml);
            new Notice('Saved');
        };

        saveButton.addEventListener('click', manualSave);

        promptInput.addEventListener('input', () => {
            updateSubmitButtonState();
        });

        promptInput.addEventListener('blur', () => {
            const yaml = this.blockSettings.hasYaml ? configTextarea.value : '';
            this.manager.updateFileBlock(this.el, this.ctx, promptInput.innerText.trim(), yaml);
        });

        promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                startGeneration();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                manualSave();
            }
        });

        // Track focus/cursor position
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

        promptInput.addEventListener('keyup', trackFocus);
        promptInput.addEventListener('mouseup', trackFocus);
        promptInput.addEventListener('focus', trackFocus);
    }

    private restoreFocus() {
        const { promptInput } = this.components;
        const section = this.ctx.getSectionInfo(this.el);
        const focus = this.manager.sessionFocus;

        if (section && focus.lineStart === section.lineStart && focus.file === this.ctx.sourcePath) {
            promptInput.focus();
            if (focus.ch !== null) {
                const selection = window.getSelection();
                const range = document.createRange();

                let currentOffset = 0;
                let targetNode: Node | null = null;
                let targetOffset = 0;

                const findNode = (node: Node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const len = (node as Text).length;
                        if (currentOffset + len >= (focus.ch as number)) {
                            targetNode = node;
                            targetOffset = (focus.ch as number) - currentOffset;
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
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                } else {
                    // Fallback to end
                    range.selectNodeContents(promptInput);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }
        }
    }

    private debounce(fn: Function, wait: number) {
        let t: any;
        return (...args: any[]) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }
}
