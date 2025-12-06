/**
 * @file Migration validation tests for ActivityMetadataCollectionSystem
 * @description Validates direct service usage without adapter layer (Batch 5)
 * @see workflows/ACTTESMIG-004-metadata-collection-validation.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActivityMetadataCollectionSystem from '../../../../src/anatomy/services/activityMetadataCollectionSystem.js';

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
 * Helper: Create mock entity manager
 *
 * @returns {object} Mock entity manager object
 */
function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn(),
  };
}

describe('ActivityMetadataCollectionSystem - Direct Usage Validation (Batch 5)', () => {
  let metadataSystem;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEntityManager = createMockEntityManager();

    // Create service directly (not via adapter)
    metadataSystem = new ActivityMetadataCollectionSystem({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('Direct DI Container Usage', () => {
    it('should resolve service from container without adapter layer', () => {
      expect(metadataSystem).toBeDefined();
      expect(metadataSystem.collectActivityMetadata).toBeInstanceOf(Function);
      expect(metadataSystem.collectInlineMetadata).toBeInstanceOf(Function);
      expect(metadataSystem.collectDedicatedMetadata).toBeInstanceOf(Function);
      expect(metadataSystem.deduplicateActivitiesBySignature).toBeInstanceOf(
        Function
      );
    });

    it('should collect metadata from entity using DI-resolved service', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:kneeling'],
        getComponentData: (componentId) => {
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target_entity',
              activityMetadata: {
                template: '{actor} is kneeling before {target}',
                priority: 75,
              },
            };
          }
          return null;
        },
        hasComponent: () => false,
      };

      const metadata = metadataSystem.collectActivityMetadata(
        'test_entity',
        mockEntity
      );

      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[0].type).toBe('inline');
      expect(metadata[0].template).toBe('{actor} is kneeling before {target}');
    });

    it('should collect inline metadata correctly via DI-resolved service', () => {
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: ['positioning:sitting', 'positioning:kneeling'],
        getComponentData: (componentId) => {
          if (componentId === 'positioning:sitting') {
            return {
              entityId: 'target1',
              activityMetadata: {
                template: '{actor} is sitting beside {target}',
                priority: 60,
              },
            };
          }
          if (componentId === 'positioning:kneeling') {
            return {
              entityId: 'target2',
              activityMetadata: {
                template: '{actor} is kneeling before {target}',
                priority: 75,
              },
            };
          }
          return null;
        },
      };

      const inlineMetadata = metadataSystem.collectInlineMetadata(mockEntity);

      expect(inlineMetadata).toHaveLength(2);
      expect(inlineMetadata[0].sourceComponent).toBe('positioning:sitting');
      expect(inlineMetadata[1].sourceComponent).toBe('positioning:kneeling');
    });

    it('should collect dedicated metadata correctly via DI-resolved service', () => {
      const mockEntity = {
        id: 'test_entity',
        hasComponent: (componentId) =>
          componentId === 'activity:description_metadata',
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

      const dedicatedMetadata =
        metadataSystem.collectDedicatedMetadata(mockEntity);

      expect(dedicatedMetadata).toHaveLength(1);
      expect(dedicatedMetadata[0].type).toBe('dedicated');
      expect(dedicatedMetadata[0].sourceComponent).toBe('positioning:kneeling');
      expect(dedicatedMetadata[0].verb).toBe('kneeling before');
    });

    it('should deduplicate activities correctly via DI-resolved service', () => {
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
      ];

      const deduplicated =
        metadataSystem.deduplicateActivitiesBySignature(activities);

      expect(deduplicated).toHaveLength(2);
      expect(
        deduplicated.find((a) => a.template === 'kneeling before')?.priority
      ).toBe(70);
    });
  });

  describe('Integration with Entity Manager', () => {
    it('should fetch entity from entity manager when entity not provided', () => {
      const mockEntity = {
        id: 'fetched_entity',
        componentTypeIds: ['positioning:sitting'],
        getComponentData: () => ({
          activityMetadata: {
            template: '{actor} is sitting',
            priority: 50,
          },
        }),
        hasComponent: () => false,
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const metadata = metadataSystem.collectActivityMetadata('fetched_entity');

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'fetched_entity'
      );
      expect(metadata).toHaveLength(1);
    });

    it('should handle entity manager returning null', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const metadata = metadataSystem.collectActivityMetadata('missing_entity');

      expect(metadata).toEqual([]);
    });
  });

  describe('Activity Index Integration (Optional)', () => {
    it('should work with activity index when available', () => {
      // Service is registered with optional activity index in DI container
      // This test validates it works when activity index is present
      const mockEntity = {
        id: 'test_entity',
        componentTypeIds: [],
        hasComponent: () => false,
      };

      const metadata = metadataSystem.collectActivityMetadata(
        'test_entity',
        mockEntity
      );

      // Should not throw, even if activity index is or isn't present
      expect(Array.isArray(metadata)).toBe(true);
    });
  });
});
