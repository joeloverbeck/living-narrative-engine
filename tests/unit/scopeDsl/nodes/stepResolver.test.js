import { jest } from '@jest/globals';
import createStepResolver from '../../../../src/scopeDsl/nodes/stepResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';

describe('StepResolver', () => {
  let resolver;
  let resolverWithErrorHandler;
  let entitiesGateway;
  let dispatcher;
  let trace;
  let consoleErrorSpy;
  let errorHandler;

  beforeEach(() => {
    // Mock entitiesGateway
    entitiesGateway = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    // Mock dispatcher
    dispatcher = {
      resolve: jest.fn(),
    };

    // Mock trace
    trace = {
      addLog: jest.fn(),
    };

    // Mock errorHandler
    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(),
    };

    // Spy on console.error for error logging tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Create resolver without errorHandler (legacy behavior)
    resolver = createStepResolver({ entitiesGateway });

    // Create resolver with errorHandler (new behavior)
    resolverWithErrorHandler = createStepResolver({
      entitiesGateway,
      errorHandler,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('canResolve', () => {
    it('should return true for Step nodes', () => {
      const node = { type: 'Step' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return false for non-Step nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Union' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
    });
  });

  describe('resolve', () => {
    describe('error handling', () => {
      it('should throw error when actorEntity is missing from context (without errorHandler)', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const ctx = { dispatcher, trace }; // Missing actorEntity

        expect(() => resolver.resolve(node, ctx)).toThrow(
          'StepResolver: actorEntity is missing from context'
        );
      });

      it('should use error handler when actorEntity is missing from context (with errorHandler)', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const ctx = { dispatcher, trace }; // Missing actorEntity

        const result = resolverWithErrorHandler.resolve(node, ctx);

        expect(result).toEqual(new Set()); // Should return empty set
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'StepResolver: actorEntity is missing from context',
          }),
          expect.objectContaining({
            dispatcher,
            trace,
            nodeType: 'Step',
            field: 'name',
            parentNodeType: undefined,
          }),
          'StepResolver',
          'SCOPE_1001' // ErrorCodes.MISSING_ACTOR
        );
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should throw error when context is null', () => {
        const node = { type: 'Step', field: 'name', parent: {} };

        expect(() => resolver.resolve(node, null)).toThrow();
      });

      it('should throw error when context is undefined', () => {
        const node = { type: 'Step', field: 'name', parent: {} };

        expect(() => resolver.resolve(node, undefined)).toThrow();
      });
    });

    describe('basic field resolution', () => {
      it('should resolve field from entity', () => {
        const node = { type: 'Step', field: 'core:name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getComponentData.mockReturnValue({
          first: 'John',
          last: 'Doe',
        });

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set([{ first: 'John', last: 'Doe' }]));
        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'entity1',
          'core:name'
        );
      });

      it('should resolve field from object', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const obj = { name: 'Test Object', value: 42 };
        dispatcher.resolve.mockReturnValue(new Set([obj]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set(['Test Object']));
      });

      it('should return empty set when parent result is empty', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set());

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should handle undefined field values from entities', () => {
        const node = { type: 'Step', field: 'nonexistent', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getComponentData.mockReturnValue(undefined);

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should handle undefined field values from objects', () => {
        const node = { type: 'Step', field: 'nonexistent', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const obj = { name: 'Test' };
        dispatcher.resolve.mockReturnValue(new Set([obj]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should handle null field values from objects', () => {
        const node = { type: 'Step', field: 'nullable', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const obj = { nullable: null, other: 'value' };
        dispatcher.resolve.mockReturnValue(new Set([obj]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set([null]));
      });

      it('should search within all component data when field not found as component', () => {
        const node = { type: 'Step', field: 'health', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const entity = {
          id: 'entity1',
          componentTypeIds: ['core:stats', 'core:position'],
        };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getEntityInstance.mockReturnValue(entity);

        // First call returns undefined (not a component)
        entitiesGateway.getComponentData
          .mockReturnValueOnce(undefined)
          // Then return component data for each componentTypeId
          .mockReturnValueOnce({ health: 100, mana: 50 })
          .mockReturnValueOnce({ x: 10, y: 20 });

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set([100]));
        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'entity1',
          'health'
        );
        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'entity1',
          'core:stats'
        );
      });

      it('should handle non-object component data when searching fields', () => {
        const node = { type: 'Step', field: 'value', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const entity = {
          id: 'entity1',
          componentTypeIds: ['core:simple', 'core:array', 'core:complex'],
        };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getEntityInstance.mockReturnValue(entity);

        // First call returns undefined (not a component)
        entitiesGateway.getComponentData
          .mockReturnValueOnce(undefined)
          // Then return various types of component data
          .mockReturnValueOnce('string-value') // string, not object
          .mockReturnValueOnce([1, 2, 3]) // array
          .mockReturnValueOnce({ value: 42 }); // object with the field

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set([42]));
      });

      it('should use error handler when entity component access throws', () => {
        const node = { type: 'Step', field: 'core:name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getComponentData.mockImplementation(() => {
          throw new Error('Component lookup failed');
        });

        const result = resolverWithErrorHandler.resolve(node, ctx);

        expect(result).toEqual(new Set());
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message:
              "StepResolver: Failed to extract field 'core:name' from entity 'entity1': Component lookup failed",
          }),
          { entityId: 'entity1', field: 'core:name', originalError: 'Component lookup failed' },
          'StepResolver',
          'SCOPE_3004'
        );
      });
    });

    describe('location.entities() special case', () => {
      it('should handle location.entities(componentId) with matching entities', () => {
        const node = {
          type: 'Step',
          field: 'entities',
          param: 'core:npc',
          parent: { type: 'Source', kind: 'location' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['location1']));

        const entitiesWithComponent = [
          { id: 'npc1' },
          { id: 'npc2' },
          { id: 'npc3' },
        ];
        entitiesGateway.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        // Mock position data for entities
        entitiesGateway.getComponentData
          .mockReturnValueOnce({ locationId: 'location1' }) // npc1 is at location1
          .mockReturnValueOnce({ locationId: 'location2' }) // npc2 is at location2
          .mockReturnValueOnce({ locationId: 'location1' }); // npc3 is at location1

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set(['npc1', 'npc3']));
        expect(entitiesGateway.getEntitiesWithComponent).toHaveBeenCalledWith(
          'core:npc'
        );
        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'npc1',
          'core:position'
        );
        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'npc2',
          'core:position'
        );
        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'npc3',
          'core:position'
        );
      });

      it('should return empty set when no entities have the component', () => {
        const node = {
          type: 'Step',
          field: 'entities',
          param: 'core:rare',
          parent: { type: 'Source', kind: 'location' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['location1']));
        entitiesGateway.getEntitiesWithComponent.mockReturnValue(null);

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should return empty set when no entities are at the location', () => {
        const node = {
          type: 'Step',
          field: 'entities',
          param: 'core:npc',
          parent: { type: 'Source', kind: 'location' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['location1']));

        const entitiesWithComponent = [{ id: 'npc1' }, { id: 'npc2' }];
        entitiesGateway.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        // All entities are at different locations
        entitiesGateway.getComponentData
          .mockReturnValueOnce({ locationId: 'location2' })
          .mockReturnValueOnce({ locationId: 'location3' });

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should handle entities without position component', () => {
        const node = {
          type: 'Step',
          field: 'entities',
          param: 'core:item',
          parent: { type: 'Source', kind: 'location' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['location1']));

        const entitiesWithComponent = [{ id: 'item1' }, { id: 'item2' }];
        entitiesGateway.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        // No position component data
        entitiesGateway.getComponentData
          .mockReturnValueOnce(undefined)
          .mockReturnValueOnce(undefined);

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should only apply special logic for location.entities pattern', () => {
        // Test that entities field on non-location source doesn't trigger special logic
        const node = {
          type: 'Step',
          field: 'entities',
          param: 'core:npc',
          parent: { type: 'Source', kind: 'actor' }, // Not location
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['actor1']));
        entitiesGateway.getComponentData.mockReturnValue([
          'entity1',
          'entity2',
        ]);

        const result = resolver.resolve(node, ctx);

        // Should use normal field resolution, not special location logic
        expect(result).toEqual(new Set([['entity1', 'entity2']]));
        expect(entitiesGateway.getEntitiesWithComponent).not.toHaveBeenCalled();
      });
    });

    describe('multiple parent values', () => {
      it('should handle multiple entity parent values', () => {
        const node = { type: 'Step', field: 'core:name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));
        entitiesGateway.getComponentData
          .mockReturnValueOnce({ first: 'John', last: 'Doe' })
          .mockReturnValueOnce({ first: 'Jane', last: 'Smith' });

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(
          new Set([
            { first: 'John', last: 'Doe' },
            { first: 'Jane', last: 'Smith' },
          ])
        );
      });

      it('should handle mixed entity and object parent values', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const obj = { name: 'Object Name' };
        dispatcher.resolve.mockReturnValue(new Set(['entity1', obj]));
        entitiesGateway.getComponentData.mockReturnValue({
          first: 'Entity',
          last: 'Name',
        });

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(
          new Set([{ first: 'Entity', last: 'Name' }, 'Object Name'])
        );
      });
    });

    describe('diagnostics and complex parent values', () => {
      it('should log diagnostics for object field access when logger is available', () => {
        const node = { type: 'Step', field: 'core:details', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const logger = { debug: jest.fn() };
        const ctx = {
          dispatcher,
          trace,
          actorEntity,
          runtimeCtx: { logger },
        };

        const parentObject = {
          'core:details': 'revealed',
          extra: true,
        };

        dispatcher.resolve.mockReturnValue(new Set([parentObject]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set(['revealed']));
        expect(logger.debug).toHaveBeenCalledWith(
          '[DIAGNOSTIC] StepResolver - Accessing field from object:',
          expect.objectContaining({
            field: 'core:details',
            hasField: true,
            valuePreview: 'revealed',
            valueType: 'string',
            objectKeys: expect.arrayContaining(['core:details', 'extra']),
          })
        );
      });

      it('should collect values from Set parent objects', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const nestedSet = new Set([
          { name: 'Alpha', extra: 1 },
          { name: 'Beta', extra: 2 },
        ]);

        dispatcher.resolve.mockReturnValue(new Set([nestedSet]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set(['Alpha', 'Beta']));
      });

      it('should use error handler when logger diagnostics throw during component resolution', () => {
        const node = { type: 'Step', field: 'components', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const failingLogger = {
          debug: jest.fn(() => {
            throw new Error('logger failed');
          }),
        };
        const ctx = {
          dispatcher,
          trace,
          actorEntity,
          runtimeCtx: { logger: failingLogger },
        };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getEntityInstance.mockReturnValue({
          componentTypeIds: ['core:info'],
        });
        entitiesGateway.getComponentData.mockReturnValue({ description: 'test' });

        const result = resolverWithErrorHandler.resolve(node, ctx);

        expect(result).toEqual(new Set());
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message:
              "StepResolver: Failed to resolve entity parent value for field 'components' on entity 'entity1': logger failed",
          }),
          { entityId: 'entity1', field: 'components', originalError: 'logger failed' },
          'StepResolver',
          'SCOPE_3005'
        );
      });
    });

    describe('trace logging', () => {
      it('should log trace messages when trace is provided', () => {
        const node = { type: 'Step', field: 'test', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getComponentData.mockReturnValue('test-value');

        resolver.resolve(node, ctx);
      });

      it('should not log trace messages when trace is not provided', () => {
        const node = { type: 'Step', field: 'test', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace: null, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set(['entity1']));
        entitiesGateway.getComponentData.mockReturnValue('test-value');

        // Should not throw
        expect(() => resolver.resolve(node, ctx)).not.toThrow();
      });
    });

    describe('edge cases', () => {
      it('should handle null parent values', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set([null]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should handle numeric parent values', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set([123]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should handle boolean parent values', () => {
        const node = { type: 'Step', field: 'name', parent: {} };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        dispatcher.resolve.mockReturnValue(new Set([true, false]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should pass full context to dispatcher when resolving parent', () => {
        const node = {
          type: 'Step',
          field: 'name',
          parent: { type: 'Source' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = {
          dispatcher,
          trace,
          actorEntity,
          depth: 5,
          customProp: 'value',
        };

        dispatcher.resolve.mockReturnValue(new Set());

        resolver.resolve(node, ctx);

        expect(dispatcher.resolve).toHaveBeenCalledWith(
          { type: 'Source' },
          ctx
        );
      });
    });
  });
});
