/**
 * @file System load testing for multi-target action system
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TestBedClass } from '../common/entities/testBed.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import {
  measureRulePerformance,
  generatePerformanceReport,
} from '../common/rules/performanceTestingUtils.js';

describe('Multi-Target System Load Testing', () => {
  let testBed;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    testBed = new TestBedClass();
    const logger = testBed.logger;

    // Create mock services
    const safeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    const eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
    mockActor = { id: 'load_test_actor', name: 'Load Test Actor' };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('High Volume Testing', () => {
    it('should handle 1000 multi-target actions within performance limits', async () => {
      const actionGenerator = () => ({
        actionDefinitionId: 'load:test',
        commandString: 'load test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['load_item'],
            target: ['load_target'],
            location: ['load_location'],
          },
        },
      });

      const ruleExecutor = async () => {
        const action = actionGenerator();
        return await commandProcessor.dispatchAction(mockActor, action);
      };

      const metrics = await measureRulePerformance(ruleExecutor, {
        iterations: 1000,
        warmupIterations: 50,
        timeout: 100,
        measureMemory: true,
      });

      // Validate performance requirements
      expect(metrics.iterations.completed).toBeGreaterThan(950); // >95% success rate
      expect(metrics.iterations.timeouts).toBeLessThan(10); // <1% timeout rate
      expect(metrics.timing.average).toBeLessThan(10); // Average < 10ms
      expect(metrics.timing.percentiles.p95).toBeLessThan(20); // 95th percentile < 20ms

      // Validate memory usage
      if (metrics.memory) {
        expect(metrics.memory.leaked).toBeLessThan(5 * 1024 * 1024); // < 5MB leaked
      }

      console.log('\n' + generatePerformanceReport(metrics));
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentActors = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent_actor_${i}`,
        name: `Concurrent Actor ${i}`,
      }));

      const actionPromises = concurrentActors.map(async (actor) => {
        const actions = Array.from({ length: 100 }, (_, i) => ({
          actionDefinitionId: 'concurrent:test',
          commandString: `concurrent action ${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${actor.id}_${i}`],
              target: [`target_${actor.id}_${i}`],
            },
          },
        }));

        const results = [];
        const startTime = performance.now();

        for (const action of actions) {
          const result = await commandProcessor.dispatchAction(actor, action);
          results.push(result);
        }

        return {
          actorId: actor.id,
          count: results.length,
          duration: performance.now() - startTime,
          results,
        };
      });

      const actorResults = await Promise.all(actionPromises);

      // Validate all actors completed successfully
      expect(actorResults).toHaveLength(10);
      actorResults.forEach((result) => {
        expect(result.count).toBe(100);
        expect(result.duration).toBeLessThan(1000); // < 1s per actor
        expect(result.results).toHaveLength(100);
      });

      // Validate total system performance
      const totalActions = actorResults.reduce(
        (sum, result) => sum + result.count,
        0
      );
      const maxDuration = Math.max(
        ...actorResults.map((result) => result.duration)
      );

      expect(totalActions).toBe(1000);
      expect(maxDuration).toBeLessThan(1000); // Concurrent execution benefit
    });
  });

  describe('Memory Stress Testing', () => {
    it('should handle large target objects without memory issues', async () => {
      const largeTargetAction = {
        actionDefinitionId: 'memory:stress',
        commandString: 'memory stress test',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              `target_type_${i}`,
              [`target_${i}`],
            ])
          ),
        },
      };

      const initialMemory = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;

      // Process many large actions
      for (let i = 0; i < 50; i++) {
        await commandProcessor.dispatchAction(mockActor, largeTargetAction);
      }

      const finalMemory = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable despite large objects
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB
      }
    });

    it('should recover from memory pressure gracefully', async () => {
      // Simulate memory pressure by creating many large payloads
      const memoryIntensiveActions = [];

      for (let i = 0; i < 100; i++) {
        memoryIntensiveActions.push({
          actionDefinitionId: 'memory:intensive',
          commandString: `memory intensive ${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: Object.fromEntries(
              Array.from({ length: 50 }, (_, j) => [
                `type_${i}_${j}`,
                Array.from({ length: 10 }, (_, k) => `target_${i}_${j}_${k}`),
              ])
            ),
          },
        });
      }

      let successCount = 0;
      let errorCount = 0;

      for (const action of memoryIntensiveActions) {
        try {
          const result = await commandProcessor.dispatchAction(
            mockActor,
            action
          );
          if (result && result.success !== undefined) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // System should handle memory pressure gracefully
      expect(successCount).toBeGreaterThan(80); // >80% success rate under pressure
      expect(errorCount).toBeLessThan(20); // <20% error rate
    });
  });

  describe('Edge Case Load Testing', () => {
    it('should handle rapid switching between legacy and enhanced formats', async () => {
      const actions = [];

      // Create alternating legacy and enhanced actions
      for (let i = 0; i < 1000; i++) {
        if (i % 2 === 0) {
          // Legacy action
          actions.push({
            actionDefinitionId: 'format:legacy',
            commandString: `legacy action ${i}`,
            resolvedParameters: {
              targetId: `legacy_target_${i}`,
            },
          });
        } else {
          // Enhanced action
          actions.push({
            actionDefinitionId: 'format:enhanced',
            commandString: `enhanced action ${i}`,
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: {
                item: [`enhanced_item_${i}`],
                target: [`enhanced_target_${i}`],
              },
            },
          });
        }
      }

      const startTime = performance.now();
      const results = {
        legacy: { count: 0, successCount: 0 },
        enhanced: { count: 0, successCount: 0 },
      };

      for (const action of actions) {
        try {
          const result = await commandProcessor.dispatchAction(
            mockActor,
            action
          );

          if (action.resolvedParameters?.isMultiTarget) {
            results.enhanced.count++;
            if (result.success) results.enhanced.successCount++;
          } else {
            results.legacy.count++;
            if (result.success) results.legacy.successCount++;
          }
        } catch (error) {
          // Count as failure for appropriate format
        }
      }

      const totalTime = performance.now() - startTime;

      // Validate results
      expect(results.legacy.count).toBe(500);
      expect(results.enhanced.count).toBe(500);
      expect(results.legacy.successCount).toBeGreaterThan(480); // >96% success
      expect(results.enhanced.successCount).toBeGreaterThan(480); // >96% success
      expect(totalTime).toBeLessThan(5000); // < 5s total
    });

    it('should maintain stability under error-prone conditions', async () => {
      const errorProneActions = [];

      // Create actions with various error conditions
      for (let i = 0; i < 200; i++) {
        const errorType = i % 5;

        switch (errorType) {
          case 0: // Null resolved parameters
            errorProneActions.push({
              actionDefinitionId: 'error:null_params',
              commandString: `error action ${i}`,
              resolvedParameters: null,
            });
            break;
          case 1: // Invalid targetIds structure
            errorProneActions.push({
              actionDefinitionId: 'error:invalid_structure',
              commandString: `error action ${i}`,
              resolvedParameters: {
                isMultiTarget: true,
                targetIds: 'invalid_string',
              },
            });
            break;
          case 2: // Empty targetIds object
            errorProneActions.push({
              actionDefinitionId: 'error:empty_targets',
              commandString: `error action ${i}`,
              resolvedParameters: {
                isMultiTarget: true,
                targetIds: {},
              },
            });
            break;
          case 3: // Malformed targetIds
            errorProneActions.push({
              actionDefinitionId: 'error:malformed',
              commandString: `error action ${i}`,
              resolvedParameters: {
                isMultiTarget: true,
                targetIds: {
                  item: null,
                  target: undefined,
                  location: [],
                },
              },
            });
            break;
          case 4: // Valid action (control)
            errorProneActions.push({
              actionDefinitionId: 'error:valid_control',
              commandString: `error action ${i}`,
              resolvedParameters: {
                isMultiTarget: true,
                targetIds: {
                  item: [`valid_item_${i}`],
                  target: [`valid_target_${i}`],
                },
              },
            });
            break;
        }
      }

      let processedCount = 0;
      let errorCount = 0;
      let validPayloadCount = 0;

      for (const action of errorProneActions) {
        try {
          const result = await commandProcessor.dispatchAction(
            mockActor,
            action
          );
          processedCount++;

          if (
            result &&
            result.success !== undefined &&
            result.originalInput &&
            result.actionResult
          ) {
            validPayloadCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // System should handle errors gracefully and continue processing
      expect(processedCount + errorCount).toBe(200);
      expect(validPayloadCount).toBeGreaterThan(160); // >80% valid payloads
      expect(errorCount).toBeLessThan(40); // <20% unrecoverable errors
    });
  });
});
