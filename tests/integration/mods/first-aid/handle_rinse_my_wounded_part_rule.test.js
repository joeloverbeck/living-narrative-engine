import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import rinseRule from '../../../../data/mods/first-aid/rules/handle_rinse_my_wounded_part.rule.json' assert { type: 'json' };
import rinseCondition from '../../../../data/mods/first-aid/conditions/event-is-action-rinse-my-wounded-part.condition.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:rinse_my_wounded_part';
const ROOM_ID = 'room1';
const WOUNDED_PART_ID = 'actor-torso';
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

describe('first-aid:handle_rinse_my_wounded_part rule', () => {
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

    fixture.reset([room, medic, torso, waterSource]);
    fixture.clearEvents();

    return {
      medicId: medic.id,
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
    const { medicId, torsoId, waterSourceId } = loadScenario();

    await fixture.executeAction(medicId, medicId, {
      additionalPayload: {
        primaryId: torsoId,
        secondaryId: waterSourceId,
        targets: {
          primary: torsoId,
          secondary: waterSourceId,
        },
      },
    });

    const message =
      'Medic rinses their wounded torso with Water Canteen.';
    fixture.assertActionSuccess(message);
    fixture.assertPerceptibleEvent({
      descriptionText: message,
      locationId: ROOM_ID,
      actorId: medicId,
      targetId: medicId,
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
      fixture.entityManager.hasComponent(
        waterSourceId,
        'first-aid:rinsed'
      )
    ).toBe(false);
  });

  it('ignores unrelated actions', async () => {
    const { medicId } = loadScenario();

    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: medicId,
      actionId: 'core:wait',
      targetId: medicId,
      originalInput: 'wait',
    });

    fixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('requests description regeneration for the actor and wounded part', () => {
    const regenOps = rinseRule.actions.filter(
      (action) => action.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenOps).toHaveLength(2);
    const entityRefs = regenOps.map((action) => action.parameters.entity_ref);
    expect(entityRefs).toEqual(expect.arrayContaining(['actor', 'primary']));
  });
});
