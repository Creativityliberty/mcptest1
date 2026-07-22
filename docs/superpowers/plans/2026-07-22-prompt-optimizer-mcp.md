# Prompt Optimizer MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a tested, stateless, zero-dependency Node.js MCP server exposing one `optimize_prompt` tool for ChatGPT.

**Architecture:** A pure optimizer engine is wrapped by a small MCP JSON-RPC dispatcher and exposed through stateless Streamable HTTP. The tool returns both `structuredContent` and equivalent JSON text content for compatibility.

**Tech Stack:** Node.js 20+, ECMAScript modules, built-in HTTP server, built-in test runner.

## Global Constraints

- One public tool only: `optimize_prompt`.
- No OAuth, database, widget, billing, queues, external AI API, or runtime package.
- Preserve user intent and identify assumptions rather than inventing hidden facts.
- Stateless Streamable HTTP endpoint at `/mcp`.
- Deterministic behavior and tests.

---

### Task 1: Pure optimizer engine

**Files:**
- Create: `src/optimizer.js`
- Test: `tests/optimizer.test.js`

**Interfaces:**
- Produces: `optimizePrompt(input): OptimizePromptResult`.

- [x] Write failing tests for transformation, modes, missing information, language selection, validation, and score bounds.
- [x] Run the test file and confirm the missing module failure.
- [x] Implement the smallest deterministic engine that passes.
- [x] Re-run and confirm green.

### Task 2: MCP tool contract

**Files:**
- Create: `src/mcp.js`
- Test: `tests/mcp.test.js`

**Interfaces:**
- Consumes: `optimizePrompt(input)`.
- Produces: `handleMcpMessage(message)` and `OPTIMIZE_PROMPT_TOOL`.

- [x] Write failing tests for initialize, tools/list, tools/call, invalid input, and unknown methods.
- [x] Confirm the missing module failure.
- [x] Implement JSON-RPC dispatch and the declared input/output schemas.
- [x] Re-run and confirm green.

### Task 3: HTTP transport and distribution

**Files:**
- Create: `src/index.js`
- Create: `tests/http.test.js`
- Create: `README.md`
- Create: `.env.example`
- Create: `Dockerfile`

**Interfaces:**
- Consumes: `handleMcpMessage(message)`.
- Produces: `createHttpServer(options)` plus executable startup.

- [x] Write failing HTTP tests for health, initialization, notifications, GET behavior, body limits, and origin validation.
- [x] Confirm the missing module failure.
- [x] Implement the native HTTP transport.
- [x] Document local use, HTTPS exposure, and ChatGPT Developer Mode connection.
- [x] Run all tests and syntax checks, then build the ZIP.
