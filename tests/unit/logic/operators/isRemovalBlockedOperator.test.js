import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import IsRemovalBlockedOperator from '../../../../src/logic/operators/isRemovalBlockedOperator.js';
import * as entityPathResolver from '../../../../src/logic/utils/entityPathResolver.js';

describe('IsRemovalBlockedOperator', () => {
  let testBed;
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getComponentData',
      'hasComponent',
    ]);

    operator = new IsRemovalBlockedOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Slot-Based Blocking', () => {
    it('should return true when belt blocks pants removal', () => {
      // Arrange: Belt in torso_lower blocks base layer in legs
      const actorId = 'actor1';
      const beltId = 'belt1';
      const pantsId = 'pants1';
      const context = { actor: { id: actorId }, targetItem: { id: pantsId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: [beltId],
              },
              legs: {
                base: [pantsId],
              },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        if (entityId === beltId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base', 'outer'],
                blockType: 'must_remove_first',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === beltId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Item removal blocked by slot rules'),
        expect.objectContaining({
          targetItemId: pantsId,
          blockedBy: beltId,
        })
      );
    });

    it('should return false when no blocking component present', () => {
      // Arrange: Items without blocks_removal component don't block
      const actorId = 'actor1';
      const shirtId = 'shirt1';
      const pantsId = 'pants1';
      const context = { actor: { id: actorId }, targetItem: { id: pantsId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                base: [shirtId],
              },
              legs: {
                base: [pantsId],
              },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockReturnValue(false);

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle multiple blocking items', () => {
      // Arrange: Belt + suspenders both block pants
      const actorId = 'actor1';
      const beltId = 'belt1';
      const suspendersId = 'suspenders1';
      const pantsId = 'pants1';
      const context = { actor: { id: actorId }, targetItem: { id: pantsId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: [beltId],
              },
              torso_upper: {
                accessories: [suspendersId],
              },
              legs: {
                base: [pantsId],
              },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        if (
          (entityId === beltId || entityId === suspendersId) &&
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
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return (
          (entityId === beltId || entityId === suspendersId) &&
          componentId === 'clothing:blocks_removal'
        );
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Explicit ID Blocking', () => {
    it('should block specific item IDs', () => {
      // Arrange: Quest item blocks removal of specific artifact
      const actorId = 'actor1';
      const cursedRingId = 'cursed_ring';
      const artifactId = 'artifact1';
      const context = { actor: { id: actorId }, targetItem: { id: artifactId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              hands: {
                accessories: [cursedRingId],
                base: [artifactId],
              },
            },
          };
        }
        if (entityId === artifactId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'hands' },
          };
        }
        if (entityId === cursedRingId && componentId === 'clothing:blocks_removal') {
          return {
            blocksRemovalOf: [artifactId],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === cursedRingId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Item removal blocked by explicit ID'),
        expect.objectContaining({
          targetItemId: artifactId,
          blockedBy: cursedRingId,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should not block item from blocking itself', () => {
      // Arrange: Self-referential check
      const actorId = 'actor1';
      const beltId = 'belt1';
      const context = { actor: { id: actorId }, targetItem: { id: beltId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: {
                accessories: [beltId],
              },
            },
          };
        }
        if (entityId === beltId && componentId === 'clothing:wearable') {
          return {
            layer: 'accessories',
            equipmentSlots: { primary: 'torso_lower' },
          };
        }
        if (entityId === beltId && componentId === 'clothing:blocks_removal') {
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
      });

      mockEntityManager.hasComponent.mockReturnValue(true);

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(false); // Item should not block itself
    });

    it('should handle missing equipment component', () => {
      // Arrange: Actor with no clothing:equipment
      const actorId = 'actor1';
      const itemId = 'item1';
      const context = { actor: { id: actorId }, targetItem: { id: itemId } };

      mockEntityManager.getComponentData.mockReturnValue(null);

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Actor has no equipment'),
        {
          actorId,
        }
      );
    });

    it('should handle invalid arguments gracefully', () => {
      // Test missing second parameter
      const context1 = { actor: { id: 'actor1' } };
      expect(operator.evaluate(['actor'], context1)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();

      // Test null in parameters
      mockLogger.warn.mockClear();
      const context2 = { actor: { id: 'actor1' } };
      expect(operator.evaluate(['actor', null], context2)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();

      // Test non-array arguments
      mockLogger.warn.mockClear();
      expect(operator.evaluate('not-an-array', {})).toBe(false);
    });

    it('should handle missing target entity in context', () => {
      // Arrange: Context without the target item path
      const actorId = 'actor1';
      const context = { actor: { id: actorId } }; // targetItem is missing

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              legs: {
                base: ['pants1'],
              },
            },
          };
        }
        return null;
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path targetItem')
      );
    });

    it('should handle target item without wearable component', () => {
      // Arrange: Target item has no clothing:wearable component
      const actorId = 'actor1';
      const itemId = 'item1';
      const context = { actor: { id: actorId }, targetItem: { id: itemId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              legs: {
                base: [itemId],
              },
            },
          };
        }
        // Return null for clothing:wearable to simulate missing component
        if (entityId === itemId && componentId === 'clothing:wearable') {
          return null;
        }
        return null;
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Target item is not wearable'),
        expect.objectContaining({
          targetItemId: itemId,
        })
      );
    });
  });

  describe('Block Types', () => {
    it('should respect must_remove_first block type', () => {
      // Arrange: Standard blocking behavior
      const actorId = 'actor1';
      const beltId = 'belt1';
      const pantsId = 'pants1';
      const context = { actor: { id: actorId }, targetItem: { id: pantsId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_lower: { accessories: [beltId] },
              legs: { base: [pantsId] },
            },
          };
        }
        if (entityId === pantsId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }
        if (entityId === beltId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'legs',
                layers: ['base'],
                blockType: 'must_remove_first',
                reason: 'Belt secures pants',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === beltId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(true);
    });

    it('should respect full_block type', () => {
      // Arrange: Armor completely blocking access
      const actorId = 'actor1';
      const armorId = 'plate_cuirass';
      const shirtId = 'shirt1';
      const context = { actor: { id: actorId }, targetItem: { id: shirtId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                outer: [armorId],
                base: [shirtId],
              },
            },
          };
        }
        if (entityId === shirtId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'torso_upper' },
          };
        }
        if (entityId === armorId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              {
                slot: 'torso_upper',
                layers: ['base', 'underwear'],
                blockType: 'full_block',
                reason: 'Plate armor completely covers torso',
              },
            ],
          };
        }
        return null;
      });

      mockEntityManager.hasComponent.mockImplementation((entityId, componentId) => {
        return entityId === armorId && componentId === 'clothing:blocks_removal';
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during evaluation gracefully', () => {
      // Arrange: Mock throws an error
      const actorId = 'actor1';
      const itemId = 'item1';
      const context = { actor: { id: actorId }, targetItem: { id: itemId } };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Simulated database error');
      });

      // Act
      const result = operator.evaluate(['actor', 'targetItem'], context);

      // Assert
      expect(result).toBe(false); // Should fail-safe to false (allow removal)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error evaluating IsRemovalBlocked operator'),
        expect.objectContaining({
          error: 'Simulated database error',
          actorId,
          targetItemPath: 'targetItem',
        })
      );
    });
  });

  describe('Parameter validation coverage', () => {
    it('returns false and warns when parameters are missing', () => {
      mockLogger.warn.mockClear();

      const result = operator.evaluateInternal('actor-1', undefined, {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing required parameter: targetItemPath')
      );
    });

    it('returns false and warns when target item path is nullish', () => {
      mockLogger.warn.mockClear();

      const result = operator.evaluateInternal('actor-1', [null], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Null or undefined targetItemPath'),
        { targetItemPath: null }
      );
    });
  });

  describe('Target resolution coverage', () => {
    it('returns false and warns when target entity cannot be resolved', () => {
      const spy = jest
        .spyOn(entityPathResolver, 'resolveEntityPath')
        .mockReturnValue({ entity: null, isValid: false });

      mockLogger.warn.mockClear();

      const result = operator.evaluateInternal('actor-1', ['target.path'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path target.path')
      );

      spy.mockRestore();
    });

    it('returns false when resolved entity lacks an identifier', () => {
      const spy = jest
        .spyOn(entityPathResolver, 'resolveEntityPath')
        .mockReturnValue({ entity: {}, isValid: true });

      mockLogger.warn.mockClear();

      const result = operator.evaluateInternal('actor-1', ['target.path'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity at path target.path')
      );

      spy.mockRestore();
    });

    it('warns when resolved entity identifier is blank', () => {
      const spy = jest
        .spyOn(entityPathResolver, 'resolveEntityPath')
        .mockReturnValue({ entity: { id: '   ' }, isValid: true });

      mockLogger.warn.mockClear();

      const result = operator.evaluateInternal('actor-1', ['target.path'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity at path target.path')
      );

      spy.mockRestore();
    });

    it('warns when resolved entity identifier is NaN', () => {
      const spy = jest
        .spyOn(entityPathResolver, 'resolveEntityPath')
        .mockReturnValue({ entity: { id: Number.NaN }, isValid: true });

      mockLogger.warn.mockClear();

      const result = operator.evaluateInternal('actor-1', ['target.path'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity at path target.path')
      );

      spy.mockRestore();
    });

    it('accepts primitive target identifiers and evaluates without blockers', () => {
      const actorId = 'actor-1';
      const targetId = 'item-1';
      const otherItemId = 'item-2';

      const spy = jest
        .spyOn(entityPathResolver, 'resolveEntityPath')
        .mockReturnValue({ entity: targetId, isValid: true });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              legs: {
                base: [targetId, otherItemId],
              },
            },
          };
        }

        if (entityId === targetId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = operator.evaluateInternal(actorId, ['targetItem'], {});

      expect(result).toBe(false);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        otherItemId,
        'clothing:blocks_removal'
      );

      spy.mockRestore();
    });
  });

  describe('Slot blocking rule coverage', () => {
    it('returns false when target wearable lacks slot metadata', () => {
      const actorId = 'actor-1';
      const targetId = 'item-1';
      const blockerId = 'blocker-1';
      const context = { targetItem: { id: targetId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso: {
                base: [targetId],
                accessories: [blockerId],
              },
            },
          };
        }

        if (entityId === targetId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: {},
          };
        }

        if (entityId === blockerId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              { slot: 'torso', layers: ['base'] },
            ],
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) =>
          entityId === blockerId && componentId === 'clothing:blocks_removal'
      );

      const result = operator.evaluateInternal(actorId, ['targetItem'], context);

      expect(result).toBe(false);
    });

    it('returns false when no slot blocking rules match the target', () => {
      const actorId = 'actor-1';
      const targetId = 'item-1';
      const blockerId = 'blocker-1';
      const context = { targetItem: { id: targetId } };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'clothing:equipment') {
          return {
            equipped: {
              legs: {
                base: [targetId],
                accessories: blockerId,
              },
            },
          };
        }

        if (entityId === targetId && componentId === 'clothing:wearable') {
          return {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          };
        }

        if (entityId === blockerId && componentId === 'clothing:blocks_removal') {
          return {
            blockedSlots: [
              { slot: 'torso', layers: ['outer'] },
            ],
          };
        }

        return null;
      });

      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) =>
          entityId === blockerId && componentId === 'clothing:blocks_removal'
      );

      const result = operator.evaluateInternal(actorId, ['targetItem'], context);

      expect(result).toBe(false);
    });
  });
});
