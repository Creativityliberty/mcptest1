# Nümtema Prompt Optimizer MCP

A minimal, open-source MCP server that turns a rough prompt into a clearer, structured prompt.

- One tool: `optimize_prompt`
- Zero runtime dependencies
- No API key
- No database or prompt storage
- No OAuth or widget in this MVP
- Stateless Streamable HTTP endpoint for ChatGPT

## What the tool returns

```json
{
  "optimized_prompt": "...",
  "improvements": ["..."],
  "missing_information": ["..."],
  "assumptions": ["..."],
  "score_before": 30,
  "score_after": 87,
  "mode": "balanced",
  "target_model": "chatgpt",
  "language": "fr"
}
```

The engine is deterministic. It does not call an LLM and never silently invents missing project facts. Missing details are exposed as placeholders.

## Requirements

- Node.js 20 or newer

No `npm install` is necessary because the server has no dependencies.

## Run locally

```bash
npm start
```

Default endpoints:

```text
http://127.0.0.1:3000/health
http://127.0.0.1:3000/mcp
```

Development mode:

```bash
npm run dev
```

## Test

```bash
npm test
npm run check
```

## Quick protocol smoke test

Initialize:

```bash
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-11-25",
      "capabilities":{},
      "clientInfo":{"name":"curl","version":"1.0.0"}
    }
  }'
```

List tools:

```bash
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Call the optimizer:

```bash
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-11-25' \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"optimize_prompt",
      "arguments":{
        "prompt":"Crée-moi un site pour vendre des ebooks",
        "mode":"balanced",
        "target_model":"chatgpt"
      }
    }
  }'
```

## Connect it to ChatGPT

ChatGPT needs a reachable HTTPS `/mcp` endpoint.

1. Run the server locally with `npm start`.
2. Expose port `3000` through the OpenAI Secure MCP Tunnel, Cloudflare Tunnel, ngrok, or deploy the Docker image to an HTTPS host.
3. In ChatGPT, enable Developer Mode under **Settings → Security and login**.
4. Open **Settings → Plugins**, create a developer-mode app, and enter:

```text
Name: Nümtema Prompt Optimizer
Description: Improves rough prompts, identifies missing information, and returns a reusable structured prompt.
MCP server URL: https://YOUR-DOMAIN.example/mcp
```

5. Create a new conversation, enable the app from the composer, and ask:

```text
Optimise ce prompt avec Nümtema Prompt Optimizer :
Crée-moi un site moderne pour vendre des ebooks sur l'intelligence artificielle.
```

When tool metadata changes, refresh the developer app from ChatGPT settings.

## Tool inputs

| Field | Required | Default | Description |
|---|---:|---|---|
| `prompt` | yes | — | Raw prompt, 3–20,000 characters |
| `mode` | no | `balanced` | `fast`, `balanced`, or `deep` |
| `target_model` | no | `chatgpt` | Target assistant/model family |
| `language` | no | `auto` | `auto`, `fr`, or `en` |
| `context` | no | — | Project or situation context |
| `audience` | no | — | Intended audience |
| `output_format` | no | — | Required response format |

## Configuration

```bash
HOST=127.0.0.1
PORT=3000
ALLOWED_ORIGINS=https://chatgpt.com,https://www.chatgpt.com,https://chat.openai.com
```

Set `HOST=0.0.0.0` inside containers. `ALLOWED_ORIGINS=*` is available for controlled testing but is not recommended for production.

## Docker

```bash
docker build -t numtema-prompt-optimizer-mcp .
docker run --rm -p 3000:3000 numtema-prompt-optimizer-mcp
```

## Deliberate MVP limits

This version does not include user accounts, history, profiles, OAuth, UI widgets, billing, async jobs, provider APIs, or multi-agent orchestration. Those belong in later versions only after this single tool proves useful.

## License

MIT
