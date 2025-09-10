/**
 * @file Integration tests for the exercise:handle_show_off_biceps rule using new mod test infrastructure.
 * @description Tests the rule structure, condition logic, and action definitions.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import showOffBicepsRule from '../../../../../data/mods/exercise/rules/handle_show_off_biceps.rule.json';
import eventIsActionShowOffBiceps from '../../../../../data/mods/exercise/conditions/event-is-action-show-off-biceps.condition.json';

describe('Exercise Mod: Show Off Biceps Rule', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with explicit rule and condition files
    testFixture = await ModTestFixture.forAction(
      'exercise',
      'exercise:show_off_biceps',
      showOffBicepsRule,
      eventIsActionShowOffBiceps
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Rule Execution', () => {
    it('successfully executes show off biceps action', async () => {
      // Create an actor (no target needed for self-targeting action)
      const scenario = testFixture.createStandardActorTarget(['John', 'Sarah']);

      // Execute the self-targeting action
      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess(
        'John flexes their arms, showing off the bulging biceps and triceps.'
      );
    });

    it('creates correct perceptible event for show off action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Mike', 'Lisa']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          'Mike flexes their arms, showing off the bulging biceps and triceps.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: null,
        perceptionType: 'action_self_general',
      });
    });

    it('only fires for correct action ID', async () => {
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
  });

  describe('Rule Structure Validation', () => {
    it('should have proper rule identification', () => {
      expect(testFixture.ruleFile.rule_id).toBe('handle_show_off_biceps');
      expect(testFixture.ruleFile.comment).toBe(
        "Handles the 'exercise:show_off_biceps' action. Dispatches descriptive text and ends the turn."
      );
    });

    it('should only process core:attempt_action events', () => {
      expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    });

    it('should use condition reference', () => {
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'exercise:event-is-action-show-off-biceps'
      );
      expect(testFixture.ruleFile.condition.logic).toBeUndefined();
    });

    it('should have proper schema reference', () => {
      expect(testFixture.ruleFile.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });
  });

  describe('Action Definitions', () => {
    it('should have exactly seven actions', () => {
      expect(testFixture.ruleFile.actions).toHaveLength(7);
    });

    it('should get actor name as first action', () => {
      const firstAction = testFixture.ruleFile.actions[0];
      expect(firstAction.type).toBe('GET_NAME');
      expect(firstAction.parameters.entity_ref).toBe('actor');
      expect(firstAction.parameters.result_variable).toBe('actorName');
    });

    it('should query actor position as second action', () => {
      const secondAction = testFixture.ruleFile.actions[1];
      expect(secondAction.type).toBe('QUERY_COMPONENT');
      expect(secondAction.parameters.entity_ref).toBe('actor');
      expect(secondAction.parameters.component_type).toBe('core:position');
      expect(secondAction.parameters.result_variable).toBe('actorPosition');
    });

    it('should set correct variables for logging', () => {
      const actions = testFixture.ruleFile.actions;

      // Check logMessage variable
      const logMessageAction = actions[2];
      expect(logMessageAction.type).toBe('SET_VARIABLE');
      expect(logMessageAction.parameters.variable_name).toBe('logMessage');
      expect(logMessageAction.parameters.value).toBe(
        '{context.actorName} flexes their arms, showing off the bulging biceps and triceps.'
      );

      // Check perceptionType variable
      const perceptionTypeAction = actions[3];
      expect(perceptionTypeAction.type).toBe('SET_VARIABLE');
      expect(perceptionTypeAction.parameters.variable_name).toBe(
        'perceptionType'
      );
      expect(perceptionTypeAction.parameters.value).toBe('action_self_general');

      // Check locationId variable
      const locationIdAction = actions[4];
      expect(locationIdAction.type).toBe('SET_VARIABLE');
      expect(locationIdAction.parameters.variable_name).toBe('locationId');
      expect(locationIdAction.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );

      // Check targetId variable (should be null for self-targeting action)
      const targetIdAction = actions[5];
      expect(targetIdAction.type).toBe('SET_VARIABLE');
      expect(targetIdAction.parameters.variable_name).toBe('targetId');
      expect(targetIdAction.parameters.value).toBeNull();
    });

    it('should use core:logSuccessAndEndTurn macro', () => {
      const macroAction = testFixture.ruleFile.actions[6];
      expect(macroAction.macro).toBe('core:logSuccessAndEndTurn');
    });
  });

  describe('Message Template Validation', () => {
    it('should include actor placeholder in messages', () => {
      const message = testFixture.ruleFile.actions[2].parameters.value;
      expect(message).toContain('{context.actorName}');
      expect(message).toMatch(/^\{context\.actorName\}/);
    });

    it('should describe biceps flexing action', () => {
      const message = testFixture.ruleFile.actions[2].parameters.value;
      expect(message.toLowerCase()).toContain('flex');
      expect(message.toLowerCase()).toContain('arms');
      expect(message.toLowerCase()).toContain('biceps');
      expect(message.toLowerCase()).toContain('triceps');
    });

    it('should use present tense for action description', () => {
      const message = testFixture.ruleFile.actions[2].parameters.value;
      expect(message).toContain('flexes');
      expect(message).toContain('showing off');
    });
  });

  describe('Condition Logic Validation', () => {
    it('should correctly identify show_off_biceps action via condition', () => {
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'exercise:event-is-action-show-off-biceps'
      );

      expect(testFixture.conditionFile.logic).toBeDefined();
      expect(testFixture.conditionFile.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        'exercise:show_off_biceps',
      ]);
    });

    it('should test the condition logic correctly', () => {
      const showOffBicepsEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'exercise:show_off_biceps',
        },
      };

      const expectedActionId = testFixture.conditionFile.logic['=='][1];
      const actualActionId = showOffBicepsEvent.payload.actionId;

      expect(expectedActionId).toBe('exercise:show_off_biceps');
      expect(actualActionId).toBe(expectedActionId);
    });

    it('should not match different actions', () => {
      const differentEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'core:wait',
        },
      };

      const expectedActionId = testFixture.conditionFile.logic['=='][1];
      const actualActionId = differentEvent.payload.actionId;

      expect(actualActionId).not.toBe(expectedActionId);
      expect(actualActionId).toBe('core:wait');
      expect(expectedActionId).toBe('exercise:show_off_biceps');
    });
  });
});
