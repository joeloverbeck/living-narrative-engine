/**
 * @file Performance tests extracted from multi-target action integration tests
 * @description These tests focus on performance characteristics of the command processor
 * and multi-target action handling under realistic integration conditions.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import { TestBedClass } from '../common/entities/testBed.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';

describe('Multi-Target Action Integration Performance Tests', () => {
  let testBed;
  let commandProcessor;
  let mockWorld;
  let eventBus;

  beforeAll(async () => {
    testBed = new TestBedClass();
  });

  afterAll(() => {
    testBed.cleanup();
  });

  beforeEach(async () => {
    // Create basic mock services for CommandProcessor testing
    const logger = testBed.logger;
    
    // Create mock event bus with proper unsubscribe functionality
    eventBus = {
      subscribe: jest.fn().mockReturnValue(() => {}), // Return a mock unsubscribe function
      dispatch: jest.fn(),
      publish: jest.fn(),
    };
    
    // Create mock safe event dispatcher
    const safeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };
    
    // Create mock event dispatch service
    const eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };
    
    commandProcessor = new CommandProcessor({ 
      logger, 
      safeEventDispatcher,
      eventDispatchService
    });

    // Setup simple mock entities for testing
    mockWorld = {
      actors: {
        player: { id: 'player', name: 'Player' },
        npc1: { id: 'npc1', name: 'NPC 1' },
        npc2: { id: 'npc2', name: 'NPC 2' },
      },
      items: {
        knife: { id: 'knife', name: 'Knife' },
        potion: { id: 'potion', name: 'Potion' },
        scroll: { id: 'scroll', name: 'Scroll' },
        hammer: { id: 'hammer', name: 'Hammer' },
      },
      locations: {
        room1: { id: 'room1', name: 'Room 1' },
        room2: { id: 'room2', name: 'Room 2' },
        forge: { id: 'forge', name: 'Forge' },
      },
    };
  });

  afterEach(() => {
    testBed.cleanup();
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
              location: [`location_${i}`],
            },
          },
        });
      }

      const startTime = performance.now();
      const results = [];

      // Process all actions
      for (const action of actions) {
        const result = await commandProcessor.dispatchAction(
          actor,
          action
        );
        expect(result.success).toBe(true);
        results.push(result);
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / actions.length;

      // Validate performance requirements
      expect(averageTime).toBeLessThan(5); // Average < 5ms per action
      expect(totalTime).toBeLessThan(500); // Total < 500ms for 100 actions

      // Validate all results are correct
      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.originalInput).toBe(`test action ${index}`);
      });

      // Log performance metrics
      console.log(`High volume performance: ${averageTime.toFixed(2)}ms average per action`);
      console.log(`Total time for 100 actions: ${totalTime.toFixed(2)}ms`);
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
            targetId: `target_${i}`,
          },
        });

        // Enhanced action
        mixedActions.push({
          actionDefinitionId: 'combat:throw',
          commandString: `throw item_${i} at target_${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${i}`],
              target: [`target_${i}`],
            },
          },
        });
      }

      const startTime = performance.now();
      const results = {
        legacy: { count: 0, totalTime: 0 },
        enhanced: { count: 0, totalTime: 0 },
      };

      for (const action of mixedActions) {
        const actionStart = performance.now();
        const result = await commandProcessor.dispatchAction(
          actor,
          action
        );
        const actionTime = performance.now() - actionStart;

        // Determine if action was multi-target based on the action parameters
        if (action.resolvedParameters?.isMultiTarget) {
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
      const enhancedAverage =
        results.enhanced.totalTime / results.enhanced.count;

      expect(legacyAverage).toBeLessThan(5);
      expect(enhancedAverage).toBeLessThan(10);
      expect(totalTime).toBeLessThan(1000); // Total < 1s for 100 actions

      // Log performance comparison
      console.log(`Legacy actions average: ${legacyAverage.toFixed(2)}ms`);
      console.log(`Enhanced actions average: ${enhancedAverage.toFixed(2)}ms`);
      console.log(`Performance ratio (enhanced/legacy): ${(enhancedAverage / legacyAverage).toFixed(2)}`);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during extended operation', async () => {
      const actor = mockWorld.actors.player;
      const initialMemory = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;

      // Process many actions to test for memory leaks
      for (let batch = 0; batch < 10; batch++) {
        const actions = Array.from({ length: 50 }, (_, i) => ({
          actionDefinitionId: 'memory:test',
          commandString: `memory test ${batch}_${i}`,
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: [`item_${batch}_${i}`],
              target: [`target_${batch}_${i}`],
            },
          },
        }));

        for (const action of actions) {
          await commandProcessor.dispatchAction(actor, action);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 500 actions)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for 500 actions`);
      } else {
        console.log('Memory monitoring not available in this environment');
      }
    });

    it('should clean up resources properly', async () => {
      const actor = mockWorld.actors.player;
      const logger = testBed.logger;
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };
      
      const processor = new CommandProcessor({
        logger,
        safeEventDispatcher,
        eventDispatchService,
      });

      // Process actions
      const actions = Array.from({ length: 100 }, (_, i) => ({
        actionDefinitionId: 'cleanup:test',
        commandString: `cleanup test ${i}`,
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: { item: [`item_${i}`] },
        },
      }));

      for (const action of actions) {
        await processor.dispatchAction(actor, action);
      }

      // Get metrics before cleanup
      const metricsBeforeCleanup = processor.getPayloadCreationStatistics();
      expect(metricsBeforeCleanup.totalPayloadsCreated).toBe(100);

      // Reset metrics (simulates cleanup)
      processor.resetPayloadCreationStatistics();
      const metricsAfterCleanup = processor.getPayloadCreationStatistics();

      expect(metricsAfterCleanup.totalPayloadsCreated).toBe(0);
      expect(metricsAfterCleanup.averageCreationTime).toBe(0);

      console.log('Resource cleanup test completed successfully');
    });
  });
});