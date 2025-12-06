import { describe, it, expect, beforeEach } from '@jest/globals';
import { IsClosestLeftOccupantOperator } from '../../../../src/logic/operators/isClosestLeftOccupantOperator.js';
import { createTestBed } from '../../../common/testBed.js';

describe('IsClosestLeftOccupantOperator', () => {
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
    operator = new IsClosestLeftOccupantOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Validation Logic', () => {
    it('should return true when candidate is the closest left occupant', () => {
      // Furniture: [occupant1, null, actor]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('matches candidate')
      );
    });

    it('should resolve actor from a custom context path', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'customActor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        customActor: { id: 'actor1' },
      });

      expect(result).toBe(true);
    });

    it('should return true with multiple occupants to the left', () => {
      // Furniture: [occupant1, occupant2, null, actor]
      // occupant2 is closest to actor
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 3 };
          }
          if (
            entityId === 'occupant2' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', 'occupant2', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant2' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(true);
    });

    it('should return false when candidate is not the closest left occupant', () => {
      // Furniture: [occupant1, occupant2, null, actor]
      // occupant1 is not closest (occupant2 is closer)
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 3 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', 'occupant2', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('does not match candidate')
      );
    });

    it('should return false when actor is not sitting', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          // No sitting_on for actor
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Actor')
      );
    });

    it('should return false when candidate is not sitting', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          // No sitting_on for candidate
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Candidate')
      );
    });

    it('should return false when actor and candidate on different furniture', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture2', spot_index: 0 };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
    });

    it('should return false when actor is not on the target furniture', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'otherFurniture', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('is not sitting on target furniture')
      );
    });

    it('should return false when candidate is to the right of actor', () => {
      // Furniture: [actor, occupant1, null]
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', 'occupant1', null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('not to the left')
      );
    });

    it('should return false when spot immediately to the left is occupied', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', 'occupant2', 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('cannot scoot')
      );
    });

    it('should return false when candidate is at same position as actor', () => {
      // Edge case - should not happen in practice
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: [null, 'actor1', null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
    });

    it('should return false when no occupant to the left of actor', () => {
      // Furniture: [null, null, actor]
      // Candidate claims spot 0 but it's actually null - consistency check fails
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: [null, null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      // Candidate claims spot but furniture shows different - consistency error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Candidate')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle two-spot furniture with immediate neighbor', () => {
      // Furniture: [occupant1, null, actor]
      // The spot immediately to the left must be empty for scoot_closer action
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(true);
    });

    it('should handle invalid furniture ID (no allows_sitting component)', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          // No allows_sitting component
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
    });

    it('should return false when no occupant exists to the left', () => {
      const actorIndex = 3;
      const candidateIndex = 1;
      let candidateAccessCount = 0;

      const spotsProxy = new Proxy([], {
        get(target, prop) {
          if (prop === 'length') {
            return 4;
          }

          const index = Number(prop);
          if (Number.isNaN(index)) {
            return target[prop];
          }

          if (index === actorIndex) {
            return 'actor1';
          }

          if (index === candidateIndex) {
            candidateAccessCount += 1;
            return candidateAccessCount === 1 ? 'occupant1' : null;
          }

          if (index === actorIndex - 1) {
            return null;
          }

          return null;
        },
      });

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: actorIndex };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: candidateIndex };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: spotsProxy };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No occupant found')
      );
    });

    it('should handle out-of-bounds actor spot_index', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 10 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('out of bounds')
      );
    });

    it('should handle out-of-bounds candidate spot_index', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: -1 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: [null, null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('out of bounds')
      );
    });

    it('should handle mismatch between actor spot_index and actual spot', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'otherActor'] }; // Mismatch
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor')
      );
    });

    it('should handle mismatch between candidate spot_index and actual spot', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['otherOccupant', null, 'actor1'] }; // Mismatch
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Candidate')
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should handle missing actor parameter', () => {
      const result = operator.evaluate(['entity', 'target'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing required actor parameter')
      );
    });

    it('should handle invalid actor path', () => {
      const result = operator.evaluate(['entity', 'target', 'invalidPath'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve actor')
      );
    });

    it('should handle invalid spot_index type for actor', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 'invalid' };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, null] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid spot_index values')
      );
    });

    it('should handle invalid spot_index type for candidate', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'actor1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
          if (
            entityId === 'occupant1' &&
            componentId === 'positioning:sitting_on'
          ) {
            return { furniture_id: 'furniture1', spot_index: null };
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['occupant1', null, 'actor1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid spot_index values')
      );
    });
  });
});
