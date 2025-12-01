import { describe, it, expect } from '@jest/globals';
import handleRestrainTargetRule from '../../../../data/mods/physical-control/rules/handle_restrain_target.rule.json' assert { type: 'json' };
import restrainTargetAction from '../../../../data/mods/physical-control/actions/restrain_target.action.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' &&
      op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_restrain_target outcome resolution', () => {
  it('wires RESOLVE_OUTCOME for grappling vs defense with ratio formula', () => {
    const resolveOutcome = handleRestrainTargetRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );

    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:grappling_skill'
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      'skills:defense_skill'
    );
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('restrainResult');
  });

  it('keeps action chance config aligned with opposed grappling vs defense defaults', () => {
    const { chanceBased } = restrainTargetAction;

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
      component: 'skills:defense_skill',
      property: 'value',
      default: 0,
      targetRole: 'primary',
    });
  });

  it('branches into four outcomes with expected messages', () => {
    const ifOps = handleRestrainTargetRule.actions.filter(
      (op) => op.type === 'IF'
    );
    expect(ifOps).toHaveLength(4);

    const criticalSuccess = findIfByOutcome(
      handleRestrainTargetRule.actions,
      'CRITICAL_SUCCESS'
    );
    const success = findIfByOutcome(
      handleRestrainTargetRule.actions,
      'SUCCESS'
    );
    const failure = findIfByOutcome(
      handleRestrainTargetRule.actions,
      'FAILURE'
    );
    const fumble = findIfByOutcome(
      handleRestrainTargetRule.actions,
      'FUMBLE'
    );

    expect(criticalSuccess).toBeDefined();
    expect(success).toBeDefined();
    expect(failure).toBeDefined();
    expect(fumble).toBeDefined();

    const successMessage =
      '{context.actorName} restrains {context.targetName}, preventing them from moving freely.';
    const failureMessage =
      '{context.actorName} attempts to restrain {context.targetName}, but {context.targetName} resists, remaining free to move.';
    const fumbleMessage =
      '{context.actorName} attempts to restrain {context.targetName}, but during the struggle, {context.actorName} falls to the ground.';

    const successDispatch = success?.parameters.then_actions?.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const criticalDispatch = criticalSuccess?.parameters.then_actions?.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    expect(successDispatch?.parameters.description_text).toBe(successMessage);
    expect(criticalDispatch?.parameters.description_text).toBe(successMessage);

    const failureDispatch = failure?.parameters.then_actions?.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    expect(failureDispatch?.parameters.description_text).toBe(failureMessage);

    const fumbleDispatch = fumble?.parameters.then_actions?.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    expect(fumbleDispatch?.parameters.description_text).toBe(fumbleMessage);
  });
});
