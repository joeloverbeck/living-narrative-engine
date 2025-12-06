import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  CacheInvalidationManager,
  CacheInvalidationEvents,
} from '../../../src/cache/CacheInvalidationManager.js';
import { UnifiedCache } from '../../../src/cache/UnifiedCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { createTestBed } from '../../common/testBed.js';

/**
 * @file Additional integration tests for CacheInvalidationManager
 * Focuses on dependency-driven invalidation, pattern error handling,
 * lifecycle cleanup, and dispatch error resilience using real cache instances.
 */

describe('CacheInvalidationManager integration: event-driven flows', () => {
  let testBed;
  let logger;
  let eventLog;
  let dispatcher;

  const createManager = (config = {}) =>
    new CacheInvalidationManager(
      { logger, validatedEventDispatcher: dispatcher },
      config
    );

  const createCache = (config = {}) =>
    new UnifiedCache(
      { logger },
      { enableMetrics: true, maxSize: 100, ...config }
    );

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();
    eventLog = [];
    dispatcher = {
      dispatch: jest.fn().mockImplementation((event) => {
        eventLog.push(event);
        return Promise.resolve(true);
      }),
    };
  });

  afterEach(() => {
    testBed.cleanup();
    eventLog = [];
  });

  it('should cascade entity invalidations to dependent caches', () => {
    const manager = createManager();
    const primaryCache = createCache();
    const dependentCache = createCache();
    const fragileCache = createCache();

    manager.registerCache('primary', primaryCache, {
      entityTypes: ['hero'],
      componentTypes: ['inventory'],
      keyPatterns: ['hero:'],
    });
    manager.registerCache('dependent', dependentCache, {
      componentTypes: ['inventory'],
      entityTypes: ['hero'],
    });
    manager.registerCache('fragile', fragileCache, {
      componentTypes: ['inventory'],
      entityTypes: ['hero'],
    });

    primaryCache.set('hero:entity', { id: 'hero:entity', value: 1 });
    dependentCache.set('hero:entity:summary', {
      id: 'hero:entity',
      summary: true,
    });
    fragileCache.set('hero:entity:secondary', {
      id: 'hero:entity',
      fragment: true,
    });

    manager.addDependency('hero:entity', 'dependent');
    jest.spyOn(fragileCache, 'invalidate').mockImplementation(() => {
      throw new Error('dependency invalidation failed');
    });
    manager.addDependency('hero:entity', 'fragile');

    const results = manager.invalidateEntity('hero:entity', ['primary']);

    expect(results.primary).toMatchObject({ success: true, invalidated: 1 });
    expect(results.dependent).toMatchObject({ success: true, invalidated: 1 });
    expect(results.fragile.success).toBe(false);
    expect(results.fragile.error).toBe('dependency invalidation failed');
    expect(primaryCache.get('hero:entity')).toBeUndefined();
    expect(dependentCache.get('hero:entity:summary')).toBeUndefined();

    const entityInvalidations = eventLog.filter(
      (event) =>
        event.type === CacheInvalidationEvents.CACHE_ENTITY_INVALIDATION
    );
    expect(entityInvalidations).toHaveLength(1);

    const stats = manager.getStats();
    expect(stats.invalidationsProcessed).toBeGreaterThanOrEqual(1);
    expect(stats.dependenciesResolved).toBe(1);
    expect(stats.eventListeners).toBeGreaterThan(0);
  });

  it('should handle missing caches and cache errors during pattern invalidation', () => {
    const manager = createManager();
    const primaryCache = createCache();
    const failingCache = createCache();

    primaryCache.set('hero:entity', { id: 'hero:entity' });
    failingCache.set('hero:aux', { id: 'hero:aux' });

    manager.registerCache('primary', primaryCache);
    manager.registerCache('failing', failingCache);

    jest.spyOn(failingCache, 'invalidate').mockImplementation(() => {
      throw new Error('failure during invalidate');
    });

    const results = manager.invalidatePattern('hero', [
      'primary',
      'missing',
      'failing',
    ]);

    expect(results.primary).toMatchObject({ success: true, invalidated: 1 });
    expect(results.failing.success).toBe(false);
    expect(results.failing.error).toBe('failure during invalidate');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Cache not found for pattern invalidation: missing'
      )
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Pattern invalidation failed in failing'),
      expect.any(Error)
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CacheInvalidationEvents.CACHE_PATTERN_INVALIDATION,
      })
    );
  });

  it('should clear caches, report errors, and destroy resources cleanly', () => {
    const manager = createManager();
    const primaryCache = createCache();
    const secondaryCache = createCache();
    const unstableCache = createCache();

    primaryCache.set('cache:key', { id: 1 });
    secondaryCache.set('other:key', { id: 2 });

    manager.registerCache('primary', primaryCache);
    manager.registerCache('secondary', secondaryCache);
    manager.registerCache('unstable', unstableCache);

    jest.spyOn(unstableCache, 'clear').mockImplementation(() => {
      throw new Error('clear failure');
    });

    const results = manager.clearCaches([
      'missing',
      'primary',
      'unstable',
      'secondary',
    ]);

    expect(results.primary).toEqual({ success: true });
    expect(results.secondary).toEqual({ success: true });
    expect(results.unstable.success).toBe(false);
    expect(results.unstable.error).toBe('clear failure');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cache not found for clearing: missing')
    );
    expect(primaryCache.get('cache:key')).toBeUndefined();
    expect(secondaryCache.get('other:key')).toBeUndefined();

    const stats = manager.getStats();
    expect(stats.cachesCleaned).toBe(2);
    expect(stats.registeredCaches).toBe(3);

    manager.destroy();

    expect(manager.getRegisteredCaches()).toHaveLength(0);
    expect(manager.getDependencyMappings()).toEqual({});
    expect(manager.getStats().eventListeners).toBe(0);
  });

  it('should manage dependency mapping lifecycle including removals', () => {
    const manager = createManager();
    const cache = createCache();

    manager.registerCache('primary', cache);
    manager.removeDependency('missing');

    manager.addDependency('hero:entity', 'primary');
    expect(manager.getDependencyMappings()).toEqual({
      'hero:entity': ['primary'],
    });

    manager.removeDependency('hero:entity', 'primary');
    expect(manager.getDependencyMappings()).toEqual({});

    manager.addDependency('hero:entity', 'primary');
    manager.removeDependency('hero:entity');
    expect(manager.getDependencyMappings()).toEqual({});

    expect(() => manager.addDependency('hero:entity', 'missing')).toThrow(
      InvalidArgumentError
    );

    manager.addDependency('hero:entity', 'primary');
    expect(manager.unregisterCache('primary')).toBe(true);
    expect(manager.getDependencyMappings()).toEqual({});
    expect(manager.unregisterCache('primary')).toBe(false);
  });

  it('should validate registration inputs and entity invalidation arguments', () => {
    const manager = createManager();
    const cache = createCache();

    expect(() => manager.registerCache('', cache)).toThrow(
      InvalidArgumentError
    );
    expect(() => manager.registerCache('valid')).toThrow(InvalidArgumentError);
    expect(() => manager.registerCache('invalid', {})).toThrow(
      InvalidArgumentError
    );

    manager.registerCache('primary', cache);
    expect(() => manager.invalidateEntity('')).toThrow(InvalidArgumentError);
  });

  it('should skip dependency tracking operations when disabled', () => {
    const manager = createManager({ enableDependencyTracking: false });
    const cache = createCache();

    manager.registerCache('primary', cache);

    manager.addDependency('hero:entity', 'primary');
    manager.removeDependency('hero:entity', 'primary');

    expect(manager.getDependencyMappings()).toEqual({});

    const results = manager.invalidateEntity('hero:entity');
    expect(results.primary.success).toBe(true);
    expect(manager.getStats().dependenciesResolved).toBe(0);
  });

  it('should log dispatch failures without throwing', () => {
    const manager = createManager();
    const cache = createCache();

    manager.registerCache('primary', cache);
    cache.set('hero:entity', { id: 'hero:entity' });

    dispatcher.dispatch.mockImplementationOnce(() => {
      throw new Error('dispatch failed');
    });

    const results = manager.invalidatePattern('hero');
    expect(results.primary.success).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch invalidation event'),
      expect.any(Error)
    );
  });
});
