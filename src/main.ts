import { Plugin } from 'obsidian';
import { LLMSettings, DEFAULT_SETTINGS } from './types';
import { LLMService } from './services/LLMService';
import { BlockManager } from './logic/BlockManager';
import { OllamaBlockView } from './ui/OllamaBlockView';
import { LLMSettingTab } from './settings/SettingsTab';

export default class AITesterPlugin extends Plugin {
	settings: LLMSettings = DEFAULT_SETTINGS;
	llmService: LLMService;
	blockManager: BlockManager;
	envKeys: Set<string> = new Set();

	async onload() {
		console.log('AI Tester plugin loading...');

		await this.loadSettings();

		this.llmService = new LLMService(this.settings);
		this.blockManager = new BlockManager(this.app);

		this.addSettingTab(new LLMSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('ai-tester', (source, el, ctx) => {
			const blockSettings = this.blockManager.parseBlock(source);
			const view = new OllamaBlockView(el, this.llmService, this.blockManager, ctx, blockSettings);
			view.render();
		});
	}

	async onunload() {
		console.log('AI Tester plugin unloaded');
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

		if (loadedData) {
			Object.assign(this.settings, loadedData);
			const providers: (keyof LLMSettings)[] = ['ollama', 'openai', 'gemini', 'grok', 'glm', 'kimi'];
			providers.forEach(p => {
				if (loadedData[p]) {
					this.settings[p] = Object.assign({}, (DEFAULT_SETTINGS as any)[p], loadedData[p]);
				}
			});
		}

		this.envKeys.clear();

		// Support for .env file to hide API keys from data.json
		try {
			const envPath = `${this.manifest.dir}/.env`;
			if (await this.app.vault.adapter.exists(envPath)) {
				const envContent = await this.app.vault.adapter.read(envPath);
				const envLines = envContent.split('\n');

				envLines.forEach(line => {
					const [key, value] = line.split('=').map(s => s.trim());
					if (!key || !value) return;

					// Map environment variables to settings
					switch (key.toUpperCase()) {
						case 'OPENAI_API_KEY':
							this.settings.openai.apiKey = value;
							this.envKeys.add('openai');
							break;
						case 'GEMINI_API_KEY':
							this.settings.gemini.apiKey = value;
							this.envKeys.add('gemini');
							break;
						case 'GROK_API_KEY':
							this.settings.grok.apiKey = value;
							this.envKeys.add('grok');
							break;
						case 'GLM_API_KEY':
							this.settings.glm.apiKey = value;
							this.envKeys.add('glm');
							break;
						case 'KIMI_API_KEY':
							this.settings.kimi.apiKey = value;
							this.envKeys.add('kimi');
							break;
					}
				});
				console.log('API Keys loaded from .env file successfully.');
			}
		} catch (e) {
			console.error('Failed to load .env file:', e);
		}

		// Migration: Move top-level model/serverUrl if they exist
		if (loadedData && (loadedData.model || loadedData.serverUrl)) {
			if (loadedData.model && !loadedData.ollama?.model) {
				this.settings.ollama.model = loadedData.model;
			}
			if (loadedData.serverUrl && !loadedData.ollama?.serverUrl) {
				this.settings.ollama.serverUrl = loadedData.serverUrl;
			}

			// Clean up top level and save immediately
			await this.saveSettings();
		}
	}

	async saveSettings() {
		// Deep copy to avoid modifying runtime settings
		const sanitizedSettings: any = JSON.parse(JSON.stringify(this.settings));

		// ABSOLUTE SECURITY: Completely remove all apiKey fields from the object before saving to data.json
		const targetProviders: (keyof LLMSettings)[] = ['openai', 'gemini', 'grok', 'glm', 'kimi'];
		targetProviders.forEach(p => {
			if (sanitizedSettings[p]) {
				delete sanitizedSettings[p].apiKey;
			}
		});

		await this.saveData(sanitizedSettings);
		this.llmService.updateSettings(this.settings);
	}
}

