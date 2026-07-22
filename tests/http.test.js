import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHttpServer } from '../src/index.js';

async function withServer(options, callback) {
  const server = createHttpServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await callback(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('GET /health reports service metadata', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'numtema-prompt-optimizer-mcp');
  });
});

test('POST /mcp handles initialize as application/json', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'http-test', version: '1.0.0' }
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(body.result.serverInfo.name, 'numtema-prompt-optimizer-mcp');
  });
});

test('notifications receive 202 with no response body', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
    });

    assert.equal(response.status, 202);
    assert.equal(await response.text(), '');
  });
});

test('GET /mcp returns 405 because standalone SSE is not implemented', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      headers: { accept: 'text/event-stream' }
    });

    assert.equal(response.status, 405);
  });
});

test('rejects an unapproved Origin header', async () => {
  await withServer({ allowedOrigins: ['https://chatgpt.com'] }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    });

    assert.equal(response.status, 403);
  });
});

test('rejects request bodies larger than the configured limit', async () => {
  await withServer({ maxBodyBytes: 128 }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'optimize_prompt', arguments: { prompt: 'x'.repeat(500) } }
      })
    });

    assert.equal(response.status, 413);
  });
});

test('HTTP MCP flow lists and calls optimize_prompt', async () => {
  await withServer({}, async (baseUrl) => {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25'
    };

    const listResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    });
    const listBody = await listResponse.json();
    assert.equal(listBody.result.tools[0].name, 'optimize_prompt');

    const callResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'optimize_prompt',
          arguments: {
            prompt: 'Crée un plan pour vendre des ebooks sur l’intelligence artificielle',
            mode: 'balanced',
            audience: 'Débutants francophones'
          }
        }
      })
    });
    const callBody = await callResponse.json();

    assert.equal(callResponse.status, 200);
    assert.equal(callBody.result.isError, false);
    assert.match(callBody.result.structuredContent.optimized_prompt, /Débutants francophones/);
  });
});

test('rejects unsupported MCP protocol versions after initialization', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'mcp-protocol-version': '2099-01-01'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, -32602);
  });
});
