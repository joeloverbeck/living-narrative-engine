import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fetchWithRetry } from '../../../src/utils/httpUtils.js';

jest.useFakeTimers();

let dispatcher;

const mockResponse = (status, body, ok = true, headersObj = {}) => ({
  ok,
  status,
  statusText: `HTTP ${status}`,
  headers: { get: (h) => headersObj[h] },
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn(),
});

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

describe('fetchWithRetry helper scenarios', () => {
  const url = 'https://api.test.local';
  const opts = { method: 'GET' };

  test('returns data on first success', async () => {
    const resp = mockResponse(200, { ok: true }, true);
    fetch.mockResolvedValueOnce(resp);

    const result = await fetchWithRetry(
      url,
      opts,
      2,
      100,
      1000,
      dispatcher,
      undefined,
      fetch
    );

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('retries HTTP error then succeeds', async () => {
    const first = mockResponse(500, { msg: 'oops' }, false, {}, true);
    first.json.mockResolvedValue({ msg: 'oops' });
    const okResp = mockResponse(200, { ok: true }, true, {}, true);
    okResp.json.mockResolvedValue({ ok: true });
    fetch.mockResolvedValueOnce(first).mockResolvedValueOnce(okResp);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = fetchWithRetry(
      url,
      opts,
      2,
      100,
      1000,
      dispatcher,
      undefined,
      fetch
    );
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });

    timeoutSpy.mockRestore();
    randomSpy.mockRestore();
  });

  test('retries network error then succeeds', async () => {
    const success = mockResponse(200, { ok: true });
    fetch
      .mockRejectedValueOnce(new TypeError('network request failed'))
      .mockResolvedValueOnce(success);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = fetchWithRetry(
      url,
      opts,
      2,
      100,
      1000,
      dispatcher,
      undefined,
      fetch
    );
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });

    randomSpy.mockRestore();
    timeoutSpy.mockRestore();
  });
});
