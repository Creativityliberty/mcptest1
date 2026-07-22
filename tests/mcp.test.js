import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcpMessage, OPTIMIZE_PROMPT_TOOL } from '../src/mcp.js';

test('initialize negotiates the requested supported protocol version', () => {
  const response = handleMcpMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  });

  assert.equal(response.result.protocolVersion, '2025-11-25');
  assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } });
});

test('tools/list exposes only optimize_prompt with schemas and safe annotations', () => {
  const response = handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

  assert.equal(response.result.tools.length, 1);
  assert.equal(response.result.tools[0].name, 'optimize_prompt');
  assert.equal(response.result.tools[0].inputSchema.type, 'object');
  assert.equal(response.result.tools[0].outputSchema.type, 'object');
  assert.equal(response.result.tools[0].annotations.readOnlyHint, true);
  assert.deepEqual(response.result.tools[0], OPTIMIZE_PROMPT_TOOL);
});

test('tools/call returns structured content and serialized text content', () => {
  const response = handleMcpMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'optimize_prompt',
      arguments: { prompt: 'Crée un site de vente de livres', mode: 'balanced' }
    }
  });

  assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent.mode, 'balanced');
  assert.equal(response.result.structuredContent.detected_task_type, 'website');
  assert.deepEqual(JSON.parse(response.result.content[0].text), response.result.structuredContent);
});

test('tools/call returns a tool execution error for invalid input', () => {
  const response = handleMcpMessage({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'optimize_prompt', arguments: { prompt: '' } }
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /prompt/i);
});

test('unknown methods return JSON-RPC method not found', () => {
  const response = handleMcpMessage({ jsonrpc: '2.0', id: 5, method: 'unknown/method' });

  assert.equal(response.error.code, -32601);
});

test('tool schema exposes adaptive v0.2 output fields', () => {
  const output = OPTIMIZE_PROMPT_TOOL.outputSchema;
  assert.deepEqual(output.properties.detected_task_type.enum, [
    'coding',
    'website',
    'marketing',
    'writing',
    'research',
    'image_generation',
    'video_generation',
    'business',
    'general'
  ]);
  assert.equal(output.properties.clarifying_questions.type, 'array');
  assert.ok(output.required.includes('detected_task_type'));
  assert.ok(output.required.includes('clarifying_questions'));
});
