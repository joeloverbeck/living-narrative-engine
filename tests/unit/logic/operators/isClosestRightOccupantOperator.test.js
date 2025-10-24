import { describe, it, expect, beforeEach } from '@jest/globals';
import { IsClosestRightOccupantOperator } from '../../../../src/logic/operators/isClosestRightOccupantOperator.js';
import { createTestBed } from '../../../common/testBed.js';

describe('IsClosestRightOccupantOperator', () => {
  let testBed;
  let operator;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('IEntityManager', ['getComponentData']);
    operator = new IsClosestRightOccupantOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Validation Logic', () => {
    it('should warn and return false when actor parameter is missing', () => {
      const result = operator.evaluate(['entity', 'target'], {
        entity: { id: 'candidate1' },
        target: { id: 'furniture1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing required actor parameter')
      );
    });

    it('should resolve actor from a custom context path', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'candidate1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', null, 'candidate1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'companion'], {
        entity: { id: 'candidate1' },
        target: { id: 'furniture1' },
        companion: { id: 'actor1' },
      });

      expect(result).toBe(true);
    });

    it('should resolve actor when provided directly as an id', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', null, 'occupant1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: 'actor1',
      });

      expect(result).toBe(true);
    });

    it('should resolve actor from a custom path when provided as an id', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'candidate1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', null, 'candidate1'] };
          }
          return null;
        }
      );

      const result = operator.evaluate(['entity', 'target', 'companion'], {
        entity: { id: 'candidate1' },
        target: { id: 'furniture1' },
        companion: 'actor1',
      });

      expect(result).toBe(true);
    });

    it('should return true when candidate is the closest right occupant', () => {
      // Furniture: [actor1, null, occupant1]
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, 'occupant1'] };
        }
        return null;
      });

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('matches')
      );
    });

    it('should return true with multiple occupants to the right', () => {
      // Furniture: [actor1, null, occupant1, occupant2]
      // occupant1 is closest right occupant
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, 'occupant1', 'occupant2'] };
        }
        return null;
      });

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant1' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(true);
    });

    it('should return false when candidate is not the closest right occupant', () => {
      // Furniture: [actor1, null, occupant1, occupant2]
      // occupant2 is not closest (occupant1 is closer)
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant2' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 3 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, 'occupant1', 'occupant2'] };
        }
        return null;
      });

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant2' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('does not match')
      );
    });

    it('should return false when the spot immediately to the right is occupied', () => {
      // Furniture: [actor1, occupant1, occupant2]
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'positioning:sitting_on') {
          if (entityId === 'actor1') {
            return { furniture_id: 'furniture1', spot_index: 0 };
          }
          if (entityId === 'occupant1') {
            return { furniture_id: 'furniture1', spot_index: 1 };
          }
          if (entityId === 'occupant2') {
            return { furniture_id: 'furniture1', spot_index: 2 };
          }
        }
        if (
          entityId === 'furniture1' &&
          componentId === 'positioning:allows_sitting'
        ) {
          return { spots: ['actor1', 'occupant1', 'occupant2'] };
        }
        return null;
      });

      const result = operator.evaluate(['entity', 'target', 'actor'], {
        entity: { id: 'occupant2' },
        target: { id: 'furniture1' },
        actor: { id: 'actor1' },
      });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('cannot scoot')
      );
    });

    it('should return false when actor is not sitting', () => {
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        return null;
      });

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
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, null] };
        }
        return null;
      });

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

    it('should handle mismatch between actor spot_index and furniture state', () => {
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: [null, null, 'occupant1'] };
        }
        return null;
      });

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

    it('should handle mismatch between candidate spot_index and furniture state', () => {
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, null] };
        }
        return null;
      });

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

    it('should return false when actor is not sitting on the target furniture', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture2', spot_index: 0 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['someoneElse', null, 'occupant1'] };
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
        expect.stringContaining('not sitting on target furniture')
      );
    });

    it('should return false when candidate is not sitting on the target furniture', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture2', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', null, 'someoneElse'] };
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
        expect.stringContaining('Candidate occupant1 is not sitting on target furniture')
      );
    });

    it('should return false when spot indices are invalid', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: '0' };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', null, 'occupant1'] };
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

    it('should return false when candidate is not to the right of the actor', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 1 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['someoneElse', 'occupant1', 'actor1'] };
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
        expect.stringContaining('is not to the right of actor')
      );
    });

    it('should return false when furniture spots data is invalid', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: 'not-an-array' };
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
        expect.stringContaining('invalid spots property')
      );
    });

    it('should return false when indices are out of bounds', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 3 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: ['actor1', null, null] };
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
        expect.stringContaining('Indices out of bounds')
      );
    });

    it('should return false when no occupant is found to the right of the actor', () => {
      const dynamicSpots = ['actor1', null, null];
      let accessCount = 0;
      Object.defineProperty(dynamicSpots, 2, {
        configurable: true,
        enumerable: true,
        get() {
          accessCount += 1;
          return accessCount === 1 ? 'occupant1' : null;
        },
      });

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'positioning:sitting_on') {
            if (entityId === 'actor1') {
              return { furniture_id: 'furniture1', spot_index: 0 };
            }
            if (entityId === 'occupant1') {
              return { furniture_id: 'furniture1', spot_index: 2 };
            }
          }
          if (
            entityId === 'furniture1' &&
            componentId === 'positioning:allows_sitting'
          ) {
            return { spots: dynamicSpots };
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
        expect.stringContaining('No occupant found to the right')
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
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 'invalid' };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, 'occupant1'] };
        }
        return null;
      });

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
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: null };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
          return { spots: ['actor1', null, 'occupant1'] };
        }
        return null;
      });

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
