import { describe, it, expect, beforeEach } from '@jest/globals';
import { CanScootCloserOperator } from '../../../../src/logic/operators/canScootCloserOperator.js';
import { createTestBed } from '../../../common/testBed.js';

describe('CanScootCloserOperator', () => {
  let testBed;
  let operator;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getComponentData',
    ]);
    operator = new CanScootCloserOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Validation Logic', () => {
    it('should return true when all conditions are met', () => {
      // Furniture: [occupant1, null, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('can scoot closer')
      );
    });

    it('should return true with multiple empty spots to the left', () => {
      // Furniture: [occupant1, null, null, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 3 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(true);
    });

    it('should return false when entity is not sitting', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('not sitting')
      );
    });

    it('should return false when sitting on different furniture', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture2', spot_index: 1 };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('not target')
      );
    });

    it('should return false when in leftmost position (index 0)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['actor1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('leftmost position')
      );
    });

    it('should return false when spot to the left is occupied', () => {
      // Furniture: [occupant1, occupant2, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', 'occupant2', 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('cannot scoot - spot')
      );
    });

    it('should return false when no occupant to the left', () => {
      // Furniture: [null, null, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: [null, null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no occupant to the left')
      );
    });

    it('should return false when gap exists between actor and leftmost occupant', () => {
      // Furniture: [occupant1, null, occupant2, null, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 4 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'occupant2', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has a gap')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-spot furniture', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('leftmost position')
      );
    });

    it('should handle two-spot furniture with actor in rightmost position', () => {
      // Furniture: [occupant1, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('cannot scoot - spot')
      );
    });

    it('should handle invalid furniture ID (no allows_sitting component)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          // No allows_sitting component
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
    });

    it('should handle missing sitting_on component', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
    });

    it('should handle out-of-bounds spot_index (negative)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: -1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('out of bounds')
      );
    });

    it('should handle out-of-bounds spot_index (exceeds length)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 10 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('out of bounds')
      );
    });

    it('should handle invalid spots array (not an array)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: 'invalid' }; // Not an array
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid spots property')
      );
    });

    it('should handle mismatch between spot_index and actual spot occupant', () => {
      // Actor claims spot 2, but furniture shows different occupant
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'otherActor'] }; // Mismatch
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('claims spot')
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should handle missing parameters gracefully', () => {
      const result = operator.evaluate([], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid parameters')
      );
    });

    it('should handle null entity ID', () => {
      const result = operator.evaluate([null, 'target'], {
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
    });

    it('should handle null target ID', () => {
      const result = operator.evaluate(['actor', null], {
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
    });

    it('should handle invalid spot_index type (undefined)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: undefined };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid spot_index')
      );
    });

    it('should handle invalid spot_index type (string)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'sitting-states:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: '2' };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'sitting:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['actor', 'target'], {
        actor: { id: 'actor1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid spot_index')
      );
    });
  });
});
