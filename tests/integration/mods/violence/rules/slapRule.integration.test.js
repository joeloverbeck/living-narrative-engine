/**
 * @file Integration tests for the violence:slap rule using new mod test infrastructure.
 * @description Tests the rule structure, condition logic, and action definitions.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import slapRule from '../../../../../data/mods/violence/rules/handle_slap.rule.json';
import eventIsActionSlap from '../../../../../data/mods/violence/conditions/event-is-action-slap.condition.json';

describe('Violence Mod: Slap Rule', () => {
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

  describe('Rule Execution', () => {
    it('successfully executes slap action', async () => {
      // Create actor and target entities
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Execute the action
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess('Alice slaps Beth across the face.');
    });

    it('creates correct perceptible event for slap action', async () => {
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

    it('only fires for correct action ID', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Try with different action
      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        targetId: scenario.target.id,
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      // Should not have any perceptible events from our rule
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });

  describe('Rule Structure Validation', () => {
    it('should have proper rule identification', () => {
      expect(testFixture.ruleFile.rule_id).toBe('handle_slap');
      expect(testFixture.ruleFile.comment).toBe(
        "Handles the 'violence:slap' action. Dispatches descriptive text and ends the turn."
      );
    });

    it('should have correct condition structure', () => {
      expect(testFixture.conditionFile.id).toBe(
        'violence:event-is-action-slap'
      );
      expect(testFixture.conditionFile.description).toBe(
        "Checks if the triggering event is for the 'violence:slap' action."
      );
      expect(testFixture.conditionFile.logic).toEqual({
        '==': [{ var: 'event.payload.actionId' }, 'violence:slap'],
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing actor gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // This should not throw, but may fail during GET_NAME operation
      // Skip validation to test the rule's error handling directly
      await expect(async () => {
        await testFixture.executeAction('nonexistent', scenario.target.id, {
          skipValidation: true,
        });
      }).not.toThrow();

      // Should not generate successful action events with missing actor
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });

    it('handles missing target gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // This should not throw, but may fail during GET_NAME operation
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

  describe('Rule Action Structure', () => {
    it('should have correct action sequence', () => {
      expect(testFixture.ruleFile.actions).toHaveLength(8);

      // Verify key action types are present
      const actionTypes = testFixture.ruleFile.actions.map(
        (action) => action.type
      );
      expect(actionTypes).toContain('GET_NAME'); // Get actor name
      expect(actionTypes).toContain('QUERY_COMPONENT'); // Get actor position
      expect(actionTypes).toContain('SET_VARIABLE'); // Set message variables

      // Check that the last action is the macro expansion
      const lastAction = testFixture.ruleFile.actions[7];
      expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
    });
  });
});
