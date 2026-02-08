import { LLMProvider } from './LLMProvider';
import { LLMListResponse, LLMGenerateResponse, LLMBlockConfig, OpenAISettings } from '../../types';

export class OpenAIProvider implements LLMProvider {
    id = 'openai';
    name = 'OpenAI';
    private settings: OpenAISettings;

    constructor(settings: OpenAISettings) {
        this.settings = settings;
    }

    async fetchModels(): Promise<LLMListResponse> {
        if (!this.settings.apiKey) {
            // Return some common models if API key is missing to avoid empty UI
            return {
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
                ]
            };
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
            return {
                models: data.data
                    .filter((m: any) => m.id.startsWith('gpt-'))
                    .map((m: any) => ({
                        id: m.id,
                        name: m.id
                    }))
            };
        } catch (error) {
            console.error('Error fetching models from OpenAI:', error);
            return { models: [{ id: 'gpt-4o', name: 'GPT-4o' }] };
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
            throw new Error(`OpenAI API error: ${err.error?.message || response.statusText}`);
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

                        // Handle usage chunk
                        if (data.usage) {
                            onDone({
                                response: '',
                                done: true,
                                model: model,
                                prompt_eval_count: data.usage.prompt_tokens,
                                eval_count: data.usage.completion_tokens,
                                total_duration: (Date.now() - startTime) * 1e6 // Convert to ns to match Ollama
                            });
                            continue;
                        }

                        const content = data.choices[0]?.delta?.content;
                        if (content) onChunk(content);

                        // finish_reason might come before usage
                        if (data.choices[0]?.finish_reason && !data.usage) {
                            onDone({
                                response: '',
                                done: true,
                                model: data.model || model,
                                total_duration: (Date.now() - startTime) * 1e6
                            });
                        }
                    } catch (e) {
                        console.error('Error parsing OpenAI stream chunk:', trimmedLine, e);
                    }
                }
            }
        }
    }
}
