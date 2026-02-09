import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class OpenAIProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'o1', name: 'o1 (Reasoning)' },
            { id: 'o1-mini', name: 'o1-mini (Fast Reasoning)' },
            { id: 'gpt-4o', name: 'GPT-4o (Flagship)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
        ];
        super('openai', 'OpenAI', settings, ['gpt-', 'o1-'], staticModels);
    }
}
