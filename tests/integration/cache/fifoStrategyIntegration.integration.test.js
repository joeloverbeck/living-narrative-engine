/**
 * @file Integration tests ensuring FIFO cache strategy works with cache infrastructure services
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import {
  UnifiedCache,
  EvictionPolicy,
} from '../../../src/cache/UnifiedCache.js';
import { CacheInvalidationManager } from '../../../src/cache/CacheInvalidationManager.js';
import { CacheMetrics } from '../../../src/cache/CacheMetrics.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';

const DATA_REGISTRY_METHODS = [
  'getWorldDefinition',
  'getAllWorldDefinitions',
  'getStartingPlayerId',
  'getStartingLocationId',
  'getActionDefinition',
  'getAllActionDefinitions',
  'getEntityDefinition',
  'getAllEntityDefinitions',
  'getEventDefinition',
  'getAllEventDefinitions',
  'getComponentDefinition',
  'getAllComponentDefinitions',
  'getConditionDefinition',
  'getAllConditionDefinitions',
  'getGoalDefinition',
  'getAllGoalDefinitions',
  'getEntityInstanceDefinition',
  'getAllEntityInstanceDefinitions',
  'get',
  'getAll',
  'clear',
  'store',
];

describe('FIFO cache strategy integration', () => {
  let testBed;
  let mockLogger;
  let mockSchemaValidator;
  let mockDataRegistry;
  let eventBus;
  let validatedEventDispatcher;
  let cacheInvalidationManager;
  let cacheMetrics;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockSchemaValidator = testBed.createMockValidator();
    mockDataRegistry = testBed.createMock(
      'dataRegistry',
      DATA_REGISTRY_METHODS
    );

    eventBus = new EventBus({ logger: mockLogger });
    const gameDataRepository = new GameDataRepository(
      mockDataRegistry,
      mockLogger
    );
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    cacheInvalidationManager = new CacheInvalidationManager({
      logger: mockLogger,
      validatedEventDispatcher,
    });

    cacheMetrics = new CacheMetrics(
      {
        logger: mockLogger,
      },
      {
        enableAutoCollection: false,
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    testBed.cleanup();
  });

  it('should coordinate FIFO eviction, ordering, and metrics across cache services', () => {
    const fifoCache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 3,
        ttl: 500,
        evictionPolicy: EvictionPolicy.FIFO,
        maxMemoryUsage: 1024,
        enableMetrics: true,
      }
    );

    cacheInvalidationManager.registerCache('fifo-cache', fifoCache, {
      entityTypes: ['actor'],
      description: 'FIFO entity cache',
    });
    cacheMetrics.registerCache('fifo-cache', fifoCache, {
      description: 'FIFO cache metrics',
      type: 'fifo',
    });

    fifoCache.set('fifo:1', 'alpha');
    fifoCache.set('fifo:2', { order: 2 });
    fifoCache.set('fifo:3', ['x', 'y', 'z']);
    fifoCache.set('fifo:2', { order: 2, updated: true });

    const circular = {};
    circular.self = circular;
    fifoCache.set('fifo:4', circular);

    expect(fifoCache.has('fifo:1')).toBe(false);
    expect(fifoCache.get('fifo:1')).toBeUndefined();

    fifoCache.get('fifo:2');
    fifoCache.get('missing:key');

    const keysInOrder = fifoCache.getKeys();
    expect(keysInOrder).toEqual(['fifo:3', 'fifo:2', 'fifo:4']);

    const entriesInOrder = fifoCache.getEntries();
    expect(entriesInOrder.map(([key]) => key)).toEqual(keysInOrder);
    expect(entriesInOrder[0][1]).toEqual(['x', 'y', 'z']);

    fifoCache.delete('fifo:3');
    expect(fifoCache.getKeys()).toEqual(['fifo:2', 'fifo:4']);

    fifoCache.set('fifo:5', 'omega');
    expect(fifoCache.getKeys()).toEqual(['fifo:2', 'fifo:4', 'fifo:5']);

    const snapshot = cacheMetrics.collectCacheMetrics('fifo-cache');
    expect(snapshot.strategyName).toBe('FIFO');
    expect(snapshot.insertionStats.insertionOrder).toEqual([
      'fifo:2',
      'fifo:4',
      'fifo:5',
    ]);
    expect(snapshot.insertionStats.oldestKey).toBe('fifo:2');
    expect(snapshot.insertionStats.newestKey).toBe('fifo:5');
    expect(snapshot.memorySize).toBeGreaterThan(0);
    expect(snapshot.stats.hits).toBe(1);
    expect(snapshot.stats.misses).toBe(2);

    const aggregated = cacheMetrics.getAggregatedMetrics();
    expect(aggregated.strategyDistribution.FIFO).toBeGreaterThan(0);
    expect(aggregated.caches['fifo-cache'].strategy).toBe('FIFO');
  });

  it('should expire entries via TTL and support pruning and invalidation workflows', () => {
    jest.useFakeTimers();

    const shortLivedCache = new UnifiedCache(
      { logger: mockLogger },
      {
        maxSize: 5,
        ttl: 50,
        evictionPolicy: EvictionPolicy.FIFO,
        updateAgeOnGet: false,
        enableMetrics: true,
      }
    );

    cacheInvalidationManager.registerCache('fifo-short', shortLivedCache, {
      description: 'Short lived FIFO cache',
    });
    cacheMetrics.registerCache('fifo-short', shortLivedCache, {
      description: 'Short lived FIFO cache',
      type: 'fifo-short',
    });

    shortLivedCache.set('ttl:keep', { stable: true }, { ttl: 100 });
    shortLivedCache.set('ttl:expire', 'bye', { ttl: 30 });

    jest.advanceTimersByTime(40);
    expect(shortLivedCache.has('ttl:expire')).toBe(false);

    shortLivedCache.set('ttl:refresh', 'value');
    jest.advanceTimersByTime(61);

    expect(shortLivedCache.get('ttl:refresh')).toBeUndefined();

    const pruned = shortLivedCache.prune();
    expect(pruned).toBeGreaterThanOrEqual(1);
    expect(shortLivedCache.has('ttl:keep')).toBe(false);

    shortLivedCache.set('ttl:pattern', 'match');
    const patternResults = cacheInvalidationManager.invalidatePattern(
      'ttl:pattern',
      ['fifo-short']
    );
    expect(patternResults['fifo-short'].invalidated).toBe(1);

    shortLivedCache.set('ttl:a', 'a');
    shortLivedCache.set('ttl:b', 'b');
    const aggressive = shortLivedCache.prune(true);
    expect(aggressive).toBe(2);
    expect(shortLivedCache.getKeys()).toHaveLength(0);

    const memoryUsage = shortLivedCache.getMemoryUsage();
    expect(memoryUsage.currentBytes).toBe(0);
    expect(memoryUsage.utilizationPercent).toBeNull();

    const metricsAfterClear = cacheMetrics.collectCacheMetrics('fifo-short');
    expect(metricsAfterClear.strategyName).toBe('FIFO');
    expect(metricsAfterClear.insertionStats.insertionOrder).toEqual([]);
    expect(metricsAfterClear.insertionStats.averageAge).toBe(0);
  });
});
