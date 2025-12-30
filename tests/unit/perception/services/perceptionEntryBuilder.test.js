/**
 * @file Unit tests for PerceptionEntryBuilder
 * @see src/perception/services/perceptionEntryBuilder.js
 * @see tickets/ADDPERLOGENTHANROB-004.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PerceptionEntryBuilder from '../../../../src/perception/services/perceptionEntryBuilder.js';

describe('PerceptionEntryBuilder', () => {
  let mockLogger;
  let builder;

  const createBaseEntry = (overrides = {}) => ({
    descriptionText: 'Base description text',
    perceptionType: 'action.performed',
    timestamp: 1234567890,
    actorId: 'actor-1',
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    builder = new PerceptionEntryBuilder({
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(builder).toBeDefined();
    });

    it('should accept null logger and use fallback', () => {
      const builderWithNullLogger = new PerceptionEntryBuilder({
        logger: null,
      });
      expect(builderWithNullLogger).toBeDefined();
    });
  });

  describe('buildForRecipient', () => {
    describe('actor role handling', () => {
      it('should return actor_description when recipient is the originating actor', () => {
        // Test 1: Actor receives actor_description
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'actor-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: 'Actor performs action on you',
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: null,
        });

        expect(result.descriptionText).toBe('I perform the action');
      });

      it('should set perceivedVia to self for actor and bypass sense filtering', () => {
        // Test 2: Actor bypasses sense filtering (perceivedVia = 'self')
        const baseEntry = createBaseEntry();
        const filteredMap = new Map([
          [
            'actor-1',
            { descriptionText: 'Filtered description', sense: 'visual' },
          ],
        ]);

        const result = builder.buildForRecipient({
          recipientId: 'actor-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: filteredMap,
        });

        expect(result.perceivedVia).toBe('self');
        // Actor should NOT receive filtered description - they get their actor_description
        expect(result.descriptionText).toBe('I perform the action');
      });
    });

    describe('target role handling', () => {
      it('should return target_description when recipient is the target', () => {
        // Test 3: Target receives target_description
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'target-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: 'Actor performs action on you',
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: null,
        });

        expect(result.descriptionText).toBe('Actor performs action on you');
      });

      it('should apply sense filtering to target when filteredRecipientsMap is provided', () => {
        // Test 4: Target undergoes sense filtering
        const baseEntry = createBaseEntry();
        const filteredMap = new Map([
          [
            'target-1',
            { descriptionText: 'Filtered observer text', sense: 'auditory' },
          ],
        ]);

        const result = builder.buildForRecipient({
          recipientId: 'target-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: 'Actor performs action on you',
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: filteredMap,
        });

        // Custom description (target_description) takes priority over filtered text
        expect(result.descriptionText).toBe('Actor performs action on you');
        // But sense comes from filter
        expect(result.perceivedVia).toBe('auditory');
      });

      it('should not give target actor_description even if target_description is missing', () => {
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'target-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: undefined,
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: null,
        });

        // Target should get base description, not actor description
        expect(result.descriptionText).toBe('Base description text');
      });
    });

    describe('observer role handling', () => {
      it('should return base description for observers (non-actor, non-target)', () => {
        // Test 5: Observer receives base description
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: 'Actor performs action on you',
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: null,
        });

        expect(result.descriptionText).toBe('Base description text');
      });
    });

    describe('sense filtering', () => {
      it('should apply sense filtering when filteredRecipientsMap is provided', () => {
        // Test 6: Sense filtering applied when filteredRecipientsMap provided
        const baseEntry = createBaseEntry();
        const filteredMap = new Map([
          [
            'observer-1',
            { descriptionText: 'You hear footsteps', sense: 'auditory' },
          ],
        ]);

        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: 'I walk across the room',
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: null,
          filteredRecipientsMap: filteredMap,
        });

        expect(result.descriptionText).toBe('You hear footsteps');
        expect(result.perceivedVia).toBe('auditory');
      });

      it('should not apply filtering when filteredRecipientsMap is null', () => {
        // Test 7: No filtering when filteredRecipientsMap is null
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: null,
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: null,
          filteredRecipientsMap: null,
        });

        expect(result.descriptionText).toBe('Base description text');
        expect(result.perceivedVia).toBeUndefined();
      });

      it('should use filtered descriptionText when no custom description is present', () => {
        const baseEntry = createBaseEntry();
        const filteredMap = new Map([
          [
            'observer-1',
            { descriptionText: 'Filtered observer text', sense: 'visual' },
          ],
        ]);

        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: null,
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: filteredMap,
        });

        expect(result.descriptionText).toBe('Filtered observer text');
        expect(result.perceivedVia).toBe('visual');
      });
    });

    describe('entry field preservation', () => {
      it('should preserve original entry fields (timestamp, perceptionType, actorId)', () => {
        // Test 8: Preserves original entry fields
        const baseEntry = createBaseEntry({
          perceptionType: 'movement.arrival',
          timestamp: 9999999999,
          actorId: 'specific-actor-id',
          customField: 'custom-value',
        });

        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: null,
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: null,
          filteredRecipientsMap: null,
        });

        expect(result.perceptionType).toBe('movement.arrival');
        expect(result.timestamp).toBe(9999999999);
        expect(result.actorId).toBe('specific-actor-id');
        expect(result.customField).toBe('custom-value');
      });

      it('should not mutate the original baseEntry', () => {
        const baseEntry = createBaseEntry();
        const originalDescriptionText = baseEntry.descriptionText;

        builder.buildForRecipient({
          recipientId: 'actor-1',
          baseEntry,
          actorDescription: 'I perform the action',
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: null,
          filteredRecipientsMap: null,
        });

        // Original entry should remain unchanged
        expect(baseEntry.descriptionText).toBe(originalDescriptionText);
      });

      it('should preserve referential equality when no changes needed', () => {
        const baseEntry = createBaseEntry();

        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: null,
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: 'target-1',
          filteredRecipientsMap: null,
        });

        // When no changes needed, should return the same object
        expect(result).toBe(baseEntry);
      });
    });

    describe('edge cases', () => {
      it('should handle when recipient is both actor and target', () => {
        // Actor role takes precedence
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'actor-1',
          baseEntry,
          actorDescription: 'I perform the action on myself',
          targetDescription: 'Actor performs action on you',
          originatingActorId: 'actor-1',
          targetId: 'actor-1', // Same as actor
          filteredRecipientsMap: null,
        });

        expect(result.descriptionText).toBe('I perform the action on myself');
        expect(result.perceivedVia).toBe('self');
      });

      it('should handle null filtered entry descriptionText by falling back to base', () => {
        const baseEntry = createBaseEntry();
        const filteredMap = new Map([
          ['observer-1', { descriptionText: null, sense: 'visual' }],
        ]);

        const result = builder.buildForRecipient({
          recipientId: 'observer-1',
          baseEntry,
          actorDescription: null,
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: null,
          filteredRecipientsMap: filteredMap,
        });

        expect(result.descriptionText).toBe('Base description text');
        expect(result.perceivedVia).toBe('visual');
      });

      it('should handle undefined actorDescription gracefully', () => {
        const baseEntry = createBaseEntry();
        const result = builder.buildForRecipient({
          recipientId: 'actor-1',
          baseEntry,
          actorDescription: undefined,
          targetDescription: null,
          originatingActorId: 'actor-1',
          targetId: null,
          filteredRecipientsMap: null,
        });

        expect(result.descriptionText).toBe('Base description text');
        expect(result.perceivedVia).toBeUndefined();
      });
    });
  });
});
