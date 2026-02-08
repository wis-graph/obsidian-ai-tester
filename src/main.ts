import { Plugin } from 'obsidian';
import { OllamaSettings, DEFAULT_SETTINGS } from './types';
import { OllamaServiceImpl, OllamaService } from './services/OllamaService';
import { BlockManager } from './logic/BlockManager';
import { OllamaBlockView } from './ui/OllamaBlockView';
import { OllamaSettingTab } from './settings/SettingsTab';

export default class ObsidianOllamaTestPlugin extends Plugin {
	settings: OllamaSettings = DEFAULT_SETTINGS;
	ollamaService: OllamaService;
	blockManager: BlockManager;

	async onload() {
		console.log('Obsidian Ollama Test plugin loading (Modular)...');

		await this.loadSettings();

		this.ollamaService = new OllamaServiceImpl(this.settings);
		this.blockManager = new BlockManager(this.app);

		this.addSettingTab(new OllamaSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('ollama', (source, el, ctx) => {
			const blockSettings = this.blockManager.parseBlock(source);
			const view = new OllamaBlockView(el, this.ollamaService, this.blockManager, ctx, blockSettings);
			view.render();
		});
	}

	async onunload() {
		console.log('Obsidian Ollama Test plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
