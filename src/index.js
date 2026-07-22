import http from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  handleMcpMessage,
  isNotification,
  LATEST_PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS
} from './mcp.js';

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://chatgpt.com',
  'https://www.chatgpt.com',
  'https://chat.openai.com'
];

function parseAllowedOrigins(value) {
  if (!value) return DEFAULT_ALLOWED_ORIGINS;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function sendJson(response, statusCode, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...extraHeaders
  });
  response.end(payload);
}

function sendEmpty(response, statusCode, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'content-length': '0',
    'cache-control': 'no-store',
    ...extraHeaders
  });
  response.end();
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ?? null, error };
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

function readJsonBody(request, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (tooLarge) {
        const error = new Error('Request body exceeds the configured limit');
        error.statusCode = 413;
        error.rpcCode = -32600;
        reject(error);
        return;
      }

      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text));
      } catch {
        const error = new Error('Invalid JSON body');
        error.statusCode = 400;
        error.rpcCode = -32700;
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function applyCorsHeaders(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    response.setHeader(
      'access-control-allow-headers',
      'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Authorization'
    );
  }
}

function validateProtocolHeader(request, message) {
  if (message?.method === 'initialize') return null;
  const supplied = request.headers['mcp-protocol-version'];
  if (!supplied) return null;
  if (SUPPORTED_PROTOCOL_VERSIONS.includes(supplied)) return null;
  return jsonRpcError(
    message?.id,
    -32602,
    'Unsupported MCP protocol version',
    { supported: SUPPORTED_PROTOCOL_VERSIONS, requested: supplied }
  );
}

export function createHttpServer(options = {}) {
  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return http.createServer(async (request, response) => {
    applyCorsHeaders(request, response, allowedOrigins);

    const origin = request.headers.origin;
    if (!isOriginAllowed(origin, allowedOrigins)) {
      sendJson(response, 403, jsonRpcError(null, -32000, 'Forbidden Origin'));
      return;
    }

    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'OPTIONS') {
      sendEmpty(response, 204);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: SERVER_NAME,
        version: SERVER_VERSION,
        protocol_version: LATEST_PROTOCOL_VERSION,
        tool_count: 1
      });
      return;
    }

    if (requestUrl.pathname !== '/mcp') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    if (request.method === 'GET') {
      sendEmpty(response, 405, { allow: 'POST, OPTIONS' });
      return;
    }

    if (request.method !== 'POST') {
      sendEmpty(response, 405, { allow: 'POST, OPTIONS' });
      return;
    }

    const contentType = request.headers['content-type'] ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      sendJson(response, 415, jsonRpcError(null, -32600, 'Content-Type must be application/json'));
      return;
    }

    let message;
    try {
      message = await readJsonBody(request, maxBodyBytes);
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      const rpcCode = Number.isInteger(error.rpcCode) ? error.rpcCode : -32603;
      sendJson(response, statusCode, jsonRpcError(null, rpcCode, error.message));
      return;
    }

    const protocolError = validateProtocolHeader(request, message);
    if (protocolError) {
      sendJson(response, 400, protocolError);
      return;
    }

    if (isNotification(message)) {
      handleMcpMessage(message);
      sendEmpty(response, 202);
      return;
    }

    const result = handleMcpMessage(message);
    sendJson(response, 200, result);
  });
}

export function startServer(options = {}) {
  const port = options.port ?? Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const server = createHttpServer(options);

  server.listen(port, host, () => {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} listening on http://${host}:${port}/mcp`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

const executedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (executedDirectly) startServer();
