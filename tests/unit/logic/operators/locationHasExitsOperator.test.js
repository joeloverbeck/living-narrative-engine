import { describe, it, expect, beforeEach } from '@jest/globals';
import { LocationHasExitsOperator } from '../../../../src/logic/operators/locationHasExitsOperator.js';

describe('LocationHasExitsOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    operator = new LocationHasExitsOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    mockContext = {};
  });

  describe('Basic Functionality', () => {
    it('should return true when location has exits', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({
          exits: [
            { direction: 'north', destination: 'location2' },
            { direction: 'south', destination: 'location3' },
          ],
        });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:position'
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'location1',
        'locations:exits'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Location location1 hasExits=true (count=2)')
      );
    });

    it('should return false when location has empty exits array', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({ exits: [] });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Location location1 hasExits=false (count=0)')
      );
    });

    it('should return false when location has no exits component', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce(null);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Location location1 has no locations:exits component'
        )
      );
    });

    it('should handle exits directly on component (without nested exits property)', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce([{ direction: 'east', destination: 'location4' }]);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Location location1 hasExits=true (count=1)')
      );
    });
  });

  describe('Actor Position Handling', () => {
    it('should return false when actor has no position component', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor1 has no position component or locationId'
        )
      );
    });

    it('should return false when position component has no locationId', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({});

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor1 has no position component or locationId'
        )
      );
    });

    it('should return false when locationId is null', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({ locationId: null });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor1 has no position component or locationId'
        )
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should return false with invalid parameters (null)', () => {
      const result = operator.evaluate(null, mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid parameters'
      );
    });

    it('should return false with invalid parameters (empty array)', () => {
      const result = operator.evaluate([], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid parameters'
      );
    });

    it('should return false with invalid parameters (not an array)', () => {
      const result = operator.evaluate('actor', mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid parameters'
      );
    });

    it('should return false with undefined parameters', () => {
      const result = operator.evaluate(undefined, mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid parameters'
      );
    });
  });

  describe('Entity Resolution', () => {
    it('should return false when entity not found at path', () => {
      mockContext.actor = undefined;

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: No entity found at path actor'
      );
    });

    it('should handle nested entity paths', () => {
      mockContext.event = { actor: { id: 'nestedActor1' } };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({
          exits: [{ direction: 'west', destination: 'location5' }],
        });

      const result = operator.evaluate(['event.actor'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'nestedActor1',
        'core:position'
      );
    });

    it('should handle entity ID as string', () => {
      mockContext.actorId = 'actor1';

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({
          exits: [{ direction: 'north', destination: 'location2' }],
        });

      const result = operator.evaluate(['actorId'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:position'
      );
    });

    it('should handle entity ID as number', () => {
      mockContext.actorId = 123;

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({
          exits: [{ direction: 'south', destination: 'location3' }],
        });

      const result = operator.evaluate(['actorId'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        123,
        'core:position'
      );
    });

    it('should return false when entity ID is null', () => {
      mockContext.actor = { id: null };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is empty string', () => {
      mockContext.actor = { id: '' };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is whitespace only', () => {
      mockContext.actor = { id: '   ' };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is NaN', () => {
      mockContext.actor = { id: NaN };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'locationHasExits: Invalid entity at path actor'
      );
    });
  });

  describe('Dependency Validation', () => {
    it('should throw error when entityManager is not provided', () => {
      expect(() => {
        new LocationHasExitsOperator({
          logger: mockLogger,
        });
      }).toThrow('LocationHasExitsOperator: Missing required dependencies');
    });

    it('should throw error when logger is not provided', () => {
      expect(() => {
        new LocationHasExitsOperator({
          entityManager: mockEntityManager,
        });
      }).toThrow('LocationHasExitsOperator: Missing required dependencies');
    });

    it('should throw error when all dependencies are missing', () => {
      expect(() => {
        new LocationHasExitsOperator({});
      }).toThrow('LocationHasExitsOperator: Missing required dependencies');
    });

    it('should throw error when no dependencies object is passed', () => {
      expect(() => {
        new LocationHasExitsOperator();
      }).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during position component lookup gracefully', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'locationHasExits: Error during evaluation',
        expect.any(Error)
      );
    });

    it('should handle errors during exits component lookup gracefully', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockImplementationOnce(() => {
          throw new Error('Component fetch error');
        });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'locationHasExits: Error during evaluation',
        expect.any(Error)
      );
    });
  });

  describe('Context Isolation', () => {
    it('should NOT mutate the original context object', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({
          exits: [{ direction: 'north', destination: 'location2' }],
        });

      operator.evaluate(['actor'], mockContext);

      // Original context should NOT be mutated (context isolation)
      expect(mockContext._currentPath).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle exits property that is not an array', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({ exits: 'not-an-array' });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
    });

    it('should handle exits property that is an object', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({ exits: { north: 'location2' } });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
    });

    it('should handle multiple exits correctly', () => {
      mockContext.actor = { id: 'actor1' };

      const exits = [
        { direction: 'north', destination: 'location2' },
        { direction: 'south', destination: 'location3' },
        { direction: 'east', destination: 'location4' },
        { direction: 'west', destination: 'location5' },
      ];

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ locationId: 'location1' })
        .mockReturnValueOnce({ exits });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('count=4')
      );
    });
  });
});
