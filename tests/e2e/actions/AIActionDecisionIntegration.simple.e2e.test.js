/**
 * @file AIActionDecisionIntegration.simple.e2e.test.js
 * @description Simplified AI action decision tests using container-based approach.
 *
 * Migration from FACARCANA-004: Replaced createMockFacades() with
 * createE2ETestEnvironment() to use real production services.
 * @see tests/e2e/common/e2eTestContainer.js
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('AI Action Decision Integration E2E - Simplified', () => {
  let env;
  let entityManager;
  let registry;
  let llmAdapter;
  let locationId;
  let aiActorId1;
  let aiActorId2;

  /**
   * Registers test entity definitions in the registry.
   */
  async function registerTestEntityDefinitions() {
    const locationDef = createEntityDefinition('test:location', {
      'core:name': { text: 'AI Test World' },
    });
    registry.store('entityDefinitions', 'test:location', locationDef);

    const actorDef = createEntityDefinition('test:ai-actor', {
      'core:name': { text: 'AI Actor' },
      'core:actor': {},
    });
    registry.store('entityDefinitions', 'test:ai-actor', actorDef);
  }

  beforeEach(async () => {
    // Create real e2e test environment with core mod loading
    env = await createE2ETestEnvironment({
      loadMods: true,
      mods: ['core'],
      stubLLM: true,
      defaultLLMResponse: { actionId: 'core:wait', targets: {} },
    });

    // Get production services from container
    entityManager = env.services.entityManager;
    registry = env.container.resolve(tokens.IDataRegistry);
    // Note: llmAdapter resolved here uses the default stub from environment creation
    // Tests that call env.stubLLM() must re-resolve the adapter
    llmAdapter = env.container.resolve(tokens.LLMAdapter);

    // Register test entity definitions
    await registerTestEntityDefinitions();

    // Create test location
    const locationEntity = await entityManager.createEntityInstance(
      'test:location',
      {
        instanceId: 'test-ai-location',
        componentOverrides: {
          'core:name': { text: 'AI Test World' },
        },
      }
    );
    locationId = locationEntity.id;

    // Create AI actors
    const aiActor1 = await entityManager.createEntityInstance('test:ai-actor', {
      instanceId: 'ai-actor-1',
      componentOverrides: {
        'core:name': { text: 'AI Companion' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    aiActorId1 = aiActor1.id;

    const aiActor2 = await entityManager.createEntityInstance('test:ai-actor', {
      instanceId: 'ai-actor-2',
      componentOverrides: {
        'core:name': { text: 'AI Enemy' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    aiActorId2 = aiActor2.id;
  });

  afterEach(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  /**
   * Test: LLM stub returns configured response
   * Demonstrates using env.stubLLM() to configure AI responses.
   * Note: Must re-resolve adapter after stubLLM() since it creates a new stub instance
   */
  test('should make valid AI decisions using stubbed LLM', async () => {
    // Arrange - Configure LLM to return specific action
    env.stubLLM({
      actionId: 'core:wait',
      targets: { direction: 'north' },
      reasoning: 'Exploring the area',
    });

    // Must re-resolve adapter after stubLLM
    const currentAdapter = env.container.resolve(tokens.LLMAdapter);

    // Act - Get AI decision through the stubbed adapter
    const response = await currentAdapter.getAIDecision({
      actorId: aiActorId1,
      availableActions: [
        { id: 'core:move', name: 'Move' },
        { id: 'core:wait', name: 'Wait' },
        { id: 'core:examine', name: 'Examine' },
      ],
      context: {
        currentLocation: 'starting_room',
        turn: 1,
      },
    });

    // Parse response (stub returns JSON string)
    const decision = JSON.parse(response);

    // Assert
    expect(decision).toBeDefined();
    expect(decision.actionId).toBe('core:wait');
    expect(decision.targets.direction).toBe('north');
    expect(decision.reasoning).toBe('Exploring the area');
  });

  /**
   * Test: Can configure different LLM responses per test
   * Demonstrates flexibility of stubLLM.
   * Note: Must re-resolve adapter after stubLLM() since it creates a new stub instance
   */
  test('should allow reconfiguring LLM response during test', async () => {
    // First configuration
    env.stubLLM({ actionId: 'core:wait', targets: {} });
    let currentAdapter = env.container.resolve(tokens.LLMAdapter);
    let response = await currentAdapter.getAIDecision({});
    let decision = JSON.parse(response);
    expect(decision.actionId).toBe('core:wait');

    // Reconfigure - must re-resolve adapter after stubLLM
    env.stubLLM({ actionId: 'core:look', targets: { target: 'room' } });
    currentAdapter = env.container.resolve(tokens.LLMAdapter);
    response = await currentAdapter.getAIDecision({});
    decision = JSON.parse(response);
    expect(decision.actionId).toBe('core:look');
    expect(decision.targets.target).toBe('room');
  });

  /**
   * Test: Validate AI decision structure
   * Tests that AI responses have expected properties.
   * Note: Must re-resolve adapter after each stubLLM() call
   */
  test('should validate AI decisions before execution', async () => {
    // Test cases for validation
    const testCases = [
      {
        response: { actionId: 'core:wait', targets: {} },
        isValid: true,
        description: 'valid core action',
      },
      {
        response: { actionId: 'test:custom', targets: {} },
        isValid: true,
        description: 'valid test action',
      },
      {
        response: { actionId: 'invalid_action', targets: {} },
        isValid: false,
        description: 'action without namespace prefix',
      },
      {
        response: { notAnAction: true },
        isValid: false,
        description: 'missing actionId property',
      },
    ];

    for (const testCase of testCases) {
      // Configure stub for this test case
      env.stubLLM(testCase.response);

      // Must re-resolve adapter after stubLLM
      const currentAdapter = env.container.resolve(tokens.LLMAdapter);

      // Get decision
      const response = await currentAdapter.getAIDecision({
        actorId: aiActorId1,
      });
      const decision = JSON.parse(response);

      // Simple validation
      let isValid = false;
      if (
        decision &&
        decision.actionId &&
        typeof decision.actionId === 'string'
      ) {
        isValid =
          decision.actionId.startsWith('core:') ||
          decision.actionId.startsWith('test:');
      }

      // Assert
      expect(isValid).toBe(testCase.isValid);
    }
  });

  /**
   * Test: LLM adapter is properly available from container
   */
  test('should have LLM adapter available from container', async () => {
    expect(llmAdapter).toBeDefined();
    expect(typeof llmAdapter.getAIDecision).toBe('function');
    expect(typeof llmAdapter.getCurrentActiveLlmId).toBe('function');
  });

  /**
   * Test: Stub returns correct LLM identifier
   */
  test('should report stub LLM identifier', async () => {
    const llmId = llmAdapter.getCurrentActiveLlmId();
    expect(llmId).toBe('stub-llm');
  });

  /**
   * Test: Multiple actors can use the same stubbed LLM
   * Note: Must re-resolve adapter after stubLLM() since it creates a new stub instance
   */
  test('should serve multiple actors with same stub configuration', async () => {
    // Configure stub
    env.stubLLM({ actionId: 'core:wait', targets: {} });

    // Must re-resolve adapter after stubLLM
    const currentAdapter = env.container.resolve(tokens.LLMAdapter);

    // Get decisions for both actors
    const response1 = await currentAdapter.getAIDecision({ actorId: aiActorId1 });
    const response2 = await currentAdapter.getAIDecision({ actorId: aiActorId2 });

    const decision1 = JSON.parse(response1);
    const decision2 = JSON.parse(response2);

    // Both should get the same stubbed response
    expect(decision1.actionId).toBe('core:wait');
    expect(decision2.actionId).toBe('core:wait');
  });

  /**
   * Test: Rapid sequential decisions work correctly
   * Note: Must re-resolve adapter after stubLLM() since it creates a new stub instance
   */
  test('should handle rapid sequential AI decisions', async () => {
    const iterations = 10;
    const results = [];

    env.stubLLM({ actionId: 'core:wait', targets: {} });

    // Must re-resolve adapter after stubLLM
    const currentAdapter = env.container.resolve(tokens.LLMAdapter);

    // Perform multiple rapid decisions
    for (let i = 0; i < iterations; i++) {
      const response = await currentAdapter.getAIDecision({
        actorId: i % 2 === 0 ? aiActorId1 : aiActorId2,
      });
      const decision = JSON.parse(response);
      results.push({
        iteration: i,
        success: decision && decision.actionId === 'core:wait',
      });
    }

    // All should succeed
    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(iterations);
  });

  /**
   * Test: Complex response structures are preserved
   * Note: Must re-resolve adapter after stubLLM() since it creates a new stub instance
   */
  test('should preserve complex response structures', async () => {
    const complexResponse = {
      actionId: 'core:wait',
      targets: {
        primary: aiActorId2,
        secondary: ['item-1', 'item-2'],
        options: {
          aggressive: false,
          stealthy: true,
        },
      },
      reasoning: 'Complex strategic decision',
      metadata: {
        confidence: 0.85,
        alternatives: ['core:flee', 'core:attack'],
      },
    };

    env.stubLLM(complexResponse);

    // Must re-resolve adapter after stubLLM
    const currentAdapter = env.container.resolve(tokens.LLMAdapter);
    const response = await currentAdapter.getAIDecision({ actorId: aiActorId1 });
    const decision = JSON.parse(response);

    expect(decision.actionId).toBe('core:wait');
    expect(decision.targets.primary).toBe(aiActorId2);
    expect(decision.targets.secondary).toEqual(['item-1', 'item-2']);
    expect(decision.targets.options.stealthy).toBe(true);
    expect(decision.metadata.confidence).toBe(0.85);
    expect(decision.metadata.alternatives).toContain('core:flee');
  });
});
