/**
 * @file Integration tests for the violence:sucker_punch action using new mod test infrastructure.
 * @description Tests the action execution and rule integration patterns.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import suckerPunchRule from '../../../../data/mods/violence/rules/handle_sucker_punch.rule.json';
import eventIsActionSuckerPunch from '../../../../data/mods/violence/conditions/event-is-action-sucker-punch.condition.json';

describe('Violence Mod: Sucker Punch Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with explicit rule and condition files
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:sucker_punch',
      suckerPunchRule,
      eventIsActionSuckerPunch
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('performs sucker punch action successfully', async () => {
      // Create actor and target entities
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Execute the action
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess('Alice sucker-punches Beth in the head.');
    });

    it('rejects the action when the actor is hugging someone', async () => {
      const scenario = testFixture.createStandardActorTarget(
        ['Owen', 'Priya'],
        {
          includeRoom: false,
        }
      );

      scenario.actor.components['hugging-states:hugging'] = {
        embraced_entity_id: scenario.target.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/forbidden component/i);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorInstance.components['hugging-states:hugging']).toEqual({
        embraced_entity_id: scenario.target.id,
        initiated: true,
      });
    });

    it('rejects the action when the actor is sitting', async () => {
      const scenario = testFixture.createStandardActorTarget(
        ['Sam', 'Taylor'],
        {
          includeRoom: false,
        }
      );

      scenario.actor.components['positioning:sitting_on'] = {
        furniture_id: 'test:couch',
        spot_index: 0,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/forbidden component/i);
    });

    it('does not fire rule for different action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Try with different action
      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      // Should not have any perceptible events from our rule
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });

    it('handles missing target gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Pre-flight validation now catches missing entities before rule execution
      // This validates that the validation system properly detects missing targets
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'nonexistent');
      }).rejects.toThrow(ActionValidationError);
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Alice sucker-punches Beth in the head.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
    });

    it('works with different actor and target names', async () => {
      const scenario = testFixture.createStandardActorTarget(['John', 'Mary']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'John sucker-punches Mary in the head.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
    });
  });

  describe('Message Validation', () => {
    it('generates correct perceptible log message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify both the perceptible event and success message are correct
      testFixture.assertActionSuccess('Alice sucker-punches Bob in the head.');
      testFixture.assertPerceptibleEvent({
        descriptionText: 'Alice sucker-punches Bob in the head.',
        perceptionType: 'physical.target_action',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });
});
