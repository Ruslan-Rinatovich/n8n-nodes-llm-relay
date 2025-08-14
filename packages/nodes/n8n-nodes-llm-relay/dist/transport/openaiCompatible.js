import fetch from 'node-fetch';
import { retry } from '../utils/retry.js';
export async function chatOpenAICompatible(args) {
    const { apiKey, baseURL, model, messages, temperature, maxTokens, timeoutMs } = args;
    const url = baseURL.replace(/\/$/, '') + '/v1/chat/completions';
    const body = {
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
        const json = (await res.json());
        const latency = Date.now() - start;
        const text = json.choices?.[0]?.message?.content ?? '';
        const finish = json.choices?.[0]?.finish_reason;
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
//# sourceMappingURL=openaiCompatible.js.map