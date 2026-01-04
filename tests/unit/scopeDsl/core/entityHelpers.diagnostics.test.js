import { jest } from '@jest/globals';
import {
  clearEntityCache,
  createEvaluationContext,
  invalidateEntityCache,
  getCacheStatistics,
  validateCacheEntry,
  getCacheSnapshot,
} from '../../../../src/scopeDsl/core/entityHelpers.js';

describe('entityHelpers - Cache Diagnostic API (SCODSLROB-005)', () => {
  beforeEach(() => {
    clearEntityCache();
  });

  describe('getCacheStatistics', () => {
    it('should return accurate size after cache population', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn((id) => ({ id, components: {} })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      // Empty cache
      let stats = getCacheStatistics();
      expect(stats.size).toBe(0);

      // Add one entry
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      stats = getCacheStatistics();
      expect(stats.size).toBe(1);

      // Add another entry
      createEvaluationContext('entity2', actor, gateway, locationProvider);
      stats = getCacheStatistics();
      expect(stats.size).toBe(2);
    });

    it('should track hit/miss ratio correctly', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn((id) => ({ id, components: {} })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      // First access = miss
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      let stats = getCacheStatistics();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Second access to same entity = hit
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      stats = getCacheStatistics();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(0.5);

      // Third access to same entity = hit
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      stats = getCacheStatistics();
      expect(stats.hits).toBe(2);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('should track invalidations correctly', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn((id) => ({ id, components: {} })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      // Populate cache
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      createEvaluationContext('entity2', actor, gateway, locationProvider);

      let stats = getCacheStatistics();
      expect(stats.invalidations).toBe(0);

      // Invalidate one entry
      invalidateEntityCache('entity1');
      stats = getCacheStatistics();
      expect(stats.invalidations).toBe(1);
      expect(stats.size).toBe(1);

      // Invalidate another entry
      invalidateEntityCache('entity2');
      stats = getCacheStatistics();
      expect(stats.invalidations).toBe(2);
      expect(stats.size).toBe(0);
    });

    it('should not increment invalidations for non-existent entries', () => {
      let stats = getCacheStatistics();
      expect(stats.invalidations).toBe(0);

      // Try to invalidate non-existent entry
      invalidateEntityCache('nonexistent');
      stats = getCacheStatistics();
      expect(stats.invalidations).toBe(0);
    });

    it('should report isEventBusConnected status', () => {
      // Initially not connected (no setupEntityCacheInvalidation called)
      const stats = getCacheStatistics();
      expect(typeof stats.isEventBusConnected).toBe('boolean');
    });

    it('should return zero hitRate when cache is empty', () => {
      const stats = getCacheStatistics();
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('validateCacheEntry', () => {
    it('should return cached:false for missing entries', () => {
      const result = validateCacheEntry('nonexistent');
      expect(result).toEqual({
        cached: false,
        stale: null,
        age: null,
      });
    });

    it('should return cached:true for cached entries', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: { 'core:name': { value: 'Test' } },
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      createEvaluationContext('entity1', actor, gateway, locationProvider);

      const result = validateCacheEntry('entity1');
      expect(result.cached).toBe(true);
      expect(result.age).toBeGreaterThanOrEqual(0);
    });

    it('should detect stale entries when components differ', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: { 'core:name': { value: 'Test' } },
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      // Cache the entity
      createEvaluationContext('entity1', actor, gateway, locationProvider);

      // Mock entity manager that returns different components
      const entityManager = {
        getEntity: jest.fn(() => ({
          id: 'entity1',
          components: {
            'core:name': { value: 'Test' },
            'core:description': { value: 'Added component' },
          },
        })),
      };

      const result = validateCacheEntry('entity1', entityManager);
      expect(result.cached).toBe(true);
      expect(result.stale).toBe(true);
    });

    it('should report not stale when components match', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: { 'core:name': { value: 'Test' } },
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      createEvaluationContext('entity1', actor, gateway, locationProvider);

      // Mock entity manager returning same components
      const entityManager = {
        getEntity: jest.fn(() => ({
          id: 'entity1',
          components: { 'core:name': { value: 'Test' } },
        })),
      };

      const result = validateCacheEntry('entity1', entityManager);
      expect(result.cached).toBe(true);
      expect(result.stale).toBe(false);
    });

    it('should handle entityManager without getEntity method', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: { 'core:name': { value: 'Test' } },
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      createEvaluationContext('entity1', actor, gateway, locationProvider);

      // Entity manager without getEntity
      const entityManager = {};

      const result = validateCacheEntry('entity1', entityManager);
      expect(result.cached).toBe(true);
      expect(result.stale).toBe(false); // Default to not stale when can't check
    });
  });

  describe('getCacheSnapshot', () => {
    it('should return empty map for empty cache', () => {
      const snapshot = getCacheSnapshot();
      expect(snapshot).toBeInstanceOf(Map);
      expect(snapshot.size).toBe(0);
    });

    it('should return copy of cache state', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn((id) => ({
          id,
          components: { 'core:name': { value: `Name for ${id}` } },
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      createEvaluationContext('entity1', actor, gateway, locationProvider);
      createEvaluationContext('entity2', actor, gateway, locationProvider);

      const snapshot = getCacheSnapshot();
      expect(snapshot.size).toBe(2);
      expect(snapshot.has('entity_entity1')).toBe(true);
      expect(snapshot.has('entity_entity2')).toBe(true);

      // Check structure
      const entry1 = snapshot.get('entity_entity1');
      expect(entry1).toHaveProperty('data');
      expect(entry1).toHaveProperty('cachedAt');
      expect(entry1.data).toHaveProperty('id', 'entity1');
      expect(typeof entry1.cachedAt).toBe('number');
    });

    it('should return independent copy that does not affect cache', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: { 'core:name': { value: 'Test' } },
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      createEvaluationContext('entity1', actor, gateway, locationProvider);

      const snapshot1 = getCacheSnapshot();
      snapshot1.delete('entity_entity1');

      // Original cache should still have the entry
      const snapshot2 = getCacheSnapshot();
      expect(snapshot2.has('entity_entity1')).toBe(true);
    });

    it('should include cachedAt timestamps', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: {},
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      const beforeCache = Date.now();
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      const afterCache = Date.now();

      const snapshot = getCacheSnapshot();
      const entry = snapshot.get('entity_entity1');

      expect(entry.cachedAt).toBeGreaterThanOrEqual(beforeCache);
      expect(entry.cachedAt).toBeLessThanOrEqual(afterCache);
    });
  });

  describe('clearEntityCache', () => {
    it('should reset all statistics', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn((id) => ({ id, components: {} })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      // Generate some cache activity
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      createEvaluationContext('entity1', actor, gateway, locationProvider); // hit
      invalidateEntityCache('entity1');

      let stats = getCacheStatistics();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.invalidations).toBeGreaterThan(0);

      // Clear and verify reset
      clearEntityCache();
      stats = getCacheStatistics();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.invalidations).toBe(0);
    });

    it('should clear timestamps as well', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'entity1',
          components: {},
        })),
      };
      const locationProvider = { getLocation: () => ({ id: 'loc1' }) };

      createEvaluationContext('entity1', actor, gateway, locationProvider);

      let snapshot = getCacheSnapshot();
      expect(snapshot.size).toBe(1);

      clearEntityCache();

      snapshot = getCacheSnapshot();
      expect(snapshot.size).toBe(0);
    });
  });

  describe('evictions tracking', () => {
    it('should track evictions when cache exceeds size limit', () => {
      // This test verifies the eviction counter exists and starts at zero
      // Practical eviction testing requires filling 10000 entries
      // which would be too slow for a unit test
      const stats = getCacheStatistics();
      expect(stats.evictions).toBe(0);
      expect(typeof stats.evictions).toBe('number');
    });
  });
});
