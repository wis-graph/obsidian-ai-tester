import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type ObsidianOllamaTestPlugin from '../main';

export class OllamaSettingTab extends PluginSettingTab {
    plugin: ObsidianOllamaTestPlugin;

    constructor(app: App, plugin: ObsidianOllamaTestPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Ollama Model')
            .setDesc('Select model to use for generation')
            .addDropdown(async (dropdown) => {
                dropdown.addOption('', 'Loading models...');

                try {
                    const response = await this.plugin.ollamaService.fetchModels();
                    const selectEl = dropdown.selectEl;

                    while (selectEl.options.length > 0) {
                        selectEl.remove(0);
                    }

                    if (response.models.length === 0) {
                        dropdown.addOption('', 'No models found');
                    } else {
                        response.models.forEach(model => {
                            dropdown.addOption(model.name, `${model.name} (${model.details.parameter_size}, ${model.details.quantization_level})`);
                        });
                    }

                    dropdown.setValue(this.plugin.settings.model);
                } catch (error) {
                    console.error(error);
                    dropdown.setValue(this.plugin.settings.model);
                    new Notice('Failed to fetch models from Ollama server');
                }

                dropdown.onChange(async (value) => {
                    if (!value) return;
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Server URL')
            .setDesc('The URL of your Ollama server')
            .addText(text => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.serverUrl)
                .onChange(async (value) => {
                    this.plugin.settings.serverUrl = value;
                    this.plugin.ollamaService.clearCache();
                    await this.plugin.saveSettings();
                }));
    }
}
