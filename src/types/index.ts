export interface OllamaSettings {
	model: string;
	serverUrl: string;
}

export const DEFAULT_SETTINGS: OllamaSettings = {
	model: 'llama2',
	serverUrl: 'http://localhost:11434'
};

export interface OllamaModelDetails {
	parent_model: string;
	format: string;
	family: string;
	families: string[];
	parameter_size: string;
	quantization_level: string;
}

export interface OllamaModel {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details: OllamaModelDetails;
}

export interface OllamaListResponse {
	models: OllamaModel[];
}

export interface OllamaGenerateResponse {
	model: string;
	created_at: string;
	response: string;
	done: boolean;
	context: number[];
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	prompt_eval_duration?: number;
	eval_count?: number;
	eval_duration?: number;
}

export interface OllamaBlockConfig {
	model?: string;
	temperature?: number;
	max_tokens?: number;
	stop_sequences?: string[];
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	num_responses?: number;
}

export interface OllamaBlockSettings {
	yamlConfig: OllamaBlockConfig;
	prompt: string;
	hasYaml: boolean;
}

export const DEFAULT_BLOCK_CONFIG: OllamaBlockConfig = {
	model: '',
	temperature: 0.7,
	max_tokens: 4096,
	stop_sequences: [],
	top_p: 0.9,
	frequency_penalty: 0.0,
	presence_penalty: 0.0,
	num_responses: 1
};
