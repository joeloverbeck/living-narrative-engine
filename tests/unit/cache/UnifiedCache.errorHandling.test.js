/**
 * @file Additional coverage tests for UnifiedCache error handling paths
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('UnifiedCache - error handling coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should wrap strategy set errors in CacheError', async () => {
    const testBed = createTestBed();
    const mockLogger = testBed.mockLogger;
    const strategyError = new Error('strategy failure');
    let thrownError;

    await jest.isolateModulesAsync(async () => {
      const [
        strategyModule,
        { UnifiedCache },
        { CacheError: CacheErrorClass },
      ] = await Promise.all([
        import('../../../src/cache/strategies/LRUStrategy.js'),
        import('../../../src/cache/UnifiedCache.js'),
        import('../../../src/errors/cacheError.js'),
      ]);

      const setSpy = jest
        .spyOn(strategyModule.LRUStrategy.prototype, 'set')
        .mockImplementation(() => {
          throw strategyError;
        });

      try {
        const cache = new UnifiedCache(
          { logger: mockLogger },
          { evictionPolicy: 'lru' }
        );
        cache.set('key', 'value');
      } catch (error) {
        thrownError = error;
      } finally {
        setSpy.mockRestore();
      }

      expect(thrownError).toBeInstanceOf(CacheErrorClass);
    });

    expect(thrownError).toBeDefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to set cache value for key: key'),
      strategyError
    );
  });

  it('should throw InvalidArgumentError when unsupported strategies reach creation', async () => {
    const testBed = createTestBed();
    const mockLogger = testBed.mockLogger;

    await jest.isolateModulesAsync(async () => {
      const originalValues = Object.values;
      let evictionPolicyReference;

      const valuesSpy = jest
        .spyOn(Object, 'values')
        .mockImplementation((target) => {
          if (target === evictionPolicyReference) {
            return [...originalValues(target), 'unsupported'];
          }
          return originalValues(target);
        });

      try {
        const [
          { UnifiedCache, EvictionPolicy },
          { InvalidArgumentError: InvalidArgumentErrorClass },
        ] = await Promise.all([
          import('../../../src/cache/UnifiedCache.js'),
          import('../../../src/errors/invalidArgumentError.js'),
        ]);
        evictionPolicyReference = EvictionPolicy;

        expect(() => {
          new UnifiedCache(
            { logger: mockLogger },
            { evictionPolicy: 'unsupported' }
          );
        }).toThrow(InvalidArgumentErrorClass);
      } finally {
        valuesSpy.mockRestore();
      }
    });
  });
});
