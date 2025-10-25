/**
 * @file Integration tests for vampirism:bite_neck_carefully action and rule
 * @description Validates component addition, event generation, and messaging for the bite neck carefully action
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import biteNeckCarefullyRule from '../../../../data/mods/vampirism/rules/handle_bite_neck_carefully.rule.json';
import eventIsActionBiteNeckCarefully from '../../../../data/mods/vampirism/conditions/event-is-action-bite-neck-carefully.condition.json';

const ACTION_ID = 'vampirism:bite_neck_carefully';
const EXPECTED_MESSAGE_TEMPLATE =
  "{actor} sinks their fangs in {target}'s neck carefully.";

describe('vampirism:bite_neck_carefully - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      ACTION_ID,
      biteNeckCarefullyRule,
      eventIsActionBiteNeckCarefully
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Addition', () => {
    it('adds biting_neck component to vampire actor with correct target reference', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Jonathan'], {
        location: 'castle_hall',
      });

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

    it('adds being_bitten_in_neck component to target with correct vampire biter reference', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Mina'], {
        location: 'bedroom',
      });

      // Add vampire marker to actor
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

    it('adds both components in single vampire action execution', async () => {
      const scenario = testFixture.createCloseActors(['Nosferatu', 'Ellen'], {
        location: 'ship_cabin',
      });

      // Add vampire marker to actor
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
      expect(targetInstance).toHaveComponent('positioning:being_bitten_in_neck');
    });

    it('rejects the action when actor is not a vampire', async () => {
      const scenario = testFixture.createCloseActors(['Human', 'Mortal'], {
        location: 'village',
      });

      // Actor has closeness but NOT vampirism:is_vampire
      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/required component/i);
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message for vampire', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Victim'], {
        location: 'crypt',
      });

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Vampire'
      ).replace('{target}', 'Victim');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'crypt',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates matching success action message for vampire', async () => {
      const scenario = testFixture.createCloseActors(['Alucard', 'Seras'], {
        location: 'underground_chamber',
      });

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Alucard'
      ).replace('{target}', 'Seras');

      testFixture.assertActionSuccess(expectedMessage);
    });

    it('includes correct event metadata for vampire bite', async () => {
      const scenario = testFixture.createCloseActors(['Lestat', 'Louis'], {
        location: 'theatre',
      });

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Lestat'
      ).replace('{target}', 'Louis');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'theatre',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates consistent perceptible and success messages for vampire', async () => {
      const scenario = testFixture.createCloseActors(['Count', 'Victim'], {
        location: 'tower',
      });

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        '{actor}',
        'Count'
      ).replace('{target}', 'Victim');

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        perceptionType: 'action_target_general',
        locationId: 'tower',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });

  describe('Turn Management', () => {
    it('ends turn with success status for vampire bite', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Human'], {
        location: 'dungeon',
      });

      // Add vampire marker to actor
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
        { actor: 'Count Orlok', target: 'Ellen Hutter', location: 'ship' },
        { actor: 'Carmilla', target: 'Laura', location: 'castle' },
        { actor: 'Varney', target: 'Flora', location: 'manor' },
      ];

      for (const { actor, target, location } of scenarios) {
        const scenario = testFixture.createCloseActors([actor, target], {
          location,
        });

        // Add vampire marker to actor
        scenario.actor.components['vampirism:is_vampire'] = {};
        testFixture.reset([scenario.room, scenario.actor, scenario.target]);

        await testFixture.executeAction(scenario.actor.id, scenario.target.id);

        const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
          '{actor}',
          actor
        ).replace('{target}', target);

        testFixture.assertActionSuccess(expectedMessage);

        // Reset for next iteration
        testFixture.clearEvents();
      }
    });

    it('maintains component integrity across multiple vampire executions', async () => {
      const scenario1 = testFixture.createCloseActors(['V1', 'T1'], {
        location: 'loc1',
      });

      // Add vampire marker to actor
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
