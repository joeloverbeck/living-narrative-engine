/**
 * @file Integration tests for vampirism:pull_out_fangs action and rule
 * @description Ensures withdrawing fangs clears reciprocal bite components and produces consistent messaging.
 */

/* eslint-disable jest/expect-expect */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import pullOutFangsRule from '../../../../data/mods/vampirism/rules/handle_pull_out_fangs.rule.json';
import eventIsActionPullOutFangs from '../../../../data/mods/vampirism/conditions/event-is-action-pull-out-fangs.condition.json';

const ACTION_ID = 'vampirism:pull_out_fangs';
const EXPECTED_MESSAGE_TEMPLATE =
  "{actor} pulls out their fangs from {target}'s neck.";

describe('vampirism:pull_out_fangs - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      ACTION_ID,
      pullOutFangsRule,
      eventIsActionPullOutFangs
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Removal', () => {
    it('removes reciprocal neck-biting components when actor withdraws fangs', async () => {
      const scenario = testFixture.createCloseActors(['Selene', 'Michael'], {
        location: 'underworld',
      });

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(actorInstance).toNotHaveComponent('positioning:biting_neck');
      expect(targetInstance).toNotHaveComponent(
        'positioning:being_bitten_in_neck'
      );
    });

    it('preserves unrelated components on both entities', async () => {
      const scenario = testFixture.createCloseActors(['Vlad', 'Mina'], {
        location: 'castle',
      });

      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(actorInstance).toHaveComponent('vampirism:is_vampire');
      expect(targetInstance).toHaveComponent('personal-space-states:closeness');
      expect(
        targetInstance.components['personal-space-states:closeness'].partners
      ).toContain(scenario.actor.id);
    });

    it('does not remove actor biting component when bitten entity does not match target', async () => {
      const scenario = testFixture.createCloseActors(['Lilith', 'Harper'], {
        location: 'loft',
      });

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: 'unrelated-target',
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );

      expect(actorInstance).toHaveComponent('positioning:biting_neck');
      expect(actorInstance).toHaveComponentData('positioning:biting_neck', {
        bitten_entity_id: 'unrelated-target',
        initiated: true,
      });
    });

    it('does not remove target being_bitten component when biting entity does not match actor', async () => {
      const scenario = testFixture.createCloseActors(['Elena', 'Jeremy'], {
        location: 'mystic_falls',
      });

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: 'stranger',
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(targetInstance).toHaveComponent(
        'positioning:being_bitten_in_neck'
      );
      expect(targetInstance).toHaveComponentData(
        'positioning:being_bitten_in_neck',
        { biting_entity_id: 'stranger' }
      );
    });
  });

  describe('Validation', () => {
    it('rejects action when actor has forbidden positioning:being_bitten_in_neck component', async () => {
      const scenario = testFixture.createCloseActors(['Blade', 'Frost'], {
        location: 'club',
      });

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.actor.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: 'hunter',
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/forbidden component/i);
    });
  });

  describe('Event Generation', () => {
    it('emits matching perceptible event and success message', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Lucy'], {
        location: 'crypt',
      });

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        /{actor}/g,
        'Dracula'
      ).replace(/{target}/g, 'Lucy');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'crypt',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
      testFixture.assertActionSuccess(expectedMessage);
    });
  });
});
