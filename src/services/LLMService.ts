import { LLMSettings, ProviderType } from '../types';
import { LLMProvider } from './providers/LLMProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

export class LLMService {
    private providers: Map<string, LLMProvider> = new Map();
    private settings: LLMSettings;

    constructor(settings: LLMSettings) {
        this.settings = settings;
        this.initializeProviders();
    }

    private initializeProviders() {
        const ollama = new OllamaProvider(this.settings.ollama);
        const openai = new OpenAIProvider(this.settings.openai);

        this.providers.set(ollama.id, ollama);
        this.providers.set(openai.id, openai);
    }

    getProvider(id: string): LLMProvider {
        const provider = this.providers.get(id);
        if (!provider) throw new Error(`Provider ${id} not found`);
        return provider;
    }

    getEnabledProviders(): LLMProvider[] {
        // For now, return all since we don't have a "toggle" yet, 
        // but typically you'd filter by user choice.
        return Array.from(this.providers.values());
    }

    getSettings(): LLMSettings {
        return this.settings;
    }

    updateSettings(settings: LLMSettings) {
        this.settings = settings;
        this.initializeProviders();
    }
}
