import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import rinseRule from '../../../../data/mods/first-aid/rules/handle_rinse_wounded_part.rule.json' assert { type: 'json' };
import rinseCondition from '../../../../data/mods/first-aid/conditions/event-is-action-rinse-wounded-part.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:rinse_wounded_part';
const ROOM_ID = 'room1';
const WOUNDED_PART_ID = 'patient-torso';
const WATER_SOURCE_ID = 'items:water_canteen';

const buildLiquidContainer = (overrides = {}) => ({
  currentVolumeMilliliters: 200,
  maxCapacityMilliliters: 500,
  servingSizeMilliliters: 25,
  isRefillable: true,
  flavorText: 'Fresh water.',
  tags: ['water'],
  ...overrides,
});

describe('first-aid:handle_rinse_wounded_part rule', () => {
  let fixture;

  const loadScenario = () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const waterSource = new ModEntityBuilder(WATER_SOURCE_ID)
      .withName('Water Canteen')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:liquid_container', buildLiquidContainer())
      .atLocation(ROOM_ID)
      .build();

    const medic = new ModEntityBuilder('actor1')
      .withName('Medic')
      .asActor()
      .atLocation(ROOM_ID)
      .withComponent('skills:medicine_skill', { value: 40 })
      .withComponent('items:inventory', {
        items: [WATER_SOURCE_ID],
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

    fixture.reset([room, medic, patient, torso, waterSource]);
    fixture.clearEvents();

    return {
      medicId: medic.id,
      patientId: patient.id,
      torsoId: torso.id,
      waterSourceId: waterSource.id,
    };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'first-aid',
      ACTION_ID,
      rinseRule,
      rinseCondition
    );
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('applies rinsed status to the wounded part and logs the action', async () => {
    const { medicId, patientId, torsoId, waterSourceId } = loadScenario();

    await fixture.executeAction(medicId, patientId, {
      additionalPayload: {
        primaryId: patientId,
        secondaryId: torsoId,
        tertiaryId: waterSourceId,
        targets: {
          primary: patientId,
          secondary: torsoId,
          tertiary: waterSourceId,
        },
      },
    });

    const message =
      "Medic rinses Patient's wounded torso with Water Canteen.";
    fixture.assertActionSuccess(message);
    fixture.assertPerceptibleEvent({
      descriptionText: message,
      locationId: ROOM_ID,
      actorId: medicId,
      targetId: patientId,
      perceptionType: 'action_target_general',
    });

    fixture.assertComponentAdded(torsoId, 'first-aid:rinsed', {
      appliedById: medicId,
      sourceItemId: waterSourceId,
    });

    expect(
      fixture.entityManager.hasComponent(medicId, 'first-aid:rinsed')
    ).toBe(false);
    expect(
      fixture.entityManager.hasComponent(patientId, 'first-aid:rinsed')
    ).toBe(false);
    expect(
      fixture.entityManager.hasComponent(
        waterSourceId,
        'first-aid:rinsed'
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
    const regenOps = rinseRule.actions.filter(
      (action) => action.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenOps).toHaveLength(2);
    const entityRefs = regenOps.map((action) => action.parameters.entity_ref);
    expect(entityRefs).toEqual(expect.arrayContaining(['primary', 'secondary']));
  });
});
