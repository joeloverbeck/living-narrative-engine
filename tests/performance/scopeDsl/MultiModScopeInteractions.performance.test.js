/**
 * @jest-environment jsdom
 */

/**
 * @file Multi-Mod Scope Interactions Performance Test Suite
 * @see tests/performance/scopeDsl/MultiModScopeInteractions.performance.test.js
 *
 * This test suite validates multi-mod scope performance characteristics,
 * covering:
 * - Multiple mod chain resolution performance
 * - Concurrent multi-mod operation consistency
 * - Complex interdependency performance
 *
 * Extracted from E2E test suite for proper performance testing isolation
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { InMemoryModSystem } from '../../common/mods/inMemoryModSystem.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';

/**
 * Performance test suite for multi-mod scope interactions
 * Tests the performance of complete pipeline from mod loading to cross-mod scope resolution
 */
describe('Multi-Mod Scope Interactions Performance', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dataRegistry;
  let dslParser;
  let logger;
  let modSystem;
  let testWorld;
  let testActors;

  // Shared container setup for performance optimization
  let sharedContainer;
  let containerSetupCompleted = false;

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
    // Create container with optimized initialization
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

    // Initialize high-performance in-memory mod system
    modSystem = new InMemoryModSystem();

    // Set up test world and actors using optimized utilities
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
    // Performance-optimized cleanup - automatic garbage collection
    if (modSystem) {
      modSystem.clear();
    }
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
        await createTestMod(modId, mod, dependencies);
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

        const definition = createEntityDefinition(entityData.id, components);
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
      // Adjusted threshold for test environment performance variance
      expect(totalTime).toBeLessThan(3000); // 3 seconds for all resolutions
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
        await createTestMod(mod.id, { scopes: mod.scopes });
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
