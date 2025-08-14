import { chatOpenAI } from './transport/openai.js';
import { chatOpenAICompatible } from './transport/openaiCompatible.js';
function renderTemplate(template, vars, userText) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        const re = new RegExp(`{{\\s*vars\\.${key}\\s*}}`, 'g');
        result = result.replace(re, String(value));
    }
    result = result.replace(/{{\s*userText\s*}}/g, userText);
    return result;
}
export async function relay(input, config, creds) {
    const { upstream, downstream, routing, output } = config;
    const renderedUser = renderTemplate(upstream.userTemplate || '{{userText}}', input.vars, input.userText);
    let upstreamMessages = [];
    if (upstream.systemPrompt)
        upstreamMessages.push({ role: 'system', content: upstream.systemPrompt });
    upstreamMessages.push({ role: 'user', content: renderedUser });
    let upstreamResult;
    if (upstream.provider !== 'none') {
        if (upstream.provider === 'openai') {
            const apiKey = creds.openAiApi?.apiKey ?? '';
            upstreamResult = await chatOpenAI({
                apiKey,
                model: upstream.model,
                messages: upstreamMessages,
                temperature: upstream.temperature,
                maxTokens: upstream.maxTokens,
                timeoutMs: upstream.timeoutMs,
                reasoningEffort: upstream.reasoningEffort,
            });
        }
        else if (upstream.provider === 'openaiCompat') {
            const cred = creds.openAiCompat;
            upstreamResult = await chatOpenAICompatible({
                apiKey: cred?.apiKey ?? '',
                baseURL: cred?.baseURL ?? '',
                model: upstream.model,
                messages: upstreamMessages,
                temperature: upstream.temperature,
                maxTokens: upstream.maxTokens,
                timeoutMs: upstream.timeoutMs,
            });
        }
    }
    let shouldSendDownstream = upstream.provider === 'none';
    let reason = upstream.provider === 'none' ? 'upstream disabled' : '';
    if (upstream.provider !== 'none') {
        switch (routing.mode) {
            case 'always':
                shouldSendDownstream = true;
                reason = 'always';
                break;
            case 'disabled':
                shouldSendDownstream = false;
                reason = 'routing disabled';
                break;
            case 'if_token_gt': {
                const tokens = upstreamResult?.completion_tokens ?? 0;
                if (tokens > routing.threshold) {
                    shouldSendDownstream = true;
                    reason = `completion_tokens ${tokens} > ${routing.threshold}`;
                }
                else {
                    shouldSendDownstream = false;
                    reason = `completion_tokens ${tokens} <= ${routing.threshold}`;
                }
                break;
            }
            case 'if_score_gte': {
                const regex = new RegExp(routing.scoreRegex, 'i');
                const match = upstreamResult?.text?.match(regex);
                const score = match ? parseFloat(match[1]) : NaN;
                if (match && score >= routing.threshold) {
                    shouldSendDownstream = true;
                    reason = `score ${score} >= ${routing.threshold}`;
                }
                else {
                    shouldSendDownstream = false;
                    reason = match ? `score ${score} < ${routing.threshold}` : 'no score found';
                }
                break;
            }
        }
    }
    let downstreamResult;
    const downstreamMessages = [];
    if (shouldSendDownstream) {
        if (downstream.downstreamSystemPrompt) {
            downstreamMessages.push({ role: 'system', content: downstream.downstreamSystemPrompt });
        }
        const downstreamUser = upstreamResult ? upstreamResult.text : renderedUser;
        downstreamMessages.push({ role: 'user', content: downstreamUser });
        if (downstream.provider === 'openai') {
            const apiKey = creds.openAiApi?.apiKey ?? '';
            downstreamResult = await chatOpenAI({
                apiKey,
                model: downstream.model,
                messages: downstreamMessages,
                temperature: downstream.temperature,
                maxTokens: downstream.maxTokens,
                timeoutMs: downstream.timeoutMs,
            });
        }
        else {
            const cred = downstream.provider === 'openaiCompat'
                ? creds.openAiCompat
                : creds.deepseekCompat;
            const baseURL = downstream.baseURL || cred?.baseURL || '';
            downstreamResult = await chatOpenAICompatible({
                apiKey: cred?.apiKey ?? '',
                baseURL,
                model: downstream.model,
                messages: downstreamMessages,
                temperature: downstream.temperature,
                maxTokens: downstream.maxTokens,
                timeoutMs: downstream.timeoutMs,
            });
        }
    }
    if (output.emitOnlyDownstreamText) {
        return { text: downstreamResult?.text ?? '' };
    }
    const result = {
        routing_decision: {
            mode: routing.mode,
            reason,
        },
        upstream: upstream.provider === 'none'
            ? undefined
            : {
                provider: upstream.provider,
                model: upstream.model,
                request: {
                    messages: upstreamMessages,
                    params: {
                        temperature: upstream.temperature,
                        maxTokens: upstream.maxTokens,
                    },
                },
                response: {
                    text: upstreamResult?.text ?? '',
                    finish_reason: upstreamResult?.finish_reason,
                },
                metrics: {
                    latency_ms: upstreamResult?.latency_ms ?? 0,
                    prompt_tokens: upstreamResult?.prompt_tokens,
                    completion_tokens: upstreamResult?.completion_tokens,
                },
            },
        downstream: !shouldSendDownstream
            ? undefined
            : {
                provider: downstream.provider,
                model: downstream.model,
                request: {
                    messages: downstreamMessages,
                    params: {
                        temperature: downstream.temperature,
                        maxTokens: downstream.maxTokens,
                    },
                },
                response: {
                    text: downstreamResult?.text ?? '',
                    finish_reason: downstreamResult?.finish_reason,
                },
                metrics: {
                    latency_ms: downstreamResult?.latency_ms ?? 0,
                    prompt_tokens: downstreamResult?.prompt_tokens,
                    completion_tokens: downstreamResult?.completion_tokens,
                },
            },
        raw: output.wantRawProviderResponses
            ? { upstream: upstreamResult?.raw, downstream: downstreamResult?.raw }
            : undefined,
    };
    return { data: result };
}
export class LlmRelay {
    constructor() {
        this.description = {
            displayName: 'LLM Relay Tool',
            name: 'llmRelay',
            group: ['transform'],
            version: 1,
            description: 'Relay prompts between LLM providers',
            defaults: {
                name: 'LLM Relay Tool',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                { name: 'openAiApi', required: false },
                { name: 'openAiCompat', required: false },
                { name: 'deepseekCompat', required: false },
            ],
            properties: [
                {
                    displayName: 'Upstream',
                    name: 'upstream',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Provider',
                            name: 'provider',
                            type: 'options',
                            options: [
                                { name: 'OpenAI', value: 'openai' },
                                { name: 'OpenAI Compatible', value: 'openaiCompat' },
                                { name: 'None', value: 'none' },
                            ],
                            default: 'openai',
                        },
                        {
                            displayName: 'Model',
                            name: 'model',
                            type: 'string',
                            default: '',
                        },
                        {
                            displayName: 'System Prompt',
                            name: 'systemPrompt',
                            type: 'string',
                            typeOptions: { rows: 4 },
                            default: '',
                        },
                        {
                            displayName: 'User Template',
                            name: 'userTemplate',
                            type: 'string',
                            typeOptions: { rows: 4 },
                            default: '{{userText}}',
                        },
                        {
                            displayName: 'Temperature',
                            name: 'temperature',
                            type: 'number',
                            typeOptions: { minValue: 0, maxValue: 2 },
                            default: 1,
                        },
                        {
                            displayName: 'Max Tokens',
                            name: 'maxTokens',
                            type: 'number',
                            default: 1024,
                        },
                        {
                            displayName: 'Timeout (ms)',
                            name: 'timeoutMs',
                            type: 'number',
                            default: 60000,
                        },
                        {
                            displayName: 'Reasoning Effort',
                            name: 'reasoningEffort',
                            type: 'options',
                            options: [
                                { name: 'Minimal', value: 'minimal' },
                                { name: 'Medium', value: 'medium' },
                                { name: 'High', value: 'high' },
                            ],
                            default: 'minimal',
                        },
                    ],
                },
                {
                    displayName: 'Downstream',
                    name: 'downstream',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Provider',
                            name: 'provider',
                            type: 'options',
                            options: [
                                { name: 'OpenAI', value: 'openai' },
                                { name: 'OpenAI Compatible', value: 'openaiCompat' },
                                { name: 'DeepSeek Compatible', value: 'deepseekCompat' },
                            ],
                            default: 'openai',
                        },
                        {
                            displayName: 'Base URL',
                            name: 'baseURL',
                            type: 'string',
                            default: '',
                        },
                        {
                            displayName: 'Model',
                            name: 'model',
                            type: 'string',
                            default: '',
                        },
                        {
                            displayName: 'Temperature',
                            name: 'temperature',
                            type: 'number',
                            typeOptions: { minValue: 0, maxValue: 2 },
                            default: 1,
                        },
                        {
                            displayName: 'Max Tokens',
                            name: 'maxTokens',
                            type: 'number',
                            default: 1024,
                        },
                        {
                            displayName: 'Timeout (ms)',
                            name: 'timeoutMs',
                            type: 'number',
                            default: 60000,
                        },
                        {
                            displayName: 'Downstream System Prompt',
                            name: 'downstreamSystemPrompt',
                            type: 'string',
                            typeOptions: { rows: 4 },
                            default: '',
                        },
                    ],
                },
                {
                    displayName: 'Routing',
                    name: 'routing',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Mode',
                            name: 'mode',
                            type: 'options',
                            options: [
                                { name: 'Always', value: 'always' },
                                { name: 'If Token Greater Than', value: 'if_token_gt' },
                                { name: 'If Score Greater Or Equal', value: 'if_score_gte' },
                                { name: 'Disabled', value: 'disabled' },
                            ],
                            default: 'always',
                        },
                        {
                            displayName: 'Threshold',
                            name: 'threshold',
                            type: 'number',
                            default: 0,
                        },
                        {
                            displayName: 'Score Regex',
                            name: 'scoreRegex',
                            type: 'string',
                            default: 'score\\s*[:=]\\s*(\\\d+(?:\\.\\d+)?)',
                        },
                    ],
                },
                {
                    displayName: 'Output',
                    name: 'output',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Raw Provider Responses',
                            name: 'wantRawProviderResponses',
                            type: 'boolean',
                            default: false,
                        },
                        {
                            displayName: 'Emit Only Downstream Text',
                            name: 'emitOnlyDownstreamText',
                            type: 'boolean',
                            default: false,
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const item = items[0].json;
        const upstream = this.getNodeParameter('upstream', 0);
        const downstream = this.getNodeParameter('downstream', 0);
        const routing = this.getNodeParameter('routing', 0);
        const output = this.getNodeParameter('output', 0);
        const creds = {
            openAiApi: (await this.getCredentials('openAiApi').catch(() => undefined)),
            openAiCompat: (await this.getCredentials('openAiCompat').catch(() => undefined)),
            deepseekCompat: (await this.getCredentials('deepseekCompat').catch(() => undefined)),
        };
        const result = await relay(item, { upstream, downstream, routing, output }, creds);
        return [[{ json: result }]];
    }
}
//# sourceMappingURL=LlmRelay.node.js.map