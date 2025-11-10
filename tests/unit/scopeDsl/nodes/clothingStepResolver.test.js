import { describe, it, expect, beforeEach } from '@jest/globals';
import createClothingStepResolver from '../../../../src/scopeDsl/nodes/clothingStepResolver.js';
import { ScopeDslError } from '../../../../src/scopeDsl/errors/scopeDslError.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('ClothingStepResolver', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockEquipmentData;
  let mockContext;
  let mockErrorHandler;

  beforeEach(() => {
    // Setup mocks and test data
    mockEquipmentData = {
      equipped: {
        torso_upper: {
          outer: 'jacket_1',
          base: 'shirt_1',
          underwear: 'undershirt_1',
        },
        torso_lower: {
          outer: 'pants_1',
          base: 'shorts_1',
        },
        feet: {
          outer: 'boots_1',
        },
        legs: {
          base: 'leggings_1',
          underwear: 'underwear_legs_1',
        },
      },
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(mockEquipmentData),
    };

    mockErrorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn().mockReturnValue([]),
    };

    resolver = createClothingStepResolver({
      entitiesGateway: mockEntitiesGateway,
      errorHandler: mockErrorHandler,
    });

    mockContext = {
      dispatcher: {
        resolve: jest.fn().mockReturnValue(new Set(['actor_1'])),
      },
      trace: {
        addLog: jest.fn(),
      },
    };
  });

  describe('canResolve', () => {
    it('should return true for topmost_clothing field', () => {
      const node = { type: 'Step', field: 'topmost_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for all_clothing field', () => {
      const node = { type: 'Step', field: 'all_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for outer_clothing field', () => {
      const node = { type: 'Step', field: 'outer_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for base_clothing field', () => {
      const node = { type: 'Step', field: 'base_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for underwear field', () => {
      const node = { type: 'Step', field: 'underwear' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return false for non-clothing fields', () => {
      const node = { type: 'Step', field: 'regular_component' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for non-Step nodes', () => {
      const node = { type: 'Source', field: 'topmost_clothing' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for Step nodes without field', () => {
      const node = { type: 'Step' };
      expect(resolver.canResolve(node)).toBe(false);
    });
  });

  describe('resolve - clothing access objects', () => {
    it('should return clothing access object for topmost_clothing', () => {
      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return a Set containing one clothing access object
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.__isClothingAccessObject).toBe(true);
      expect(clothingAccess.mode).toBe('topmost');
      expect(clothingAccess.equipped).toBe(mockEquipmentData.equipped);
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'clothing:equipment'
      );
    });

    it('should return clothing access object for all_clothing', () => {
      const node = {
        type: 'Step',
        field: 'all_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return a Set containing one clothing access object with mode 'all'
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.__isClothingAccessObject).toBe(true);
      expect(clothingAccess.mode).toBe('all');
      expect(clothingAccess.equipped).toBe(mockEquipmentData.equipped);
    });

    it('should return clothing access object with empty equipped when no equipment exists', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.equipped).toEqual({});
      expect(clothingAccess.mode).toBe('topmost');
    });

    it('should return clothing access object with empty equipped when equipment has no equipped property', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue({});

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);
      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.equipped).toEqual({});
      expect(clothingAccess.mode).toBe('topmost');
    });

    it('should skip non-string parent results', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 123, null, { id: 'actor_2' }])
      );

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should only process the string entity ID
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledTimes(1);
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'clothing:equipment'
      );
      expect(result.size).toBe(1); // One clothing access object
    });
  });

  describe('layer-specific clothing access objects', () => {
    it('should create clothing access object with outer mode', () => {
      const node = {
        type: 'Step',
        field: 'outer_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.mode).toBe('outer');
    });

    it('should create clothing access object with base mode', () => {
      const node = {
        type: 'Step',
        field: 'base_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.mode).toBe('base');
    });

    it('should create clothing access object with underwear mode', () => {
      const node = {
        type: 'Step',
        field: 'underwear',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const clothingAccess = Array.from(result)[0];
      expect(clothingAccess.__clothingSlotAccess).toBe(true);
      expect(clothingAccess.mode).toBe('underwear');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple entities correctly', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 'actor_2'])
      );

      const equipment1 = {
        equipped: {
          torso_upper: { outer: 'jacket_1' },
        },
      };

      const equipment2 = {
        equipped: {
          torso_upper: { outer: 'jacket_2' },
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor_1') return equipment1;
        if (entityId === 'actor_2') return equipment2;
        return null;
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return two clothing access objects, one for each entity
      expect(result.size).toBe(2);
      const accessObjects = Array.from(result);
      expect(accessObjects[0].equipped).toBe(equipment1.equipped);
      expect(accessObjects[1].equipped).toBe(equipment2.equipped);
    });
  });

  describe('trace logging', () => {
    it('should work without trace context', () => {
      mockContext.trace = null;

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      // Should not throw
      expect(() => resolver.resolve(node, mockContext)).not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should call errorHandler for invalid entity ID', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set([''])); // Empty string passes type check but fails validation

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid entity ID provided to ClothingStepResolver',
        expect.objectContaining({
          entityId: '',
          field: 'topmost_clothing',
        }),
        'ClothingStepResolver',
        ErrorCodes.INVALID_ENTITY_ID
      );
    });

    it('should skip non-string entity identifiers returned from dispatcher', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set([123]));

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
      expect(mockEntitiesGateway.getComponentData).not.toHaveBeenCalled();
    });

    it('should call errorHandler for invalid clothing field', () => {
      const node = {
        type: 'Step',
        field: 'invalid_clothing_field',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid clothing reference'),
        expect.objectContaining({
          field: 'invalid_clothing_field',
        }),
        'ClothingStepResolver',
        ErrorCodes.INVALID_ENTITY_ID
      );
    });

    it('should call errorHandler for component retrieval failure', () => {
      mockEntitiesGateway.getComponentData.mockImplementation(() => {
        throw new Error('Component retrieval failed');
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve clothing component'),
        expect.objectContaining({
          entityId: 'actor_1',
          field: 'topmost_clothing',
          originalError: 'Component retrieval failed',
        }),
        'ClothingStepResolver',
        ErrorCodes.COMPONENT_RESOLUTION_FAILED
      );
    });

    it('should call errorHandler when parent resolution fails', () => {
      mockContext.dispatcher.resolve.mockImplementation(() => {
        throw new Error('Dispatcher exploded');
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Failed to resolve parent node: Dispatcher exploded',
        expect.objectContaining({
          field: 'topmost_clothing',
          parentNode: node.parent,
          originalError: 'Dispatcher exploded',
        }),
        'ClothingStepResolver',
        ErrorCodes.STEP_RESOLUTION_FAILED
      );
    });

    it('should call errorHandler for invalid node structure', () => {
      const invalidNode = null;

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(invalidNode, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid node provided to ClothingStepResolver',
        expect.objectContaining({
          node: null,
        }),
        'ClothingStepResolver',
        ErrorCodes.INVALID_NODE_STRUCTURE
      );
    });

    it('should call errorHandler for missing dispatcher', () => {
      const contextWithoutDispatcher = { trace: { addLog: jest.fn() } };

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, contextWithoutDispatcher);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid context or missing dispatcher',
        expect.objectContaining({
          hasContext: true,
          hasDispatcher: false,
        }),
        'ClothingStepResolver',
        ErrorCodes.MISSING_DISPATCHER
      );
    });

    it('should work without errorHandler for backward compatibility', () => {
      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      // Should not throw even with valid data
      expect(() => {
        resolverWithoutHandler.resolve(node, mockContext);
      }).not.toThrow();
    });
  });

  describe('Error handling without optional errorHandler', () => {
    it('should tolerate invalid entity identifiers without errorHandler', () => {
      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const context = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set([123])),
        },
      };

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
      expect(mockEntitiesGateway.getComponentData).not.toHaveBeenCalled();
    });

    it('should handle non-string clothing fields when errorHandler is absent', () => {
      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const node = {
        type: 'Step',
        field: { invalid: true },
        parent: { type: 'Source' },
      };

      const context = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set(['actor_1'])),
        },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
      expect(mockEntitiesGateway.getComponentData).not.toHaveBeenCalled();
    });

    it('should recover from component lookup failures without errorHandler', () => {
      const entitiesGatewayWithoutHandler = {
        getComponentData: jest.fn(() => {
          throw new Error('Component missing');
        }),
      };

      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: entitiesGatewayWithoutHandler,
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const context = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set(['actor_1'])),
        },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
      expect(entitiesGatewayWithoutHandler.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'clothing:equipment'
      );
    });

    it('should handle parent resolution failures gracefully without errorHandler', () => {
      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const context = {
        dispatcher: {
          resolve: jest.fn(() => {
            throw new Error('Dispatcher exploded');
          }),
        },
      };

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
    });

    it('should safely ignore invalid nodes when errorHandler is not provided', () => {
      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const result = resolverWithoutHandler.resolve(null, mockContext);

      expect(result).toEqual(new Set());
    });

    it('should return an empty result when dispatcher is missing without errorHandler', () => {
      const resolverWithoutHandler = createClothingStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const context = { trace: { addLog: jest.fn() } };

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        parent: { type: 'Source' },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
    });
  });
});
