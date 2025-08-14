import fetch from 'node-fetch';
import { ChatMessage, ChatResponse } from './types.js';
import { retry } from '../utils/retry.js';

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

export async function chatOpenAI(args: OpenAIArgs): Promise<ChatResponse & { raw: unknown; latency_ms: number }> {
  const { apiKey, model, messages, temperature, maxTokens, timeoutMs, baseURL, isResponsesApi, reasoningEffort } = args;
  const root = (baseURL ?? 'https://api.openai.com').replace(/\/$/, '');
  const path = isResponsesApi ? '/v1/responses' : '/v1/chat/completions';
  const url = root + path;
  const body = isResponsesApi
    ? {
        model,
        input: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
        temperature,
        max_output_tokens: maxTokens,
        reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
      }
    : {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

  return retry(async (signal) => {
    const start = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    const json = (await res.json()) as any;
    const latency = Date.now() - start;
    let text = '';
    let finish: string | undefined;
    if (isResponsesApi) {
      text = json.output?.[0]?.content?.[0]?.text ?? json.output_text ?? '';
      finish = json.output?.[0]?.finish_reason ?? json.choices?.[0]?.finish_reason;
    } else {
      text = json.choices?.[0]?.message?.content ?? '';
      finish = json.choices?.[0]?.finish_reason;
    }
    const prompt = json.usage?.prompt_tokens;
    const completion = json.usage?.completion_tokens;
    return {
      text,
      finish_reason: finish,
      prompt_tokens: prompt,
      completion_tokens: completion,
      raw: json,
      latency_ms: latency,
    };
  }, { timeoutMs });
}
