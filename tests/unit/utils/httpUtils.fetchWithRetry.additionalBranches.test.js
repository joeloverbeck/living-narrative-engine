import {
  beforeEach,
  afterEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { fetchWithRetry } from '../../../src/utils/httpUtils.js';
import { RetryManager } from '../../../src/utils/httpRetryManager.js';

let dispatcher;

/**
 *
 * @param status
 * @param body
 * @param ok
 * @param headersObj
 * @param withClone
 */
function mockResponse(
  status,
  body,
  ok = false,
  headersObj = {},
  withClone = false
) {
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
}

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  jest.clearAllMocks();
  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('fetchWithRetry additional branch coverage', () => {
  const url = 'https://api.test.local';
  const opts = { method: 'GET' };

  test('falls back to computed delay when Retry-After header is invalid', async () => {
    const first = mockResponse(
      429,
      { msg: 'rate' },
      false,
      { 'Retry-After': 'NaN' },
      true
    );
    first.json.mockResolvedValue({});
    const okResp = mockResponse(200, { ok: true }, true, {}, true);
    okResp.json.mockResolvedValue({ ok: true });
    const calcSpy = jest
      .spyOn(RetryManager, 'calculateRetryDelay')
      .mockReturnValue(150);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    fetch.mockResolvedValueOnce(first).mockResolvedValueOnce(okResp);

    const promise = fetchWithRetry(
      url,
      opts,
      2,
      100,
      200,
      dispatcher,
      undefined,
      fetch
    );
    await jest.runOnlyPendingTimersAsync();
    await promise;

    expect(calcSpy).toHaveBeenCalledWith(1, 100, 200);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 150);
    expect(fetch).toHaveBeenCalledTimes(2);

    calcSpy.mockRestore();
    timeoutSpy.mockRestore();
  });

  test('handles network error with "Failed to fetch" message', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const dispatchSpy = jest.spyOn(dispatcher, 'dispatch');

    const err = await fetchWithRetry(
      url,
      opts,
      1,
      100,
      100,
      dispatcher,
      undefined,
      fetch
    ).catch((e) => e);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object)
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/persistent network error/);
  });
});
