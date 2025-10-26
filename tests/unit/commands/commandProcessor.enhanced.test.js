/**
 * @file Tests for enhanced CommandProcessor with multi-target support
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor - Enhanced Multi-Target Support', () => {
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
      id: 'actor_123',
      name: 'Test Actor',
    };

    jest.clearAllMocks();
  });

  describe('Enhanced Payload Creation', () => {
    it('should create multi-target payload from formatting data', async () => {
      const turnAction = {
        actionDefinitionId: 'combat:throw',
        commandString: 'throw knife at goblin',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['knife_123'],
            target: ['goblin_456'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      const calledPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledTimes(1);
      expect(calledPayload.eventName).toBe('core:attempt_action');
      expect(calledPayload.actorId).toBe('actor_123');
      expect(calledPayload.actionId).toBe('combat:throw');
      expect(calledPayload.originalInput).toBe('throw knife at goblin');

      // Should not have traditional primary/secondary/tertiary targets
      expect(calledPayload.primaryId).toBeNull();
      expect(calledPayload.secondaryId).toBeNull();

      // Should have custom target placeholders
      expect(calledPayload.targets).toBeDefined();
      expect(calledPayload.targets.item).toBeDefined();
      expect(calledPayload.targets.item.entityId).toBe('knife_123');
      expect(calledPayload.targets.target).toBeDefined();
      expect(calledPayload.targets.target.entityId).toBe('goblin_456');

      // Primary target should be 'target' not 'item' based on context
      expect(calledPayload.targetId).toBe('goblin_456');
    });

    it('should create legacy payload for single-target actions', async () => {
      const turnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow Alice',
        resolvedParameters: {
          targetId: 'alice_789',
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Verify exact legacy format
      expect(dispatchedPayload.eventName).toBe('core:attempt_action');
      expect(dispatchedPayload.actorId).toBe('actor_123');
      expect(dispatchedPayload.actionId).toBe('core:follow');
      expect(dispatchedPayload.targetId).toBe('alice_789');
      expect(dispatchedPayload.originalInput).toBe('follow Alice');
      expect(dispatchedPayload.timestamp).toBeGreaterThan(0);

      // Ensure no targets object for single target
      expect(dispatchedPayload.targets).toBeUndefined();
    });

    it('should handle actions without targets', async () => {
      const turnAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {},
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:emote',
        targetId: null,
        originalInput: 'smile',
      });

      expect(dispatchedPayload.targets).toBeUndefined();
    });

    it('should handle complex multi-target scenarios', async () => {
      const turnAction = {
        actionDefinitionId: 'complex:multi_action',
        commandString: 'complex action with many targets',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['entity_1'],
            secondary: ['entity_2'],
            item: ['item_3'],
            tool: ['tool_4'],
            location: ['location_5'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targets).toBeDefined();
      expect(Object.keys(dispatchedPayload.targets)).toHaveLength(5);

      // Verify each target has the correct structure
      expect(dispatchedPayload.targets.primary.entityId).toBe('entity_1');
      expect(dispatchedPayload.targets.secondary.entityId).toBe('entity_2');
      expect(dispatchedPayload.targets.item.entityId).toBe('item_3');
      expect(dispatchedPayload.targets.tool.entityId).toBe('tool_4');
      expect(dispatchedPayload.targets.location.entityId).toBe('location_5');

      expect(dispatchedPayload.targetId).toBe('entity_1'); // Primary target
      expect(Object.keys(dispatchedPayload.targets)).toHaveLength(5);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should create fallback payload when extraction fails', async () => {
      // Force an error by mocking the MultiTargetEventBuilder to throw
      const originalBuild = jest.requireActual(
        '../../../src/entities/multiTarget/multiTargetEventBuilder.js'
      ).MultiTargetEventBuilder.prototype.build;

      // We'll create a scenario where the builder throws an error
      const turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            invalid: [{}], // Invalid target structure to cause builder error
          },
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      // Should still succeed with fallback payload
      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'test:action',
        originalInput: 'test action',
        targetId: null,
      });

      // Since we're using the fallback, it should have timestamp
      expect(dispatchedPayload.timestamp).toBeGreaterThan(0);
    });

    it('should handle invalid actor gracefully', async () => {
      const turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test action',
        resolvedParameters: {},
      };

      const result = await commandProcessor.dispatchAction(null, turnAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );
      expect(safeDispatchError).toHaveBeenCalled();
    });

    it('should handle invalid turn action gracefully', async () => {
      const result = await commandProcessor.dispatchAction(mockActor, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );
      expect(safeDispatchError).toHaveBeenCalled();
    });

    it('should handle missing action definition ID', async () => {
      const turnAction = {
        commandString: 'test action',
        resolvedParameters: {},
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );
      expect(safeDispatchError).toHaveBeenCalled();
    });

    it('should fall back when actor ID becomes unavailable during payload validation', async () => {
      const flakyActor = {};
      let actorIdCalls = 0;
      Object.defineProperty(flakyActor, 'id', {
        enumerable: true,
        configurable: true,
        get() {
          actorIdCalls += 1;
          if (actorIdCalls === 3) {
            return undefined;
          }
          return 'actor_123';
        },
      });

      const turnAction = {
        actionDefinitionId: 'test:flaky-actor',
        commandString: 'perform flaky actor action',
        resolvedParameters: { targetId: 'target_42' },
      };

      const result = await commandProcessor.dispatchAction(
        flakyActor,
        turnAction
      );

      expect(result.success).toBe(true);

      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledWith(
        ATTEMPT_ACTION_ID,
        expect.any(Object),
        expect.any(String)
      );

      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledTimes(1);

      const fallbackPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(fallbackPayload).toMatchObject({
        actorId: 'actor_123',
        actionId: 'test:flaky-actor',
        targetId: 'target_42',
      });
      expect(fallbackPayload.targets).toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Enhanced payload creation failed, using fallback',
        expect.objectContaining({
          actorId: 'actor_123',
          actionId: 'test:flaky-actor',
        })
      );
    });

    it('should fall back when action definition disappears during payload validation', async () => {
      const flakyTurnAction = {
        commandString: 'perform flaky action',
        resolvedParameters: { targetId: 'target_007' },
      };

      let actionIdCalls = 0;
      Object.defineProperty(flakyTurnAction, 'actionDefinitionId', {
        enumerable: true,
        configurable: true,
        get() {
          actionIdCalls += 1;
          if (actionIdCalls === 3) {
            return undefined;
          }
          return 'test:flaky-action';
        },
      });

      const result = await commandProcessor.dispatchAction(
        mockActor,
        flakyTurnAction
      );

      expect(result.success).toBe(true);

      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledWith(
        ATTEMPT_ACTION_ID,
        expect.any(Object),
        expect.any(String)
      );

      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledTimes(1);

      const payload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(payload).toMatchObject({
        actorId: 'actor_123',
        actionId: 'test:flaky-action',
        targetId: 'target_007',
      });
      expect(payload.targets).toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Enhanced payload creation failed, using fallback',
        expect.objectContaining({
          actionId: 'test:flaky-action',
        })
      );
    });
  });

  describe('Performance and Metrics', () => {
    it('should track payload creation metrics', async () => {
      // Reset stats before test
      commandProcessor.resetPayloadCreationStatistics();

      const turnActions = [
        {
          actionDefinitionId: 'test:legacy',
          commandString: 'legacy action',
          resolvedParameters: { targetId: 'target_1' },
        },
        {
          actionDefinitionId: 'test:multi',
          commandString: 'multi action',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: { primary: ['entity_1'], secondary: ['entity_2'] },
          },
        },
        {
          actionDefinitionId: 'test:legacy2',
          commandString: 'legacy action 2',
          resolvedParameters: { targetId: 'target_2' },
        },
      ];

      // Create multiple payloads
      for (const turnAction of turnActions) {
        await commandProcessor.dispatchAction(mockActor, turnAction);
      }

      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(3);
      expect(stats.multiTargetPayloads).toBe(1);
      expect(stats.legacyPayloads).toBe(2);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    it('should complete payload creation within performance targets', async () => {
      const turnAction = {
        actionDefinitionId: 'performance:test',
        commandString: 'performance test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['item_1'],
            target: ['target_1'],
            secondary: ['secondary_1'],
          },
        },
      };

      const startTime = performance.now();
      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Should complete reasonably quickly
    });

    it('should reset metrics correctly', () => {
      // Reset metrics
      commandProcessor.resetPayloadCreationStatistics();
      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(0);
      expect(stats.multiTargetPayloads).toBe(0);
      expect(stats.legacyPayloads).toBe(0);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBe(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain exact compatibility with legacy payload format', async () => {
      const legacyTurnAction = {
        actionDefinitionId: 'core:follow',
        commandString: 'follow Alice',
        resolvedParameters: {
          targetId: 'alice_789',
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        legacyTurnAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      // Verify legacy format with flattened fields
      expect(dispatchedPayload.eventName).toBe('core:attempt_action');
      expect(dispatchedPayload.actorId).toBe('actor_123');
      expect(dispatchedPayload.actionId).toBe('core:follow');
      expect(dispatchedPayload.targetId).toBe('alice_789');
      expect(dispatchedPayload.originalInput).toBe('follow Alice');
      expect(dispatchedPayload.timestamp).toBeGreaterThan(0);

      // Legacy single target should also have flattened fields for consistency
      expect(dispatchedPayload.primaryId).toBe('alice_789');
      expect(dispatchedPayload.secondaryId).toBeNull();
      expect(dispatchedPayload.tertiaryId).toBeNull();

      // Should have metadata
      expect(dispatchedPayload.resolvedTargetCount).toBe(1);
      expect(dispatchedPayload.hasContextDependencies).toBe(false);

      // Should NOT have targets object for single target
      expect(dispatchedPayload.targets).toBeUndefined();
    });

    it('should handle null targetId in legacy format', async () => {
      const emoteAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {
          targetId: null,
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        emoteAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targetId).toBe(null);
      expect(dispatchedPayload.targets).toBeUndefined();

      // Should still have flattened fields for consistency
      expect(dispatchedPayload.primaryId).toBe(null);
      expect(dispatchedPayload.secondaryId).toBe(null);
      expect(dispatchedPayload.tertiaryId).toBe(null);
    });

    it('should handle legacy actions with missing targetId field', async () => {
      const action = {
        actionDefinitionId: 'core:wait',
        commandString: 'wait',
        resolvedParameters: {
          // No targetId field at all
        },
      };

      const result = await commandProcessor.dispatchAction(mockActor, action);

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targetId).toBe(null);
      expect(dispatchedPayload.targets).toBeUndefined();

      // Should still have flattened fields for consistency
      expect(dispatchedPayload.primaryId).toBe(null);
      expect(dispatchedPayload.secondaryId).toBe(null);
      expect(dispatchedPayload.tertiaryId).toBe(null);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log multi-target payload creation with info level', async () => {
      const turnAction = {
        actionDefinitionId: 'test:multi',
        commandString: 'multi action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['entity_1'],
            secondary: ['entity_2'],
          },
        },
      };

      await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(logger.info).toHaveBeenCalledWith(
        'Enhanced multi-target payload created',
        expect.objectContaining({
          hasMultipleTargets: true,
          targetCount: 2,
        })
      );
    });

    it('should log legacy payload creation with debug level', async () => {
      const turnAction = {
        actionDefinitionId: 'test:legacy',
        commandString: 'legacy action',
        resolvedParameters: {
          targetId: 'target_1',
        },
      };

      await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(logger.debug).toHaveBeenCalledWith(
        'Legacy-compatible payload created',
        expect.objectContaining({
          hasMultipleTargets: false,
          targetCount: 1,
        })
      );
    });

    it('should warn when payload creation takes too long', async () => {
      // Mock performance.now to simulate slow creation
      const originalNow = performance.now;
      let callCount = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        // First call returns 0, second call returns 15 (15ms duration)
        return callCount === 1 ? 0 : 15;
      });

      const turnAction = {
        actionDefinitionId: 'test:slow',
        commandString: 'slow action',
        resolvedParameters: { targetId: 'target_1' },
      };

      await commandProcessor.dispatchAction(mockActor, turnAction);

      expect(logger.warn).toHaveBeenCalledWith(
        'Payload creation took longer than expected',
        expect.objectContaining({
          duration: '15.00',
          target: '< 10ms',
        })
      );

      performance.now.mockRestore();
    });
  });
});
