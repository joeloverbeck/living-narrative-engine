/**
 * @file Integration tests for CoreMotivationsCacheManager using production collaborators
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CoreMotivationsCacheManager from '../../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/events/characterBuilderEvents.js';
import EventBus from '../../../../src/events/eventBus.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';

class ProductionEventBusAdapter {
  #eventBus;
  #shouldThrowNext = false;

  /**
   * @param {ConsoleLogger} logger
   */
  constructor(logger) {
    this.#eventBus = new EventBus({ logger });
    this.events = [];

    this.#eventBus.subscribe('*', (event) => {
      this.events.push(event);
    });
  }

  failNextDispatch() {
    this.#shouldThrowNext = true;
  }

  dispatch(eventOrName, payload) {
    if (this.#shouldThrowNext) {
      this.#shouldThrowNext = false;
      throw new Error('Simulated dispatch failure');
    }

    if (typeof eventOrName === 'object' && eventOrName !== null) {
      return this.#eventBus.dispatch(eventOrName.type, eventOrName.payload);
    }

    return this.#eventBus.dispatch(eventOrName, payload);
  }
}

describe('CoreMotivationsCacheManager integration', () => {
  let logger;
  let eventBusAdapter;
  let cacheManager;
  let errorSpy;
  let warnSpy;
  let infoSpy;
  let debugSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    logger = new ConsoleLogger(LogLevel.DEBUG);
    errorSpy = jest.spyOn(logger, 'error');
    warnSpy = jest.spyOn(logger, 'warn');
    infoSpy = jest.spyOn(logger, 'info');
    debugSpy = jest.spyOn(logger, 'debug');

    eventBusAdapter = new ProductionEventBusAdapter(logger);
  });

  afterEach(() => {
    jest.useRealTimers();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('manages cache lifecycle with TTLs, invalidation, statistics, and resilient event dispatch', () => {
    eventBusAdapter.failNextDispatch();
    cacheManager = new CoreMotivationsCacheManager({
      logger,
      eventBus: eventBusAdapter,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to dispatch cache event',
      expect.any(Error)
    );

    cacheManager.set('concept-1', { id: 'concept-1' }, 'concepts', 50);

    const cachedValue = cacheManager.get('concept-1');
    expect(cachedValue).toEqual({ id: 'concept-1' });

    const hitEvent = eventBusAdapter.events.find(
      (event) =>
        event.type === CHARACTER_BUILDER_EVENTS.CACHE_HIT &&
        event.payload.key === 'concept-1'
    );
    expect(hitEvent).toBeDefined();

    const missResult = cacheManager.get('missing-key');
    expect(missResult).toBeNull();

    const missEvent = eventBusAdapter.events.find(
      (event) =>
        event.type === CHARACTER_BUILDER_EVENTS.CACHE_MISS &&
        event.payload.key === 'missing-key'
    );
    expect(missEvent).toBeDefined();

    jest.advanceTimersByTime(60);
    const expiredValue = cacheManager.get('concept-1');
    expect(expiredValue).toBeNull();
    expect(
      debugSpy.mock.calls.some((call) =>
        String(call[0]).includes('Cache expired for key: concept-1')
      )
    ).toBe(true);

    cacheManager.set('stale-entry', { id: 'stale-entry' }, 'concepts', 100);
    jest.advanceTimersByTime(150);
    const cleaned = cacheManager.cleanExpired();
    expect(cleaned).toBe(1);
    expect(
      debugSpy.mock.calls.some((call) =>
        String(call[0]).includes('Cleaned 1 expired cache entries')
      )
    ).toBe(true);

    cacheManager.set('default-ttl', { id: 'default-ttl' });

    cacheManager.set('dir-1', { id: 'dir-1' }, 'directions');
    cacheManager.set('dir-2', { id: 'dir-2' }, 'directions');
    cacheManager.set('mot-1', { id: 'mot-1' }, 'motivations');

    cacheManager.clearType('directions');
    expect(cacheManager.get('dir-1')).toBeNull();
    expect(
      infoSpy.mock.calls.some((call) =>
        String(call[0]).includes('Cleared 2 cache entries of type: directions')
      )
    ).toBe(true);

    cacheManager.set('concept-alpha', { id: 'concept-alpha' }, 'concepts');
    cacheManager.set('concept-beta', { id: 'concept-beta' }, 'concepts');
    cacheManager.set('cliche-1', { id: 'cliche-1' }, 'cliches');

    cacheManager.invalidatePattern(/^concept-/);
    expect(cacheManager.get('concept-alpha')).toBeNull();
    expect(
      debugSpy.mock.calls.some((call) =>
        String(call[0]).includes('Invalidated 2 cache entries matching pattern')
      )
    ).toBe(true);

    const motivation = cacheManager.get('mot-1');
    expect(motivation).toEqual({ id: 'mot-1' });

    const stats = cacheManager.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(2);
    expect(stats.misses).toBeGreaterThanOrEqual(2);
    expect(stats.entries.length).toBeGreaterThanOrEqual(2);
    expect(stats.byType.motivations.count).toBe(1);
    expect(stats.byType.motivations.hits).toBeGreaterThanOrEqual(1);
  });

  it('continues caching when schema validation fails and logs the warning', () => {
    const schemaValidator = {
      validateAgainstSchema: jest.fn(() => {
        throw new Error('Validation failed');
      }),
    };

    cacheManager = new CoreMotivationsCacheManager({
      logger,
      eventBus: eventBusAdapter,
      schemaValidator,
    });

    cacheManager.set('schema-key', { id: 'schema-key' }, 'concepts');

    expect(schemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
      { id: 'schema-key' },
      'core:concepts-cache-entry'
    );
    expect(
      warnSpy.mock.calls.some((call) =>
        String(call[0]).includes('Cache data validation failed for schema-key')
      )
    ).toBe(true);

    const value = cacheManager.get('schema-key');
    expect(value).toEqual({ id: 'schema-key' });
  });

  it('evicts the least recently used entry after exceeding capacity and emits eviction events', () => {
    cacheManager = new CoreMotivationsCacheManager({
      logger,
      eventBus: eventBusAdapter,
    });

    for (let index = 0; index < 100; index++) {
      cacheManager.set(`mot-${index}`, { id: `mot-${index}` }, 'motivations');
      jest.advanceTimersByTime(1);
    }

    cacheManager.set('mot-extra', { id: 'mot-extra' }, 'motivations');

    const evictionEvent = eventBusAdapter.events.find(
      (event) => event.type === CHARACTER_BUILDER_EVENTS.CACHE_EVICTED
    );
    expect(evictionEvent).toBeDefined();
    expect(evictionEvent.payload.key).toBe('mot-0');

    expect(
      debugSpy.mock.calls.some((call) =>
        String(call[0]).includes('Evicted LRU cache entry: mot-0')
      )
    ).toBe(true);

    expect(cacheManager.get('mot-0')).toBeNull();
    expect(cacheManager.get('mot-1')).toEqual({ id: 'mot-1' });

    const stats = cacheManager.getStats();
    expect(stats.size).toBe(100);
    expect(stats.evictions).toBeGreaterThanOrEqual(1);
  });
});
