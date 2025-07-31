/**
 * @file Integration test for multi-target action event payload flow
 * Tests the complete pipeline from action discovery through event dispatch
 * Verifies that enhanced event payloads include resolved target information
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Multi-Target Action Event Payload Flow Integration', () => {
  let commandProcessor;
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;
  let dispatchedEvents;

  beforeEach(() => {
    logger = new ConsoleLogger('DEBUG');
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Track all dispatched events
    dispatchedEvents = [];

    // Mock safe event dispatcher
    safeEventDispatcher = {
      dispatch: jest.fn().mockImplementation((event) => {
        dispatchedEvents.push(event);
        return Promise.resolve(true);
      }),
    };

    // Mock event dispatch service
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockImplementation((eventId, payload) => {
        dispatchedEvents.push({ eventId, payload });
        return Promise.resolve(true);
      }),
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });
  });

  describe('adjust_clothing action flow', () => {
    it('should dispatch event with enhanced payload for multi-target adjust_clothing action', async () => {
      // Setup actor and turn action from action discovery pipeline
      const actor = {
        id: 'amaia_castillo_instance',
        name: 'Amaia Castillo',
      };

      // This represents the output from ActionFormattingStage with resolved targets
      const turnAction = {
        actionDefinitionId: 'intimacy:adjust_clothing',
        commandString: "adjust Iker Aguirre's denim trucker jacket",
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['p_erotica:iker_aguirre_instance'],
            secondary: ['fd6a1e00-36b7-47cc-bdb2-4b65473614eb'],
          },
        },
      };

      // Dispatch the action
      const result = await commandProcessor.dispatchAction(actor, turnAction);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.turnEnded).toBe(false);
      expect(result.originalInput).toBe("adjust Iker Aguirre's denim trucker jacket");
      expect(result.actionResult).toEqual({ actionId: 'intimacy:adjust_clothing' });

      // Verify event was dispatched
      expect(eventDispatchService.dispatchWithErrorHandling).toHaveBeenCalledTimes(1);

      // Get the dispatched event payload
      const [eventId, payload] = eventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      expect(eventId).toBe(ATTEMPT_ACTION_ID);

      // Verify enhanced payload structure
      expect(payload).toMatchObject({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'amaia_castillo_instance',
        actionId: 'intimacy:adjust_clothing',
        originalInput: "adjust Iker Aguirre's denim trucker jacket",
        
        // Legacy fields for backward compatibility
        targetId: 'p_erotica:iker_aguirre_instance', // Primary target
        primaryId: 'p_erotica:iker_aguirre_instance',
        secondaryId: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
        tertiaryId: null,
        
        // Comprehensive targets object
        targets: {
          primary: {
            entityId: 'p_erotica:iker_aguirre_instance',
            placeholder: 'primary',
            description: 'p_erotica:iker_aguirre_instance',
            resolvedFromContext: false,
          },
          secondary: {
            entityId: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
            placeholder: 'secondary',
            description: 'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
            resolvedFromContext: true,
            contextSource: 'primary',
          },
        },
        
        // Metadata
        resolvedTargetCount: 2,
        hasContextDependencies: true,
      });

      // Verify timestamp exists
      expect(payload.timestamp).toBeDefined();
      expect(typeof payload.timestamp).toBe('number');
      expect(payload.timestamp).toBeGreaterThan(0);
    });

    it('should handle single-target legacy actions with enhanced payload', async () => {
      const actor = {
        id: 'test_actor',
        name: 'Test Actor',
      };

      const turnAction = {
        actionDefinitionId: 'core:examine',
        commandString: 'examine sword',
        resolvedParameters: {
          targetId: 'item_sword_123',
        },
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);

      const [eventId, payload] = eventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      expect(payload).toMatchObject({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'test_actor',
        actionId: 'core:examine',
        originalInput: 'examine sword',
        
        // Legacy fields
        targetId: 'item_sword_123',
        primaryId: 'item_sword_123',
        secondaryId: null,
        tertiaryId: null,
        
        // No targets object for single-target actions
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      });

      // Should NOT have targets object for single-target actions
      expect(payload.targets).toBeUndefined();
    });

    it('should handle three-target actions correctly', async () => {
      const actor = {
        id: 'wizard_instance',
        name: 'Wizard',
      };

      const turnAction = {
        actionDefinitionId: 'magic:complex_ritual',
        commandString: 'perform complex ritual',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['artifact_123'],
            secondary: ['reagent_456'],
            tertiary: ['location_789'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);

      const [eventId, payload] = eventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      expect(payload).toMatchObject({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'wizard_instance',
        actionId: 'magic:complex_ritual',
        
        // All three legacy fields populated
        primaryId: 'artifact_123',
        secondaryId: 'reagent_456',
        tertiaryId: 'location_789',
        
        // Comprehensive targets object with all three
        targets: {
          primary: {
            entityId: 'artifact_123',
            placeholder: 'primary',
          },
          secondary: {
            entityId: 'reagent_456',
            placeholder: 'secondary',
          },
          tertiary: {
            entityId: 'location_789',
            placeholder: 'tertiary',
          },
        },
        
        resolvedTargetCount: 3,
      });
    });

    it('should handle no-target actions', async () => {
      const actor = {
        id: 'player_123',
        name: 'Player',
      };

      const turnAction = {
        actionDefinitionId: 'core:wait',
        commandString: 'wait',
        resolvedParameters: {},
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);

      const [eventId, payload] = eventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      expect(payload).toMatchObject({
        eventName: ATTEMPT_ACTION_ID,
        actorId: 'player_123',
        actionId: 'core:wait',
        originalInput: 'wait',
        
        // All target fields should be null
        targetId: null,
        primaryId: null,
        secondaryId: null,
        tertiaryId: null,
        
        // No targets object
        resolvedTargetCount: 0,
        hasContextDependencies: false,
      });

      expect(payload.targets).toBeUndefined();
    });

    it('should preserve backward compatibility for rules expecting targetId', async () => {
      const actor = {
        id: 'actor_123',
        name: 'Actor',
      };

      // Multi-target action but rules might still expect targetId
      const turnAction = {
        actionDefinitionId: 'social:give_item',
        commandString: 'give sword to guard',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['item_sword'],
            secondary: ['npc_guard'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);

      const [eventId, payload] = eventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      // Verify targetId is set to primary target for backward compatibility
      expect(payload.targetId).toBe('item_sword');
      expect(payload.primaryId).toBe('item_sword');
      expect(payload.secondaryId).toBe('npc_guard');

      // But also has the full targets object
      expect(payload.targets).toBeDefined();
      expect(payload.targets.primary.entityId).toBe('item_sword');
      expect(payload.targets.secondary.entityId).toBe('npc_guard');
    });

    it('should handle malformed multi-target data gracefully', async () => {
      const actor = {
        id: 'actor_123',
        name: 'Actor',
      };

      const turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test command',
        resolvedParameters: {
          targetId: 'fallback_target',
          isMultiTarget: true,
          targetIds: 'not-an-object', // Invalid data
        },
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      // Should still succeed with fallback payload
      expect(result.success).toBe(true);

      const [eventId, payload] = eventDispatchService.dispatchWithErrorHandling.mock.calls[0];

      // Should have valid payload with fallback data
      expect(payload.actorId).toBe('actor_123');
      expect(payload.actionId).toBe('test:action');
      expect(payload.targetId).toBe('fallback_target');
      
      // Should have metadata fields even if extraction failed
      expect(payload.resolvedTargetCount).toBeDefined();
      expect(payload.hasContextDependencies).toBeDefined();
    });

    it('should track performance metrics', async () => {
      // Reset statistics
      commandProcessor.resetPayloadCreationStatistics();

      const actor = { id: 'actor_123' };

      // Create multiple payloads to test metrics
      const actions = [
        {
          actionDefinitionId: 'action1',
          resolvedParameters: { targetId: 'target1' },
          commandString: 'cmd1',
        },
        {
          actionDefinitionId: 'action2',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: { primary: ['t1'], secondary: ['t2'] },
          },
          commandString: 'cmd2',
        },
      ];

      for (const action of actions) {
        await commandProcessor.dispatchAction(actor, action);
      }

      const stats = commandProcessor.getPayloadCreationStatistics();
      
      expect(stats.totalPayloadsCreated).toBe(2);
      expect(stats.multiTargetPayloads).toBe(1);
      expect(stats.legacyPayloads).toBe(1);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle dispatcher failures gracefully', async () => {
      // Make dispatcher fail
      eventDispatchService.dispatchWithErrorHandling.mockResolvedValue(false);

      const actor = { id: 'actor_123' };
      const turnAction = {
        actionDefinitionId: 'test:action',
        resolvedParameters: { targetId: 'target_123' },
        commandString: 'test',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error: Failed to initiate action.');
      expect(result.turnEnded).toBe(true);
    });

    it('should validate inputs properly', async () => {
      const invalidCases = [
        { actor: null, turnAction: { actionDefinitionId: 'test' } },
        { actor: { id: '' }, turnAction: { actionDefinitionId: 'test' } },
        { actor: { id: 'test' }, turnAction: null },
        { actor: { id: 'test' }, turnAction: {} },
      ];

      for (const { actor, turnAction } of invalidCases) {
        const result = await commandProcessor.dispatchAction(actor, turnAction);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Internal error: Malformed action prevented execution.');
      }
    });
  });
});