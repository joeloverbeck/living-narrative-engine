import { describe, it, expect } from '@jest/globals';
import breakFreeRule from '../../../../data/mods/physical-control/rules/handle_break_free_from_restraint.rule.json' assert { type: 'json' };
import breakFreeCondition from '../../../../data/mods/physical-control/conditions/event-is-action-break-free-from-restraint.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };
import breakFreeAction from '../../../../data/mods/physical-control/actions/break_free_from_restraint.action.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' &&
      op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_break_free_from_restraint rule', () => {
  it('registers rule, condition, and manifest content', () => {
    expect(breakFreeRule.rule_id).toBe('handle_break_free_from_restraint');
    expect(breakFreeRule.event_type).toBe('core:attempt_action');
    expect(breakFreeRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-break-free-from-restraint'
    );

    expect(breakFreeCondition.id).toBe(
      'physical-control:event-is-action-break-free-from-restraint'
    );
    expect(breakFreeCondition.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:break_free_from_restraint',
    ]);

    expect(physicalControlManifest.content.actions).toContain(
      'break_free_from_restraint.action.json'
    );
    expect(physicalControlManifest.content.rules).toContain(
      'handle_break_free_from_restraint.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-break-free-from-restraint.condition.json'
    );
    expect(physicalControlManifest.content.scopes).toContain(
      'restraining_entity_from_being_restrained.scope'
    );
  });

  it('aligns action chance config to opposed defense vs grappling ratio contest', () => {
    const { chanceBased } = breakFreeAction;

    expect(chanceBased.enabled).toBe(true);
    expect(chanceBased.contestType).toBe('opposed');
    expect(chanceBased.formula).toBe('ratio');
    expect(chanceBased.bounds).toEqual({ min: 5, max: 95 });
    expect(chanceBased.outcomes).toEqual({
      criticalSuccessThreshold: 5,
      criticalFailureThreshold: 95,
    });

    expect(chanceBased.actorSkill).toEqual({
      component: 'skills:grappling_skill',
      property: 'value',
      default: 10,
    });
    expect(chanceBased.targetSkill).toEqual({
      component: 'skills:grappling_skill',
      property: 'value',
      default: 10,
      targetRole: 'primary',
    });

    const resolveOutcome = breakFreeRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome?.parameters.actor_skill_component).toBe(
      'skills:grappling_skill'
    );
    expect(resolveOutcome?.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome?.parameters.target_skill_component).toBe(
      'skills:grappling_skill'
    );
    expect(resolveOutcome?.parameters.target_skill_default).toBe(10);
    expect(resolveOutcome?.parameters.formula).toBe('ratio');
    expect(resolveOutcome?.parameters.result_variable).toBe('breakFreeResult');
  });

  it('sets up names, position lookup, and shared variables', () => {
    const getNameOps = breakFreeRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const targetNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'target'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(targetNameOp?.parameters.result_variable).toBe('targetName');

    const positionQuery = breakFreeRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const setVariableOps = breakFreeRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );
    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );
    const targetVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'targetId'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('action_target_general');
    expect(targetVar?.parameters.value).toBe('{event.payload.targetId}');
  });

  it('branches for all outcome types', () => {
    const ifOps = breakFreeRule.actions.filter((op) => op.type === 'IF');

    expect(ifOps).toHaveLength(4);
    expect(findIfByOutcome(breakFreeRule.actions, 'CRITICAL_SUCCESS')).toBeDefined();
    expect(findIfByOutcome(breakFreeRule.actions, 'SUCCESS')).toBeDefined();
    expect(findIfByOutcome(breakFreeRule.actions, 'FAILURE')).toBeDefined();
    expect(findIfByOutcome(breakFreeRule.actions, 'FUMBLE')).toBeDefined();
  });

  it('removes restraint components, unlocks grabbing, and logs success on SUCCESS/CRITICAL_SUCCESS', () => {
    const successMessage =
      '{context.actorName} breaks free from {context.targetName}\'s grip.';
    const criticalMessage =
      '{context.actorName} breaks free from {context.targetName}\'s grip, and during the struggle, {context.targetName} falls to the ground.';

    ['SUCCESS', 'CRITICAL_SUCCESS'].forEach((outcome) => {
      const branch = findIfByOutcome(breakFreeRule.actions, outcome);
      const actions = branch?.parameters.then_actions ?? [];

      const removeBeingRestrained = actions.find(
        (op) =>
          op.type === 'REMOVE_COMPONENT' &&
          op.parameters.component_type === 'positioning:being_restrained'
      );
      const removeRestraining = actions.find(
        (op) =>
          op.type === 'REMOVE_COMPONENT' &&
          op.parameters.component_type === 'positioning:restraining'
      );
      const unlockGrabbing = actions.find(
        (op) => op.type === 'UNLOCK_GRABBING'
      );
      const regenOps = actions.filter(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );
      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );

      expect(removeBeingRestrained?.parameters.entity_ref).toBe('actor');
      expect(removeRestraining?.parameters.entity_ref).toBe('target');

      expect(unlockGrabbing?.parameters.actor_id).toBe(
        '{event.payload.targetId}'
      );
      expect(unlockGrabbing?.parameters.count).toBe(2);
      expect(unlockGrabbing?.parameters.item_id).toBe(
        '{event.payload.actorId}'
      );

      expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
        'actor',
        'target',
      ]);

      const expectedMessage =
        outcome === 'SUCCESS' ? successMessage : criticalMessage;
      expect(dispatch?.parameters.description_text).toBe(expectedMessage);
      expect(logMessage?.parameters.value).toBe(expectedMessage);

      expect(
        actions.some((op) => op.macro === 'core:logSuccessOutcomeAndEndTurn')
      ).toBe(true);
    });
  });

  it('adds fallen to the target on CRITICAL_SUCCESS', () => {
    const branch = findIfByOutcome(breakFreeRule.actions, 'CRITICAL_SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const fallenAdd = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'positioning:fallen'
    );

    expect(fallenAdd?.parameters.entity_ref).toBe('target');
  });

  it('keeps state intact and shares the same failure message on FAILURE/FUMBLE', () => {
    const failureBranch = findIfByOutcome(breakFreeRule.actions, 'FAILURE');
    const fumbleBranch = findIfByOutcome(breakFreeRule.actions, 'FUMBLE');
    const failureActions = failureBranch?.parameters.then_actions ?? [];
    const fumbleActions = fumbleBranch?.parameters.then_actions ?? [];

    const expectedMessage =
      '{context.actorName} tries to break free from {context.targetName}\'s grip, but fails to release themselves.';

    [failureActions, fumbleActions].forEach((actions) => {
      expect(actions.some((op) => op.type === 'REMOVE_COMPONENT')).toBe(false);
      expect(actions.some((op) => op.type === 'UNLOCK_GRABBING')).toBe(false);

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );

      expect(dispatch?.parameters.description_text).toBe(expectedMessage);
      expect(logMessage?.parameters.value).toBe(expectedMessage);

      expect(
        actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
      ).toBe(true);
    });
  });
});
