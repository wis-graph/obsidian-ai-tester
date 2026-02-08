import { App, Notice, MarkdownView, MarkdownPostProcessorContext, parseYaml } from 'obsidian';
import { LLMBlockSettings, DEFAULT_BLOCK_CONFIG } from '../types';

export class BlockManager {
    private app: App;
    // Track focus state across re-renders
    public sessionFocus: {
        lineStart: number | null,
        ch: number | null,
        file: string | null
    } = { lineStart: null, ch: null, file: null };

    constructor(app: App) {
        this.app = app;
    }

    parseBlock(source: string): LLMBlockSettings {
        const trimmedSource = source.trim();
        // More robust regex to match YAML even if the prompt is empty or just whitespace
        const yamlMatch = trimmedSource.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*)|$)/);

        let config: LLMBlockSettings = {
            yamlConfig: { ...DEFAULT_BLOCK_CONFIG },
            prompt: trimmedSource,
            hasYaml: false
        };

        if (yamlMatch) {
            config.hasYaml = true;
            try {
                const parsedYaml = parseYaml(yamlMatch[1]);
                config.yamlConfig = { ...DEFAULT_BLOCK_CONFIG, ...parsedYaml };
                config.prompt = (yamlMatch[2] || '').trim();
            } catch (error) {
                console.error('Error parsing YAML:', error);
                // If parsing fails, we treat the whole thing as prompt
                config.hasYaml = false;
            }
        }

        return config;
    }

    validateConfig(config: any): string[] {
        const errors: string[] = [];
        const ranges = {
            temperature: [0, 2],
            max_tokens: [1, 20000],
            top_p: [0, 1],
            frequency_penalty: [0, 2],
            presence_penalty: [0, 2],
            num_responses: [1, 20]
        };

        for (const [key, range] of Object.entries(ranges)) {
            if (config[key] !== undefined && (config[key] < range[0] || config[key] > range[1])) {
                errors.push(`${key} must be between ${range[0]} and ${range[1]}`);
            }
        }

        return errors;
    }

    async updateFileBlock(el: HTMLElement, ctx: MarkdownPostProcessorContext, newPrompt: string, newYaml: string): Promise<void> {
        const sectionInfo = ctx.getSectionInfo(el);
        if (!sectionInfo) throw new Error('Could not get section info');

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) throw new Error('No active markdown view');

        const editor = view.editor;
        const { lineStart, lineEnd } = sectionInfo;

        const updatedBlockContent = newYaml ? `---\n${newYaml}\n---\n${newPrompt}` : newPrompt;

        const startPos = { line: lineStart + 1, ch: 0 };
        const endPos = { line: lineEnd, ch: 0 };

        editor.replaceRange(updatedBlockContent + '\n', startPos, endPos);
        // Notice removed as it interrupts typing flow
    }

    generateYamlFromConfig(config: any): string {
        const lines: string[] = [];
        const default_config: any = DEFAULT_BLOCK_CONFIG;

        for (const key in default_config) {
            if (config[key] !== undefined && config[key] !== default_config[key]) {
                const value = config[key];
                if (Array.isArray(value)) {
                    lines.push(`${key}: ${JSON.stringify(value)}`);
                } else if (typeof value === 'string') {
                    // Quote strings especially if they contain colons or other potential special chars
                    if (value.includes(':') || value.includes('#') || value === '') {
                        lines.push(`${key}: "${value}"`);
                    } else {
                        lines.push(`${key}: ${value}`);
                    }
                } else {
                    lines.push(`${key}: ${value}`);
                }
            }
        }

        return lines.length > 0 ? lines.join('\n') : '';
    }
}
