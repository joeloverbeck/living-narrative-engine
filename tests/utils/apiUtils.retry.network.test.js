import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Workspace_retry } from '../../src/utils/apiUtils.js';

jest.useFakeTimers();

const mockResponse = (status, body, ok = true) => ({
  ok,
  status,
  statusText: `HTTP ${status}`,
  headers: { get: () => undefined },
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn(),
});

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
});

describe('Workspace_retry network errors', () => {
  const url = 'https://api.test.local';
  const opts = { method: 'GET' };

  test('retries network errors and succeeds', async () => {
    const success = mockResponse(200, { ok: true });
    fetch
      .mockRejectedValueOnce(new TypeError('network request failed'))
      .mockResolvedValueOnce(success);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const promise = Workspace_retry(url, opts, 2, 100, 1000);
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });

    randomSpy.mockRestore();
    timeoutSpy.mockRestore();
  });

  test('throws after persistent network errors', async () => {
    fetch.mockRejectedValue(new TypeError('network request failed'));
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const promise = Workspace_retry(url, opts, 2, 100, 1000).catch((e) => e);
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    const err = await promise;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch('persistent network error');

    randomSpy.mockRestore();
  });
});
