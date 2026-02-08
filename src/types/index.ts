export type ProviderType = 'ollama' | 'openai';

export interface OllamaSettings {
	serverUrl: string;
	model: string;
}

export interface OpenAISettings {
	apiKey: string;
	baseUrl: string;
	model: string;
}

export interface LLMSettings {
	activeProvider: ProviderType;
	ollama: OllamaSettings;
	openai: OpenAISettings;
}

export const DEFAULT_SETTINGS: LLMSettings = {
	activeProvider: 'ollama',
	ollama: {
		serverUrl: 'http://localhost:11434',
		model: 'llama3'
	},
	openai: {
		apiKey: '',
		baseUrl: 'https://api.openai.com/v1',
		model: 'gpt-4o'
	}
};

export interface LLMModel {
	id: string;
	name: string;
}

export interface LLMListResponse {
	models: LLMModel[];
}

export interface LLMGenerateResponse {
	response: string;
	done: boolean;
	model: string;
	total_duration?: number;
	prompt_eval_count?: number;
	eval_count?: number;
}

export interface LLMBlockConfig {
	provider?: ProviderType;
	model?: string;
	temperature?: number;
	max_tokens?: number;
	stop_sequences?: string[];
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	num_responses?: number;
}

export interface LLMBlockSettings {
	yamlConfig: LLMBlockConfig;
	prompt: string;
	hasYaml: boolean;
}

export const DEFAULT_BLOCK_CONFIG: LLMBlockConfig = {
	provider: 'ollama',
	model: '',
	temperature: 0.7,
	max_tokens: 4096,
	stop_sequences: [],
	top_p: 0.9,
	frequency_penalty: 0.0,
	presence_penalty: 0.0,
	num_responses: 1
};

// Legacy Ollama types for internal use in OllamaProvider if needed
export interface OllamaModel {
	name: string;
	model: string;
	details: {
		family: string;
		parameter_size: string;
	};
}

export interface OllamaListResponse {
	models: OllamaModel[];
}

