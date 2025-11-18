/**
 * @jest-environment node
 * @file Integration tests for WorkspaceDataFetcher interacting with real HTTP endpoints.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js';

/**
 * Helper to start an HTTP server with predefined routes used in these tests.
 *
 * @returns {Promise<{ close: () => Promise<void>, baseUrl: string }>} server controls
 */
async function startWorkspaceServer() {
  const server = createServer((req, res) => {
    const host = req.headers.host ?? '127.0.0.1';
    const { pathname } = new URL(req.url ?? '/', `http://${host}`);

    if (pathname === '/success') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ok', value: 42 }));
      return;
    }

    if (pathname === '/http-error') {
      const longBody = JSON.stringify({
        error: 'bad gateway',
        trace: 'x'.repeat(520),
      });
      res.writeHead(502, 'Upstream Failure', {
        'Content-Type': 'application/json',
      });
      res.end(longBody);
      return;
    }

    if (pathname === '/http-error-truncated') {
      res.writeHead(500, 'Truncated Body', {
        'Content-Type': 'text/plain',
        'Content-Length': '100',
      });
      res.end('partial body');
      return;
    }

    if (pathname === '/invalid-json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('not json');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  // Avoid unhandled errors from deliberate socket interruptions
  server.on('clientError', () => {});

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = /** @type {{ address: string, port: number }} */ (server.address());
  const baseUrl = `http://${address.address}:${address.port}`;

  return {
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

describe('WorkspaceDataFetcher integration', () => {
  let fetcher;
  let consoleErrorSpy;
  let serverControls;

  beforeAll(async () => {
    serverControls = await startWorkspaceServer();
  });

  afterAll(async () => {
    await serverControls.close();
  });

  beforeEach(() => {
    fetcher = new WorkspaceDataFetcher();
    // PERFORMANCE: Create spy fresh for each test to ensure clean state
    // but this is still faster than creating/destroying servers
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('fetches and parses JSON data from the workspace server', async () => {
    const data = await fetcher.fetch(`${serverControls.baseUrl}/success`);

    expect(data).toEqual({ message: 'ok', value: 42 });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('propagates HTTP errors with a truncated response body for diagnostics', async () => {
    const targetUrl = `${serverControls.baseUrl}/http-error`;

    const expectedSnippet = JSON.stringify({
      error: 'bad gateway',
      trace: 'x'.repeat(520),
    }).substring(0, 500);

    await expect(fetcher.fetch(targetUrl)).rejects.toThrow(
      `HTTP error! status: 502 (Upstream Failure) fetching ${targetUrl}. Response body: ${expectedSnippet}...`
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [message, error] = consoleErrorSpy.mock.calls[0];
    expect(message).toBe(
      `WorkspaceDataFetcher: Error fetching or parsing ${targetUrl}:`
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      `HTTP error! status: 502 (Upstream Failure) fetching ${targetUrl}. Response body: ${expectedSnippet}...`
    );
  });

  it('falls back to diagnostic messaging when the error body cannot be read', async () => {
    const targetUrl = `${serverControls.baseUrl}/http-error-truncated`;

    await expect(fetcher.fetch(targetUrl)).rejects.toThrow(
      `HTTP error! status: 500 (Truncated Body) fetching ${targetUrl}. Response body: (Could not read response body: terminated)`
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [message, error] = consoleErrorSpy.mock.calls[0];
    expect(message).toBe(
      `WorkspaceDataFetcher: Error fetching or parsing ${targetUrl}:`
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      `HTTP error! status: 500 (Truncated Body) fetching ${targetUrl}. Response body: (Could not read response body: terminated)`
    );
  });

  it('surfaces JSON parsing failures from upstream services', async () => {
    const targetUrl = `${serverControls.baseUrl}/invalid-json`;

    await expect(fetcher.fetch(targetUrl)).rejects.toThrow(
      /not valid JSON/i
    );

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [message, error] = consoleErrorSpy.mock.calls[0];
    expect(message).toBe(
      `WorkspaceDataFetcher: Error fetching or parsing ${targetUrl}:`
    );
    expect(error?.name).toBe('SyntaxError');
    expect(error.message).toMatch(/not valid JSON/i);
  });

  it('propagates network failures encountered by fetch', async () => {
    // PERFORMANCE: Simplified to use an invalid port instead of creating/closing a server
    // This tests the same network failure behavior but is much faster
    const targetUrl = 'http://127.0.0.1:1/network-error'; // Port 1 is typically closed

    await expect(fetcher.fetch(targetUrl)).rejects.toThrow(/fetch failed|ECONNREFUSED/);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [message, error] = consoleErrorSpy.mock.calls[0];
    expect(message).toBe(
      `WorkspaceDataFetcher: Error fetching or parsing ${targetUrl}:`
    );
    expect(error?.name).toBe('TypeError');
    expect(error.message).toMatch(/fetch failed|ECONNREFUSED/);
  });

  it('rejects invalid identifiers before attempting any network calls', async () => {
    await expect(fetcher.fetch('   ')).rejects.toThrow(
      'WorkspaceDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
