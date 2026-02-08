import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class OpenAIProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'gpt-5.2', name: 'GPT-5.2 (Latest Flagship)' },
            { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro (High Intelligence)' },
            { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
            { id: 'o3', name: 'o3 (Advanced Reasoning)' },
            { id: 'o4-mini', name: 'o4-mini (Fast Reasoning)' },
            { id: 'gpt-4o', name: 'GPT-4o (Stable)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
        ];
        super('openai', 'OpenAI', settings, ['gpt-', 'o1-', 'o3-', 'o4-', 'o5-'], staticModels);
    }
}
