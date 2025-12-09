/**
 * @file Integration tests for first-aid:handle_treat_my_wounded_part rule execution.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. OUTCOME SYSTEM: This rule uses RESOLVE_OUTCOME for chance-based outcomes.
 *    The test infrastructure's chanceCalculationService mock always returns SUCCESS,
 *    so this file tests:
 *    - SUCCESS path via actual execution (default mock behavior)
 *    - Rule structure validation for all 4 outcome branches (static analysis)
 *
 * 2. SELF-TREATMENT: Unlike handle_treat_wounded_part, this rule:
 *    - Has no targetName variable (no separate target actor)
 *    - Uses "primary" for body part (not "secondary")
 *    - REGENERATE_DESCRIPTION targets "actor" (not "primary")
 *    - Messages use "their own" phrasing
 *
 * 3. MACRO BEHAVIOR: The rule uses core:logSuccessOutcomeAndEndTurn macro which
 *    dispatches core:display_successful_action_result and core:action_success,
 *    but NOT core:perceptible_event. This differs from core:logSuccessAndEndTurn
 *    used by deterministic rules. The test assertions reflect this by using
 *    shouldHavePerceptibleEvent: false.
 *
 * Full outcome testing for CRITICAL_SUCCESS, FAILURE, and FUMBLE would require
 * infrastructure changes to allow mocking different outcome types.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import treatMyRule from '../../../../data/mods/first-aid/rules/handle_treat_my_wounded_part.rule.json' assert { type: 'json' };
import treatMyCondition from '../../../../data/mods/first-aid/conditions/event-is-action-treat-my-wounded-part.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:treat_my_wounded_part';
const ROOM_ID = 'room1';
const WOUNDED_PART_ID = 'actor-torso';

describe('first-aid:handle_treat_my_wounded_part rule', () => {
  let fixture;

  const loadScenario = () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const actor = new ModEntityBuilder('actor1')
      .withName('Self-Medic')
      .asActor()
      .atLocation(ROOM_ID)
      .withComponent('skills:medicine_skill', { value: 40 })
      .withBody(WOUNDED_PART_ID)
      .build();

    const torso = new ModEntityBuilder(WOUNDED_PART_ID)
      .withName('torso')
      .asBodyPart({ parent: null, children: [], subType: 'torso' })
      .withComponent('anatomy:part_health', {
        currentHealth: 5,
        maxHealth: 20, // Room to heal +10 without hitting max
      })
      .atLocation(ROOM_ID)
      .build();

    fixture.reset([room, actor, torso]);
    fixture.clearEvents();

    return {
      actorId: actor.id,
      torsoId: torso.id,
    };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'first-aid',
      ACTION_ID,
      treatMyRule,
      treatMyCondition
    );
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('successfully executes self-treat action and heals body part (SUCCESS outcome)', async () => {
    // Default mock returns SUCCESS, so +10 HP should be applied
    const { actorId, torsoId } = loadScenario();

    // Verify initial health
    const initialHealth = fixture.entityManager.getComponentData(
      torsoId,
      'anatomy:part_health'
    );
    expect(initialHealth.currentHealth).toBe(5);

    await fixture.executeAction(actorId, torsoId, {
      additionalPayload: {
        primaryId: torsoId,
        targets: {
          primary: torsoId,
        },
      },
    });

    // Verify healing occurred (SUCCESS = +10 HP)
    const finalHealth = fixture.entityManager.getComponentData(
      torsoId,
      'anatomy:part_health'
    );
    expect(finalHealth.currentHealth).toBe(15); // 5 + 10

    // Verify message matches SUCCESS outcome with self-treatment phrasing
    // Note: core:logSuccessOutcomeAndEndTurn macro does NOT dispatch core:perceptible_event
    const message = 'Self-Medic successfully treats their own wounded torso.';
    fixture.assertActionSuccess(message, { shouldHavePerceptibleEvent: false });
  });

  // eslint-disable-next-line jest/expect-expect -- assertion in assertOnlyExpectedEvents
  it('ignores unrelated actions', async () => {
    const { actorId, torsoId } = loadScenario();

    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: actorId,
      actionId: 'core:wait',
      targetId: torsoId,
      originalInput: 'wait',
    });

    fixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('rule structure has correct IF conditions for all four outcomes', () => {
    // Find all IF operations
    const ifOps = treatMyRule.actions.filter((action) => action.type === 'IF');
    expect(ifOps.length).toBe(4);

    // Verify outcome conditions - the rule checks context.treatmentResult.outcome
    const outcomes = ifOps.map((op) => {
      const condition = op.parameters.condition;
      const outcomeValue = condition['==']?.[1];
      return outcomeValue;
    });

    expect(outcomes).toContain('CRITICAL_SUCCESS');
    expect(outcomes).toContain('SUCCESS');
    expect(outcomes).toContain('FAILURE');
    expect(outcomes).toContain('FUMBLE');
  });

  it('rule has RESOLVE_OUTCOME operation before IF conditions', () => {
    const resolveIdx = treatMyRule.actions.findIndex(
      (a) => a.type === 'RESOLVE_OUTCOME'
    );
    const firstIfIdx = treatMyRule.actions.findIndex((a) => a.type === 'IF');

    expect(resolveIdx).toBeGreaterThan(-1);
    expect(firstIfIdx).toBeGreaterThan(resolveIdx);

    // Verify result_variable matches what IF conditions check
    const resolveOp = treatMyRule.actions[resolveIdx];
    expect(resolveOp.parameters.result_variable).toBe('treatmentResult');
  });

  it('CRITICAL_SUCCESS branch applies +20 HP and regenerates actor description', () => {
    const critSuccessIf = treatMyRule.actions.find(
      (a) =>
        a.type === 'IF' &&
        a.parameters.condition?.['==']?.[1] === 'CRITICAL_SUCCESS'
    );
    expect(critSuccessIf).toBeDefined();

    const thenActions = critSuccessIf.parameters.then_actions;

    // Check MODIFY_PART_HEALTH with delta +20
    const modifyOp = thenActions.find((a) => a.type === 'MODIFY_PART_HEALTH');
    expect(modifyOp).toBeDefined();
    expect(modifyOp.parameters.delta).toBe(20);
    // KEY DIFFERENCE: part_entity_ref is "primary" (not "secondary")
    expect(modifyOp.parameters.part_entity_ref).toBe('primary');

    // Check REGENERATE_DESCRIPTION for actor and primary (body part)
    // KEY DIFFERENCE: actor, not primary/secondary pair
    const regenOps = thenActions.filter(
      (a) => a.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOps).toHaveLength(2);
    const entityRefs = regenOps.map((a) => a.parameters.entity_ref);
    expect(entityRefs).toEqual(expect.arrayContaining(['actor', 'primary']));

    // Check message uses self-treatment phrasing
    const setVarOp = thenActions.find(
      (a) =>
        a.type === 'SET_VARIABLE' &&
        a.parameters.variable_name === 'logMessage'
    );
    expect(setVarOp).toBeDefined();
    expect(setVarOp.parameters.value).toContain('their own wounded');
    expect(setVarOp.parameters.value).toContain('remarkable healing results');
  });

  it('SUCCESS branch applies +10 HP and uses self-treatment message', () => {
    const successIf = treatMyRule.actions.find(
      (a) =>
        a.type === 'IF' && a.parameters.condition?.['==']?.[1] === 'SUCCESS'
    );
    expect(successIf).toBeDefined();

    const thenActions = successIf.parameters.then_actions;

    // Check MODIFY_PART_HEALTH with delta +10
    const modifyOp = thenActions.find((a) => a.type === 'MODIFY_PART_HEALTH');
    expect(modifyOp).toBeDefined();
    expect(modifyOp.parameters.delta).toBe(10);
    expect(modifyOp.parameters.part_entity_ref).toBe('primary');

    // Check message uses self-treatment phrasing
    const setVarOp = thenActions.find(
      (a) =>
        a.type === 'SET_VARIABLE' &&
        a.parameters.variable_name === 'logMessage'
    );
    expect(setVarOp).toBeDefined();
    expect(setVarOp.parameters.value).toContain(
      'successfully treats their own wounded'
    );
  });

  it('FUMBLE branch applies damage to actor and uses self-treatment message', () => {
    const fumbleIf = treatMyRule.actions.find(
      (a) =>
        a.type === 'IF' && a.parameters.condition?.['==']?.[1] === 'FUMBLE'
    );
    expect(fumbleIf).toBeDefined();

    const thenActions = fumbleIf.parameters.then_actions;

    // Check APPLY_DAMAGE operation
    const damageOp = thenActions.find((a) => a.type === 'APPLY_DAMAGE');
    expect(damageOp).toBeDefined();
    expect(damageOp.parameters.damage_entry.amount).toBe(10);
    expect(damageOp.parameters.damage_entry.type).toBe('piercing');
    // KEY DIFFERENCE: entity_ref is "actor" (not "primary")
    expect(damageOp.parameters.entity_ref).toBe('actor');
    expect(damageOp.parameters.part_ref).toBe('primary');

    // Check REGENERATE_DESCRIPTION for actor and primary
    const regenOps = thenActions.filter(
      (a) => a.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOps).toHaveLength(2);
    const entityRefs = regenOps.map((a) => a.parameters.entity_ref);
    expect(entityRefs).toEqual(expect.arrayContaining(['actor', 'primary']));

    // Check message uses self-treatment phrasing
    const setVarOp = thenActions.find(
      (a) =>
        a.type === 'SET_VARIABLE' &&
        a.parameters.variable_name === 'logMessage'
    );
    expect(setVarOp).toBeDefined();
    expect(setVarOp.parameters.value).toContain(
      'fumbles badly while treating their own wounded'
    );
  });

  it('FAILURE branch has no health-modifying operations and uses self-treatment message', () => {
    const failureIf = treatMyRule.actions.find(
      (a) =>
        a.type === 'IF' && a.parameters.condition?.['==']?.[1] === 'FAILURE'
    );
    expect(failureIf).toBeDefined();

    const thenActions = failureIf.parameters.then_actions;

    // Should NOT have MODIFY_PART_HEALTH or APPLY_DAMAGE
    const healthOps = thenActions.filter(
      (a) => a.type === 'MODIFY_PART_HEALTH' || a.type === 'APPLY_DAMAGE'
    );
    expect(healthOps).toHaveLength(0);

    // Should NOT have REGENERATE_DESCRIPTION
    const regenOps = thenActions.filter(
      (a) => a.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOps).toHaveLength(0);

    // Check message uses self-treatment phrasing
    const setVarOp = thenActions.find(
      (a) =>
        a.type === 'SET_VARIABLE' &&
        a.parameters.variable_name === 'logMessage'
    );
    expect(setVarOp).toBeDefined();
    expect(setVarOp.parameters.value).toContain(
      'attempts to treat their own wounded'
    );
    expect(setVarOp.parameters.value).toContain('fails to provide effective care');
  });

  it('rule has correct condition reference', () => {
    expect(treatMyRule.condition.condition_ref).toBe(
      'first-aid:event-is-action-treat-my-wounded-part'
    );
  });

  it('rule triggers on core:attempt_action event', () => {
    expect(treatMyRule.event_type).toBe('core:attempt_action');
  });

  it('rule has correct rule_id', () => {
    expect(treatMyRule.rule_id).toBe('handle_treat_my_wounded_part');
  });

  it('rule comment indicates self-treatment', () => {
    expect(treatMyRule.comment).toContain('self-treatment');
  });

  it('perceptionType is set to action_self for self-action', () => {
    const setPerceptionTypeOp = treatMyRule.actions.find(
      (a) =>
        a.type === 'SET_VARIABLE' &&
        a.parameters.variable_name === 'perceptionType'
    );
    expect(setPerceptionTypeOp).toBeDefined();
    expect(setPerceptionTypeOp.parameters.value).toBe('action_self_general');
  });

  it('targetId is set to actorId for self-action', () => {
    const setTargetIdOp = treatMyRule.actions.find(
      (a) =>
        a.type === 'SET_VARIABLE' &&
        a.parameters.variable_name === 'targetId'
    );
    expect(setTargetIdOp).toBeDefined();
    expect(setTargetIdOp.parameters.value).toBe('{event.payload.actorId}');
  });
});
