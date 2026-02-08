import { LLMListResponse, LLMGenerateResponse, LLMBlockConfig } from '../../types';

export interface LLMProvider {
    id: string;
    name: string;

    fetchModels(): Promise<LLMListResponse>;
    streamResponse(
        prompt: string,
        model: string,
        config: LLMBlockConfig,
        abortController: AbortController,
        onChunk: (chunk: string) => void,
        onDone: (finalData: LLMGenerateResponse) => void
    ): Promise<void>;
}
