/**
 * @file Integration test for multi-target scope resolution with target context
 * @description This test validates that the scope DSL system properly handles
 * target context variables (target and targets) when resolving scopes that
 * depend on previously resolved target data. This is critical for the
 * contextFrom="primary" functionality in multi-target actions.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import SpatialIndexManager from '../../../src/entities/spatialIndexManager.js';
import { SpatialIndexSynchronizer } from '../../../src/entities/spatialIndexSynchronizer.js';
import { UnifiedScopeResolver } from '../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';

import {
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Multi-Target Scope Integration with Target Context', () => {
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let unifiedScopeResolver;
  let jsonLogicEval;
  let logger;
  let registry;
  let gameDataRepository;
  let safeEventDispatcher;
  let spatialIndexManager;
  let dslParser;
  let actionErrorContextBuilder;

  beforeEach(async () => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    registry = new InMemoryDataRegistry();

    // Set up event infrastructure with mocked validator
    const eventBus = new EventBus();
    const schemaValidator = {
      validate: jest.fn(() => true),
      addSchema: jest.fn(() => Promise.resolve()),
      removeSchema: jest.fn(() => true),
      getValidator: jest.fn(() => () => true),
      isSchemaLoaded: jest.fn(() => true),
    };
    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository: new GameDataRepository(registry, logger),
      schemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    // Set up spatial index infrastructure
    spatialIndexManager = new SpatialIndexManager({ logger });

    // Create real EntityManager with proper dependencies
    entityManager = new EntityManager({
      registry,
      validator: schemaValidator,
      logger,
      dispatcher: safeEventDispatcher,
    });

    // Set up SpatialIndexSynchronizer BEFORE creating entities
    new SpatialIndexSynchronizer({
      spatialIndexManager,
      safeEventDispatcher,
      logger,
    });

    // Set up entity definitions for testing
    const actorDefinition = new EntityDefinition('test:actor', {
      components: {
        [POSITION_COMPONENT_ID]: { locationId: null },
        [ACTOR_COMPONENT_ID]: { name: null },
        'test:inventory': { items: [] },
        'test:equipment': { equipped: {} },
      },
    });

    const itemDefinition = new EntityDefinition('test:item', {
      components: {
        'test:item': { name: null, type: null },
        'test:adjustable': { properties: [] },
      },
    });

    const containerDefinition = new EntityDefinition('test:container', {
      components: {
        [POSITION_COMPONENT_ID]: { locationId: null },
        'core:container': { locked: false, items: [] },
      },
    });

    registry.store('entityDefinitions', 'test:actor', actorDefinition);
    registry.store('entityDefinitions', 'test:item', itemDefinition);
    registry.store('entityDefinitions', 'test:container', containerDefinition);

    // Set up JSON Logic evaluation service
    jsonLogicEval = new JsonLogicEvaluationService({ logger });

    // Set up DSL parser
    dslParser = new DefaultDslParser();

    // Set up action error context builder with mock fix suggestion engine
    const mockFixSuggestionEngine = {
      suggestFixes: jest.fn(() => []),
    };

    actionErrorContextBuilder = new ActionErrorContextBuilder({
      logger,
      entityManager,
      fixSuggestionEngine: mockFixSuggestionEngine,
    });

    // Set up scope infrastructure
    scopeRegistry = new ScopeRegistry({ logger });
    scopeEngine = new ScopeEngine({
      entitiesGateway: {
        getEntityInstance: (id) => entityManager.getEntityInstance(id),
        getEntitiesWithComponent: (componentId) =>
          entityManager.getEntitiesWithComponent(componentId),
        hasComponent: (entityId, componentId) =>
          entityManager.hasComponent(entityId, componentId),
        getEntities: () => entityManager.getAllEntities(),
        getComponentData: (entityId, componentId) =>
          entityManager.getComponentData(entityId, componentId),
      },
      locationProvider: {
        getLocation: () => ({
          id: 'test_room',
          // Add entities method to return entities at this location
          entities: (componentId) => {
            if (componentId === ACTOR_COMPONENT_ID) {
              // Return all actors at this location
              return entityManager
                .getEntitiesWithComponent(ACTOR_COMPONENT_ID)
                .filter((entity) => {
                  const posData = entityManager.getComponentData(
                    entity.id,
                    POSITION_COMPONENT_ID
                  );
                  return posData && posData.locationId === 'test_room';
                });
            }
            return [];
          },
        }),
      },
      jsonLogicEval,
      logger,
    });

    // Set up unified scope resolver
    unifiedScopeResolver = new UnifiedScopeResolver({
      scopeRegistry,
      scopeEngine,
      entityManager,
      jsonLogicEvaluationService: jsonLogicEval,
      dslParser,
      logger,
      actionErrorContextBuilder,
    });

    // Create test entities
    await createTestEntities();
    await createTestScopes();
  });

  afterEach(() => {
    // Clean up any resources if needed
  });

  let playerId, npcId, jacketId, shirtId, toolId, containerId;

  /**
   *
   */
  async function createTestEntities() {
    // Create tool first so we can reference it
    const toolEntity = await entityManager.createEntityInstance('test:item');
    await entityManager.addComponent(toolEntity.id, 'test:item', {
      name: 'Lockpick',
      type: 'tool',
    });

    // Create player actor
    const playerEntity = await entityManager.createEntityInstance('test:actor');
    await entityManager.addComponent(playerEntity.id, POSITION_COMPONENT_ID, {
      locationId: 'test_room',
    });
    await entityManager.addComponent(playerEntity.id, ACTOR_COMPONENT_ID, {
      name: 'Player',
    });
    await entityManager.addComponent(playerEntity.id, 'test:inventory', {
      items: [toolEntity.id],
    });

    // Create adjustable jacket first
    const jacketEntity = await entityManager.createEntityInstance('test:item');
    await entityManager.addComponent(jacketEntity.id, 'test:item', {
      name: 'Red Jacket',
      type: 'clothing',
    });
    await entityManager.addComponent(jacketEntity.id, 'test:adjustable', {
      properties: ['adjustable', 'removable'],
    });

    // Create non-adjustable shirt
    const shirtEntity = await entityManager.createEntityInstance('test:item');
    await entityManager.addComponent(shirtEntity.id, 'test:item', {
      name: 'White Shirt',
      type: 'clothing',
    });
    await entityManager.addComponent(shirtEntity.id, 'test:adjustable', {
      properties: ['removable'],
    });

    // Create NPC actor with equipment using actual entity IDs
    const npcEntity = await entityManager.createEntityInstance('test:actor');
    await entityManager.addComponent(npcEntity.id, POSITION_COMPONENT_ID, {
      locationId: 'test_room',
    });
    await entityManager.addComponent(npcEntity.id, ACTOR_COMPONENT_ID, {
      name: 'Alice',
    });
    await entityManager.addComponent(npcEntity.id, 'test:equipment', {
      equipped: {
        torso_upper: {
          outer: jacketEntity.id,
          base: shirtEntity.id,
        },
      },
    });

    // Create locked container
    const containerEntity =
      await entityManager.createEntityInstance('test:container');
    await entityManager.addComponent(
      containerEntity.id,
      POSITION_COMPONENT_ID,
      {
        locationId: 'test_room',
      }
    );
    await entityManager.addComponent(containerEntity.id, 'core:container', {
      locked: true,
      items: ['treasure_001'],
    });

    // Store entity IDs for later reference
    playerId = playerEntity.id;
    npcId = npcEntity.id;
    jacketId = jacketEntity.id;
    shirtId = shirtEntity.id;
    toolId = toolEntity.id;
    containerId = containerEntity.id;
  }

  /**
   *
   */
  async function createTestScopes() {
    // Create scope definitions with parsed ASTs
    const scopeDefinitions = {
      'test:nearby_people': {
        id: 'test:nearby_people',
        expr: 'location.entities(core:actor)[]',
        ast: parseDslExpression('location.entities(core:actor)[]'),
      },
      'test:adjustable_clothing': {
        id: 'test:adjustable_clothing',
        expr: 'entities(test:item)[][{"and": [{"==": [{"var": "entity.id"}, {"var": "target.components.test:equipment.equipped.torso_upper.outer"}]}, {"in": ["adjustable", {"var": "entity.components.test:adjustable.properties"}]}]}]',
        ast: parseDslExpression(
          'entities(test:item)[][{"and": [{"==": [{"var": "entity.id"}, {"var": "target.components.test:equipment.equipped.torso_upper.outer"}]}, {"in": ["adjustable", {"var": "entity.components.test:adjustable.properties"}]}]}]'
        ),
      },
      'test:unlocking_tools': {
        id: 'test:unlocking_tools',
        expr: 'actor.test:inventory.items[][{"and": [{"==": [{"var": "entity.components.test:item.type"}, "tool"]}, {"==": [{"var": "target.components.core:container.locked"}, true]}]}]',
        ast: parseDslExpression(
          'actor.test:inventory.items[][{"and": [{"==": [{"var": "entity.components.test:item.type"}, "tool"]}, {"==": [{"var": "target.components.core:container.locked"}, true]}]}]'
        ),
      },
      'test:all_targets': {
        id: 'test:all_targets',
        expr: 'targets.primary[].id | targets.secondary[].id | targets.tertiary[].id',
        ast: parseDslExpression(
          'targets.primary[].id | targets.secondary[].id | targets.tertiary[].id'
        ),
      },
      'test:primary_targets': {
        id: 'test:primary_targets',
        expr: 'targets.primary[].id',
        ast: parseDslExpression('targets.primary[].id'),
      },
    };

    // Initialize the scope registry with all scope definitions
    scopeRegistry.initialize(scopeDefinitions);
  }

  describe('Target Context in Scope Resolution', () => {
    it('should resolve scope with target context for clothing adjustment', async () => {
      // Arrange: Set up context with target NPC
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          target: {
            id: npcId,
            components: {
              [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                npcId,
                POSITION_COMPONENT_ID
              ),
              [ACTOR_COMPONENT_ID]: entityManager.getComponentData(
                npcId,
                ACTOR_COMPONENT_ID
              ),
              'test:equipment': entityManager.getComponentData(
                npcId,
                'test:equipment'
              ),
            },
          },
        },
      };

      // Act: Resolve scope that depends on target context
      const result = unifiedScopeResolver.resolve(
        'test:adjustable_clothing',
        context
      );

      // Assert: Should find the adjustable jacket
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.has(jacketId)).toBe(true);
      expect(result.value.has(shirtId)).toBe(false); // Not adjustable
    });

    it('should resolve scope with target context for unlocking tools', async () => {
      // Arrange: Set up context with target container
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          target: {
            id: containerId,
            components: {
              [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                containerId,
                POSITION_COMPONENT_ID
              ),
              'core:container': entityManager.getComponentData(
                containerId,
                'core:container'
              ),
            },
          },
        },
      };

      // Act: Resolve scope that checks both actor inventory and target properties
      const result = unifiedScopeResolver.resolve(
        'test:unlocking_tools',
        context
      );

      // Assert: Should find tools that can unlock the target
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.has(toolId)).toBe(true);
    });

    it('should handle missing target context gracefully', async () => {
      // Arrange: Set up context WITHOUT target
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {}, // No target provided
      };

      // Act: Try to resolve scope that depends on target
      const result = unifiedScopeResolver.resolve(
        'test:adjustable_clothing',
        context
      );

      // Assert: Should succeed but return empty set
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(0);
    });
  });

  describe('Targets Context in Scope Resolution', () => {
    it('should resolve targets source directly', async () => {
      // Arrange: Set up context with multiple targets
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          targets: {
            primary: [
              {
                id: npcId,
                components: {
                  [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                    npcId,
                    POSITION_COMPONENT_ID
                  ),
                  [ACTOR_COMPONENT_ID]: entityManager.getComponentData(
                    npcId,
                    ACTOR_COMPONENT_ID
                  ),
                  'test:equipment': entityManager.getComponentData(
                    npcId,
                    'test:equipment'
                  ),
                },
              },
            ],
            secondary: [
              {
                id: containerId,
                components: {
                  [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                    containerId,
                    POSITION_COMPONENT_ID
                  ),
                  'core:container': entityManager.getComponentData(
                    containerId,
                    'core:container'
                  ),
                },
              },
            ],
          },
        },
      };

      // Act: Resolve scope that accesses all targets
      const result = unifiedScopeResolver.resolve('test:all_targets', context);

      // Assert: Should return all target IDs
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.has(npcId)).toBe(true);
      expect(result.value.has(containerId)).toBe(true);
    });

    it('should resolve specific target group from targets', async () => {
      // Arrange: Set up context with multiple target groups
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          targets: {
            primary: [
              {
                id: npcId,
                components: {
                  [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                    npcId,
                    POSITION_COMPONENT_ID
                  ),
                  [ACTOR_COMPONENT_ID]: entityManager.getComponentData(
                    npcId,
                    ACTOR_COMPONENT_ID
                  ),
                  'test:equipment': entityManager.getComponentData(
                    npcId,
                    'test:equipment'
                  ),
                },
              },
            ],
            secondary: [
              {
                id: containerId,
                components: {
                  [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                    containerId,
                    POSITION_COMPONENT_ID
                  ),
                  'core:container': entityManager.getComponentData(
                    containerId,
                    'core:container'
                  ),
                },
              },
            ],
          },
        },
      };

      // Act: Resolve scope that accesses only primary targets
      const result = unifiedScopeResolver.resolve(
        'test:primary_targets',
        context
      );

      // Assert: Should return only primary target IDs
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.has(npcId)).toBe(true);
      expect(result.value.has(containerId)).toBe(false);
    });

    it('should handle empty targets context', async () => {
      // Arrange: Set up context with empty targets
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          targets: {},
        },
      };

      // Act: Resolve scope that accesses targets
      const result = unifiedScopeResolver.resolve('test:all_targets', context);

      // Assert: Should return empty set
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(0);
    });
  });

  describe('Complex Multi-Target Scenarios', () => {
    it('should support complex nested target property access', async () => {
      // This test demonstrates accessing nested properties from target context
      const complexExpr =
        'entities(test:item)[][{"==": [{"var": "entity.id"}, {"var": "target.components.test:equipment.equipped.torso_upper.outer"}]}]';

      // Add the complex scope to the registry
      const complexScopeDefinition = {
        'test:complex_target_access': {
          id: 'test:complex_target_access',
          expr: complexExpr,
          ast: parseDslExpression(complexExpr),
        },
      };

      // Re-initialize with existing scopes plus the new one
      const existingScopes = scopeRegistry.getAllScopes();
      const allScopes = {};
      for (const [key, value] of existingScopes) {
        allScopes[key] = value;
      }
      Object.assign(allScopes, complexScopeDefinition);
      scopeRegistry.initialize(allScopes);

      // Arrange: Set up context with NPC target that has equipped jacket
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          target: {
            id: npcId,
            components: {
              [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                npcId,
                POSITION_COMPONENT_ID
              ),
              [ACTOR_COMPONENT_ID]: entityManager.getComponentData(
                npcId,
                ACTOR_COMPONENT_ID
              ),
              'test:equipment': entityManager.getComponentData(
                npcId,
                'test:equipment'
              ),
            },
          },
        },
      };

      // Act: Resolve complex scope
      const result = unifiedScopeResolver.resolve(
        'test:complex_target_access',
        context
      );

      // Assert: Should find the jacket that matches the target's equipped item
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.has(jacketId)).toBe(true);
    });

    it('should maintain performance with complex target contexts', async () => {
      // Arrange: Set up context with large targets array
      const playerEntity = entityManager.getEntityInstance(playerId);
      const largeTargetsArray = Array.from({ length: 100 }, (_, i) => ({
        id: `virtual_target_${i}`,
        components: { 'core:item': { value: i } },
      }));

      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          targets: {
            primary: largeTargetsArray,
          },
        },
      };

      // Act: Measure performance of scope resolution with large context
      const start = performance.now();
      const result = unifiedScopeResolver.resolve('test:all_targets', context, {
        validateEntities: false, // Disable validation since these are virtual targets
      });
      const end = performance.now();

      // Assert: Should handle large contexts efficiently
      expect(result.success).toBe(true);
      // The scope returns IDs from both primary and secondary arrays
      // Since we only have primary, we should get 100 IDs
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBeGreaterThanOrEqual(100);
      expect(end - start).toBeLessThan(100); // Should be fast even with large contexts
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid target context structure gracefully', async () => {
      // Arrange: Set up context with malformed target
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          target: null, // Invalid target
        },
      };

      // Act: Try to resolve scope with invalid target
      const result = unifiedScopeResolver.resolve(
        'test:adjustable_clothing',
        context
      );

      // Assert: Should handle gracefully
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(0);
    });

    it('should handle malformed targets array gracefully', async () => {
      // Arrange: Set up context with malformed targets
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        actionContext: {
          targets: {
            primary: 'not-an-array',
            secondary: null,
            tertiary: [{ id: 'valid_target', components: {} }],
          },
        },
      };

      // Act: Resolve scope with malformed targets
      const result = unifiedScopeResolver.resolve('test:all_targets', context, {
        validateEntities: false, // Disable validation since these are virtual targets
      });

      // Assert: Should handle gracefully and only process valid arrays
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      // The tertiary array has a valid target, and that's the only valid array
      // So we should only get IDs from tertiary (no primary or secondary are valid arrays)
      expect(result.value.has('valid_target')).toBe(true);
      expect(result.value.size).toBe(1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing scopes that do not use target context', async () => {
      // Arrange: Use scope that doesn't reference target context
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        location: { id: 'test_room' },
        actionContext: {
          target: {
            id: npcId,
            components: {
              [POSITION_COMPONENT_ID]: entityManager.getComponentData(
                npcId,
                POSITION_COMPONENT_ID
              ),
              [ACTOR_COMPONENT_ID]: entityManager.getComponentData(
                npcId,
                ACTOR_COMPONENT_ID
              ),
              'test:equipment': entityManager.getComponentData(
                npcId,
                'test:equipment'
              ),
            },
          },
        },
      };

      // Act: Resolve traditional scope
      const result = unifiedScopeResolver.resolve(
        'test:nearby_people',
        context
      );

      // Assert: Should work normally
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBeGreaterThan(0);
    });

    it('should work without any action context', async () => {
      // Arrange: Traditional context without action context
      const playerEntity = entityManager.getEntityInstance(playerId);
      const context = {
        actor: playerEntity,
        actorLocation: 'test_room',
        // No actionContext
      };

      // Act: Resolve traditional scope
      const result = unifiedScopeResolver.resolve(
        'test:nearby_people',
        context
      );

      // Assert: Should work normally
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
    });
  });
});
