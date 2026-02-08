import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type AITesterPlugin from '../main';
import { ProviderType, LLMModel } from '../types';

export class LLMSettingTab extends PluginSettingTab {
    plugin: AITesterPlugin;

    constructor(app: App, plugin: AITesterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'General Settings' });

        new Setting(containerEl)
            .setName('Active Provider')
            .setDesc('Select the AI provider to use by default')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('ollama', 'Ollama (Local)')
                    .addOption('openai', 'OpenAI')
                    .addOption('gemini', 'Gemini (Google)')
                    .addOption('grok', 'Grok (xAI)')
                    .addOption('glm', 'GLM (Zhipu AI)')
                    .addOption('kimi', 'Kimi (Moonshot AI)')
                    .setValue(this.plugin.settings.activeProvider)
                    .onChange(async (value: ProviderType) => {
                        this.plugin.settings.activeProvider = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show relevant settings
                    });
            });

        const activeProvider = this.plugin.settings.activeProvider;
        if (activeProvider === 'ollama') {
            this.renderOllamaSettings(containerEl);
        } else {
            const providerNames: Record<string, string> = {
                openai: 'OpenAI',
                gemini: 'Gemini',
                grok: 'Grok',
                glm: 'GLM (Zhipu)',
                kimi: 'Kimi (Moonshot)'
            };
            this.renderGenericSettings(containerEl, activeProvider, providerNames[activeProvider]);
        }
    }

    private renderOllamaSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'Ollama Settings' });

        new Setting(containerEl)
            .setName('Ollama Server URL')
            .setDesc('The URL where your Ollama server is running')
            .addText(text => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.ollama.serverUrl)
                .onChange(async (value) => {
                    this.plugin.settings.ollama.serverUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default model for newly created blocks')
            .addDropdown(async (dropdown) => {
                dropdown.addOption('', 'Loading models...');
                try {
                    const provider = this.plugin.llmService.getProvider('ollama');
                    const response = await provider.fetchModels();

                    dropdown.selectEl.innerHTML = '';
                    response.models.forEach((m: LLMModel) => {
                        dropdown.addOption(m.id, m.name);
                    });

                    dropdown.setValue(this.plugin.settings.ollama.model);
                } catch (e) {
                    dropdown.addOption('', 'Could not load models');
                }

                dropdown.onChange(async (value) => {
                    this.plugin.settings.ollama.model = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private renderGenericSettings(containerEl: HTMLElement, providerId: Extract<ProviderType, 'openai' | 'gemini' | 'grok' | 'glm' | 'kimi'>, name: string) {
        containerEl.createEl('h3', { text: `${name} Settings` });

        const settings = this.plugin.settings[providerId];

        new Setting(containerEl)
            .setName('API Key')
            .setDesc(`Your ${name} API key`)
            .addText(text => text
                .setPlaceholder('API Key')
                .setValue(settings.apiKey)
                .onChange(async (value) => {
                    settings.apiKey = value;
                    await this.plugin.saveSettings();
                })
                .inputEl.type = 'password');

        new Setting(containerEl)
            .setName('Base URL')
            .setDesc('Custom endpoint URL')
            .addText(text => text
                .setPlaceholder('https://...')
                .setValue(settings.baseUrl)
                .onChange(async (value) => {
                    settings.baseUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Model')
            .setDesc(`Default model for ${name}`)
            .addDropdown(async (dropdown) => {
                dropdown.addOption('', 'Loading models...');
                try {
                    const provider = this.plugin.llmService.getProvider(providerId);
                    const response = await provider.fetchModels();

                    dropdown.selectEl.innerHTML = '';
                    response.models.forEach((m: LLMModel) => {
                        dropdown.addOption(m.id, m.name);
                    });
                    dropdown.setValue(settings.model);
                } catch (e) {
                    dropdown.addOption('', 'Could not load models');
                }

                dropdown.onChange(async (value) => {
                    settings.model = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}
