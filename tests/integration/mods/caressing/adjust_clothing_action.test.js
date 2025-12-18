/**
 * @file Integration tests for the caressing:adjust_clothing multi-target action
 * @description Tests the complete flow of the adjust_clothing action with
 * multiple targets (person and garment)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import adjustClothingRule from '../../../../data/mods/caressing/rules/adjust_clothing.rule.json';
import eventIsActionAdjustClothing from '../../../../data/mods/caressing/conditions/event-is-action-adjust-clothing.condition.json';

const ACTION_ID = 'caressing:adjust_clothing';

describe('caressing:adjust_clothing action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      ACTION_ID,
      adjustClothingRule,
      eventIsActionAdjustClothing
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('handles multiple targets correctly', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'bedroom',
    });

    // Create a garment entity
    const garment = {
      id: 'garment1',
      components: {
        'core:name': { text: 'shirt' },
        'core:position': { locationId: 'bedroom' },
      },
    };

    const room = ModEntityScenarios.createRoom('bedroom', 'Bedroom');
    testFixture.reset([room, scenario.actor, scenario.target, garment]);

    // Test multi-target action with primaryId and secondaryId
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      primaryId: scenario.target.id,
      secondaryId: garment.id,
      originalInput: 'adjust clothing',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('smoothed');
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    const garment = {
      id: 'garment-garden',
      components: {
        'core:name': { text: 'jacket' },
        'core:position': { locationId: 'garden' },
      },
    };

    const room = ModEntityScenarios.createRoom('garden', 'Garden');
    testFixture.reset([room, scenario.actor, scenario.target, garment]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      primaryId: scenario.target.id,
      secondaryId: garment.id,
      originalInput: 'adjust clothing',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Sarah');
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  describe('perspective-aware descriptions (DISPEREVEUPG-004)', () => {
    /**
     * Note: The perspective-aware description parameters (actor_description,
     * target_description, alternate_descriptions) are passed to the log handler
     * by DispatchPerceptibleEventHandler, not included in the event payload.
     * Unit tests for dispatchPerceptibleEventHandler.test.js verify this
     * pass-through behavior. These integration tests verify the rule file
     * correctly configures the DISPATCH_PERCEPTIBLE_EVENT operation.
     */

    it('dispatches perceptible event with correct description text', async () => {
      const scenario = testFixture.createCloseActors(['Anna', 'Ben'], {
        location: 'parlor',
      });

      const garment = {
        id: 'garment-perspective',
        components: {
          'core:name': { text: 'blouse' },
          'core:position': { locationId: 'parlor' },
        },
      };

      const room = ModEntityScenarios.createRoom('parlor', 'Parlor');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        primaryId: scenario.target.id,
        secondaryId: garment.id,
        originalInput: 'adjust clothing',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain('Anna');
      expect(perceptibleEvent.payload.descriptionText).toContain("Ben's");
      expect(perceptibleEvent.payload.descriptionText).toContain('blouse');
    });

    it('dispatches perceptible event with correct perception type', async () => {
      const scenario = testFixture.createCloseActors(['Clara', 'David'], {
        location: 'living_room',
      });

      const garment = {
        id: 'garment-target',
        components: {
          'core:name': { text: 'coat' },
          'core:position': { locationId: 'living_room' },
        },
      };

      const room = ModEntityScenarios.createRoom('living_room', 'Living Room');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        primaryId: scenario.target.id,
        secondaryId: garment.id,
        originalInput: 'adjust clothing',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe('social.affection');
    });

    it('includes actor and target IDs in perceptible event', async () => {
      const scenario = testFixture.createCloseActors(['Eve', 'Frank'], {
        location: 'study',
      });

      const garment = {
        id: 'garment-alt',
        components: {
          'core:name': { text: 'sweater' },
          'core:position': { locationId: 'study' },
        },
      };

      const room = ModEntityScenarios.createRoom('study', 'Study');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        primaryId: scenario.target.id,
        secondaryId: garment.id,
        originalInput: 'adjust clothing',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);
      // The rule uses {context.targetId} from PREPARE_ACTION_CONTEXT
      expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    });
  });
});
