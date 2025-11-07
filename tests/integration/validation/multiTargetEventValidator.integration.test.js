/**
 * @file Integration tests for MultiTargetEventValidator
 * @description Tests real-world integration with event system, schema validation, and multi-target pipelines
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import MultiTargetEventValidator from '../../../src/validation/multiTargetEventValidator.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import EventBus from '../../../src/events/eventBus.js';
import MultiTargetEventBuilder from '../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import TargetExtractionResult from '../../../src/entities/multiTarget/targetExtractionResult.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

describe('MultiTargetEventValidator - Integration Tests', () => {
  let testBed;
  let validator;
  let logger;
  let eventBus;
  let schemaValidator;
  let eventBuilder;
  let capturedEvents;

  beforeEach(() => {
    testBed = createTestBed();
    logger = new ConsoleLogger();

    // Create real instances for integration testing
    schemaValidator = new AjvSchemaValidator({ logger });
    eventBus = new EventBus({ logger });
    validator = new MultiTargetEventValidator({ logger });

    // Event builder for creating realistic multi-target events
    eventBuilder = new MultiTargetEventBuilder({
      logger,
      validator,
    });

    // Capture events for verification
    capturedEvents = [];
    eventBus.subscribe('*', (event) => {
      capturedEvents.push(event);
    });
  });

  afterEach(() => {
    testBed.cleanup();
    validator.resetPerformanceMetrics();
    jest.restoreAllMocks();
  });

  describe('Real Event System Integration', () => {
    it('should integrate with EventBus for event dispatching and validation', () => {
      const testEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_001',
        actionId: 'core:attack',
        targets: {
          weapon: 'sword_123',
          target: 'goblin_456',
        },
        targetId: 'sword_123',
        originalInput: 'attack goblin with sword',
      };

      // Validate the event
      const validationResult = validator.validateEvent(testEvent);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // Dispatch through EventBus
      eventBus.dispatch(ATTEMPT_ACTION_ID, testEvent);

      // Verify event was captured
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe(ATTEMPT_ACTION_ID);
      expect(capturedEvents[0].payload).toEqual(testEvent);
    });

    it('should handle validation failures in event pipeline', () => {
      const invalidEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_001',
        actionId: 'core:attack',
        targets: {
          weapon: '', // Invalid empty target
          target: 'goblin_456',
        },
        targetId: 'sword_123',
        originalInput: 'attack goblin',
      };

      const validationResult = validator.validateEvent(invalidEvent);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain(
        'Target "weapon" must have a non-empty string value'
      );

      // Event should still be dispatchable, but with validation errors
      eventBus.dispatch(ATTEMPT_ACTION_ID, invalidEvent);
      expect(capturedEvents).toHaveLength(1);
    });

    it('should validate events with complex target structures', () => {
      const complexEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_001',
        actionId: 'kissing:kiss_back_passionately',
        targets: {
          recipient: 'npc_lover_789',
          location: 'bedroom_001',
          mood_enhancer: 'wine_glass_123',
        },
        targetId: 'npc_lover_789',
        originalInput: 'kiss lover passionately in bedroom while holding wine',
      };

      const validationResult = validator.validateEvent(complexEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(true);
      expect(validationResult.details.targetCount).toBe(3);
      expect(validationResult.details.primaryTarget).toBe('npc_lover_789');
    });
  });

  describe('Schema Validation Integration', () => {
    it('should validate events using internal validation logic', () => {
      const testEvent = {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'test:action',
        originalInput: 'test command',
        targetId: 'test_target',
        targets: {
          primary: 'test_target',
        },
      };

      // Validate with MultiTargetEventValidator
      const mtValidationResult = validator.validateEvent(testEvent);
      expect(mtValidationResult.isValid).toBe(true);
      expect(mtValidationResult.errors).toHaveLength(0);
      expect(mtValidationResult.details.primaryTarget).toBe('test_target');
    });

    it('should handle schema validation errors gracefully', () => {
      const malformedEvent = {
        eventName: 123, // Should be string
        actorId: null, // Should be string
        // Missing required fields
      };

      const validationResult = validator.validateEvent(malformedEvent);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.errors).toContain(
        'Invalid event name - must be "core:attempt_action"'
      );
    });
  });

  describe('Multi-Target Action Pipeline Integration', () => {
    it('should validate multi-target events from realistic pipeline scenarios', () => {
      // Simulate event created by pipeline with multiple targets
      const pipelineEvent = {
        eventName: 'core:attempt_action',
        actorId: 'hero_player_001',
        actionId: 'combat:legendary_strike',
        originalInput:
          'strike the dragon with my legendary sword in the throne room',
        targets: {
          weapon: 'legendary_sword_001',
          enemy: 'dragon_boss_999',
          location: 'throne_room_001',
        },
        targetId: 'legendary_sword_001',
      };

      // Validate the event
      const validationResult = validator.validateEvent(pipelineEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(true);
      expect(validationResult.details.targetCount).toBe(3);
      expect(validationResult.details.primaryTarget).toBe(
        'legendary_sword_001'
      );
      expect(validationResult.warnings).toHaveLength(0);
    });

    it('should validate target consistency in pipeline scenarios', () => {
      // Simulate inconsistent event from pipeline
      const inconsistentEvent = {
        eventName: 'core:attempt_action',
        actorId: 'healer_001',
        actionId: 'core:give_item',
        originalInput: 'give potion to ally',
        targets: {
          item: 'potion_123',
          recipient: 'ally_456',
        },
        targetId: 'wrong_target_789', // Inconsistent with targets
      };

      const validationResult = validator.validateEvent(inconsistentEvent);

      expect(validationResult.isValid).toBe(true); // Should still be valid
      expect(validationResult.warnings).toContain(
        'targetId "wrong_target_789" does not match any target in targets object'
      );
      expect(validationResult.details.consistencyIssues).toContain(
        'targetId_mismatch'
      );
    });

    it('should handle pipeline errors gracefully', () => {
      // Simulate corrupted event from pipeline
      const corruptedEvent = {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'test:corrupted_action',
        originalInput: 'corrupted input test',
        targets: {
          invalid_key_123: null, // Invalid target value
          'bad-key-name': 'valid_target', // Invalid key format
        },
        targetId: 'valid_target',
      };

      const validationResult = validator.validateEvent(corruptedEvent);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain(
        'Target "invalid_key_123" must have a non-empty string value'
      );
      expect(validationResult.warnings).toContain(
        'Target key "bad-key-name" should follow naming conventions (alphanumeric with underscores)'
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle null/undefined events gracefully', () => {
      const nullResult = validator.validateEvent(null);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors).toContain(
        'Validation error: Event payload is required'
      );

      const undefinedResult = validator.validateEvent(undefined);
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.errors).toContain(
        'Validation error: Event payload is required'
      );
    });

    it('should recover from validation errors and continue processing', () => {
      const validEvent = {
        eventName: 'core:attempt_action',
        actorId: 'recovery_actor',
        actionId: 'recovery:test',
        originalInput: 'recovery test',
        targetId: 'recovery_target',
      };

      const invalidEvent = null;

      // Process invalid event
      const invalidResult = validator.validateEvent(invalidEvent);
      expect(invalidResult.isValid).toBe(false);

      // Should still process valid events after error
      const validResult = validator.validateEvent(validEvent);
      expect(validResult.isValid).toBe(true);

      // Performance metrics should track the error
      const metrics = validator.getPerformanceMetrics();
      expect(metrics.validationCount).toBe(2);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.errorRate).toBe(0.5);
    });

    it('should handle corrupted event data gracefully', () => {
      const corruptedEvent = {
        eventName: 'core:attempt_action',
        actorId: 'corrupted_actor',
        actionId: 'corrupt:test',
        originalInput: 'corrupt test',
        targets: {
          circular_ref: null,
        },
        targetId: 'corrupt_target',
      };

      // Add circular reference
      corruptedEvent.targets.circular_ref = corruptedEvent;

      const validationResult = validator.validateEvent(corruptedEvent);

      // Should handle gracefully without crashing
      expect(validationResult).toBeDefined();
      expect(validationResult.isValid).toBeDefined();
      expect(Array.isArray(validationResult.errors)).toBe(true);
      expect(Array.isArray(validationResult.warnings)).toBe(true);
    });
  });

  describe('Real-World Event Scenarios', () => {
    it('should validate combat action with weapon and target', () => {
      const combatEvent = {
        eventName: 'core:attempt_action',
        actorId: 'warrior_001',
        actionId: 'combat:sword_strike',
        targets: {
          weapon: 'steel_sword_456',
          enemy: 'orc_chieftain_789',
          bodypart: 'torso',
        },
        targetId: 'steel_sword_456',
        originalInput:
          'strike the orc chieftain in the torso with my steel sword',
      };

      const validationResult = validator.validateEvent(combatEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(true);
      expect(validationResult.details.targetCount).toBe(3);
      expect(validationResult.details.primaryTarget).toBe('steel_sword_456');
    });

    it('should validate social interaction with multiple participants', () => {
      const socialEvent = {
        eventName: 'core:attempt_action',
        actorId: 'diplomat_001',
        actionId: 'social:negotiate_treaty',
        targets: {
          primary_negotiator: 'king_enemy_001',
          witness: 'advisor_neutral_002',
          document: 'treaty_scroll_123',
          location: 'throne_room_001',
        },
        targetId: 'king_enemy_001',
        originalInput: 'negotiate peace treaty with enemy king in throne room',
      };

      const validationResult = validator.validateEvent(socialEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(true);
      expect(validationResult.details.targetCount).toBe(4);
      expect(validationResult.details.primaryTarget).toBe('king_enemy_001');
    });

    it('should validate equipment action with complex item interactions', () => {
      const equipmentEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_001',
        actionId: 'equipment:enchant_weapon',
        targets: {
          item: 'iron_sword_001',
          reagent: 'fire_essence_002',
          tool: 'enchanting_table_003',
          container: 'reagent_pouch_004',
        },
        targetId: 'iron_sword_001',
        originalInput:
          'enchant iron sword with fire essence using enchanting table',
      };

      const validationResult = validator.validateEvent(equipmentEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(true);
      expect(validationResult.details.targetCount).toBe(4);
      expect(validationResult.details.primaryTarget).toBe('iron_sword_001');
    });

    it('should maintain backward compatibility with legacy single-target events', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'legacy_player',
        actionId: 'legacy:old_action',
        targetId: 'legacy_target_123',
        originalInput: 'legacy action command',
      };

      const validationResult = validator.validateEvent(legacyEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(false);
      expect(validationResult.details.targetCount).toBe(0);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should handle targetless actions (emotes, self-actions)', () => {
      const emoteEvent = {
        eventName: 'core:attempt_action',
        actorId: 'expressive_player',
        actionId: 'core:laugh',
        targetId: null,
        originalInput: 'laugh heartily',
      };

      const validationResult = validator.validateEvent(emoteEvent);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.details.hasMultipleTargets).toBe(false);
      expect(validationResult.errors).toHaveLength(0);
    });
  });

  describe('Edge Case Coverage', () => {
    it('should report an error when targets object is empty', () => {
      const emptyTargetsEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_empty',
        actionId: 'test:empty_targets',
        originalInput: 'attempt action with empty targets',
        targetId: 'primary_target_001',
        targets: {},
      };

      const result = validator.validateEvent(emptyTargetsEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targets object cannot be empty');
      expect(result.details.consistencyIssues).toContain('targetId_mismatch');
    });

    it('should warn about invalid entity IDs and duplicate targets', () => {
      const duplicateTargetsEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_dup',
        actionId: 'test:duplicate_targets',
        originalInput: 'attempt action with duplicate targets',
        targetId: 'invalid id with space',
        targets: {
          primary: 'invalid id with space',
          assistant: 'invalid id with space',
        },
      };

      const result = validator.validateEvent(duplicateTargetsEvent);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Target "primary" ID "invalid id with space" should follow entity ID format (letters, numbers, underscore, colon)'
      );
      expect(result.warnings).toContain('targets object contains duplicate target IDs');
      expect(result.details.consistencyIssues).toContain('duplicate_targets');
    });

    it('should enforce legacy targetId to be string or null', () => {
      const legacyEvent = {
        eventName: 'core:attempt_action',
        actorId: 'legacy_tester',
        actionId: 'legacy:check',
        originalInput: 'legacy action with numeric targetId',
        targetId: 12345,
      };

      const result = validator.validateEvent(legacyEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Legacy targetId must be a string or null');
    });

    it('should warn when an event has excessive targets and actor equals the primary target', () => {
      const largeTargetSet = {
        eventName: 'core:attempt_action',
        actorId: 'overloaded_actor',
        actionId: 'test:large_target_set',
        originalInput: 'attempt action with many targets',
        targetId: 'overloaded_actor',
        targets: {
          primary: 'overloaded_actor',
          tool_one: 'entity_tool_1',
          tool_two: 'entity_tool_2',
          tool_three: 'entity_tool_3',
          tool_four: 'entity_tool_4',
          tool_five: 'entity_tool_5',
          tool_six: 'entity_tool_6',
          tool_seven: 'entity_tool_7',
          tool_eight: 'entity_tool_8',
          tool_nine: 'entity_tool_9',
          tool_ten: 'entity_tool_10',
        },
      };

      const result = validator.validateEvent(largeTargetSet);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Event has 11 targets - consider if this is necessary for performance'
      );
      expect(result.warnings).toContain(
        'Actor and primary target are the same entity - verify this is intentional'
      );
    });

    it('should suggest descriptive target names when using generic keys', () => {
      const genericTargetsEvent = {
        eventName: 'core:attempt_action',
        actorId: 'namer',
        actionId: 'test:generic_names',
        originalInput: 'perform action with generic targets',
        targetId: 'entity:primary',
        targets: {
          t1: 'entity:primary',
          t2: 'entity:secondary',
        },
      };

      const result = validator.validateEvent(genericTargetsEvent);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Consider using descriptive target names (e.g., "item", "recipient") instead of generic names'
      );
    });

    it('should warn when primary and target refer to the same entity', () => {
      const overlappingTargetsEvent = {
        eventName: 'core:attempt_action',
        actorId: 'player_overlap',
        actionId: 'test:overlap',
        originalInput: 'perform action with overlapping targets',
        targetId: 'entity_overlap',
        targets: {
          primary: 'entity_overlap',
          target: 'entity_overlap',
        },
      };

      const result = validator.validateEvent(overlappingTargetsEvent);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'primary and target refer to the same entity - consider using just one'
      );
    });

    it('should emit a performance warning when validation takes too long', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      const performanceSpy = jest
        .spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(25);

      const event = {
        eventName: 'core:attempt_action',
        actorId: 'slow_validator',
        actionId: 'test:performance_warning',
        originalInput: 'perform action slowly',
        targetId: 'entity_primary',
        targets: {
          primary: 'entity_primary',
        },
      };

      const result = validator.validateEvent(event);

      expect(result.isValid).toBe(true);
      expect(performanceSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        'Multi-target validation took longer than expected',
        expect.objectContaining({
          duration: '25.00',
          target: '< 10ms',
        })
      );
    });
  });
});
