/**
 * @jest-environment node
 * @file Integration tests for WorkspaceDataFetcher interacting with real HTTP endpoints.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js';

const originalFetch = globalThis.fetch;
const { Response } = globalThis;

/**
 *
 * @param body
 * @param init
 */
function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

describe('WorkspaceDataFetcher integration', () => {
  let fetcher;
  let consoleErrorSpy;
  let fetchMock;

  beforeEach(() => {
    fetcher = new WorkspaceDataFetcher();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    globalThis.fetch = originalFetch;
    fetchMock.mockReset();
  });

  it('fetches and parses JSON data from the workspace server', async () => {
    const targetUrl = 'https://workspace.example/success';
    fetchMock.mockResolvedValue(
      createJsonResponse({ message: 'ok', value: 42 })
    );

    const data = await fetcher.fetch(targetUrl);

    expect(data).toEqual({ message: 'ok', value: 42 });
    expect(fetchMock).toHaveBeenCalledWith(targetUrl);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('propagates HTTP errors with a truncated response body for diagnostics', async () => {
    const targetUrl = 'https://workspace.example/http-error';
    const longBody = JSON.stringify({
      error: 'bad gateway',
      trace: 'x'.repeat(520),
    });
    const errorResponse = new Response(longBody, {
      status: 502,
      statusText: 'Upstream Failure',
      headers: { 'Content-Type': 'application/json' },
    });
    fetchMock.mockResolvedValue(errorResponse);

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
    const targetUrl = 'https://workspace.example/http-error-truncated';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Truncated Body',
      async text() {
        const err = new Error('terminated');
        throw err;
      },
    });

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
    const targetUrl = 'https://workspace.example/invalid-json';
    fetchMock.mockResolvedValue(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(fetcher.fetch(targetUrl)).rejects.toThrow(/not valid JSON/i);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [message, error] = consoleErrorSpy.mock.calls[0];
    expect(message).toBe(
      `WorkspaceDataFetcher: Error fetching or parsing ${targetUrl}:`
    );
    expect(error?.name).toBe('SyntaxError');
    expect(error.message).toMatch(/not valid JSON/i);
  });

  it('propagates network failures encountered by fetch', async () => {
    const targetUrl = 'https://workspace.example/network-error';
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(fetcher.fetch(targetUrl)).rejects.toThrow(
      /fetch failed|ECONNREFUSED/
    );

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
