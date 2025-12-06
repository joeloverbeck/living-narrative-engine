import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import {
  CacheInvalidationManager,
  CacheInvalidationEvents,
} from '../../../src/cache/CacheInvalidationManager.js';

/**
 * @file Additional unit tests exercising configuration specific branches of CacheInvalidationManager.
 */
describe('CacheInvalidationManager configuration coverage', () => {
  let testBed;
  let logger;
  let dispatcher;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
    dispatcher = testBed.createMock('validatedEventDispatcher', ['dispatch']);
  });

  const createCache = () =>
    testBed.createMock('cache', ['invalidate', 'clear']);

  it('skips dependency tracking operations when disabled', () => {
    const manager = new CacheInvalidationManager(
      { logger, validatedEventDispatcher: dispatcher },
      { enableDependencyTracking: false }
    );
    const cache = createCache();
    cache.invalidate.mockReturnValue(1);

    manager.registerCache('cache-disabled', cache);

    // These would throw if dependency tracking logic executed.
    expect(() =>
      manager.addDependency('entity:1', 'missing-cache')
    ).not.toThrow();
    expect(() =>
      manager.removeDependency('entity:1', 'cache-disabled')
    ).not.toThrow();

    expect(manager.getDependencyMappings()).toEqual({});

    manager.invalidateEntity('entity:1');
    const stats = manager.getStats();
    expect(stats.dependenciesResolved).toBe(0);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CacheInvalidationEvents.CACHE_ENTITY_INVALIDATION,
      })
    );
  });

  it('honours enableEventIntegration flag when disabled', () => {
    const manager = new CacheInvalidationManager(
      { logger, validatedEventDispatcher: dispatcher },
      { enableEventIntegration: false, batchInvalidationDelay: 250 }
    );

    const stats = manager.getStats();
    expect(stats.eventListeners).toBe(0);
    expect(stats.config.batchInvalidationDelay).toBe(250);
  });

  it('registers event listeners when integration is enabled', () => {
    const manager = new CacheInvalidationManager({
      logger,
      validatedEventDispatcher: dispatcher,
    });

    const stats = manager.getStats();
    expect(stats.eventListeners).toBeGreaterThanOrEqual(5);
  });

  it('resolves dependency driven invalidations and updates statistics', () => {
    const primaryCache = createCache();
    const otherCache = createCache();
    primaryCache.invalidate.mockReturnValue(3);
    otherCache.invalidate.mockReturnValue(2);

    const manager = new CacheInvalidationManager({
      logger,
      validatedEventDispatcher: dispatcher,
    });

    manager.registerCache('primary', primaryCache, { entityTypes: ['actor'] });
    manager.registerCache('other', otherCache, { entityTypes: ['item'] });
    manager.addDependency('actor:42', 'primary');

    const result = manager.invalidateEntity('actor:42', ['other']);

    expect(otherCache.invalidate).toHaveBeenCalledWith(expect.any(RegExp));
    expect(primaryCache.invalidate).toHaveBeenCalledWith(expect.any(RegExp));
    expect(result.primary).toEqual({ success: true, invalidated: 3 });

    const stats = manager.getStats();
    expect(stats.dependenciesResolved).toBeGreaterThan(0);
  });

  it('cleans caches, dependency mappings and event listeners on destroy', () => {
    const cacheA = createCache();
    cacheA.invalidate.mockReturnValue(1);

    const manager = new CacheInvalidationManager({
      logger,
      validatedEventDispatcher: dispatcher,
    });

    manager.registerCache('cache-a', cacheA, { entityTypes: ['actor'] });
    manager.addDependency('actor:destroy', 'cache-a');

    // Calling destroy should clear the internal data structures.
    manager.destroy();

    expect(manager.getRegisteredCaches()).toHaveLength(0);
    expect(manager.getDependencyMappings()).toEqual({});
    expect(manager.getStats().eventListeners).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('CacheInvalidationManager destroyed')
    );
  });
});
