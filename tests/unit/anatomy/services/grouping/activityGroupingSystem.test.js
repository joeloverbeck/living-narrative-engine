/**
 * @file Unit tests for ActivityGroupingSystem
 * @description Comprehensive test suite for the activity grouping system extracted from ActivityDescriptionService.
 *              Tests the sequential pair-wise comparison algorithm and all related methods.
 *
 * Test Coverage:
 * 1. Sequential Pair-Wise Grouping Algorithm
 * 2. Group by GroupKey (Explicit Grouping)
 * 3. Group by TargetId (Implicit Grouping)
 * 4. Conjunction Selection (Priority-Based)
 * 5. Priority Sorting
 * 6. Edge Cases
 * 7. Test Hooks
 * @see workflows/ACTDESSERREF-007-extract-activity-grouping.md
 * @see src/anatomy/services/grouping/activityGroupingSystem.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActivityGroupingSystem from '../../../../../src/anatomy/services/grouping/activityGroupingSystem.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock activity index manager
 *
 * @param customIndex
 */
const createMockIndexManager = (customIndex = null) => ({
  buildIndex: jest.fn((activities) => {
    if (customIndex) return customIndex;

    // Default: build basic index
    const byPriority = [...activities].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
    const byTarget = new Map();
    const byGroupKey = new Map();

    activities.forEach((activity) => {
      const targetId = activity.targetEntityId ?? activity.targetId ?? 'solo';
      if (!byTarget.has(targetId)) {
        byTarget.set(targetId, []);
      }
      byTarget.get(targetId).push(activity);

      const groupKey = activity.grouping?.groupKey;
      if (groupKey) {
        if (!byGroupKey.has(groupKey)) {
          byGroupKey.set(groupKey, []);
        }
        byGroupKey.get(groupKey).push(activity);
      }
    });

    return { byPriority, byTarget, byGroupKey };
  }),
});

/**
 * Creates a mock logger
 */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a test activity
 *
 * @param overrides
 */
const createActivity = (overrides = {}) => ({
  verb: 'testing',
  priority: 50,
  targetId: 'target1',
  ...overrides,
});

// ============================================================================
// Section 1: Constructor & Initialization
// ============================================================================

describe('ActivityGroupingSystem - Constructor', () => {
  it('should initialize with required dependencies', () => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();

    const system = new ActivityGroupingSystem({ indexManager, logger });

    expect(system).toBeDefined();
  });

  it('should accept simultaneousPriorityThreshold from config', () => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const config = { simultaneousPriorityThreshold: 15 };

    const system = new ActivityGroupingSystem({
      indexManager,
      logger,
      config,
    });
    const hooks = system.getTestHooks();

    // Test with priority difference of 12 (should be "while" with threshold 15)
    expect(hooks.activitiesOccurSimultaneously(50, 38)).toBe(true);
  });

  it('should use default simultaneousPriorityThreshold of 10', () => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();

    const system = new ActivityGroupingSystem({ indexManager, logger });
    const hooks = system.getTestHooks();

    // Priority difference of 10 should be simultaneous
    expect(hooks.activitiesOccurSimultaneously(50, 40)).toBe(true);
    // Priority difference of 11 should NOT be simultaneous
    expect(hooks.activitiesOccurSimultaneously(50, 39)).toBe(false);
  });

  it('should throw error if indexManager is missing', () => {
    const logger = createMockLogger();

    expect(() => {
      new ActivityGroupingSystem({ logger });
    }).toThrow();
  });

  it('should throw error if logger is missing', () => {
    const indexManager = createMockIndexManager();

    expect(() => {
      new ActivityGroupingSystem({ indexManager });
    }).toThrow();
  });
});

// ============================================================================
// Section 2: Sequential Pair-Wise Grouping Algorithm
// ============================================================================

