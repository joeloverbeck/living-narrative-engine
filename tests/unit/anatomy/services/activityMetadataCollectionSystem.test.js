/**
 * @file Unit tests for ActivityMetadataCollectionSystem
 * @description Tests 3-tier metadata collection, parsing, and deduplication
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityMetadataCollectionSystem from '../../../../src/anatomy/services/activityMetadataCollectionSystem.js';

describe('ActivityMetadataCollectionSystem', () => {
  let mockLogger;
  let mockEntityManager;
  let system;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: () => null,
    };

    system = new ActivityMetadataCollectionSystem({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(system).toBeDefined();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new ActivityMetadataCollectionSystem({
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('should create fallback logger if logger is missing', () => {
      const system = new ActivityMetadataCollectionSystem({
        logger: null,
        entityManager: mockEntityManager,
      });
      expect(system).toBeDefined();
    });

    it('should accept optional activityIndex', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: () => [],
      };

      const systemWithIndex = new ActivityMetadataCollectionSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        activityIndex: mockActivityIndex,
      });

      expect(systemWithIndex).toBeDefined();
    });
  });

  describe('collectActivityMetadata', () => {
    it('should return empty array when no entity found', () => {
      mockEntityManager.getEntityInstance = () => null;

      const result = system.collectActivityMetadata('missing_entity');

      expect(result).toEqual([]);
    });

    it('should handle entity resolution errors gracefully', () => {
      mockEntityManager.getEntityInstance = () => {
        throw new Error('resolution failure');
      };

      const result = system.collectActivityMetadata('entity_without_instance');

      expect(result).toEqual([]);
    });

    it('should collect from activity index when available', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: () => [{ type: 'indexed', priority: 10 }],
      };

      const systemWithIndex = new ActivityMetadataCollectionSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        activityIndex: mockActivityIndex,
      });

      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: [],
        hasComponent: () => false,
      };

      const result = systemWithIndex.collectActivityMetadata(
        'test_entity',
        mockEntity
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('indexed');
    });

    it('should handle activity index errors gracefully', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: () => {
          throw new Error('Index error');
        },
      };

      const systemWithIndex = new ActivityMetadataCollectionSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        activityIndex: mockActivityIndex,
      });

      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: [],
        hasComponent: () => false,
      };

      const result = systemWithIndex.collectActivityMetadata(
        'test_entity',
        mockEntity
      );

      expect(result).toEqual([]);
    });

    it('should collect inline metadata from entity', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: (componentId) => {
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target_entity',
              activityMetadata: {
                template: '{actor} is kneeling before {target}',
                priority: 50,
              },
            };
          }
          return null;
        },
        hasComponent: () => false,
      };

      const result = system.collectActivityMetadata('test_entity', mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('inline');
      expect(result[0].sourceComponent).toBe('positioning:kneeling');
    });

    it('should collect dedicated metadata from entity', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['activity:description_metadata'],
        getComponentData: (componentId) => {
          if (componentId === 'activity:description_metadata') {
            return {
              sourceComponent: 'positioning:kneeling',
              priority: 50,
              verb: 'kneeling before',
            };
          }
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target_entity',
            };
          }
          return null;
        },
        hasComponent: (componentId) =>
          componentId === 'activity:description_metadata',
      };

      const result = system.collectActivityMetadata('test_entity', mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('dedicated');
      expect(result[0].sourceComponent).toBe('positioning:kneeling');
    });

    it('should collect from all three tiers', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: () => [{ type: 'indexed', priority: 90 }],
      };

      const systemWithIndex = new ActivityMetadataCollectionSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        activityIndex: mockActivityIndex,
      });

      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: [
          'positioning:kneeling',
          'activity:description_metadata',
        ],
        getComponentData: (componentId) => {
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target_entity',
              activityMetadata: {
                template: '{actor} is kneeling',
                priority: 50,
              },
            };
          }
          if (componentId === 'activity:description_metadata') {
            return {
              sourceComponent: 'positioning:sitting',
              priority: 40,
              verb: 'sitting',
            };
          }
          if (componentId === 'positioning:sitting') {
            return {};
          }
          return null;
        },
        hasComponent: (componentId) =>
          componentId === 'activity:description_metadata',
      };

      const result = systemWithIndex.collectActivityMetadata(
        'test_entity',
        mockEntity
      );

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((a) => a.type === 'indexed')).toBe(true);
      expect(result.some((a) => a.type === 'inline')).toBe(true);
    });

    it('should continue when inline metadata collection throws', () => {
      jest.spyOn(system, 'collectInlineMetadata').mockImplementation(() => {
        throw new Error('inline failure');
      });

      const mockEntity = { id: 'entity', componentTypeIds: [] };

      const result = system.collectActivityMetadata('entity', mockEntity);

      expect(result).toEqual([]);
    });

    it('should continue when dedicated metadata collection throws', () => {
      jest.spyOn(system, 'collectDedicatedMetadata').mockImplementation(() => {
        throw new Error('dedicated failure');
      });

      const mockEntity = { id: 'entity', componentTypeIds: [] };

      const result = system.collectActivityMetadata('entity', mockEntity);

      expect(result).toEqual([]);
    });

    it('should use provided entity instead of fetching when available', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 'target',
          activityMetadata: {
            template: 'test',
            priority: 50,
          },
        }),
        hasComponent: () => false,
      };

      // EntityManager should not be called
      mockEntityManager.getEntityInstance = () => {
        throw new Error('Should not be called');
      };

      const result = system.collectActivityMetadata('test_entity', mockEntity);

      expect(result).toHaveLength(1);
    });
  });

  describe('collectInlineMetadata', () => {
    it('should return empty array for null entity', () => {
      const result = system.collectInlineMetadata(null);

      expect(result).toEqual([]);
    });

    it('should return empty array for entity without componentTypeIds', () => {
      const mockEntity = {
        id: 'test_entity',
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should skip dedicated metadata components', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['activity:description_metadata'],
        getComponentData: () => null,
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should skip components when getComponentData is unavailable', () => {
      const mockEntity = {
        componentTypeIds: ['positioning:kneeling'],
        // Intentionally missing getComponentData method
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should skip components without activityMetadata', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 'target',
          // No activityMetadata field
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should skip components with shouldDescribeInActivity=false', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 'target',
          activityMetadata: {
            template: 'test',
            shouldDescribeInActivity: false,
          },
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should parse valid inline metadata', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 'target_entity',
          activityMetadata: {
            template: '{actor} is kneeling before {target}',
            priority: 75,
            targetRole: 'entityId',
          },
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('inline');
      expect(result[0].sourceComponent).toBe('positioning:kneeling');
      expect(result[0].template).toBe('{actor} is kneeling before {target}');
      expect(result[0].priority).toBe(75);
      expect(result[0].targetEntityId).toBe('target_entity');
    });

    it('should handle component data retrieval errors', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => {
          throw new Error('Component error');
        },
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should skip component data that is not an object', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => 'invalid-data',
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle malformed activityMetadata', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 'target',
          activityMetadata: 'not an object',
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should collect from multiple components', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling', 'positioning:sitting'],
        getComponentData: (componentId) => {
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target1',
              activityMetadata: {
                template: 'kneeling',
                priority: 50,
              },
            };
          }
          if (componentId === 'positioning:sitting') {
            return {
              entityId: 'target2',
              activityMetadata: {
                template: 'sitting',
                priority: 60,
              },
            };
          }
          return null;
        },
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toHaveLength(2);
      expect(result[0].sourceComponent).toBe('positioning:kneeling');
      expect(result[1].sourceComponent).toBe('positioning:sitting');
    });

    it('should handle inline metadata that produces null activity', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 'target_entity',
          activityMetadata: {
            // Missing template triggers null result
            priority: 10,
          },
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle inline metadata parsing errors gracefully', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => {
          const componentData = {};
          Object.defineProperty(componentData, 'entityId', {
            get() {
              throw new Error('failed to access target');
            },
          });

          componentData.activityMetadata = {
            template: '{actor} observes {target}',
          };

          return componentData;
        },
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toEqual([]);
    });
  });

  describe('collectDedicatedMetadata', () => {
    it('should return empty array for null entity', () => {
      const result = system.collectDedicatedMetadata(null);

      expect(result).toEqual([]);
    });

    it('should return empty array if entity missing hasComponent', () => {
      const mockEntity = {};

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should return empty array if no metadata component', () => {
      const mockEntity = {
        hasComponent: () => false,
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle hasComponent errors', () => {
      const mockEntity = {
        hasComponent: () => {
          throw new Error('Has component error');
        },
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should return empty array if entity missing getComponentData', () => {
      const mockEntity = {
        hasComponent: () => true,
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle getComponentData errors', () => {
      const mockEntity = {
        hasComponent: () => true,
        getComponentData: () => {
          throw new Error('Get component error');
        },
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle invalid metadata', () => {
      const mockEntity = {
        hasComponent: () => true,
        getComponentData: () => null,
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should parse valid dedicated metadata', () => {
      const mockEntity = {
        id: 'test_entity',
        hasComponent: () => true,
        getComponentData: (componentId) => {
          if (componentId === 'activity:description_metadata') {
            return {
              sourceComponent: 'positioning:kneeling',
              descriptionType: 'position',
              priority: 60,
              verb: 'kneeling before',
              targetRole: 'entityId',
            };
          }
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target_entity',
            };
          }
          return null;
        },
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('dedicated');
      expect(result[0].sourceComponent).toBe('positioning:kneeling');
      expect(result[0].targetEntityId).toBe('target_entity');
      expect(result[0].verb).toBe('kneeling before');
    });

    it('should handle parsing errors gracefully', () => {
      const mockEntity = {
        id: 'test_entity',
        hasComponent: () => true,
        getComponentData: (componentId) => {
          if (componentId === 'activity:description_metadata') {
            return {
              sourceComponent: 'missing:component',
            };
          }
          // Source component not found
          return null;
        },
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should capture errors thrown during dedicated metadata parsing', () => {
      const explodingMetadata = {};
      Object.defineProperty(explodingMetadata, 'sourceComponent', {
        get() {
          throw new Error('boom');
        },
      });

      const mockEntity = {
        id: 'test_entity',
        hasComponent: () => true,
        getComponentData: (componentId) => {
          if (componentId === 'activity:description_metadata') {
            return explodingMetadata;
          }
          return {};
        },
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });
  });

  describe('deduplicateActivitiesBySignature', () => {
    it('should return empty array for empty input', () => {
      const result = system.deduplicateActivitiesBySignature([]);

      expect(result).toEqual([]);
    });

    it('should return copy of array for non-array input', () => {
      const result = system.deduplicateActivitiesBySignature(null);

      expect(result).toEqual([]);
    });

    it('should skip null and invalid activities', () => {
      const activities = [
        null,
        undefined,
        'not an object',
        { type: 'inline', template: 'valid' },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(1);
      expect(result[0].template).toBe('valid');
    });

    it('should remove exact duplicates', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(50);
    });

    it('should keep highest priority when duplicates found', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 75,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(75);
    });

    it('should retain original activity when candidate has lower priority', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 75,
        },
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 10,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(75);
    });

    it('should preserve insertion order', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
        {
          type: 'inline',
          template: 'sitting',
          targetId: 'target2',
          priority: 60,
        },
        {
          type: 'inline',
          template: 'standing',
          targetId: 'target3',
          priority: 40,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(3);
      expect(result[0].template).toBe('kneeling');
      expect(result[1].template).toBe('sitting');
      expect(result[2].template).toBe('standing');
    });

    it('should treat different targets as different activities', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target2',
          priority: 50,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(2);
    });

    it('should treat different group keys as different activities', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          grouping: { groupKey: 'group1' },
          priority: 50,
        },
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          grouping: { groupKey: 'group2' },
          priority: 50,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(2);
    });

    it('should handle activities with different types', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
        {
          type: 'dedicated',
          template: 'kneeling',
          targetId: 'target1',
          priority: 50,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(2);
    });

    it('should handle complex deduplication scenario', () => {
      const activities = [
        {
          type: 'inline',
          template: 'kneeling before',
          targetId: 'actor1',
          priority: 70,
        },
        {
          type: 'inline',
          template: 'kneeling before',
          targetId: 'actor1',
          priority: 50,
        },
        {
          type: 'inline',
          template: 'sitting beside',
          targetId: 'actor2',
          priority: 60,
        },
        {
          type: 'dedicated',
          verb: 'standing',
          targetId: 'actor3',
          priority: 40,
        },
        {
          type: 'inline',
          template: 'sitting beside',
          targetId: 'actor2',
          priority: 80,
        },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(3);
      expect(
        result.find((a) => a.template === 'kneeling before')?.priority
      ).toBe(70);
      expect(
        result.find((a) => a.template === 'sitting beside')?.priority
      ).toBe(80);
      expect(result.find((a) => a.verb === 'standing')?.priority).toBe(40);
    });
  });

  describe('Test Hooks', () => {
    it('should expose private methods for testing', () => {
      const hooks = system.getTestHooks();

      expect(hooks.parseInlineMetadata).toBeDefined();
      expect(hooks.parseDedicatedMetadata).toBeDefined();
      expect(hooks.buildActivityDeduplicationKey).toBeDefined();
    });

    it('should correctly parse inline metadata via test hooks', () => {
      const hooks = system.getTestHooks();

      const componentData = {
        entityId: 'target_entity',
      };

      const activityMetadata = {
        template: '{actor} is kneeling before {target}',
        priority: 75,
        targetRole: 'entityId',
      };

      const result = hooks.parseInlineMetadata(
        'positioning:kneeling',
        componentData,
        activityMetadata
      );

      expect(result).not.toBeNull();
      expect(result.type).toBe('inline');
      expect(result.priority).toBe(75);
      expect(result.targetEntityId).toBe('target_entity');
    });

    it('should build correct deduplication key via test hooks', () => {
      const hooks = system.getTestHooks();

      const activity = {
        type: 'inline',
        template: 'kneeling before',
        targetId: 'actor1',
        grouping: { groupKey: 'combat' },
      };

      const key = hooks.buildActivityDeduplicationKey(activity);

      expect(key).toContain('inline');
      expect(key).toContain('template:kneeling before');
      expect(key).toContain('target:actor1');
      expect(key).toContain('group:combat');
    });

    it('should warn when inline metadata is missing template via test hook', () => {
      const hooks = system.getTestHooks();

      const result = hooks.parseInlineMetadata(
        'positioning:kneeling',
        { entityId: 'target' },
        { priority: 10 }
      );

      expect(result).toBeNull();
    });

    it('should handle invalid dedicated metadata payloads via test hook', () => {
      const hooks = system.getTestHooks();

      const result = hooks.parseDedicatedMetadata(null, {
        getComponentData: () => ({}),
      });

      expect(result).toBeNull();
    });

    it('should handle missing component access in dedicated metadata parsing', () => {
      const hooks = system.getTestHooks();

      const result = hooks.parseDedicatedMetadata(
        { sourceComponent: 'positioning:kneeling' },
        {}
      );

      expect(result).toBeNull();
    });

    it('should handle source component retrieval errors in dedicated metadata parsing', () => {
      const hooks = system.getTestHooks();

      const result = hooks.parseDedicatedMetadata(
        { sourceComponent: 'positioning:kneeling' },
        {
          getComponentData: () => {
            throw new Error('fail');
          },
        }
      );

      expect(result).toBeNull();
    });

    it('should handle target resolution errors in dedicated metadata parsing', () => {
      const hooks = system.getTestHooks();

      const sourceData = {};
      Object.defineProperty(sourceData, 'entityId', {
        get() {
          throw new Error('resolve error');
        },
      });

      const result = hooks.parseDedicatedMetadata(
        { sourceComponent: 'positioning:kneeling' },
        {
          getComponentData: (componentId) => {
            if (componentId === 'positioning:kneeling') {
              return sourceData;
            }
            return {};
          },
        }
      );

      expect(result).toEqual({
        type: 'dedicated',
        sourceComponent: 'positioning:kneeling',
        descriptionType: undefined,
        metadata: { sourceComponent: 'positioning:kneeling' },
        sourceData,
        targetEntityId: null,
        priority: 50,
        verb: undefined,
        template: undefined,
        adverb: undefined,
        conditions: undefined,
        grouping: undefined,
      });
    });

    it('should create signature fallbacks when template is missing', () => {
      const hooks = system.getTestHooks();

      expect(hooks.buildActivityDeduplicationKey(null)).toBe('invalid');

      const sourceSignature = hooks.buildActivityDeduplicationKey({
        type: 'inline',
        sourceComponent: 'Positioning:Kneeling',
      });
      expect(sourceSignature).toContain('source:positioning:kneeling');

      const descriptionSignature = hooks.buildActivityDeduplicationKey({
        type: 'inline',
        description: 'Quietly waiting',
      });
      expect(descriptionSignature).toContain('description:quietly waiting');

      const verbSignature = hooks.buildActivityDeduplicationKey({
        type: 'dedicated',
        verb: 'Observe',
        adverb: 'Carefully',
      });
      expect(verbSignature).toContain('verb:observe:carefully');

      const fallbackSignature = hooks.buildActivityDeduplicationKey({});
      expect(fallbackSignature).toContain('activity:generic');
    });

    it('should handle missing target role via test hook', () => {
      const hooks = system.getTestHooks();

      const result = hooks.parseInlineMetadata(
        'positioning:kneeling',
        { other: 'value' },
        { template: 'kneeling', targetRole: 'missing' }
      );

      expect(result?.targetEntityId).toBeNull();
    });

    describe('Array Target Support (targetRoleIsArray)', () => {
      it('should return isMultiTarget true and targetEntityIds array when targetRoleIsArray is true', () => {
        const hooks = system.getTestHooks();

        const componentData = {
          wielded_item_ids: ['item1', 'item2', 'item3'],
        };

        const activityMetadata = {
          template: '{actor} is wielding {targets}',
          priority: 70,
          targetRole: 'wielded_item_ids',
          targetRoleIsArray: true,
        };

        const result = hooks.parseInlineMetadata(
          'positioning:wielding',
          componentData,
          activityMetadata
        );

        expect(result).not.toBeNull();
        expect(result.type).toBe('inline');
        expect(result.isMultiTarget).toBe(true);
        expect(result.targetEntityIds).toEqual(['item1', 'item2', 'item3']);
        expect(result.priority).toBe(70);
        expect(result.targetEntityId).toBeUndefined();
        expect(result.targetId).toBeUndefined();
      });

      it('should return empty targetEntityIds array for empty arrays', () => {
        const hooks = system.getTestHooks();

        const componentData = {
          wielded_item_ids: [],
        };

        const activityMetadata = {
          template: '{actor} is wielding {targets}',
          targetRole: 'wielded_item_ids',
          targetRoleIsArray: true,
        };

        const result = hooks.parseInlineMetadata(
          'positioning:wielding',
          componentData,
          activityMetadata
        );

        expect(result).not.toBeNull();
        expect(result.isMultiTarget).toBe(true);
        expect(result.targetEntityIds).toEqual([]);
      });

      it('should filter out invalid array items (non-strings and empty strings)', () => {
        const hooks = system.getTestHooks();

        const componentData = {
          wielded_item_ids: [
            'valid_item',
            '',
            '   ',
            123,
            null,
            undefined,
            'another_valid',
          ],
        };

        const activityMetadata = {
          template: '{actor} is wielding {targets}',
          targetRole: 'wielded_item_ids',
          targetRoleIsArray: true,
        };

        const result = hooks.parseInlineMetadata(
          'positioning:wielding',
          componentData,
          activityMetadata
        );

        expect(result).not.toBeNull();
        expect(result.isMultiTarget).toBe(true);
        expect(result.targetEntityIds).toEqual(['valid_item', 'another_valid']);
      });

      it('should fall through to existing single-target behavior when targetRoleIsArray is missing', () => {
        const hooks = system.getTestHooks();

        const componentData = {
          entityId: 'single_target',
        };

        const activityMetadata = {
          template: '{actor} is kneeling before {target}',
          targetRole: 'entityId',
          // targetRoleIsArray is NOT specified - should default to false
        };

        const result = hooks.parseInlineMetadata(
          'positioning:kneeling',
          componentData,
          activityMetadata
        );

        expect(result).not.toBeNull();
        expect(result.targetEntityId).toBe('single_target');
        expect(result.targetId).toBe('single_target');
        expect(result.isMultiTarget).toBeUndefined();
        expect(result.targetEntityIds).toBeUndefined();
      });

      it('should preserve single-target behavior when targetRoleIsArray is false', () => {
        const hooks = system.getTestHooks();

        const componentData = {
          entityId: 'target_entity',
        };

        const activityMetadata = {
          template: '{actor} is hugging {target}',
          targetRole: 'entityId',
          targetRoleIsArray: false, // Explicitly false
          priority: 66,
        };

        const result = hooks.parseInlineMetadata(
          'positioning:hugging',
          componentData,
          activityMetadata
        );

        expect(result).not.toBeNull();
        expect(result.type).toBe('inline');
        expect(result.targetEntityId).toBe('target_entity');
        expect(result.targetId).toBe('target_entity');
        expect(result.priority).toBe(66);
        expect(result.isMultiTarget).toBeUndefined();
        expect(result.targetEntityIds).toBeUndefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with empty componentTypeIds array', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: [],
        hasComponent: () => false,
      };

      const result = system.collectActivityMetadata('test_entity', mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle activity index returning non-array', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: () => 'not an array',
      };

      const systemWithIndex = new ActivityMetadataCollectionSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        activityIndex: mockActivityIndex,
      });

      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: [],
        hasComponent: () => false,
      };

      const result = systemWithIndex.collectActivityMetadata(
        'test_entity',
        mockEntity
      );

      expect(result).toEqual([]);
    });

    it('should handle inline metadata with blank target', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: '   ', // Blank string with whitespace
          activityMetadata: {
            template: 'kneeling',
            priority: 50,
          },
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].targetEntityId).toBeNull();
    });

    it('should handle inline metadata with empty target string', () => {
      const mockEntity = {
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: '',
          activityMetadata: {
            template: 'kneeling',
          },
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].targetEntityId).toBeNull();
    });

    it('should handle inline metadata with non-string target', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: () => ({
          entityId: 123, // Non-string target
          activityMetadata: {
            template: 'kneeling',
            priority: 50,
          },
        }),
      };

      const result = system.collectInlineMetadata(mockEntity);

      expect(result).toHaveLength(1);
      expect(result[0].targetEntityId).toBeNull();
    });

    it('should handle dedicated metadata without sourceComponent', () => {
      const mockEntity = {
        id: 'test_entity',
        hasComponent: () => true,
        getComponentData: () => ({
          // Missing sourceComponent
          priority: 50,
        }),
      };

      const result = system.collectDedicatedMetadata(mockEntity);

      expect(result).toEqual([]);
    });

    it('should handle deduplication with missing priority fields', () => {
      const activities = [
        { type: 'inline', template: 'kneeling' },
        { type: 'inline', template: 'kneeling', priority: 50 },
      ];

      const result = system.deduplicateActivitiesBySignature(activities);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(50);
    });
  });
});
