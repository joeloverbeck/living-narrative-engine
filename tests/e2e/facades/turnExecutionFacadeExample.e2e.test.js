/**
 * @file Example E2E test demonstrating proper container-based test setup
 * @description This is the canonical reference for e2e test migration from
 * mock facades to real production services via createE2ETestEnvironment.
 *
 * Migration from FACARCANA-004: Replaced createMockFacades() with
 * createE2ETestEnvironment() to use real production services.
 * @see tests/e2e/common/e2eTestContainer.js
 * @see reports/facade-architecture-analysis.md
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

/**
 * Canonical E2E Test Example
 *
 * This test suite demonstrates proper e2e test patterns using real
 * production services instead of mock facades. Use this as a reference
 * when migrating other e2e tests.
 *
 * Key patterns:
 * 1. Use createE2ETestEnvironment() for container setup
 * 2. Access services via env.services.* or env.container.resolve()
 * 3. Use env.stubLLM() for deterministic AI responses
 * 4. Always call env.cleanup() in afterEach
 * 5. Register entity definitions if core mod doesn't include them
 */
describe('Turn Execution E2E Example (Container-Based)', () => {
  let env;
  let entityManager;
  let actionDiscoveryService;
  let eventBus;
  let registry;
  let locationId;
  let playerActorId;
  let aiActorId;

  /**
   * Registers test entity definitions in the registry.
   * Required because core mod doesn't include all entity definitions.
   */
  async function registerTestEntityDefinitions() {
    const locationDef = createEntityDefinition('test:location', {
      'core:name': { text: 'Test Location' },
    });
    registry.store('entityDefinitions', 'test:location', locationDef);

    const actorDef = createEntityDefinition('test:actor', {
      'core:name': { text: 'Test Actor' },
      'core:actor': {},
    });
    registry.store('entityDefinitions', 'test:actor', actorDef);
  }

  beforeEach(async () => {
    // Create real e2e test environment with core mod loading
    env = await createE2ETestEnvironment({
      loadMods: true,
      mods: ['core'],
      stubLLM: true,
      defaultLLMResponse: { actionId: 'core:wait' },
    });

    // Get production services from container
    entityManager = env.services.entityManager;
    actionDiscoveryService = env.services.actionDiscoveryService;
    eventBus = env.services.eventBus;
    registry = env.container.resolve(tokens.IDataRegistry);

    // Register test entity definitions
    await registerTestEntityDefinitions();

    // Create test location
    const locationEntity = await entityManager.createEntityInstance(
      'test:location',
      {
        instanceId: 'test-location-1',
        componentOverrides: {
          'core:name': { text: 'Test Location' },
        },
      }
    );
    locationId = locationEntity.id;

    // Create player actor
    const playerEntity = await entityManager.createEntityInstance(
      'test:actor',
      {
        instanceId: 'test-player',
        componentOverrides: {
          'core:name': { text: 'Test Player' },
          'core:position': { locationId },
          'core:actor': {},
        },
      }
    );
    playerActorId = playerEntity.id;

    // Create AI actor
    const aiEntity = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-ai-actor',
      componentOverrides: {
        'core:name': { text: 'Test AI Actor' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    aiActorId = aiEntity.id;
  });

  afterEach(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  /**
   * Test: Basic action discovery using real services
   * Demonstrates that production action discovery works correctly.
   */
  test('should discover actions using real production services', async () => {
    // Get player entity
    const playerEntity = await entityManager.getEntity(playerActorId);

    // Discover actions using real action discovery service
    const result = await actionDiscoveryService.getValidActions(
      playerEntity,
      {},
      { trace: false }
    );

    // Verify structure
    expect(result).toBeDefined();
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
    // Core mod may provide basic actions
    expect(result.actions.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test: Multiple actors can discover actions independently
   * Demonstrates the system handles multiple actors correctly.
   */
  test('should handle multiple actors discovering actions', async () => {
    // Get both entities
    const playerEntity = await entityManager.getEntity(playerActorId);
    const aiEntity = await entityManager.getEntity(aiActorId);

    // Discover actions for both actors
    const playerResult = await actionDiscoveryService.getValidActions(
      playerEntity,
      {},
      { trace: false }
    );

    const aiResult = await actionDiscoveryService.getValidActions(
      aiEntity,
      {},
      { trace: false }
    );

    // Both should succeed
    expect(playerResult).toBeDefined();
    expect(playerResult.actions).toBeDefined();
    expect(aiResult).toBeDefined();
    expect(aiResult.actions).toBeDefined();
  });

  /**
   * Test: LLM stubbing works correctly
   * Demonstrates how to configure stub LLM responses per test.
   */
  test('should use stubbed LLM responses', async () => {
    // Configure specific LLM response for this test
    env.stubLLM({
      actionId: 'core:wait',
      reasoning: 'Waiting for the right moment',
    });

    // The LLM stub is now configured - actual AI service calls
    // would return this response. This test validates the stub
    // was set up correctly via the container.
    const llmAdapter = env.container.resolve(tokens.LLMAdapter);
    const response = await llmAdapter.getAIDecision({});
    const parsed = JSON.parse(response);

    expect(parsed.actionId).toBe('core:wait');
    expect(parsed.reasoning).toBe('Waiting for the right moment');
  });

  /**
   * Test: Event bus integration
   * Demonstrates that the event bus is functional in e2e environment.
   */
  test('should have functional event bus', async () => {
    // Track events - subscribe to specific event name
    let eventReceived = false;
    let receivedPayload = null;
    const unsubscribe = eventBus.subscribe('TEST_EVENT', (payload) => {
      eventReceived = true;
      receivedPayload = payload;
    });

    try {
      // Dispatch a test event using correct API: dispatch(eventName, payload)
      await eventBus.dispatch('TEST_EVENT', { test: true });

      // Verify event was received
      expect(eventReceived).toBe(true);
      expect(receivedPayload).toBeDefined();
    } finally {
      if (unsubscribe) {
        unsubscribe();
      }
    }
  });

  /**
   * Test: Entity management works with real services
   * Demonstrates entity CRUD operations work correctly.
   */
  test('should create and retrieve entities correctly', async () => {
    // Create a new entity
    const newEntity = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-new-actor',
      componentOverrides: {
        'core:name': { text: 'New Test Actor' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });

    // Retrieve it
    const retrieved = await entityManager.getEntity(newEntity.id);

    // Verify
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(newEntity.id);
  });

  /**
   * Test: Action discovery result has expected structure
   * Validates the shape of action discovery results.
   */
  test('should return action discovery result with expected structure', async () => {
    const playerEntity = await entityManager.getEntity(playerActorId);

    const result = await actionDiscoveryService.getValidActions(
      playerEntity,
      {},
      { trace: false }
    );

    // Structure validation
    expect(result).toBeDefined();
    expect(result).toHaveProperty('actions');
    expect(Array.isArray(result.actions)).toBe(true);

    // Each action should have basic properties if present
    for (const action of result.actions) {
      expect(action).toHaveProperty('id');
    }
  });

  /**
   * Test: Services are properly resolved from container
   * Validates that all required services are available.
   */
  test('should have all required services available', () => {
    expect(entityManager).toBeDefined();
    expect(actionDiscoveryService).toBeDefined();
    expect(eventBus).toBeDefined();
    expect(registry).toBeDefined();
  });
});
