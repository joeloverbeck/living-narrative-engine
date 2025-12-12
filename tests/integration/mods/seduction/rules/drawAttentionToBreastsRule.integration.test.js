/**
 * @file Integration tests for the seduction:handle_draw_attention_to_breasts rule using mod test infrastructure.
 * @description Tests the rule structure, condition logic, and action execution.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';

describe('Seduction Mod: Draw Attention to Breasts Rule', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loading of rule and condition files
    testFixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:draw_attention_to_breasts'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Rule Execution', () => {
    it('successfully executes draw attention to breasts action', async () => {
      // Create an actor (no target needed for self-targeting action)
      const scenario = testFixture.createStandardActorTarget(['Sarah', 'John']);

      // Execute the self-targeting action
      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess(
        'Sarah angles to flatter her bustline, drawing attention to her breasts.'
      );
    });

    it('creates correct perceptible event for draw attention action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Lisa', 'Mike']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          'Lisa angles to flatter her bustline, drawing attention to her breasts.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: null,
        perceptionType: 'physical.self_action',
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
      expect(testFixture.ruleFile.rule_id).toBe(
        'handle_draw_attention_to_breasts'
      );
      expect(testFixture.ruleFile.comment).toBe(
        "Handles the 'seduction:draw_attention_to_breasts' action. Generates descriptive text mentioning the actor's topmost clothing item in the upper torso area."
      );
    });

    it('should only process core:attempt_action events', () => {
      expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    });

    it('should use condition reference', () => {
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'seduction:event-is-action-draw-attention-to-breasts'
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
        '{context.actorName} angles to flatter her bustline, drawing attention to her breasts.'
      );

      // Check perceptionType variable
      const perceptionTypeAction = actions[3];
      expect(perceptionTypeAction.type).toBe('SET_VARIABLE');
      expect(perceptionTypeAction.parameters.variable_name).toBe(
        'perceptionType'
      );
      expect(perceptionTypeAction.parameters.value).toBe('physical.self_action');

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

    it('should describe breast attention action', () => {
      const message = testFixture.ruleFile.actions[2].parameters.value;
      expect(message.toLowerCase()).toContain('angles');
      expect(message.toLowerCase()).toContain('flatter');
      expect(message.toLowerCase()).toContain('bustline');
      expect(message.toLowerCase()).toContain('drawing attention');
      expect(message.toLowerCase()).toContain('breasts');
    });

    it('should use present tense for action description', () => {
      const message = testFixture.ruleFile.actions[2].parameters.value;
      expect(message).toContain('angles');
      expect(message).toContain('drawing');
    });

    it('should be appropriately descriptive', () => {
      const message = testFixture.ruleFile.actions[2].parameters.value;
      // Message should be detailed but tasteful
      expect(message.length).toBeGreaterThan(40);
      expect(message).toMatch(/^{context\.actorName} .+\.$/); // Proper sentence structure
    });
  });

  describe('Condition Logic Validation', () => {
    it('should correctly identify draw_attention_to_breasts action via condition', () => {
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'seduction:event-is-action-draw-attention-to-breasts'
      );

      expect(testFixture.conditionFile.logic).toBeDefined();
      expect(testFixture.conditionFile.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        'seduction:draw_attention_to_breasts',
      ]);
    });

    it('should test the condition logic correctly', () => {
      const drawAttentionEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'seduction:draw_attention_to_breasts',
        },
      };

      const expectedActionId = testFixture.conditionFile.logic['=='][1];
      const actualActionId = drawAttentionEvent.payload.actionId;

      expect(expectedActionId).toBe('seduction:draw_attention_to_breasts');
      expect(actualActionId).toBe(expectedActionId);
    });

    it('should not match different actions', () => {
      const differentEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'kissing:kiss_cheek',
        },
      };

      const expectedActionId = testFixture.conditionFile.logic['=='][1];
      const actualActionId = differentEvent.payload.actionId;

      expect(actualActionId).not.toBe(expectedActionId);
      expect(actualActionId).toBe('kissing:kiss_cheek');
      expect(expectedActionId).toBe('seduction:draw_attention_to_breasts');
    });
  });

  describe('Condition File Validation', () => {
    it('should have proper condition schema and structure', () => {
      expect(testFixture.conditionFile.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
      expect(testFixture.conditionFile.id).toBe(
        'seduction:event-is-action-draw-attention-to-breasts'
      );
      expect(testFixture.conditionFile.description).toBe(
        "Checks if the triggering event is for the 'seduction:draw_attention_to_breasts' action."
      );
    });
  });
});
