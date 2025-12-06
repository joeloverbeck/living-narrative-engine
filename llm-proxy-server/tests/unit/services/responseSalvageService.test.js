import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ResponseSalvageService } from '../../../src/services/responseSalvageService.js';
import { SALVAGE_DEFAULT_TTL } from '../../../src/config/constants.js';

describe('ResponseSalvageService', () => {
  let logger;
  let service;

  const basePayload = {
    model: 'gpt-test',
    messages: [{ role: 'user', content: 'hi' }],
    temperature: 0.7,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new ResponseSalvageService(logger, { defaultTtl: 5_000 });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('constructor requires a logger', () => {
    expect(() => new ResponseSalvageService()).toThrow(
      'ResponseSalvageService: logger is required'
    );
  });

  test('salvageResponse caches entry retrievable by requestId and signature', () => {
    const payload = { ...basePayload };
    const responseData = { data: 'ok' };

    service.salvageResponse(
      'req-1',
      'llm-a',
      payload,
      responseData,
      202,
      10_000
    );

    const byId = service.retrieveByRequestId('req-1');
    expect(byId).toEqual(
      expect.objectContaining({
        responseData,
        statusCode: 202,
        requestId: 'req-1',
        llmId: 'llm-a',
      })
    );

    const bySignature = service.retrieveBySignature('llm-a', payload);
    expect(bySignature).toEqual(
      expect.objectContaining({
        responseData,
        statusCode: 202,
        requestId: 'req-1',
        llmId: 'llm-a',
        fromCache: true,
      })
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Salvaged response for request req-1'),
      expect.objectContaining({ requestId: 'req-1', statusCode: 202 })
    );
  });

  test('re-salvaging the same request clears the previous timer', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');

    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      1_000
    );
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: false },
      200,
      1_000
    );

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  test('uses default TTL when none is provided', () => {
    const fallbackLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const fallbackService = new ResponseSalvageService(fallbackLogger);

    fallbackService.salvageResponse(
      'req-default',
      'llm-a',
      basePayload,
      { ok: true },
      200
    );

    jest.setSystemTime(1_000 + SALVAGE_DEFAULT_TTL + 5);

    expect(fallbackService.retrieveByRequestId('req-default')).toBeNull();
    expect(fallbackLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Expired salvaged response for request req-default'
      ),
      expect.objectContaining({ requestId: 'req-default' })
    );
  });

  test('retrieveByRequestId expires entries past TTL', () => {
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      100
    );

    jest.advanceTimersByTime(150);

    const result = service.retrieveByRequestId('req-1');
    expect(result).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Expired salvaged response for request req-1'),
      expect.objectContaining({ requestId: 'req-1' })
    );
  });

  test('retrieveByRequestId purges stale entries on access', () => {
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      1_000
    );

    jest.setSystemTime(3_500);

    const result = service.retrieveByRequestId('req-1');
    expect(result).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Expired salvaged response for request req-1'),
      expect.objectContaining({ requestId: 'req-1' })
    );
  });

  test('retrieveBySignature removes expired entries and returns null', () => {
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      100
    );

    jest.advanceTimersByTime(200);

    const result = service.retrieveBySignature('llm-a', basePayload);
    expect(result).toBeNull();
  });

  test('retrieveBySignature purges stale entries on access', () => {
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      1_000
    );

    jest.setSystemTime(3_500);

    const result = service.retrieveBySignature('llm-a', basePayload);
    expect(result).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Expired salvaged response for request req-1'),
      expect.objectContaining({ requestId: 'req-1' })
    );
  });

  test('getStats returns counts of cached entries and timers', () => {
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      5_000
    );
    service.salvageResponse(
      'req-2',
      'llm-b',
      basePayload,
      { ok: false },
      200,
      5_000
    );

    const stats = service.getStats();

    expect(stats).toEqual(
      expect.objectContaining({
        salvaged: 2,
        totalCacheEntries: 4,
        activeTimers: 2,
      })
    );
  });

  test('getStats handles empty cache state', () => {
    const freshService = new ResponseSalvageService(logger, {
      defaultTtl: 5_000,
    });

    const stats = freshService.getStats();

    expect(stats).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });
  });

  test('getStats ignores entries without valid request identifiers', () => {
    service.salvageResponse('', 'llm-a', basePayload, { ok: true }, 200, 5_000);

    const stats = service.getStats();

    expect(stats.salvaged).toBe(0);
    expect(stats.totalCacheEntries).toBe(2);
    expect(stats.activeTimers).toBe(1);
  });

  test('clear removes timers and cache entries', () => {
    service.salvageResponse(
      'req-1',
      'llm-a',
      basePayload,
      { ok: true },
      200,
      5_000
    );
    service.clear();

    expect(service.retrieveByRequestId('req-1')).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      'ResponseSalvageService: Cleared all salvaged responses'
    );
  });

  test('cleanup delegates to clear and logs completion', () => {
    const clearSpy = jest.spyOn(service, 'clear');

    service.cleanup();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'ResponseSalvageService: Cleanup complete'
    );
  });
});
