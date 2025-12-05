import { describe, it, expect, beforeEach } from '@jest/globals';
import createBodyPartStepResolver from '../../../../src/scopeDsl/nodes/bodyPartStepResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('BodyPartStepResolver', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockBodyData;
  let mockContext;
  let mockErrorHandler;

  beforeEach(() => {
    // Setup mock body component data
    mockBodyData = {
      body: {
        root: 'body_root_part_1',
        parts: {
          body_root_part_1: { children: ['head_part_1', 'torso_part_1'] },
          head_part_1: { children: ['beak_part_1'] },
          beak_part_1: { children: [] },
          torso_part_1: { children: [] },
        },
      },
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(mockBodyData),
    };

    mockErrorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn().mockReturnValue([]),
    };

    resolver = createBodyPartStepResolver({
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
    it('should return true for body_parts field', () => {
      const node = { type: 'Step', field: 'body_parts' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for all_body_parts field', () => {
      const node = { type: 'Step', field: 'all_body_parts' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return false for non-body-part fields', () => {
      const node = { type: 'Step', field: 'regular_component' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for non-Step nodes', () => {
      const node = { type: 'Source', field: 'body_parts' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for Step nodes without field', () => {
      const node = { type: 'Step' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for null node', () => {
      expect(resolver.canResolve(null)).toBe(false);
    });

    it('should return false for undefined node', () => {
      expect(resolver.canResolve(undefined)).toBe(false);
    });
  });

  describe('resolve - body part access objects', () => {
    it('should return body part access object for body_parts', () => {
      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return a Set containing one body part access object
      expect(result.size).toBe(1);
      const bodyPartAccess = Array.from(result)[0];
      expect(bodyPartAccess.__isBodyPartAccessObject).toBe(true);
      expect(bodyPartAccess.__bodyPartAccess).toBe(true);
      expect(bodyPartAccess.mode).toBe('all');
      expect(bodyPartAccess.entityId).toBe('actor_1');
      expect(bodyPartAccess.bodyComponent).toBe(mockBodyData);
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'anatomy:body'
      );
    });

    it('should return body part access object for all_body_parts', () => {
      const node = {
        type: 'Step',
        field: 'all_body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(1);
      const bodyPartAccess = Array.from(result)[0];
      expect(bodyPartAccess.__isBodyPartAccessObject).toBe(true);
      expect(bodyPartAccess.mode).toBe('all');
    });

    it('should return empty Set when entity has no anatomy:body component', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(0);
    });

    it('should return empty Set when entity has undefined anatomy:body', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(undefined);

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result.size).toBe(0);
    });

    it('should skip non-string parent results', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 123, null, { id: 'actor_2' }])
      );

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should only process the string entity ID
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledTimes(1);
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'anatomy:body'
      );
      expect(result.size).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple entities correctly', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 'actor_2'])
      );

      const bodyData1 = {
        body: {
          root: 'root_1',
          parts: { root_1: { children: [] } },
        },
      };

      const bodyData2 = {
        body: {
          root: 'root_2',
          parts: { root_2: { children: [] } },
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor_1') return bodyData1;
        if (entityId === 'actor_2') return bodyData2;
        return null;
      });

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return two body part access objects, one for each entity
      expect(result.size).toBe(2);
      const accessObjects = Array.from(result);
      expect(accessObjects[0].bodyComponent).toBe(bodyData1);
      expect(accessObjects[1].bodyComponent).toBe(bodyData2);
    });

    it('should handle mixed entities (some with, some without body)', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set(['actor_1', 'actor_2', 'actor_3'])
      );

      mockEntitiesGateway.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'actor_1') return mockBodyData;
        if (entityId === 'actor_2') return null; // No body
        if (entityId === 'actor_3') return mockBodyData;
        return null;
      });

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return two body part access objects (actor_2 excluded)
      expect(result.size).toBe(2);
    });
  });

  describe('trace logging', () => {
    it('should work without trace context', () => {
      mockContext.trace = null;

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      // Should not throw
      expect(() => resolver.resolve(node, mockContext)).not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should call errorHandler for invalid entity ID', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set([''])); // Empty string

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid entity ID provided to BodyPartStepResolver',
        expect.objectContaining({
          entityId: '',
          field: 'body_parts',
        }),
        'BodyPartStepResolver',
        ErrorCodes.INVALID_ENTITY_ID
      );
    });

    it('should skip non-string entity identifiers returned from dispatcher', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set([123]));

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
      expect(mockEntitiesGateway.getComponentData).not.toHaveBeenCalled();
    });

    it('should call errorHandler for invalid body part field', () => {
      const node = {
        type: 'Step',
        field: 'invalid_body_part_field',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid body part reference'),
        expect.objectContaining({
          field: 'invalid_body_part_field',
        }),
        'BodyPartStepResolver',
        ErrorCodes.INVALID_ENTITY_ID
      );
    });

    it('should call errorHandler for component retrieval failure', () => {
      mockEntitiesGateway.getComponentData.mockImplementation(() => {
        throw new Error('Component retrieval failed');
      });

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve body component'),
        expect.objectContaining({
          entityId: 'actor_1',
          field: 'body_parts',
          originalError: 'Component retrieval failed',
        }),
        'BodyPartStepResolver',
        ErrorCodes.COMPONENT_RESOLUTION_FAILED
      );
    });

    it('should call errorHandler when parent resolution fails', () => {
      mockContext.dispatcher.resolve.mockImplementation(() => {
        throw new Error('Dispatcher exploded');
      });

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Failed to resolve parent node: Dispatcher exploded',
        expect.objectContaining({
          field: 'body_parts',
          parentNode: node.parent,
          originalError: 'Dispatcher exploded',
        }),
        'BodyPartStepResolver',
        ErrorCodes.STEP_RESOLUTION_FAILED
      );
    });

    it('should call errorHandler for invalid node structure', () => {
      const invalidNode = null;

      mockErrorHandler.handleError.mockClear();

      const result = resolver.resolve(invalidNode, mockContext);

      expect(result).toEqual(new Set());
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid node provided to BodyPartStepResolver',
        expect.objectContaining({
          node: null,
        }),
        'BodyPartStepResolver',
        ErrorCodes.INVALID_NODE_STRUCTURE
      );
    });

    it('should call errorHandler for missing dispatcher', () => {
      const contextWithoutDispatcher = { trace: { addLog: jest.fn() } };

      const node = {
        type: 'Step',
        field: 'body_parts',
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
        'BodyPartStepResolver',
        ErrorCodes.MISSING_DISPATCHER
      );
    });

    it('should work without errorHandler for backward compatibility', () => {
      const resolverWithoutHandler = createBodyPartStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const node = {
        type: 'Step',
        field: 'body_parts',
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
      const resolverWithoutHandler = createBodyPartStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const context = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set([123])),
        },
      };

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
      expect(mockEntitiesGateway.getComponentData).not.toHaveBeenCalled();
    });

    it('should handle non-string body part fields when errorHandler is absent', () => {
      const resolverWithoutHandler = createBodyPartStepResolver({
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
      const entitiesGatewayWithError = {
        getComponentData: jest.fn(() => {
          throw new Error('Component missing');
        }),
      };

      const resolverWithoutHandler = createBodyPartStepResolver({
        entitiesGateway: entitiesGatewayWithError,
      });

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const context = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set(['actor_1'])),
        },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
      expect(entitiesGatewayWithError.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'anatomy:body'
      );
    });

    it('should handle parent resolution failures gracefully without errorHandler', () => {
      const resolverWithoutHandler = createBodyPartStepResolver({
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
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
    });

    it('should safely ignore invalid nodes when errorHandler is not provided', () => {
      const resolverWithoutHandler = createBodyPartStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const result = resolverWithoutHandler.resolve(null, mockContext);

      expect(result).toEqual(new Set());
    });

    it('should return an empty result when dispatcher is missing without errorHandler', () => {
      const resolverWithoutHandler = createBodyPartStepResolver({
        entitiesGateway: mockEntitiesGateway,
      });

      const context = { trace: { addLog: jest.fn() } };

      const node = {
        type: 'Step',
        field: 'body_parts',
        parent: { type: 'Source' },
      };

      const result = resolverWithoutHandler.resolve(node, context);

      expect(result).toEqual(new Set());
    });
  });
});
