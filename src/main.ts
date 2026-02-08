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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

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
		// Only save keys that are in DEFAULT_SETTINGS
		const sanitizedSettings: any = {};
		const validKeys = Object.keys(DEFAULT_SETTINGS) as (keyof LLMSettings)[];

		validKeys.forEach(key => {
			sanitizedSettings[key] = this.settings[key];
		});

		await this.saveData(sanitizedSettings);
		this.llmService.updateSettings(this.settings);
	}
}

