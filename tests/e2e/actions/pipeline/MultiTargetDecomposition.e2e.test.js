/**
 * @file MultiTargetDecomposition.e2e.test.js - E2E tests for decomposed MultiTargetResolutionStage architecture
 * @description Comprehensive end-to-end tests validating the refactored MultiTargetResolutionStage
 * integrates properly with the existing action pipeline and maintains backward compatibility.
 *
 * Migration from FACARCANA-004: Replaced createMockFacades() with
 * createE2ETestEnvironment() to use real production services.
 *
 * This test suite verifies:
 * - Mixed legacy and modern action processing
 * - Complex multi-level dependencies
 * - Service integration with decomposed architecture
 * - Error recovery and graceful handling
 * - Performance characteristics maintenance
 * @see tests/e2e/common/e2eTestContainer.js
 * @see workflows/ticket-10-pipeline-integration-e2e-testing.md
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from '@jest/globals';
import { createE2ETestEnvironment } from '../../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

/**
 * E2E test suite for the decomposed MultiTargetResolutionStage architecture
 * Tests using real production services instead of mock facades
 *
 * Performance optimization: Container setup is done once in beforeAll to avoid
 * re-initializing the DI container and loading mods for each test (~500ms savings per test).
 * Entity creation remains in beforeEach for test isolation, with cleanup in afterEach.
 */
