import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class GeminiProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'gemini-3-pro', name: 'Gemini 3 Pro (New Flagship)' },
            { id: 'gemini-3-flash', name: 'Gemini 3 Flash (Fast & Capable)' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
        ];
        super('gemini', 'Gemini', settings, ['gemini-'], staticModels);
    }
}
