/**
 * @file Integration tests for discovering maneuvering:place_yourself_behind with posture restrictions.
 * @description Ensures the action is not surfaced when the target is lying down.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

describe('maneuvering:place_yourself_behind discovery posture validation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'maneuvering',
      'maneuvering:place_yourself_behind'
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('executes successfully when the target is standing', async () => {
    const scenario = fixture.createStandardActorTarget(['Scout', 'Lookout']);

    await fixture.executeAction(scenario.actor.id, scenario.target.id);

    const target = fixture.entityManager.getEntityInstance(scenario.target.id);
    expect(target.components['positioning:facing_away']).toBeDefined();
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain(scenario.actor.id);
  });

  it('blocks execution when the target is lying down', async () => {
    const scenario = ModEntityScenarios.createActorTargetPair({
      names: ['Scout', 'Resting Ally'],
      location: 'room1',
      closeProximity: true,
    });
    const room = ModEntityScenarios.createRoom('room1', 'Infirmary');
    const bed = new ModEntityBuilder('bed1')
      .withName('Recovery Cot')
      .atLocation('room1')
      .withComponent('positioning:allows_lying_on', {})
      .build();

    fixture.reset([room, bed, scenario.actor, scenario.target]);
    fixture.entityManager.addComponent(
      scenario.target.id,
      'positioning:lying_down',
      {
        furniture_id: bed.id,
      }
    );

    await expect(async () => {
      await fixture.executeAction(scenario.actor.id, scenario.target.id);
    }).rejects.toThrow(/forbidden component/i);

    const actor = fixture.entityManager.getEntityInstance(scenario.actor.id);
    expect(actor.components['positioning:facing_away']).toBeUndefined();
  });
});
