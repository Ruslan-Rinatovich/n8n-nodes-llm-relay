import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/transport/openai', () => ({
  chatOpenAI: vi.fn(),
}));
vi.mock('../src/transport/openaiCompatible', () => ({
  chatOpenAICompatible: vi.fn(),
}));

import { relay, type RelayConfig, type RelayInputs, type CredentialData } from '../src/LlmRelay.node';
import { chatOpenAI } from '../src/transport/openai';
import { chatOpenAICompatible } from '../src/transport/openaiCompatible';

const baseConfig: RelayConfig = {
  upstream: {
    provider: 'openai',
    model: 'gpt-test',
    systemPrompt: '',
    userTemplate: '{{userText}}',
    temperature: 0,
    maxTokens: 10,
    timeoutMs: 1000,
  },
  downstream: {
    provider: 'openaiCompat',
    baseURL: 'https://example.com',
    model: 'ds-model',
    temperature: 0,
    maxTokens: 10,
    timeoutMs: 1000,
  },
  routing: {
    mode: 'always',
    threshold: 0,
    scoreRegex: 'score\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)',
  },
  output: {
    wantRawProviderResponses: false,
    emitOnlyDownstreamText: false,
  },
};

const creds: CredentialData = {
  openAiApi: { apiKey: 'a' },
  openAiCompat: { apiKey: 'b', baseURL: 'https://example.com' },
};

const input: RelayInputs = { vars: {}, userText: 'hello' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('relay', () => {
  it('mode="always" calls both providers', async () => {
    (chatOpenAI as any).mockResolvedValue({ text: 'up', latency_ms: 1 });
    (chatOpenAICompatible as any).mockResolvedValue({ text: 'down', latency_ms: 1 });
    await relay(input, baseConfig, creds);
    expect(chatOpenAI).toHaveBeenCalledTimes(1);
    expect(chatOpenAICompatible).toHaveBeenCalledTimes(1);
  });

  it('if_token_gt triggers by tokens', async () => {
    const cfg = { ...baseConfig, routing: { mode: 'if_token_gt', threshold: 5, scoreRegex: baseConfig.routing.scoreRegex } };
    (chatOpenAI as any).mockResolvedValue({ text: 'up', latency_ms: 1, completion_tokens: 10 });
    (chatOpenAICompatible as any).mockResolvedValue({ text: 'down', latency_ms: 1 });
    await relay(input, cfg, creds);
    expect(chatOpenAICompatible).toHaveBeenCalled();
  });

  it('emitOnlyDownstreamText returns only text', async () => {
    const cfg = { ...baseConfig, output: { wantRawProviderResponses: false, emitOnlyDownstreamText: true } };
    (chatOpenAI as any).mockResolvedValue({ text: 'up', latency_ms: 1 });
    (chatOpenAICompatible as any).mockResolvedValue({ text: 'down', latency_ms: 1 });
    const res = await relay(input, cfg, creds);
    expect(res).toEqual({ text: 'down' });
  });
});
