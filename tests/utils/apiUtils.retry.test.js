import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Workspace_retry } from '../../src/utils/apiUtils.js';

jest.useFakeTimers();

const mockResponse = (status, body, ok = false, headersObj = {}) => {
  const headers = { get: (h) => headersObj[h] };
  return {
    ok,
    status,
    statusText: `HTTP ${status}`,
    headers,
    json: jest.fn(),
    text: jest.fn(),
  };
};

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
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
      await Workspace_retry(url, opts, 1, 1, 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.status).toBe(400);
    expect(caught.body).toEqual(body);
  });

  test('falls back to text body for HTTP errors', async () => {
    const resp = mockResponse(400, 'bad text', false, {}, false);
    resp.json.mockRejectedValue(new Error('no json'));
    resp.text.mockResolvedValue('bad text');
    fetch.mockResolvedValueOnce(resp);

    const err = await Workspace_retry(url, opts, 1, 1, 1).catch((e) => e);
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
    const promise = Workspace_retry(url, opts, 2, 100, 1000);
    await jest.runOnlyPendingTimersAsync();
    await promise;
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    timeoutSpy.mockRestore();
  });
});
