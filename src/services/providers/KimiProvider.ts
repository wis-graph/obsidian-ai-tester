import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class KimiProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'kimi-k2.5', name: 'Kimi K2.5 (Multimodal Agent)' },
            { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking' },
            { id: 'kimi-k2-turbo-preview', name: 'Kimi K2 Turbo' },
            { id: 'moonshot-v1-128k', name: 'Moonshot V1 128k' },
            { id: 'moonshot-v1-32k', name: 'Moonshot V1 32k' },
            { id: 'moonshot-v1-8k', name: 'Moonshot V1 8k' }
        ];
        super('kimi', 'Kimi', settings, ['moonshot-', 'kimi-'], staticModels);
    }
}
