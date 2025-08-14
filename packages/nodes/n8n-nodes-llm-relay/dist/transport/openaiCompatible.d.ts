import { ChatMessage, ChatResponse } from './types.js';
export interface OpenAICompatArgs {
    apiKey: string;
    baseURL: string;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}
export declare function chatOpenAICompatible(args: OpenAICompatArgs): Promise<ChatResponse & {
    raw: unknown;
    latency_ms: number;
}>;
