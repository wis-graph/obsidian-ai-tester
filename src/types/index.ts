export type ProviderType = 'ollama' | 'openai' | 'gemini' | 'grok' | 'glm' | 'kimi';

export interface OllamaSettings {
	serverUrl: string;
	model: string;
}

export interface GenericLLMSettings {
	apiKey: string;
	baseUrl: string;
	model: string;
}

export interface LLMSettings {
	activeProvider: ProviderType;
	ollama: OllamaSettings;
	openai: GenericLLMSettings;
	gemini: GenericLLMSettings;
	grok: GenericLLMSettings;
	glm: GenericLLMSettings;
	kimi: GenericLLMSettings;
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
	},
	gemini: {
		apiKey: '',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
		model: 'gemini-1.5-flash'
	},
	grok: {
		apiKey: '',
		baseUrl: 'https://api.x.ai/v1',
		model: 'grok-beta'
	},
	glm: {
		apiKey: '',
		baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
		model: 'glm-4-flash'
	},
	kimi: {
		apiKey: '',
		baseUrl: 'https://api.moonshot.cn/v1',
		model: 'moonshot-v1-8k'
	}
};

export interface LLMModel {
	id: string;
	name: string;
	category?: 'Recommended' | 'Others';
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

