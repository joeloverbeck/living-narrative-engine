import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { RetryManager } from '../../../src/utils/proxyApiUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createResponse = ({ ok, status, jsonData, textData }) => {
  const response = {
    ok,
    status,
    statusText: `HTTP ${status}`,
    json: jest.fn(),
    text: jest.fn(),
  };

  if (jsonData !== undefined) {
    response.json.mockResolvedValue(jsonData);
  } else {
    response.json.mockRejectedValue(new Error('no json body'));
  }

  if (textData !== undefined) {
    response.text.mockResolvedValue(textData);
  } else {
    response.text.mockResolvedValue('');
  }

  return response;
};

describe('RetryManager jitter boundaries', () => {
  let logger;
  let mathRandomSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createLogger();
    global.fetch = jest.fn();
    jest.spyOn(global, 'setTimeout');
    mathRandomSpy = jest.spyOn(Math, 'random');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('applies maximum positive jitter even when capped by maxDelayMs', async () => {
    const retryableErrorBody = { error: 'temporary' };
    const failureResponse = createResponse({
      ok: false,
      status: 503,
      jsonData: retryableErrorBody,
    });
    const successResponse = createResponse({
      ok: true,
      status: 200,
      jsonData: { ok: true },
    });

    fetch
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(successResponse);

    mathRandomSpy.mockReturnValue(1); // force +20% jitter

    const manager = new RetryManager(
      'https://api.example.com/data',
      { method: 'GET' },
      4,
      100,
      150,
      logger
    );

    const resultPromise = manager.executeWithRetry();

    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();

    const result = await resultPromise;
    expect(result).toEqual({ ok: true });

    expect(setTimeout).toHaveBeenCalledTimes(2);
    expect(setTimeout.mock.calls[0][1]).toBe(120); // base 100 with +20% jitter
    expect(setTimeout.mock.calls[1][1]).toBe(180); // capped at 150 then +20%
  });

  test('never schedules negative waits when jitter pushes below zero', async () => {
    const failureResponse = createResponse({
      ok: false,
      status: 503,
      jsonData: { error: 'temporary' },
    });
    const successResponse = createResponse({
      ok: true,
      status: 200,
      jsonData: { ok: true },
    });

    fetch
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(successResponse);

    mathRandomSpy.mockReturnValue(0); // force -20% jitter

    const manager = new RetryManager(
      'https://api.example.com/data',
      { method: 'GET' },
      3,
      1,
      1,
      logger
    );

    const resultPromise = manager.executeWithRetry();

    await jest.runOnlyPendingTimersAsync();

    const result = await resultPromise;
    expect(result).toEqual({ ok: true });

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout.mock.calls[0][1]).toBe(0);
  });
});
