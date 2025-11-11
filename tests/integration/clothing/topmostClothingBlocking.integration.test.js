import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';

/**
 * Integration tests for ClothingAccessibilityService removal blocking functionality
 */
describe('Topmost Clothing Blocking Integration', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn()
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn()
    };
  });

  describe('Belt blocking pants scenario', () => {
    beforeEach(() => {
      // Setup equipment: belt + pants
      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: 'belt1'
              },
              legs: {
                base: 'pants1'
              }
            }
          };
        }

        if (entityId === 'belt1' && component === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'torso_lower' }
          };
        }

        if (entityId === 'pants1' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' }
          };
        }

        if (entityId === 'belt1' && component === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first'
              }
            ]
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        return entityId === 'belt1' && component === 'clothing:blocks_removal';
      });

      // Setup coverage mappings (no coverage blocking in this scenario)
      mockEntitiesGateway.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:coverage_mapping') {
          if (entityId === 'belt1') {
            return { covers: ['torso_lower'], coveragePriority: 'direct' };
          }
          if (entityId === 'pants1') {
            return { covers: ['legs'], coveragePriority: 'base' };
          }
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
    });

    it('should prevent pants from appearing in topmost_clothing when belt equipped', () => {
      const result = service.getAccessibleItems('actor1', { mode: 'topmost' });

      expect(result).toContain('belt1');
      expect(result).not.toContain('pants1');
    });

    it('should check that pants are not accessible', () => {
      const accessible = service.isItemAccessible('actor1', 'pants1');
      // Note: isItemAccessible checks coverage blocking, not removal blocking
      // So this test verifies the integration between the two systems
      expect(accessible.accessible).toBe(true); // Coverage-wise accessible

      // But getAccessibleItems should filter it out due to removal blocking
      const items = service.getAccessibleItems('actor1', { mode: 'topmost' });
      expect(items).not.toContain('pants1');
    });
  });

  describe('Belt removed scenario', () => {
    beforeEach(() => {
      // Setup equipment: only pants (belt removed)
      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              legs: {
                base: 'pants1'
              }
            }
          };
        }

        if (entityId === 'pants1' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' }
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockReturnValue(false);

      mockEntitiesGateway.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:coverage_mapping') {
          if (entityId === 'pants1') {
            return { covers: ['legs'], coveragePriority: 'base' };
          }
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
    });

    it('should allow pants removal after belt removed', () => {
      const result = service.getAccessibleItems('actor1', { mode: 'topmost' });

      expect(result).toContain('pants1');
      expect(result).not.toContain('belt1');
    });
  });

  describe('Multiple blockers scenario', () => {
    beforeEach(() => {
      // Setup equipment: belt + suspenders + pants
      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: 'belt1'
              },
              torso_upper: {
                accessories: 'suspenders1'
              },
              legs: {
                base: 'pants1'
              }
            }
          };
        }

        if (entityId === 'belt1' && component === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'torso_lower' }
          };
        }

        if (entityId === 'suspenders1' && component === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'torso_upper' }
          };
        }

        if (entityId === 'pants1' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' }
          };
        }

        if (entityId === 'belt1' && component === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first'
              }
            ]
          };
        }

        if (entityId === 'suspenders1' && component === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first'
              }
            ]
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        return (entityId === 'belt1' || entityId === 'suspenders1') &&
               component === 'clothing:blocks_removal';
      });

      mockEntitiesGateway.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:coverage_mapping') {
          if (entityId === 'belt1') {
            return { covers: ['torso_lower'], coveragePriority: 'direct' };
          }
          if (entityId === 'suspenders1') {
            return { covers: ['torso_upper'], coveragePriority: 'direct' };
          }
          if (entityId === 'pants1') {
            return { covers: ['legs'], coveragePriority: 'base' };
          }
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
    });

    it('should filter pants when multiple blockers are equipped', () => {
      const result = service.getAccessibleItems('actor1', { mode: 'topmost' });

      expect(result).toContain('belt1');
      expect(result).toContain('suspenders1');
      expect(result).not.toContain('pants1');
    });
  });

  describe('Armor blocking base layers scenario', () => {
    beforeEach(() => {
      // Setup equipment: cuirass (armor) + shirt
      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                outer: 'cuirass1',
                base: 'shirt1'
              }
            }
          };
        }

        if (entityId === 'cuirass1' && component === 'clothing:wearable') {
          return {
            layer: 'outer',
            equipmentSlots: { primary: 'torso_upper' }
          };
        }

        if (entityId === 'shirt1' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'torso_upper' }
          };
        }

        if (entityId === 'cuirass1' && component === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'torso_upper',
                layers: ['base', 'underwear'],
                blockType: 'full_block'
              }
            ]
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        return entityId === 'cuirass1' && component === 'clothing:blocks_removal';
      });

      mockEntitiesGateway.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:coverage_mapping') {
          if (entityId === 'cuirass1') {
            return { covers: ['torso_upper'], coveragePriority: 'outer' };
          }
          if (entityId === 'shirt1') {
            return { covers: ['torso_upper'], coveragePriority: 'base' };
          }
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
    });

    it('should filter base layer when armor blocks it', () => {
      const result = service.getAccessibleItems('actor1', { mode: 'topmost' });

      expect(result).toContain('cuirass1');
      expect(result).not.toContain('shirt1');
    });
  });

  describe('Explicit item ID blocking scenario', () => {
    beforeEach(() => {
      // Setup equipment: artifact1 + artifact2 (artifact2 blocks artifact1)
      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              hands: {
                accessories: 'artifact1',
                base: 'artifact2'
              }
            }
          };
        }

        if (entityId === 'artifact1' && component === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'hands' }
          };
        }

        if (entityId === 'artifact2' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'hands' }
          };
        }

        if (entityId === 'artifact2' && component === 'clothing:blocks_removal') {
          return {
            blocksRemovalOf: ['artifact1']
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        return entityId === 'artifact2' && component === 'clothing:blocks_removal';
      });

      mockEntitiesGateway.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:coverage_mapping') {
          if (entityId === 'artifact1') {
            return { covers: ['hands'], coveragePriority: 'direct' };
          }
          if (entityId === 'artifact2') {
            return { covers: ['hands'], coveragePriority: 'base' };
          }
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
    });

    it('should filter item blocked by explicit ID', () => {
      const result = service.getAccessibleItems('actor1', { mode: 'topmost' });

      expect(result).toContain('artifact2');
      expect(result).not.toContain('artifact1');
    });
  });

  describe('Cache behavior', () => {
    beforeEach(() => {
      // Setup initial state with belt + pants
      let equipmentState = {
        equipped: {
          torso_lower: {
            accessories: 'belt1'
          },
          legs: {
            base: 'pants1'
          }
        }
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return equipmentState;
        }

        if (entityId === 'belt1' && component === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'torso_lower' }
          };
        }

        if (entityId === 'pants1' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' }
          };
        }

        if (entityId === 'belt1' && component === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first'
              }
            ]
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, component) => {
        return entityId === 'belt1' && component === 'clothing:blocks_removal';
      });

      mockEntitiesGateway.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:coverage_mapping') {
          if (entityId === 'belt1') {
            return { covers: ['torso_lower'], coveragePriority: 'direct' };
          }
          if (entityId === 'pants1') {
            return { covers: ['legs'], coveragePriority: 'base' };
          }
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
    });

    it('should update results after cache invalidation', () => {
      // Initial state: belt blocks pants
      let result = service.getAccessibleItems('actor1', { mode: 'topmost' });
      expect(result).toContain('belt1');
      expect(result).not.toContain('pants1');

      // Simulate belt removal by updating equipment state
      const newEquipmentState = {
        equipped: {
          legs: {
            base: 'pants1'
          }
        }
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
        if (component === 'clothing:equipment') {
          return newEquipmentState;
        }

        if (entityId === 'pants1' && component === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' }
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Clear cache to reflect equipment change
      service.clearCache('actor1');

      // After clearing cache, pants should be accessible
      result = service.getAccessibleItems('actor1', { mode: 'topmost' });
      expect(result).toContain('pants1');
      expect(result).not.toContain('belt1');
    });
  });
});
