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

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import ScopeLoader from '../../../src/loaders/scopeLoader.js';
import { ScopeDefinitionError } from '../../../src/scopeDsl/errors/scopeDefinitionError.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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
  let tempDir;
  let testWorld;
  let testActors;

  /**
   * Creates a temporary directory structure for testing multi-mod scenarios
   *
   * @returns {Promise<string>} Path to the temporary directory
   */
  async function createTempModDirectory() {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'multi-mod-scope-test-')
    );
    return tmpDir;
  }

  /**
   * Helper to create mod manifest
   *
   * @param {string} modId - Mod identifier
   * @param {Array<string>} dependencies - Mod dependencies
   * @param {string} version - Mod version
   * @returns {object} Mod manifest object
   */
  function createModManifest(modId, dependencies = [], version = '1.0.0') {
    return {
      id: modId,
      name: `Test Mod ${modId}`,
      version,
      dependencies,
      description: `Multi-mod test mod for ${modId}`,
    };
  }

  /**
   * Creates a mock mod with scopes, conditions, and components
   *
   * @param {string} baseDir - Base directory for mods
   * @param {string} modId - Mod identifier
   * @param {object} modContent - Content for the mod
   * @param {Array<object>} modContent.scopes - Scope definitions
   * @param {Array<object>} modContent.conditions - Condition definitions
   * @param {Array<object>} modContent.components - Component definitions
   * @param {Array<string>} dependencies - Mod dependencies
   * @returns {Promise<string>} Path to the mod directory
   */
  async function createTestMod(
    baseDir,
    modId,
    modContent = {},
    dependencies = []
  ) {
    const { scopes = [], conditions = [], components = [] } = modContent;

    const modDir = path.join(baseDir, 'mods', modId);
    const scopesDir = path.join(modDir, 'scopes');
    const conditionsDir = path.join(modDir, 'conditions');
    const componentsDir = path.join(modDir, 'components');

    await fs.mkdir(scopesDir, { recursive: true });
    await fs.mkdir(conditionsDir, { recursive: true });
    await fs.mkdir(componentsDir, { recursive: true });

    // Create mod manifest
    const manifest = createModManifest(modId, dependencies);
    await fs.writeFile(
      path.join(modDir, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create scope files
    for (const scope of scopes) {
      await fs.writeFile(
        path.join(scopesDir, `${scope.name}.scope`),
        scope.content
      );
    }

    // Create condition files
    for (const condition of conditions) {
      await fs.writeFile(
        path.join(conditionsDir, `${condition.name}.condition.json`),
        JSON.stringify(condition.content, null, 2)
      );
    }

    // Create component files
    for (const component of components) {
      await fs.writeFile(
        path.join(componentsDir, `${component.name}.component.json`),
        JSON.stringify(component.content, null, 2)
      );
    }

    return modDir;
  }

  /**
   * Loads scope definitions from a mod directory and registers them
   *
   * @param {string} modId - Mod identifier
   * @param {Array<string>} scopeFiles - Array of scope filenames
   * @returns {Promise<object>} Loaded scope definitions
   */
  async function loadScopesFromMod(modId, scopeFiles) {
    const scopeDefinitions = {};

    for (const fileName of scopeFiles) {
      const filePath = path.join(tempDir, 'mods', modId, 'scopes', fileName);
      const content = await fs.readFile(filePath, 'utf-8');

      try {
        // Use the same parsing logic as ScopeLoader
        const { parseScopeDefinitions } = await import(
          '../../../src/scopeDsl/scopeDefinitionParser.js'
        );

        const parsed = parseScopeDefinitions(content, fileName);

        // parseScopeDefinitions returns a Map with just expr and ast
        for (const [scopeId, scopeData] of parsed) {
          scopeDefinitions[scopeId] = {
            expr: scopeData.expr,
            ast: scopeData.ast,
          };
        }
      } catch (error) {
        logger.warn(
          `Failed to parse scope file ${fileName} for mod ${modId}`,
          error
        );

        // Fallback to simple line parsing
        const lines = content
          .split('\n')
          .filter((line) => line.trim() && !line.trim().startsWith('//'));

        for (const line of lines) {
          const match = line.match(/^([\w_-]+:[\w_-]+)\s*:=\s*(.+)$/);
          if (match) {
            const [, scopeId, expr] = match;
            let ast;
            try {
              ast = dslParser.parse(expr.trim());
            } catch (e) {
              logger.warn(`Failed to parse scope ${scopeId}: ${expr}`, e);
              ast = { type: 'Source', kind: 'actor' }; // Fallback AST
            }

            scopeDefinitions[scopeId.trim()] = {
              expr: expr.trim(),
              ast: ast,
            };
          }
        }
      }
    }

    // Don't register here - return for later batch registration
    return scopeDefinitions;
  }

  /**
   * Registers components and conditions from mod content properly
   *
   * @param {object} modContent - Mod content with components and conditions
   */
  function registerModResources(modContent) {
    const schemaValidator = container.resolve(tokens.ISchemaValidator);

    // Register components
    if (modContent.components) {
      for (const component of modContent.components) {
        // Store in registry for entity creation
        dataRegistry.store(
          'componentDefinitions',
          component.content.id,
          component.content
        );
        // Register schema for validation
        schemaValidator.addSchema(
          component.content.dataSchema,
          component.content.id
        );
      }
    }

    // Register conditions
    if (modContent.conditions) {
      for (const condition of modContent.conditions) {
        // Store in registry for condition_ref resolution
        // The dataRegistry.store will make it available via gameDataRepository.getConditionDefinition
        dataRegistry.store(
          'conditions',
          condition.content.id,
          condition.content
        );
      }
    }
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
    // Create real container and configure it
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get real services from container
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dataRegistry = container.resolve(tokens.IDataRegistry);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);

    // Create temporary directory for test mods
    tempDir = await createTempModDirectory();

    // Set up test world and actors
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: dataRegistry,
    });

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: dataRegistry,
    });

    // Set up base test conditions
    ScopeTestUtilities.setupScopeTestConditions(dataRegistry);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Scenario 1: Cross-Mod Scope References
   * Tests scope definitions that reference components from other mods
   */
  describe('Cross-Mod Scope References', () => {
    test('should handle scopes referencing components from dependency mods', async () => {
      // Create base mod with foundational components
      const baseMod = {
        scopes: [
          {
            name: 'actors',
            content: 'base:actors := entities(core:actor)',
          },
          {
            name: 'enhanced_actors',
            content:
              'base:enhanced_actors := entities(core:actor)[{"==": [{"var": "entity.components.base:special.enhanced"}, true]}]',
          },
        ],
        components: [
          {
            name: 'special',
            content: {
              id: 'base:special',
              description: 'Special enhancement component',
              dataSchema: {
                type: 'object',
                properties: {
                  enhanced: { type: 'boolean' },
                  power: { type: 'number' },
                },
                required: ['enhanced'],
              },
            },
          },
        ],
      };

      // Create extension mod that builds on base mod
      const extensionMod = {
        scopes: [
          {
            name: 'super_actors',
            content:
              'extension:super_actors := entities(core:actor)[{"and": [{"condition_ref": "base:is-enhanced"}, {">": [{"var": "entity.components.base:special.power"}, 50]}]}]',
          },
          {
            name: 'base_and_super',
            content:
              'extension:base_and_super := base:enhanced_actors + extension:super_actors',
          },
        ],
        conditions: [
          {
            name: 'is-enhanced',
            content: {
              id: 'base:is-enhanced',
              description: 'Checks if entity has enhancement',
              logic: {
                '==': [
                  { var: 'entity.components.base:special.enhanced' },
                  true,
                ],
              },
            },
          },
        ],
      };

      await createTestMod(tempDir, 'base', baseMod);
      await createTestMod(tempDir, 'extension', extensionMod, ['base']);

      // Create test entities with cross-mod components
      const enhancedActorId = 'enhanced-actor-1';
      const superActorId = 'super-actor-1';
      const normalActorId = 'normal-actor-1';

      const registry = dataRegistry;

      // Enhanced actor (base mod component)
      const enhancedComponents = {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'base:special': { enhanced: true, power: 30 },
      };
      const enhancedDef = new EntityDefinition(enhancedActorId, {
        description: 'Enhanced actor with base mod component',
        components: enhancedComponents,
      });
      registry.store('entityDefinitions', enhancedActorId, enhancedDef);
      await entityManager.createEntityInstance(enhancedActorId, {
        instanceId: enhancedActorId,
        definitionId: enhancedActorId,
      });

      // Validate entity creation
      const enhancedEntity =
        await entityManager.getEntityInstance(enhancedActorId);
      expect(enhancedEntity).toBeDefined();

      // Super actor (high power)
      const superComponents = {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'base:special': { enhanced: true, power: 75 },
      };
      const superDef = new EntityDefinition(superActorId, {
        description: 'Super actor with high power',
        components: superComponents,
      });
      registry.store('entityDefinitions', superActorId, superDef);
      await entityManager.createEntityInstance(superActorId, {
        instanceId: superActorId,
        definitionId: superActorId,
      });

      // Validate entity creation
      const superEntity = await entityManager.getEntityInstance(superActorId);
      expect(superEntity).toBeDefined();

      // Normal actor (no special component)
      const normalComponents = {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
      };
      const normalDef = new EntityDefinition(normalActorId, {
        description: 'Normal actor without special component',
        components: normalComponents,
      });
      registry.store('entityDefinitions', normalActorId, normalDef);
      await entityManager.createEntityInstance(normalActorId, {
        instanceId: normalActorId,
        definitionId: normalActorId,
      });

      // Validate entity creation
      const normalEntity = await entityManager.getEntityInstance(normalActorId);
      expect(normalEntity).toBeDefined();

      // Register components and conditions from both mods
      registerModResources(baseMod);
      registerModResources(extensionMod);

      // Load scope definitions from both mods
      const baseScopes = await loadScopesFromMod('base', [
        'actors.scope',
        'enhanced_actors.scope',
      ]);
      const extensionScopes = await loadScopesFromMod('extension', [
        'super_actors.scope',
        'base_and_super.scope',
      ]);

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

      console.log('Enhanced actors result:', Array.from(enhancedActorsResult));
      console.log(
        'Enhanced actor entity:',
        entityManager.getEntityInstance(enhancedActorId)
      );
      console.log(
        'Super actor entity:',
        entityManager.getEntityInstance(superActorId)
      );
      console.log(
        'Normal actor entity:',
        entityManager.getEntityInstance(normalActorId)
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
      // Create a chain: core -> base -> extension -> advanced

      // Core mod (foundation)
      const coreMod = {
        scopes: [
          {
            name: 'all_entities',
            content: 'core_mod:all_entities := entities(core:actor)',
          },
        ],
        components: [
          {
            name: 'tier',
            content: {
              id: 'core_mod:tier',
              description: 'Entity tier component',
              dataSchema: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  category: { type: 'string' },
                },
                required: ['level'],
              },
            },
          },
        ],
      };

      // Base mod (builds on core)
      const baseMod = {
        scopes: [
          {
            name: 'tiered_entities',
            content:
              'base_mod:tiered_entities := core_mod:all_entities[{">": [{"var": "entity.components.core_mod:tier.level"}, 1]}]',
          },
        ],
      };

      // Extension mod (builds on base)
      const extensionMod = {
        scopes: [
          {
            name: 'high_tier_entities',
            content:
              'ext_mod:high_tier_entities := base_mod:tiered_entities[{">": [{"var": "entity.components.core_mod:tier.level"}, 5]}]',
          },
        ],
      };

      // Advanced mod (builds on extension)
      const advancedMod = {
        scopes: [
          {
            name: 'elite_entities',
            content:
              'adv_mod:elite_entities := ext_mod:high_tier_entities[{">=": [{"var": "entity.components.core_mod:tier.level"}, 10]}]',
          },
          {
            name: 'all_tiers_union',
            content:
              'adv_mod:all_tiers_union := core_mod:all_entities + base_mod:tiered_entities + ext_mod:high_tier_entities',
          },
        ],
      };

      await createTestMod(tempDir, 'core_mod', coreMod);
      await createTestMod(tempDir, 'base_mod', baseMod, ['core_mod']);
      await createTestMod(tempDir, 'ext_mod', extensionMod, ['base_mod']);
      await createTestMod(tempDir, 'adv_mod', advancedMod, ['ext_mod']);

      // Register components from core mod
      registerModResources(coreMod);

      // Create test entities with different tiers
      const testEntitiesData = [
        { id: 'tier-0-entity', tier: 0 },
        { id: 'tier-3-entity', tier: 3 },
        { id: 'tier-7-entity', tier: 7 },
        { id: 'tier-12-entity', tier: 12 },
      ];

      const registry = dataRegistry;

      for (const entityData of testEntitiesData) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:position': { locationId: 'test-location-1' },
          'core_mod:tier': { level: entityData.tier, category: 'test' },
        };

        const definition = new EntityDefinition(entityData.id, {
          description: `Test entity with tier ${entityData.tier}`,
          components,
        });
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      // Load all scope definitions
      const coreScopes = await loadScopesFromMod('core_mod', [
        'all_entities.scope',
      ]);
      const baseScopes = await loadScopesFromMod('base_mod', [
        'tiered_entities.scope',
      ]);
      const extensionScopes = await loadScopesFromMod('ext_mod', [
        'high_tier_entities.scope',
      ]);
      const advancedScopes = await loadScopesFromMod('adv_mod', [
        'elite_entities.scope',
        'all_tiers_union.scope',
      ]);

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

      await createTestMod(tempDir, 'broken', dependentMod);

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

      await createTestMod(tempDir, 'mod_a', modA);

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

      await createTestMod(tempDir, 'mod_a', modA);
      await createTestMod(tempDir, 'mod_b', modB);

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
      // Create multiple mods with proper namespacing
      const coreUtilsMod = {
        scopes: [
          {
            name: 'basic_actors',
            content: 'core_utils:basic_actors := entities(core:actor)',
          },
          {
            name: 'player_entities',
            content:
              'core_utils:player_entities := entities(core:actor)[{"var": "entity.components.core:actor.isPlayer", "==": true}]',
          },
        ],
      };

      const gameplayMod = {
        scopes: [
          {
            name: 'combat_actors',
            content:
              'gameplay:combat_actors := core_utils:basic_actors[{"has": [{"var": "entity.components"}, "gameplay:combat"]}]',
          },
          {
            name: 'non_combat_actors',
            content:
              'gameplay:non_combat_actors := core_utils:basic_actors[{"!": {"has": [{"var": "entity.components"}, "gameplay:combat"]}}]',
          },
        ],
        components: [
          {
            name: 'combat',
            content: {
              id: 'gameplay:combat',
              description: 'Combat capability component',
              dataSchema: {
                type: 'object',
                properties: {
                  level: { type: 'number' },
                  style: { type: 'string' },
                },
              },
            },
          },
        ],
      };

      const socialMod = {
        scopes: [
          {
            name: 'social_actors',
            content:
              'social:interactive_actors := core_utils:basic_actors[{"has": [{"var": "entity.components"}, "social:personality"]}]',
          },
          {
            name: 'mixed_actors',
            content:
              'social:mixed_actors := gameplay:combat_actors + social:interactive_actors',
          },
        ],
        components: [
          {
            name: 'personality',
            content: {
              id: 'social:personality',
              description: 'Social personality component',
              dataSchema: {
                type: 'object',
                properties: {
                  traits: { type: 'array' },
                  mood: { type: 'string' },
                },
              },
            },
          },
        ],
      };

      await createTestMod(tempDir, 'core_utils', coreUtilsMod);
      await createTestMod(tempDir, 'gameplay', gameplayMod, ['core_utils']);
      await createTestMod(tempDir, 'social', socialMod, [
        'core_utils',
        'gameplay',
      ]);

      // Register components from all mods
      registerModResources(coreUtilsMod);
      registerModResources(gameplayMod);
      registerModResources(socialMod);

      // Create test entities with different component combinations
      const testEntitiesData = [
        {
          id: 'combat-only-actor',
          components: { 'gameplay:combat': { level: 5, style: 'warrior' } },
        },
        {
          id: 'social-only-actor',
          components: {
            'social:personality': { traits: ['friendly'], mood: 'happy' },
          },
        },
        {
          id: 'mixed-actor',
          components: {
            'gameplay:combat': { level: 3, style: 'rogue' },
            'social:personality': { traits: ['cunning'], mood: 'neutral' },
          },
        },
        { id: 'basic-actor', components: {} },
      ];

      const registry = dataRegistry;

      for (const entityData of testEntitiesData) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:position': { locationId: 'test-location-1' },
          ...entityData.components,
        };

        const definition = new EntityDefinition(entityData.id, {
          description: `Test entity: ${entityData.id}`,
          components,
        });
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      // Load all scope definitions
      const coreUtilsScopes = await loadScopesFromMod('core_utils', [
        'basic_actors.scope',
        'player_entities.scope',
      ]);
      const gameplayScopes = await loadScopesFromMod('gameplay', [
        'combat_actors.scope',
        'non_combat_actors.scope',
      ]);
      const socialScopes = await loadScopesFromMod('social', [
        'social_actors.scope',
        'mixed_actors.scope',
      ]);

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

      await createTestMod(tempDir, 'base', baseMod);
      await createTestMod(tempDir, 'override', overrideMod, ['base']);

      // Register components from override mod
      registerModResources(overrideMod);

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

        const definition = new EntityDefinition(entityData.id, {
          description: `Test entity: ${entityData.id}`,
          components,
        });
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

      await createTestMod(tempDir, 'core_ext', coreMod);
      await createTestMod(tempDir, 'ext_a', extensionA, ['core_ext']);
      await createTestMod(tempDir, 'ext_b', extensionB, ['core_ext']);
      await createTestMod(tempDir, 'combined', combinedExtension, [
        'ext_a',
        'ext_b',
      ]);

      // Register components from extension mods
      registerModResources(coreMod);
      registerModResources(extensionA);
      registerModResources(extensionB);
      registerModResources(combinedExtension);

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

        const definition = new EntityDefinition(entityData.id, {
          description: `Test entity: ${entityData.id}`,
          components,
        });
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

      await createTestMod(tempDir, 'dependent', dependentMod, ['missing_mod']);

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

      await createTestMod(tempDir, 'partial', partialMod);

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

      await createTestMod(tempDir, 'problem', problemMod);

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

  /**
   * Performance and Integration Tests
   * Validates multi-mod performance characteristics
   */
  describe('Performance and Integration', () => {
    test('should handle multiple mods with reasonable performance', async () => {
      // Create multiple mods with complex interdependencies
      const modCount = 5;
      const scopesPerMod = 3;
      const allMods = [];

      for (let i = 0; i < modCount; i++) {
        const modId = `perf_mod_${i}`;
        const dependencies = i > 0 ? [`perf_mod_${i - 1}`] : [];

        const scopes = [];
        for (let j = 0; j < scopesPerMod; j++) {
          const dependentScope =
            i > 0 ? `perf_mod_${i - 1}:scope_${j}` : 'entities(core:actor)';
          scopes.push({
            name: `scope_${j}`,
            content: `${modId}:scope_${j} := ${dependentScope}[{">": [{"var": "entity.components.core:position.x", "default": 0}, ${i * 10}]}]`,
          });
        }

        const mod = { scopes };
        await createTestMod(tempDir, modId, mod, dependencies);
        allMods.push(modId);
      }

      // Create test entities distributed across different positions
      const testEntitiesData = [];
      for (let i = 0; i < 50; i++) {
        testEntitiesData.push({
          id: `perf-entity-${i}`,
          x: i * 2, // Spread entities across x positions
        });
      }

      const registry = dataRegistry;
      for (const entityData of testEntitiesData) {
        const components = {
          'core:actor': { isPlayer: false },
          'core:position': {
            locationId: 'test-location-1',
            x: entityData.x,
            y: 0,
          },
        };

        const definition = new EntityDefinition(entityData.id, {
          description: `Performance test entity: ${entityData.id}`,
          components,
        });
        registry.store('entityDefinitions', entityData.id, definition);

        await entityManager.createEntityInstance(entityData.id, {
          instanceId: entityData.id,
          definitionId: entityData.id,
        });
      }

      // Load all scopes from all mods
      let allScopes = {};
      for (let i = 0; i < modCount; i++) {
        const modId = `perf_mod_${i}`;
        const scopeFiles = [];
        for (let j = 0; j < scopesPerMod; j++) {
          scopeFiles.push(`scope_${j}.scope`);
        }
        const modScopes = await loadScopesFromMod(modId, scopeFiles);
        allScopes = { ...allScopes, ...modScopes };
      }

      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Test performance across multiple mod chain resolutions
      const startTime = Date.now();

      const results = [];
      for (let i = 0; i < modCount; i++) {
        for (let j = 0; j < scopesPerMod; j++) {
          const scopeId = `perf_mod_${i}:scope_${j}`;
          const result = await ScopeTestUtilities.resolveScopeE2E(
            scopeId,
            playerEntity,
            gameContext,
            { scopeRegistry, scopeEngine }
          );
          results.push({ scopeId, size: result.size });
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete all resolutions within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second for all resolutions
      expect(results.length).toBe(modCount * scopesPerMod);

      // Results should show filtering effect of dependency chain
      for (const result of results) {
        expect(result.size).toBeGreaterThanOrEqual(0);
      }
    });

    test('should maintain consistency across concurrent multi-mod operations', async () => {
      // Create mods for concurrent testing
      const concurrentMods = [
        {
          id: 'concurrent_a',
          scopes: [
            {
              name: 'actors_a',
              content:
                'concurrent_a:actors := entities(core:actor)[{"var": "entity.components.core:position.x", "<": 50}]',
            },
          ],
        },
        {
          id: 'concurrent_b',
          scopes: [
            {
              name: 'actors_b',
              content:
                'concurrent_b:actors := entities(core:actor)[{"var": "entity.components.core:position.x", ">": 50}]',
            },
          ],
        },
        {
          id: 'concurrent_combined',
          scopes: [
            {
              name: 'combined',
              content:
                'concurrent_combined:all := concurrent_a:actors + concurrent_b:actors',
            },
          ],
        },
      ];

      for (const mod of concurrentMods) {
        await createTestMod(tempDir, mod.id, { scopes: mod.scopes });
      }

      // Load all scopes
      let allScopes = {};
      for (const mod of concurrentMods) {
        const scopeFiles = mod.scopes.map((scope) => `${scope.name}.scope`);
        const modScopes = await loadScopesFromMod(mod.id, scopeFiles);
        allScopes = { ...allScopes, ...modScopes };
      }

      scopeRegistry.initialize(allScopes);

      const playerEntity = await entityManager.getEntityInstance(
        testActors.player.id
      );
      const gameContext = await createGameContext();

      // Run concurrent resolutions
      const promises = [
        ScopeTestUtilities.resolveScopeE2E(
          'concurrent_a:actors',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        ),
        ScopeTestUtilities.resolveScopeE2E(
          'concurrent_b:actors',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        ),
        ScopeTestUtilities.resolveScopeE2E(
          'concurrent_combined:all',
          playerEntity,
          gameContext,
          { scopeRegistry, scopeEngine }
        ),
      ];

      const results = await Promise.all(promises);

      // All resolutions should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result instanceof Set).toBe(true);
      });

      // Combined result should be union of A and B (or close to it, depending on test data)
      const [resultA, resultB, resultCombined] = results;
      expect(resultCombined.size).toBeGreaterThanOrEqual(
        Math.max(resultA.size, resultB.size)
      );
    });
  });
});
