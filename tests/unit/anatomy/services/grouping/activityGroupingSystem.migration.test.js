/**
 * @file Migration tests for ActivityGroupingSystem
 * @description Tests migrated from activityDescriptionService.characterization.test.js
 *              to use ActivityGroupingSystem directly via DI container.
 *              Part of ACTTESMIG-001 - Batch 2 migration.
 *
 * Original tests: activityDescriptionService.characterization.test.js lines 825-1009
 * Migration batch: Batch 2 (15 tests)
 * Hooks migrated: groupActivities, determineConjunction, sortByPriority, activitiesOccurSimultaneously
 * @see workflows/ACTTESMIG-001-grouping-system-migration.md
 * @see workflows/ACTDESSERREF-010-migrate-test-suite.md
 * @see workflows/ACTTESMIG-000-migration-overview.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActivityGroupingSystem from '../../../../../src/anatomy/services/grouping/activityGroupingSystem.js';

/**
 * Helper: Create mock logger
 *
 * @returns {object} Mock logger object
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Helper: Create mock activity index manager
 * Provides buildIndex method required by ActivityGroupingSystem
 *
 * @returns {object} Mock index manager object
 */
function createMockActivityIndexManager() {
  return {
    buildIndex: jest.fn((activities) => {
      // Sort by priority descending (highest first)
      const sorted = [...activities].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      );

      // Build target index
      const byTarget = new Map();
      activities.forEach((activity) => {
        const targetId = activity.targetEntityId ?? activity.targetId ?? 'solo';
        if (!byTarget.has(targetId)) {
          byTarget.set(targetId, []);
        }
        byTarget.get(targetId).push(activity);
      });

      // Build groupKey index
      const byGroupKey = new Map();
      activities.forEach((activity) => {
        const groupKey = activity?.grouping?.groupKey;
        if (groupKey) {
          if (!byGroupKey.has(groupKey)) {
            byGroupKey.set(groupKey, []);
          }
          byGroupKey.get(groupKey).push(activity);
        }
      });

      return {
        byPriority: sorted,
        byTarget,
        byGroupKey,
      };
    }),
  };
}

/**
 * Helper: Create test activities matching characterization test format
 *
 * @param {Array<object>} configs - Activity configuration objects
 * @returns {Array<object>} Array of activity objects
 */
function createTestActivities(configs) {
  return configs.map((config) => ({
    type: config.type || 'inline',
    sourceComponent: config.sourceComponent || 'test:component',
    targetEntityId: config.targetEntityId || null,
    targetId: config.targetId || config.targetEntityId || null,
    priority: config.priority !== undefined ? config.priority : 50,
    template: config.template || '{actor} interacts with {target}',
    verb: config.verb || 'interacting with',
    adverb: config.adverb || null,
    description: config.description || null,
    conditions: config.conditions || null,
    grouping: config.grouping || null,
    activityMetadata: config.activityMetadata || {},
    sourceData: config.sourceData || {},
  }));
}

