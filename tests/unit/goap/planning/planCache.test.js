import { describe, it, expect, beforeEach } from '@jest/globals';
import PlanCache from '../../../../src/goap/planning/planCache.js';

describe('PlanCache', () => {
  let planCache;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    planCache = new PlanCache({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => new PlanCache({ logger: null })).toThrow();
    });

    it('should initialize with empty cache', () => {
      const stats = planCache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.actors).toEqual([]);
    });
  });

  describe('get', () => {
    it('should return cached plan (hit)', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }]
      };

      planCache.set('actor1', plan);

      const result = planCache.get('actor1');

      expect(result).toBe(plan);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit for actor1');
    });

    it('should return null on cache miss', () => {
      const result = planCache.get('actor1');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss for actor1');
    });

    it('should validate actorId parameter', () => {
      expect(() => {
        planCache.get('');
      }).toThrow();
    });

    it('should handle multiple actors', () => {
      const plan1 = { goalId: 'test:goal1', steps: [] };
      const plan2 = { goalId: 'test:goal2', steps: [] };

      planCache.set('actor1', plan1);
      planCache.set('actor2', plan2);

      expect(planCache.get('actor1')).toBe(plan1);
      expect(planCache.get('actor2')).toBe(plan2);
    });
  });

  describe('set', () => {
    it('should cache plan for actor', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }]
      };

      planCache.set('actor1', plan);

      expect(planCache.has('actor1')).toBe(true);
      expect(planCache.get('actor1')).toBe(plan);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cached plan for actor1: goal test:goal'
      );
    });

    it('should warn when caching null plan', () => {
      planCache.set('actor1', null);

      expect(planCache.has('actor1')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to cache null plan for actor1'
      );
    });

    it('should warn when caching undefined plan', () => {
      planCache.set('actor1', undefined);

      expect(planCache.has('actor1')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should validate actorId parameter', () => {
      const plan = { goalId: 'test:goal', steps: [] };

      expect(() => {
        planCache.set('', plan);
      }).toThrow();
    });

    it('should overwrite existing plan', () => {
      const plan1 = { goalId: 'test:goal1', steps: [] };
      const plan2 = { goalId: 'test:goal2', steps: [] };

      planCache.set('actor1', plan1);
      planCache.set('actor1', plan2);

      expect(planCache.get('actor1')).toBe(plan2);
    });
  });

  describe('has', () => {
    it('should return true when plan exists', () => {
      const plan = { goalId: 'test:goal', steps: [] };
      planCache.set('actor1', plan);

      expect(planCache.has('actor1')).toBe(true);
    });

    it('should return false when plan does not exist', () => {
      expect(planCache.has('actor1')).toBe(false);
    });

    it('should validate actorId parameter', () => {
      expect(() => {
        planCache.has('');
      }).toThrow();
    });
  });

  describe('invalidate', () => {
    it('should invalidate cached plan', () => {
      const plan = { goalId: 'test:goal', steps: [] };
      planCache.set('actor1', plan);

      planCache.invalidate('actor1');

      expect(planCache.has('actor1')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Invalidated plan for actor1'
      );
    });

    it('should handle invalidating non-existent plan', () => {
      planCache.invalidate('actor1');

      expect(planCache.has('actor1')).toBe(false);
      // Should not log when plan didn't exist
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalidated plan')
      );
    });

    it('should validate actorId parameter', () => {
      expect(() => {
        planCache.invalidate('');
      }).toThrow();
    });

    it('should only invalidate specific actor', () => {
      const plan1 = { goalId: 'test:goal1', steps: [] };
      const plan2 = { goalId: 'test:goal2', steps: [] };

      planCache.set('actor1', plan1);
      planCache.set('actor2', plan2);

      planCache.invalidate('actor1');

      expect(planCache.has('actor1')).toBe(false);
      expect(planCache.has('actor2')).toBe(true);
    });
  });

  describe('invalidateGoal', () => {
    it('should invalidate all plans for specific goal', () => {
      const plan1 = { goalId: 'test:goal1', steps: [] };
      const plan2 = { goalId: 'test:goal1', steps: [] };
      const plan3 = { goalId: 'test:goal2', steps: [] };

      planCache.set('actor1', plan1);
      planCache.set('actor2', plan2);
      planCache.set('actor3', plan3);

      planCache.invalidateGoal('test:goal1');

      expect(planCache.has('actor1')).toBe(false);
      expect(planCache.has('actor2')).toBe(false);
      expect(planCache.has('actor3')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Invalidated 2 plans for goal test:goal1'
      );
    });

    it('should handle invalidating non-existent goal', () => {
      const plan = { goalId: 'test:goal1', steps: [] };
      planCache.set('actor1', plan);

      planCache.invalidateGoal('test:goal2');

      expect(planCache.has('actor1')).toBe(true);
      // Should not log when no plans were invalidated
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalidated')
      );
    });

    it('should validate goalId parameter', () => {
      expect(() => {
        planCache.invalidateGoal('');
      }).toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cached plans', () => {
      const plan1 = { goalId: 'test:goal1', steps: [] };
      const plan2 = { goalId: 'test:goal2', steps: [] };

      planCache.set('actor1', plan1);
      planCache.set('actor2', plan2);

      planCache.clear();

      expect(planCache.has('actor1')).toBe(false);
      expect(planCache.has('actor2')).toBe(false);
      expect(planCache.getStats().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared 2 cached plans');
    });

    it('should handle clearing empty cache', () => {
      planCache.clear();

      expect(planCache.getStats().size).toBe(0);
      // Should not log when cache was empty
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const plan1 = { goalId: 'test:goal1', steps: [] };
      const plan2 = { goalId: 'test:goal2', steps: [] };

      planCache.set('actor1', plan1);
      planCache.set('actor2', plan2);

      const stats = planCache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.actors).toEqual(['actor1', 'actor2']);
    });

    it('should return empty stats for empty cache', () => {
      const stats = planCache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.actors).toEqual([]);
    });

    it('should update after invalidation', () => {
      const plan = { goalId: 'test:goal', steps: [] };
      planCache.set('actor1', plan);

      planCache.invalidate('actor1');

      const stats = planCache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.actors).toEqual([]);
    });
  });
});
