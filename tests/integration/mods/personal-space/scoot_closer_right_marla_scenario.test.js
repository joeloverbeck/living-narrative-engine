/**
 * @file Integration test reproducing a mirrored Marla scenario where scoot_closer_right action should be discovered
 * Scenario: [marla, null, iker] sitting arrangement where Marla should be able to scoot right
 * @see src/logic/operators/isClosestRightOccupantOperator.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleScootCloserRightRule from '../../../../data/mods/personal-space/rules/handle_scoot_closer_right.rule.json' assert { type: 'json' };
import eventIsActionScootCloserRight from '../../../../data/mods/personal-space/conditions/event-is-action-scoot-closer-right.condition.json' assert { type: 'json' };

describe('scoot_closer_right action discovery - Marla scenario reproduction', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer_right',
      handleScootCloserRightRule,
      eventIsActionScootCloserRight
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover scoot_closer_right for Marla with arrangement [marla, null, iker]', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Bar').build();

    const barStools = new ModEntityBuilder('bar_stools_1')
      .withName('bar stools')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', {
        spots: ['marla_kern_instance', null, 'iker_aguirre_instance'],
      })
      .build();

    const marla = new ModEntityBuilder('marla_kern_instance')
      .withName('Marla')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 0,
      })
      .build();

    const iker = new ModEntityBuilder('iker_aguirre_instance')
      .withName('Iker')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 2,
      })
      .build();

    testFixture.reset([room, barStools, marla, iker]);

    const actions = await testFixture.discoverActions('marla_kern_instance');
    const scootAction = actions.find(
      (action) => action.id === 'personal-space:scoot_closer_right'
    );

    expect(scootAction).toBeDefined();
  });

  it('should NOT discover scoot_closer_right when actor is at rightmost position', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Bar').build();

    const barStools = new ModEntityBuilder('bar_stools_1')
      .withName('bar stools')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', {
        spots: ['iker_aguirre_instance', null, 'marla_kern_instance'],
      })
      .build();

    const marla = new ModEntityBuilder('marla_kern_instance')
      .withName('Marla')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 2,
      })
      .build();

    const iker = new ModEntityBuilder('iker_aguirre_instance')
      .withName('Iker')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 0,
      })
      .build();

    testFixture.reset([room, barStools, marla, iker]);

    const actions = await testFixture.discoverActions('marla_kern_instance');
    const scootAction = actions.find(
      (action) => action.id === 'personal-space:scoot_closer_right'
    );

    expect(scootAction).toBeUndefined();
  });

  it('should discover scoot_closer_right with arrangement [actor, null, occupant1, occupant2]', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Bar').build();

    const barStools = new ModEntityBuilder('bar_stools_1')
      .withName('bar stools')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', {
        spots: [
          'marla_kern_instance',
          null,
          'bob_instance',
          'iker_aguirre_instance',
        ],
      })
      .build();

    const marla = new ModEntityBuilder('marla_kern_instance')
      .withName('Marla')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 0,
      })
      .build();

    const bob = new ModEntityBuilder('bob_instance')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 2,
      })
      .build();

    const iker = new ModEntityBuilder('iker_aguirre_instance')
      .withName('Iker')
      .atLocation('room1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 3,
      })
      .build();

    testFixture.reset([room, barStools, marla, bob, iker]);

    const actions = await testFixture.discoverActions('marla_kern_instance');
    const scootAction = actions.find(
      (action) => action.id === 'personal-space:scoot_closer_right'
    );

    expect(scootAction).toBeDefined();
  });
});
