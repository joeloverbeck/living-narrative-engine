/**
 * @file Integration test for entity component access in scope filtering.
 * @description This test ensures that JsonLogic conditions in scopes can properly access
 * entity component data via the entity.components.* pattern. This was a critical bug where
 * scope filters failed because Entity instances didn't expose a 'components' property
 * that JsonLogic could access directly.
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
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser.js';
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

import {
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  FOLLOWING_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Entity Component Access in Scope Filtering Integration', () => {
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let logger;
  let registry;
  let gameDataRepository;
  let safeEventDispatcher;
  let spatialIndexManager;

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

    // Set up SpatialIndexSynchronizer BEFORE creating entities (correct timing)
    new SpatialIndexSynchronizer({
      spatialIndexManager,
      safeEventDispatcher,
      logger,
    });

    // Set up entity definitions
    const characterDefinition = new EntityDefinition('test:character', {
      components: {
        [POSITION_COMPONENT_ID]: { locationId: null },
        [ACTOR_COMPONENT_ID]: {},
        [NAME_COMPONENT_ID]: { text: '' },
      },
    });

    const locationDefinition = new EntityDefinition('test:location', {
      components: {
        [NAME_COMPONENT_ID]: { text: '' },
      },
    });

    registry.store('entityDefinitions', 'test:character', characterDefinition);
    registry.store('entityDefinitions', 'test:location', locationDefinition);

    // Set up scope infrastructure
    scopeRegistry = new ScopeRegistry({ logger });
    scopeEngine = new ScopeEngine();
    gameDataRepository = new GameDataRepository(registry, logger);
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    // Load actual core conditions from the mod files
    registry.store('conditions', 'core:entity-at-location', {
      id: 'core:entity-at-location',
      description:
        "True when the entity's current locationId matches the location under evaluation.",
      logic: {
        '==': [
          { var: 'entity.components.core:position.locationId' },
          { var: 'location.id' },
        ],
      },
    });

    registry.store('conditions', 'core:entity-is-not-current-actor', {
      id: 'core:entity-is-not-current-actor',
      description:
        'True when the entity being evaluated is **not** the actor entity.',
      logic: {
        '!=': [{ var: 'entity.id' }, { var: 'actor.id' }],
      },
    });

    registry.store('conditions', 'core:entity-has-actor-component', {
      id: 'core:entity-has-actor-component',
      description: "Checks that the entity has the 'core:actor' component.",
      logic: {
        '!!': { var: 'entity.components.core:actor' },
      },
    });

    registry.store('conditions', 'core:entity-is-following-actor', {
      id: 'core:entity-is-following-actor',
      description:
        "Checks if the entity's 'following' component points to the actor's ID.",
      logic: {
        '==': [
          { var: 'entity.components.core:following.leaderId' },
          { var: 'actor.id' },
        ],
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Entity Component Access', () => {
    it('should provide entity.components.* access in JsonLogic evaluation', async () => {
      // Create test entities with real EntityManager
      const locationId = 'test:tavern';
      const actorId = 'test:hero';
      const targetId = 'test:npc';

      // Create location
      entityManager.createEntityInstance('test:location', {
        instanceId: locationId,
        componentOverrides: {
          [NAME_COMPONENT_ID]: { text: 'The Tavern' },
        },
      });

      // Create hero at location
      entityManager.createEntityInstance('test:character', {
        instanceId: actorId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Hero' },
        },
      });

      // Create NPC at same location
      entityManager.createEntityInstance('test:character', {
        instanceId: targetId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Friendly NPC' },
        },
      });

      // Manually build spatial index to ensure it's populated
      spatialIndexManager.buildIndex(entityManager);

      // Test simple source resolution first (no filter)
      const simpleSourceContent = `test:all_positioned := entities(core:position)`;
      const simpleSourceDefinitions = parseScopeDefinitions(
        simpleSourceContent,
        'test.scope'
      );

      // Parse the DSL expression string into an AST
      const simpleExpressionString = simpleSourceDefinitions.get(
        'test:all_positioned'
      );
      const simpleAst = parseDslExpression(simpleExpressionString);

      scopeRegistry.initialize({
        'test:all_positioned': simpleAst,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const runtimeCtx = {
        entityManager,
        location: { id: locationId },
        logger,
        jsonLogicEval,
      };

      const simpleResult = scopeEngine.resolve(
        scopeRegistry.getScope('test:all_positioned'),
        actorEntity,
        runtimeCtx
      );

      // This should find both entities with position component
      expect(simpleResult).toBeInstanceOf(Set);
      expect(simpleResult.size).toBe(2);
      expect(simpleResult.has(actorId)).toBe(true);
      expect(simpleResult.has(targetId)).toBe(true);

      // Now test with the filter
      // Define a scope that uses entity.components.* access DIRECTLY (no condition refs)
      const scopeContent = `test:potential_targets := entities(core:position)[{
  "and": [
    {
      "==": [
        { "var": "entity.components.core:position.locationId" },
        { "var": "location.id" }
      ]
    },
    {
      "!=": [
        { "var": "entity.id" },
        { "var": "actor.id" }
      ]
    },
    {
      "!!": { "var": "entity.components.core:actor" }
    }
  ]
}]`;

      const scopeDefinitions = parseScopeDefinitions(
        scopeContent,
        'test.scope'
      );

      // Parse the DSL expression string into an AST
      const expressionString = scopeDefinitions.get('test:potential_targets');
      const ast = parseDslExpression(expressionString);

      scopeRegistry.initialize({
        'test:potential_targets': ast,
      });

      // Get actor entity for context
      expect(actorEntity).toBeDefined();
      expect(actorEntity.id).toBe(actorId);

      const result = scopeEngine.resolve(
        scopeRegistry.getScope('test:potential_targets'),
        actorEntity,
        runtimeCtx
      );

      // Should find the NPC but not the hero (filtered out by entity-is-not-current-actor)
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(targetId)).toBe(true);
      expect(result.has(actorId)).toBe(false); // Hero filtered out
    });

    it('should handle missing component data gracefully', async () => {
      // Create entities where some don't have expected components
      const locationId = 'test:tavern';
      const actorId = 'test:hero';
      const targetId = 'test:npc_no_following';

      entityManager.createEntityInstance('test:location', {
        instanceId: locationId,
        componentOverrides: {
          [NAME_COMPONENT_ID]: { text: 'The Tavern' },
        },
      });

      entityManager.createEntityInstance('test:character', {
        instanceId: actorId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Hero' },
        },
      });

      // Create NPC without following component
      entityManager.createEntityInstance('test:character', {
        instanceId: targetId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Independent NPC' },
          // Note: No FOLLOWING_COMPONENT_ID
        },
      });

      // Define scope that checks for following component
      const scopeContent = `test:non_followers := entities(core:position)[{
  "and": [
    { "condition_ref": "core:entity-at-location" },
    { "condition_ref": "core:entity-is-not-current-actor" },
    { "condition_ref": "core:entity-has-actor-component" },
    { "not": { "condition_ref": "core:entity-is-following-actor" } }
  ]
}]`;

      const scopeDefinitions = parseScopeDefinitions(
        scopeContent,
        'test.scope'
      );

      // Parse the DSL expression string into an AST
      const expressionString = scopeDefinitions.get('test:non_followers');
      const ast = parseDslExpression(expressionString);

      scopeRegistry.initialize({
        'test:non_followers': ast,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const runtimeCtx = {
        entityManager,
        location: { id: locationId },
        logger,
        jsonLogicEval,
      };

      const result = scopeEngine.resolve(
        scopeRegistry.getScope('test:non_followers'),
        actorEntity,
        runtimeCtx
      );

      // Should find the NPC because it doesn't have following component
      // (undefined != actor.id evaluates to true)
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(targetId)).toBe(true);
    });
  });

  describe('Real World Scope Patterns', () => {
    it('should replicate core:potential_leaders scope pattern', async () => {
      // This test replicates the exact pattern from core:potential_leaders scope
      // that was failing in the original bug report
      const locationId = 'isekai:adventurers_guild_instance';
      const actorId = 'isekai:hero_instance';
      const targetId = 'isekai:ninja_instance';

      entityManager.createEntityInstance('test:location', {
        instanceId: locationId,
        componentOverrides: {
          [NAME_COMPONENT_ID]: { text: 'Adventurers Guild' },
        },
      });

      entityManager.createEntityInstance('test:character', {
        instanceId: actorId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Joel Overbeck' },
        },
      });

      entityManager.createEntityInstance('test:character', {
        instanceId: targetId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Ninja Ninjason' },
        },
      });

      // Replicate the exact core:potential_leaders scope logic
      const scopeContent = `test:potential_leaders := entities(core:position)[{
  "and": [
    { "condition_ref": "core:entity-at-location" },
    { "condition_ref": "core:entity-is-not-current-actor" },
    { "condition_ref": "core:entity-has-actor-component" },
    { "not": { "condition_ref": "core:entity-is-following-actor" } }
  ]
}]`;

      const scopeDefinitions = parseScopeDefinitions(
        scopeContent,
        'test.scope'
      );

      // Parse the DSL expression string into an AST
      const expressionString = scopeDefinitions.get('test:potential_leaders');
      const ast = parseDslExpression(expressionString);

      scopeRegistry.initialize({
        'test:potential_leaders': ast,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const runtimeCtx = {
        entityManager,
        location: { id: locationId },
        logger,
        jsonLogicEval,
      };

      const result = scopeEngine.resolve(
        scopeRegistry.getScope('test:potential_leaders'),
        actorEntity,
        runtimeCtx
      );

      // Should find Ninja Ninjason as a potential leader
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(targetId)).toBe(true);
      expect(result.has(actorId)).toBe(false); // Hero filtered out as current actor
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should provide consistent component access for actor context', async () => {
      // Ensure actor entity also gets components property for JsonLogic access
      const locationId = 'test:actor_test';
      const actorId = 'test:actor_with_components';

      entityManager.createEntityInstance('test:location', {
        instanceId: locationId,
        componentOverrides: {
          [NAME_COMPONENT_ID]: { text: 'Actor Test Room' },
        },
      });

      entityManager.createEntityInstance('test:character', {
        instanceId: actorId,
        componentOverrides: {
          [POSITION_COMPONENT_ID]: { locationId },
          [NAME_COMPONENT_ID]: { text: 'Actor with Components' },
          [FOLLOWING_COMPONENT_ID]: { targetId: 'someone' },
        },
      });

      // Define scope that uses actor.components access
      const scopeContent = `test:self_check := entities(core:position)[{
  "==": [
    { "var": "entity.components.core:position.locationId" },
    { "var": "actor.components.core:position.locationId" }
  ]
}]`;

      const scopeDefinitions = parseScopeDefinitions(
        scopeContent,
        'test.scope'
      );

      // Parse the DSL expression string into an AST
      const expressionString = scopeDefinitions.get('test:self_check');
      const ast = parseDslExpression(expressionString);

      scopeRegistry.initialize({
        'test:self_check': ast,
      });

      const actorEntity = entityManager.getEntityInstance(actorId);
      const runtimeCtx = {
        entityManager,
        location: { id: locationId },
        logger,
        jsonLogicEval,
      };

      const result = scopeEngine.resolve(
        scopeRegistry.getScope('test:self_check'),
        actorEntity,
        runtimeCtx
      );

      // Should find the actor itself (same location as itself)
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has(actorId)).toBe(true);
    });
  });
});