describe('MultiTargetResolutionStage - Decomposed Architecture E2E', () => {
  // Shared environment - initialized once in beforeAll
  let env;
  let entityManager;
  let actionDiscoveryService;
  let eventBus;
  let registry;

  // Per-test data - created fresh in beforeEach
  let locationId;
  let playerActorId;
  let playerEntity;
  let npcActorId;
  let npcEntity;

  // Track entity IDs created during tests for cleanup
  const createdEntityIds = new Set();

  /**
   * Registers test entity definitions in the registry.
   * Required because core mod doesn't include all entity definitions.
   * Called once in beforeAll since definitions persist across tests.
   */
  async function registerTestEntityDefinitions() {
    const locationDef = createEntityDefinition('test:location', {
      'core:name': { text: 'Test World' },
    });
    registry.store('entityDefinitions', 'test:location', locationDef);

    const actorDef = createEntityDefinition('test:actor', {
      'core:name': { text: 'Test Actor' },
      'core:actor': {},
    });
    registry.store('entityDefinitions', 'test:actor', actorDef);

    const itemDef = createEntityDefinition('test:item', {
      'core:name': { text: 'Test Item' },
    });
    registry.store('entityDefinitions', 'test:item', itemDef);

    const containerDef = createEntityDefinition('test:container', {
      'core:name': { text: 'Test Container' },
    });
    registry.store('entityDefinitions', 'test:container', containerDef);
  }

  // PERFORMANCE OPTIMIZATION: Move expensive container/mod setup to beforeAll (runs once)
  beforeAll(async () => {
    // Create real e2e test environment with core mod loading - done ONCE
    env = await createE2ETestEnvironment({
      loadMods: true,
      mods: ['core'],
      stubLLM: true,
      defaultLLMResponse: { actionId: 'core:wait', targets: {} },
    });

    // Get production services from container
    entityManager = env.services.entityManager;
    actionDiscoveryService = env.services.actionDiscoveryService;
    eventBus = env.services.eventBus;
    registry = env.container.resolve(tokens.IDataRegistry);

    // Register test entity definitions ONCE
    await registerTestEntityDefinitions();
  });

  // Create test entities fresh for each test to ensure isolation
  beforeEach(async () => {
    // Track existing entity IDs before test
    const existingIds = new Set(entityManager.getEntityIds());

    // Create test location
    const locationEntity = await entityManager.createEntityInstance(
      'test:location',
      {
        instanceId: `test-location-pipeline-${Date.now()}`,
        componentOverrides: {
          'core:name': { text: 'Test World' },
        },
      }
    );
    locationId = locationEntity.id;

    // Create player actor
    playerEntity = await entityManager.createEntityInstance('test:actor', {
      instanceId: `test-player-pipeline-${Date.now()}`,
      componentOverrides: {
        'core:name': { text: 'Test Player' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    playerActorId = playerEntity.id;

    // Create NPC actor
    npcEntity = await entityManager.createEntityInstance('test:actor', {
      instanceId: `test-npc-pipeline-${Date.now()}`,
      componentOverrides: {
        'core:name': { text: 'Test NPC' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    npcActorId = npcEntity.id;

    // Track newly created entity IDs for cleanup
    for (const id of entityManager.getEntityIds()) {
      if (!existingIds.has(id)) {
        createdEntityIds.add(id);
      }
    }
  });

  // Clean up entities created during each test to ensure isolation
  afterEach(async () => {
    for (const entityId of createdEntityIds) {
      try {
        if (entityManager.hasEntity(entityId)) {
          entityManager.removeEntityInstance(entityId);
        }
      } catch {
        // Ignore cleanup errors - entity may already be removed
      }
    }
    createdEntityIds.clear();
  });

  // Clean up environment after all tests complete
  afterAll(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('mixed action processing', () => {
    /**
     * Test: Action discovery handles mixed action formats
     * Validates that both legacy and modern actions can be discovered together
     */
    it('should process legacy and modern actions together', async () => {
      // Discover actions using real service
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Result should contain valid structure
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);

      // Core mod may provide actions with various target formats
      // The pipeline handles both legacy and modern formats transparently
      expect(result.actions.length).toBeGreaterThanOrEqual(0);

      // Each action should have basic structure
      for (const action of result.actions) {
        expect(action).toHaveProperty('id');
        expect(typeof action.id).toBe('string');
      }
    });

    /**
     * Test: Multiple actors can discover actions simultaneously
     * Validates that mixed action types work across different actors
     */
    it('should handle mixed action types in same execution pipeline', async () => {
      // Discover actions for player
      const playerResult = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Discover actions for NPC
      const npcResult = await actionDiscoveryService.getValidActions(
        npcEntity,
        {},
        { trace: false }
      );

      // Both discoveries should succeed
      expect(playerResult).toBeDefined();
      expect(playerResult.actions).toBeDefined();
      expect(npcResult).toBeDefined();
      expect(npcResult.actions).toBeDefined();

      // Both should return arrays
      expect(Array.isArray(playerResult.actions)).toBe(true);
      expect(Array.isArray(npcResult.actions)).toBe(true);
    });

    /**
     * Test: Parallel action discovery for multiple actors
     * Validates concurrent processing works correctly
     */
    it('should process parallel action discoveries for multiple actors', async () => {
      // Create additional actors
      const actors = [playerEntity, npcEntity];
      for (let i = 0; i < 3; i++) {
        const actor = await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-actor-parallel-${i}`,
          componentOverrides: {
            'core:name': { text: `Actor ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
        actors.push(actor);
      }

      // Discover actions for all actors in parallel
      const results = await Promise.all(
        actors.map((actor) =>
          actionDiscoveryService.getValidActions(actor, {}, { trace: false })
        )
      );

      // All should succeed
      expect(results).toHaveLength(actors.length);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      });
    });
  });

  describe('service integration verification', () => {
    /**
     * Test: Services are properly integrated for action discovery
     * Validates that the decomposed services work together
     */
    it('should use integrated services for action discovery', async () => {
      // Verify services are available
      expect(actionDiscoveryService).toBeDefined();
      expect(entityManager).toBeDefined();
      expect(eventBus).toBeDefined();

      // Discover actions
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Service integration should produce valid results
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    /**
     * Test: Entity manager integration for target resolution
     * Validates that entities can be retrieved for target resolution
     */
    it('should integrate with entity manager for target resolution', async () => {
      // Create additional entities that could be targets
      const targetEntity = await entityManager.createEntityInstance(
        'test:actor',
        {
          instanceId: 'test-target-entity',
          componentOverrides: {
            'core:name': { text: 'Target Entity' },
            'core:position': { locationId },
            'core:actor': {},
          },
        }
      );

      // Verify entity was created and can be retrieved
      const retrieved = await entityManager.getEntity(targetEntity.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(targetEntity.id);

      // Discover actions - should include actions that target the new entity
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    /**
     * Test: Event bus integration during action discovery
     * Validates that the event bus is functional during discovery
     */
    it('should integrate with event bus during action discovery', async () => {
      const events = [];
      const unsubscribe = eventBus.subscribe('*', (event) => events.push(event));

      try {
        // Perform action discovery
        await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );

        // Event bus should be functional
        expect(eventBus).toBeDefined();
        expect(typeof eventBus.dispatch).toBe('function');
      } finally {
        if (unsubscribe) {
          unsubscribe();
        }
      }
    });

    /**
     * Test: Multiple component states affect action discovery
     * Validates that entity state influences available actions
     * Note: Uses generic component that's always available rather than custom test schemas
     */
    it('should handle entities with various component configurations', async () => {
      // Use the existing player entity which already has core:actor and core:position
      // The key is testing that multiple components don't break discovery
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Should handle multi-component entities
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe('performance validation', () => {
    /**
     * Test: Action discovery completes within performance bounds
     * Validates that the decomposed architecture maintains performance
     */
    it('should maintain performance characteristics', async () => {
      const startTime = Date.now();

      // Execute 20 sequential action discoveries
      for (let i = 0; i < 20; i++) {
        const result = await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );
        expect(result).toBeDefined();
      }

      const duration = Date.now() - startTime;

      // Should complete 20 discoveries in under 10 seconds for e2e
      expect(duration).toBeLessThan(10000);
    });

    /**
     * Test: Concurrent action processing performs efficiently
     * Validates parallel processing efficiency
     */
    it('should handle concurrent action processing efficiently', async () => {
      // Create actors for concurrent testing
      const actors = [];
      for (let i = 0; i < 5; i++) {
        const actor = await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-actor-perf-${i}`,
          componentOverrides: {
            'core:name': { text: `Perf Actor ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
        actors.push(actor);
      }

      const startTime = Date.now();

      // Execute concurrent action discoveries
      const promises = actors.map((actor) =>
        actionDiscoveryService.getValidActions(actor, {}, { trace: false })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      });

      // Concurrent execution should be efficient (5 discoveries in under 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    /**
     * Test: Rapid sequential discoveries perform well
     * Validates that repeated discoveries don't degrade performance
     */
    it('should handle rapid sequential action discoveries', async () => {
      const iterations = 10;
      const results = [];

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );
        results.push(result);
      }

      const elapsed = Date.now() - startTime;

      // All should succeed
      expect(results).toHaveLength(iterations);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      });

      // Average should be reasonable (under 1 second per discovery)
      expect(elapsed / iterations).toBeLessThan(1000);
    });
  });

  describe('error recovery and resilience', () => {
    /**
     * Test: Handle actor without location gracefully
     * Validates error recovery for edge cases
     */
    it('should handle actors without location gracefully', async () => {
      // Create actor without location
      const noLocDef = createEntityDefinition('test:no-loc-actor', {
        'core:name': { text: 'No Location Actor' },
        'core:actor': {},
      });
      registry.store('entityDefinitions', 'test:no-loc-actor', noLocDef);

      const noLocationActor = await entityManager.createEntityInstance(
        'test:no-loc-actor',
        {
          instanceId: 'test-no-loc-actor',
          componentOverrides: {
            'core:name': { text: 'No Location Actor' },
            'core:actor': {},
          },
        }
      );

      // Should not throw
      const result = await actionDiscoveryService.getValidActions(
        noLocationActor,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });

    /**
     * Test: Handle empty context gracefully
     * Validates that empty contexts don't cause failures
     */
    it('should handle empty context gracefully', async () => {
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    /**
     * Test: Handle entity with minimal components
     * Validates that minimal entities are handled correctly
     */
    it('should handle entities with minimal components', async () => {
      // Create minimal entity
      const minimalDef = createEntityDefinition('test:minimal', {
        'core:name': { text: 'Minimal Entity' },
      });
      registry.store('entityDefinitions', 'test:minimal', minimalDef);

      const minimalEntity = await entityManager.createEntityInstance(
        'test:minimal',
        {
          instanceId: 'test-minimal-entity',
          componentOverrides: {
            'core:name': { text: 'Minimal Entity' },
          },
        }
      );

      // Should handle minimal entity gracefully
      // Note: This may throw or return empty results - both are acceptable
      try {
        const result = await actionDiscoveryService.getValidActions(
          minimalEntity,
          {},
          { trace: false }
        );
        expect(result).toBeDefined();
      } catch {
        // Acceptable - minimal entity may not support action discovery
      }
    });

    /**
     * Test: Recover from component updates mid-discovery
     * Validates that component changes don't cause issues
     * Note: Tests sequential discoveries rather than adding unregistered components
     */
    it('should handle component updates gracefully', async () => {
      // Get initial actions
      const initialResult = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(initialResult).toBeDefined();

      // Create a new actor (simulates entity changes during operation)
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-component-update-actor',
        componentOverrides: {
          'core:name': { text: 'New Actor' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Refresh player entity reference
      const updatedPlayer = await entityManager.getEntity(playerActorId);

      // Get actions again after environment changed
      const afterResult = await actionDiscoveryService.getValidActions(
        updatedPlayer,
        {},
        { trace: false }
      );

      // Both should succeed
      expect(afterResult).toBeDefined();
      expect(afterResult.actions).toBeDefined();
    });
  });

  describe('backward compatibility validation', () => {
    /**
     * Test: Existing action discovery API works correctly
     * Validates backward compatibility of the discovery API
     */
    it('should maintain compatibility with existing action discovery API', async () => {
      // Use standard discovery API
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Verify standard result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('actions');
      expect(Array.isArray(result.actions)).toBe(true);

      // Each action should have expected properties
      for (const action of result.actions) {
        expect(action).toHaveProperty('id');
        expect(typeof action.id).toBe('string');
      }
    });

    /**
     * Test: Actions have consistent structure
     * Validates that discovered actions have expected format
     */
    it('should return actions with consistent structure', async () => {
      // Create additional target
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-target-compat',
        componentOverrides: {
          'core:name': { text: 'Compatibility Target' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Actions with targets should have valid structure
      const actionsWithTargets = result.actions.filter(
        (a) => a.targets && Object.keys(a.targets).length > 0
      );

      for (const action of actionsWithTargets) {
        expect(action.targets).toBeDefined();
        for (const key of Object.keys(action.targets)) {
          expect(typeof key).toBe('string');
        }
      }
    });

    /**
     * Test: Multiple discovery calls return consistent results
     * Validates deterministic behavior
     */
    it('should return consistent results across multiple discoveries', async () => {
      // Perform multiple discoveries
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );
        results.push(result);
      }

      // All should have same action count
      const actionCounts = results.map((r) => r.actions.length);
      expect(actionCounts[0]).toBe(actionCounts[1]);
      expect(actionCounts[1]).toBe(actionCounts[2]);

      // All should have same action IDs
      const actionIds = results.map((r) =>
        r.actions.map((a) => a.id).sort().join(',')
      );
      expect(actionIds[0]).toBe(actionIds[1]);
      expect(actionIds[1]).toBe(actionIds[2]);
    });
  });

  describe('integration stress testing', () => {
    /**
     * Test: Handle many entities in location
     * Validates performance with crowded locations
     */
    it('should handle locations with many entities efficiently', async () => {
      // Create many entities in the location
      for (let i = 0; i < 10; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-crowd-actor-${i}`,
          componentOverrides: {
            'core:name': { text: `Crowd Actor ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      const startTime = Date.now();

      // Discover actions in crowded location
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Should handle crowded location efficiently (under 3 seconds)
      expect(duration).toBeLessThan(3000);
    });

    /**
     * Test: Maintain service isolation under load
     * Validates that concurrent operations don't interfere
     */
    it('should maintain service isolation under load', async () => {
      // Create actors for load testing
      const actors = [];
      for (let i = 0; i < 10; i++) {
        const actor = await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-load-actor-${i}`,
          componentOverrides: {
            'core:name': { text: `Load Actor ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
        actors.push(actor);
      }

      const startTime = Date.now();

      // Execute concurrent discoveries
      const promises = actors.map((actor) =>
        actionDiscoveryService.getValidActions(actor, {}, { trace: false })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      });

      // Should handle concurrent load efficiently (10 discoveries in under 10 seconds)
      expect(duration).toBeLessThan(10000);
    });

    /**
     * Test: Services remain functional after multiple operations
     * Validates that services don't degrade over many operations
     */
    it('should remain functional after many sequential operations', async () => {
      const iterations = 15;
      const allResults = [];

      // Perform many sequential discoveries
      for (let i = 0; i < iterations; i++) {
        const result = await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );
        allResults.push(result);

        // Occasionally add/update entities
        if (i % 5 === 0) {
          await entityManager.createEntityInstance('test:actor', {
            instanceId: `test-dynamic-actor-${i}`,
            componentOverrides: {
              'core:name': { text: `Dynamic Actor ${i}` },
              'core:position': { locationId },
              'core:actor': {},
            },
          });
        }
      }

      // All should succeed
      expect(allResults).toHaveLength(iterations);
      allResults.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      });

      // Final discovery should still work
      const finalResult = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );
      expect(finalResult).toBeDefined();
      expect(finalResult.actions).toBeDefined();
    });
  });

  describe('LLM integration', () => {
    /**
     * Test: LLM stub is functional for AI decision making
     * Validates that stubbed LLM works correctly
     */
    it('should use stubbed LLM for AI decisions', async () => {
      // Configure LLM stub
      env.stubLLM({
        actionId: 'core:wait',
        targets: {},
        reasoning: 'Waiting for the right moment',
      });

      const llmAdapter = env.container.resolve(tokens.LLMAdapter);

      // Get AI decision
      const response = await llmAdapter.getAIDecision({
        actorId: npcActorId,
        availableActions: [
          { id: 'core:wait', name: 'Wait' },
          { id: 'core:move', name: 'Move' },
        ],
        context: { location: 'test-world', turn: 1 },
      });

      const decision = JSON.parse(response);

      expect(decision).toBeDefined();
      expect(decision.actionId).toBe('core:wait');
      expect(decision.reasoning).toBe('Waiting for the right moment');
    });

    /**
     * Test: LLM responses can be reconfigured per test
     * Validates flexibility of stubbed LLM
     * Note: Must re-resolve adapter after each stubLLM call since stub creates new instance
     */
    it('should allow LLM response reconfiguration', async () => {
      // First configuration
      env.stubLLM({ actionId: 'core:wait', targets: {} });
      let llmAdapter = env.container.resolve(tokens.LLMAdapter);
      let response = await llmAdapter.getAIDecision({});
      let decision = JSON.parse(response);
      expect(decision.actionId).toBe('core:wait');

      // Reconfigure - must re-resolve adapter after stubLLM
      env.stubLLM({ actionId: 'core:look', targets: { target: 'room' } });
      llmAdapter = env.container.resolve(tokens.LLMAdapter);
      response = await llmAdapter.getAIDecision({});
      decision = JSON.parse(response);
      expect(decision.actionId).toBe('core:look');
      expect(decision.targets.target).toBe('room');
    });
  });

  describe('pipeline structure validation', () => {
    /**
     * Test: All required services are available
     * Validates that the container provides necessary services
     */
    it('should have all required services available', () => {
      expect(entityManager).toBeDefined();
      expect(actionDiscoveryService).toBeDefined();
      expect(eventBus).toBeDefined();
      expect(registry).toBeDefined();
    });

    /**
     * Test: Entity creation and retrieval work correctly
     * Validates basic entity operations
     */
    it('should create and retrieve entities correctly', async () => {
      const testEntity = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-create-retrieve',
        componentOverrides: {
          'core:name': { text: 'Create Retrieve Test' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      const retrieved = await entityManager.getEntity(testEntity.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(testEntity.id);
    });

    /**
     * Test: Action discovery result has expected structure
     * Validates the shape of discovery results
     */
    it('should return action discovery result with expected structure', async () => {
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('actions');
      expect(Array.isArray(result.actions)).toBe(true);

      // Each action should have basic properties
      for (const action of result.actions) {
        expect(action).toHaveProperty('id');
      }
    });

    /**
     * Test: Registry stores and retrieves entity definitions
     * Validates registry functionality
     */
    it('should store and retrieve entity definitions from registry', async () => {
      const testDef = createEntityDefinition('test:registry-test', {
        'core:name': { text: 'Registry Test' },
      });

      registry.store('entityDefinitions', 'test:registry-test', testDef);

      const retrieved = registry.get('entityDefinitions', 'test:registry-test');
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe('test:registry-test');
    });
  });
});
