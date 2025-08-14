# n8n-nodes-llm-relay

Custom **LLM Relay Tool** node for [n8n](https://n8n.io). It routes prompts between two LLM providers and optionally forwards the upstream response to a downstream model.

## Installation

```bash
pnpm --filter n8n-nodes-llm-relay build
# Link the package into your n8n installation
```

Enable community nodes in n8n and install the built package. Configure credentials for your providers (OpenAI, OpenAI Compatible or DeepSeek).

## Parameters

- **Upstream** – provider, model, system prompt, template, temperature, tokens and timeout.
- **Downstream** – provider, model, optional base URL, temperature, tokens, timeout and additional system prompt.
- **Routing** – choose when to call downstream (`always`, `if_token_gt`, `if_score_gte`, `disabled`).
- **Output** – include raw responses or emit only downstream text.

## Example

See `examples/workflows/llm-relay-demo.json` for a simple workflow.
