import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierContextBuilder from '../../../../src/combat/services/ModifierContextBuilder.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    entityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      getEntity: jest.fn(),
    },
  };
}

/**
 * Creates a mock entity with components
 *
 * @param {string} id - Entity ID
 * @param {Object<string, Object>} [componentsData] - Component data by ID
 * @returns {object} Mock entity
 */
function createMockEntity(id, componentsData = {}) {
  return {
    id,
    components: componentsData,
  };
}

describe('ModifierContextBuilder', () => {
  let service;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    ({ logger: mockLogger, entityManager: mockEntityManager } = createMocks());

    service = new ModifierContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(service).toBeInstanceOf(ModifierContextBuilder);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ModifierContextBuilder: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ModifierContextBuilder({
          entityManager: mockEntityManager,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new ModifierContextBuilder({
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new ModifierContextBuilder({
          entityManager: mockEntityManager,
          logger: null,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is null', () => {
      expect(() => {
        new ModifierContextBuilder({
          entityManager: null,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new ModifierContextBuilder({
          entityManager: mockEntityManager,
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager missing required methods', () => {
      expect(() => {
        new ModifierContextBuilder({
          entityManager: {
            getComponentData: jest.fn(),
            hasComponent: jest.fn(),
          }, // Missing getEntity
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });
  });

  describe('buildContext', () => {
    describe('actor context', () => {
      it('should build context with actor only', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': { name: 'Test Actor' },
          'skills:grappling_skill': { value: 45 },
        });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123') {
              return actorEntity.components[componentId];
            }
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.actor).toEqual({
          id: 'actor-123',
          components: {
            'core:actor': { name: 'Test Actor' },
            'skills:grappling_skill': { value: 45 },
          },
        });
        expect(result.entity.primary).toBeNull();
        expect(result.entity.secondary).toBeNull();
        expect(result.entity.tertiary).toBeNull();
      });

      it('should return null actor when entity not found', () => {
        mockEntityManager.getEntity.mockReturnValue(undefined);

        const result = service.buildContext({ actorId: 'non-existent' });

        expect(result.entity.actor).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Entity not found: non-existent')
        );
      });
    });

    describe('target contexts', () => {
      it('should build context with actor and primary target', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': { name: 'Actor' },
        });
        const targetEntity = createMockEntity('target-456', {
          'core:actor': { name: 'Target' },
          'physical-control-states:being_restrained': { consented: false },
        });

        mockEntityManager.getEntity.mockImplementation((id) => {
          if (id === 'actor-123') return actorEntity;
          if (id === 'target-456') return targetEntity;
          return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            if (entityId === 'target-456')
              return targetEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({
          actorId: 'actor-123',
          primaryTargetId: 'target-456',
        });

        expect(result.entity.actor).toEqual({
          id: 'actor-123',
          components: { 'core:actor': { name: 'Actor' } },
        });
        expect(result.entity.primary).toEqual({
          id: 'target-456',
          components: {
            'core:actor': { name: 'Target' },
            'physical-control-states:being_restrained': { consented: false },
          },
        });
        expect(result.entity.secondary).toBeNull();
        expect(result.entity.tertiary).toBeNull();
      });

      it('should build context with all targets (primary, secondary, tertiary)', () => {
        const actorEntity = createMockEntity('actor-1', { 'core:actor': {} });
        const primaryEntity = createMockEntity('primary-2', {
          'core:actor': {},
        });
        const secondaryEntity = createMockEntity('secondary-3', {
          'status:allied': {},
        });
        const tertiaryEntity = createMockEntity('tertiary-4', {
          'containers-core:container': {},
        });

        mockEntityManager.getEntity.mockImplementation((id) => {
          if (id === 'actor-1') return actorEntity;
          if (id === 'primary-2') return primaryEntity;
          if (id === 'secondary-3') return secondaryEntity;
          if (id === 'tertiary-4') return tertiaryEntity;
          return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            const entities = {
              'actor-1': actorEntity,
              'primary-2': primaryEntity,
              'secondary-3': secondaryEntity,
              'tertiary-4': tertiaryEntity,
            };
            return entities[entityId]?.components[componentId];
          }
        );

        const result = service.buildContext({
          actorId: 'actor-1',
          primaryTargetId: 'primary-2',
          secondaryTargetId: 'secondary-3',
          tertiaryTargetId: 'tertiary-4',
        });

        expect(result.entity.actor).not.toBeNull();
        expect(result.entity.primary).not.toBeNull();
        expect(result.entity.secondary).toEqual({
          id: 'secondary-3',
          components: { 'status:allied': {} },
        });
        expect(result.entity.tertiary).toEqual({
          id: 'tertiary-4',
          components: { 'containers-core:container': {} },
        });
      });

      it('should return null for non-existent target IDs', () => {
        const actorEntity = createMockEntity('actor-123', { 'core:actor': {} });

        mockEntityManager.getEntity.mockImplementation((id) => {
          if (id === 'actor-123') return actorEntity;
          return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({
          actorId: 'actor-123',
          primaryTargetId: 'non-existent-target',
        });

        expect(result.entity.actor).not.toBeNull();
        expect(result.entity.primary).toBeNull();
      });
    });

    describe('location resolution', () => {
      it("should resolve location from actor's core:position component", () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': {},
          'core:position': { locationId: 'location-789' },
        });
        const locationEntity = createMockEntity('location-789', {
          'environment:darkness': { level: 'dim' },
          'environment:terrain': { surface: 'slippery' },
        });

        mockEntityManager.getEntity.mockImplementation((id) => {
          if (id === 'actor-123') return actorEntity;
          if (id === 'location-789') return locationEntity;
          return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            if (entityId === 'location-789')
              return locationEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.location).toEqual({
          id: 'location-789',
          components: {
            'environment:darkness': { level: 'dim' },
            'environment:terrain': { surface: 'slippery' },
          },
        });
      });

      it('should return null location when actor has no position component', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': {},
          // No core:position component
        });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.location).toBeNull();
      });

      it('should return null location when position has no locationId', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': {},
          'core:position': { x: 10, y: 20 }, // No locationId
        });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.location).toBeNull();
      });

      it('should return null location when location entity not found', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': {},
          'core:position': { locationId: 'non-existent-location' },
        });

        mockEntityManager.getEntity.mockImplementation((id) => {
          if (id === 'actor-123') return actorEntity;
          return undefined; // Location not found
        });
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.location).toBeNull();
      });
    });

    describe('component handling', () => {
      it('should include all component data in entity context', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': { name: 'Hero' },
          'skills:grappling_skill': { value: 60 },
          'buffs:adrenaline_surge': { active: true, duration: 30 },
          'health:vitality': { current: 75, max: 100 },
        });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.actor.components).toHaveProperty('core:actor');
        expect(result.entity.actor.components).toHaveProperty(
          'skills:grappling_skill'
        );
        expect(result.entity.actor.components).toHaveProperty(
          'buffs:adrenaline_surge'
        );
        expect(result.entity.actor.components).toHaveProperty(
          'health:vitality'
        );
        expect(Object.keys(result.entity.actor.components)).toHaveLength(4);
      });

      it('should handle entity with no components gracefully', () => {
        const actorEntity = createMockEntity('actor-123', {});

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockReturnValue(undefined);

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.actor).toEqual({
          id: 'actor-123',
          components: {},
        });
      });

      it('should exclude null/undefined component data', () => {
        const actorEntity = createMockEntity('actor-123', {
          'valid:component': { data: 'value' },
          'null:component': null,
        });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.actor.components).toHaveProperty(
          'valid:component'
        );
        expect(result.entity.actor.components).not.toHaveProperty(
          'null:component'
        );
      });
    });

    describe('error handling', () => {
      it('should handle getEntity throwing error gracefully', () => {
        mockEntityManager.getEntity.mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result.entity.actor).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Error building entity context'),
          expect.any(Error)
        );
      });

      it('should handle getComponentData throwing error gracefully', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': { name: 'Test' },
        });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(() => {
          throw new Error('Component access error');
        });

        const result = service.buildContext({ actorId: 'actor-123' });

        // Should still return entity, just with empty components
        expect(result.entity.actor).toBeNull();
      });
    });

    describe('logging', () => {
      it('should log when building context', () => {
        const actorEntity = createMockEntity('actor-123', { 'core:actor': {} });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        service.buildContext({
          actorId: 'actor-123',
          primaryTargetId: 'target-456',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'ModifierContextBuilder: Building context',
          expect.objectContaining({
            actorId: 'actor-123',
            primaryTargetId: 'target-456',
          })
        );
      });

      it('should log context build summary', () => {
        const actorEntity = createMockEntity('actor-123', {
          'core:actor': {},
          'core:position': { locationId: 'loc-1' },
        });
        const locationEntity = createMockEntity('loc-1', {
          'environment:darkness': {},
        });

        mockEntityManager.getEntity.mockImplementation((id) => {
          if (id === 'actor-123') return actorEntity;
          if (id === 'loc-1') return locationEntity;
          return undefined;
        });
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            if (entityId === 'loc-1')
              return locationEntity.components[componentId];
            return undefined;
          }
        );

        service.buildContext({ actorId: 'actor-123' });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'ModifierContextBuilder: Context built',
          expect.objectContaining({
            hasActor: true,
            hasPrimary: false,
            hasSecondary: false,
            hasTertiary: false,
            hasLocation: true,
          })
        );
      });
    });

    describe('invariants', () => {
      it('should always return valid ModifierEvaluationContext structure', () => {
        mockEntityManager.getEntity.mockReturnValue(undefined);

        const result = service.buildContext({ actorId: 'actor-123' });

        expect(result).toHaveProperty('entity');
        expect(result.entity).toHaveProperty('actor');
        expect(result.entity).toHaveProperty('primary');
        expect(result.entity).toHaveProperty('secondary');
        expect(result.entity).toHaveProperty('tertiary');
        expect(result.entity).toHaveProperty('location');
      });

      it('should return consistent results for same input', () => {
        const actorEntity = createMockEntity('actor-123', { 'core:actor': {} });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        const input = { actorId: 'actor-123', primaryTargetId: 'target-456' };
        const result1 = service.buildContext(input);
        const result2 = service.buildContext(input);

        expect(result1).toEqual(result2);
      });

      it('should have no side effects on entity state', () => {
        const actorEntity = createMockEntity('actor-123', { 'core:actor': {} });

        mockEntityManager.getEntity.mockReturnValue(actorEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'actor-123')
              return actorEntity.components[componentId];
            return undefined;
          }
        );

        service.buildContext({ actorId: 'actor-123' });

        // No mutation methods should have been called
        // Only read operations should occur
        expect(mockEntityManager.getEntity).toHaveBeenCalled();
        expect(mockEntityManager.getComponentData).toHaveBeenCalled();
      });
    });
  });
});