describe('ActivityGroupingSystem - Sequential Pair-Wise Grouping', () => {
  let system;
  let indexManager;
  let logger;

  beforeEach(() => {
    indexManager = createMockIndexManager();
    logger = createMockLogger();
    system = new ActivityGroupingSystem({ indexManager, logger });
  });

  it('should return empty array for null activities', () => {
    const result = system.groupActivities(null);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty array', () => {
    const result = system.groupActivities([]);
    expect(result).toEqual([]);
  });

  it('should create single group for single activity', () => {
    const activity = createActivity({ verb: 'kneeling', priority: 50 });
    const result = system.groupActivities([activity]);

    expect(result).toHaveLength(1);
    expect(result[0].primaryActivity).toBe(activity);
    expect(result[0].relatedActivities).toHaveLength(0);
  });

  it('should group activities with same targetId', () => {
    const activity1 = createActivity({
      verb: 'kissing',
      priority: 50,
      targetId: 'target1',
    });
    const activity2 = createActivity({
      verb: 'caressing',
      priority: 45,
      targetId: 'target1',
    });
    const activity3 = createActivity({
      verb: 'holding',
      priority: 40,
      targetId: 'target2',
    });

    const result = system.groupActivities([activity1, activity2, activity3]);

    expect(result).toHaveLength(2);

    // First group: activity1 (primary) + activity2 (related)
    expect(result[0].primaryActivity).toBe(activity1);
    expect(result[0].relatedActivities).toHaveLength(1);
    expect(result[0].relatedActivities[0].activity).toBe(activity2);

    // Second group: activity3 (primary, different target)
    expect(result[1].primaryActivity).toBe(activity3);
    expect(result[1].relatedActivities).toHaveLength(0);
  });

  it('should group activities with same groupKey', () => {
    const activity1 = createActivity({
      verb: 'kissing',
      priority: 50,
      targetId: 'target1',
      grouping: { groupKey: 'intimate_actions' },
    });
    const activity2 = createActivity({
      verb: 'caressing',
      priority: 45,
      targetId: 'target2',
      grouping: { groupKey: 'intimate_actions' },
    });
    const activity3 = createActivity({
      verb: 'talking',
      priority: 40,
      targetId: 'target3',
    });

    const result = system.groupActivities([activity1, activity2, activity3]);

    expect(result).toHaveLength(2);

    // First group: activity1 (primary) + activity2 (related, same groupKey)
    expect(result[0].primaryActivity).toBe(activity1);
    expect(result[0].relatedActivities).toHaveLength(1);
    expect(result[0].relatedActivities[0].activity).toBe(activity2);

    // Second group: activity3 (primary, no groupKey)
    expect(result[1].primaryActivity).toBe(activity3);
    expect(result[1].relatedActivities).toHaveLength(0);
  });

  it('should process activities in priority order', () => {
    const activity1 = createActivity({
      verb: 'low',
      priority: 10,
      targetId: 'target1',
    });
    const activity2 = createActivity({
      verb: 'high',
      priority: 90,
      targetId: 'target1',
    });
    const activity3 = createActivity({
      verb: 'medium',
      priority: 50,
      targetId: 'target1',
    });

    const result = system.groupActivities([activity1, activity2, activity3]);

    expect(result).toHaveLength(1);
    // Highest priority should be primary
    expect(result[0].primaryActivity.verb).toBe('high');
    // Others should be related
    expect(result[0].relatedActivities).toHaveLength(2);
  });

  it('should not group already visited activities', () => {
    const activity1 = createActivity({
      verb: 'first',
      priority: 50,
      targetId: 'target1',
    });
    const activity2 = createActivity({
      verb: 'second',
      priority: 45,
      targetId: 'target1',
    });
    const activity3 = createActivity({
      verb: 'third',
      priority: 40,
      targetId: 'target1',
    });

    const result = system.groupActivities([activity1, activity2, activity3]);

    // All should be in one group since they share targetId
    expect(result).toHaveLength(1);
    expect(result[0].primaryActivity).toBe(activity1);
    expect(result[0].relatedActivities).toHaveLength(2);
  });
});

// ============================================================================
// Section 3: Conjunction Selection
// ============================================================================

