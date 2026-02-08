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
                    .addOption('openai', 'OpenAI (Cloud)')
                    .setValue(this.plugin.settings.activeProvider)
                    .onChange(async (value: ProviderType) => {
                        this.plugin.settings.activeProvider = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show relevant settings
                    });
            });

        if (this.plugin.settings.activeProvider === 'ollama') {
            this.renderOllamaSettings(containerEl);
        } else if (this.plugin.settings.activeProvider === 'openai') {
            this.renderOpenAISettings(containerEl);
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

    private renderOpenAISettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'OpenAI Settings' });

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Your OpenAI API key')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.openai.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.openai.apiKey = value;
                    await this.plugin.saveSettings();
                })
                .inputEl.type = 'password');

        new Setting(containerEl)
            .setName('Base URL')
            .setDesc('Custom endpoint (optional)')
            .addText(text => text
                .setPlaceholder('https://api.openai.com/v1')
                .setValue(this.plugin.settings.openai.baseUrl)
                .onChange(async (value) => {
                    this.plugin.settings.openai.baseUrl = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Default model for OpenAI')
            .addDropdown(async (dropdown) => {
                const provider = this.plugin.llmService.getProvider('openai');
                const response = await provider.fetchModels();
                response.models.forEach((m: LLMModel) => {
                    dropdown.addOption(m.id, m.name);
                });
                dropdown.setValue(this.plugin.settings.openai.model);

                dropdown.onChange(async (value) => {
                    this.plugin.settings.openai.model = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}
