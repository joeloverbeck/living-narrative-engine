import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import handleScootCloserRightRule from '../../../../data/mods/personal-space/rules/handle_scoot_closer_right.rule.json' assert { type: 'json' };
import eventIsActionScootCloserRight from '../../../../data/mods/personal-space/conditions/event-is-action-scoot-closer-right.condition.json' assert { type: 'json' };
import scootCloserRightAction from '../../../../data/mods/personal-space/actions/scoot_closer_right.action.json' assert { type: 'json' };

describe('scoot_closer_right action discovery - Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:scoot_closer_right',
      handleScootCloserRightRule,
      eventIsActionScootCloserRight
    );

    if (testFixture.testEnv) {
      ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
      testFixture.testEnv.actionIndex.buildIndex([scootCloserRightAction]);
    }
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Valid discovery scenarios', () => {
    it('should discover scoot_closer_right when an actor can move right toward an occupant', async () => {
      // Furniture layout: [actor1, null, occupant1]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', null, 'occupant1'],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const occupant = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, actor, occupant]);

      const actions = await testFixture.discoverActions('actor1');
      const scootAction = actions.find(
        (action) => action.id === 'personal-space:scoot_closer_right'
      );

      expect(scootAction).toBeDefined();
      expect(scootAction.targets?.secondary?.scope).toBe(
        'sitting-states:closest_rightmost_occupant'
      );
    });
  });

  describe('Negative discovery scenarios', () => {
    it('should NOT discover scoot_closer_right when the immediate spot to the right is occupied', async () => {
      // Furniture layout: [actor1, occupant1, occupant2]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['actor1', 'occupant1', 'occupant2'],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      const occupant1 = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 1,
        })
        .build();

      const occupant2 = new ModEntityBuilder('occupant2')
        .withName('Carol')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 2,
        })
        .build();

      testFixture.reset([room, furniture, actor, occupant1, occupant2]);

      const actions = await testFixture.discoverActions('actor1');
      const scootAction = actions.find(
        (action) => action.id === 'personal-space:scoot_closer_right'
      );

      expect(scootAction).toBeUndefined();
    });

    it('should NOT discover scoot_closer_right when the actor is already the rightmost occupant', async () => {
      // Furniture layout: [occupant1, actor1]
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const furniture = new ModEntityBuilder('furniture1')
        .withName('bench')
        .atLocation('room1')
        .withComponent('sitting:allows_sitting', {
          spots: ['occupant1', 'actor1'],
        })
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 1,
        })
        .build();

      const occupant = new ModEntityBuilder('occupant1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'furniture1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, furniture, actor, occupant]);

      const actions = await testFixture.discoverActions('actor1');
      const scootAction = actions.find(
        (action) => action.id === 'personal-space:scoot_closer_right'
      );

      expect(scootAction).toBeUndefined();
    });

    it('should NOT discover scoot_closer_right when actor is not sitting', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, actor]);

      const actions = await testFixture.discoverActions('actor1');
      const scootAction = actions.find(
        (action) => action.id === 'personal-space:scoot_closer_right'
      );

      expect(scootAction).toBeUndefined();
    });
  });
});
