/**
 * @file Performance tests for CommandProcessor multi-target functionality
 * @description Performance benchmarks extracted from unit tests to ensure optimal performance
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor - Multi-Target Performance Tests', () => {
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let commandProcessor;
  let mockActor;

  beforeEach(() => {
    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    mockActor = {
      id: 'test_actor_123',
      name: 'Test Actor',
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Legacy Performance Benchmarks', () => {
    it('should maintain performance parity with legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'core:move',
        commandString: 'move north',
        resolvedParameters: {
          targetId: 'north_exit_123',
        },
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(50); // Should average less than 50ms
    });
  });

  describe('Scalability Performance Tests', () => {
    it('should handle extremely large target sets efficiently', async () => {
      // Create action with many targets
      const largeTargetIds = {};
      for (let i = 1; i <= 50; i++) {
        largeTargetIds[`target_${i}`] = [`entity_${i}`];
      }

      const turnAction = {
        actionDefinitionId: 'test:large',
        commandString: 'action with many targets',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: largeTargetIds,
        },
      };

      const startTime = performance.now();
      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];
      expect(Object.keys(dispatchedPayload.targets)).toHaveLength(50);
      expect(duration).toBeLessThan(200); // Should handle large sets efficiently
    });
  });

  describe('Performance Metrics and Benchmarks', () => {
    it('should track detailed performance metrics', async () => {
      const actions = [
        {
          actionDefinitionId: 'test:legacy1',
          commandString: 'legacy action 1',
          resolvedParameters: { targetId: 'target_1' },
        },
        {
          actionDefinitionId: 'test:multi1',
          commandString: 'multi action 1',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: { item: ['item_1'], target: ['target_1'] },
          },
        },
        {
          actionDefinitionId: 'test:legacy2',
          commandString: 'legacy action 2',
          resolvedParameters: { targetId: 'target_2' },
        },
        {
          actionDefinitionId: 'test:multi2',
          commandString: 'multi action 2',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              primary: ['primary_1'],
              secondary: ['secondary_1'],
              tool: ['tool_1'],
            },
          },
        },
      ];

      // Process multiple actions
      for (const action of actions) {
        await commandProcessor.dispatchAction(mockActor, action);
      }

      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(4);
      expect(stats.multiTargetPayloads).toBe(2);
      expect(stats.legacyPayloads).toBe(2);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should meet performance targets for various scenarios', async () => {
      const scenarios = [
        {
          name: 'simple legacy',
          action: {
            actionDefinitionId: 'simple:legacy',
            commandString: 'simple',
            resolvedParameters: { targetId: 'target_1' },
          },
          maxTime: 5,
        },
        {
          name: 'simple multi-target',
          action: {
            actionDefinitionId: 'simple:multi',
            commandString: 'simple multi',
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: { item: ['item_1'], target: ['target_1'] },
            },
          },
          maxTime: 10,
        },
        {
          name: 'complex multi-target',
          action: {
            actionDefinitionId: 'complex:multi',
            commandString: 'complex multi',
            resolvedParameters: {
              isMultiTarget: true,
              targetIds: {
                primary: ['p1'],
                secondary: ['s1'],
                tertiary: ['t1'],
                item1: ['i1'],
                item2: ['i2'],
                tool: ['tool1'],
                location: ['loc1'],
              },
            },
          },
          maxTime: 15,
        },
      ];

      for (const scenario of scenarios) {
        const startTime = performance.now();

        const result = await commandProcessor.dispatchAction(
          mockActor,
          scenario.action
        );

        const duration = performance.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(scenario.maxTime);
      }
    });

    it('should handle burst loads without performance degradation', async () => {
      const burstSize = 50;
      const actions = Array.from({ length: burstSize }, (_, i) => ({
        actionDefinitionId: `burst:action_${i}`,
        commandString: `burst action ${i}`,
        resolvedParameters:
          i % 2 === 0
            ? { targetId: `target_${i}` }
            : {
                isMultiTarget: true,
                targetIds: {
                  item: [`item_${i}`],
                  target: [`target_${i}`],
                },
              },
      }));

      const startTime = performance.now();
      const results = [];

      for (const action of actions) {
        const actionStart = performance.now();
        const result = await commandProcessor.dispatchAction(mockActor, action);
        const actionTime = performance.now() - actionStart;

        results.push({ result, duration: actionTime });
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / burstSize;
      const maxTime = Math.max(...results.map((r) => r.duration));

      expect(averageTime).toBeLessThan(100); // Average should be reasonable
      expect(maxTime).toBeLessThan(250); // Even slowest should be reasonable
      expect(results.every((r) => r.result.success)).toBe(true); // All should succeed
    });
  });
});
