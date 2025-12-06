import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';
import { ensureValidLogger } from '../../src/utils/loggerUtils.js';

const basePayload = {
  model: 'gpt-edge',
  messages: [{ role: 'user', content: 'ping' }],
  temperature: 0.42,
};

const llmId = 'edge-llm';

describe('ResponseSalvageService edge case integration coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('throws descriptive error when constructed without a logger', () => {
    expect(() => new ResponseSalvageService(undefined)).toThrow(
      'ResponseSalvageService: logger is required'
    );
  });

  test('gracefully handles salvage entries missing request identifiers', () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'clearImmediate'] });

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const fallbackLogger = ensureValidLogger(undefined, 'SalvageEdge');
    const salvageService = new ResponseSalvageService(fallbackLogger, {
      defaultTtl: 100,
    });

    salvageService.salvageResponse(
      '',
      llmId,
      basePayload,
      { payload: 'blank-request-id' },
      207,
      100
    );

    expect(debugSpy).toHaveBeenCalledWith(
      'SalvageEdge: ',
      'ResponseSalvageService: Instance created',
      expect.objectContaining({ defaultTtl: 100 })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      'SalvageEdge: ',
      expect.stringContaining('Salvaged response for request'),
      expect.objectContaining({ statusCode: 207 })
    );

    const signatureLookup = salvageService.retrieveBySignature(
      llmId,
      basePayload
    );
    expect(signatureLookup).toEqual(
      expect.objectContaining({
        fromCache: true,
        requestId: '',
        statusCode: 207,
      })
    );

    const stats = salvageService.getStats();
    expect(stats).toEqual({
      salvaged: 0,
      totalCacheEntries: 2,
      activeTimers: 1,
    });

    jest.advanceTimersByTime(150);

    expect(salvageService.retrieveBySignature(llmId, basePayload)).toBeNull();
    expect(salvageService.retrieveByRequestId('')).toBeNull();

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });

    salvageService.cleanup();
  });
});
