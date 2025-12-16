import { describe, it, expect, beforeEach } from '@jest/globals';
import { IsActorLocationLitOperator } from '../../../../src/logic/operators/isActorLocationLitOperator.js';

describe('IsActorLocationLitOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLightingStateService;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLightingStateService = {
      isLocationLit: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    operator = new IsActorLocationLitOperator({
      entityManager: mockEntityManager,
      lightingStateService: mockLightingStateService,
      logger: mockLogger,
    });

    mockContext = {};
  });

  describe('Basic Functionality', () => {
    it('should return true when location is lit', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:position'
      );
      expect(mockLightingStateService.isLocationLit).toHaveBeenCalledWith(
        'location1'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Location location1 isLit=true')
      );
    });

    it('should return false when location is dark', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockReturnValue(false);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLightingStateService.isLocationLit).toHaveBeenCalledWith(
        'location1'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Location location1 isLit=false')
      );
    });
  });

  describe('Fail Open Behavior', () => {
    it('should return true when actor has no position component (fail open)', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor1 has no position component or locationId - failing open'
        )
      );
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });

    it('should return true when position component has no locationId (fail open)', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({});

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Actor actor1 has no position component or locationId - failing open'
        )
      );
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });

    it('should return true when locationId is null (fail open)', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: null,
      });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(true);
      expect(mockLightingStateService.isLocationLit).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Validation', () => {
    it('should return false with invalid parameters (null)', () => {
      const result = operator.evaluate(null, mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: Invalid parameters'
      );
    });

    it('should return false with invalid parameters (empty array)', () => {
      const result = operator.evaluate([], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: Invalid parameters'
      );
    });

    it('should return false with invalid parameters (not an array)', () => {
      const result = operator.evaluate('actor', mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: Invalid parameters'
      );
    });
  });

  describe('Entity Resolution', () => {
    it('should return false when entity not found at path', () => {
      mockContext.actor = undefined;

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: No entity found at path actor'
      );
    });

    it('should handle nested entity paths', () => {
      mockContext.event = { actor: { id: 'nestedActor1' } };

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const result = operator.evaluate(['event.actor'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'nestedActor1',
        'core:position'
      );
    });

    it('should handle entity ID as string', () => {
      mockContext.actorId = 'actor1';

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockReturnValue(true);

      const result = operator.evaluate(['actorId'], mockContext);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:position'
      );
    });

    it('should handle entity ID as number', () => {
      mockContext.actorId = 123;

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockReturnValue(true);

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
        'isActorLocationLit: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is empty string', () => {
      mockContext.actor = { id: '' };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is whitespace only', () => {
      mockContext.actor = { id: '   ' };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: Invalid entity at path actor'
      );
    });

    it('should return false when entity ID is NaN', () => {
      mockContext.actor = { id: NaN };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isActorLocationLit: Invalid entity at path actor'
      );
    });
  });

  describe('Dependency Validation', () => {
    it('should throw error when entityManager is not provided', () => {
      expect(() => {
        new IsActorLocationLitOperator({
          lightingStateService: mockLightingStateService,
          logger: mockLogger,
        });
      }).toThrow('IsActorLocationLitOperator: Missing required dependencies');
    });

    it('should throw error when lightingStateService is not provided', () => {
      expect(() => {
        new IsActorLocationLitOperator({
          entityManager: mockEntityManager,
          logger: mockLogger,
        });
      }).toThrow('IsActorLocationLitOperator: Missing required dependencies');
    });

    it('should throw error when logger is not provided', () => {
      expect(() => {
        new IsActorLocationLitOperator({
          entityManager: mockEntityManager,
          lightingStateService: mockLightingStateService,
        });
      }).toThrow('IsActorLocationLitOperator: Missing required dependencies');
    });

    it('should throw error when all dependencies are missing', () => {
      expect(() => {
        new IsActorLocationLitOperator({});
      }).toThrow('IsActorLocationLitOperator: Missing required dependencies');
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
        'isActorLocationLit: Error during evaluation',
        expect.any(Error)
      );
    });

    it('should handle errors from lightingStateService gracefully', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockImplementation(() => {
        throw new Error('Lighting service error');
      });

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'isActorLocationLit: Error during evaluation',
        expect.any(Error)
      );
    });
  });

  describe('Context Isolation', () => {
    it('should NOT mutate the original context object', () => {
      mockContext.actor = { id: 'actor1' };

      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'location1',
      });

      mockLightingStateService.isLocationLit.mockReturnValue(true);

      operator.evaluate(['actor'], mockContext);

      // Original context should NOT be mutated (context isolation)
      expect(mockContext._currentPath).toBeUndefined();
    });
  });
});
