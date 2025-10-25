/**
 * @file Integration tests for vampirism:drink_blood action and rule
 * @description Validates that the drink_blood action preserves bite components and generates appropriate messaging
 */

/* eslint-disable jest/expect-expect */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import drinkBloodRule from '../../../../data/mods/vampirism/rules/handle_drink_blood.rule.json';
import eventIsActionDrinkBlood from '../../../../data/mods/vampirism/conditions/event-is-action-drink-blood.condition.json';

const ACTION_ID = 'vampirism:drink_blood';
const EXPECTED_MESSAGE_TEMPLATE =
  '{actor} drinks {target}\'s blood through the wound in {target}\'s neck.';

describe('vampirism:drink_blood - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      ACTION_ID,
      drinkBloodRule,
      eventIsActionDrinkBlood
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Component Preservation', () => {
    it('preserves biting_neck component on vampire actor', async () => {
      const scenario = testFixture.createCloseActors(['Dracula', 'Lucy'], {
        location: 'crypt',
      });

      // Establish bite relationship
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

      expect(actorInstance).toHaveComponentData('positioning:biting_neck', {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      });
    });

    it('preserves being_bitten_in_neck component on target', async () => {
      const scenario = testFixture.createCloseActors(['Lestat', 'Louis'], {
        location: 'theatre',
      });

      // Establish bite relationship
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

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

    it('preserves both bite components after drinking blood', async () => {
      const scenario = testFixture.createCloseActors(['Vampire', 'Victim'], {
        location: 'castle',
      });

      // Establish bite relationship
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

      expect(actorInstance).toHaveComponent('positioning:biting_neck');
      expect(targetInstance).toHaveComponent('positioning:being_bitten_in_neck');
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createCloseActors(['Nosferatu', 'Ellen'], {
        location: 'ship_cabin',
      });

      // Establish bite relationship
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
        'Nosferatu'
      ).replace(/{target}/g, 'Ellen');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'ship_cabin',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates matching success action message', async () => {
      const scenario = testFixture.createCloseActors(['Alucard', 'Seras'], {
        location: 'underground',
      });

      // Establish bite relationship
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
        'Alucard'
      ).replace(/{target}/g, 'Seras');

      testFixture.assertActionSuccess(expectedMessage);
    });

    it('includes correct event metadata', async () => {
      const scenario = testFixture.createCloseActors(['Carmilla', 'Laura'], {
        location: 'manor',
      });

      // Establish bite relationship
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
        'Carmilla'
      ).replace(/{target}/g, 'Laura');

      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'manor',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('generates consistent perceptible and success messages', async () => {
      const scenario = testFixture.createCloseActors(['Count', 'Mina'], {
        location: 'bedroom',
      });

      // Establish bite relationship
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
        'Count'
      ).replace(/{target}/g, 'Mina');

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        perceptionType: 'action_target_general',
        locationId: 'bedroom',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });

  describe('Bite Relationship Validation', () => {
    it('validates reciprocal component IDs match', async () => {
      const scenario = testFixture.createCloseActors(['Vlad', 'Jonathan'], {
        location: 'castle_hall',
      });

      // Establish bite relationship with matching IDs
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Should succeed and generate events
      const expectedMessage = EXPECTED_MESSAGE_TEMPLATE.replace(
        /{actor}/g,
        'Vlad'
      ).replace(/{target}/g, 'Jonathan');

      testFixture.assertActionSuccess(expectedMessage);
    });
  });
});
