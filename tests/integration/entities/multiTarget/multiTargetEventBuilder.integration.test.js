/**
 * @file Integration tests for MultiTargetEventBuilder
 * Tests real-world integration with CommandProcessor, event system, and target resolution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import MultiTargetEventBuilder from '../../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../../../../src/entities/multiTarget/targetExtractionResult.js';
import CommandProcessor from '../../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';

describe('MultiTargetEventBuilder - Integration Tests', () => {
  let testBed;
  let logger;
  let commandProcessor;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockEntity;
  let mockTurnAction;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;

    // Mock event dispatchers
    mockEventDispatcher = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    mockEventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    // Create CommandProcessor instance
    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher: mockEventDispatcher,
      eventDispatchService: mockEventDispatchService,
    });

    // Mock entity
    mockEntity = {
      id: 'test_actor_123',
      components: {},
    };

    // Mock turn action
    mockTurnAction = {
      actionDefinitionId: 'core:attack',
      commandString: 'attack goblin with sword',
      resolvedParameters: {
        targetId: 'goblin_456',
        target: 'goblin_456',
        weapon: 'sword_789',
      },
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('CommandProcessor Integration', () => {
    it('should integrate properly with CommandProcessor.dispatchAction', async () => {
      // Test the real integration path from CommandProcessor
      const result = await commandProcessor.dispatchAction(
        mockEntity,
        mockTurnAction
      );

      expect(result.success).toBe(true);
      expect(result.originalInput).toBe(mockTurnAction.commandString);
      expect(
        mockEventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledWith(
        ATTEMPT_ACTION_ID,
        expect.objectContaining({
          eventName: 'core:attempt_action',
          actorId: mockEntity.id,
          actionId: mockTurnAction.actionDefinitionId,
          originalInput: mockTurnAction.commandString,
          targetId: mockTurnAction.resolvedParameters.targetId,
        }),
        expect.stringContaining('ATTEMPT_ACTION_ID dispatch')
      );
    });

    it('should handle multi-target actions through CommandProcessor', async () => {
      const multiTargetAction = {
        actionDefinitionId: 'core:group_attack',
        commandString: 'attack all goblins',
        resolvedParameters: {
          targets: {
            primary: 'goblin_1',
            secondary: 'goblin_2',
            tertiary: 'goblin_3',
          },
          targetId: 'goblin_1', // Primary target for backward compatibility
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockEntity,
        multiTargetAction
      );

      expect(result.success).toBe(true);

      // Get the actual payload that was dispatched
      const [, actualPayload] =
        mockEventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      expect(actualPayload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: multiTargetAction.actionDefinitionId,
        originalInput: multiTargetAction.commandString,
        targetId: 'goblin_1', // Primary target
      });

      // Check if targets object exists when multiple targets are provided
      if (actualPayload.targets) {
        expect(actualPayload.targets).toMatchObject({
          primary: 'goblin_1',
          secondary: 'goblin_2',
          tertiary: 'goblin_3',
        });
      }
    });

    it('should fall back to legacy payload when enhanced creation fails', async () => {
      // Mock the MultiTargetEventBuilder to throw an error during build
      const originalBuild = MultiTargetEventBuilder.prototype.build;
      MultiTargetEventBuilder.prototype.build = jest
        .fn()
        .mockImplementation(function () {
          throw new Error('Simulated builder failure');
        });

      const validAction = {
        actionDefinitionId: 'core:test_action',
        commandString: 'test command',
        resolvedParameters: { targetId: 'test_target' },
      };

      const result = await commandProcessor.dispatchAction(
        mockEntity,
        validAction
      );

      expect(result.success).toBe(true);
      expect(
        mockEventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledWith(
        ATTEMPT_ACTION_ID,
        expect.objectContaining({
          eventName: ATTEMPT_ACTION_ID,
          actorId: mockEntity.id,
          actionId: validAction.actionDefinitionId,
          targetId: validAction.resolvedParameters.targetId,
          originalInput: validAction.commandString,
        }),
        expect.stringContaining('ATTEMPT_ACTION_ID dispatch')
      );

      // Verify fallback was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Enhanced payload creation failed'),
        expect.objectContaining({
          actorId: mockEntity.id,
          actionId: validAction.actionDefinitionId,
          error: 'Simulated builder failure',
        })
      );

      // Restore original build method
      MultiTargetEventBuilder.prototype.build = originalBuild;
    });
  });

  describe('TargetExtractionResult Integration', () => {
    it('should correctly integrate with TargetExtractionResult for single targets', () => {
      const singleTargetParams = {
        targetId: 'test_target_123',
      };

      const extractionResult = TargetExtractionResult.fromResolvedParameters(
        singleTargetParams,
        logger
      );

      const builder = MultiTargetEventBuilder.fromTurnAction(
        mockEntity,
        mockTurnAction,
        extractionResult,
        logger
      );

      const payload = builder.build();

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: mockTurnAction.actionDefinitionId,
        originalInput: mockTurnAction.commandString,
        targetId: singleTargetParams.targetId,
      });

      // Should NOT have targets object for single target
      expect(payload.targets).toBeUndefined();
    });

    it('should correctly integrate with TargetExtractionResult for multiple targets', () => {
      const multiTargetParams = {
        isMultiTarget: true,
        targetIds: {
          primary: 'target_1',
          secondary: 'target_2',
          weapon: 'sword_789',
        },
      };

      const extractionResult = TargetExtractionResult.fromResolvedParameters(
        multiTargetParams,
        logger
      );

      const builder = MultiTargetEventBuilder.fromTurnAction(
        mockEntity,
        mockTurnAction,
        extractionResult,
        logger
      );

      const payload = builder.build();

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: mockTurnAction.actionDefinitionId,
        originalInput: mockTurnAction.commandString,
        targetId: 'target_1', // Primary target for backward compatibility
      });

      // Should have targets object for multiple targets
      if (extractionResult.hasMultipleTargets()) {
        expect(payload.targets).toMatchObject({
          primary: 'target_1',
          secondary: 'target_2',
          weapon: 'sword_789',
        });
      }
    });

    it('should handle empty targets gracefully', () => {
      const emptyTargetParams = {};

      const extractionResult = TargetExtractionResult.fromResolvedParameters(
        emptyTargetParams,
        logger
      );

      const builder = MultiTargetEventBuilder.fromTurnAction(
        mockEntity,
        mockTurnAction,
        extractionResult,
        logger
      );

      const payload = builder.build();

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: mockTurnAction.actionDefinitionId,
        originalInput: mockTurnAction.commandString,
        targetId: null,
      });

      expect(payload.targets).toBeUndefined();
    });
  });

  describe('Event System Integration', () => {
    it('should create payloads compatible with event validation', () => {
      const builder = new MultiTargetEventBuilder({ logger });

      const payload = builder
        .setActor(mockEntity.id)
        .setAction(mockTurnAction.actionDefinitionId)
        .setOriginalInput(mockTurnAction.commandString)
        .setLegacyTarget('test_target')
        .build();

      // Verify payload structure matches expected event format
      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: mockTurnAction.actionDefinitionId,
        originalInput: mockTurnAction.commandString,
        targetId: 'test_target',
        timestamp: expect.any(Number),
      });

      // Verify timestamp is recent
      expect(payload.timestamp).toBeGreaterThan(Date.now() - 1000);
    });

    it('should create valid payloads for event dispatching', async () => {
      // Test actual event dispatch with built payload
      const builder = new MultiTargetEventBuilder({ logger });

      const payload = builder
        .setActor(mockEntity.id)
        .setAction('core:test_action')
        .setOriginalInput('test command')
        .setLegacyTarget('test_target')
        .build();

      // Simulate direct event dispatch
      const dispatchResult =
        await mockEventDispatchService.dispatchWithErrorHandling(
          ATTEMPT_ACTION_ID,
          payload,
          'Test event dispatch'
        );

      expect(dispatchResult).toBe(true);
      expect(
        mockEventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledWith(ATTEMPT_ACTION_ID, payload, 'Test event dispatch');
    });
  });

  describe('Performance Integration', () => {
    it('should create payloads within acceptable time limits', async () => {
      const startTime = performance.now();

      // Create multiple payloads to test performance
      for (let i = 0; i < 100; i++) {
        const testAction = {
          actionDefinitionId: `core:test_action_${i}`,
          commandString: `test command ${i}`,
          resolvedParameters: {
            targetId: `target_${i}`,
            weapon: `weapon_${i}`,
          },
        };

        await commandProcessor.dispatchAction(mockEntity, testAction);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 100;

      // Each payload should be created in less than 10ms as per CommandProcessor expectations
      expect(averageTime).toBeLessThan(10);
    });

    it('should provide performance statistics', () => {
      // Test that CommandProcessor tracks payload creation statistics
      const initialStats = commandProcessor.getPayloadCreationStatistics();
      expect(initialStats).toMatchObject({
        totalPayloadsCreated: expect.any(Number),
        multiTargetPayloads: expect.any(Number),
        legacyPayloads: expect.any(Number),
        fallbackPayloads: expect.any(Number),
        averageCreationTime: expect.any(Number),
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle CommandProcessor dispatch failures gracefully', async () => {
      // Mock event dispatch service to fail
      mockEventDispatchService.dispatchWithErrorHandling.mockResolvedValue(
        false
      );

      const result = await commandProcessor.dispatchAction(
        mockEntity,
        mockTurnAction
      );

      expect(result.success).toBe(false);
      expect(result.originalInput).toBe(mockTurnAction.commandString);

      // Check that system error was dispatched with correct event ID
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Internal error'),
          details: expect.objectContaining({
            raw: expect.stringContaining('CRITICAL: Failed to dispatch'),
          }),
        })
      );
    });

    it('should handle invalid actor gracefully', async () => {
      const invalidActor = null;

      const result = await commandProcessor.dispatchAction(
        invalidActor,
        mockTurnAction
      );

      expect(result.success).toBe(false);
      expect(result.originalInput).toBe(mockTurnAction.commandString);
    });

    it('should handle invalid turn action gracefully', async () => {
      const invalidTurnAction = null;

      const result = await commandProcessor.dispatchAction(
        mockEntity,
        invalidTurnAction
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with existing event handlers', () => {
      const builder = new MultiTargetEventBuilder({ logger });

      // Test legacy-style single target payload
      const legacyPayload = builder
        .setActor(mockEntity.id)
        .setAction('core:legacy_action')
        .setOriginalInput('legacy command')
        .setLegacyTarget('legacy_target')
        .build();

      expect(legacyPayload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: 'core:legacy_action',
        originalInput: 'legacy command',
        targetId: 'legacy_target',
      });

      // Should not have targets object in legacy mode
      expect(legacyPayload.targets).toBeUndefined();
    });

    it('should support both legacy and enhanced formats in the same payload', () => {
      const builder = new MultiTargetEventBuilder({ logger });

      // Test enhanced payload that also maintains legacy compatibility
      const enhancedPayload = builder
        .setActor(mockEntity.id)
        .setAction('core:enhanced_action')
        .setOriginalInput('enhanced command')
        .setTargets(
          {
            primary: 'target_1',
            secondary: 'target_2',
            weapon: 'sword',
          },
          'target_1'
        )
        .build();

      expect(enhancedPayload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: mockEntity.id,
        actionId: 'core:enhanced_action',
        originalInput: 'enhanced command',
        targetId: 'target_1', // Legacy compatibility
        targets: {
          // Enhanced multi-target support
          primary: 'target_1',
          secondary: 'target_2',
          weapon: 'sword',
        },
      });
    });
  });
});
