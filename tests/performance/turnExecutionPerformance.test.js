/**
 * @file Performance benchmarks for turn execution
 * @description Tests focused on measuring and validating turn execution performance
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMockFacades } from '../../src/testing/facades/testingFacadeRegistrations.js';

describe('Turn Execution Performance', () => {
  let turnExecutionFacade;
  let testEnvironment;

  beforeEach(async () => {
    const facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;
    
    // Initialize test environment
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment();
  });

  afterEach(async () => {
    await turnExecutionFacade.clearTestData();
    await turnExecutionFacade.dispose();
  });

  /**
   * Test: Performance benchmarking
   * Demonstrates performance testing capabilities of the facade.
   */
  it('should complete turns within performance targets', async () => {
    const mockDecision = {
      actionId: 'core:look',
      targets: {},
    };

    const mockValidation = {
      success: true,
      validatedAction: {
        actionId: 'core:look',
        actorId: testEnvironment.actors.aiActorId,
        targets: {},
      },
    };

    turnExecutionFacade.setupMocks({
      aiResponses: {
        [testEnvironment.actors.aiActorId]: mockDecision,
      },
      actionResults: {
        [testEnvironment.actors.aiActorId]: [
          { actionId: 'core:look', name: 'Look Around', available: true },
        ],
      },
      validationResults: {
        [`${testEnvironment.actors.aiActorId}:core:look`]: mockValidation,
      },
    });

    // Execute multiple turns and measure performance
    const turnCount = 5;
    const results = [];

    for (let i = 0; i < turnCount; i++) {
      const result = await turnExecutionFacade.executeAITurn(
        testEnvironment.actors.aiActorId
      );
      results.push(result);
    }

    // Verify all turns succeeded
    results.forEach((result) => {
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    // Check performance targets (sub-100ms as mentioned in the report)
    const averageDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / turnCount;
    const maxDuration = Math.max(...results.map((r) => r.duration));

    // Performance assertions (these would be real targets in production)
    expect(averageDuration).toBeLessThan(100); // Average under 100ms
    expect(maxDuration).toBeLessThan(200); // Max under 200ms

    console.log(`Performance: Avg ${averageDuration}ms, Max ${maxDuration}ms`);
  });

  /**
   * Test: Performance Validation
   *
   * Ensures the complete turn execution meets performance requirements
   * as specified in the report recommendations.
   */
  it('should complete turn execution within performance limits', async () => {
    // Setup successful response
    const decision = {
      actionId: 'core:wait',
      targets: {},
      speech: "I'll just wait here quietly.",
      thoughts: 'Patience is a virtue.',
    };

    turnExecutionFacade.setupMocks({
      aiResponses: {
        [testEnvironment.actors.aiActorId]: decision,
      },
      actionResults: {
        [testEnvironment.actors.aiActorId]: [
          { actionId: 'core:wait', name: 'Wait', available: true },
        ],
      },
      validationResults: {
        [`${testEnvironment.actors.aiActorId}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: testEnvironment.actors.aiActorId,
            targets: {},
          },
        },
      },
    });

    // Measure performance across multiple turns using facade's built-in timing
    const measurements = [];
    const numberOfTurns = 5;

    for (let i = 0; i < numberOfTurns; i++) {
      const turnResult = await turnExecutionFacade.executeAITurn(
        testEnvironment.actors.aiActorId
      );

      measurements.push({
        turnNumber: i + 1,
        executionTime: turnResult.duration, // Facade provides built-in timing
        success: turnResult.success,
      });

      // Each turn should be successful
      expect(turnResult.success).toBe(true);
      expect(turnResult.duration).toBeGreaterThanOrEqual(0);
    }

    // Analyze performance metrics
    const avgExecutionTime =
      measurements.reduce((sum, m) => sum + m.executionTime, 0) /
      measurements.length;
    const maxExecutionTime = Math.max(
      ...measurements.map((m) => m.executionTime)
    );

    // Performance requirements
    expect(avgExecutionTime).toBeLessThan(2000); // Average < 2 seconds
    expect(maxExecutionTime).toBeLessThan(5000); // Max < 5 seconds

    // All turns should have succeeded
    expect(measurements.every((m) => m.success)).toBe(true);
  });
});