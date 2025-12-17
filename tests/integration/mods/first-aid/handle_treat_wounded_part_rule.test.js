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
 * 2. PERCEPTIBLE EVENTS: The rule dispatches DISPATCH_PERCEPTIBLE_EVENT in each
 *    outcome branch (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) to broadcast
 *    the action result to other actors in the location. Uses perception_type
 *    "physical.target_action" since it's treating another actor.
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
    const message = "Medic successfully treats Patient's wounded torso.";
    fixture.assertActionSuccess(message, { shouldHavePerceptibleEvent: true });
  });

  // eslint-disable-next-line jest/expect-expect -- assertion in assertOnlyExpectedEvents
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

  describe('Perceptible Event Verification', () => {
    it('all four outcome branches should have DISPATCH_PERCEPTIBLE_EVENT operation', () => {
      const ifOps = treatRule.actions.filter((action) => action.type === 'IF');
      expect(ifOps.length).toBe(4);

      ifOps.forEach((ifOp) => {
        const thenActions = ifOp.parameters.then_actions;

        const dispatchPerceptibleOp = thenActions.find(
          (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchPerceptibleOp).toBeDefined();
        expect(dispatchPerceptibleOp.parameters).toHaveProperty('location_id');
        expect(dispatchPerceptibleOp.parameters).toHaveProperty(
          'description_text'
        );
        expect(dispatchPerceptibleOp.parameters).toHaveProperty(
          'perception_type'
        );
        expect(dispatchPerceptibleOp.parameters).toHaveProperty('actor_id');
        // Treating another actor should include target_id
        expect(dispatchPerceptibleOp.parameters).toHaveProperty('target_id');

        // Target treatment should use physical.target_action perception type
        expect(dispatchPerceptibleOp.parameters.perception_type).toBe(
          '{context.perceptionType}'
        );
      });
    });

    it('should dispatch perceptible event with correct payload structure including targetId (SUCCESS path)', async () => {
      const { medicId, patientId, torsoId } = loadScenario();

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

      const perceptibleEvent = fixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();

      // Check required payload fields
      expect(perceptibleEvent.payload).toHaveProperty('eventName');
      expect(perceptibleEvent.payload).toHaveProperty('locationId');
      expect(perceptibleEvent.payload).toHaveProperty('descriptionText');
      expect(perceptibleEvent.payload).toHaveProperty('timestamp');
      expect(perceptibleEvent.payload).toHaveProperty('perceptionType');
      expect(perceptibleEvent.payload).toHaveProperty('actorId');
      // Target treatment must include targetId
      expect(perceptibleEvent.payload).toHaveProperty('targetId');

      // Verify perception type for target treatment
      expect(perceptibleEvent.payload.perceptionType).toBe(
        'physical.target_action'
      );

      // Verify description contains expected content
      expect(perceptibleEvent.payload.descriptionText).toContain('Medic');
      expect(perceptibleEvent.payload.descriptionText).toContain('Patient');
      expect(perceptibleEvent.payload.descriptionText).toContain('torso');
    });
  });

  describe('Alternate Descriptions (Sensory Fallbacks)', () => {
    it('all outcome branches have alternate_descriptions for sensory fallback', () => {
      const ifOps = treatRule.actions.filter((action) => action.type === 'IF');
      expect(ifOps.length).toBe(4);

      ifOps.forEach((ifOp) => {
        const outcomeValue = ifOp.parameters.condition?.['==']?.[1];
        const thenActions = ifOp.parameters.then_actions;

        const dispatchOp = thenActions.find(
          (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );
        expect(dispatchOp).toBeDefined();
        expect(dispatchOp.parameters).toHaveProperty('alternate_descriptions');

        // All branches should have auditory fallback
        expect(dispatchOp.parameters.alternate_descriptions).toHaveProperty(
          'auditory'
        );
        expect(
          dispatchOp.parameters.alternate_descriptions.auditory
        ).toBeTruthy();

        // Log which outcome has tactile (optional, for coverage)
        if (dispatchOp.parameters.alternate_descriptions.tactile) {
          expect(['CRITICAL_SUCCESS', 'FUMBLE']).toContain(outcomeValue);
        }
      });
    });

    it('CRITICAL_SUCCESS has both auditory and tactile alternate descriptions', () => {
      const critSuccessIf = treatRule.actions.find(
        (a) =>
          a.type === 'IF' &&
          a.parameters.condition?.['==']?.[1] === 'CRITICAL_SUCCESS'
      );
      expect(critSuccessIf).toBeDefined();

      const dispatchOp = critSuccessIf.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp.parameters.alternate_descriptions).toEqual({
        auditory:
          'I hear the sounds of medical treatment being administered with exceptional skill.',
        tactile:
          'I sense careful, deliberate movements of someone providing expert care.',
      });
    });

    it('FUMBLE has both auditory and tactile alternate descriptions', () => {
      const fumbleIf = treatRule.actions.find(
        (a) =>
          a.type === 'IF' && a.parameters.condition?.['==']?.[1] === 'FUMBLE'
      );
      expect(fumbleIf).toBeDefined();

      const dispatchOp = fumbleIf.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp.parameters.alternate_descriptions).toEqual({
        auditory:
          'I hear the rustle of medical treatment nearby, then a pained cry.',
        tactile: 'I sense sudden distress nearby.',
      });
    });

    it('SUCCESS and FAILURE have auditory-only alternate descriptions', () => {
      const successIf = treatRule.actions.find(
        (a) =>
          a.type === 'IF' && a.parameters.condition?.['==']?.[1] === 'SUCCESS'
      );
      const failureIf = treatRule.actions.find(
        (a) =>
          a.type === 'IF' && a.parameters.condition?.['==']?.[1] === 'FAILURE'
      );

      const successDispatch = successIf.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const failureDispatch = failureIf.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Should have auditory only
      expect(successDispatch.parameters.alternate_descriptions).toEqual({
        auditory: 'I hear the rustle of bandages and sounds of treatment nearby.',
      });
      expect(failureDispatch.parameters.alternate_descriptions).toEqual({
        auditory: 'I hear frustrated attempts at medical treatment nearby.',
      });
    });

    it('should dispatch perceptible event with correct payload structure including targetId (SUCCESS path)', async () => {
      const { medicId, patientId, torsoId } = loadScenario();

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

      const perceptibleEvent = fixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();

      // Check required payload fields
      expect(perceptibleEvent.payload).toHaveProperty('eventName');
      expect(perceptibleEvent.payload).toHaveProperty('locationId');
      expect(perceptibleEvent.payload).toHaveProperty('descriptionText');
      expect(perceptibleEvent.payload).toHaveProperty('timestamp');
      expect(perceptibleEvent.payload).toHaveProperty('perceptionType');
      expect(perceptibleEvent.payload).toHaveProperty('actorId');
      // Target treatment must include targetId
      expect(perceptibleEvent.payload).toHaveProperty('targetId');

      // Verify perception type for target treatment
      expect(perceptibleEvent.payload.perceptionType).toBe(
        'physical.target_action'
      );

      // Verify description contains expected content
      expect(perceptibleEvent.payload.descriptionText).toContain('Medic');
      expect(perceptibleEvent.payload.descriptionText).toContain('Patient');
      expect(perceptibleEvent.payload.descriptionText).toContain('torso');
    });
  });
});
