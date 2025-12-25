import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import disinfectRule from '../../../../data/mods/first-aid/rules/handle_disinfect_wounded_part.rule.json' assert { type: 'json' };
import disinfectCondition from '../../../../data/mods/first-aid/conditions/event-is-action-disinfect-wounded-part.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:disinfect_wounded_part';
const ROOM_ID = 'room1';
const WOUNDED_PART_ID = 'patient-torso';
const DISINFECTANT_ID = 'first-aid:antiseptic_bottle';

const buildLiquidContainer = (overrides = {}) => ({
  currentVolumeMilliliters: 25,
  maxCapacityMilliliters: 100,
  servingSizeMilliliters: 5,
  isRefillable: true,
  flavorText: 'A sharp-smelling antiseptic.',
  tags: ['disinfectant'],
  ...overrides,
});

describe('first-aid:handle_disinfect_wounded_part rule', () => {
  let fixture;

  const loadScenario = () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const disinfectant = new ModEntityBuilder(DISINFECTANT_ID)
      .withName('Antiseptic Bottle')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('containers-core:liquid_container', buildLiquidContainer())
      .atLocation(ROOM_ID)
      .build();

    const medic = new ModEntityBuilder('actor1')
      .withName('Medic')
      .asActor()
      .atLocation(ROOM_ID)
      .withComponent('skills:medicine_skill', { value: 40 })
      .withComponent('inventory:inventory', {
        items: [DISINFECTANT_ID],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
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
        maxHealth: 10,
      })
      .atLocation(ROOM_ID)
      .build();

    fixture.reset([room, medic, patient, torso, disinfectant]);
    fixture.clearEvents();

    return {
      medicId: medic.id,
      patientId: patient.id,
      torsoId: torso.id,
      disinfectantId: disinfectant.id,
    };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'first-aid',
      ACTION_ID,
      disinfectRule,
      disinfectCondition
    );
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('applies disinfected status to the wounded part and logs the action', async () => {
    const { medicId, patientId, torsoId, disinfectantId } = loadScenario();

    await fixture.executeAction(medicId, patientId, {
      additionalPayload: {
        primaryId: patientId,
        secondaryId: torsoId,
        tertiaryId: disinfectantId,
        targets: {
          primary: patientId,
          secondary: torsoId,
          tertiary: disinfectantId,
        },
      },
    });

    const message =
      "Medic disinfects Patient's wounded torso with Antiseptic Bottle.";
    fixture.assertActionSuccess(message);
    fixture.assertPerceptibleEvent({
      descriptionText: message,
      locationId: ROOM_ID,
      actorId: medicId,
      targetId: patientId,
      perceptionType: 'physical.target_action',
    });

    fixture.assertComponentAdded(torsoId, 'first-aid:disinfected', {
      appliedById: medicId,
      sourceItemId: disinfectantId,
    });

    expect(
      fixture.entityManager.hasComponent(medicId, 'first-aid:disinfected')
    ).toBe(false);
    expect(
      fixture.entityManager.hasComponent(patientId, 'first-aid:disinfected')
    ).toBe(false);
    expect(
      fixture.entityManager.hasComponent(
        disinfectantId,
        'first-aid:disinfected'
      )
    ).toBe(false);
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

  it('requests description regeneration for the patient and wounded part', () => {
    const regenOps = disinfectRule.actions.filter(
      (action) => action.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenOps).toHaveLength(2);
    const entityRefs = regenOps.map((action) => action.parameters.entity_ref);
    expect(entityRefs).toEqual(expect.arrayContaining(['primary', 'secondary']));
  });
});
