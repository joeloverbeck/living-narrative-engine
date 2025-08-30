/**
 * @file Integration tests for the exercise:handle_show_off_biceps rule.
 * @description Tests the rule structure, condition logic, and action definitions.
 */

import { describe, it, expect } from '@jest/globals';
import showOffBicepsRule from '../../../../../data/mods/exercise/rules/handle_show_off_biceps.rule.json';
import showOffBicepsCondition from '../../../../../data/mods/exercise/conditions/event-is-action-show-off-biceps.condition.json';
import logSuccessAndEndTurnMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';

describe('Exercise Mod: Show Off Biceps Rule', () => {
  describe('Rule Structure', () => {
    it('should have proper rule identification', () => {
      // Assert: Rule should have correct identifiers
      expect(showOffBicepsRule.rule_id).toBe('handle_show_off_biceps');
      expect(showOffBicepsRule.comment).toBe(
        "Handles the 'exercise:show_off_biceps' action. Dispatches descriptive text and ends the turn."
      );
    });

    it('should only process core:attempt_action events', () => {
      // Assert: Rule should specify correct event type
      expect(showOffBicepsRule.event_type).toBe('core:attempt_action');
    });

    it('should use condition reference', () => {
      // Assert: Rule should use condition_ref instead of inline logic
      expect(showOffBicepsRule.condition.condition_ref).toBe(
        'exercise:event-is-action-show-off-biceps'
      );
      expect(showOffBicepsRule.condition.logic).toBeUndefined();
    });

    it('should have proper schema reference', () => {
      // Assert: Should reference the correct schema
      expect(showOffBicepsRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });
  });

  describe('Action Definitions', () => {
    it('should have exactly seven actions', () => {
      // Assert: Should have GET_NAME, QUERY_COMPONENT, SET_VARIABLE operations plus macro
      expect(showOffBicepsRule.actions).toHaveLength(7);
    });

    it('should get actor name', () => {
      // Assert: First action should get actor name
      const firstAction = showOffBicepsRule.actions[0];
      expect(firstAction.type).toBe('GET_NAME');
      expect(firstAction.parameters.entity_ref).toBe('actor');
      expect(firstAction.parameters.result_variable).toBe('actorName');
    });

    it('should query actor position', () => {
      // Assert: Second action should query actor position
      const secondAction = showOffBicepsRule.actions[1];
      expect(secondAction.type).toBe('QUERY_COMPONENT');
      expect(secondAction.parameters.entity_ref).toBe('actor');
      expect(secondAction.parameters.component_type).toBe('core:position');
      expect(secondAction.parameters.result_variable).toBe('actorPosition');
    });

    it('should set logMessage variable', () => {
      // Assert: Third action should set log message
      const thirdAction = showOffBicepsRule.actions[2];
      expect(thirdAction.type).toBe('SET_VARIABLE');
      expect(thirdAction.parameters.variable_name).toBe('logMessage');
      expect(thirdAction.parameters.value).toBe(
        '{context.actorName} flexes their arms, showing off the bulging biceps and triceps.'
      );
    });

    it('should set perceptionType variable', () => {
      // Assert: Fourth action should set perception type
      const fourthAction = showOffBicepsRule.actions[3];
      expect(fourthAction.type).toBe('SET_VARIABLE');
      expect(fourthAction.parameters.variable_name).toBe('perceptionType');
      expect(fourthAction.parameters.value).toBe('action_self_general');
    });

    it('should set locationId variable', () => {
      // Assert: Fifth action should set location ID
      const fifthAction = showOffBicepsRule.actions[4];
      expect(fifthAction.type).toBe('SET_VARIABLE');
      expect(fifthAction.parameters.variable_name).toBe('locationId');
      expect(fifthAction.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('should set targetId variable to null for no-target action', () => {
      // Assert: Sixth action should set targetId to null
      const sixthAction = showOffBicepsRule.actions[5];
      expect(sixthAction.type).toBe('SET_VARIABLE');
      expect(sixthAction.parameters.variable_name).toBe('targetId');
      expect(sixthAction.parameters.value).toBeNull();
    });

    it('should use core:logSuccessAndEndTurn macro', () => {
      // Assert: Seventh action should call the correct macro
      const macroAction = showOffBicepsRule.actions[6];
      expect(macroAction.macro).toBe('core:logSuccessAndEndTurn');
    });
  });

  describe('Message Template Validation', () => {
    it('should include actor placeholder in messages', () => {
      // Assert: Messages should contain {context.actorName} placeholder
      const message = showOffBicepsRule.actions[2].parameters.value;
      expect(message).toContain('{context.actorName}');
      expect(message).toMatch(/^\{context\.actorName\}/); // Should start with actor placeholder
    });

    it('should describe biceps flexing action', () => {
      // Assert: Message should describe the action accurately
      const message = showOffBicepsRule.actions[2].parameters.value;
      expect(message.toLowerCase()).toContain('flex');
      expect(message.toLowerCase()).toContain('arms');
      expect(message.toLowerCase()).toContain('biceps');
      expect(message.toLowerCase()).toContain('triceps');
    });

    it('should use present tense for action description', () => {
      // Assert: Message should use appropriate tense
      const message = showOffBicepsRule.actions[2].parameters.value;
      expect(message).toContain('flexes'); // Present tense
      expect(message).toContain('showing off'); // Present continuous
    });
  });

  describe('Macro Integration', () => {
    it('should ensure perceptible event is dispatched correctly', () => {
      // Create a proper macro registry
      const macroRegistry = {
        get: (type, id) => {
          if (type === 'macros' && id === 'core:logSuccessAndEndTurn') {
            return logSuccessAndEndTurnMacro;
          }
          return undefined;
        },
      };

      // Act: Expand the macro
      const expandedActions = expandMacros(
        showOffBicepsRule.actions,
        macroRegistry
      );

      // Find the perceptible event dispatch
      const perceptibleEventDispatch = expandedActions.find(
        (action) =>
          action.type === 'DISPATCH_EVENT' &&
          action.parameters?.eventType === 'core:perceptible_event'
      );

      // Assert: Perceptible event should be dispatched with correct payload
      expect(perceptibleEventDispatch).toBeDefined();
      expect(perceptibleEventDispatch.parameters.payload).toBeDefined();

      const payload = perceptibleEventDispatch.parameters.payload;
      expect(payload.eventName).toBe('core:perceptible_event');
      expect(payload.locationId).toBe('{context.locationId}');
      expect(payload.descriptionText).toBe('{context.logMessage}');
      expect(payload.perceptionType).toBe('{context.perceptionType}');
      expect(payload.actorId).toBe('{event.payload.actorId}');
      expect(payload.targetId).toBe('{context.targetId}');
      expect(payload.involvedEntities).toEqual([]);
    });

    it('should properly expand logSuccessAndEndTurn macro', () => {
      // Create a proper macro registry
      const macroRegistry = {
        get: (type, id) => {
          if (type === 'macros' && id === 'core:logSuccessAndEndTurn') {
            return logSuccessAndEndTurnMacro;
          }
          return undefined;
        },
      };

      // Act: Expand the macro using correct format
      const expandedActions = expandMacros(
        showOffBicepsRule.actions,
        macroRegistry
      );

      // Assert: Check expanded actions include event dispatch and end turn
      expect(expandedActions).toBeDefined();
      expect(Array.isArray(expandedActions)).toBe(true);
      expect(expandedActions.length).toBeGreaterThan(5);

      // Should contain dispatch event for perceptible log
      const dispatchEvents = expandedActions.filter(
        (action) => action.type === 'DISPATCH_EVENT'
      );
      expect(dispatchEvents.length).toBeGreaterThan(0);

      // Should contain end turn operation
      const endTurnActions = expandedActions.filter(
        (action) => action.type === 'END_TURN'
      );
      expect(endTurnActions.length).toBe(1);
      expect(endTurnActions[0].parameters.success).toBe(true);
    });

    it('should maintain setVariable operations after macro expansion', () => {
      // Create a proper macro registry
      const macroRegistry = {
        get: (type, id) => {
          if (type === 'macros' && id === 'core:logSuccessAndEndTurn') {
            return logSuccessAndEndTurnMacro;
          }
          return undefined;
        },
      };

      // Act: Expand the macro
      const expandedActions = expandMacros(
        showOffBicepsRule.actions,
        macroRegistry
      );

      // Assert: Original SET_VARIABLE operations should remain
      const setVariableOps = expandedActions.filter(
        (action) => action.type === 'SET_VARIABLE'
      );

      expect(setVariableOps.length).toBeGreaterThanOrEqual(4);

      // Check that necessary variables are still set
      const variableNames = setVariableOps.map(
        (op) => op.parameters.variable_name
      );
      expect(variableNames).toContain('logMessage');
      expect(variableNames).toContain('perceptionType');
      expect(variableNames).toContain('locationId');
      expect(variableNames).toContain('targetId');
    });
  });

  describe('Condition Logic Validation', () => {
    it('should correctly identify show_off_biceps action via condition', () => {
      // Verify the condition reference is correct
      expect(showOffBicepsRule.condition.condition_ref).toBe(
        'exercise:event-is-action-show-off-biceps'
      );

      // Verify the condition file has correct logic
      expect(showOffBicepsCondition.logic).toBeDefined();
      expect(showOffBicepsCondition.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        'exercise:show_off_biceps',
      ]);
    });

    it('should test the condition logic correctly', () => {
      // Arrange: Create test event for show_off_biceps
      const showOffBicepsEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'exercise:show_off_biceps',
        },
      };

      // Simple logic evaluation - checks the condition structure
      const expectedActionId = showOffBicepsCondition.logic['=='][1]; // Second part of equality check
      const actualActionId = showOffBicepsEvent.payload.actionId;

      // Assert
      expect(expectedActionId).toBe('exercise:show_off_biceps');
      expect(actualActionId).toBe(expectedActionId);
    });

    it('should not match different actions', () => {
      // Arrange: Create test event for different action
      const differentEvent = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'core:wait',
        },
      };

      // Simple logic evaluation
      const expectedActionId = showOffBicepsCondition.logic['=='][1]; // Second part of equality check
      const actualActionId = differentEvent.payload.actionId;

      // Assert
      expect(actualActionId).not.toBe(expectedActionId);
      expect(actualActionId).toBe('core:wait');
      expect(expectedActionId).toBe('exercise:show_off_biceps');
    });
  });
});
