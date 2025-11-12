import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  AnatomyClothingCache,
  CacheKeyTypes,
} from '../../../src/anatomy/cache/AnatomyClothingCache.js';

function createIntegrationLogger() {
  const calls = [];
  const push = (level, message, args) => {
    calls.push({ level, message, args });
  };

  return {
    logger: {
      info: jest.fn((message, ...args) => push('info', message, args)),
      debug: jest.fn((message, ...args) => push('debug', message, args)),
      warn: jest.fn((message, ...args) => push('warn', message, args)),
      error: jest.fn((message, ...args) => push('error', message, args)),
    },
    getMessages(level) {
      return calls
        .filter((entry) => !level || entry.level === level)
        .map((entry) => entry.message);
    },
    calls,
  };
}

describe('AnatomyClothingCache integration with real LRU behavior', () => {
  /** @type {ReturnType<typeof createIntegrationLogger>} */
  let loggerBundle;

  beforeEach(() => {
    loggerBundle = createIntegrationLogger();
  });

  it('manages cache entries across types with eviction, stats, and manual controls', () => {
    const cache = new AnatomyClothingCache(
      { logger: loggerBundle.logger },
      { maxSize: 1, ttl: 200, maxMemoryUsage: 4096 }
    );

    const slotsKey1 =
      AnatomyClothingCache.createAvailableSlotsKey('entity-one');
    const slotsKey2 =
      AnatomyClothingCache.createAvailableSlotsKey('entity-two');
    cache.set(CacheKeyTypes.AVAILABLE_SLOTS, slotsKey1, ['torso', 'legs']);
    cache.set(CacheKeyTypes.AVAILABLE_SLOTS, slotsKey2, ['arms']);

    expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, slotsKey1)).toBeUndefined();
    expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, slotsKey2)).toEqual([
      'arms',
    ]);

    const evictionLogs = loggerBundle
      .getMessages('debug')
      .filter(
        (message) =>
          typeof message === 'string' &&
          message.includes('Cache entry disposed: available_slots:')
      );
    expect(evictionLogs.length).toBeGreaterThan(0);

    const resolutionKey = AnatomyClothingCache.createSlotResolutionKey(
      'entity-two',
      'slot-main'
    );
    cache.set(
      CacheKeyTypes.SLOT_RESOLUTION,
      resolutionKey,
      { socketId: 'core', result: ['socket-1'] },
      { ttl: 50 }
    );

    const blueprintKey = AnatomyClothingCache.createBlueprintKey('recipe-1');
    cache.set(CacheKeyTypes.BLUEPRINT, blueprintKey, 'compiled-blueprint');

    const socketLookupKey = AnatomyClothingCache.createSocketLookupKey(
      'entity-two',
      'socket-aux'
    );
    cache.set(CacheKeyTypes.SOCKET_LOOKUP, socketLookupKey, {
      entityId: 'entity-two',
      socketId: 'socket-aux',
    });

    const validationKey = 'validation:entity-two';
    cache.set(CacheKeyTypes.VALIDATION, validationKey, true);

    expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, resolutionKey)).toBe(true);
    expect(cache.delete(CacheKeyTypes.SLOT_RESOLUTION, 'unknown')).toBe(false);
    expect(cache.delete(CacheKeyTypes.SLOT_RESOLUTION, resolutionKey)).toBe(
      true
    );
    expect(cache.has('unknown-cache-type', 'key')).toBe(false);
    expect(cache.delete('unknown-cache-type', 'key')).toBe(false);

    const stats = cache.getStats();
    expect(stats.caches[CacheKeyTypes.BLUEPRINT].maxSize).toBe(2);
    expect(stats.totalItems).toBeGreaterThan(0);
    expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0);

    cache.clearType('unknown-cache-type');
    cache.clearType(CacheKeyTypes.AVAILABLE_SLOTS);
    expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, slotsKey2)).toBeUndefined();
    expect(
      loggerBundle
        .getMessages('info')
        .some(
          (message) =>
            typeof message === 'string' &&
            message.includes('Cleared 1 entries from available_slots cache')
        )
    ).toBe(true);
  });

  it('invalidates entries by entity or pattern and resets caches completely', () => {
    const cache = new AnatomyClothingCache(
      { logger: loggerBundle.logger },
      { maxSize: 3, ttl: 500, maxMemoryUsage: 8192 }
    );

    const actorId = 'actor-42';
    const availableKey = AnatomyClothingCache.createAvailableSlotsKey(actorId);
    const slotKey = AnatomyClothingCache.createSlotResolutionKey(
      actorId,
      'torso'
    );
    const entityStructureKey =
      AnatomyClothingCache.createEntityStructureKey(actorId);
    const socketKey = AnatomyClothingCache.createSocketLookupKey(
      actorId,
      'waist'
    );

    cache.set(CacheKeyTypes.AVAILABLE_SLOTS, availableKey, ['torso']);
    cache.set(CacheKeyTypes.SLOT_RESOLUTION, slotKey, {
      entityId: actorId,
      slotId: 'torso',
    });
    cache.set(CacheKeyTypes.ENTITY_STRUCTURE, entityStructureKey, {
      root: 'root-part',
    });
    cache.set(CacheKeyTypes.SOCKET_LOOKUP, socketKey, {
      entityId: actorId,
      socketId: 'waist',
    });

    const otherSlotKey = AnatomyClothingCache.createSlotResolutionKey(
      'actor-99',
      'torso'
    );
    cache.set(CacheKeyTypes.SLOT_RESOLUTION, otherSlotKey, {
      entityId: 'actor-99',
      slotId: 'torso',
    });

    cache.invalidateEntity(actorId);

    expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, availableKey)).toBe(false);
    expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, slotKey)).toBe(false);
    expect(cache.has(CacheKeyTypes.ENTITY_STRUCTURE, entityStructureKey)).toBe(
      false
    );
    expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, otherSlotKey)).toBe(true);

    const blueprintKey = AnatomyClothingCache.createBlueprintKey('recipe-x');
    cache.set(CacheKeyTypes.BLUEPRINT, blueprintKey, 'data');

    cache.invalidatePattern('recipe', CacheKeyTypes.BLUEPRINT);
    expect(cache.has(CacheKeyTypes.BLUEPRINT, blueprintKey)).toBe(false);

    const patternSlotKey = AnatomyClothingCache.createSlotResolutionKey(
      'actor-99',
      'torso:overlay'
    );
    cache.set(CacheKeyTypes.SLOT_RESOLUTION, patternSlotKey, {
      entityId: 'actor-99',
      slotId: 'torso:overlay',
    });

    cache.invalidatePattern('overlay', CacheKeyTypes.SLOT_RESOLUTION);
    expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, patternSlotKey)).toBe(
      false
    );

    const multiPatternSlotsKey = AnatomyClothingCache.createSlotResolutionKey(
      'actor-99',
      'torso:inner'
    );
    const multiPatternAvailableKey =
      AnatomyClothingCache.createAvailableSlotsKey('actor-99');
    cache.set(CacheKeyTypes.SLOT_RESOLUTION, multiPatternSlotsKey, {
      entityId: 'actor-99',
      slotId: 'torso:inner',
    });
    cache.set(CacheKeyTypes.AVAILABLE_SLOTS, multiPatternAvailableKey, [
      'torso:inner',
    ]);

    cache.invalidatePattern('actor-99');
    expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, multiPatternSlotsKey)).toBe(
      false
    );
    expect(
      cache.has(CacheKeyTypes.AVAILABLE_SLOTS, multiPatternAvailableKey)
    ).toBe(false);

    cache.invalidatePattern('unused', 'invalid-cache-type');

    cache.clearAll();
    const clearedStats = cache.getStats();
    expect(clearedStats.totalItems).toBe(0);
    expect(
      loggerBundle
        .getMessages('info')
        .some(
          (message) =>
            typeof message === 'string' &&
            message.includes('Cleared all caches')
        )
    ).toBe(true);
  });
});