describe('ActivityGroupingSystem - Migrated Tests (Batch 2)', () => {
  let groupingSystem;
  let mockLogger;
  let mockIndexManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockIndexManager = createMockActivityIndexManager();

    groupingSystem = new ActivityGroupingSystem({
      indexManager: mockIndexManager,
      logger: mockLogger,
      config: {
        simultaneousPriorityThreshold: 10,
      },
    });
  });

  describe('Sequential Pair-Wise Comparison Algorithm', () => {
    it('should group activities via sequential pair-wise comparison', () => {
      // Source: activityDescriptionService.characterization.test.js lines 826-841
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'touch', targetEntityId: 'target1', priority: 55 },
        { verb: 'kiss', targetEntityId: 'target2', priority: 70 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(2);
      // Sorted by priority (highest first), so kiss (70) comes before touch (55, 50)
      expect(groups[0].primaryActivity.verb).toBe('kiss');
      expect(groups[0].relatedActivities).toHaveLength(0);
      expect(groups[1].primaryActivity.verb).toBe('touch');
      expect(groups[1].relatedActivities).toHaveLength(1);
    });

    it('should create separate groups for different targets', () => {
      // Source: activityDescriptionService.characterization.test.js lines 843-856
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'touch', targetEntityId: 'target2', priority: 51 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(2);
      expect(groups[0].primaryActivity.targetEntityId).toBe('target2');
      expect(groups[1].primaryActivity.targetEntityId).toBe('target1');
    });

    it('should group activities with same target and close priorities', () => {
      // Source: activityDescriptionService.characterization.test.js lines 858-870
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 52 },
        { verb: 'stroke', targetEntityId: 'target1', priority: 54 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities).toHaveLength(2);
    });

    it('should handle empty activities array', () => {
      // Source: activityDescriptionService.characterization.test.js lines 872-876
      const groups = groupingSystem.groupActivities([], 'cacheKey');

      expect(groups).toEqual([]);
    });

    it('should handle single activity', () => {
      // Source: activityDescriptionService.characterization.test.js lines 879-889
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities).toHaveLength(0);
    });
  });

  describe('Conjunction Selection ("while" vs "and")', () => {
    it('should use "while" when priorities are close', () => {
      // Source: activityDescriptionService.characterization.test.js lines 896-903
      // Test via groupActivities since determineConjunction is private
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 52 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities[0].conjunction).toBe('while');
    });

    it('should use "and" when priorities are distant', () => {
      // Source: activityDescriptionService.characterization.test.js lines 906-913
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 70 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities[0].conjunction).toBe('and');
    });

    it('should handle identical priorities', () => {
      // Source: activityDescriptionService.characterization.test.js lines 916-923
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 50 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities[0].conjunction).toBe('while');
    });

    it('should handle null priorities gracefully', () => {
      // Source: activityDescriptionService.characterization.test.js lines 926-933
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: null },
        { verb: 'caress', targetEntityId: 'target1', priority: 50 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      // Should not throw, conjunction should be defined
      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities[0].conjunction).toBeDefined();
    });
  });

  describe('Priority Sorting', () => {
    it('should sort activities by priority descending', () => {
      // Source: activityDescriptionService.characterization.test.js lines 941-953
      const activities = createTestActivities([
        { verb: 'low', priority: 10 },
        { verb: 'high', priority: 90 },
        { verb: 'medium', priority: 50 },
      ]);

      const sorted = groupingSystem.sortByPriority(activities, 'cacheKey');

      expect(sorted[0].verb).toBe('high');
      expect(sorted[1].verb).toBe('medium');
      expect(sorted[2].verb).toBe('low');
    });

    it('should maintain stable sort for equal priorities', () => {
      // Source: activityDescriptionService.characterization.test.js lines 956-968
      const activities = createTestActivities([
        { verb: 'first', priority: 50, sourceComponent: 'a' },
        { verb: 'second', priority: 50, sourceComponent: 'b' },
        { verb: 'third', priority: 50, sourceComponent: 'c' },
      ]);

      const sorted = groupingSystem.sortByPriority(activities, 'cacheKey');

      expect(sorted[0].sourceComponent).toBe('a');
      expect(sorted[1].sourceComponent).toBe('b');
      expect(sorted[2].sourceComponent).toBe('c');
    });

    it('should handle empty array', () => {
      // Source: activityDescriptionService.characterization.test.js lines 971-975
      const sorted = groupingSystem.sortByPriority([], 'cacheKey');

      expect(sorted).toEqual([]);
    });
  });

  describe('Simultaneity Detection', () => {
    it('should detect activities occurring simultaneously', () => {
      // Source: activityDescriptionService.characterization.test.js lines 983-990
      // Test via groupActivities with priority difference ≤10
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 52 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      // Should group (simultaneity = true) with "while" conjunction
      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities[0].conjunction).toBe('while');
    });

    it('should detect activities not occurring simultaneously', () => {
      // Source: activityDescriptionService.characterization.test.js lines 993-1000
      const activities = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 80 },
      ]);

      const groups = groupingSystem.groupActivities(activities, 'cacheKey');

      // Should group but with "and" conjunction (not simultaneous)
      expect(groups).toHaveLength(1);
      expect(groups[0].relatedActivities[0].conjunction).toBe('and');
    });

    it('should handle boundary conditions', () => {
      // Source: activityDescriptionService.characterization.test.js lines 1003-1008
      // Threshold is 10, so priority diff of 10 should be "while", 11 should be "and"
      const withinThreshold = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 60 },
      ]);

      const beyondThreshold = createTestActivities([
        { verb: 'touch', targetEntityId: 'target1', priority: 50 },
        { verb: 'caress', targetEntityId: 'target1', priority: 61 },
      ]);

      const withinGroups = groupingSystem.groupActivities(
        withinThreshold,
        'key1'
      );
      const beyondGroups = groupingSystem.groupActivities(
        beyondThreshold,
        'key2'
      );

      expect(withinGroups[0].relatedActivities[0].conjunction).toBe('while');
      expect(beyondGroups[0].relatedActivities[0].conjunction).toBe('and');
    });
  });
});
