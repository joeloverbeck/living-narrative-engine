/**
 * @file Integration tests for ActivityCacheManager covering event-driven invalidation
 * and lifecycle behaviors using production collaborators.
 */

import { describe, it, expect, jest } from '@jest/globals';
import ActivityCacheManager from '../../../src/anatomy/cache/activityCacheManager.js';
import EventBus from '../../../src/events/eventBus.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
  ENTITY_REMOVED_ID,
} from '../../../src/constants/eventIds.js';

const createLogger = () => new NoOpLogger();

describe('ActivityCacheManager Integration', () => {
  it('manages TTL, pruning, and manual invalidation across caches', () => {
    jest.useFakeTimers({ now: 0 });

    const logger = createLogger();
    const cacheManager = new ActivityCacheManager({ logger });

    try {
      cacheManager.registerCache('activities', { ttl: 50, maxSize: 5 });

      // Attempting to register the same cache should be ignored without altering configuration.
      cacheManager.registerCache('activities', { ttl: 5000, maxSize: 50 });

      // Populate entries with staggered timestamps to exercise LRU pruning and TTL handling.
      for (let index = 0; index < 6; index += 1) {
        cacheManager.set('activities', `entity${index}:activity`, { index });
        jest.advanceTimersByTime(1);
      }

      const internalCache = cacheManager._getInternalCacheForTesting('activities');
      expect(internalCache.size).toBe(4);
      expect(internalCache.has('entity0:activity')).toBe(false);
      expect(internalCache.has('entity1:activity')).toBe(false);

      // Manual invalidation should remove existing entries.
      expect(cacheManager.get('activities', 'entity5:activity')).toEqual({ index: 5 });
      cacheManager.invalidate('activities', 'entity5:activity');
      expect(cacheManager.get('activities', 'entity5:activity')).toBeUndefined();

      // Invalidate all entries for a specific entity key fragment.
      cacheManager.set('activities', 'entity5:activity', { restored: true });
      cacheManager.invalidateAll('entity5');
      expect(cacheManager.get('activities', 'entity5:activity')).toBeUndefined();

      // Clearing all caches should remove every entry.
      cacheManager.set('activities', 'entity-special:activity', { important: true });
      cacheManager.clearAll();
      expect(cacheManager._getInternalCacheForTesting('activities').size).toBe(0);

      // TTL configuration from the first registration should still apply.
      cacheManager.set('activities', 'entity-late:activity', { fresh: true });
      jest.advanceTimersByTime(60);
      expect(cacheManager.get('activities', 'entity-late:activity')).toBeUndefined();

      // Accessing an unregistered cache returns undefined without throwing.
      expect(cacheManager.get('unknown-cache', 'any-key')).toBeUndefined();
    } finally {
      cacheManager.destroy();
      jest.useRealTimers();
    }
  });

  it('invalidates entries when entity lifecycle events are dispatched', async () => {
    const logger = createLogger();
    const eventBus = new EventBus({ logger });
    const cacheManager = new ActivityCacheManager({ logger, eventBus });

    try {
      cacheManager.registerCache('activities', { ttl: 1000, maxSize: 10 });

      cacheManager.set('activities', 'actor:componentA', { stage: 'initial' });
      await eventBus.dispatch(COMPONENT_ADDED_ID, { entityId: 'actor' });
      expect(cacheManager.get('activities', 'actor:componentA')).toBeUndefined();

      cacheManager.set('activities', 'actor:componentB', { stage: 'second' });
      await eventBus.dispatch(COMPONENT_REMOVED_ID, { entity: { id: 'actor' } });
      expect(cacheManager.get('activities', 'actor:componentB')).toBeUndefined();

      cacheManager.set('activities', 'actor:componentC', { stage: 'batch' });
      cacheManager.set('activities', 'partner:componentD', { stage: 'batch' });
      await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, {
        updates: [
          { entity: { id: 'actor' } },
          { entityId: 'partner' },
          { instanceId: 'spectator' },
        ],
      });
      expect(cacheManager.get('activities', 'actor:componentC')).toBeUndefined();
      expect(cacheManager.get('activities', 'partner:componentD')).toBeUndefined();

      cacheManager.set('activities', 'spectator:componentE', { stage: 'removed' });
      await eventBus.dispatch(ENTITY_REMOVED_ID, { entity: { id: 'spectator' } });
      expect(cacheManager.get('activities', 'spectator:componentE')).toBeUndefined();
    } finally {
      cacheManager.destroy();
    }
  });

  it('performs periodic cleanup of expired entries without manual access', () => {
    jest.useFakeTimers({ now: 0 });

    const logger = createLogger();
    const cacheManager = new ActivityCacheManager({ logger });

    try {
      cacheManager.registerCache('activities', { ttl: 20, maxSize: 5 });
      cacheManager.set('activities', 'entity:stale', { payload: true });

      expect(cacheManager._getInternalCacheForTesting('activities').size).toBe(1);

      // Advance beyond the TTL but before the cleanup interval to ensure the entry remains until cleanup runs.
      jest.advanceTimersByTime(25);
      expect(cacheManager._getInternalCacheForTesting('activities').size).toBe(1);

      // Trigger the scheduled cleanup interval (30s) so expired entries are removed automatically.
      jest.advanceTimersByTime(30000);
      expect(cacheManager._getInternalCacheForTesting('activities').size).toBe(0);
    } finally {
      cacheManager.destroy();
      jest.useRealTimers();
    }
  });

  it('cleans up resources and event subscriptions on destroy', async () => {
    const logger = createLogger();
    const eventBus = new EventBus({ logger });
    const cacheManager = new ActivityCacheManager({ logger, eventBus });

    cacheManager.registerCache('activities', { ttl: 100, maxSize: 5 });
    cacheManager.set('activities', 'actor:final', { step: 'before-destroy' });

    expect(eventBus.listenerCount(COMPONENT_ADDED_ID)).toBe(1);
    expect(eventBus.listenerCount(COMPONENT_REMOVED_ID)).toBe(1);
    expect(eventBus.listenerCount(COMPONENTS_BATCH_ADDED_ID)).toBe(1);
    expect(eventBus.listenerCount(ENTITY_REMOVED_ID)).toBe(1);

    cacheManager.destroy();

    expect(eventBus.listenerCount(COMPONENT_ADDED_ID)).toBe(0);
    expect(eventBus.listenerCount(COMPONENT_REMOVED_ID)).toBe(0);
    expect(eventBus.listenerCount(COMPONENTS_BATCH_ADDED_ID)).toBe(0);
    expect(eventBus.listenerCount(ENTITY_REMOVED_ID)).toBe(0);

    // Internal caches should be fully cleared after destruction.
    expect(cacheManager._getInternalCacheForTesting('activities').size).toBe(0);

    await eventBus.dispatch(COMPONENT_ADDED_ID, { entityId: 'actor' });
  });
});