describe('ActivityGroupingSystem - Conjunction Selection', () => {
  let system;
  let hooks;

  beforeEach(() => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    system = new ActivityGroupingSystem({ indexManager, logger });
    hooks = system.getTestHooks();
  });

  it('should return "while" for simultaneous activities (priority ≤10)', () => {
    const activity1 = createActivity({ priority: 50 });
    const activity2 = createActivity({ priority: 45 }); // Difference: 5

    const conjunction = hooks.determineConjunction(activity1, activity2);
    expect(conjunction).toBe('while');
  });

  it('should return "and" for sequential activities (priority >10)', () => {
    const activity1 = createActivity({ priority: 50 });
    const activity2 = createActivity({ priority: 30 }); // Difference: 20

    const conjunction = hooks.determineConjunction(activity1, activity2);
    expect(conjunction).toBe('and');
  });

  it('should handle exactly threshold difference (10)', () => {
    const activity1 = createActivity({ priority: 50 });
    const activity2 = createActivity({ priority: 40 }); // Difference: 10

    const conjunction = hooks.determineConjunction(activity1, activity2);
    expect(conjunction).toBe('while'); // ≤10 is simultaneous
  });

  it('should handle just over threshold (11)', () => {
    const activity1 = createActivity({ priority: 50 });
    const activity2 = createActivity({ priority: 39 }); // Difference: 11

    const conjunction = hooks.determineConjunction(activity1, activity2);
    expect(conjunction).toBe('and'); // >10 is sequential
  });

  it('should handle missing priorities (default to 0)', () => {
    const activity1 = createActivity({ priority: undefined });
    const activity2 = createActivity({ priority: undefined });

    const conjunction = hooks.determineConjunction(activity1, activity2);
    expect(conjunction).toBe('while'); // Both 0, difference = 0
  });

  it('should integrate conjunction into groupActivities result', () => {
    const activity1 = createActivity({
      verb: 'kissing',
      priority: 50,
      targetId: 'target1',
    });
    const activity2 = createActivity({
      verb: 'caressing',
      priority: 48,
      targetId: 'target1',
    }); // Difference: 2 → "while"
    const activity3 = createActivity({
      verb: 'holding',
      priority: 30,
      targetId: 'target1',
    }); // Difference from activity1: 20 → "and"

    const result = system.groupActivities([activity1, activity2, activity3]);

    expect(result).toHaveLength(1);
    expect(result[0].relatedActivities).toHaveLength(2);
    expect(result[0].relatedActivities[0].conjunction).toBe('while');
    expect(result[0].relatedActivities[1].conjunction).toBe('and');
  });
});

// ============================================================================
// Section 4: Priority Sorting
// ============================================================================

describe('ActivityGroupingSystem - Priority Sorting', () => {
  let system;
  let indexManager;

  beforeEach(() => {
    indexManager = createMockIndexManager();
    const logger = createMockLogger();
    system = new ActivityGroupingSystem({ indexManager, logger });
  });

  it('should delegate sorting to activity index manager', () => {
    const activities = [
      createActivity({ priority: 10 }),
      createActivity({ priority: 50 }),
      createActivity({ priority: 30 }),
    ];

    system.sortByPriority(activities);

    expect(indexManager.buildIndex).toHaveBeenCalledWith(activities, null);
  });

  it('should return sorted activities from index', () => {
    const activities = [
      createActivity({ verb: 'low', priority: 10 }),
      createActivity({ verb: 'high', priority: 50 }),
      createActivity({ verb: 'medium', priority: 30 }),
    ];

    const result = system.sortByPriority(activities);

    expect(result).toHaveLength(3);
    expect(result[0].verb).toBe('high'); // Priority 50
    expect(result[1].verb).toBe('medium'); // Priority 30
    expect(result[2].verb).toBe('low'); // Priority 10
  });

  it('should pass cacheKey to index manager', () => {
    const activities = [createActivity()];
    const cacheKey = 'test-cache-key';

    system.sortByPriority(activities, cacheKey);

    expect(indexManager.buildIndex).toHaveBeenCalledWith(
      activities,
      cacheKey
    );
  });
});

// ============================================================================
// Section 5: Should Group Activities
// ============================================================================

