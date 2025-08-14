import { ChatMessage, ChatResponse } from './types.js';
export interface OpenAIArgs {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    baseURL?: string;
    isResponsesApi?: boolean;
    reasoningEffort?: 'minimal' | 'medium' | 'high';
}
export declare function chatOpenAI(args: OpenAIArgs): Promise<ChatResponse & {
    raw: unknown;
    latency_ms: number;
}>;
