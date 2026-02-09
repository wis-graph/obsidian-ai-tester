import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class GeminiProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
            { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemma-3-27b-it', name: 'Gemma 3 27B IT' },
            { id: 'gemma-3-12b-it', name: 'Gemma 3 12B IT' },
            { id: 'gemma-3-4b-it', name: 'Gemma 3 4B IT' }
        ];
        super('gemini', 'Gemini', settings, ['gemini-', 'gemma-'], staticModels);
    }
}
