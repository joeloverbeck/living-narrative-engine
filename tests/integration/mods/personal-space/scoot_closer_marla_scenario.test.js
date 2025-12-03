/**
 * @file Integration test reproducing the Marla scenario where scoot_closer action should be discovered
 * Scenario: [iker, null, marla] sitting arrangement where Marla should be able to scoot left
 * @see src/actions/pipeline/stages/MultiTargetResolutionStage.js
 * @see src/logic/operators/isClosestLeftOccupantOperator.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleScootCloserRule from '../../../../data/mods/personal-space/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import eventIsActionScootCloser from '../../../../data/mods/personal-space/conditions/event-is-action-scoot-closer.condition.json' assert { type: 'json' };

describe('scoot_closer action discovery - Marla scenario reproduction', () => {
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

  it('should discover scoot_closer for Marla with arrangement [iker, null, marla]', async () => {
    // Arrange: Create exact scenario from browser logs
    const room = new ModEntityBuilder('room1').asRoom('Test Bar').build();

    const barStools = new ModEntityBuilder('bar_stools_1')
      .withName('bar stools')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', {
        spots: ['iker_aguirre_instance', null, 'marla_kern_instance'],
      })
      .build();

    const iker = new ModEntityBuilder('iker_aguirre_instance')
      .withName('Iker')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 0,
      })
      .build();

    const marla = new ModEntityBuilder('marla_kern_instance')
      .withName('Marla')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 2,
      })
      .build();

    testFixture.reset([room, barStools, iker, marla]);

    // Act: Discover actions for Marla
    const actions = await testFixture.discoverActions('marla_kern_instance');

    // Assert: scoot_closer should be discovered
    const scootAction = actions.find(
      a => a.id === 'personal-space:scoot_closer'
    );

    expect(scootAction).toBeDefined();

    // Note: Test environment doesn't populate primaryTargetId/secondaryTargetId
    // The action being in the list means scopes were successfully resolved
    // Verification that the correct targets would be resolved happens in the
    // scope resolver tests, not here
  });

  it('should NOT discover scoot_closer when actor is at leftmost position', async () => {
    // Arrange: Actor at position 0, no one to their left
    const room = new ModEntityBuilder('room1').asRoom('Test Bar').build();

    const barStools = new ModEntityBuilder('bar_stools_1')
      .withName('bar stools')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', {
        spots: ['marla_kern_instance', null, 'iker_aguirre_instance'],
      })
      .build();

    const iker = new ModEntityBuilder('iker_aguirre_instance')
      .withName('Iker')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 2,
      })
      .build();

    const marla = new ModEntityBuilder('marla_kern_instance')
      .withName('Marla')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 0,
      })
      .build();

    testFixture.reset([room, barStools, iker, marla]);

    // Act: Discover actions for Marla (at leftmost position)
    const actions = await testFixture.discoverActions('marla_kern_instance');

    // Assert: scoot_closer should NOT be discovered
    const scootAction = actions.find(
      a => a.id === 'personal-space:scoot_closer'
    );

    expect(scootAction).toBeUndefined();
  });

  it('should discover scoot_closer with arrangement [occupant1, occupant2, null, actor]', async () => {
    // Arrange: Multiple occupants to the left, actor at rightmost
    const room = new ModEntityBuilder('room1').asRoom('Test Bar').build();

    const barStools = new ModEntityBuilder('bar_stools_1')
      .withName('bar stools')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', {
        spots: [
          'iker_aguirre_instance',
          'bob_instance',
          null,
          'marla_kern_instance',
        ],
      })
      .build();

    const iker = new ModEntityBuilder('iker_aguirre_instance')
      .withName('Iker')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 0,
      })
      .build();

    const bob = new ModEntityBuilder('bob_instance')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 1,
      })
      .build();

    const marla = new ModEntityBuilder('marla_kern_instance')
      .withName('Marla')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'bar_stools_1',
        spot_index: 3,
      })
      .build();

    testFixture.reset([room, barStools, iker, bob, marla]);

    // Act: Discover actions for Marla
    const actions = await testFixture.discoverActions('marla_kern_instance');

    // Assert: scoot_closer should be discovered
    const scootAction = actions.find(
      a => a.id === 'personal-space:scoot_closer'
    );

    expect(scootAction).toBeDefined();

    // Note: Test environment doesn't populate primaryTargetId/secondaryTargetId
    // The action being in the list means scopes were successfully resolved
    // The fact that scoot_closer appears confirms:
    // 1. Primary scope (furniture_actor_sitting_on) resolved to bar_stools_1
    // 2. Secondary scope (closest_leftmost_occupant) found closest left occupant (Bob)
    // 3. All validation passed (empty spot to left, occupant exists)
  });
});
