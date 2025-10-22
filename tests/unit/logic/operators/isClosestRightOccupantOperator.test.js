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
        if (entityId === 'actor1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        if (entityId === 'occupant1' && componentId === 'positioning:sitting_on') {
          return { furniture_id: 'furniture1', spot_index: 1 };
        }
        if (entityId === 'furniture1' && componentId === 'positioning:allows_sitting') {
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
