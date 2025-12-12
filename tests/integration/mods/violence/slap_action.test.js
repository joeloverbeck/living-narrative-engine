/**
 * @file Integration tests for the violence:slap action using new mod test infrastructure.
 * @description Tests the action execution and rule integration patterns.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import slapRule from '../../../../data/mods/violence/rules/handle_slap.rule.json';
import eventIsActionSlap from '../../../../data/mods/violence/conditions/event-is-action-slap.condition.json';

describe('Violence Mod: Slap Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with explicit rule and condition files
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:slap',
      slapRule,
      eventIsActionSlap
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('performs slap action successfully', async () => {
      // Create actor and target entities
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Execute the action
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess('Alice slaps Beth across the face.');
    });

    it('rejects the action when the actor is hugging someone', async () => {
      const scenario = testFixture.createStandardActorTarget(
        ['Maya', 'Nolan'],
        {
          includeRoom: false,
        }
      );

      scenario.actor.components['positioning:hugging'] = {
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
      expect(actorInstance.components['positioning:hugging']).toEqual({
        embraced_entity_id: scenario.target.id,
        initiated: true,
      });
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

      // This test verifies the rule handles missing entities gracefully
      // The action prerequisites would normally prevent this, but we test rule robustness
      // Skip validation to test the rule's error handling directly
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'nonexistent', {
          skipValidation: true,
        });
      }).not.toThrow();

      // Should not generate successful action events with missing target
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Alice slaps Beth across the face.',
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
        descriptionText: 'John slaps Mary across the face.',
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
      testFixture.assertActionSuccess('Alice slaps Bob across the face.');
      testFixture.assertPerceptibleEvent({
        descriptionText: 'Alice slaps Bob across the face.',
        perceptionType: 'physical.target_action',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });
});
