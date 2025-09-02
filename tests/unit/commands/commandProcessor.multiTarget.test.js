/**
 * @file Additional comprehensive tests for CommandProcessor multi-target functionality
 * @description Extends existing test coverage with edge cases and complex scenarios
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
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';
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

describe('CommandProcessor - Additional Multi-Target Tests', () => {
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

  describe('Multi-Target Data Extraction Integration', () => {
    it('should extract multi-target data from complex formatting results', async () => {
      const turnAction = {
        actionDefinitionId: 'combat:complex_attack',
        commandString: 'attack goblin with sword using shield',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            target: ['goblin_456'],
            weapon: ['sword_123', 'axe_789'], // Multiple options
            tool: ['shield_012'],
          },
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      expect(
        eventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalledWith(
        ATTEMPT_ACTION_ID,
        expect.objectContaining({
          eventName: 'core:attempt_action',
          actorId: 'test_actor_123',
          actionId: 'combat:complex_attack',
          targetId: 'goblin_456', // Primary target
          targets: {
            target: {
              entityId: 'goblin_456',
              placeholder: 'target',
              description: 'goblin_456',
              resolvedFromContext: false,
            },
            weapon: {
              entityId: 'sword_123',
              placeholder: 'weapon',
              description: 'sword_123',
              resolvedFromContext: false,
            },
            tool: {
              entityId: 'shield_012',
              placeholder: 'tool',
              description: 'shield_012',
              resolvedFromContext: false,
            },
          },
          originalInput: 'attack goblin with sword using shield',
          timestamp: expect.any(Number),
        }),
        'ATTEMPT_ACTION_ID dispatch for pre-resolved action combat:complex_attack'
      );
    });

    it('should handle mixed target formats in targetIds', async () => {
      const turnAction = {
        actionDefinitionId: 'interaction:give',
        commandString: 'give coin to merchant',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['coin_123'], // Array format
            recipient: ['merchant_456'], // Array format
            location: [], // Empty array
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

      // TargetExtractionResult handles both string and array formats
      expect(dispatchedPayload.targets).toEqual({
        item: {
          entityId: 'coin_123',
          placeholder: 'item',
          description: 'coin_123',
          resolvedFromContext: false,
        },
        recipient: {
          entityId: 'merchant_456',
          placeholder: 'recipient',
          description: 'merchant_456',
          resolvedFromContext: false,
        },
        // location omitted due to empty array
      });

      expect(dispatchedPayload.targetId).toBe('coin_123'); // item is selected as primary
    });

    it('should handle single target through multi-target path', async () => {
      const turnAction = {
        actionDefinitionId: 'core:examine',
        commandString: 'examine book',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['book_123'],
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

      // Multi-target path always creates targets object when isMultiTarget is true
      expect(dispatchedPayload.targets).toBeDefined();
      expect(dispatchedPayload.targets.primary).toEqual({
        entityId: 'book_123',
        placeholder: 'primary',
        description: 'book_123',
        resolvedFromContext: false,
      });
      expect(dispatchedPayload.targetId).toBe('book_123');
    });

    it('should extract targets with complex category names', async () => {
      const turnAction = {
        actionDefinitionId: 'crafting:combine',
        commandString: 'combine materials to create item',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary_material: ['iron_ore_123'],
            secondary_material: ['coal_456'],
            crafting_station: ['forge_789'],
            output_container: ['chest_012'],
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

      expect(dispatchedPayload.targets).toEqual({
        primary_material: {
          entityId: 'iron_ore_123',
          placeholder: 'primary_material',
          description: 'iron_ore_123',
          resolvedFromContext: false,
        },
        secondary_material: {
          entityId: 'coal_456',
          placeholder: 'secondary_material',
          description: 'coal_456',
          resolvedFromContext: false,
        },
        crafting_station: {
          entityId: 'forge_789',
          placeholder: 'crafting_station',
          description: 'forge_789',
          resolvedFromContext: false,
        },
        output_container: {
          entityId: 'chest_012',
          placeholder: 'output_container',
          description: 'chest_012',
          resolvedFromContext: false,
        },
      });

      expect(dispatchedPayload.targetId).toBe('iron_ore_123'); // First target found
    });
  });

  describe('Legacy Compatibility Testing', () => {
    it('should process legacy single-target actions unchanged', async () => {
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

      // Verify legacy format with new fields per ticket requirements
      expect(dispatchedPayload).toEqual({
        eventName: 'core:attempt_action',
        actorId: 'test_actor_123',
        actionId: 'core:follow',
        targetId: 'alice_789',
        originalInput: 'follow Alice',
        timestamp: expect.any(Number),
        // New fields added per ticket requirements
        primaryId: 'alice_789',
        secondaryId: null,
        tertiaryId: null,
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      });

      // Ensure expected field count (original 6 + 5 new = 11)
      expect(Object.keys(dispatchedPayload)).toHaveLength(11);
      expect(dispatchedPayload.targets).toBeUndefined();
    });

    it('should handle legacy actions with null targets', async () => {
      const turnAction = {
        actionDefinitionId: 'core:emote',
        commandString: 'smile',
        resolvedParameters: {
          targetId: null,
        },
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targetId).toBe(null);
      expect(dispatchedPayload.targets).toBeUndefined();
      expect(dispatchedPayload.originalInput).toBe('smile');
      // New fields per ticket requirements
      expect(dispatchedPayload.primaryId).toBe(null);
      expect(dispatchedPayload.secondaryId).toBe(null);
      expect(dispatchedPayload.tertiaryId).toBe(null);
      expect(dispatchedPayload.resolvedTargetCount).toBe(0);
      expect(dispatchedPayload.hasContextDependencies).toBe(false);
    });

    it('should handle legacy actions without resolved parameters', async () => {
      const turnAction = {
        actionDefinitionId: 'core:rest',
        commandString: 'rest',
        resolvedParameters: {},
      };

      const result = await commandProcessor.dispatchAction(
        mockActor,
        turnAction
      );

      expect(result.success).toBe(true);
      const dispatchedPayload =
        eventDispatchService.dispatchWithErrorHandling.mock.calls[0][1];

      expect(dispatchedPayload.targetId).toBe(null);
      expect(dispatchedPayload.targets).toBeUndefined();
      // New fields per ticket requirements
      expect(dispatchedPayload.primaryId).toBe(null);
      expect(dispatchedPayload.secondaryId).toBe(null);
      expect(dispatchedPayload.tertiaryId).toBe(null);
      expect(dispatchedPayload.resolvedTargetCount).toBe(0);
      expect(dispatchedPayload.hasContextDependencies).toBe(false);
    });

  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed targetIds gracefully', async () => {
      const turnAction = {
        actionDefinitionId: 'test:malformed',
        commandString: 'malformed action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            invalid: ['valid_target_123'],
            empty: [],
            'bad-name': ['target_456'],
            '123numeric': ['target_789'],
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

      // The extraction might fail on invalid input, resulting in fallback payload
      if (dispatchedPayload.targets) {
        // If targets exist, should have valid targets only with comprehensive metadata
        expect(Object.keys(dispatchedPayload.targets)).toHaveLength(3);
        expect(dispatchedPayload.targets.invalid).toEqual({
          entityId: 'valid_target_123',
          placeholder: 'invalid',
          description: 'valid_target_123',
          resolvedFromContext: false,
        });
        expect(dispatchedPayload.targets['bad-name']).toEqual({
          entityId: 'target_456',
          placeholder: 'bad-name',
          description: 'target_456',
          resolvedFromContext: false,
        });
        expect(dispatchedPayload.targets['123numeric']).toEqual({
          entityId: 'target_789',
          placeholder: '123numeric',
          description: 'target_789',
          resolvedFromContext: false,
        });
        expect(dispatchedPayload.targetId).toBe('valid_target_123');
      } else {
        // Fallback payload without targets
        expect(dispatchedPayload.targetId).toBe(null);
      }
    });

    it('should handle extraction failures with fallback payload', async () => {
      // Create a turnAction that will cause the builder to fail
      const turnAction = {
        actionDefinitionId: 'test:failing',
        commandString: 'failing action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            target: [{}], // Invalid target structure
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

      // Fallback payload structure
      expect(dispatchedPayload.eventName).toBe('core:attempt_action');
      expect(dispatchedPayload.actorId).toBe('test_actor_123');
      expect(dispatchedPayload.actionId).toBe('test:failing');
      expect(dispatchedPayload.targetId).toBe(null);
    });

    it('should validate required inputs and provide clear errors', async () => {
      // Test invalid actor
      const result1 = await commandProcessor.dispatchAction(null, {
        actionDefinitionId: 'test:action',
        commandString: 'test',
        resolvedParameters: {},
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );

      // Test actor without ID
      const result2 = await commandProcessor.dispatchAction(
        {},
        {
          actionDefinitionId: 'test:action',
          commandString: 'test',
          resolvedParameters: {},
        }
      );

      expect(result2.success).toBe(false);
      expect(result2.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );

      // Test invalid turn action
      const result3 = await commandProcessor.dispatchAction(mockActor, null);

      expect(result3.success).toBe(false);
      expect(result3.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );

      // Test turn action without actionDefinitionId
      const result4 = await commandProcessor.dispatchAction(mockActor, {
        commandString: 'test',
        resolvedParameters: {},
      });

      expect(result4.success).toBe(false);
      expect(result4.error).toBe(
        'Internal error: Malformed action prevented execution.'
      );
    });

  });

});
