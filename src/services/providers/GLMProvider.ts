import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class GLMProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'glm-4-plus', name: 'GLM-4 Plus' },
            { id: 'glm-4-0520', name: 'GLM-4 (0520)' },
            { id: 'glm-4-air', name: 'GLM-4 Air' },
            { id: 'glm-4-flash', name: 'GLM-4 Flash' }
        ];
        super('glm', 'GLM', settings, ['glm-'], staticModels);
    }
}
