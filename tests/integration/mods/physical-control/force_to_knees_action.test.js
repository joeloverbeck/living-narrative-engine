/**
 * @file Integration tests for the physical-control:force_to_knees action and rule.
 * @description Verifies that the force to knees action executes correctly, updates components, and emits the proper events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import forceToKneesRule from '../../../../data/mods/physical-control/rules/handle_force_to_knees.rule.json';
import eventIsActionForceToKnees from '../../../../data/mods/physical-control/conditions/event-is-action-force-to-knees.condition.json';

const ACTION_ID = 'physical-control:force_to_knees';

const EXPECTED_MESSAGE = '{actor} roughly forces {target} to their knees.';

describe('Physical Control Mod: Force to Knees Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      ACTION_ID,
      forceToKneesRule,
      eventIsActionForceToKnees
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const buildMessage = (actorName, targetName) =>
    EXPECTED_MESSAGE.replaceAll('{actor}', actorName).replace(
      '{target}',
      targetName
    );

  describe('Action Execution', () => {
    it('performs force to knees action successfully', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(buildMessage('Alice', 'Beth'));
    });

    it('does not fire rule for different action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });

    it('handles missing target gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'missing-target');
      }).rejects.toThrow(ActionValidationError);
    });

    it('rejects when actor is straddling the target', async () => {
      const scenario = testFixture.createCloseActors(['Uma', 'Vera']);

      await testFixture.entityManager.addComponent(
        scenario.actor.id,
        'positioning:straddling_waist',
        {
          target_id: scenario.target.id,
          facing_away: false,
        }
      );

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(/forbidden component.*positioning:straddling_waist/i);
    });
  });

  describe('Component State Changes', () => {
    it('adds kneeling component to the target with the actor id and locks movement', async () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);
      delete scenario.target.components['sitting-states:sitting_on'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      ModAssertionHelpers.assertComponentAdded(
        testFixture.entityManager,
        scenario.target.id,
        'positioning:kneeling_before',
        { entityId: scenario.actor.id }
      );

      const targetMovement = testFixture.entityManager.getComponentData(
        scenario.target.id,
        'core:movement'
      );
      expect(targetMovement).toBeDefined();
      expect(targetMovement.locked).toBe(true);

      const actorMovement = testFixture.entityManager.getComponentData(
        scenario.actor.id,
        'core:movement'
      );
      expect(actorMovement).toBeFalsy();

      const targetAfter = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );

      expect(
        actorAfter.components['positioning:kneeling_before']
      ).toBeUndefined();
      expect(actorAfter.components['personal-space-states:closeness'].partners).toEqual([
        scenario.target.id,
      ]);
      expect(targetAfter.components['personal-space-states:closeness'].partners).toEqual([
        scenario.actor.id,
      ]);
      expect(targetAfter.components['sitting-states:sitting_on']).toBeUndefined();
    });

    it('prevents repeated forcing while the target remains kneeling', async () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Leo']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(ActionValidationError);
    });

    it('supports namespaced entity identifiers', async () => {
      const room = new ModEntityBuilder('world:atrium')
        .asRoom('Observation Atrium')
        .build();
      const actor = new ModEntityBuilder('p_erotica:actor_instance')
        .withName('Zara')
        .atLocation('world:atrium')
        .withLocationComponent('world:atrium')
        .closeToEntity('p_erotica:target_instance')
        .asActor()
        .build();
      const target = new ModEntityBuilder('p_erotica:target_instance')
        .withName('Yann')
        .atLocation('world:atrium')
        .withLocationComponent('world:atrium')
        .closeToEntity('p_erotica:actor_instance')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction(actor.id, target.id);

      ModAssertionHelpers.assertComponentAdded(
        testFixture.entityManager,
        target.id,
        'positioning:kneeling_before',
        { entityId: actor.id }
      );

      testFixture.assertActionSuccess(buildMessage('Zara', 'Yann'));
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message with context', async () => {
      const scenario = testFixture.createCloseActors(['Lena', 'Mark']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: buildMessage('Lena', 'Mark'),
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
    });

    it('works with different actor and target names', async () => {
      const scenario = testFixture.createCloseActors(['Nora', 'Owen']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: buildMessage('Nora', 'Owen'),
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
    });
  });

  describe('Message Validation', () => {
    it('produces identical success and perceptible messages', async () => {
      const scenario = testFixture.createCloseActors(['Quinn', 'Rhea']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = buildMessage('Quinn', 'Rhea');
      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
    });
  });
});
