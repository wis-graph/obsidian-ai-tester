import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { GenericLLMSettings } from '../../types';

export class GLMProvider extends OpenAICompatibleProvider {
    constructor(settings: GenericLLMSettings) {
        const staticModels = [
            { id: 'glm-5', name: 'GLM-5 (Next Gen Flagship)' },
            { id: 'glm-4.7', name: 'GLM-4.7 (MoE Flagship)' },
            { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash' },
            { id: 'glm-4.5', name: 'GLM-4.5' },
            { id: 'glm-4-air', name: 'GLM-4 Air' }
        ];
        super('glm', 'GLM', settings, ['glm-'], staticModels);
    }
}
