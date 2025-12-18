/**
 * @file Integration test for perceptible event schema validation
 * @description Reproduces and verifies fix for schema validation failure
 * when dispatching core:perceptible_event with perspective-aware properties.
 *
 * Bug: VED: Payload validation FAILED for event 'core:perceptible_event'.
 * Errors: [root]: must NOT have additional properties (x4)
 *
 * Root cause: Event schema was missing actorDescription, targetDescription,
 * alternateDescriptions, and senseAware properties.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('perceptible event schema validation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_clothing'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('perspective-aware properties validation', () => {
    it('validates event with actorDescription and alternateDescriptions from remove_clothing rule', async () => {
      // Setup actor with clothing
      const scenario = fixture.createStandardActorTarget(['Alex', 'shirt'], {
        location: 'test_bedroom',
      });
      const clothing = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'shirt' },
          'core:position': { locationId: 'test_bedroom' },
        },
      };
      fixture.reset([scenario.actor, clothing]);

      // Execute action that triggers DISPATCH_PERCEPTIBLE_EVENT
      // The handle_remove_clothing.rule.json dispatches this with:
      // - actor_description: "I remove my {context.targetName}."
      // - alternate_descriptions: { auditory: "..." }
      await fixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'clothing:remove_clothing',
        targetId: 'shirt1',
        originalInput: 'remove shirt',
      });

      // Verify NO validation errors were dispatched
      const errorEvents = fixture.events.filter(
        (e) => e.eventType === 'core:system_error_occurred'
      );
      const validationErrors = errorEvents.filter(
        (e) =>
          e.payload?.message?.includes('Payload validation FAILED') ||
          e.payload?.message?.includes('additional properties')
      );

      // This is the key assertion - if schema is wrong, we'll have validation errors
      expect(validationErrors).toHaveLength(0);

      // Verify perceptible event WAS dispatched (not skipped due to validation)
      const perceptibleEvent = fixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();

      // Verify the perspective-aware properties are present
      expect(perceptibleEvent.payload).toHaveProperty('actorDescription');
      expect(perceptibleEvent.payload.actorDescription).toBe(
        'I remove my shirt.'
      );

      expect(perceptibleEvent.payload).toHaveProperty('alternateDescriptions');
      expect(perceptibleEvent.payload.alternateDescriptions).toHaveProperty(
        'auditory'
      );

      expect(perceptibleEvent.payload).toHaveProperty('senseAware');
      expect(perceptibleEvent.payload.senseAware).toBe(true);
    });

    it('validates event with null targetDescription when target is not provided', async () => {
      // Setup actor with clothing
      const scenario = fixture.createStandardActorTarget(['Bob', 'jacket'], {
        location: 'test_location',
      });
      const clothing = {
        id: 'jacket1',
        components: {
          'core:name': { text: 'jacket' },
          'core:position': { locationId: 'test_location' },
        },
      };
      fixture.reset([scenario.actor, clothing]);

      await fixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'clothing:remove_clothing',
        targetId: 'jacket1',
        originalInput: 'remove jacket',
      });

      // Verify NO validation errors
      const validationErrors = fixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' &&
          (e.payload?.message?.includes('Payload validation FAILED') ||
            e.payload?.message?.includes('additional properties'))
      );
      expect(validationErrors).toHaveLength(0);

      // Verify perceptible event was dispatched
      const perceptibleEvent = fixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();

      // targetDescription should be null when not explicitly provided
      expect(perceptibleEvent.payload).toHaveProperty('targetDescription');
      expect(perceptibleEvent.payload.targetDescription).toBeNull();
    });
  });

  describe('schema structure validation', () => {
    it('includes all required base properties in perceptible event', async () => {
      const scenario = fixture.createStandardActorTarget(['Charlie', 'hat'], {
        location: 'test_hall',
      });
      const clothing = {
        id: 'hat1',
        components: {
          'core:name': { text: 'hat' },
          'core:position': { locationId: 'test_hall' },
        },
      };
      fixture.reset([scenario.actor, clothing]);

      await fixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'clothing:remove_clothing',
        targetId: 'hat1',
        originalInput: 'remove hat',
      });

      const perceptibleEvent = fixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();

      // Verify all required base properties
      expect(perceptibleEvent.payload).toHaveProperty(
        'eventName',
        'core:perceptible_event'
      );
      expect(perceptibleEvent.payload).toHaveProperty('locationId');
      expect(perceptibleEvent.payload).toHaveProperty('descriptionText');
      expect(perceptibleEvent.payload).toHaveProperty('timestamp');
      expect(perceptibleEvent.payload).toHaveProperty('perceptionType');
      expect(perceptibleEvent.payload).toHaveProperty('actorId');

      // Verify optional base properties
      expect(perceptibleEvent.payload).toHaveProperty('targetId');
      expect(perceptibleEvent.payload).toHaveProperty('involvedEntities');
      expect(perceptibleEvent.payload).toHaveProperty('contextualData');

      // Verify new perspective-aware properties (the 4 that were missing)
      expect(perceptibleEvent.payload).toHaveProperty('actorDescription');
      expect(perceptibleEvent.payload).toHaveProperty('targetDescription');
      expect(perceptibleEvent.payload).toHaveProperty('alternateDescriptions');
      expect(perceptibleEvent.payload).toHaveProperty('senseAware');
    });
  });
});
