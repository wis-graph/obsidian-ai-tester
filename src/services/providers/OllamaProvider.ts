import { requestUrl } from 'obsidian';
import { LLMProvider } from './LLMProvider';
import { LLMListResponse, LLMGenerateResponse, LLMBlockConfig, OllamaSettings, OllamaListResponse } from '../../types';

export class OllamaProvider implements LLMProvider {
    id = 'ollama';
    name = 'Ollama';
    private settings: OllamaSettings;

    constructor(settings: OllamaSettings) {
        this.settings = settings;
    }

    async fetchModels(): Promise<LLMListResponse> {
        try {
            const response = await requestUrl({
                url: `${this.settings.serverUrl}/api/tags`,
                method: 'GET'
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const ollamaRes = response.json as OllamaListResponse;
            return {
                models: ollamaRes.models.map(m => ({
                    id: m.name,
                    name: m.name
                }))
            };
        } catch (error) {
            console.error('Error fetching models from Ollama:', error);
            throw error;
        }
    }

    async streamResponse(
        prompt: string,
        model: string,
        config: LLMBlockConfig,
        abortController: AbortController,
        onChunk: (chunk: string) => void,
        onDone: (finalData: LLMGenerateResponse) => void
    ): Promise<void> {
        const requestBody: any = {
            model,
            prompt,
            stream: true,
            options: {
                temperature: config.temperature,
                num_predict: config.max_tokens,
                stop: config.stop_sequences,
                top_p: config.top_p,
                frequency_penalty: config.frequency_penalty,
                presence_penalty: config.presence_penalty
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
                    const data = JSON.parse(line);
                    if (data.response) onChunk(data.response);
                    if (data.done) {
                        onDone({
                            response: data.response,
                            done: true,
                            model: data.model,
                            total_duration: data.total_duration,
                            prompt_eval_count: data.prompt_eval_count,
                            eval_count: data.eval_count
                        });
                    }
                } catch (e) {
                    console.error('Error parsing JSON line:', line, e);
                }
            }
        }
    }
}
