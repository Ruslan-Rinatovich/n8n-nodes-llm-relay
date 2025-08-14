import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
export interface UpstreamConfig {
    provider: 'openai' | 'openaiCompat' | 'none';
    model: string;
    systemPrompt: string;
    userTemplate: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    reasoningEffort?: 'minimal' | 'medium' | 'high';
}
export interface DownstreamConfig {
    provider: 'openai' | 'openaiCompat' | 'deepseekCompat';
    baseURL?: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
    downstreamSystemPrompt?: string;
}
export interface RoutingConfig {
    mode: 'always' | 'if_token_gt' | 'if_score_gte' | 'disabled';
    threshold: number;
    scoreRegex: string;
}
export interface OutputConfig {
    wantRawProviderResponses: boolean;
    emitOnlyDownstreamText: boolean;
}
export interface RelayConfig {
    upstream: UpstreamConfig;
    downstream: DownstreamConfig;
    routing: RoutingConfig;
    output: OutputConfig;
}
export interface RelayInputs {
    vars: Record<string, unknown>;
    userText: string;
}
export interface CredentialData {
    openAiApi?: {
        apiKey: string;
    };
    openAiCompat?: {
        apiKey: string;
        baseURL: string;
    };
    deepseekCompat?: {
        apiKey: string;
        baseURL: string;
    };
}
export declare function relay(input: RelayInputs, config: RelayConfig, creds: CredentialData): Promise<any>;
export declare class LlmRelay implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