describe('ActivityGroupingSystem - Should Group Activities', () => {
  let hooks;

  beforeEach(() => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const system = new ActivityGroupingSystem({ indexManager, logger });
    hooks = system.getTestHooks();
  });

  it('should group activities with same groupKey', () => {
    const activity1 = createActivity({
      grouping: { groupKey: 'intimate' },
      targetId: 'target1',
    });
    const activity2 = createActivity({
      grouping: { groupKey: 'intimate' },
      targetId: 'target2',
    });

    expect(hooks.shouldGroupActivities(activity1, activity2)).toBe(true);
  });

  it('should group activities with same targetId', () => {
    const activity1 = createActivity({ targetId: 'target1' });
    const activity2 = createActivity({ targetId: 'target1' });

    expect(hooks.shouldGroupActivities(activity1, activity2)).toBe(true);
  });

  it('should group activities with same targetEntityId', () => {
    const activity1 = createActivity({ targetEntityId: 'entity1' });
    const activity2 = createActivity({ targetEntityId: 'entity1' });

    expect(hooks.shouldGroupActivities(activity1, activity2)).toBe(true);
  });

  it('should not group activities with different targetId and no groupKey', () => {
    const activity1 = createActivity({ targetId: 'target1' });
    const activity2 = createActivity({ targetId: 'target2' });

    expect(hooks.shouldGroupActivities(activity1, activity2)).toBe(false);
  });

  it('should prioritize groupKey over targetId', () => {
    const activity1 = createActivity({
      grouping: { groupKey: 'intimate' },
      targetId: 'target1',
    });
    const activity2 = createActivity({
      grouping: { groupKey: 'intimate' },
      targetId: 'target2',
    });

    expect(hooks.shouldGroupActivities(activity1, activity2)).toBe(true);
  });

  it('should handle missing groupKey gracefully', () => {
    const activity1 = createActivity({ targetId: 'target1' });
    const activity2 = createActivity({
      grouping: { groupKey: 'intimate' },
      targetId: 'target1',
    });

    // Should still group by targetId
    expect(hooks.shouldGroupActivities(activity1, activity2)).toBe(true);
  });
});

// ============================================================================
// Section 6: Activities Occur Simultaneously
// ============================================================================

describe('ActivityGroupingSystem - Activities Occur Simultaneously', () => {
  let hooks;

  beforeEach(() => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const system = new ActivityGroupingSystem({ indexManager, logger });
    hooks = system.getTestHooks();
  });

  it('should return true for identical priorities', () => {
    expect(hooks.activitiesOccurSimultaneously(50, 50)).toBe(true);
  });

  it('should return true for priority difference ≤10', () => {
    expect(hooks.activitiesOccurSimultaneously(50, 45)).toBe(true); // 5
    expect(hooks.activitiesOccurSimultaneously(50, 40)).toBe(true); // 10
    expect(hooks.activitiesOccurSimultaneously(45, 50)).toBe(true); // -5 (abs)
  });

  it('should return false for priority difference >10', () => {
    expect(hooks.activitiesOccurSimultaneously(50, 39)).toBe(false); // 11
    expect(hooks.activitiesOccurSimultaneously(50, 30)).toBe(false); // 20
    expect(hooks.activitiesOccurSimultaneously(30, 50)).toBe(false); // -20 (abs)
  });

  it('should handle null/undefined priorities (default to 0)', () => {
    expect(hooks.activitiesOccurSimultaneously(null, null)).toBe(true); // 0 - 0 = 0
    expect(hooks.activitiesOccurSimultaneously(undefined, undefined)).toBe(
      true
    );
    expect(hooks.activitiesOccurSimultaneously(5, null)).toBe(true); // 5 - 0 = 5
    expect(hooks.activitiesOccurSimultaneously(15, null)).toBe(false); // 15 - 0 = 15
  });
});

// ============================================================================
// Section 7: Start Activity Group
// ============================================================================

describe('ActivityGroupingSystem - Start Activity Group', () => {
  let hooks;

  beforeEach(() => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const system = new ActivityGroupingSystem({ indexManager, logger });
    hooks = system.getTestHooks();
  });

  it('should create group structure with primary activity', () => {
    const activity = createActivity({ verb: 'kneeling' });
    const group = hooks.startActivityGroup(activity);

    expect(group).toEqual({
      primaryActivity: activity,
      relatedActivities: [],
    });
  });

  it('should create empty relatedActivities array', () => {
    const activity = createActivity();
    const group = hooks.startActivityGroup(activity);

    expect(Array.isArray(group.relatedActivities)).toBe(true);
    expect(group.relatedActivities).toHaveLength(0);
  });
});

// ============================================================================
// Section 8: Edge Cases
// ============================================================================

