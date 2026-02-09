import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class GrokProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'grok-2-1212', name: 'Grok-2' },
            { id: 'grok-2-mini', name: 'Grok-2 Mini' },
            { id: 'grok-beta', name: 'Grok Beta' }
        ];
        super('grok', 'Grok', settings, ['grok-'], staticModels);
    }
}
