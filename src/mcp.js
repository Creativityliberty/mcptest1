import { optimizePrompt } from './optimizer.js';

export const SERVER_NAME = 'numtema-prompt-optimizer-mcp';
export const SERVER_VERSION = '0.1.0';
export const LATEST_PROTOCOL_VERSION = '2025-11-25';
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  '2025-11-25',
  '2025-06-18',
  '2025-03-26'
]);

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' }
};

export const OPTIMIZE_PROMPT_TOOL = Object.freeze({
  name: 'optimize_prompt',
  title: 'Optimize a prompt',
  description:
    'Transform a rough prompt into a clearer, structured, directly reusable prompt. ' +
    'Use this when the user asks to improve, rewrite, structure, clarify, strengthen, or professionalize a prompt. ' +
    'The tool preserves the original intent, identifies missing information, exposes assumptions, and returns before/after quality scores. ' +
    'It does not execute the optimized prompt and does not store user content.',
  inputSchema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        minLength: 3,
        maxLength: 20_000,
        description: 'The raw prompt to improve. Preserve its intent and supplied facts.'
      },
      mode: {
        type: 'string',
        enum: ['fast', 'balanced', 'deep'],
        default: 'balanced',
        description: 'fast is compact, balanced is the default, deep adds execution and self-review instructions.'
      },
      target_model: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        default: 'chatgpt',
        description: 'Target assistant or model family, for example chatgpt, claude, gemini, or generic.'
      },
      language: {
        type: 'string',
        enum: ['auto', 'fr', 'en'],
        default: 'auto',
        description: 'Language of the optimized prompt. auto detects French or English from the source prompt.'
      },
      context: {
        type: 'string',
        maxLength: 5_000,
        description: 'Optional project or situation context to integrate.'
      },
      audience: {
        type: 'string',
        maxLength: 1_000,
        description: 'Optional target audience to integrate.'
      },
      output_format: {
        type: 'string',
        maxLength: 1_000,
        description: 'Optional required output format, such as a table, plan, JSON, email, or report.'
      }
    },
    required: ['prompt'],
    additionalProperties: false
  },
  outputSchema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      optimized_prompt: { type: 'string' },
      improvements: stringArraySchema,
      missing_information: stringArraySchema,
      assumptions: stringArraySchema,
      score_before: { type: 'integer', minimum: 0, maximum: 100 },
      score_after: { type: 'integer', minimum: 0, maximum: 100 },
      mode: { type: 'string', enum: ['fast', 'balanced', 'deep'] },
      target_model: { type: 'string' },
      language: { type: 'string', enum: ['fr', 'en'] }
    },
    required: [
      'optimized_prompt',
      'improvements',
      'missing_information',
      'assumptions',
      'score_before',
      'score_after',
      'mode',
      'target_model',
      'language'
    ],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  execution: {
    taskSupport: 'forbidden'
  }
});

function success(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function failure(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ?? null, error };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function negotiateProtocolVersion(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

function handleInitialize(message) {
  if (!isObject(message.params)) {
    return failure(message.id, -32602, 'Invalid initialize parameters');
  }

  const protocolVersion = negotiateProtocolVersion(message.params.protocolVersion);
  return success(message.id, {
    protocolVersion,
    capabilities: {
      tools: { listChanged: false }
    },
    serverInfo: {
      name: SERVER_NAME,
      title: 'Nümtema Prompt Optimizer',
      version: SERVER_VERSION,
      description: 'A stateless MCP server that turns rough prompts into structured prompts.'
    },
    instructions:
      'Use optimize_prompt when the user wants a prompt improved or structured. ' +
      'Return the optimized prompt prominently and keep missing information and assumptions visible.'
  });
}

function handleToolCall(message) {
  if (!isObject(message.params) || typeof message.params.name !== 'string') {
    return failure(message.id, -32602, 'Invalid tools/call parameters');
  }

  if (message.params.name !== OPTIMIZE_PROMPT_TOOL.name) {
    return failure(message.id, -32602, `Unknown tool: ${message.params.name}`);
  }

  const args = message.params.arguments ?? {};
  if (!isObject(args)) {
    return success(message.id, {
      content: [{ type: 'text', text: 'Tool arguments must be an object.' }],
      isError: true
    });
  }

  try {
    const structuredContent = optimizePrompt(args);
    return success(message.id, {
      content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
      structuredContent,
      isError: false
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Prompt optimization failed';
    return success(message.id, {
      content: [{ type: 'text', text: messageText }],
      isError: true
    });
  }
}

export function isNotification(message) {
  return isObject(message) && message.id === undefined && typeof message.method === 'string';
}

export function handleMcpMessage(message) {
  if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return failure(isObject(message) ? message.id : null, -32600, 'Invalid Request');
  }

  if (isNotification(message)) {
    return null;
  }

  switch (message.method) {
    case 'initialize':
      return handleInitialize(message);
    case 'ping':
      return success(message.id, {});
    case 'tools/list':
      return success(message.id, { tools: [OPTIMIZE_PROMPT_TOOL] });
    case 'tools/call':
      return handleToolCall(message);
    default:
      return failure(message.id, -32601, `Method not found: ${message.method}`);
  }
}
