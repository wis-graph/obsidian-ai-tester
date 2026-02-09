import { Notice, requestUrl } from 'obsidian';
import { LLMProvider } from './LLMProvider';
import { LLMListResponse, LLMGenerateResponse, LLMBlockConfig, GenericLLMSettings, LLMModel } from '../../types';

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
            new Notice(`${this.name}: API Key가 없습니다. 기본 모델 목록만 표시합니다.`);
            return { models: this.staticModels.map(m => ({ ...m, category: 'Recommended' })) };
        }

        new Notice(`${this.name}: 모델 목록을 가져오는 중...`);
        try {
            const response = await requestUrl({
                url: `${this.settings.baseUrl}/models`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status !== 200) {
                let errorMsg = `API 오류 (${response.status})`;
                if (response.status === 401) errorMsg = 'API Key가 올바르지 않습니다.';
                if (response.status === 404) errorMsg = '모델 엔드포인트를 찾을 수 없습니다.';
                throw new Error(errorMsg);
            }

            const data = response.json;
            const apiModels = data.data || data || [];

            // Map all models from API
            const mappedApiModels: LLMModel[] = (Array.isArray(apiModels) ? apiModels : []).map((m: any) => {
                const modelId = m.id || m.name || (typeof m === 'string' ? m : '');
                if (!modelId) return null;

                const isRecommended = this.staticModels.some(sm => sm.id === modelId);

                return {
                    id: modelId,
                    name: modelId,
                    category: isRecommended ? 'Recommended' : 'Others'
                };
            }).filter(m => m !== null) as LLMModel[];

            // Merge logic
            const allModelsMap = new Map<string, LLMModel>();

            // 1. Add static models as Recommended
            this.staticModels.forEach(m => {
                allModelsMap.set(m.id, { ...m, category: 'Recommended' });
            });

            // 2. Add/Overwrite with API models
            mappedApiModels.forEach(apiModel => {
                if (!allModelsMap.has(apiModel.id)) {
                    allModelsMap.set(apiModel.id, apiModel);
                } else {
                    // If already exists but API says it's Recommended, upgrade it
                    if (apiModel.category === 'Recommended') {
                        const existing = allModelsMap.get(apiModel.id);
                        if (existing) existing.category = 'Recommended';
                    }
                }
            });

            const finalModels = Array.from(allModelsMap.values());
            new Notice(`${this.name}: ${mappedApiModels.length}개의 모델을 동기화했습니다.`);
            return { models: finalModels };
        } catch (error) {
            console.error(`Error fetching models from ${this.name}:`, error);
            new Notice(`${this.name} 오류: ${error.message}. 기본 목록을 사용합니다.`);
            return { models: this.staticModels.map(m => ({ ...m, category: 'Recommended' })) };
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

        // CRITICAL FIX: Use the exact model entered/selected in the UI.
        let targetModel = model || config.model || this.settings.model;

        const requestBody: any = {
            model: targetModel,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            top_p: config.top_p
        };

        // Only include these optional parameters if they have been explicitly changed from the default (0/empty)
        // This ensures that removing them from YAML actually removes them from the JSON payload.
        if (config.stop_sequences && config.stop_sequences.length > 0) {
            requestBody.stop = config.stop_sequences;
        }

        if (config.frequency_penalty !== undefined && config.frequency_penalty !== 0) {
            requestBody.frequency_penalty = config.frequency_penalty;
        }

        if (config.presence_penalty !== undefined && config.presence_penalty !== 0) {
            requestBody.presence_penalty = config.presence_penalty;
        }

        // Transparency & Warning for Gemini
        if (this.id === 'gemini') {
            const unsupported = [];
            if (requestBody.frequency_penalty !== undefined) unsupported.push('frequency_penalty');
            if (requestBody.presence_penalty !== undefined) unsupported.push('presence_penalty');

            if (unsupported.length > 0) {
                new Notice(`⚠️ Gemini Warning: ${unsupported.join(', ')} 속성은 Gemini에서 지원되지 않아 400 에러가 발생할 수 있습니다.`, 5000);
            }
        }

        try {
            const baseUrl = this.settings.baseUrl.replace(/\/+$/, '');
            const url = `${baseUrl}/chat/completions`;

            const headers: any = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            };

            // Chinese providers or others might prefer an additional api-key header
            if (this.id === 'glm' || this.id === 'kimi') {
                headers['api-key'] = this.settings.apiKey;
            }

            console.log(`[${this.name}] FINAL REQUEST: ${targetModel} at ${url}`);
            console.log(`[${this.name}] Sending Body:`, JSON.stringify(requestBody));

            let response: Response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestBody),
                    signal: abortController.signal
                });
            } catch (fetchError) {
                // If fetch fails (CORS, network), fallback to non-streaming requestUrl
                console.warn(`[${this.name}] Streaming fetch failed. Falling back to non-streaming requestUrl.`, fetchError);
                await this.fallbackNonStreaming(prompt, model, config, onChunk, onDone);
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`[${this.name}] Server Error Payload:`, errorData);

                // Extract the most descriptive error message possible
                const message = errorData.error?.message ||
                    (typeof errorData === 'object' ? JSON.stringify(errorData) : null) ||
                    response.statusText ||
                    `HTTP ${response.status}`;
                throw new Error(message);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                console.warn(`[${this.name}] ReadableStream not supported. Falling back to non-streaming.`);
                await this.fallbackNonStreaming(prompt, model, config, onChunk, onDone);
                return;
            }

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
                    if (!trimmedLine) continue;

                    if (trimmedLine.startsWith('data:')) {
                        const jsonStr = trimmedLine.replace(/^data:\s*/, '');
                        if (jsonStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(jsonStr);
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) onChunk(content);

                            if (data.choices?.[0]?.finish_reason) {
                                onDone({
                                    response: '',
                                    done: true,
                                    model: data.model || model,
                                    total_duration: (Date.now() - startTime) * 1e6
                                });
                            }
                        } catch (e) {
                            console.warn(`[${this.name}] Skip chunk:`, trimmedLine);
                        }
                    }
                }
            }
        } catch (error) {
            const errorMsg = error.message || 'Unknown stream error';
            if (error.name === 'AbortError') {
                console.log(`[${this.name}] Request aborted`);
            } else {
                console.error(`[${this.name}] Generation failed:`, error);
                new Notice(`${this.name} 생성 실패: ${errorMsg}`);
                throw error;
            }
        }
    }

    private async fallbackNonStreaming(
        prompt: string,
        model: string,
        config: LLMBlockConfig,
        onChunk: (chunk: string) => void,
        onDone: (finalData: LLMGenerateResponse) => void
    ): Promise<void> {
        const startTime = Date.now();

        let targetModel = model || this.settings.model;
        if (this.id === 'gemini') {
            targetModel = targetModel.replace(/^models\//, '');
        }

        const requestBody: any = {
            model: targetModel,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
        };

        if (config.temperature !== undefined && config.temperature !== 0.7) requestBody.temperature = config.temperature;
        if (config.max_tokens !== undefined && config.max_tokens > 0) requestBody.max_tokens = config.max_tokens;
        if (config.top_p !== undefined && config.top_p !== 1.0 && config.top_p !== 0) requestBody.top_p = config.top_p;
        if (config.stop_sequences && config.stop_sequences.length > 0) requestBody.stop = config.stop_sequences;
        if (config.frequency_penalty !== undefined && config.frequency_penalty !== 0) requestBody.frequency_penalty = config.frequency_penalty;
        if (config.presence_penalty !== undefined && config.presence_penalty !== 0) requestBody.presence_penalty = config.presence_penalty;

        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.settings.apiKey}`
        };

        const baseUrl = this.settings.baseUrl.replace(/\/+$/, '');
        const url = `${baseUrl}/chat/completions`;

        if (this.id === 'glm' || this.id === 'kimi') {
            headers['api-key'] = this.settings.apiKey;
        }

        console.log(`[${this.name}] Fallback Requesting: ${targetModel} at ${url}`);
        console.log(`[${this.name}] Fallback Body:`, JSON.stringify(requestBody));

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (response.status !== 200) {
                throw new Error(`Fallback failed: HTTP ${response.status}`);
            }

            const data = response.json;
            const content = data.choices?.[0]?.message?.content || '';
            if (content) onChunk(content);

            onDone({
                response: content,
                done: true,
                model: data.model || model,
                prompt_eval_count: data.usage?.prompt_tokens,
                eval_count: data.usage?.completion_tokens,
                total_duration: (Date.now() - startTime) * 1e6
            });
        } catch (e) {
            console.error(`[${this.name}] Fallback failed:`, e);
            throw e;
        }
    }
}
