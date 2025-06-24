import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { RetryManager } from '../../../src/utils/httpRetryManager.js';

jest.useFakeTimers();

describe('RetryManager', () => {
  let logger;

  beforeEach(() => {
    logger = { warn: jest.fn(), debug: jest.fn() };
  });

  test('retries network error then succeeds', async () => {
    const manager = new RetryManager(2, 100, 1000, logger);
    const attemptFn = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('network request failed'))
      .mockResolvedValueOnce('ok');
    const responseHandler = jest
      .fn()
      .mockResolvedValue({ retry: false, data: 'ok' });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const promise = manager.perform(attemptFn, responseHandler);
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(attemptFn).toHaveBeenCalledTimes(2);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    timeoutSpy.mockRestore();
    randomSpy.mockRestore();
  });

  test('throws after persistent network errors', async () => {
    const manager = new RetryManager(2, 50, 1000, logger);
    const attemptFn = jest
      .fn()
      .mockRejectedValue(new TypeError('network request failed'));
    const responseHandler = jest.fn();

    const promise = manager.perform(attemptFn, responseHandler).catch((e) => e);
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    const err = await promise;

    expect(err).toBeInstanceOf(Error);
    expect(attemptFn).toHaveBeenCalledTimes(2);
  });

  test('uses response handler retry signal', async () => {
    const manager = new RetryManager(3, 10, 100, logger);
    const attemptFn = jest.fn().mockResolvedValue('resp');
    const responseHandler = jest
      .fn()
      .mockResolvedValueOnce({ retry: true })
      .mockResolvedValueOnce({ retry: false, data: 'done' });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const promise = manager.perform(attemptFn, responseHandler);
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(result).toBe('done');
    expect(attemptFn).toHaveBeenCalledTimes(2);
    randomSpy.mockRestore();
  });
});