describe('ActivityGroupingSystem - Edge Cases', () => {
  let system;

  beforeEach(() => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    system = new ActivityGroupingSystem({ indexManager, logger });
  });

  it('should handle activities with no target', () => {
    const activity1 = createActivity({ verb: 'sitting', targetId: undefined });
    const activity2 = createActivity({ verb: 'standing', targetId: undefined });

    const result = system.groupActivities([activity1, activity2]);

    // Activities with undefined targetId do NOT group together because
    // shouldGroupActivities checks "if (firstTarget && firstTarget === secondTarget)"
    // which is false for undefined values
    expect(result).toHaveLength(2);
    expect(result[0].relatedActivities).toHaveLength(0);
    expect(result[1].relatedActivities).toHaveLength(0);
  });

  it('should handle activities with targetEntityId instead of targetId', () => {
    const activity1 = createActivity({
      verb: 'kissing',
      targetEntityId: 'entity1',
      targetId: undefined,
    });
    const activity2 = createActivity({
      verb: 'caressing',
      targetEntityId: 'entity1',
      targetId: undefined,
    });

    const result = system.groupActivities([activity1, activity2]);

    expect(result).toHaveLength(1);
    expect(result[0].relatedActivities).toHaveLength(1);
  });

  it('should handle mix of targetId and targetEntityId', () => {
    const activity1 = createActivity({
      verb: 'kissing',
      targetEntityId: 'entity1',
    });
    const activity2 = createActivity({
      verb: 'caressing',
      targetId: 'entity1',
    });

    // shouldGroupActivities uses `first?.targetEntityId ?? first?.targetId`
    // So activity1 resolves to 'entity1' from targetEntityId
    // and activity2 resolves to 'entity1' from targetId
    // Both resolve to the same value, so they SHOULD group together
    const result = system.groupActivities([activity1, activity2]);

    expect(result).toHaveLength(1);
    expect(result[0].relatedActivities).toHaveLength(1);
  });

  it('should handle all activities with same priority', () => {
    const activity1 = createActivity({
      verb: 'first',
      priority: 50,
      targetId: 'target1',
    });
    const activity2 = createActivity({
      verb: 'second',
      priority: 50,
      targetId: 'target1',
    });
    const activity3 = createActivity({
      verb: 'third',
      priority: 50,
      targetId: 'target1',
    });

    const result = system.groupActivities([activity1, activity2, activity3]);

    expect(result).toHaveLength(1);
    expect(result[0].relatedActivities).toHaveLength(2);
    // All conjunctions should be "while" (priority difference = 0)
    result[0].relatedActivities.forEach((related) => {
      expect(related.conjunction).toBe('while');
    });
  });

  it('should handle large number of activities efficiently', () => {
    const activities = Array.from({ length: 100 }, (_, i) =>
      createActivity({
        verb: `activity_${i}`,
        priority: 100 - i,
        targetId: i < 50 ? 'target1' : 'target2',
      })
    );

    const result = system.groupActivities(activities);

    // Should create 2 groups (target1 and target2)
    expect(result).toHaveLength(2);
  });
});

// ============================================================================
// Section 9: Test Hooks
// ============================================================================

describe('ActivityGroupingSystem - Test Hooks', () => {
  it('should provide access to public methods', () => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const system = new ActivityGroupingSystem({ indexManager, logger });
    const hooks = system.getTestHooks();

    expect(hooks.groupActivities).toBeDefined();
    expect(hooks.sortByPriority).toBeDefined();
    expect(typeof hooks.groupActivities).toBe('function');
    expect(typeof hooks.sortByPriority).toBe('function');
  });

  it('should provide access to private methods', () => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const system = new ActivityGroupingSystem({ indexManager, logger });
    const hooks = system.getTestHooks();

    expect(hooks.startActivityGroup).toBeDefined();
    expect(hooks.shouldGroupActivities).toBeDefined();
    expect(hooks.determineConjunction).toBeDefined();
    expect(hooks.activitiesOccurSimultaneously).toBeDefined();
  });

  it('should allow direct invocation of private methods', () => {
    const indexManager = createMockIndexManager();
    const logger = createMockLogger();
    const system = new ActivityGroupingSystem({ indexManager, logger });
    const hooks = system.getTestHooks();

    const activity = createActivity();
    const group = hooks.startActivityGroup(activity);

    expect(group.primaryActivity).toBe(activity);
  });
});
