/**
 * @file Integration tests for vampirism:lunge_bite_neck_violently action and rule
 * @description Validates component addition, event generation, and messaging for the violent lunge bite action
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import lungeBiteNeckViolentlyRule from '../../../../data/mods/vampirism/rules/handle_lunge_bite_neck_violently.rule.json';
import eventIsActionLungeBiteNeckViolently from '../../../../data/mods/vampirism/conditions/event-is-action-lunge-bite-neck-violently.condition.json';

const ACTION_ID = 'vampirism:lunge_bite_neck_violently';
const EXPECTED_MESSAGE_TEMPLATE =
  "{actor} lunges at {target} and sinks their teeth on {target}'s neck predatorily.";

describe('vampirism:lunge_bite_neck_violently - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      ACTION_ID,
      lungeBiteNeckViolentlyRule,
      eventIsActionLungeBiteNeckViolently
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Addition', () => {
    it('adds biting_neck component to vampire actor with correct target reference', async () => {
      const scenario = testFixture.createCloseActors(['Nosferatu', 'Ellen'], {
        location: 'ship_deck',
      });

      // Remove closeness for distance attack (lunge doesn't require it)
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );

      expect(actorInstance).toHaveComponentData('positioning:biting_neck', {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      });
    });

    it('adds being_bitten_in_neck component to target with correct vampire reference', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Victim'], {
        location: 'dark_alley',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(targetInstance).toHaveComponentData(
        'positioning:being_bitten_in_neck',
        {
          biting_entity_id: scenario.actor.id,
        }
      );
    });

    it('adds both components in single predatory attack execution', async () => {
      const scenario = testFixture.createCloseActors(['Predator', 'Prey'], {
        location: 'forest_clearing',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(actorInstance).toHaveComponent('positioning:biting_neck');
      expect(targetInstance).toHaveComponent(
        'positioning:being_bitten_in_neck'
      );
    });

    it('rejects the action when actor is not a vampire', async () => {
      const scenario = testFixture.createCloseActors(['Human', 'Mortal'], {
        location: 'village_square',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/required component/i);
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message with predatory language', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Jonathan'], {
        location: 'castle_hall',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Dracula'
      ).replace(/{target}/g, 'Jonathan');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'castle_hall',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates matching success action message with predatory language', async () => {
      const scenario = testFixture.createCloseActors(['Lestat', 'Louis'], {
        location: 'theatre_box',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Lestat'
      ).replace(/{target}/g, 'Louis');

      testFixture.assertActionSuccess(expectedMessage);
    });

    it('includes correct event metadata for predatory bite', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Mortal'], {
        location: 'crypt',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Vampire'
      ).replace(/{target}/g, 'Mortal');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'crypt',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates consistent perceptible and success messages for violent attack', async () => {
      const scenario = testFixture.createCloseActors(['Predator', 'Victim'], {
        location: 'abandoned_warehouse',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Predator'
      ).replace(/{target}/g, 'Victim');

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        perceptionType: 'action_target_general',
        locationId: 'abandoned_warehouse',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });

  describe('Turn Management', () => {
    it('ends turn with success status for violent vampire attack', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Human'], {
        location: 'dungeon',
      });

      // Remove closeness for distance attack
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });

  describe('Multiple Execution Scenarios', () => {
    it('handles different vampire actor and target names correctly', async () => {
      const scenarios = [
        { actors: ['Count Orlok', 'Ellen'], location: 'ship_hold' },
        { actors: ['Carmilla', 'Laura'], location: 'castle_tower' },
        { actors: ['Varney', 'Flora'], location: 'manor_hallway' },
      ];

      for (const { actors, location } of scenarios) {
        const scenario = testFixture.createCloseActors(actors, {
          location,
        });

        // Remove closeness for distance attack
        delete scenario.actor.components['positioning:closeness'];
        delete scenario.target.components['positioning:closeness'];

        scenario.actor.components['vampirism:is_vampire'] = {};
        testFixture.reset([scenario.room, scenario.actor, scenario.target]);

        await testFixture.executeAction(scenario.actor.id, scenario.target.id);

        const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
          '{actor}',
          actors[0]
        ).replace(/{target}/g, actors[1]);

        testFixture.assertActionSuccess(expectedMessage);

        testFixture.clearEvents();
      }
    });

    it('maintains component integrity across multiple predatory executions', async () => {
      const scenario1 = testFixture.createCloseActors(['V1', 'T1'], {
        location: 'loc1',
      });

      // Remove closeness for distance attack
      delete scenario1.actor.components['positioning:closeness'];
      delete scenario1.target.components['positioning:closeness'];

      scenario1.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario1.room, scenario1.actor, scenario1.target]);

      await testFixture.executeAction(scenario1.actor.id, scenario1.target.id);

      const actor1 = testFixture.entityManager.getEntityInstance(
        scenario1.actor.id
      );
      const target1 = testFixture.entityManager.getEntityInstance(
        scenario1.target.id
      );

      expect(actor1).toHaveComponentData('positioning:biting_neck', {
        bitten_entity_id: scenario1.target.id,
        initiated: true,
      });
      expect(target1).toHaveComponentData('positioning:being_bitten_in_neck', {
        biting_entity_id: scenario1.actor.id,
      });
    });
  });

  describe('Rule Isolation', () => {
    it('does not fire for different actions', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Mortal'], {
        location: 'cemetery',
      });

      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });
});
