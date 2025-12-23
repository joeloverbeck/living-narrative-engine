import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleScootCloserRule from '../../../../data/mods/personal-space/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import eventIsActionScootCloser from '../../../../data/mods/personal-space/conditions/event-is-action-scoot-closer.condition.json' assert { type: 'json' };

const getComponent = (fixture, entityId, componentId) =>
  fixture.entityManager.getComponentData(entityId, componentId);

describe('Sitting scenario helpers - integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer',
      handleScootCloserRule,
      eventIsActionScootCloser
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should execute scoot_closer using createSittingPair', async () => {
    const scenario = testFixture.createSittingPair({
      furnitureId: 'sofa1',
      furnitureName: 'Integration Sofa',
      seatedActors: [
        { id: 'actor1', name: 'Mover', spotIndex: 2 },
        { id: 'actor2', name: 'Partner', spotIndex: 0 },
      ],
    });

    await testFixture.executeAction('actor1', scenario.furniture.id, {
      additionalPayload: { secondaryId: 'actor2' },
    });

    const actorSitting = getComponent(
      testFixture,
      'actor1',
      'sitting-states:sitting_on'
    );
    expect(actorSitting.spot_index).toBe(1);
    expect(actorSitting.furniture_id).toBe('sofa1');

    const furnitureSpots = getComponent(
      testFixture,
      scenario.furniture.id,
      'sitting:allows_sitting'
    );
    expect(furnitureSpots.spots).toEqual(['actor2', 'actor1', null]);
  });

  it('should leave separate furniture untouched when movement is not possible', async () => {
    const scenario = testFixture.createSeparateFurnitureArrangement({
      furnitureId: 'seat_left',
      furnitureName: 'Left Seat',
      additionalFurniture: [{ id: 'seat_right', name: 'Right Seat' }],
    });

    const furnitureList = Array.isArray(scenario.furniture)
      ? scenario.furniture
      : [scenario.furniture];
    const [leftFurniture, rightFurniture] = furnitureList;

    await testFixture.executeAction('actor1', leftFurniture.id, {
      additionalPayload: { secondaryId: 'actor2' },
    });

    const actor1Sitting = getComponent(
      testFixture,
      'actor1',
      'sitting-states:sitting_on'
    );
    expect(actor1Sitting.spot_index).toBe(0);

    const leftSpots = getComponent(
      testFixture,
      leftFurniture.id,
      'sitting:allows_sitting'
    );
    expect(leftSpots.spots).toEqual(['actor1']);

    const rightSpots = getComponent(
      testFixture,
      rightFurniture.id,
      'sitting:allows_sitting'
    );
    expect(rightSpots.spots).toEqual(['actor2']);
  });

  it('should preserve kneeling relationships when the seated actor moves', async () => {
    const scenario = testFixture.createKneelingBeforeSitting({
      furnitureId: 'ritual_seat',
      furnitureName: 'Ritual Seat',
      seatedActors: [
        { id: 'actor1', name: 'Leader', spotIndex: 2 },
        { id: 'actor2', name: 'Attendant', spotIndex: 0 },
      ],
    });

    await testFixture.executeAction('actor1', scenario.furniture.id, {
      additionalPayload: { secondaryId: 'actor2' },
    });

    const actorSitting = getComponent(
      testFixture,
      'actor1',
      'sitting-states:sitting_on'
    );
    expect(actorSitting.spot_index).toBe(1);

    const kneelingActor = scenario.kneelingActors[0];
    const kneelingState = getComponent(
      testFixture,
      kneelingActor.id,
      'deference-states:kneeling_before'
    );
    expect(kneelingState.entityId).toBe('actor1');
  });
});
