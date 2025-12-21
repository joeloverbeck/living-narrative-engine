/**
 * @file Integration tests for saw_through_barred_blocker_stage_two rule structure and outcomes
 */

import { describe, it, expect } from '@jest/globals';

import sawThroughRule from '../../../../data/mods/breaching/rules/handle_saw_through_barred_blocker_stage_two.rule.json' assert { type: 'json' };
import sawThroughAction from '../../../../data/mods/breaching/actions/saw_through_barred_blocker_stage_two.action.json' assert { type: 'json' };
import sawThroughCondition from '../../../../data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker-stage-two.condition.json' assert { type: 'json' };

const CRITICAL_SUCCESS_TEXT =
  "{context.actorName} finds the perfect angle and bites deep into {context.blockerName}' bars with {context.toolName}, sending sparks flying. The opening now will allow passing through.";
const SUCCESS_TEXT =
  "{context.actorName} steadily works the {context.toolName} across {context.blockerName}, clearing the second bar and opening the gap further; it's now close to shoulder-width, but not quite.";
const FAILURE_TEXT =
  '{context.actorName} fights to find purchase on {context.blockerName} with {context.toolName}, but the blade skitters uselessly.';
const FUMBLE_TEXT =
  "As {context.actorName} starts cutting through {context.blockerName}'s second bar, {context.actorName} loses control of {context.toolName}; it clatters to the ground.";

