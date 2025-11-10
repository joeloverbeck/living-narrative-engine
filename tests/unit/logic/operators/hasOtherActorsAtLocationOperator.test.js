import { describe, it, expect, beforeEach } from '@jest/globals';
import { HasOtherActorsAtLocationOperator } from '../../../../src/logic/operators/hasOtherActorsAtLocationOperator.js';

describe('HasOtherActorsAtLocationOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    // Create a mock array for entities
    const mockEntitiesArray = [];

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      // Mock the entities getter
      get entities() {
        return mockEntitiesArray[Symbol.iterator]();
      },
    };

    // Store reference to the array so tests can modify it
    mockEntityManager._mockEntitiesArray = mockEntitiesArray;

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    operator = new HasOtherActorsAtLocationOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    mockContext = {};
  });

  describe('Basic Functionality', () => {
    it('should return true when other actors are at the same location', () => {
      // Setup: actor1 and actor2 both at location1
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor1' || entityId === 'actor2') {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'actor1' },
        { id: 'actor2' }
      );

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:position'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 other actors at location location1')
      );
    });

    it('should return false when actor is alone at location', () => {
      // Setup: only actor1 at location1
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor1') {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push({ id: 'actor1' });

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 other actors at location location1')
      );
    });

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
  });

  describe('Edge Cases', () => {
    it('should return true when multiple actors are at the same location', () => {
      // Setup: actor1, actor2, and actor3 all at location1
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (
          entityId === 'actor1' ||
          entityId === 'actor2' ||
          entityId === 'actor3'
        ) {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'actor1' },
        { id: 'actor2' },
        { id: 'actor3' }
      );

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 other actors at location location1')
      );
    });

    it('should return false when only non-actor entities are present', () => {
      // Setup: actor1 and furniture1 at location1
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor1' || entityId === 'furniture1') {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'actor1' },
        { id: 'furniture1' }
      );

      mockEntityManager.hasComponent.mockImplementation((entityId) => {
        return entityId === 'actor1'; // Only actor1 is an actor
      });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 other actors at location location1')
      );
    });

    it('should not count actors at different locations', () => {
      // Setup: actor1 at location1, actor2 at location2
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor1') {
          return { locationId: 'location1' };
        }
        if (entityId === 'actor2') {
          return { locationId: 'location2' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'actor1' },
        { id: 'actor2' }
      );

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 other actors at location location1')
      );
    });

    it('should exclude the acting actor from the count', () => {
      // Setup: actor1 (the actor) and actor2 at location1
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor1' || entityId === 'actor2') {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'actor1' },
        { id: 'actor2' }
      );

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      // Should find 1 other actor (actor2), not 2
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 other actors at location location1')
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should return false with invalid parameters (null)', () => {
      const result = operator.evaluate(null, mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Invalid parameters'
      );
    });

    it('should return false with invalid parameters (empty array)', () => {
      const result = operator.evaluate([], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Invalid parameters'
      );
    });

    it('should return false with invalid parameters (not an array)', () => {
      const result = operator.evaluate('actor', mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Invalid parameters'
      );
    });
  });

  describe('Entity Resolution', () => {
    it('should return false when entity not found at path', () => {
      mockContext.actor = undefined;

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: No entity found at path actor'
      );
    });

    it('should handle nested entity paths', () => {
      mockContext.event = { actor: { id: 'nestedActor1' } };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'nestedActor1' || entityId === 'actor2') {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'nestedActor1' },
        { id: 'actor2' }
      );

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['event.actor'], mockContext);

      expect(result).toBe(true);
    });

    it('should handle entity ID as string', () => {
      mockContext.actorId = 'actor1';

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor1' || entityId === 'actor2') {
          return { locationId: 'location1' };
        }
        return null;
      });

      mockEntityManager._mockEntitiesArray.push(
        { id: 'actor1' },
        { id: 'actor2' }
      );

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['actorId'], mockContext);

      expect(result).toBe(true);
    });

    it('should return false when entity ID is null', () => {
      mockContext.actor = { id: null };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is empty string', () => {
      mockContext.actor = { id: '' };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is NaN', () => {
      mockContext.actor = { id: NaN };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Invalid entity at path actor'
      );
    });
  });

  describe('Dependency Validation', () => {
    it('should throw error when entityManager is not provided', () => {
      expect(() => {
        new HasOtherActorsAtLocationOperator({
          logger: mockLogger,
        });
      }).toThrow('HasOtherActorsAtLocationOperator: Missing required dependencies');
    });

    it('should throw error when logger is not provided', () => {
      expect(() => {
        new HasOtherActorsAtLocationOperator({
          entityManager: mockEntityManager,
        });
      }).toThrow('HasOtherActorsAtLocationOperator: Missing required dependencies');
    });

    it('should throw error when both dependencies are missing', () => {
      expect(() => {
        new HasOtherActorsAtLocationOperator({});
      }).toThrow('HasOtherActorsAtLocationOperator: Missing required dependencies');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during evaluation gracefully', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'hasOtherActorsAtLocation: Error during evaluation',
        expect.any(Error)
      );
    });
  });
});
