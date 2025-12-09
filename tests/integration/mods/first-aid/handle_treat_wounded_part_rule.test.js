/**
 * @file Integration tests for first-aid:handle_treat_wounded_part rule execution.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. OUTCOME SYSTEM: This rule uses RESOLVE_OUTCOME for chance-based outcomes.
 *    The test infrastructure's chanceCalculationService mock always returns SUCCESS,
 *    so this file tests:
 *    - SUCCESS path via actual execution (default mock behavior)
 *    - Rule structure validation for all 4 outcome branches (static analysis)
 *
 * 2. MACRO BEHAVIOR: The rule uses core:logSuccessOutcomeAndEndTurn macro which
 *    dispatches core:display_successful_action_result and core:action_success,
 *    but NOT core:perceptible_event. This differs from core:logSuccessAndEndTurn
 *    used by deterministic rules (like disinfect). The test assertions reflect
 *    this macro behavior by using shouldHavePerceptibleEvent: false.
 *
 * Full outcome testing for CRITICAL_SUCCESS, FAILURE, and FUMBLE would require
 * infrastructure changes to allow mocking different outcome types, which is
 * out of scope per TREWOUACT-006.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import treatRule from '../../../../data/mods/first-aid/rules/handle_treat_wounded_part.rule.json' assert { type: 'json' };
import treatCondition from '../../../../data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:treat_wounded_part';
const ROOM_ID = 'room1';
const WOUNDED_PART_ID = 'patient-torso';

describe('first-aid:handle_treat_wounded_part rule', () => {
  let fixture;

  const loadScenario = () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const medic = new ModEntityBuilder('actor1')
      .withName('Medic')
      .asActor()
      .atLocation(ROOM_ID)
      .withComponent('skills:medicine_skill', { value: 40 })
      .build();

    const patient = new ModEntityBuilder('target1')
      .withName('Patient')
      .asActor()
      .atLocation(ROOM_ID)
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

    fixture.reset([room, medic, patient, torso]);
    fixture.clearEvents();

    return {
      medicId: medic.id,
      patientId: patient.id,
      torsoId: torso.id,
    };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'first-aid',
      ACTION_ID,
      treatRule,
      treatCondition
    );
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('successfully executes treat action and heals body part (SUCCESS outcome)', async () => {
    // Default mock returns SUCCESS, so +10 HP should be applied
    const { medicId, patientId, torsoId } = loadScenario();

    // Verify initial health
    const initialHealth = fixture.entityManager.getComponentData(
      torsoId,
      'anatomy:part_health'
    );
    expect(initialHealth.currentHealth).toBe(5);

    await fixture.executeAction(medicId, patientId, {
      additionalPayload: {
        primaryId: patientId,
        secondaryId: torsoId,
        targets: {
          primary: patientId,
          secondary: torsoId,
        },
      },
    });

    // Verify healing occurred (SUCCESS = +10 HP)
    const finalHealth = fixture.entityManager.getComponentData(
      torsoId,
      'anatomy:part_health'
    );
    expect(finalHealth.currentHealth).toBe(15); // 5 + 10

    // Verify message matches SUCCESS outcome
    // Note: core:logSuccessOutcomeAndEndTurn macro does NOT dispatch core:perceptible_event
    // (unlike core:logSuccessAndEndTurn), so we use shouldHavePerceptibleEvent: false
    const message = "Medic successfully treats Patient's wounded torso.";
    fixture.assertActionSuccess(message, { shouldHavePerceptibleEvent: false });
  });

  it('ignores unrelated actions', async () => {
    const { medicId, patientId } = loadScenario();

    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: medicId,
      actionId: 'core:wait',
      targetId: patientId,
      originalInput: 'wait',
    });

    fixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('rule structure has correct IF conditions for all four outcomes', () => {
    // Find all IF operations
    const ifOps = treatRule.actions.filter((action) => action.type === 'IF');
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
    const resolveIdx = treatRule.actions.findIndex(
      (a) => a.type === 'RESOLVE_OUTCOME'
    );
    const firstIfIdx = treatRule.actions.findIndex((a) => a.type === 'IF');

    expect(resolveIdx).toBeGreaterThan(-1);
    expect(firstIfIdx).toBeGreaterThan(resolveIdx);

    // Verify result_variable matches what IF conditions check
    const resolveOp = treatRule.actions[resolveIdx];
    expect(resolveOp.parameters.result_variable).toBe('treatmentResult');
  });

  it('CRITICAL_SUCCESS branch applies +20 HP and regenerates descriptions', () => {
    const critSuccessIf = treatRule.actions.find(
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

    // Check REGENERATE_DESCRIPTION for primary and secondary
    const regenOps = thenActions.filter(
      (a) => a.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOps).toHaveLength(2);
    const entityRefs = regenOps.map((a) => a.parameters.entity_ref);
    expect(entityRefs).toEqual(expect.arrayContaining(['primary', 'secondary']));
  });

  it('FUMBLE branch applies damage via APPLY_DAMAGE operation', () => {
    const fumbleIf = treatRule.actions.find(
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

    // Check REGENERATE_DESCRIPTION for primary and secondary
    const regenOps = thenActions.filter(
      (a) => a.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOps).toHaveLength(2);
  });

  it('FAILURE branch has no health-modifying operations', () => {
    const failureIf = treatRule.actions.find(
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
  });
});
