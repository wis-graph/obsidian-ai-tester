import { requestUrl } from 'obsidian';
import { OllamaSettings, OllamaListResponse, OllamaGenerateResponse, OllamaBlockSettings } from '../types';

export interface OllamaService {
    fetchModels(): Promise<OllamaListResponse>;
    clearCache(): void;
    getSettings(): OllamaSettings;
    streamOllamaResponse(
        prompt: string,
        model: string,
        yamlConfig: OllamaBlockSettings['yamlConfig'],
        abortController: AbortController,
        onChunk: (chunk: string) => void,
        onDone: (finalData: OllamaGenerateResponse) => void
    ): Promise<void>;
}

export class OllamaServiceImpl implements OllamaService {
    private settings: OllamaSettings;
    private modelsCache: OllamaListResponse | null = null;

    constructor(settings: OllamaSettings) {
        this.settings = settings;
    }

    async fetchModels(): Promise<OllamaListResponse> {
        if (this.modelsCache) return this.modelsCache;

        try {
            const response = await requestUrl({
                url: `${this.settings.serverUrl}/api/tags`,
                method: 'GET'
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            this.modelsCache = response.json as OllamaListResponse;
            return this.modelsCache;
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }

    clearCache() {
        this.modelsCache = null;
    }

    getSettings(): OllamaSettings {
        return this.settings;
    }

    async streamOllamaResponse(
        prompt: string,
        model: string,
        yamlConfig: OllamaBlockSettings['yamlConfig'],
        abortController: AbortController,
        onChunk: (chunk: string) => void,
        onDone: (finalData: OllamaGenerateResponse) => void
    ): Promise<void> {
        const requestBody: any = {
            model,
            prompt,
            stream: true,
            options: {
                temperature: yamlConfig.temperature,
                num_predict: yamlConfig.max_tokens,
                stop: yamlConfig.stop_sequences,
                top_p: yamlConfig.top_p,
                frequency_penalty: yamlConfig.frequency_penalty,
                presence_penalty: yamlConfig.presence_penalty
            }
        };

        // Clean up undefined options
        Object.keys(requestBody.options).forEach(key =>
            requestBody.options[key] === undefined && delete requestBody.options[key]
        );

        const response = await fetch(`${this.settings.serverUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to read response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() === '') continue;
                try {
                    const data = JSON.parse(line) as OllamaGenerateResponse;
                    if (data.response) onChunk(data.response);
                    if (data.done) onDone(data);
                } catch (e) {
                    console.error('Error parsing JSON line:', line, e);
                }
            }
        }
    }
}
