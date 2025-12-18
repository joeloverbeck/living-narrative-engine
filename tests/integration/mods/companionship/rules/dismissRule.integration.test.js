/**
 * @file Integration tests for the companionship:dismiss rule behavior.
 * @description Validates the full dismiss pipeline, ensuring perceptible
 * events are dispatched correctly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../../common/mods/ModAssertionHelpers.js';
import dismissRule from '../../../../../data/mods/companionship/rules/dismiss.rule.json';
import eventIsActionDismiss from '../../../../../data/mods/companionship/conditions/event-is-action-dismiss.condition.json';

const ACTION_ID = 'companionship:dismiss';

describe('companionship:dismiss rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'companionship',
      ACTION_ID,
      dismissRule,
      eventIsActionDismiss
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('dispatches perceptible event when leader dismisses follower in same location', async () => {
    const scenario = testFixture.createCloseActors(['Lord Byron', 'Squire'], {
      location: 'great_hall',
    });

    // Set up the following relationship (target is following actor)
    scenario.actor.components['companionship:leading'] = {
      followers: [scenario.target.id],
    };
    scenario.target.components['companionship:following'] = {
      leaderId: scenario.actor.id,
    };

    const room = ModEntityScenarios.createRoom('great_hall', 'Great Hall');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      targetId: scenario.target.id,
      originalInput: 'dismiss',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: expect.stringContaining('Lord Byron'),
      locationId: 'great_hall',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
      perceptionType: 'state.observable_change',
    });
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
      const scenario = testFixture.createCloseActors(
        ['Lady Catherine', 'Servant'],
        {
          location: 'drawing_room',
        }
      );

      scenario.actor.components['companionship:leading'] = {
        followers: [scenario.target.id],
      };
      scenario.target.components['companionship:following'] = {
        leaderId: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('drawing_room', 'Drawing Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        targetId: scenario.target.id,
        originalInput: 'dismiss',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'Lady Catherine'
      );
      expect(perceptibleEvent.payload.descriptionText).toContain('Servant');
    });

    it('dispatches perceptible event with correct perception type', async () => {
      const scenario = testFixture.createCloseActors(['Commander', 'Scout'], {
        location: 'command_tent',
      });

      scenario.actor.components['companionship:leading'] = {
        followers: [scenario.target.id],
      };
      scenario.target.components['companionship:following'] = {
        leaderId: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('command_tent', 'Command Tent');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        targetId: scenario.target.id,
        originalInput: 'dismiss',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
        perceptionType: 'state.observable_change',
      });
    });

    it('includes actor and target IDs in perceptible event', async () => {
      const scenario = testFixture.createCloseActors(['Duke', 'Page'], {
        location: 'castle_court',
      });

      scenario.actor.components['companionship:leading'] = {
        followers: [scenario.target.id],
      };
      scenario.target.components['companionship:following'] = {
        leaderId: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('castle_court', 'Castle Court');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        targetId: scenario.target.id,
        originalInput: 'dismiss',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'state.observable_change',
      });
    });
  });
});
