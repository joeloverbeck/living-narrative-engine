import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Workspace_retry } from '../../src/utils/apiUtils.js';

jest.useFakeTimers();

let dispatcher;

const mockResponse = (
  status,
  body,
  ok = false,
  headersObj = {},
  withClone = false
) => {
  const headers = { get: (h) => headersObj[h] };
  const resp = {
    ok,
    status,
    statusText: `HTTP ${status}`,
    headers,
    json: jest.fn(),
    text: jest.fn(),
  };
  if (withClone) {
    const textValue = typeof body === 'string' ? body : JSON.stringify(body);
    resp.clone = jest.fn(() => ({
      text: jest.fn().mockResolvedValue(textValue),
    }));
  }
  return resp;
};

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

describe('Workspace_retry', () => {
  const url = 'https://api.test.local';
  const opts = { method: 'GET' };

  test('parses JSON body for HTTP errors', async () => {
    const body = { error: 'bad' };
    const resp = mockResponse(400, body, false, {}, true);
    resp.json.mockResolvedValue(body);
    fetch.mockResolvedValueOnce(resp);

    let caught;
    try {
      await Workspace_retry(url, opts, 1, 1, 1, dispatcher);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.status).toBe(400);
    expect(caught.body).toEqual(body);
  });

  test('falls back to text body for HTTP errors', async () => {
    const resp = mockResponse(400, 'bad text', false, {}, true);
    resp.json.mockRejectedValue(new Error('no json'));
    resp.text.mockResolvedValue('bad text');
    fetch.mockResolvedValueOnce(resp);

    const err = await Workspace_retry(url, opts, 1, 1, 1, dispatcher).catch(
      (e) => e
    );
    expect(err.body).toBe('bad text');
  });

  test('uses Retry-After header for 429 delays', async () => {
    const first = mockResponse(
      429,
      { retry: true },
      false,
      { 'Retry-After': '2' },
      true
    );
    first.json.mockResolvedValue({});
    const okResp = mockResponse(200, { ok: true }, true, {}, true);
    okResp.json.mockResolvedValue({ ok: true });
    fetch.mockResolvedValueOnce(first).mockResolvedValueOnce(okResp);

    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const promise = Workspace_retry(url, opts, 2, 100, 1000, dispatcher);
    await jest.runOnlyPendingTimersAsync();
    await promise;
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    timeoutSpy.mockRestore();
  });

  test('reads error body using response.clone when JSON parse fails', async () => {
    const cloneText = jest.fn().mockResolvedValue('detailed error');
    const resp = {
      ok: false,
      status: 500,
      statusText: 'HTTP 500',
      headers: { get: () => undefined },
      json: jest.fn().mockRejectedValue(new Error('bad json')),
      text: jest.fn().mockRejectedValue(new Error('body used')),
      clone: jest.fn(() => ({ text: cloneText })),
    };
    fetch.mockResolvedValueOnce(resp);

    const err = await Workspace_retry(url, opts, 1, 1, 1, dispatcher).catch(
      (e) => e
    );

    expect(resp.clone).toHaveBeenCalled();
    expect(cloneText).toHaveBeenCalled();
    expect(err.body).toBe('detailed error');
  });
});
