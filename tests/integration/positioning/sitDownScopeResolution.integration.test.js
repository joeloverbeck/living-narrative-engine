/**
 * @file Integration test for sit_down action scope resolution
 * @description Tests that entities with positioning:allows_sitting component are properly discovered by scopes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EntityManager } from '../../../src/entities/entityManager.js';
import { EventBus } from '../../../src/events/eventBus.js';
import { ComponentRegistry } from '../../../src/components/componentRegistry.js';
import { EntityLifecycleManager } from '../../../src/entities/services/entityLifecycleManager.js';
import { EntityRepositoryAdapter } from '../../../src/entities/services/entityRepositoryAdapter.js';
import { EntityQueryManager } from '../../../src/entities/managers/EntityQueryManager.js';
import { ScopeEngine } from '../../../src/scopeDsl/engine.js';
import { ScopeRegistry } from '../../../src/scopeDsl/scopeRegistry.js';
import { createMockLogger } from '../../common/mocks/mockLogger.js';
import { EntityDefinition } from '../../../src/entities/entityDefinition.js';
import { EntityInstanceData } from '../../../src/entities/entityInstanceData.js';
import { Entity } from '../../../src/entities/entity.js';
import { ComponentRegistryUtility } from '../../../src/components/componentRegistryUtility.js';

describe('Sit Down Scope Resolution - Integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let eventBus;
  let componentRegistry;
  let entityRepository;

  beforeEach(() => {
    logger = createMockLogger();
    eventBus = new EventBus({ logger });
    componentRegistry = new ComponentRegistry({ logger });
    
    // Create entity repository
    entityRepository = new EntityRepositoryAdapter({ logger });

    // Create entity managers
    const entityQueryManager = new EntityQueryManager({ 
      logger, 
      entityRepository 
    });
    
    const entityLifecycleManager = new EntityLifecycleManager({ 
      logger,
      eventBus,
      entityRepository,
      componentRegistry
    });

    entityManager = new EntityManager({
      logger,
      componentRegistry,
      eventRepository: entityRepository,
      queryManager: entityQueryManager,
      lifecycleManager: entityLifecycleManager,
      eventBus
    });

    // Create scope engine and registry
    scopeRegistry = new ScopeRegistry({ logger });
    scopeEngine = new ScopeEngine({ 
      logger, 
      scopeRegistry,
      errorHandler: null 
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('positioning:available_furniture scope resolution', () => {
    it('should find park bench entity with allows_sitting component at same location', () => {
      // Define the positioning:allows_sitting component
      componentRegistry.registerComponent({
        id: 'positioning:allows_sitting',
        dataSchema: {
          type: 'object',
          properties: {
            spots: {
              type: 'array',
              items: { type: ['null', 'string'] }
            }
          },
          required: ['spots']
        }
      });

      // Define the core:position component
      componentRegistry.registerComponent({
        id: 'core:position',
        dataSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string' }
          },
          required: ['locationId']
        }
      });

      // Define the core:actor component  
      componentRegistry.registerComponent({
        id: 'core:actor',
        dataSchema: {
          type: 'object',
          properties: {
            isPlayerControlled: { type: 'boolean' }
          }
        }
      });

      // Define core:name component
      componentRegistry.registerComponent({
        id: 'core:name',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      });

      // Create park bench definition
      const parkBenchDef = new EntityDefinition({
        id: 'test:park_bench',
        components: {
          'core:name': { text: 'park bench' },
          'positioning:allows_sitting': { spots: [null, null] }
        }
      });

      // Create park bench instance
      const parkBenchInstanceData = new EntityInstanceData({
        instanceId: 'test:park_bench_instance',
        definitionId: 'test:park_bench',
        definition: parkBenchDef,
        overrides: {
          'core:position': { locationId: 'test:park' }
        }
      });
      const parkBenchEntity = new Entity(parkBenchInstanceData);

      // Create actor definition
      const actorDef = new EntityDefinition({
        id: 'test:actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:actor': { isPlayerControlled: false },
          'core:position': { locationId: 'test:park' }
        }
      });

      // Create actor instance
      const actorInstanceData = new EntityInstanceData({
        instanceId: 'test:actor_instance',
        definitionId: 'test:actor', 
        definition: actorDef,
        overrides: {}
      });
      const actorEntity = new Entity(actorInstanceData);

      // Add entities to manager
      entityManager.addEntity(parkBenchEntity);
      entityManager.addEntity(actorEntity);

      // Register the scope
      scopeRegistry.registerScope(
        'positioning:available_furniture',
        `entities(positioning:allows_sitting)[][{
          "and": [
            {
              "==": [
                {"var": "entity.components.core:position.locationId"},
                {"var": "actor.components.core:position.locationId"}
              ]
            },
            {
              "some": [
                {"var": "entity.components.positioning:allows_sitting.spots"},
                {"==": [{"var": ""}, null]}
              ]
            }
          ]
        }]`
      );

      // Create runtime context with entity manager
      const runtimeCtx = {
        entityManager,
        componentRegistry
      };

      // Resolve the scope
      const result = scopeEngine.resolve(
        'positioning:available_furniture',
        {
          actorEntity,
          runtimeCtx
        }
      );

      // Verify the park bench was found
      expect(result).toBeDefined();
      expect(result.size).toBe(1);
      expect(result.has('test:park_bench_instance')).toBe(true);

      // Additional verification: Check that getEntitiesWithComponent works
      const entitiesWithSitting = entityManager.getEntitiesWithComponent('positioning:allows_sitting');
      expect(entitiesWithSitting).toBeDefined();
      expect(entitiesWithSitting.length).toBe(1);
      expect(entitiesWithSitting[0].id).toBe('test:park_bench_instance');
    });

    it('should not find entities with allows_sitting at different locations', () => {
      // Define components (same as above)
      componentRegistry.registerComponent({
        id: 'positioning:allows_sitting',
        dataSchema: {
          type: 'object',
          properties: {
            spots: {
              type: 'array',
              items: { type: ['null', 'string'] }
            }
          },
          required: ['spots']
        }
      });

      componentRegistry.registerComponent({
        id: 'core:position',
        dataSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string' }
          },
          required: ['locationId']
        }
      });

      componentRegistry.registerComponent({
        id: 'core:actor',
        dataSchema: {
          type: 'object',
          properties: {
            isPlayerControlled: { type: 'boolean' }
          }
        }
      });

      componentRegistry.registerComponent({
        id: 'core:name',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      });

      // Create park bench at different location
      const parkBenchDef = new EntityDefinition({
        id: 'test:park_bench',
        components: {
          'core:name': { text: 'park bench' },
          'positioning:allows_sitting': { spots: [null, null] }
        }
      });

      const parkBenchInstanceData = new EntityInstanceData({
        instanceId: 'test:park_bench_instance',
        definitionId: 'test:park_bench',
        definition: parkBenchDef,
        overrides: {
          'core:position': { locationId: 'test:different_location' } // Different location
        }
      });
      const parkBenchEntity = new Entity(parkBenchInstanceData);

      // Create actor at park
      const actorDef = new EntityDefinition({
        id: 'test:actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:actor': { isPlayerControlled: false },
          'core:position': { locationId: 'test:park' } // Different from bench
        }
      });

      const actorInstanceData = new EntityInstanceData({
        instanceId: 'test:actor_instance',
        definitionId: 'test:actor',
        definition: actorDef,
        overrides: {}
      });
      const actorEntity = new Entity(actorInstanceData);

      // Add entities
      entityManager.addEntity(parkBenchEntity);
      entityManager.addEntity(actorEntity);

      // Register the scope
      scopeRegistry.registerScope(
        'positioning:available_furniture',
        `entities(positioning:allows_sitting)[][{
          "and": [
            {
              "==": [
                {"var": "entity.components.core:position.locationId"},
                {"var": "actor.components.core:position.locationId"}
              ]
            },
            {
              "some": [
                {"var": "entity.components.positioning:allows_sitting.spots"},
                {"==": [{"var": ""}, null]}
              ]
            }
          ]
        }]`
      );

      // Resolve the scope
      const result = scopeEngine.resolve(
        'positioning:available_furniture',
        {
          actorEntity,
          runtimeCtx: {
            entityManager,
            componentRegistry
          }
        }
      );

      // Should find no entities since they're at different locations
      expect(result).toBeDefined();
      expect(result.size).toBe(0);
    });

    it('should find entities only with available spots', () => {
      // Define components
      componentRegistry.registerComponent({
        id: 'positioning:allows_sitting',
        dataSchema: {
          type: 'object',
          properties: {
            spots: {
              type: 'array',
              items: { type: ['null', 'string'] }
            }
          },
          required: ['spots']
        }
      });

      componentRegistry.registerComponent({
        id: 'core:position',
        dataSchema: {
          type: 'object',
          properties: {
            locationId: { type: 'string' }
          },
          required: ['locationId']
        }
      });

      componentRegistry.registerComponent({
        id: 'core:actor',
        dataSchema: {
          type: 'object',
          properties: {
            isPlayerControlled: { type: 'boolean' }
          }
        }
      });

      componentRegistry.registerComponent({
        id: 'core:name',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      });

      // Create occupied bench (all spots taken)
      const occupiedBenchDef = new EntityDefinition({
        id: 'test:occupied_bench',
        components: {
          'core:name': { text: 'occupied bench' },
          'positioning:allows_sitting': { 
            spots: ['occupant1', 'occupant2'] // All spots occupied
          }
        }
      });

      const occupiedBenchInstanceData = new EntityInstanceData({
        instanceId: 'test:occupied_bench_instance',
        definitionId: 'test:occupied_bench',
        definition: occupiedBenchDef,
        overrides: {
          'core:position': { locationId: 'test:park' }
        }
      });
      const occupiedBenchEntity = new Entity(occupiedBenchInstanceData);

      // Create available bench (has null spots)
      const availableBenchDef = new EntityDefinition({
        id: 'test:available_bench',
        components: {
          'core:name': { text: 'available bench' },
          'positioning:allows_sitting': { 
            spots: [null, 'occupant1'] // One spot available
          }
        }
      });

      const availableBenchInstanceData = new EntityInstanceData({
        instanceId: 'test:available_bench_instance',
        definitionId: 'test:available_bench',
        definition: availableBenchDef,
        overrides: {
          'core:position': { locationId: 'test:park' }
        }
      });
      const availableBenchEntity = new Entity(availableBenchInstanceData);

      // Create actor
      const actorDef = new EntityDefinition({
        id: 'test:actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:actor': { isPlayerControlled: false },
          'core:position': { locationId: 'test:park' }
        }
      });

      const actorInstanceData = new EntityInstanceData({
        instanceId: 'test:actor_instance',
        definitionId: 'test:actor',
        definition: actorDef,
        overrides: {}
      });
      const actorEntity = new Entity(actorInstanceData);

      // Add entities
      entityManager.addEntity(occupiedBenchEntity);
      entityManager.addEntity(availableBenchEntity);
      entityManager.addEntity(actorEntity);

      // Register the scope
      scopeRegistry.registerScope(
        'positioning:available_furniture',
        `entities(positioning:allows_sitting)[][{
          "and": [
            {
              "==": [
                {"var": "entity.components.core:position.locationId"},
                {"var": "actor.components.core:position.locationId"}
              ]
            },
            {
              "some": [
                {"var": "entity.components.positioning:allows_sitting.spots"},
                {"==": [{"var": ""}, null]}
              ]
            }
          ]
        }]`
      );

      // Resolve the scope
      const result = scopeEngine.resolve(
        'positioning:available_furniture',
        {
          actorEntity,
          runtimeCtx: {
            entityManager,
            componentRegistry
          }
        }
      );

      // Should find only the available bench
      expect(result).toBeDefined();
      expect(result.size).toBe(1);
      expect(result.has('test:available_bench_instance')).toBe(true);
      expect(result.has('test:occupied_bench_instance')).toBe(false);
    });
  });
});