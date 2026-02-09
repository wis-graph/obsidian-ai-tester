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

        containerEl.createEl('hr');
        this.renderSecuritySettings(containerEl);
    }

    private async renderSecuritySettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '🔐 Security & Secrets (.env)' });
        containerEl.createEl('p', {
            text: 'You can securely store your API keys in a .env file. Keys stored here will NOT be saved to your public data.json file, making it safe to share your vault or push to Git.',
            cls: 'setting-item-description'
        });

        const envPath = `${this.plugin.manifest.dir}/.env`;
        let envContent = '';
        try {
            if (await this.app.vault.adapter.exists(envPath)) {
                envContent = await this.app.vault.adapter.read(envPath);
            }
        } catch (e) { }

        const envSetting = new Setting(containerEl)
            .setName('.env File Content')
            .setDesc('Enter your keys in KEY=VALUE format. After saving, restart the plugin to apply changes.')
            .setClass('ai-tester-env-editor');

        envSetting.addTextArea(text => {
            text.setPlaceholder('OPENAI_API_KEY=sk-...\nGEMINI_API_KEY=...')
                .setValue(envContent);
            text.inputEl.style.width = '100%';
            text.inputEl.style.height = '150px';
            text.inputEl.style.fontFamily = 'var(--font-monospace)';

            const saveBtn = containerEl.createEl('button', {
                text: 'Save .env & Apply',
                cls: 'mod-cta'
            });
            saveBtn.style.marginTop = '10px';
            saveBtn.onclick = async () => {
                try {
                    await this.app.vault.adapter.write(envPath, text.getValue());
                    new Notice('.env 파일이 저장되었습니다. 설정을 적용하기 위해 플러그인을 다시 불러옵니다.');

                    // Reload settings from .env immediately
                    await this.plugin.loadSettings();
                    this.display();
                } catch (e) {
                    new Notice('저장 실패: ' + e.message);
                }
            };
        });
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
                    if (response.models.length > 0) {
                        const group = dropdown.selectEl.createEl('optgroup', { attr: { label: '🏠 Local Models' } });
                        response.models.forEach((m: LLMModel) => {
                            group.createEl('option', { value: m.id, text: m.name });
                        });
                    }

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

        const isEnvKey = this.plugin.envKeys.has(providerId);

        new Setting(containerEl)
            .setName('API Key')
            .setDesc(isEnvKey ? `Your ${name} API key is secured via .env file.` : `Your ${name} API key`)
            .addText(text => {
                text.setPlaceholder(isEnvKey ? '🔒 Secret Locked (from .env)' : 'API Key')
                    .setValue(settings.apiKey)
                    .onChange(async (value) => {
                        if (isEnvKey) return;
                        settings.apiKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = 'password';
                if (isEnvKey) {
                    text.setDisabled(true);
                    text.inputEl.style.opacity = '0.5';
                }
                text.inputEl.addEventListener('blur', () => {
                    if (settings.apiKey) this.display();
                });
            });

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

        const modelSetting = new Setting(containerEl)
            .setName('Default Model')
            .setDesc(`Select or refresh models for ${name}`);

        modelSetting.addDropdown(async (dropdown) => {
            dropdown.addOption('', 'Loading models...');
            try {
                const provider = this.plugin.llmService.getProvider(providerId);
                const response = await provider.fetchModels();

                dropdown.selectEl.innerHTML = '';

                const recommendedModels = response.models.filter(m => m.category === 'Recommended');
                const otherModels = response.models.filter(m => m.category === 'Others' || !m.category);

                if (recommendedModels.length > 0) {
                    const group = dropdown.selectEl.createEl('optgroup', { attr: { label: '⭐ Recommended' } });
                    recommendedModels.forEach(m => {
                        group.createEl('option', { value: m.id, text: m.name });
                    });
                }

                if (otherModels.length > 0) {
                    const group = dropdown.selectEl.createEl('optgroup', { attr: { label: '📦 Others (Legacy/Experimental)' } });
                    otherModels.forEach(m => {
                        group.createEl('option', { value: m.id, text: m.id });
                    });
                }

                dropdown.setValue(settings.model);
            } catch (e) {
                dropdown.addOption('', 'Could not load models');
            }

            dropdown.onChange(async (value) => {
                settings.model = value;
                await this.plugin.saveSettings();
                this.display(); // Refresh to update custom input value
            });
        });

        modelSetting.addButton(btn => btn
            .setButtonText('Refresh Models')
            .setTooltip('Fetch latest models from API')
            .onClick(() => {
                new Notice('모델 목록을 새로고침하는 중...');
                this.display();
            }));

        new Setting(containerEl)
            .setName('Custom Model ID')
            .setDesc('Enter a specific model ID manually if not in the list')
            .addText(text => text
                .setPlaceholder('e.g. gpt-4o-2024-11-20')
                .setValue(settings.model)
                .onChange(async (value) => {
                    settings.model = value;
                    await this.plugin.saveSettings();
                }));
    }
}
