import { jest } from '@jest/globals';
import createStepResolver from '../../../../src/scopeDsl/nodes/stepResolver.js';
import {
  createMockEntity,
  createTestEntity,
} from '../../../common/mockFactories/entities.js';

describe('StepResolver - components edge access', () => {
  let resolver;
  let entitiesGateway;
  let dispatcher;
  let trace;

  beforeEach(() => {
    // Mock entitiesGateway
    entitiesGateway = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };

    // Mock dispatcher
    dispatcher = {
      resolve: jest.fn(),
    };

    // Mock trace
    trace = {
      addLog: jest.fn(),
    };

    resolver = createStepResolver({ entitiesGateway });
  });

  describe('resolve with components field', () => {
    it('should build components object from production entity with componentTypeIds', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Mock a production entity with componentTypeIds
      const productionEntity = {
        id: 'entity1',
        componentTypeIds: ['core:name', 'core:position', 'core:actor'],
        getComponentData: jest.fn((componentId) => {
          const data = {
            'core:name': { first: 'John', last: 'Doe' },
            'core:position': { location: 'loc1', x: 10, y: 20 },
            'core:actor': { type: 'npc' },
          };
          return data[componentId];
        }),
      };

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));
      entitiesGateway.getEntityInstance.mockReturnValue(productionEntity);

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(1);
      const components = [...result][0];
      expect(components).toEqual({
        'core:name': { first: 'John', last: 'Doe' },
        'core:position': { location: 'loc1', x: 10, y: 20 },
        'core:actor': { type: 'npc' },
      });
    });

    it('should handle test entity with plain components object', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Create a test entity using the mock factory (should have componentTypeIds getter now)
      const testEntity = createTestEntity('entity1', {
        'core:name': { first: 'Jane', last: 'Smith' },
        'core:position': { location: 'loc2', x: 5, y: 15 },
      });

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));
      entitiesGateway.getEntityInstance.mockReturnValue(testEntity);

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(1);
      const components = [...result][0];
      expect(components).toEqual({
        'core:name': { first: 'Jane', last: 'Smith' },
        'core:position': { location: 'loc2', x: 5, y: 15 },
      });
    });

    it('should return components directly for entities from getEntity() (without componentTypeIds)', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Mock an entity from getEntity() - has components but no componentTypeIds
      // This is a VALID format returned by entityManager.getEntity()
      const entityFromGetEntity = {
        id: 'entity1',
        components: {
          'core:name': { first: 'Valid', last: 'Entity' },
          'core:position': { location: 'loc3' },
        },
        // No componentTypeIds - this is expected for entities from getEntity()
      };

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));
      entitiesGateway.getEntityInstance.mockReturnValue(entityFromGetEntity);

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(1);
      const components = [...result][0];
      // Should return the entity's components directly (fast path optimization)
      expect(components).toEqual({
        'core:name': { first: 'Valid', last: 'Entity' },
        'core:position': { location: 'loc3' },
      });
    });

    it('should fallback to entitiesGateway.getComponentData when entity lacks getComponentData method', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Mock entity with componentTypeIds but no getComponentData method
      const entityWithoutMethod = {
        id: 'entity1',
        componentTypeIds: ['core:name', 'core:actor'],
      };

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));
      entitiesGateway.getEntityInstance.mockReturnValue(entityWithoutMethod);

      // Mock the gateway's getComponentData
      entitiesGateway.getComponentData.mockImplementation(
        (entityId, componentId) => {
          const data = {
            'core:name': { first: 'Gateway', last: 'Data' },
            'core:actor': { type: 'player' },
          };
          return data[componentId];
        }
      );

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(1);
      const components = [...result][0];
      expect(components).toEqual({
        'core:name': { first: 'Gateway', last: 'Data' },
        'core:actor': { type: 'player' },
      });
      expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
        'entity1',
        'core:name'
      );
      expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
        'entity1',
        'core:actor'
      );
    });

    it('should handle entity not found in gateway', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['nonexistent']));
      entitiesGateway.getEntityInstance.mockReturnValue(null);

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(0);
    });

    it('should handle multiple entities with components field', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const entity1 = createMockEntity('entity1', { isActor: true });
      const entity2 = createTestEntity('entity2', {
        'core:position': { location: 'loc1' },
      });

      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));
      entitiesGateway.getEntityInstance
        .mockReturnValueOnce(entity1)
        .mockReturnValueOnce(entity2);

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      const componentsArray = [...result];

      // First entity should have core:actor component
      expect(componentsArray[0]).toHaveProperty('core:actor');

      // Second entity should have core:position component
      expect(componentsArray[1]).toEqual({
        'core:position': { location: 'loc1' },
      });
    });

    it('should not apply components logic for non-string parent values', () => {
      const node = { type: 'Step', field: 'components', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const obj = { components: { custom: 'data' } };
      dispatcher.resolve.mockReturnValue(new Set([obj]));

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(1);
      const components = [...result][0];
      // Should extract components property from object, not use entity logic
      expect(components).toEqual({ custom: 'data' });
      expect(entitiesGateway.getEntityInstance).not.toHaveBeenCalled();
    });
  });
});