describe('breaching:saw_through_barred_blocker_stage_two rule execution', () => {
  const findIfByOutcome = (ops, outcomeValue) =>
    ops.find(
      (op) =>
        op.type === 'IF' &&
        op.parameters?.condition?.['==']?.[1] === outcomeValue
    );

  const findProgressIf = (ifOp) =>
    ifOp?.parameters?.then_actions?.find((action) => action.type === 'IF');

  const findOutcomeEvent = (ifOp) =>
    ifOp?.parameters?.then_actions?.find(
      (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

  const outcomeHasProgressOps = (ifOp) =>
    ifOp?.parameters?.then_actions?.some(
      (action) =>
        action.type === 'ADD_COMPONENT' ||
        action.type === 'MODIFY_COMPONENT' ||
        action.type === 'IF'
    );

  describe('Rule wiring', () => {
    it('should target core:attempt_action with the correct condition', () => {
      expect(sawThroughRule.rule_id).toBe(
        'handle_saw_through_barred_blocker_stage_two'
      );
      expect(sawThroughRule.event_type).toBe('core:attempt_action');
      expect(sawThroughRule.condition.condition_ref).toBe(
        'breaching:event-is-action-saw-through-barred-blocker-stage-two'
      );
    });

    it('should use RESOLVE_OUTCOME with craft vs structural resistance', () => {
      const resolveOutcome = sawThroughRule.actions.find(
        (action) => action.type === 'RESOLVE_OUTCOME'
      );

      expect(resolveOutcome).toBeDefined();
      expect(resolveOutcome.parameters.actor_skill_component).toBe(
        'skills:craft_skill'
      );
      expect(resolveOutcome.parameters.target_skill_component).toBe(
        'blockers:structural_resistance'
      );
      expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
      expect(resolveOutcome.parameters.target_skill_default).toBe(0);
      expect(resolveOutcome.parameters.formula).toBe('ratio');
      expect(resolveOutcome.parameters.result_variable).toBe('sawingResult');
      expect(resolveOutcome.parameters.target_role).toBe('primary');
    });

    it('should set perceptionType to physical.target_action', () => {
      const perceptionSetter = sawThroughRule.actions.find(
        (action) =>
          action.type === 'SET_VARIABLE' &&
          action.parameters?.variable_name === 'perceptionType'
      );

      expect(perceptionSetter).toBeDefined();
      expect(perceptionSetter.parameters.value).toBe('physical.target_action');
    });
  });

  describe('Outcome handling', () => {
    it('should upsert progress, open the blocker, and emit a perceptible event on CRITICAL_SUCCESS', () => {
      const criticalIf = findIfByOutcome(sawThroughRule.actions, 'CRITICAL_SUCCESS');
      expect(criticalIf).toBeDefined();

      const progressIf = findProgressIf(criticalIf);
      expect(progressIf).toBeDefined();

      const addOp = progressIf.parameters.then_actions.find(
        (action) => action.type === 'ADD_COMPONENT'
      );
      const modifyOp = progressIf.parameters.else_actions.find(
        (action) => action.type === 'MODIFY_COMPONENT'
      );

      expect(addOp.parameters.component_type).toBe('core:progress_tracker');
      expect(addOp.parameters.value).toEqual({ value: 2 });
      expect(modifyOp.parameters.component_type).toBe('core:progress_tracker');
      expect(modifyOp.parameters.mode).toBe('increment');
      expect(modifyOp.parameters.value).toBe(2);

      const openOp = criticalIf.parameters.then_actions.find(
        (action) =>
          action.type === 'MODIFY_COMPONENT' &&
          action.parameters?.component_type === 'mechanisms:openable'
      );
      expect(openOp).toBeDefined();
      expect(openOp.parameters.field).toBe('isOpen');
      expect(openOp.parameters.mode).toBe('set');
      expect(openOp.parameters.value).toBe(true);

      const eventOp = findOutcomeEvent(criticalIf);
      expect(eventOp).toBeDefined();
      expect(eventOp.parameters.description_text).toBe(CRITICAL_SUCCESS_TEXT);
      expect(eventOp.parameters.alternate_descriptions.auditory).toBeDefined();
      expect(eventOp.parameters.target_description).toBeUndefined();
    });

    it('should upsert progress and emit a perceptible event on SUCCESS', () => {
      const successIf = findIfByOutcome(sawThroughRule.actions, 'SUCCESS');
      expect(successIf).toBeDefined();

      const progressIf = findProgressIf(successIf);
      expect(progressIf).toBeDefined();

      const addOp = progressIf.parameters.then_actions.find(
        (action) => action.type === 'ADD_COMPONENT'
      );
      const modifyOp = progressIf.parameters.else_actions.find(
        (action) => action.type === 'MODIFY_COMPONENT'
      );

      expect(addOp.parameters.component_type).toBe('core:progress_tracker');
      expect(addOp.parameters.value).toEqual({ value: 1 });
      expect(modifyOp.parameters.component_type).toBe('core:progress_tracker');
      expect(modifyOp.parameters.mode).toBe('increment');
      expect(modifyOp.parameters.value).toBe(1);

      const eventOp = findOutcomeEvent(successIf);
      expect(eventOp).toBeDefined();
      expect(eventOp.parameters.description_text).toBe(SUCCESS_TEXT);
      expect(eventOp.parameters.alternate_descriptions.auditory).toBeDefined();
      expect(eventOp.parameters.target_description).toBeUndefined();
    });

    it('should emit a perceptible event on FAILURE', () => {
      const failureIf = findIfByOutcome(sawThroughRule.actions, 'FAILURE');
      expect(failureIf).toBeDefined();

      expect(outcomeHasProgressOps(failureIf)).toBe(false);

      const eventOp = findOutcomeEvent(failureIf);
      expect(eventOp).toBeDefined();
      expect(eventOp.parameters.description_text).toBe(FAILURE_TEXT);
      expect(eventOp.parameters.alternate_descriptions.auditory).toBeDefined();
      expect(eventOp.parameters.target_description).toBeUndefined();
    });

    it('should drop the tool and emit a perceptible event on FUMBLE', () => {
      const fumbleIf = findIfByOutcome(sawThroughRule.actions, 'FUMBLE');
      expect(fumbleIf).toBeDefined();

      expect(outcomeHasProgressOps(fumbleIf)).toBe(false);

      const unwieldOp = fumbleIf.parameters.then_actions.find(
        (action) => action.type === 'UNWIELD_ITEM'
      );
      const dropOp = fumbleIf.parameters.then_actions.find(
        (action) => action.type === 'DROP_ITEM_AT_LOCATION'
      );

      expect(unwieldOp).toBeDefined();
      expect(unwieldOp.parameters.actorEntity).toBe('{event.payload.actorId}');
      expect(unwieldOp.parameters.itemEntity).toBe('{event.payload.secondaryId}');

      expect(dropOp).toBeDefined();
      expect(dropOp.parameters.actorEntity).toBe('{event.payload.actorId}');
      expect(dropOp.parameters.itemEntity).toBe('{event.payload.secondaryId}');
      expect(dropOp.parameters.locationId).toBe(
        '{context.actorPosition.locationId}'
      );

      const eventOp = findOutcomeEvent(fumbleIf);
      expect(eventOp).toBeDefined();
      expect(eventOp.parameters.description_text).toBe(FUMBLE_TEXT);
      expect(eventOp.parameters.alternate_descriptions.auditory).toBeDefined();
      expect(eventOp.parameters.target_description).toBeUndefined();
    });
  });

  describe('Action/condition alignment', () => {
    it('should reference the action id in the condition', () => {
      expect(sawThroughCondition.logic['=='][1]).toBe(
        'breaching:saw_through_barred_blocker_stage_two'
      );
    });

    it('should keep chanceBased enabled on the action', () => {
      expect(sawThroughAction.chanceBased.enabled).toBe(true);
    });
  });
});
