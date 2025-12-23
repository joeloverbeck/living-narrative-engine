/**
 * @file Unit tests for sitting scenario builders
 * @description Validates the high-level ModEntityScenarios sitting arrangement helpers
 */

import { describe, it, expect } from '@jest/globals';
import { ModEntityScenarios } from '../../../../tests/common/mods/ModEntityBuilder.js';

const getComponent = (entity, componentId) => entity.components[componentId];

describe('ModEntityScenarios sitting helpers', () => {
  it('should create a default sitting pair with closeness metadata', () => {
    const scenario = ModEntityScenarios.createSittingPair();

    expect(Array.isArray(scenario.entities)).toBe(true);
    expect(scenario.entities.length).toBeGreaterThanOrEqual(4);

    const furniture = scenario.furniture;
    const furnitureSitting = getComponent(
      furniture,
      'sitting:allows_sitting'
    );
    expect(furnitureSitting.spots).toEqual(['actor1', 'actor2']);

    const [room, , actor1, actor2] = scenario.entities;
    expect(room.id).toBe('room1');

    const actor1Sitting = getComponent(actor1, 'sitting-states:sitting_on');
    const actor2Sitting = getComponent(actor2, 'sitting-states:sitting_on');
    expect(actor1Sitting).toMatchObject({
      furniture_id: 'couch1',
      spot_index: 0,
    });
    expect(actor2Sitting).toMatchObject({
      furniture_id: 'couch1',
      spot_index: 1,
    });

    const actor1Closeness = getComponent(actor1, 'personal-space-states:closeness');
    const actor2Closeness = getComponent(actor2, 'personal-space-states:closeness');
    expect(actor1Closeness.partners).toContain('actor2');
    expect(actor2Closeness.partners).toContain('actor1');
  });

  it('should respect closeSeatedActors flag when disabled', () => {
    const scenario = ModEntityScenarios.createSittingPair({
      closeSeatedActors: false,
    });

    const [, , actor1, actor2] = scenario.entities;
    expect(getComponent(actor1, 'personal-space-states:closeness')).toBeUndefined();
    expect(getComponent(actor2, 'personal-space-states:closeness')).toBeUndefined();
  });

  it('should create standing actors with optional behind targeting metadata', () => {
    const scenario = ModEntityScenarios.createStandingNearSitting({
      standingActors: [
        {
          id: 'standing1',
          name: 'Dana',
          behindTargetId: 'actor1',
          closeTo: 'actor1',
        },
      ],
    });

    const standingActor = scenario.standingActors[0];
    expect(getComponent(standingActor, 'positioning:standing')).toEqual({});
    expect(getComponent(standingActor, 'positioning:standing_behind')).toEqual({
      entityId: 'actor1',
    });
    expect(
      getComponent(standingActor, 'personal-space-states:closeness').partners
    ).toContain('actor1');
  });

  it('should throw when attempting to create a sitting arrangement with no seated actors', () => {
    expect(() =>
      ModEntityScenarios.createSittingArrangement({ seatedActors: [] })
    ).toThrow('at least one seated actor');
  });

  it('should create distinct furniture entities for separate furniture arrangement', () => {
    const scenario = ModEntityScenarios.createSeparateFurnitureArrangement();

    expect(Array.isArray(scenario.furniture)).toBe(true);
    expect(scenario.furniture).toHaveLength(2);

    const [leftFurniture, rightFurniture] = scenario.furniture;
    expect(
      getComponent(leftFurniture, 'sitting:allows_sitting').spots
    ).toEqual(['actor1']);
    expect(
      getComponent(rightFurniture, 'sitting:allows_sitting').spots
    ).toEqual(['actor2']);

    const actor1 = scenario.seatedActors.find(
      (entity) => entity.id === 'actor1'
    );
    const actor2 = scenario.seatedActors.find(
      (entity) => entity.id === 'actor2'
    );
    expect(getComponent(actor1, 'sitting-states:sitting_on').furniture_id).toBe(
      leftFurniture.id
    );
    expect(getComponent(actor2, 'sitting-states:sitting_on').furniture_id).toBe(
      rightFurniture.id
    );
  });

  it('should create kneeling actors tied to the seated actor', () => {
    const scenario = ModEntityScenarios.createKneelingBeforeSitting();

    expect(scenario.kneelingActors).toHaveLength(1);
    const kneelingActor = scenario.kneelingActors[0];
    expect(getComponent(kneelingActor, 'deference-states:kneeling_before')).toEqual({
      entityId: 'actor1',
    });
    expect(
      getComponent(kneelingActor, 'personal-space-states:closeness').partners
    ).toContain('actor1');
  });
});
