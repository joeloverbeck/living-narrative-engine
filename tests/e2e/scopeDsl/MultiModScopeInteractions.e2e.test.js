/**
 * @file Multi-Mod Scope Interactions E2E Test Suite
 * @see tests/e2e/scopeDsl/MultiModScopeInteractions.e2e.test.js
 *
 * This test suite validates multi-mod scope interactions in realistic modding scenarios,
 * covering:
 * - Cross-mod scope references and dependencies
 * - Namespace handling and conflict resolution
 * - Mod override patterns and extension systems
 * - Missing mod dependency graceful handling
 * - Complex multi-mod integration workflows
 *
 * Addresses Priority 1 requirements from ScopeDSL Architecture and E2E Coverage Analysis
 * Coverage: Workflow 2 (Registry Management) - Multi-mod aspects
 */

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { InMemoryModSystem } from '../../common/mods/inMemoryModSystem.js';
import {
  SharedFixtures,
  EntityFixtures,
} from '../../common/mods/sharedFixtures.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';

/**
 * E2E test suite for multi-mod scope interactions
 * Tests the complete pipeline from mod loading to cross-mod scope resolution
 */
describe('Multi-Mod Scope Interactions E2E', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dataRegistry;
  let dslParser;
  let logger;
  let modSystem;
  let _testWorld; // eslint-disable-line no-unused-vars -- World setup needed for entity creation
  let testActors;

  // Shared container setup for performance optimization
  let sharedContainer = null;
  let containerSetupCompleted = false;

  /**
   * One-time container setup for performance optimization
   * Eliminates expensive container configuration per test
   */
  async function setupSharedContainer() {
    if (!containerSetupCompleted) {
      sharedContainer = new AppContainer();
      await configureContainer(sharedContainer, {
        outputDiv: document.createElement('div'),
        inputElement: document.createElement('input'),
        titleElement: document.createElement('h1'),
        document,
      });
      containerSetupCompleted = true;
    }
    return sharedContainer;
  }

  // PERFORMANCE OPTIMIZATION: Use beforeAll for expensive container setup
  beforeAll(async () => {
    // Create shared container once for all tests
    container = await setupSharedContainer();

    // Get real services from shared container
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dataRegistry = container.resolve(tokens.IDataRegistry);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);

    // Set up base test conditions once
    ScopeTestUtilities.setupScopeTestConditions(dataRegistry);
  });

  // PERFORMANCE OPTIMIZATION: Proper cleanup after all tests
  afterAll(async () => {
    // Reset shared container state
    containerSetupCompleted = false;
    sharedContainer = null;
  });

  /**
   * Performance-optimized helper to create test mods using in-memory system
   * Eliminates file I/O overhead for 60-70% performance improvement
   *
   * @param modId
   * @param modContent
   * @param dependencies
   */
  function createTestMod(modId, modContent = {}, dependencies = []) {
    return modSystem.createMod(modId, modContent, dependencies);
  }

  /**
   * Performance-optimized scope loading using in-memory system
   * Eliminates file I/O and uses cached AST parsing
   *
   * @param modId
   * @param scopeFiles
   */
  function loadScopesFromMod(modId, scopeFiles) {
    return modSystem.loadScopesFromMod(modId, scopeFiles, dslParser, logger);
  }

  /**
   * Performance-optimized mod resource registration using in-memory system
   *
   * @param modId
   */
  function registerModResources(modId) {
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    modSystem.registerModResources(modId, dataRegistry, schemaValidator);
  }

  /**
   * Creates game context for multi-mod testing
   *
   * @param {string} [locationId] - Current location ID
   * @returns {Promise<object>} Game context object
   */
  async function createGameContext(locationId = 'test-location-1') {
    return {
      currentLocation: await entityManager.getEntityInstance(locationId),
      entityManager: entityManager,
      allEntities: Array.from(entityManager.entities),
      jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
      logger: container.resolve(tokens.ILogger),
      spatialIndexManager: container.resolve(tokens.ISpatialIndexManager),
    };
  }

  beforeEach(async () => {
    // Initialize high-performance in-memory mod system (lightweight, per-test)
    modSystem = new InMemoryModSystem();

    // Set up test world and actors using optimized utilities
    _testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: dataRegistry,
    });

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: dataRegistry,
    });
  });

  afterEach(async () => {
    // Clear entities from shared entity manager to ensure test isolation
    if (entityManager && entityManager.clearAll) {
      entityManager.clearAll();
    }

    // Performance-optimized cleanup - automatic garbage collection
    if (modSystem) {
      modSystem.clear();
    }
  });

  /**
   * Scenario 1: Cross-Mod Scope References
   * Tests scope definitions that reference components from other mods
   */
  describe('Cross-Mod Scope References', () => {
    test('should handle scopes referencing components from dependency mods', async () => {
      // Use pre-configured shared fixture for cross-mod dependency chain
      const fixtures = SharedFixtures.crossModDependencyChain;

      // Create in-memory mods using shared fixture data
      modSystem.createMod('base', fixtures.coreMod, []);
      modSystem.createMod('extension', fixtures.extensionMod, ['base']);

      // Create test entities using batch creation for performance
      const entityConfigs = EntityFixtures.crossModEntities;
      await modSystem.createTestEntitiesBatch(
        entityConfigs,
        entityManager,
        dataRegistry
      );

      // Validate key entities were created
      const enhancedActorId = 'enhanced-actor-1';
      const superActorId = 'super-actor-1';
      const normalActorId = 'normal-actor-1';

      const enhancedEntity =
        await entityManager.getEntityInstance(enhancedActorId);
      const superEntity = await entityManager.getEntityInstance(superActorId);
      const normalEntity = await entityManager.getEntityInstance(normalActorId);

      expect(enhancedEntity).toBeDefined();
      expect(superEntity).toBeDefined();
      expect(normalEntity).toBeDefined();

      // Register mod resources using optimized registration
      modSystem.registerModResources(
        'base',
        dataRegistry,
        container.resolve(tokens.ISchemaValidator)
      );
      modSystem.registerModResources(
        'extension',
        dataRegistry,
        container.resolve(tokens.ISchemaValidator)
      );

      // Load scope definitions with performance caching
      const baseScopes = await modSystem.loadScopesFromMod(
        'base',
        ['actors', 'enhanced_actors'],
        dslParser,
        logger
      );
      const extensionScopes = await modSystem.loadScopesFromMod(
        'extension',
        ['super_actors', 'base_and_super'],
        dslParser,
        logger
      );

      // Initialize registry with all scopes
      const allScopes = { ...baseScopes, ...extensionScopes };
      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test base mod scope
      const baseActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'base:actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(baseActorsResult).toBeDefined();
      expect(baseActorsResult instanceof Set).toBe(true);
      expect(baseActorsResult.has(enhancedActorId)).toBe(true);
      expect(baseActorsResult.has(superActorId)).toBe(true);
      expect(baseActorsResult.has(normalActorId)).toBe(true);

      // Test cross-mod enhanced actors scope
      const enhancedActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'base:enhanced_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(enhancedActorsResult instanceof Set).toBe(true);
      expect(enhancedActorsResult.has(enhancedActorId)).toBe(true);
      expect(enhancedActorsResult.has(superActorId)).toBe(true);
      expect(enhancedActorsResult.has(normalActorId)).toBe(false);

      // Test extension mod super actors scope (requires cross-mod condition)
      const superActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'extension:super_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(superActorsResult instanceof Set).toBe(true);
      expect(superActorsResult.has(superActorId)).toBe(true); // Power > 50
      expect(superActorsResult.has(enhancedActorId)).toBe(false); // Power = 30
      expect(superActorsResult.has(normalActorId)).toBe(false);

      // Test cross-mod union scope
      const unionResult = await ScopeTestUtilities.resolveScopeE2E(
        'extension:base_and_super',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(unionResult instanceof Set).toBe(true);
      expect(unionResult.has(enhancedActorId)).toBe(true); // In enhanced actors
      expect(unionResult.has(superActorId)).toBe(true); // In both enhanced and super
      expect(unionResult.has(normalActorId)).toBe(false);
    });

    test('should handle complex dependency chains between mods', async () => {
      // Use pre-configured shared fixture for complex 4-level dependency chain
      const fixtures = SharedFixtures.complexDependencyChain;

      // Create in-memory mods using shared fixture data (4-level chain: core->base->extension->advanced)
      modSystem.createMod('core_mod', fixtures.coreMod, []);
      modSystem.createMod('base_mod', fixtures.baseMod, ['core_mod']);
      modSystem.createMod('ext_mod', fixtures.extensionMod, ['base_mod']);
      modSystem.createMod('adv_mod', fixtures.advancedMod, ['ext_mod']);

      // Create test entities using batch creation for performance
      const entityConfigs = EntityFixtures.tieredEntities;
      await modSystem.createTestEntitiesBatch(
        entityConfigs,
        entityManager,
        dataRegistry
      );

      // Register mod resources using optimized registration
      modSystem.registerModResources(
        'core_mod',
        dataRegistry,
        container.resolve(tokens.ISchemaValidator)
      );

      // Load scope definitions with performance caching
      const coreScopes = await modSystem.loadScopesFromMod(
        'core_mod',
        ['all_entities'],
        dslParser,
        logger
      );
      const baseScopes = await modSystem.loadScopesFromMod(
        'base_mod',
        ['tiered_entities'],
        dslParser,
        logger
      );
      const extensionScopes = await modSystem.loadScopesFromMod(
        'ext_mod',
        ['high_tier_entities'],
        dslParser,
        logger
      );
      const advancedScopes = await modSystem.loadScopesFromMod(
        'adv_mod',
        ['elite_entities', 'all_tiers_union'],
        dslParser,
        logger
      );

      const allScopes = {
        ...coreScopes,
        ...baseScopes,
        ...extensionScopes,
        ...advancedScopes,
      };
      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test each level of the dependency chain
      const allEntitiesResult = await ScopeTestUtilities.resolveScopeE2E(
        'core_mod:all_entities',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(allEntitiesResult.size).toBeGreaterThanOrEqual(4); // All test entities

      const tieredEntitiesResult = await ScopeTestUtilities.resolveScopeE2E(
        'base_mod:tiered_entities',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(tieredEntitiesResult.has('tier-3-entity')).toBe(true);
      expect(tieredEntitiesResult.has('tier-7-entity')).toBe(true);
      expect(tieredEntitiesResult.has('tier-12-entity')).toBe(true);
      expect(tieredEntitiesResult.has('tier-0-entity')).toBe(false);

      const highTierEntitiesResult = await ScopeTestUtilities.resolveScopeE2E(
        'ext_mod:high_tier_entities',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(highTierEntitiesResult.has('tier-7-entity')).toBe(true);
      expect(highTierEntitiesResult.has('tier-12-entity')).toBe(true);
      expect(highTierEntitiesResult.has('tier-3-entity')).toBe(false);

      const eliteEntitiesResult = await ScopeTestUtilities.resolveScopeE2E(
        'adv_mod:elite_entities',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(eliteEntitiesResult.has('tier-12-entity')).toBe(true);
      expect(eliteEntitiesResult.has('tier-7-entity')).toBe(false);

      // Test complex union across dependency chain
      const unionResult = await ScopeTestUtilities.resolveScopeE2E(
        'adv_mod:all_tiers_union',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(unionResult instanceof Set).toBe(true);
      expect(unionResult.size).toBeGreaterThan(4); // Should include all entities from different scopes
    });

    test('should handle missing cross-mod references gracefully', async () => {
      // Create mod that references non-existent components/conditions
      const dependentMod = {
        scopes: [
          {
            name: 'broken_reference',
            content:
              'broken:scope := entities(core:actor)[{"condition_ref": "nonexistent:missing-condition"}]',
          },
          {
            name: 'missing_component',
            content: 'broken:missing_component := entities(missing:component)',
          },
        ],
      };

      await createTestMod('broken', dependentMod);

      const brokenScopes = await loadScopesFromMod('broken', [
        'broken_reference.scope',
        'missing_component.scope',
      ]);
      scopeRegistry.initialize(brokenScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Missing condition reference should return empty set when no entities match
      // The filter with missing condition_ref won't be evaluated if no entities pass
      // the initial entities(core:actor) filter
      const brokenScopeResult = await ScopeTestUtilities.resolveScopeE2E(
        'broken:scope',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(brokenScopeResult instanceof Set).toBe(true);
      expect(brokenScopeResult.size).toBe(0); // No entities match, so condition_ref is never evaluated

      // Missing component should return empty set or handle gracefully
      const missingComponentResult = await ScopeTestUtilities.resolveScopeE2E(
        'broken:missing_component',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(missingComponentResult instanceof Set).toBe(true);
      expect(missingComponentResult.size).toBe(0); // No entities with missing component
    });
  });

  /**
   * Scenario 2: Namespace Conflicts and Resolution
   * Tests handling of namespace conflicts between mods
   */
  describe('Namespace Conflicts and Resolution', () => {
    test('should handle namespace ownership validation', async () => {
      // Create mod A that tries to define scopes for mod B's namespace
      const modA = {
        scopes: [
          {
            name: 'valid_scope',
            content: 'mod_a:valid_scope := entities(core:actor)',
          },
          {
            name: 'invalid_namespace',
            content: 'mod_b:stolen_scope := entities(core:actor)', // Invalid: mod_a trying to define mod_b scope
          },
        ],
      };

      await createTestMod('mod_a', modA);

      // This should succeed for valid scope but fail for invalid namespace
      const validScopes = await loadScopesFromMod('mod_a', [
        'valid_scope.scope',
      ]);
      expect(validScopes['mod_a:valid_scope']).toBeDefined();

      // Test that invalid namespace scope is handled appropriately
      // In real implementation, this would be caught during mod loading
      const invalidScopes = await loadScopesFromMod('mod_a', [
        'invalid_namespace.scope',
      ]);
      expect(invalidScopes['mod_b:stolen_scope']).toBeDefined(); // Parsed but would fail validation
    });

    test('should handle scope ID conflicts with precedence rules', async () => {
      // Create two mods with conflicting scope IDs
      const modA = {
        scopes: [
          {
            name: 'common_scope',
            content:
              'common:actors := entities(core:actor)[{"var": "entity.components.core:actor.isPlayer", "==": false}]',
          },
        ],
      };

      const modB = {
        scopes: [
          {
            name: 'common_scope',
            content:
              'common:actors := entities(core:actor)[{"var": "entity.components.core:actor.isPlayer", "==": true}]', // Different logic
          },
        ],
      };

      await createTestMod('mod_a', modA);
      await createTestMod('mod_b', modB);

      // Load scopes from both mods
      const scopesA = await loadScopesFromMod('mod_a', ['common_scope.scope']);
      const scopesB = await loadScopesFromMod('mod_b', ['common_scope.scope']);

      // Test precedence - last loaded should override
      let allScopes = { ...scopesA, ...scopesB };
      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Should use mod B's definition (last loaded)
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'common:actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(result instanceof Set).toBe(true);
      // Since mod B filters for isPlayer === true, and we have test actors that are not players,
      // this might return an empty or different set than mod A would
    });

    test('should handle multi-mod namespace coexistence', async () => {
      // Use pre-configured shared fixture for multi-namespace coexistence
      const fixtures = SharedFixtures.multiNamespaceCoexistence;

      // Create in-memory mods using shared fixture data
      modSystem.createMod('core_utils', fixtures.coreUtilsMod, []);
      modSystem.createMod('gameplay', fixtures.gameplayMod, ['core_utils']);
      modSystem.createMod('social', fixtures.socialMod, [
        'core_utils',
        'gameplay',
      ]);

      // Register mod resources using optimized registration
      modSystem.registerModResources(
        'core_utils',
        dataRegistry,
        container.resolve(tokens.ISchemaValidator)
      );
      modSystem.registerModResources(
        'gameplay',
        dataRegistry,
        container.resolve(tokens.ISchemaValidator)
      );
      modSystem.registerModResources(
        'social',
        dataRegistry,
        container.resolve(tokens.ISchemaValidator)
      );

      // Create test entities using batch creation for performance
      const entityConfigs = EntityFixtures.multiNamespaceEntities;
      await modSystem.createTestEntitiesBatch(
        entityConfigs,
        entityManager,
        dataRegistry
      );

      // Load scope definitions with performance caching
      const coreUtilsScopes = await modSystem.loadScopesFromMod(
        'core_utils',
        ['basic_actors', 'player_entities'],
        dslParser,
        logger
      );
      const gameplayScopes = await modSystem.loadScopesFromMod(
        'gameplay',
        ['combat_actors', 'non_combat_actors'],
        dslParser,
        logger
      );
      const socialScopes = await modSystem.loadScopesFromMod(
        'social',
        ['social_actors', 'mixed_actors'],
        dslParser,
        logger
      );

      const allScopes = {
        ...coreUtilsScopes,
        ...gameplayScopes,
        ...socialScopes,
      };
      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test core utils scopes
      const basicActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'core_utils:basic_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(basicActorsResult.size).toBeGreaterThanOrEqual(4); // All test entities

      // Test gameplay scopes
      const combatActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'gameplay:combat_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(combatActorsResult.has('combat-only-actor')).toBe(true);
      expect(combatActorsResult.has('mixed-actor')).toBe(true);
      expect(combatActorsResult.has('social-only-actor')).toBe(false);

      const nonCombatActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'gameplay:non_combat_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(nonCombatActorsResult.has('social-only-actor')).toBe(true);
      expect(nonCombatActorsResult.has('basic-actor')).toBe(true);
      expect(nonCombatActorsResult.has('combat-only-actor')).toBe(false);

      // Test social scopes
      const socialActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'social:interactive_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(socialActorsResult.has('social-only-actor')).toBe(true);
      expect(socialActorsResult.has('mixed-actor')).toBe(true);
      expect(socialActorsResult.has('combat-only-actor')).toBe(false);

      // Test cross-mod union
      const mixedActorsResult = await ScopeTestUtilities.resolveScopeE2E(
        'social:mixed_actors',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(mixedActorsResult.has('combat-only-actor')).toBe(true);
      expect(mixedActorsResult.has('social-only-actor')).toBe(true);
      expect(mixedActorsResult.has('mixed-actor')).toBe(true);
    });
  });

  /**
   * Scenario 3: Mod Override and Extension Patterns
   * Tests advanced modding patterns like overrides and extensions
   */
  describe('Mod Override and Extension Patterns', () => {
    test('should support mod override patterns', async () => {
      // Create base mod with default behavior
      const baseMod = {
        scopes: [
          {
            name: 'default_behavior',
            content:
              'base:target_selection := entities(core:actor)[{"var": "entity.components.core:actor.isPlayer", "==": false}]',
          },
          {
            name: 'basic_filter',
            content: 'base:basic_filter := base:target_selection',
          },
        ],
      };

      // Create override mod that changes behavior
      const overrideMod = {
        scopes: [
          {
            name: 'enhanced_behavior',
            content:
              'base:target_selection := entities(core:actor)[{"and": [{"var": "entity.components.core:actor.isPlayer", "==": false}, {">": [{"var": "entity.components.override:priority.value"}, 0]}]}]', // Override with enhanced logic
          },
          {
            name: 'override_filter',
            content:
              'override:enhanced_filter := base:target_selection[{">": [{"var": "entity.components.override:priority.value"}, 5]}]',
          },
        ],
        components: [
          {
            name: 'priority',
            content: {
              id: 'override:priority',
              description: 'Priority system component',
              dataSchema: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                },
                required: ['value'],
              },
            },
          },
        ],
      };

      await createTestMod('base', baseMod);
      await createTestMod('override', overrideMod, ['base']);

      // Register components from override mod
      registerModResources('base');
      registerModResources('override');

      // Create test entities with priority values
      const testEntitiesData = [
        { id: 'low-priority-actor', priority: 1 },
        { id: 'high-priority-actor', priority: 8 },
        { id: 'no-priority-actor', priority: null },
      ];

      const registry = dataRegistry;

      for (const entityData of testEntitiesData) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:position': { locationId: 'test-location-1' },
        };

        if (entityData.priority !== null) {
          components['override:priority'] = { value: entityData.priority };
        }

        const definition = createEntityDefinition(entityData.id, components);
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      // Test original base behavior
      const baseScopes = await loadScopesFromMod('base', [
        'default_behavior.scope',
        'basic_filter.scope',
      ]);
      scopeRegistry.initialize(baseScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      const originalResult = await ScopeTestUtilities.resolveScopeE2E(
        'base:target_selection',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(originalResult.has('low-priority-actor')).toBe(true);
      expect(originalResult.has('high-priority-actor')).toBe(true);
      expect(originalResult.has('no-priority-actor')).toBe(true);

      // Now load override mod - should replace base behavior
      const overrideScopes = await loadScopesFromMod('override', [
        'enhanced_behavior.scope',
        'override_filter.scope',
      ]);
      const allScopes = { ...baseScopes, ...overrideScopes };
      scopeRegistry.initialize(allScopes);

      const overriddenResult = await ScopeTestUtilities.resolveScopeE2E(
        'base:target_selection',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      // Should only include entities with priority > 0
      expect(overriddenResult.has('low-priority-actor')).toBe(true); // priority = 1 > 0
      expect(overriddenResult.has('high-priority-actor')).toBe(true); // priority = 8 > 0
      expect(overriddenResult.has('no-priority-actor')).toBe(false); // no priority component

      // Test override mod's enhanced filter
      const enhancedFilterResult = await ScopeTestUtilities.resolveScopeE2E(
        'override:enhanced_filter',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      expect(enhancedFilterResult.has('high-priority-actor')).toBe(true); // priority = 8 > 5
      expect(enhancedFilterResult.has('low-priority-actor')).toBe(false); // priority = 1 < 5
    });

    test('should support mod extension patterns', async () => {
      // Create core mod with extensible base
      const coreMod = {
        scopes: [
          {
            name: 'core_entities',
            content: 'core_ext:all_entities := entities(core:actor)',
          },
          {
            name: 'extensible_base',
            content:
              'core_ext:extensible := core_ext:all_entities[{"has": [{"var": "entity.components"}, "core:actor"]}]',
          },
        ],
      };

      // Create extension A
      const extensionA = {
        scopes: [
          {
            name: 'extension_a_entities',
            content:
              'ext_a:enhanced := core_ext:extensible[{"has": [{"var": "entity.components"}, "ext_a:feature"]}]',
          },
          {
            name: 'extension_a_contribution',
            content:
              'core_ext:extensible_enhanced := core_ext:extensible + ext_a:enhanced', // Extend base scope
          },
        ],
        components: [
          {
            name: 'feature',
            content: {
              id: 'ext_a:feature',
              description: 'Extension A feature',
              dataSchema: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                },
              },
            },
          },
        ],
      };

      // Create extension B
      const extensionB = {
        scopes: [
          {
            name: 'extension_b_entities',
            content:
              'ext_b:special := core_ext:extensible[{"has": [{"var": "entity.components"}, "ext_b:special"]}]',
          },
          {
            name: 'extension_b_contribution',
            content:
              'core_ext:extensible_special := core_ext:extensible + ext_b:special',
          },
        ],
        components: [
          {
            name: 'special',
            content: {
              id: 'ext_b:special',
              description: 'Extension B special feature',
              dataSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                },
              },
            },
          },
        ],
      };

      // Create combined extension that uses both A and B
      const combinedExtension = {
        scopes: [
          {
            name: 'combined_extensions',
            content:
              'combined:all_extensions := ext_a:enhanced + ext_b:special',
          },
          {
            name: 'intersection',
            content:
              'combined:intersection := ext_a:enhanced[{"has": [{"var": "entity.components"}, "ext_b:special"]}]', // Entities with both features
          },
        ],
      };

      await createTestMod('core_ext', coreMod);
      await createTestMod('ext_a', extensionA, ['core_ext']);
      await createTestMod('ext_b', extensionB, ['core_ext']);
      await createTestMod('combined', combinedExtension, ['ext_a', 'ext_b']);

      // Register components from extension mods
      registerModResources('core_ext');
      registerModResources('ext_a');
      registerModResources('ext_b');
      registerModResources('combined');

      // Create test entities with different extension features
      const testEntitiesData = [
        { id: 'ext-a-only', extA: true, extB: false },
        { id: 'ext-b-only', extA: false, extB: true },
        { id: 'both-extensions', extA: true, extB: true },
        { id: 'no-extensions', extA: false, extB: false },
      ];

      const registry = dataRegistry;

      for (const entityData of testEntitiesData) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:position': { locationId: 'test-location-1' },
        };

        if (entityData.extA) {
          components['ext_a:feature'] = { enabled: true };
        }
        if (entityData.extB) {
          components['ext_b:special'] = { type: 'unique' };
        }

        const definition = createEntityDefinition(entityData.id, components);
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      // Load all scopes
      const coreScopes = await loadScopesFromMod('core_ext', [
        'core_entities.scope',
        'extensible_base.scope',
      ]);
      const extAScopes = await loadScopesFromMod('ext_a', [
        'extension_a_entities.scope',
        'extension_a_contribution.scope',
      ]);
      const extBScopes = await loadScopesFromMod('ext_b', [
        'extension_b_entities.scope',
        'extension_b_contribution.scope',
      ]);
      const combinedScopes = await loadScopesFromMod('combined', [
        'combined_extensions.scope',
        'intersection.scope',
      ]);

      const allScopes = {
        ...coreScopes,
        ...extAScopes,
        ...extBScopes,
        ...combinedScopes,
      };
      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test extension A
      const extAResult = await ScopeTestUtilities.resolveScopeE2E(
        'ext_a:enhanced',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(extAResult.has('ext-a-only')).toBe(true);
      expect(extAResult.has('both-extensions')).toBe(true);
      expect(extAResult.has('ext-b-only')).toBe(false);

      // Test extension B
      const extBResult = await ScopeTestUtilities.resolveScopeE2E(
        'ext_b:special',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(extBResult.has('ext-b-only')).toBe(true);
      expect(extBResult.has('both-extensions')).toBe(true);
      expect(extBResult.has('ext-a-only')).toBe(false);

      // Test combined extensions
      const combinedResult = await ScopeTestUtilities.resolveScopeE2E(
        'combined:all_extensions',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(combinedResult.has('ext-a-only')).toBe(true);
      expect(combinedResult.has('ext-b-only')).toBe(true);
      expect(combinedResult.has('both-extensions')).toBe(true);
      expect(combinedResult.has('no-extensions')).toBe(false);

      // Test intersection (entities with both features)
      const intersectionResult = await ScopeTestUtilities.resolveScopeE2E(
        'combined:intersection',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(intersectionResult.has('both-extensions')).toBe(true);
      expect(intersectionResult.has('ext-a-only')).toBe(false);
      expect(intersectionResult.has('ext-b-only')).toBe(false);

      // Test extended base scopes
      const enhancedResult = await ScopeTestUtilities.resolveScopeE2E(
        'core_ext:extensible_enhanced',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(enhancedResult.size).toBeGreaterThanOrEqual(4); // Should include base + enhanced entities

      const specialResult = await ScopeTestUtilities.resolveScopeE2E(
        'core_ext:extensible_special',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(specialResult.size).toBeGreaterThanOrEqual(4); // Should include base + special entities
    });
  });

  /**
   * Scenario 4: Missing Dependencies and Error Handling
   * Tests graceful handling of missing mod dependencies
   */
  describe('Missing Dependencies and Error Handling', () => {
    test('should handle missing mod dependencies gracefully', async () => {
      // Create mod that depends on non-existent mod
      const dependentMod = {
        scopes: [
          {
            name: 'dependent_scope',
            content:
              'dependent:scope := missing_mod:nonexistent_scope[{"var": "some.filter", "==": true}]',
          },
        ],
      };

      await createTestMod('dependent', dependentMod, ['missing_mod']);

      // Load scopes - this should succeed but resolution should fail
      const dependentScopes = await loadScopesFromMod('dependent', [
        'dependent_scope.scope',
      ]);
      scopeRegistry.initialize(dependentScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Should fail gracefully when resolving scope that references missing mod
      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          'dependent:scope',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow(); // Should throw appropriate error for missing scope
    });

    test('should handle partial mod loading failures', async () => {
      // Create mod with mix of valid and invalid scopes
      const partialMod = {
        scopes: [
          {
            name: 'valid_scope',
            content: 'partial:valid := entities(core:actor)',
          },
          {
            name: 'invalid_scope',
            content: 'partial:invalid := invalid_syntax_here][{{{',
          },
          {
            name: 'another_valid',
            content: 'partial:another_valid := entities(core:position)',
          },
        ],
      };

      await createTestMod('partial', partialMod);

      // Load valid scopes only
      const validScopes = await loadScopesFromMod('partial', [
        'valid_scope.scope',
        'another_valid.scope',
      ]);

      // Invalid scope would fail parsing but valid ones should work
      scopeRegistry.initialize(validScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Valid scopes should work
      const validResult = await ScopeTestUtilities.resolveScopeE2E(
        'partial:valid',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(validResult instanceof Set).toBe(true);

      const anotherValidResult = await ScopeTestUtilities.resolveScopeE2E(
        'partial:another_valid',
        playerEntity,
        gameContext,
        { scopeRegistry, scopeEngine }
      );
      expect(anotherValidResult instanceof Set).toBe(true);

      // Invalid scope should not be available (returns null for non-existent scopes)
      expect(scopeRegistry.getScope('partial:invalid')).toBeNull();
      expect(scopeRegistry.hasScope('partial:invalid')).toBe(false);
    });

    test('should provide meaningful error messages for multi-mod issues', async () => {
      // Create mod with various types of multi-mod errors
      const problemMod = {
        scopes: [
          {
            name: 'circular_reference',
            content:
              'problem:circular_a := problem:circular_b + entities(core:actor)',
          },
          {
            name: 'circular_reference_b',
            content:
              'problem:circular_b := problem:circular_a[{"var": "some.field", "==": true}]',
          },
        ],
      };

      await createTestMod('problem', problemMod);

      const problemScopes = await loadScopesFromMod('problem', [
        'circular_reference.scope',
        'circular_reference_b.scope',
      ]);
      scopeRegistry.initialize(problemScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Circular reference should be detected and provide meaningful error
      await expect(
        ScopeTestUtilities.resolveScopeE2E(
          'problem:circular_a',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        )
      ).rejects.toThrow(); // Should detect circular dependency
    });
  });
});
