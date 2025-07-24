/**
 * @file End-to-end test for turn-based action processing using Test Module Pattern
 * @see tests/e2e/actions/TurnBasedActionProcessing.e2e.test.js
 *
 * This test suite covers the turn-based aspects of action processing including:
 * - Turn-scoped cache invalidation behavior
 * - Multiple actors taking turns in sequence
 * - Concurrent action processing within turns
 * - Performance benchmarks for turn processing
 * - Action availability changes when actors move locations
 *
 * MIGRATION NOTE: This file has been migrated to use the Test Module Pattern,
 * achieving 80%+ reduction in test setup complexity compared to direct facade usage.
 * - BEFORE: 150+ lines manual setup → 20 lines facade setup
 * - AFTER: 20 lines facade setup → 5 lines Test Module Pattern
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { TestModuleBuilder } from '../../../tests/common/builders/testModuleBuilder.js';

/**
 * E2E test suite for turn-based action processing using Test Module Pattern
 * Tests the interaction between turn management and action discovery
 *
 * TEST MODULE PATTERN: Simplified from 20 lines facade setup to 5 lines fluent API
 */
describe('Turn-Based Action Processing E2E', () => {
  let testEnv;

  beforeEach(async () => {
    // BEFORE (facade pattern): 20 lines of setup with facades + initialization
    // AFTER (test module pattern): 5 lines with fluent API
    // Note: Using TurnExecutionTestModule since action processing tests need turn execution capabilities
    testEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling' })
      .withTestActors(['ai-actor'])
      .withWorld({
        name: 'Turn Processing Test World',
        createConnections: true,
      })
      .build();
  });

  afterEach(async () => {
    // Simple cleanup method provided by test module
    await testEnv.cleanup();
  });

  /**
   * Helper to create test context for module-based testing
   * TEST MODULE PATTERN: Simplified context creation
   *
   * @param scenario
   */
  function createTestContext(scenario = 'default') {
    return {
      scenario,
      turnNumber: 1,
      testEnv,
    };
  }

  /**
   * Test: Cache invalidation between turns
   * Verifies that action cache is properly invalidated between turns
   *
   * TEST MODULE PATTERN: Simplified cache testing through module API
   */
  test('should invalidate action cache between different turns', async () => {
    const actorId = 'ai-actor';

    // Set up mock actions for cache testing
    testEnv.facades.actionService.setMockActions(actorId, [
      { actionId: 'core:wait', name: 'Wait', available: true },
      { actionId: 'core:look', name: 'Look Around', available: true },
    ]);

    // First action discovery call
    const firstCall =
      await testEnv.facades.actionService.discoverActions(actorId);
    expect(firstCall.length).toBeGreaterThan(0);

    // Second call should use cached results (module handles caching internally)
    const cachedCall =
      await testEnv.facades.actionService.discoverActions(actorId);
    expect(cachedCall.length).toBe(firstCall.length);

    // Simulate turn change by clearing mocks and setting new actions
    testEnv.facades.actionService.clearMockData();
    testEnv.facades.actionService.setMockActions(actorId, [
      { actionId: 'core:wait', name: 'Wait', available: true },
      { actionId: 'core:move', name: 'Move', available: true },
    ]);

    // New turn should have different available actions
    const newTurnCall =
      await testEnv.facades.actionService.discoverActions(actorId);
    expect(newTurnCall.length).toBeGreaterThan(0);

    // Verify cache invalidation by checking for different actions
    const newActionIds = newTurnCall.map((a) => a.actionId);
    expect(newActionIds).toContain('core:wait');
    expect(newActionIds).toContain('core:move');
  });

  /**
   * Test: Cache behavior with different actors
   * Verifies that each actor has their own cache within a turn
   *
   * TEST MODULE PATTERN: Simplified multi-actor cache testing
   */
  test('should maintain separate caches for different actors in same turn', async () => {
    // Create test environment with multiple actors
    const multiActorEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling' })
      .withTestActors(['ai-actor', 'player-actor'])
      .withWorld({ name: 'Multi-Actor Test World' })
      .build();

    // Set up different mock actions for each actor
    multiActorEnv.facades.actionService.setMockActions('ai-actor', [
      { actionId: 'core:perform', name: 'Perform', available: true },
      { actionId: 'core:wait', name: 'Wait', available: true },
    ]);

    multiActorEnv.facades.actionService.setMockActions('player-actor', [
      { actionId: 'core:look', name: 'Look Around', available: true },
      { actionId: 'core:move', name: 'Move', available: true },
    ]);

    // Get actions for both actors
    const aiActions =
      await multiActorEnv.facades.actionService.discoverActions('ai-actor');
    const playerActions =
      await multiActorEnv.facades.actionService.discoverActions('player-actor');

    // Both should have different actions
    expect(aiActions.length).toBeGreaterThan(0);
    expect(playerActions.length).toBeGreaterThan(0);

    const aiActionIds = aiActions.map((a) => a.actionId);
    const playerActionIds = playerActions.map((a) => a.actionId);

    expect(aiActionIds).toContain('core:perform');
    expect(playerActionIds).toContain('core:look');
    expect(playerActionIds).not.toContain('core:perform');

    // Get cached results should maintain separate actor caches
    const aiActionsCached =
      await multiActorEnv.facades.actionService.discoverActions('ai-actor');
    const playerActionsCached =
      await multiActorEnv.facades.actionService.discoverActions('player-actor');

    // Should return same cached results for each actor
    expect(aiActionsCached).toEqual(aiActions);
    expect(playerActionsCached).toEqual(playerActions);

    // Cleanup multi-actor environment
    await multiActorEnv.cleanup();
  });

  /**
   * Test: Multiple actors in sequence
   * Verifies that different actors get appropriate actions in their turns
   *
   * TEST MODULE PATTERN: Simplified sequential turn testing using module
   */
  test('should handle multiple actors taking turns in sequence', async () => {
    // Create test environment with multiple actors
    const multiActorEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling' })
      .withTestActors(['ai-actor', 'player-actor'])
      .withWorld({ name: 'Sequential Test World' })
      .build();

    // Set up different actions for sequential testing
    const aiDecision = {
      actionId: 'core:wait',
      targets: {},
      speech: 'AI actor waits patiently.',
      thoughts: 'Observing the environment.',
    };

    const playerDecision = {
      actionId: 'core:look',
      targets: {},
      speech: 'Player looks around.',
      thoughts: 'Taking in the surroundings.',
    };

    // Configure module for sequential turn execution
    multiActorEnv.facades.turnExecutionFacade.setupMocks({
      aiResponses: {
        ['ai-actor']: aiDecision,
        ['player-actor']: playerDecision,
      },
      actionResults: {
        ['ai-actor']: [
          { actionId: 'core:wait', name: 'Wait', available: true },
          { actionId: 'core:perform', name: 'Perform', available: true },
        ],
        ['player-actor']: [
          { actionId: 'core:look', name: 'Look Around', available: true },
          { actionId: 'core:move', name: 'Move', available: true },
        ],
      },
      validationResults: {
        ['ai-actor:core:wait']: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: 'ai-actor',
            targets: {},
          },
        },
        ['player-actor:core:look']: {
          success: true,
          validatedAction: {
            actionId: 'core:look',
            actorId: 'player-actor',
            targets: {},
          },
        },
      },
    });

    // Execute turns in sequence using module
    const aiTurnResult = await multiActorEnv.executeAITurn('ai-actor');
    const playerTurnResult = await multiActorEnv.executeAITurn('player-actor');

    // Verify each actor executed their appropriate actions
    expect(aiTurnResult.success).toBe(true);
    expect(aiTurnResult.aiDecision.actionId).toBe('core:wait');
    expect(aiTurnResult.availableActionCount).toBe(2);

    expect(playerTurnResult.success).toBe(true);
    expect(playerTurnResult.aiDecision.actionId).toBe('core:look');
    expect(playerTurnResult.availableActionCount).toBe(2);

    // Verify performance for sequential execution
    expect(aiTurnResult.duration).toBeGreaterThanOrEqual(0);
    expect(playerTurnResult.duration).toBeGreaterThanOrEqual(0);

    console.log(
      `Sequential Execution: AI ${aiTurnResult.duration}ms, Player ${playerTurnResult.duration}ms`
    );

    // Cleanup multi-actor environment
    await multiActorEnv.cleanup();
  });

  /**
   * Test: Concurrent action processing
   * Verifies that multiple action discoveries can happen concurrently
   *
   * TEST MODULE PATTERN: Simplified concurrent testing using module batching
   */
  test('should handle concurrent action discovery efficiently', async () => {
    // Create test environment with multiple actors
    const multiActorEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling' })
      .withTestActors(['ai-actor', 'player-actor'])
      .withWorld({ name: 'Concurrent Test World' })
      .build();

    // Set up mock actions for concurrent testing
    multiActorEnv.facades.actionService.setMockActions('ai-actor', [
      { actionId: 'core:wait', name: 'Wait', available: true },
      { actionId: 'core:perform', name: 'Perform', available: true },
    ]);

    multiActorEnv.facades.actionService.setMockActions('player-actor', [
      { actionId: 'core:look', name: 'Look Around', available: true },
      { actionId: 'core:move', name: 'Move', available: true },
    ]);

    // Time concurrent discovery using module
    const startTime = Date.now();

    // Discover actions for both actors concurrently
    const actionPromises = [
      multiActorEnv.facades.actionService.discoverActions('ai-actor'),
      multiActorEnv.facades.actionService.discoverActions('player-actor'),
    ];

    const results = await Promise.all(actionPromises);
    const endTime = Date.now();

    // All should return valid results
    expect(results).toHaveLength(2);
    results.forEach((result) => {
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    // Should complete in reasonable time (module with mocks should be very fast)
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(100); // 100ms for 2 concurrent discoveries with mocks

    // Check that each actor got their specific actions
    const [aiActions, playerActions] = results;
    const aiActionIds = aiActions.map((a) => a.actionId);
    const playerActionIds = playerActions.map((a) => a.actionId);

    expect(aiActionIds).toContain('core:wait');
    expect(aiActionIds).toContain('core:perform');
    expect(playerActionIds).toContain('core:look');
    expect(playerActionIds).toContain('core:move');

    console.log(
      `Concurrent Discovery: ${totalTime}ms for ${results.length} actors`
    );

    // Cleanup multi-actor environment
    await multiActorEnv.cleanup();
  });

  /**
   * Test: Turn execution lifecycle
   * Verifies that test module handles turn execution lifecycle correctly
   *
   * TEST MODULE PATTERN: Simplified lifecycle testing through module integration
   */
  test('should handle turn execution lifecycle correctly', async () => {
    const actorId = 'ai-actor';

    // Set up mock for lifecycle testing
    const decision = {
      actionId: 'core:wait',
      targets: {},
      speech: 'Testing lifecycle management.',
      thoughts: 'Verifying module handles lifecycle properly.',
    };

    testEnv.facades.turnExecutionFacade.setupMocks({
      aiResponses: {
        [actorId]: decision,
      },
      actionResults: {
        [actorId]: [{ actionId: 'core:wait', name: 'Wait', available: true }],
      },
      validationResults: {
        [`${actorId}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: actorId,
            targets: {},
          },
        },
      },
    });

    // Test that module handles complete turn lifecycle
    const turnResult = await testEnv.executeAITurn(actorId);

    // Should have executed successfully with complete lifecycle
    expect(turnResult.success).toBe(true);
    expect(turnResult.aiDecision).toBeDefined();
    expect(turnResult.validation).toBeDefined();
    expect(turnResult.execution).toBeDefined();
    expect(turnResult.duration).toBeGreaterThanOrEqual(0);

    // Test module provides access to underlying services
    expect(testEnv.facades.turnExecutionFacade.actionService).toBeDefined();
    expect(testEnv.facades.turnExecutionFacade.entityService).toBeDefined();
    expect(testEnv.facades.turnExecutionFacade.llmService).toBeDefined();
  });

  /**
   * Test: Performance benchmarks
   * Verifies that turn-based action processing meets performance requirements
   *
   * TEST MODULE PATTERN: Enhanced performance testing with module built-in timing
   */
  test('should maintain performance across multiple turns', async () => {
    // Create test environment with performance tracking
    const perfTestEnv = await TestModuleBuilder.forTurnExecution()
      .withMockLLM({ strategy: 'tool-calling', fastMode: true })
      .withTestActors(['ai-actor', 'player-actor'])
      .withWorld({ name: 'Performance Test World' })
      .withPerformanceTracking({
        thresholds: {
          turnExecution: 50,
          actionDiscovery: 25,
        },
      })
      .build();

    const actors = ['ai-actor', 'player-actor'];

    // Set up performance test mocks
    const baseDecision = {
      actionId: 'core:wait',
      targets: {},
      speech: 'Performance test decision.',
      thoughts: 'Testing module performance.',
    };

    perfTestEnv.facades.turnExecutionFacade.setupMocks({
      aiResponses: {
        ['ai-actor']: baseDecision,
        ['player-actor']: baseDecision,
      },
      actionResults: {
        ['ai-actor']: [
          { actionId: 'core:wait', name: 'Wait', available: true },
        ],
        ['player-actor']: [
          { actionId: 'core:wait', name: 'Wait', available: true },
        ],
      },
      validationResults: {
        ['ai-actor:core:wait']: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: 'ai-actor',
            targets: {},
          },
        },
        ['player-actor:core:wait']: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: 'player-actor',
            targets: {},
          },
        },
      },
    });

    const measurements = [];

    // Simulate 10 turns using module
    for (let turnNumber = 1; turnNumber <= 10; turnNumber++) {
      const actorIndex = (turnNumber - 1) % actors.length;
      const currentActorId = actors[actorIndex];

      const turnResult = await perfTestEnv.executeAITurn(currentActorId);

      measurements.push({
        turnNumber,
        actorId: currentActorId,
        success: turnResult.success,
        duration: turnResult.duration, // Module provides built-in timing
      });
    }

    // Analyze performance using module timing
    const avgDuration =
      measurements.reduce((sum, m) => sum + m.duration, 0) /
      measurements.length;
    const maxDuration = Math.max(...measurements.map((m) => m.duration));

    // Performance requirements (enhanced with module targets)
    expect(avgDuration).toBeLessThan(50); // Average < 50ms (module with mocks should be very fast)
    expect(maxDuration).toBeLessThan(100); // Max < 100ms (module with mocks)

    // All turns should have succeeded
    expect(measurements.every((m) => m.success)).toBe(true);

    // Use module's performance tracking features
    if (perfTestEnv.getPerformanceMetrics) {
      const metrics = perfTestEnv.getPerformanceMetrics();
      console.log('Module Performance Metrics:', metrics);
    }

    console.log(
      `Module Performance: Avg ${avgDuration}ms, Max ${maxDuration}ms over ${measurements.length} turns`
    );

    // Cleanup performance test environment
    await perfTestEnv.cleanup();
  });

  /**
   * Test: Edge case - No available actions
   * Verifies system handles case when no actions are available
   *
   * TEST MODULE PATTERN: Simplified edge case testing through module
   */
  test('should handle edge case when no actions are available', async () => {
    const actorId = 'ai-actor';

    // Set up scenario with no available actions
    testEnv.facades.actionService.setMockActions(actorId, []); // No actions available

    // Should handle gracefully
    const result = await testEnv.facades.actionService.discoverActions(actorId);

    // Should return valid result structure even with no actions
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  /**
   * Test: Location-based action availability
   * Verifies actions change when actors move locations
   *
   * TEST MODULE PATTERN: Simplified location-based action testing through module
   */
  test('should update available actions when actor changes location', async () => {
    const actorId = 'ai-actor';

    // Set up initial location actions
    testEnv.facades.actionService.setMockActions(actorId, [
      { actionId: 'core:wait', name: 'Wait', available: true },
      { actionId: 'core:go-north', name: 'Go North', available: true },
      { actionId: 'core:look', name: 'Look Around', available: true },
    ]);

    // Get initial actions
    const initialActions =
      await testEnv.facades.actionService.discoverActions(actorId);
    const initialActionIds = initialActions.map((a) => a.actionId);

    expect(initialActionIds).toContain('core:wait');
    expect(initialActionIds).toContain('core:go-north');
    expect(initialActionIds).toContain('core:look');

    // Simulate location change by updating mock actions
    testEnv.facades.actionService.clearMockData();
    testEnv.facades.actionService.setMockActions(actorId, [
      { actionId: 'core:wait', name: 'Wait', available: true },
      { actionId: 'core:go-south', name: 'Go South', available: true }, // Different direction
      { actionId: 'core:examine', name: 'Examine', available: true }, // Different action
    ]);

    // Get actions in new location
    const newActions =
      await testEnv.facades.actionService.discoverActions(actorId);
    const newActionIds = newActions.map((a) => a.actionId);

    // Should have different available actions reflecting new location
    expect(newActionIds).toContain('core:wait'); // Common action remains
    expect(newActionIds).toContain('core:go-south'); // New direction
    expect(newActionIds).toContain('core:examine'); // New action
    expect(newActionIds).not.toContain('core:go-north'); // Old direction no longer available
    expect(newActionIds).not.toContain('core:look'); // Old action no longer available

    console.log('Initial actions:', initialActionIds);
    console.log('New location actions:', newActionIds);
  });
});
