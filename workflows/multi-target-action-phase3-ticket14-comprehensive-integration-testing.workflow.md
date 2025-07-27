# Ticket 14: Comprehensive Integration Testing

## Overview

Conduct comprehensive end-to-end integration testing of the complete multi-target action system. This includes testing the full pipeline from action formatting through command processing to rule execution, validating performance, backward compatibility, and ensuring all components work together seamlessly under realistic game conditions.

## Dependencies

- Ticket 13: Add Rules Testing Framework (must be completed)
- Ticket 12: Update Core Rules for Multi-Target Support (must be completed)
- Ticket 11: Create Multi-Target Rule Examples (must be completed)
- All Phase 2 tickets (7-10) must be completed

## Blocks

- Phase 4: Documentation & Migration

## Priority: Critical

## Estimated Time: 12-15 hours

## Background

With all multi-target system components implemented, comprehensive integration testing is needed to validate the complete system works correctly. This includes testing the entire action pipeline, performance under load, backward compatibility, error handling, and ensuring all components integrate properly.

## Implementation Details

### 1. Create Integration Test Suite

**File**: `tests/integration/multiTargetActionIntegration.test.js`

```javascript
/**
 * @file Comprehensive integration tests for multi-target action system
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { TestBedClass } from '../common/testbed.js';
import GameEngine from '../../src/engine/gameEngine.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import RulesTestingFramework from '../frameworks/rulesTestingFramework.js';

describe('Multi-Target Action System Integration', () => {
  let testBed;
  let gameEngine;
  let commandProcessor;
  let testingFramework;
  let mockWorld;

  beforeAll(async () => {
    testBed = new TestBedClass();
    await testBed.setupCompleteGameEnvironment();
  });

  afterAll(() => {
    testBed.cleanup();
  });

  beforeEach(async () => {
    // Create fresh instances for each test
    const logger = testBed.createMockLogger();
    const eventBus = testBed.createMockEventBus();
    const entityManager = testBed.createMockEntityManager();

    gameEngine = new GameEngine({ logger, eventBus, entityManager });
    commandProcessor = new CommandProcessor({ logger, eventBus });
    testingFramework = new RulesTestingFramework({ 
      logger, 
      rulesEngine: gameEngine.getRulesEngine(), 
      eventBus 
    });

    // Setup test world with entities
    mockWorld = await testBed.createMockWorld({
      actors: ['player', 'npc1', 'npc2'],
      items: ['knife', 'potion', 'scroll', 'hammer'],
      locations: ['room1', 'room2', 'forge']
    });
  });

  afterEach(() => {
    testingFramework.cleanup();
  });

  describe('End-to-End Action Processing', () => {
    it('should process multi-target throw action completely', async () => {
      // Setup scenario
      const actor = mockWorld.actors.player;
      const knife = mockWorld.items.knife;
      const target = mockWorld.actors.npc1;

      // Simulate action formatting stage output
      const turnAction = {
        actionDefinitionId: 'combat:throw',
        commandString: 'throw knife at npc1',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: [knife.id],
            target: [target.id]
          }
        }
      };

      // Process action through command processor
      const startTime = performance.now();
      const payload = await commandProcessor.createAttemptActionPayload(actor, turnAction);
      const processingTime = performance.now() - startTime;

      // Validate payload structure
      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: actor.id,
        actionId: 'combat:throw',
        originalInput: 'throw knife at npc1'
      });

      expect(payload.targets).toEqual({
        item: knife.id,
        target: target.id
      });

      expect(payload.targetId).toBe(knife.id); // Primary target for backward compatibility
      expect(payload.timestamp).toBeGreaterThan(0);

      // Dispatch event and capture rule executions
      const ruleExecutions = [];
      eventBus.on('rule_executed', (execution) => {
        ruleExecutions.push(execution);
      });

      await gameEngine.processEvent(payload);

      // Validate performance
      expect(processingTime).toBeLessThan(10); // Should complete within 10ms

      // Validate rule execution
      expect(ruleExecutions.length).toBeGreaterThan(0);
      const throwRule = ruleExecutions.find(exec => 
        exec.ruleId.includes('throw') || exec.ruleId.includes('combat')
      );
      expect(throwRule).toBeDefined();
      expect(throwRule.success).toBe(true);
    });

    it('should handle legacy single-target actions unchanged', async () => {
      // Setup legacy scenario
      const actor = mockWorld.actors.player;
      const target = mockWorld.actors.npc1;

      const legacyTurnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow npc1',
        resolvedParameters: {
          targetId: target.id
        }
      };

      // Process legacy action
      const payload = await commandProcessor.createAttemptActionPayload(actor, legacyTurnAction);

      // Validate legacy format preserved
      expect(payload).toEqual({
        eventName: 'core:attempt_action',
        actorId: actor.id,
        actionId: 'core:follow',
        targetId: target.id,
        originalInput: 'follow npc1',
        timestamp: expect.any(Number)
      });

      // Ensure no targets object
      expect(payload.targets).toBeUndefined();

      // Process through rules engine
      const ruleExecutions = [];
      eventBus.on('rule_executed', (execution) => {
        ruleExecutions.push(execution);
      });

      await gameEngine.processEvent(payload);

      // Validate rule execution
      const followRule = ruleExecutions.find(exec => 
        exec.ruleId.includes('follow')
      );
      expect(followRule).toBeDefined();
      expect(followRule.success).toBe(true);
    });

    it('should handle complex multi-target crafting scenario', async () => {
      const actor = mockWorld.actors.player;
      const hammer = mockWorld.items.hammer;
      const forge = mockWorld.locations.forge;
      const knife = mockWorld.items.knife; // Using as material

      const craftingAction = {
        actionDefinitionId: 'crafting:craft',
        commandString: 'craft at forge with hammer using knife',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            tool: [hammer.id],
            location: [forge.id],
            material: [knife.id]
          }
        }
      };

      const payload = await commandProcessor.createAttemptActionPayload(actor, craftingAction);

      expect(payload.targets).toEqual({
        tool: hammer.id,
        location: forge.id,
        material: knife.id
      });

      // Validate crafting rule can access all targets
      const testRule = {
        id: 'test:crafting_validation',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.actionId' }, 'crafting:craft'] },
                { var: 'event.targets.tool' },
                { var: 'event.targets.location' },
                { var: 'event.targets.material' }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'validate_crafting_setup',
            data: {
              tool: { var: 'event.targets.tool' },
              location: { var: 'event.targets.location' },
              material: { var: 'event.targets.material' }
            }
          }
        ]
      };

      const ruleResult = await testingFramework.testRuleWithEvents(testRule, [payload]);
      expect(ruleResult.passed).toBe(1);
      expect(ruleResult.failed).toBe(0);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with high action volume', async () => {
      const actor = mockWorld.actors.player;
      const actions = [];

      // Generate 100 different multi-target actions
      for (let i = 0; i < 100; i++) {
        actions.push({
          actionDefinitionId: 'test:multi_action',
          commandString: `test action ${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${i}`],
              target: [`target_${i}`],
              location: [`location_${i}`]
            }
          }
        });
      }

      const startTime = performance.now();
      const payloads = [];

      // Process all actions
      for (const action of actions) {
        const payload = await commandProcessor.createAttemptActionPayload(actor, action);
        payloads.push(payload);
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / actions.length;

      // Validate performance requirements
      expect(averageTime).toBeLessThan(5); // Average < 5ms per action
      expect(totalTime).toBeLessThan(500); // Total < 500ms for 100 actions

      // Validate all payloads are correct
      expect(payloads).toHaveLength(100);
      payloads.forEach((payload, index) => {
        expect(payload.targets).toEqual({
          item: `item_${index}`,
          target: `target_${index}`,
          location: `location_${index}`
        });
      });
    });

    it('should handle mixed legacy and enhanced actions efficiently', async () => {
      const actor = mockWorld.actors.player;
      const mixedActions = [];

      // Create mix of legacy and enhanced actions
      for (let i = 0; i < 50; i++) {
        // Legacy action
        mixedActions.push({
          actionDefinitionId: 'core:follow',
          commandString: `follow target_${i}`,
          resolvedParameters: {
            targetId: `target_${i}`
          }
        });

        // Enhanced action
        mixedActions.push({
          actionDefinitionId: 'combat:throw',
          commandString: `throw item_${i} at target_${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${i}`],
              target: [`target_${i}`]
            }
          }
        });
      }

      const startTime = performance.now();
      const results = {
        legacy: { count: 0, totalTime: 0 },
        enhanced: { count: 0, totalTime: 0 }
      };

      for (const action of mixedActions) {
        const actionStart = performance.now();
        const payload = await commandProcessor.createAttemptActionPayload(actor, action);
        const actionTime = performance.now() - actionStart;

        if (payload.targets) {
          results.enhanced.count++;
          results.enhanced.totalTime += actionTime;
        } else {
          results.legacy.count++;
          results.legacy.totalTime += actionTime;
        }
      }

      const totalTime = performance.now() - startTime;

      // Validate counts
      expect(results.legacy.count).toBe(50);
      expect(results.enhanced.count).toBe(50);

      // Validate performance parity
      const legacyAverage = results.legacy.totalTime / results.legacy.count;
      const enhancedAverage = results.enhanced.totalTime / results.enhanced.count;
      
      expect(legacyAverage).toBeLessThan(5);
      expect(enhancedAverage).toBeLessThan(10);
      expect(totalTime).toBeLessThan(1000); // Total < 1s for 100 actions
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle malformed multi-target data', async () => {
      const actor = mockWorld.actors.player;
      const malformedActions = [
        // Null targetIds
        {
          actionDefinitionId: 'test:action',
          commandString: 'test',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: null
          }
        },
        // Empty targetIds object
        {
          actionDefinitionId: 'test:action',
          commandString: 'test',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {}
          }
        },
        // Invalid targetIds structure
        {
          actionDefinitionId: 'test:action',
          commandString: 'test',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: 'invalid_string'
          }
        }
      ];

      for (const action of malformedActions) {
        // Should not throw errors
        const payload = await commandProcessor.createAttemptActionPayload(actor, action);
        
        // Should create valid fallback payload
        expect(payload).toMatchObject({
          eventName: 'core:attempt_action',
          actorId: actor.id,
          actionId: action.actionDefinitionId,
          originalInput: action.commandString
        });

        // Should have valid timestamp
        expect(payload.timestamp).toBeGreaterThan(0);
      }
    });

    it('should handle extraction service failures gracefully', async () => {
      const actor = mockWorld.actors.player;
      
      // Mock extraction service to fail
      const originalExtractTargets = commandProcessor._extractTargetData;
      commandProcessor._extractTargetData = jest.fn().mockRejectedValue(
        new Error('Extraction service failure')
      );

      const action = {
        actionDefinitionId: 'test:action',
        commandString: 'test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: { item: ['test'] }
        }
      };

      // Should create fallback payload
      const payload = await commandProcessor.createAttemptActionPayload(actor, action);
      
      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: actor.id,
        actionId: 'test:action',
        originalInput: 'test action'
      });

      // Restore original method
      commandProcessor._extractTargetData = originalExtractTargets;
    });

    it('should maintain system stability under error conditions', async () => {
      const actor = mockWorld.actors.player;
      const errorActions = [];

      // Generate actions that will cause various errors
      for (let i = 0; i < 20; i++) {
        errorActions.push({
          actionDefinitionId: null, // Invalid action ID
          commandString: `error action ${i}`,
          resolvedParameters: Math.random() > 0.5 ? null : {
            isMultiTarget: true,
            targetIds: Math.random() > 0.5 ? null : { invalid: ['data'] }
          }
        });
      }

      let successCount = 0;
      let errorCount = 0;

      for (const action of errorActions) {
        try {
          const payload = await commandProcessor.createAttemptActionPayload(actor, action);
          if (payload && payload.eventName) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // System should handle errors gracefully and continue processing
      expect(successCount + errorCount).toBe(20);
      expect(errorCount).toBeLessThan(20); // Some should succeed with fallbacks
    });
  });

  describe('Rule System Integration', () => {
    it('should execute enhanced rules with multi-target events', async () => {
      const enhancedRule = {
        id: 'integration:test_enhanced_rule',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] },
                { '==': [{ var: 'event.actionId' }, 'integration:test'] },
                { var: 'event.targets' }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'test_multi_target_processing',
            data: {
              actor: { var: 'event.actorId' },
              targets: { var: 'event.targets' },
              targetCount: { var: 'event.targets | keys | length' },
              primaryTarget: { var: 'event.targetId' }
            }
          }
        ]
      };

      const testEvent = {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'integration:test',
        targets: {
          item: 'test_item',
          target: 'test_target',
          location: 'test_location'
        },
        targetId: 'test_item',
        originalInput: 'integration test',
        timestamp: Date.now()
      };

      const result = await testingFramework.testRuleWithEvents(enhancedRule, [testEvent]);
      
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.details[0].execution.conditionsMet).toBe(true);
      expect(result.details[0].execution.operationsExecuted).toHaveLength(1);
    });

    it('should maintain backward compatibility in rule execution', async () => {
      const compatibleRule = {
        id: 'integration:test_compatible_rule',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] },
                { '==': [{ var: 'event.actionId' }, 'core:follow'] }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'process_follow',
            data: {
              follower: { var: 'event.actorId' },
              target: {
                if: [
                  { var: 'event.targets.target' },
                  { var: 'event.targets.target' },
                  { var: 'event.targetId' }
                ]
              }
            }
          }
        ]
      };

      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'core:follow',
        targetId: 'test_target',
        originalInput: 'follow target',
        timestamp: Date.now()
      };

      const enhancedEvent = {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'core:follow',
        targets: {
          target: 'test_target'
        },
        targetId: 'test_target',
        originalInput: 'follow target',
        timestamp: Date.now()
      };

      const legacyResult = await testingFramework.testRuleWithEvents(compatibleRule, [legacyEvent]);
      const enhancedResult = await testingFramework.testRuleWithEvents(compatibleRule, [enhancedEvent]);

      // Both should succeed
      expect(legacyResult.passed).toBe(1);
      expect(enhancedResult.passed).toBe(1);

      // Both should execute the same operations
      expect(legacyResult.details[0].execution.operationsExecuted).toHaveLength(1);
      expect(enhancedResult.details[0].execution.operationsExecuted).toHaveLength(1);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during extended operation', async () => {
      const actor = mockWorld.actors.player;
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Process many actions to test for memory leaks
      for (let batch = 0; batch < 10; batch++) {
        const actions = Array.from({ length: 50 }, (_, i) => ({
          actionDefinitionId: 'memory:test',
          commandString: `memory test ${batch}_${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${batch}_${i}`],
              target: [`target_${batch}_${i}`]
            }
          }
        }));

        for (const action of actions) {
          await commandProcessor.createAttemptActionPayload(actor, action);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 500 actions)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });

    it('should clean up resources properly', async () => {
      const actor = mockWorld.actors.player;
      const processor = new CommandProcessor({ 
        logger: testBed.createMockLogger(), 
        eventBus: testBed.createMockEventBus() 
      });

      // Process actions
      const actions = Array.from({ length: 100 }, (_, i) => ({
        actionDefinitionId: 'cleanup:test',
        commandString: `cleanup test ${i}`,
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: { item: [`item_${i}`] }
        }
      }));

      for (const action of actions) {
        await processor.createAttemptActionPayload(actor, action);
      }

      // Get metrics before cleanup
      const metricsBeforeCleanup = processor.getPayloadCreationStatistics();
      expect(metricsBeforeCleanup.totalPayloadsCreated).toBe(100);

      // Reset metrics (simulates cleanup)
      processor.resetPayloadCreationStatistics();
      const metricsAfterCleanup = processor.getPayloadCreationStatistics();

      expect(metricsAfterCleanup.totalPayloadsCreated).toBe(0);
      expect(metricsAfterCleanup.averageCreationTime).toBe(0);
    });
  });
});
```

### 2. Create System Load Testing

**File**: `tests/integration/systemLoadTesting.test.js`

```javascript
/**
 * @file System load testing for multi-target action system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../common/testbed.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import PerformanceTestingUtils from '../utils/performanceTestingUtils.js';

describe('Multi-Target System Load Testing', () => {
  let testBed;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    testBed = new TestBedClass();
    const logger = testBed.createMockLogger();
    const eventBus = testBed.createMockEventBus();
    
    commandProcessor = new CommandProcessor({ logger, eventBus });
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
            location: ['load_location']
          }
        }
      });

      const ruleExecutor = async () => {
        const action = actionGenerator();
        return await commandProcessor.createAttemptActionPayload(mockActor, action);
      };

      const metrics = await PerformanceTestingUtils.measureRulePerformance(ruleExecutor, {
        iterations: 1000,
        warmupIterations: 50,
        timeout: 100,
        measureMemory: true
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

      console.log('\n' + PerformanceTestingUtils.generatePerformanceReport(metrics));
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentActors = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent_actor_${i}`,
        name: `Concurrent Actor ${i}`
      }));

      const actionPromises = concurrentActors.map(async (actor) => {
        const actions = Array.from({ length: 100 }, (_, i) => ({
          actionDefinitionId: 'concurrent:test',
          commandString: `concurrent action ${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${actor.id}_${i}`],
              target: [`target_${actor.id}_${i}`]
            }
          }
        }));

        const results = [];
        const startTime = performance.now();

        for (const action of actions) {
          const payload = await commandProcessor.createAttemptActionPayload(actor, action);
          results.push(payload);
        }

        return {
          actorId: actor.id,
          count: results.length,
          duration: performance.now() - startTime,
          results
        };
      });

      const actorResults = await Promise.all(actionPromises);

      // Validate all actors completed successfully
      expect(actorResults).toHaveLength(10);
      actorResults.forEach(result => {
        expect(result.count).toBe(100);
        expect(result.duration).toBeLessThan(1000); // < 1s per actor
        expect(result.results).toHaveLength(100);
      });

      // Validate total system performance
      const totalActions = actorResults.reduce((sum, result) => sum + result.count, 0);
      const maxDuration = Math.max(...actorResults.map(result => result.duration));
      
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
            Array.from({ length: 100 }, (_, i) => [`target_type_${i}`, [`target_${i}`]])
          )
        }
      };

      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Process many large actions
      for (let i = 0; i < 50; i++) {
        await commandProcessor.createAttemptActionPayload(mockActor, largeTargetAction);
      }

      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
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
                Array.from({ length: 10 }, (_, k) => `target_${i}_${j}_${k}`)
              ])
            )
          }
        });
      }

      let successCount = 0;
      let errorCount = 0;

      for (const action of memoryIntensiveActions) {
        try {
          const payload = await commandProcessor.createAttemptActionPayload(mockActor, action);
          if (payload && payload.eventName) {
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
              targetId: `legacy_target_${i}`
            }
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
                target: [`enhanced_target_${i}`]
              }
            }
          });
        }
      }

      const startTime = performance.now();
      const results = {
        legacy: { count: 0, successCount: 0 },
        enhanced: { count: 0, successCount: 0 }
      };

      for (const action of actions) {
        try {
          const payload = await commandProcessor.createAttemptActionPayload(mockActor, action);
          
          if (payload.targets) {
            results.enhanced.count++;
            if (payload.eventName) results.enhanced.successCount++;
          } else {
            results.legacy.count++;
            if (payload.eventName) results.legacy.successCount++;
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
              resolvedParameters: null
            });
            break;
          case 1: // Invalid targetIds structure
            errorProneActions.push({
              actionDefinitionId: 'error:invalid_structure',
              commandString: `error action ${i}`,
              resolvedParameters: {
                isMultiTarget: true,
                targetIds: 'invalid_string'
              }
            });
            break;
          case 2: // Empty targetIds object
            errorProneActions.push({
              actionDefinitionId: 'error:empty_targets',
              commandString: `error action ${i}`,
              resolvedParameters: {
                isMultiTarget: true,
                targetIds: {}
              }
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
                  location: []
                }
              }
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
                  target: [`valid_target_${i}`]
                }
              }
            });
            break;
        }
      }

      let processedCount = 0;
      let errorCount = 0;
      let validPayloadCount = 0;

      for (const action of errorProneActions) {
        try {
          const payload = await commandProcessor.createAttemptActionPayload(mockActor, action);
          processedCount++;
          
          if (payload && payload.eventName && payload.actorId && payload.actionId) {
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
```

### 3. Create End-to-End Game Scenarios

**File**: `tests/integration/gameScenarios.test.js`

```javascript
/**
 * @file End-to-end game scenario testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../common/testbed.js';
import GameEngine from '../../src/engine/gameEngine.js';

describe('Multi-Target Game Scenarios', () => {
  let testBed;
  let gameEngine;
  let mockWorld;

  beforeEach(async () => {
    testBed = new TestBedClass();
    gameEngine = await testBed.createGameEngine();
    mockWorld = await testBed.createDetailedMockWorld();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Combat Scenarios', () => {
    it('should handle complete combat sequence', async () => {
      const scenario = mockWorld.scenarios.combat;
      const events = [];

      // Subscribe to all events
      gameEngine.eventBus.on('*', (event) => {
        events.push(event);
      });

      // Execute combat sequence
      await gameEngine.processPlayerAction(scenario.actor, 'equip sword');
      await gameEngine.processPlayerAction(scenario.actor, 'attack goblin with sword');
      await gameEngine.processPlayerAction(scenario.actor, 'throw dagger at goblin');

      // Validate event sequence
      const attemptActions = events.filter(e => e.eventName === 'core:attempt_action');
      expect(attemptActions).toHaveLength(3);

      // Validate multi-target events
      const throwEvent = attemptActions.find(e => e.actionId === 'combat:throw');
      expect(throwEvent).toBeDefined();
      expect(throwEvent.targets).toEqual({
        item: 'dagger',
        target: 'goblin'
      });

      const attackEvent = attemptActions.find(e => e.actionId === 'combat:attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent.targets).toEqual({
        weapon: 'sword',
        target: 'goblin'
      });
    });
  });

  describe('Crafting Scenarios', () => {
    it('should handle complex crafting workflow', async () => {
      const scenario = mockWorld.scenarios.crafting;
      const events = [];

      gameEngine.eventBus.on('*', (event) => {
        events.push(event);
      });

      // Execute crafting workflow
      await gameEngine.processPlayerAction(scenario.actor, 'go to forge');
      await gameEngine.processPlayerAction(scenario.actor, 'craft sword using iron with hammer at forge');

      const craftEvent = events.find(e => 
        e.eventName === 'core:attempt_action' && e.actionId === 'crafting:craft'
      );

      expect(craftEvent).toBeDefined();
      expect(craftEvent.targets).toEqual({
        material: 'iron',
        tool: 'hammer',
        location: 'forge'
      });
    });
  });

  describe('Social Interaction Scenarios', () => {
    it('should handle complex social interactions', async () => {
      const scenario = mockWorld.scenarios.social;
      const events = [];

      gameEngine.eventBus.on('*', (event) => {
        events.push(event);
      });

      // Execute social sequence
      await gameEngine.processPlayerAction(scenario.actor, 'give potion to Alice');
      await gameEngine.processPlayerAction(scenario.actor, 'trade sword for gold with merchant');

      const tradeEvent = events.find(e => 
        e.eventName === 'core:attempt_action' && e.actionId === 'interaction:trade'
      );

      expect(tradeEvent).toBeDefined();
      expect(tradeEvent.targets).toEqual({
        offering: 'sword',
        requesting: 'gold',
        trader: 'merchant'
      });
    });
  });
});
```

### 4. Create Performance Monitoring Dashboard

**File**: `tests/monitoring/performanceDashboard.js`

```javascript
/**
 * @file Performance monitoring dashboard for integration testing
 */

export class PerformanceDashboard {
  #metrics;
  #startTime;

  constructor() {
    this.#metrics = {
      payloadCreation: {
        total: 0,
        multiTarget: 0,
        legacy: 0,
        errors: 0,
        averageTime: 0,
        maxTime: 0
      },
      ruleExecution: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0
      },
      memory: {
        initial: 0,
        peak: 0,
        current: 0,
        leaked: 0
      },
      system: {
        uptime: 0,
        totalEvents: 0,
        errorRate: 0
      }
    };
    this.#startTime = performance.now();
  }

  /**
   * Records payload creation metrics
   * @param {Object} payload - Created payload
   * @param {number} duration - Creation duration
   * @param {boolean} isMultiTarget - Whether payload is multi-target
   * @param {boolean} hasError - Whether creation had errors
   */
  recordPayloadCreation(payload, duration, isMultiTarget, hasError = false) {
    this.#metrics.payloadCreation.total++;
    
    if (hasError) {
      this.#metrics.payloadCreation.errors++;
    } else if (isMultiTarget) {
      this.#metrics.payloadCreation.multiTarget++;
    } else {
      this.#metrics.payloadCreation.legacy++;
    }

    // Update timing metrics
    const totalTime = this.#metrics.payloadCreation.averageTime * (this.#metrics.payloadCreation.total - 1) + duration;
    this.#metrics.payloadCreation.averageTime = totalTime / this.#metrics.payloadCreation.total;
    this.#metrics.payloadCreation.maxTime = Math.max(this.#metrics.payloadCreation.maxTime, duration);
  }

  /**
   * Records rule execution metrics
   * @param {Object} ruleResult - Rule execution result
   * @param {number} duration - Execution duration
   */
  recordRuleExecution(ruleResult, duration) {
    this.#metrics.ruleExecution.total++;
    
    if (ruleResult.success) {
      this.#metrics.ruleExecution.successful++;
    } else {
      this.#metrics.ruleExecution.failed++;
    }

    const totalTime = this.#metrics.ruleExecution.averageTime * (this.#metrics.ruleExecution.total - 1) + duration;
    this.#metrics.ruleExecution.averageTime = totalTime / this.#metrics.ruleExecution.total;
  }

  /**
   * Updates memory metrics
   */
  updateMemoryMetrics() {
    if (performance.memory) {
      const current = performance.memory.usedJSHeapSize;
      
      if (this.#metrics.memory.initial === 0) {
        this.#metrics.memory.initial = current;
      }
      
      this.#metrics.memory.current = current;
      this.#metrics.memory.peak = Math.max(this.#metrics.memory.peak, current);
      this.#metrics.memory.leaked = current - this.#metrics.memory.initial;
    }
  }

  /**
   * Generates comprehensive performance report
   * @returns {Object} Performance report
   */
  generateReport() {
    this.updateMemoryMetrics();
    
    const uptime = performance.now() - this.#startTime;
    const errorRate = this.#metrics.payloadCreation.total > 0 
      ? (this.#metrics.payloadCreation.errors / this.#metrics.payloadCreation.total) * 100 
      : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: uptime.toFixed(2),
      payloadCreation: {
        ...this.#metrics.payloadCreation,
        multiTargetRate: this.#metrics.payloadCreation.total > 0 
          ? (this.#metrics.payloadCreation.multiTarget / this.#metrics.payloadCreation.total) * 100 
          : 0,
        errorRate: errorRate
      },
      ruleExecution: {
        ...this.#metrics.ruleExecution,
        successRate: this.#metrics.ruleExecution.total > 0 
          ? (this.#metrics.ruleExecution.successful / this.#metrics.ruleExecution.total) * 100 
          : 0
      },
      memory: {
        ...this.#metrics.memory,
        initialMB: (this.#metrics.memory.initial / 1024 / 1024).toFixed(2),
        peakMB: (this.#metrics.memory.peak / 1024 / 1024).toFixed(2),
        currentMB: (this.#metrics.memory.current / 1024 / 1024).toFixed(2),
        leakedMB: (this.#metrics.memory.leaked / 1024 / 1024).toFixed(2)
      },
      system: {
        uptime: uptime.toFixed(2),
        totalEvents: this.#metrics.payloadCreation.total + this.#metrics.ruleExecution.total,
        errorRate: errorRate.toFixed(2)
      }
    };
  }

  /**
   * Generates formatted dashboard display
   * @returns {string} Formatted dashboard
   */
  generateDashboard() {
    const report = this.generateReport();
    
    return `
╔════════════════════════════════════════════════════════════════╗
║                    PERFORMANCE DASHBOARD                       ║
╠════════════════════════════════════════════════════════════════╣
║ System Uptime: ${report.uptime}ms                                       ║
║ Total Events:  ${report.system.totalEvents}                                          ║
║ Error Rate:    ${report.system.errorRate}%                                        ║
╠════════════════════════════════════════════════════════════════╣
║                    PAYLOAD CREATION                            ║
║ Total:         ${report.payloadCreation.total}                                          ║
║ Multi-Target:  ${report.payloadCreation.multiTarget} (${report.payloadCreation.multiTargetRate.toFixed(1)}%)                     ║
║ Legacy:        ${report.payloadCreation.legacy}                                          ║
║ Errors:        ${report.payloadCreation.errors} (${report.payloadCreation.errorRate.toFixed(1)}%)                       ║
║ Avg Time:      ${report.payloadCreation.averageTime.toFixed(2)}ms                              ║
║ Max Time:      ${report.payloadCreation.maxTime.toFixed(2)}ms                              ║
╠════════════════════════════════════════════════════════════════╣
║                    RULE EXECUTION                              ║
║ Total:         ${report.ruleExecution.total}                                          ║
║ Successful:    ${report.ruleExecution.successful} (${report.ruleExecution.successRate.toFixed(1)}%)                     ║
║ Failed:        ${report.ruleExecution.failed}                                          ║
║ Avg Time:      ${report.ruleExecution.averageTime.toFixed(2)}ms                              ║
╠════════════════════════════════════════════════════════════════╣
║                    MEMORY USAGE                                ║
║ Initial:       ${report.memory.initialMB}MB                                 ║
║ Peak:          ${report.memory.peakMB}MB                                 ║
║ Current:       ${report.memory.currentMB}MB                                 ║
║ Leaked:        ${report.memory.leakedMB}MB                                 ║
╚════════════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Resets all metrics
   */
  reset() {
    this.#metrics = {
      payloadCreation: {
        total: 0,
        multiTarget: 0,
        legacy: 0,
        errors: 0,
        averageTime: 0,
        maxTime: 0
      },
      ruleExecution: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0
      },
      memory: {
        initial: 0,
        peak: 0,
        current: 0,
        leaked: 0
      },
      system: {
        uptime: 0,
        totalEvents: 0,
        errorRate: 0
      }
    };
    this.#startTime = performance.now();
  }
}

export default PerformanceDashboard;
```

## Testing Requirements

### 1. Comprehensive Coverage

- **End-to-end workflows**: Complete action processing pipeline
- **Performance validation**: All performance requirements met
- **Backward compatibility**: Legacy functionality preserved
- **Error handling**: Graceful handling of all error conditions
- **Memory management**: No memory leaks or excessive usage

### 2. Load Testing

- **High volume**: 1000+ actions processed efficiently
- **Concurrent processing**: Multiple actors processing simultaneously
- **Memory stress**: Large target objects handled correctly
- **Error resilience**: System stability under error conditions

### 3. Real-world Scenarios

- **Combat sequences**: Multi-target combat actions work correctly
- **Crafting workflows**: Complex crafting with multiple components
- **Social interactions**: Trading and interaction scenarios
- **Mixed scenarios**: Combination of all action types

## Success Criteria

1. **Complete Integration**: All components work together seamlessly
2. **Performance Requirements**: All performance targets consistently met
3. **Backward Compatibility**: 100% compatibility with existing functionality
4. **Error Resilience**: System handles all error conditions gracefully
5. **Production Readiness**: System ready for production deployment

## Files Created

- `tests/integration/multiTargetActionIntegration.test.js`
- `tests/integration/systemLoadTesting.test.js`
- `tests/integration/gameScenarios.test.js`
- `tests/monitoring/performanceDashboard.js`

## Files Modified

None (new integration tests only)

## Validation Steps

1. Run complete integration test suite
2. Validate performance under various load conditions
3. Test real-world game scenarios
4. Verify system stability under stress
5. Confirm production readiness

## Notes

- Integration tests validate complete system functionality
- Performance monitoring ensures operational requirements met
- Load testing validates system stability under stress
- Real-world scenarios confirm practical usability

## Risk Assessment

**Low Risk**: Comprehensive testing validates system functionality and performance. Tests are isolated and don't affect production code. Any issues identified can be addressed before deployment.

## Next Steps

After this ticket completion:
1. All Phase 3 tickets completed
2. Move to Phase 4: Documentation & Migration
3. Create comprehensive documentation and migration guides
4. Finalize system for production deployment