# Nümtema Prompt Optimizer MCP — MVP Design

## Goal

Build a small open-source MCP server that ChatGPT can call to transform a rough prompt into a clearer, structured prompt without authentication, storage, widgets, external model APIs, or runtime dependencies.

## Scope

The server exposes one public read-only tool: `optimize_prompt`.

Inputs:
- `prompt`: required source prompt, 3 to 20,000 characters.
- `mode`: optional `fast`, `balanced`, or `deep`; default `balanced`.
- `target_model`: optional target such as `chatgpt`, `claude`, or `gemini`; default `chatgpt`.
- `language`: optional `auto`, `fr`, or `en`; default `auto`.
- `context`, `audience`, and `output_format`: optional hints.

Outputs:
- `optimized_prompt`
- `improvements`
- `missing_information`
- `assumptions`
- `score_before`
- `score_after`
- `mode`
- `target_model`
- `language`

## Architecture

1. `src/optimizer.js` contains the pure deterministic optimization engine.
2. `src/mcp.js` defines the tool contract and handles the required MCP JSON-RPC methods.
3. `src/index.js` exposes a stateless Streamable HTTP endpoint at `/mcp` and a health endpoint at `/health` using Node's built-in HTTP server.
4. Node's built-in test runner covers the optimizer, MCP lifecycle, tool contract, validation, and HTTP transport.

The server does not call an LLM. It creates a reusable meta-prompt around the user's original request while preserving intent and marking unknowns instead of silently inventing facts.

## Supported MCP surface

- `initialize`
- `notifications/initialized`
- `ping`
- `tools/list`
- `tools/call`
- Streamable HTTP JSON responses
- Protocol versions `2025-11-25`, `2025-06-18`, and `2025-03-26`

GET-based SSE and sessions are deliberately omitted. The MCP endpoint returns `405 Method Not Allowed` for GET, which is permitted for servers that do not provide a standalone SSE stream.

## Safety and privacy

- Tool annotations declare read-only, non-destructive, idempotent, and closed-world behavior.
- No prompt persistence or application-level prompt logging.
- No secrets or API keys.
- Request body limited to 1 MiB.
- `Origin` headers are validated.
- Default bind address is `127.0.0.1`; containers may set `HOST=0.0.0.0`.

## Acceptance criteria

- `npm test` passes.
- `npm run check` passes.
- `npm start` serves `/health` and `/mcp`.
- An MCP client can initialize, list, and call `optimize_prompt`.
- The ZIP excludes generated or machine-local files.
