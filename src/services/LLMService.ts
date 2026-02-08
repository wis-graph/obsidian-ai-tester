import { LLMSettings, ProviderType } from '../types';
import { LLMProvider } from './providers/LLMProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { GrokProvider } from './providers/GrokProvider';
import { GLMProvider } from './providers/GLMProvider';
import { KimiProvider } from './providers/KimiProvider';

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
        const gemini = new GeminiProvider(this.settings.gemini);
        const grok = new GrokProvider(this.settings.grok);
        const glm = new GLMProvider(this.settings.glm);
        const kimi = new KimiProvider(this.settings.kimi);

        this.providers.set(ollama.id, ollama);
        this.providers.set(openai.id, openai);
        this.providers.set(gemini.id, gemini);
        this.providers.set(grok.id, grok);
        this.providers.set(glm.id, glm);
        this.providers.set(kimi.id, kimi);
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
