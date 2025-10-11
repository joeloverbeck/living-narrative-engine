/**
 * @file Integration tests for the violence:grab_neck action using new mod test infrastructure.
 * @description Tests the action execution and rule integration patterns.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import grabNeckRule from '../../../../data/mods/violence/rules/handle_grab_neck.rule.json';
import eventIsActionGrabNeck from '../../../../data/mods/violence/conditions/event-is-action-grab-neck.condition.json';

describe('Violence Mod: Grab Neck Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with explicit rule and condition files
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:grab_neck',
      grabNeckRule,
      eventIsActionGrabNeck
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('performs grab neck action successfully', async () => {
      // Create actor and target entities
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Execute the action
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess("Alice grabs Beth's neck.");
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
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'nonexistent');
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
        descriptionText: "Alice grabs Beth's neck.",
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('works with different actor and target names', async () => {
      const scenario = testFixture.createStandardActorTarget(['John', 'Mary']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: "John grabs Mary's neck.",
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });
  });

  describe('Message Validation', () => {
    it('generates correct perceptible log message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify both the perceptible event and success message are correct
      testFixture.assertActionSuccess("Alice grabs Bob's neck.");
      testFixture.assertPerceptibleEvent({
        descriptionText: "Alice grabs Bob's neck.",
        perceptionType: 'action_target_general',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });
});
