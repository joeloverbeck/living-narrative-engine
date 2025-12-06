import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';

/**
 * Helper to create minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    entityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      setComponentData: jest.fn(),
    },
    entitiesGateway: {
      getComponentData: jest.fn(),
    },
  };
}

describe('ClothingAccessibilityService - Removal Blocking', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    ({
      logger: mockLogger,
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway,
    } = createMocks());

    service = new ClothingAccessibilityService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway,
    });
  });

  describe('Removal Blocking Integration', () => {
    it('should filter out pants when belt is equipped', () => {
      // Setup equipment: belt + pants
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  accessories: 'belt1',
                },
                legs: {
                  base: 'pants1',
                },
              },
            };
          }

          // Belt wearable component
          if (entityId === 'belt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'torso_lower' },
            };
          }

          // Pants wearable component
          if (entityId === 'pants1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'legs' },
            };
          }

          return null;
        }
      );

      // Belt blocks pants removal
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            entityId === 'belt1' && componentId === 'clothing:blocks_removal'
          );
        }
      );

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  accessories: 'belt1',
                },
                legs: {
                  base: 'pants1',
                },
              },
            };
          }

          if (entityId === 'belt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'torso_lower' },
            };
          }

          if (entityId === 'pants1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'legs' },
            };
          }

          if (
            entityId === 'belt1' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blockedSlots: [
                {
                  slot: 'legs',
                  layers: ['base'],
                  blockType: 'must_remove_first',
                },
              ],
            };
          }

          return null;
        }
      );

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('belt1');
      expect(accessible).not.toContain('pants1');
    });

    it('should include pants after belt is removed', () => {
      // Setup equipment: only pants (belt removed)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                legs: {
                  base: 'pants1',
                },
              },
            };
          }

          if (entityId === 'pants1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'legs' },
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Clear cache to ensure fresh calculation
      service.clearCache('actor1');

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('pants1');
      expect(accessible).not.toContain('belt1');
    });

    it('should handle multiple blocking items', () => {
      // Setup equipment: belt + suspenders + pants
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  accessories: 'belt1',
                },
                torso_upper: {
                  accessories: 'suspenders1',
                },
                legs: {
                  base: 'pants1',
                },
              },
            };
          }

          if (entityId === 'belt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'torso_lower' },
            };
          }

          if (
            entityId === 'suspenders1' &&
            componentId === 'clothing:wearable'
          ) {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'torso_upper' },
            };
          }

          if (entityId === 'pants1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'legs' },
            };
          }

          if (
            entityId === 'belt1' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blockedSlots: [
                {
                  slot: 'legs',
                  layers: ['base'],
                  blockType: 'must_remove_first',
                },
              ],
            };
          }

          if (
            entityId === 'suspenders1' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blockedSlots: [
                {
                  slot: 'legs',
                  layers: ['base'],
                  blockType: 'must_remove_first',
                },
              ],
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            (entityId === 'belt1' || entityId === 'suspenders1') &&
            componentId === 'clothing:blocks_removal'
          );
        }
      );

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('belt1');
      expect(accessible).toContain('suspenders1');
      expect(accessible).not.toContain('pants1');
    });

    it('should not filter items without blocking', () => {
      // Setup equipment: shirt + pants (no blocking)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  base: 'shirt1',
                },
                legs: {
                  base: 'pants1',
                },
              },
            };
          }

          if (entityId === 'shirt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'torso_upper' },
            };
          }

          if (entityId === 'pants1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'legs' },
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('shirt1');
      expect(accessible).toContain('pants1');
    });

    it('should handle armor blocking base layers', () => {
      // Setup equipment: cuirass (armor) + shirt
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  outer: 'cuirass1',
                  base: 'shirt1',
                },
              },
            };
          }

          if (entityId === 'cuirass1' && componentId === 'clothing:wearable') {
            return {
              layer: 'outer',
              equipmentSlots: { primary: 'torso_upper' },
            };
          }

          if (entityId === 'shirt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'torso_upper' },
            };
          }

          if (
            entityId === 'cuirass1' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blockedSlots: [
                {
                  slot: 'torso_upper',
                  layers: ['base', 'underwear'],
                  blockType: 'full_block',
                },
              ],
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            entityId === 'cuirass1' && componentId === 'clothing:blocks_removal'
          );
        }
      );

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('cuirass1');
      expect(accessible).not.toContain('shirt1');
    });

    it('should handle explicit item ID blocking', () => {
      // Setup equipment: artifact1 + artifact2 (artifact2 blocks artifact1)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                hands: {
                  accessories: 'artifact1',
                  base: 'artifact2',
                },
              },
            };
          }

          if (entityId === 'artifact1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'hands' },
            };
          }

          if (entityId === 'artifact2' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'hands' },
            };
          }

          if (
            entityId === 'artifact2' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blocksRemovalOf: ['artifact1'],
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            entityId === 'artifact2' &&
            componentId === 'clothing:blocks_removal'
          );
        }
      );

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('artifact2');
      expect(accessible).not.toContain('artifact1');
    });
  });

  describe('Edge Cases', () => {
    it('should not block item from blocking itself', () => {
      // Setup equipment: belt that has blocking rule matching its own slot/layer
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  accessories: 'belt1',
                },
              },
            };
          }

          if (entityId === 'belt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'torso_lower' },
            };
          }

          if (
            entityId === 'belt1' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blockedSlots: [
                {
                  slot: 'torso_lower',
                  layers: ['accessories'],
                  blockType: 'must_remove_first',
                },
              ],
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            entityId === 'belt1' && componentId === 'clothing:blocks_removal'
          );
        }
      );

      // Act
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });

      // Assert
      expect(accessible).toContain('belt1'); // Should not block itself
    });

    it('should handle missing components gracefully', () => {
      // Setup equipment: item without complete component data
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  base: 'item1',
                },
              },
            };
          }

          if (entityId === 'item1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'torso_upper' },
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act & Assert: Should not throw
      expect(() => {
        service.getAccessibleItems('actor1', { mode: 'topmost' });
      }).not.toThrow();
    });

    it('should handle null wearable component', () => {
      // Setup equipment with item that has no wearable component
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  base: 'invalid-item',
                },
              },
            };
          }

          // Return null for wearable component
          if (
            entityId === 'invalid-item' &&
            componentId === 'clothing:wearable'
          ) {
            return null;
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act & Assert: Should not throw, and should include the item (fail-safe)
      const accessible = service.getAccessibleItems('actor1', {
        mode: 'topmost',
      });
      expect(accessible).toContain('invalid-item');
    });

    it('should log blocking reason for slot-based blocking', () => {
      // Setup equipment: belt blocks pants
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  accessories: 'belt1',
                },
                legs: {
                  base: 'pants1',
                },
              },
            };
          }

          if (entityId === 'belt1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'torso_lower' },
            };
          }

          if (entityId === 'pants1' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'legs' },
            };
          }

          if (
            entityId === 'belt1' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blockedSlots: [
                {
                  slot: 'legs',
                  layers: ['base'],
                  blockType: 'must_remove_first',
                },
              ],
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            entityId === 'belt1' && componentId === 'clothing:blocks_removal'
          );
        }
      );

      // Act
      service.getAccessibleItems('actor1', { mode: 'topmost' });

      // Assert: Check that debug logging was called with correct reason
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Filtering blocked item from accessible items',
        expect.objectContaining({
          targetItemId: 'pants1',
          blockedBy: 'belt1',
          reason: 'slot_based_blocking',
        })
      );
    });

    it('should log blocking reason for explicit ID blocking', () => {
      // Setup equipment: artifact2 blocks artifact1 by ID
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                hands: {
                  accessories: 'artifact1',
                  base: 'artifact2',
                },
              },
            };
          }

          if (entityId === 'artifact1' && componentId === 'clothing:wearable') {
            return {
              layer: 'accessories',
              equipmentSlots: { primary: 'hands' },
            };
          }

          if (entityId === 'artifact2' && componentId === 'clothing:wearable') {
            return {
              layer: 'base',
              equipmentSlots: { primary: 'hands' },
            };
          }

          if (
            entityId === 'artifact2' &&
            componentId === 'clothing:blocks_removal'
          ) {
            return {
              blocksRemovalOf: ['artifact1'],
            };
          }

          return null;
        }
      );

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) => {
          return (
            entityId === 'artifact2' &&
            componentId === 'clothing:blocks_removal'
          );
        }
      );

      // Act
      service.getAccessibleItems('actor1', { mode: 'topmost' });

      // Assert: Check that debug logging was called with correct reason
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Filtering explicitly blocked item from accessible items',
        expect.objectContaining({
          targetItemId: 'artifact1',
          blockedBy: 'artifact2',
          reason: 'explicit_id_blocking',
        })
      );
    });
  });
});
