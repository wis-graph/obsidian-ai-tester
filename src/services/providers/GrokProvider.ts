import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class GrokProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'grok-4', name: 'Grok-4 (Flagship Reasoning)' },
            { id: 'grok-4-fast-reasoning', name: 'Grok-4 Fast Reasoning' },
            { id: 'grok-3', name: 'Grok-3' },
            { id: 'grok-2', name: 'Grok-2' },
            { id: 'grok-2-mini', name: 'Grok-2 Mini' }
        ];
        super('grok', 'Grok', settings, ['grok-'], staticModels);
    }
}
