import { LLMProvider } from './LLMProvider';
import { LLMListResponse, LLMGenerateResponse, LLMBlockConfig, GenericLLMSettings } from '../../types';

export class OpenAICompatibleProvider implements LLMProvider {
    id: string;
    name: string;
    protected settings: GenericLLMSettings;
    protected staticModels: { id: string, name: string }[];
    protected modelPrefixes: string[];

    constructor(id: string, name: string, settings: GenericLLMSettings, modelPrefixes: string[] = [], staticModels: { id: string, name: string }[] = []) {
        this.id = id;
        this.name = name;
        this.settings = settings;
        this.modelPrefixes = modelPrefixes;
        this.staticModels = staticModels;
    }

    async fetchModels(): Promise<LLMListResponse> {
        if (!this.settings.apiKey) {
            return { models: this.staticModels };
        }

        try {
            const response = await fetch(`${this.settings.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();
            let apiModels = data.data || [];

            if (this.modelPrefixes.length > 0) {
                apiModels = apiModels.filter((m: any) =>
                    this.modelPrefixes.some((prefix: string) => m.id.toLowerCase().startsWith(prefix.toLowerCase()))
                );
            }

            const mappedApiModels = apiModels.map((m: any) => ({
                id: m.id,
                name: m.id
            }));

            // Merge API models with static models, ensuring no duplicates
            const allModels = [...this.staticModels];
            mappedApiModels.forEach((apiModel: { id: string, name: string }) => {
                if (!allModels.find(m => m.id === apiModel.id)) {
                    allModels.push(apiModel);
                }
            });

            return { models: allModels };
        } catch (error) {
            console.error(`Error fetching models from ${this.name}:`, error);
            // Fallback to static models on error
            return { models: this.staticModels };
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
        const startTime = Date.now();
        const requestBody = {
            model: model || this.settings.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            stream_options: { include_usage: true },
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            stop: config.stop_sequences,
            top_p: config.top_p,
            frequency_penalty: config.frequency_penalty,
            presence_penalty: config.presence_penalty
        };

        const response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`${this.name} API error: ${err.error?.message || response.statusText}`);
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
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                if (trimmedLine.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(trimmedLine.slice(6));

                        if (data.usage) {
                            onDone({
                                response: '',
                                done: true,
                                model: model,
                                prompt_eval_count: data.usage.prompt_tokens,
                                eval_count: data.usage.completion_tokens,
                                total_duration: (Date.now() - startTime) * 1e6
                            });
                            continue;
                        }

                        const content = data.choices[0]?.delta?.content;
                        if (content) onChunk(content);

                        if (data.choices[0]?.finish_reason && !data.usage) {
                            onDone({
                                response: '',
                                done: true,
                                model: data.model || model,
                                total_duration: (Date.now() - startTime) * 1e6
                            });
                        }
                    } catch (e) {
                        console.error(`Error parsing ${this.name} stream chunk:`, trimmedLine, e);
                    }
                }
            }
        }
    }
}
