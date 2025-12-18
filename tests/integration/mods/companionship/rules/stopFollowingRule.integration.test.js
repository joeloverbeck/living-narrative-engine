/**
 * @file Integration tests for the companionship:stop_following rule behavior.
 * @description Validates the full stop_following pipeline, ensuring perceptible
 * events are dispatched correctly. Note: stop_following is a self-action
 * (targets: "none") - the actor stops following their current leader.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../../common/mods/ModAssertionHelpers.js';
import stopFollowingRule from '../../../../../data/mods/companionship/rules/stop_following.rule.json';
import eventIsActionStopFollowing from '../../../../../data/mods/companionship/conditions/event-is-action-stop-following.condition.json';

const ACTION_ID = 'companionship:stop_following';

describe('companionship:stop_following rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'companionship',
      ACTION_ID,
      stopFollowingRule,
      eventIsActionStopFollowing
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('dispatches perceptible event when follower stops following in same location', async () => {
    const scenario = testFixture.createCloseActors(['Squire', 'Lord Byron'], {
      location: 'great_hall',
    });

    // Set up the following relationship (actor is following target)
    scenario.actor.components['companionship:following'] = {
      leaderId: scenario.target.id,
    };
    scenario.target.components['companionship:leading'] = {
      followers: [scenario.actor.id],
    };

    const room = ModEntityScenarios.createRoom('great_hall', 'Great Hall');
    testFixture.reset([room, scenario.actor, scenario.target]);

    // stop_following is a self-action (no target needed)
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: ACTION_ID,
      originalInput: 'stop following',
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: expect.stringContaining('Squire'),
      locationId: 'great_hall',
      actorId: scenario.actor.id,
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

    it('verifies stop_following.rule.json has all sense-aware fields', () => {
      // Verify the rule JSON has the correct operation type with all sense-aware fields
      const findDispatchPerceptibleEvent = (actions) => {
        for (const action of actions) {
          if (action.type === 'DISPATCH_PERCEPTIBLE_EVENT') {
            return action;
          }
          if (action.type === 'IF' && action.parameters?.then_actions) {
            const found = findDispatchPerceptibleEvent(action.parameters.then_actions);
            if (found) return found;
          }
          if (action.type === 'IF_CO_LOCATED' && action.parameters?.then_actions) {
            const found = findDispatchPerceptibleEvent(action.parameters.then_actions);
            if (found) return found;
          }
        }
        return null;
      };

      const dispatchAction = findDispatchPerceptibleEvent(stopFollowingRule.actions);
      expect(dispatchAction).not.toBeNull();
      expect(dispatchAction.parameters).toHaveProperty('actor_description');
      expect(dispatchAction.parameters).toHaveProperty('target_description');
      expect(dispatchAction.parameters).toHaveProperty('alternate_descriptions');
      expect(dispatchAction.parameters.alternate_descriptions).toHaveProperty('auditory');
    });

    it('dispatches perceptible event with correct description text', async () => {
      const scenario = testFixture.createCloseActors(
        ['Servant', 'Lady Catherine'],
        {
          location: 'drawing_room',
        }
      );

      scenario.actor.components['companionship:following'] = {
        leaderId: scenario.target.id,
      };
      scenario.target.components['companionship:leading'] = {
        followers: [scenario.actor.id],
      };

      const room = ModEntityScenarios.createRoom('drawing_room', 'Drawing Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        originalInput: 'stop following',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain('Servant');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'Lady Catherine'
      );
    });

    it('dispatches perceptible event with correct perception type', async () => {
      const scenario = testFixture.createCloseActors(['Page', 'Duke'], {
        location: 'throne_room',
      });

      scenario.actor.components['companionship:following'] = {
        leaderId: scenario.target.id,
      };
      scenario.target.components['companionship:leading'] = {
        followers: [scenario.actor.id],
      };

      const room = ModEntityScenarios.createRoom('throne_room', 'Throne Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        originalInput: 'stop following',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
        perceptionType: 'state.observable_change',
      });
    });

    it('includes actor ID in perceptible event (self-action pattern)', async () => {
      const scenario = testFixture.createCloseActors(['Scout', 'Commander'], {
        location: 'camp',
      });

      scenario.actor.components['companionship:following'] = {
        leaderId: scenario.target.id,
      };
      scenario.target.components['companionship:leading'] = {
        followers: [scenario.actor.id],
      };

      const room = ModEntityScenarios.createRoom('camp', 'Camp');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: ACTION_ID,
        originalInput: 'stop following',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
        actorId: scenario.actor.id,
        perceptionType: 'state.observable_change',
      });
    });
  });
});
