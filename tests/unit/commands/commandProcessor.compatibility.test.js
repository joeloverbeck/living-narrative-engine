/**
 * @file Backward compatibility tests for CommandProcessor
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CommandProcessor from '../../../src/commands/commandProcessor.js';

describe('CommandProcessor - Backward Compatibility', () => {
  let testBed;
  let commandProcessor;
  let mockActor;
  let eventDispatchService;

  beforeEach(() => {
    testBed = createTestBed();

    const logger = testBed.mockLogger;
    const safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    mockActor = {
      id: 'compatibility_actor',
      name: 'Compatibility Test Actor',
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Exact Legacy Format Preservation', () => {
    it('should preserve exact field structure for legacy actions', async () => {
      const legacyActions = [
        {
          actionDefinitionId: 'core:follow',
          commandString: 'follow Alice',
          resolvedParameters: { targetId: 'alice_123' },
        },
        {
          actionDefinitionId: 'core:attack',
          commandString: 'attack goblin',
          resolvedParameters: { targetId: 'goblin_456' },
        },
        {
          actionDefinitionId: 'core:examine',
          commandString: 'examine book',
          resolvedParameters: { targetId: 'book_789' },
        },
        {
          actionDefinitionId: 'core:emote',
          commandString: 'smile',
          resolvedParameters: { targetId: null },
        },
      ];

      for (const action of legacyActions) {
        const result = await commandProcessor.dispatchAction(mockActor, action);

        expect(result.success).toBe(true);

        const dispatchedPayload =
          eventDispatchService.dispatchWithErrorHandling.mock.calls[
            eventDispatchService.dispatchWithErrorHandling.mock.calls.length - 1
          ][1];

        // Verify legacy structure with new fields per ticket requirements
        expect(dispatchedPayload).toMatchObject({
          eventName: 'core:attempt_action',
          actorId: 'compatibility_actor',
          actionId: action.actionDefinitionId,
          targetId: action.resolvedParameters.targetId,
          originalInput: action.commandString,
          timestamp: expect.any(Number),
          // New fields added per ticket requirements
          primaryId: action.resolvedParameters.targetId,
          secondaryId: null,
          tertiaryId: null,
          resolvedTargetCount: action.resolvedParameters.targetId ? 1 : 0,
          hasContextDependencies: false,
        });

        // Verify all expected fields are present
        const expectedKeys = [
          'eventName',
          'actorId',
          'actionId',
          'targetId',
          'originalInput',
          'timestamp',
          // New fields per ticket
          'primaryId',
          'secondaryId',
          'tertiaryId',
          'resolvedTargetCount',
          'hasContextDependencies',
        ];
        expect(Object.keys(dispatchedPayload).sort()).toEqual(
          expectedKeys.sort()
        );

        // Verify no targets object for single-target actions
        expect(dispatchedPayload.targets).toBeUndefined();
      }
    });

    it('should handle all legacy targetId variations', async () => {
      const targetVariations = [
        { targetId: 'valid_target_123', expected: 'valid_target_123' },
        { targetId: null, expected: null },
        { targetId: undefined, expected: null },
        { targetId: '', expected: null },
        { targetId: '   ', expected: '   ' }, // Spaces are kept as-is
        {
          targetId: 'core:namespaced_target',
          expected: 'core:namespaced_target',
        },
      ];

      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      for (const variation of targetVariations) {
        const action = {
          actionDefinitionId: 'test:target_variation',
          commandString: 'test action',
          resolvedParameters: { targetId: variation.targetId },
        };

        const result = await processor.dispatchAction(mockActor, action);

        expect(result.success).toBe(true);
        const dispatchedPayload =
          eventDispatchService.dispatchWithErrorHandling.mock.calls[
            eventDispatchService.dispatchWithErrorHandling.mock.calls.length - 1
          ][1];

        expect(dispatchedPayload.targetId).toBe(variation.expected);
        expect(dispatchedPayload.targets).toBeUndefined();
      }
    });

    it('should maintain exact timestamp behavior', async () => {
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      const action = {
        actionDefinitionId: 'test:timestamp',
        commandString: 'timestamp test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const beforeTime = Date.now();
      const result = await processor.dispatchAction(mockActor, action);
      const afterTime = Date.now();

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(dispatchedPayload.timestamp).toBeLessThanOrEqual(afterTime);
      expect(typeof dispatchedPayload.timestamp).toBe('number');
    });
  });

  describe('Legacy Performance Characteristics', () => {
    it('should maintain or improve legacy action performance', async () => {
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      const legacyAction = {
        actionDefinitionId: 'performance:legacy',
        commandString: 'performance test',
        resolvedParameters: { targetId: 'target_123' },
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await processor.dispatchAction(mockActor, legacyAction);
      }

      // Measure performance
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await processor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should be very fast for legacy actions
      expect(averageTime).toBeLessThan(2); // Less than 2ms average
    });

    it('should have consistent memory usage for legacy actions', async () => {
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      const action = {
        actionDefinitionId: 'memory:test',
        commandString: 'memory test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Create many payloads
      for (let i = 0; i < 1000; i++) {
        await processor.dispatchAction(mockActor, action);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not significantly increase memory for legacy actions
      // Note: In some environments, memory usage may be higher due to test framework overhead
      // Provide a wider tolerance for environments with higher baseline usage (still guards against major regressions)
      expect(memoryIncrease).toBeLessThan(40 * 1024 * 1024);
    });
  });

  describe('Edge Case Compatibility', () => {
    it('should handle legacy actions with missing fields', async () => {
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      const edgeCases = [
        {
          name: 'missing commandString',
          action: {
            actionDefinitionId: 'test:missing_command',
            resolvedParameters: { targetId: 'target_123' },
          },
          expectedInput: 'test:missing_command',
        },
        {
          name: 'missing resolvedParameters',
          action: {
            actionDefinitionId: 'test:missing_params',
            commandString: 'test command',
          },
          expectedTargetId: null,
        },
        {
          name: 'empty resolvedParameters',
          action: {
            actionDefinitionId: 'test:empty_params',
            commandString: 'test command',
            resolvedParameters: {},
          },
          expectedTargetId: null,
        },
      ];

      for (const edgeCase of edgeCases) {
        const result = await processor.dispatchAction(
          mockActor,
          edgeCase.action
        );

        expect(result.success).toBe(true);
        const dispatchedPayload =
          eventDispatchService.dispatchWithErrorHandling.mock.calls[
            eventDispatchService.dispatchWithErrorHandling.mock.calls.length - 1
          ][1];

        expect(dispatchedPayload.eventName).toBe('core:attempt_action');
        expect(dispatchedPayload.actorId).toBe('compatibility_actor');
        expect(dispatchedPayload.actionId).toBe(
          edgeCase.action.actionDefinitionId
        );

        if (edgeCase.expectedInput) {
          expect(dispatchedPayload.originalInput).toBe(edgeCase.expectedInput);
        }

        if (edgeCase.hasOwnProperty('expectedTargetId')) {
          expect(dispatchedPayload.targetId).toBe(edgeCase.expectedTargetId);
        }

        expect(dispatchedPayload.targets).toBeUndefined();
      }
    });

    it('should handle legacy actions with malformed data gracefully', async () => {
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      const malformedCases = [
        {
          actionDefinitionId: 'test:malformed1',
          commandString: 'test',
          resolvedParameters: { targetId: 123 }, // Number instead of string
        },
        {
          actionDefinitionId: 'test:malformed2',
          commandString: 'test',
          resolvedParameters: { targetId: {} }, // Object instead of string
        },
        {
          actionDefinitionId: 'test:malformed3',
          commandString: 'test',
          resolvedParameters: { targetId: ['array'] }, // Array instead of string
        },
      ];

      for (const malformedCase of malformedCases) {
        const result = await processor.dispatchAction(mockActor, malformedCase);

        expect(result.success).toBe(true);
        const dispatchedPayload =
          eventDispatchService.dispatchWithErrorHandling.mock.calls[
            eventDispatchService.dispatchWithErrorHandling.mock.calls.length - 1
          ][1];

        expect(dispatchedPayload.eventName).toBe('core:attempt_action');
        // Non-string targetIds are kept as-is in the current implementation
        expect(dispatchedPayload.targetId).toBe(
          malformedCase.resolvedParameters.targetId
        );
        expect(dispatchedPayload.targets).toBeUndefined();
      }
    });
  });

  describe('Event Bus Integration Compatibility', () => {
    it('should dispatch legacy events in exact same format', async () => {
      const safeEventDispatcher = {
        dispatch: jest.fn().mockResolvedValue(true),
      };
      const eventDispatchService = {
        dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      };

      const processor = new CommandProcessor({
        logger: testBed.mockLogger,
        safeEventDispatcher,
        eventDispatchService,
      });

      const legacyAction = {
        actionDefinitionId: 'compatibility:dispatch',
        commandString: 'dispatch test',
        resolvedParameters: { targetId: 'target_123' },
      };

      await processor.dispatchAction(mockActor, legacyAction);

      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledTimes(1);
      const dispatchedEvent =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Verify legacy event format with new fields per ticket requirements
      expect(dispatchedEvent).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'compatibility_actor',
        actionId: 'compatibility:dispatch',
        targetId: 'target_123',
        originalInput: 'dispatch test',
        timestamp: expect.any(Number),
        // New fields per ticket requirements
        primaryId: 'target_123',
        secondaryId: null,
        tertiaryId: null,
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      });

      // Verify expected number of fields (original 6 + 5 new = 11)
      expect(Object.keys(dispatchedEvent)).toHaveLength(11);
    });
  });
});
