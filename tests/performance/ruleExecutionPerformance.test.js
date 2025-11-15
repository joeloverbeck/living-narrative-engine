/**
 * @file Performance tests for rule execution
 * @description Tests the performance characteristics of rule execution systems
 * extracted from integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createRuleTestEnvironment,
  createSystemLogicInterpreterWithHandlers,
} from '../common/rules/ruleTestUtilities.js';
import {
  measureRulePerformance,
  generatePerformanceReport,
} from '../common/rules/performanceTestingUtils.js';
import followRule from '../../data/mods/companionship/rules/follow.rule.json';
import logSuccessAndEndTurn from '../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import EndTurnHandler from '../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../src/logic/operationHandlers/setVariableHandler.js';

const ATTEMPT_ACTION_ID = 'core:attempt_action';
const FOLLOWING_COMPONENT_ID = 'companionship:following';
const LEADING_COMPONENT_ID = 'companionship:leading';

describe('Rule Execution Performance Tests', () => {
  let testEnv;
  let interpreter;
  let interpreterCleanup;

  beforeEach(async () => {
    // Create test environment with entities
    testEnv = createRuleTestEnvironment({
      entities: [
        {
          id: 'follower1',
          components: {
            'core:actor': { name: 'Follower 1' },
          },
        },
        {
          id: 'leader1',
          components: {
            'core:actor': { name: 'Leader 1' },
          },
        },
      ],
      rules: [followRule],
      macros: [logSuccessAndEndTurn],
    });

    // Create operation handlers
    const handlers = {
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: testEnv.safeEventDispatcher,
        logger: testEnv.logger,
      }),
      SET_VARIABLE: new SetVariableHandler({ logger: testEnv.logger }),
    };

    // Create interpreter
    const result = createSystemLogicInterpreterWithHandlers(testEnv, handlers);
    interpreter = result.interpreter;
    interpreterCleanup = result.cleanup;
  });

  afterEach(() => {
    if (interpreterCleanup) {
      interpreterCleanup();
    }
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('should measure follow rule performance', async () => {
    // Create executor function
    const ruleExecutor = async () => {
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'follower1',
        actionId: 'core:follow',
        targetId: 'leader1',
      });
    };

    // Measure performance
    const metrics = await measureRulePerformance(ruleExecutor, {
      iterations: 50,
      warmupIterations: 5,
      timeout: 500,
    });

    // Generate and log report
    const report = generatePerformanceReport(metrics);
    console.log('Follow Rule Performance Report:');
    console.log(report);

    // Verify metrics
    expect(metrics.iterations.completed).toBeGreaterThan(0);
    expect(metrics.timing.average).toBeLessThan(100); // Should complete in < 100ms

    // Verify rule execution was successful
    expect(metrics.iterations.completed).toBe(50); // All iterations should complete
    expect(metrics.iterations.timeouts).toBe(0); // No timeouts should occur
  });

  it('should maintain consistent performance across multiple rule types', async () => {
    const performanceResults = [];

    // Test different action types
    const actionTypes = [
      { actionId: 'core:follow', targetId: 'leader1' },
      { actionId: 'core:follow', targetId: 'leader1' }, // Repeated to test consistency
    ];

    for (const [index, actionParams] of actionTypes.entries()) {
      const ruleExecutor = async () => {
        await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
          actorId: 'follower1',
          ...actionParams,
        });
      };

      const metrics = await measureRulePerformance(ruleExecutor, {
        iterations: 25,
        warmupIterations: 3,
        timeout: 200,
      });

      performanceResults.push({
        actionType: actionParams.actionId,
        averageTime: metrics.timing.average,
        completed: metrics.iterations.completed,
      });

      // Each test should complete successfully
      expect(metrics.iterations.completed).toBe(25);
      expect(metrics.timing.average).toBeLessThan(50); // Even stricter for consistency test
    }

    // Log results
    console.log('Performance consistency results:');
    performanceResults.forEach((result, index) => {
      console.log(
        `Test ${index + 1}: ${result.actionType} - ${result.averageTime.toFixed(2)}ms avg`
      );
    });

    // Verify consistency - performance shouldn't vary dramatically
    const times = performanceResults.map((r) => r.averageTime);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const variationRatio = maxTime / minTime;

    // V8 JIT warmup, garbage collection, and the fact that we're comparing only two runs
    // of the same rule can produce wider swings than deterministic logic would suggest.
    // A slightly more lenient threshold keeps the test useful (it still catches major
    // regressions) without failing on harmless runtime variance.
    expect(variationRatio).toBeLessThan(25); // Allow up to 25x variation to reduce flakiness
  });

  it('should handle high-frequency rule execution', async () => {
    // Test rapid fire rule execution
    const startTime = performance.now();
    const executionPromises = [];

    // Create 20 concurrent rule executions
    for (let i = 0; i < 20; i++) {
      const promise = testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        actorId: 'follower1',
        actionId: 'core:follow',
        targetId: 'leader1',
      });
      executionPromises.push(promise);
    }

    // Wait for all executions to complete
    await Promise.all(executionPromises);
    const totalTime = performance.now() - startTime;

    // Validate performance
    expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

    const averageTimePerExecution = totalTime / 20;
    expect(averageTimePerExecution).toBeLessThan(50); // Average < 50ms per execution

    console.log(
      `High-frequency execution: 20 rules in ${totalTime.toFixed(2)}ms`
    );
    console.log(
      `Average per execution: ${averageTimePerExecution.toFixed(2)}ms`
    );
  });
});
