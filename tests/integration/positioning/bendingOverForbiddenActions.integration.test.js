/**
 * @file Integration tests proving that actors with bending_over component should not have access to certain actions.
 * @description This test file proves the bug where actors who are bending over can access actions they shouldn't.
 * The fix is to add positioning:bending_over to the forbidden_components.actor array in each action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

// Import all the actions that should be forbidden when bending over
import removeOthersClothingAction from '../../../data/mods/clothing/actions/remove_others_clothing.action.json' assert { type: 'json' };
import goAction from '../../../data/mods/movement/actions/go.action.json' assert { type: 'json' };
import followAction from '../../../data/mods/companionship/actions/follow.action.json' assert { type: 'json' };
import giveItemAction from '../../../data/mods/item-transfer/actions/give_item.action.json' assert { type: 'json' };
import pickUpItemAction from '../../../data/mods/items/actions/pick_up_item.action.json' assert { type: 'json' };
import placeYourselfBehindAction from '../../../data/mods/positioning/actions/place_yourself_behind.action.json' assert { type: 'json' };
import stepBackAction from '../../../data/mods/positioning/actions/step_back.action.json' assert { type: 'json' };
import turnAroundToFaceAction from '../../../data/mods/positioning/actions/turn_around_to_face.action.json' assert { type: 'json' };
import fondleBreastsOverClothesAction from '../../../data/mods/sex-breastplay/actions/fondle_breasts_over_clothes.action.json' assert { type: 'json' };
import fondleBreastsAction from '../../../data/mods/sex-breastplay/actions/fondle_breasts.action.json' assert { type: 'json' };
import lickBreastsAction from '../../../data/mods/sex-breastplay/actions/lick_breasts.action.json' assert { type: 'json' };
import suckOnNipplesAction from '../../../data/mods/sex-breastplay/actions/suck_on_nipples.action.json' assert { type: 'json' };
import nuzzleBareBreastsAction from '../../../data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json' assert { type: 'json' };
import pumpPenisAction from '../../../data/mods/sex-penile-manual/actions/pump_penis.action.json' assert { type: 'json' };
import slapAction from '../../../data/mods/violence/actions/slap.action.json' assert { type: 'json' };
import suckerPunchAction from '../../../data/mods/violence/actions/sucker_punch.action.json' assert { type: 'json' };

describe('Bending Over - Forbidden Actions Bug', () => {
  let testFixture;

  beforeEach(async () => {
    // Using positioning mod since bending_over is a positioning component
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:bend_over'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Movement Actions', () => {
    it('should NOT allow "go" action when actor is bending over', () => {
      // Setup: Actor bending over a table with a clear direction available
      const room1 = new ModEntityBuilder('test:room1')
        .asRoom('Room 1')
        .withComponent('core:position', {
          location_id: null,
          exits: { north: 'test:room2' },
        })
        .build();

      const room2 = new ModEntityBuilder('test:room2').asRoom('Room 2').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room1')
        .withComponent('core:actor', {})
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room1')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .build();

      testFixture.reset([room1, room2, table, actor]);
      testFixture.testEnv.actionIndex.buildIndex([goAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const goActions = availableActions.filter((a) => a.id === 'movement:go');

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      // After fix: should be 0
      expect(goActions.length).toBe(0);
    });

    it('should NOT allow "follow" action when actor is bending over', () => {
      // Setup: Actor bending over with a potential leader in the room
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const leader = new ModEntityBuilder('test:leader')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .build();

      testFixture.reset([room, table, leader, actor]);
      testFixture.testEnv.actionIndex.buildIndex([followAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const followActions = availableActions.filter(
        (a) => a.id === 'companionship:follow'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(followActions.length).toBe(0);
    });
  });

  describe('Item Actions', () => {
    it('should NOT allow "give_item" action when actor is bending over', () => {
      // Setup: Actor bending over with an item and a nearby recipient
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const item = new ModEntityBuilder('test:item')
        .withName('Letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('items:inventory', {
          items: ['test:item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const recipient = new ModEntityBuilder('test:recipient')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, table, item, actor, recipient]);
      testFixture.testEnv.actionIndex.buildIndex([giveItemAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const giveActions = availableActions.filter(
        (a) => a.id === 'item-transfer:give_item'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(giveActions.length).toBe(0);
    });

    it('should NOT allow "pick_up_item" action when actor is bending over', () => {
      // Setup: Actor bending over with an item on the ground
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const item = new ModEntityBuilder('test:item')
        .withName('Coin')
        .atLocation('test:room')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.01 })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, table, item, actor]);
      testFixture.testEnv.actionIndex.buildIndex([pickUpItemAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const pickUpActions = availableActions.filter(
        (a) => a.id === 'items:pick_up_item'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(pickUpActions.length).toBe(0);
    });
  });

  describe('Positioning Actions', () => {
    it('should NOT allow "place_yourself_behind" action when actor is bending over', () => {
      // Setup: Actor bending over with another actor in the room
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .build();

      testFixture.reset([room, table, actor, target]);
      testFixture.testEnv.actionIndex.buildIndex([placeYourselfBehindAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const placeActions = availableActions.filter(
        (a) => a.id === 'positioning:place_yourself_behind'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(placeActions.length).toBe(0);
    });

    it('should NOT allow "step_back" action when actor is bending over with closeness', () => {
      // Setup: Actor bending over but also close to someone
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, actor, target]);
      testFixture.testEnv.actionIndex.buildIndex([stepBackAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const stepBackActions = availableActions.filter(
        (a) => a.id === 'positioning:step_back'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(stepBackActions.length).toBe(0);
    });

    it('should NOT allow "turn_around_to_face" action when actor is bending over', () => {
      // Setup: Actor bending over but also close to someone and facing away
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .withComponent('positioning:facing_away', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, actor, target]);
      testFixture.testEnv.actionIndex.buildIndex([turnAroundToFaceAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const turnActions = availableActions.filter(
        (a) => a.id === 'positioning:turn_around_to_face'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(turnActions.length).toBe(0);
    });
  });

  describe('Clothing Actions', () => {
    it('should NOT allow "remove_others_clothing" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with clothing
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const jacket = new ModEntityBuilder('test:jacket')
        .withName('Jacket')
        .withComponent('items:item', {})
        .withComponent('clothing:clothing', {
          slot: 'torso_upper',
          coverage: { torso_upper: 1.0 },
        })
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .withComponent('clothing:equipped_clothing', {
          slots: {
            torso_upper: 'test:jacket',
          },
        })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .build();

      testFixture.reset([room, table, jacket, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([removeOthersClothingAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const removeActions = availableActions.filter(
        (a) => a.id === 'clothing:remove_others_clothing'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(removeActions.length).toBe(0);
    });
  });

  describe('Sexual Actions', () => {
    it('should NOT allow "fondle_breasts_over_clothes" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with breasts and clothing
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const shirt = new ModEntityBuilder('test:shirt')
        .withName('Shirt')
        .withComponent('items:item', {})
        .withComponent('clothing:clothing', {
          slot: 'torso_upper',
          coverage: { torso_upper: 1.0 },
        })
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Jane')
        .atLocation('test:room')
        .asActor()
        .withComponent('anatomy:breasts', {})
        .withComponent('clothing:equipped_clothing', {
          slots: {
            torso_upper: 'test:shirt',
          },
        })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, shirt, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([
        fondleBreastsOverClothesAction,
      ]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const fondleActions = availableActions.filter(
        (a) => a.id === 'sex-breastplay:fondle_breasts_over_clothes'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(fondleActions.length).toBe(0);
    });

    it('should NOT allow "fondle_breasts" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with breasts
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Jane')
        .atLocation('test:room')
        .asActor()
        .withComponent('anatomy:breasts', {})
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([fondleBreastsAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const fondleActions = availableActions.filter(
        (a) => a.id === 'sex-breastplay:fondle_breasts'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(fondleActions.length).toBe(0);
    });

    it('should NOT allow "lick_breasts" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with breasts, close and facing each other
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Jane')
        .atLocation('test:room')
        .asActor()
        .withComponent('anatomy:breasts', {})
        .withComponent('anatomy:body', {
          height: 'average',
          composition: 'organic',
        })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([lickBreastsAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const lickActions = availableActions.filter(
        (a) => a.id === 'sex-breastplay:lick_breasts'
      );

      // Should be 0 after fix
      expect(lickActions.length).toBe(0);
    });

    it('should NOT allow "suck_on_nipples" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with breasts, close and facing each other
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Jane')
        .atLocation('test:room')
        .asActor()
        .withComponent('anatomy:breasts', {})
        .withComponent('anatomy:body', {
          height: 'average',
          composition: 'organic',
        })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([suckOnNipplesAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const suckActions = availableActions.filter(
        (a) => a.id === 'sex-breastplay:suck_on_nipples'
      );

      // Should be 0 after fix
      expect(suckActions.length).toBe(0);
    });

    it('should NOT allow "nuzzle_bare_breasts" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with breasts, close and facing each other
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Jane')
        .atLocation('test:room')
        .asActor()
        .withComponent('anatomy:breasts', {})
        .withComponent('anatomy:body', {
          height: 'average',
          composition: 'organic',
        })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([nuzzleBareBreastsAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const nuzzleActions = availableActions.filter(
        (a) => a.id === 'sex-breastplay:nuzzle_bare_breasts'
      );

      // Should be 0 after fix
      expect(nuzzleActions.length).toBe(0);
    });

    it('should NOT allow "pump_penis" action when actor is bending over', () => {
      // Setup: Actor bending over near someone with penis, close and facing each other
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .withComponent('anatomy:penis', {})
        .withComponent('anatomy:body', {
          height: 'average',
          composition: 'organic',
        })
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .withComponent('positioning:closeness', { target_id: 'test:target' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([pumpPenisAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const pumpActions = availableActions.filter(
        (a) => a.id === 'sex-penile-manual:pump_penis'
      );

      // Should be 0 after fix
      expect(pumpActions.length).toBe(0);
    });
  });

  describe('Violence Actions', () => {
    it('should NOT allow "slap" action when actor is bending over', () => {
      // Setup: Actor bending over with another actor in the room
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([slapAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const slapActions = availableActions.filter(
        (a) => a.id === 'violence:slap'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(slapActions.length).toBe(0);
    });

    it('should NOT allow "sucker_punch" action when actor is bending over', () => {
      // Setup: Actor bending over with another actor in the room
      const room = new ModEntityBuilder('test:room').asRoom('Room').build();

      const table = new ModEntityBuilder('test:table')
        .withName('Table')
        .atLocation('test:room')
        .withComponent('core:actor', {})
        .build();

      const target = new ModEntityBuilder('test:target')
        .withName('Bob')
        .atLocation('test:room')
        .asActor()
        .build();

      const actor = new ModEntityBuilder('test:actor')
        .withName('Alice')
        .atLocation('test:room')
        .asActor()
        .withComponent('positioning:bending_over', { surface_id: 'test:table' })
        .build();

      testFixture.reset([room, table, target, actor]);
      testFixture.testEnv.actionIndex.buildIndex([suckerPunchAction]);

      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor');
      const punchActions = availableActions.filter(
        (a) => a.id === 'violence:sucker_punch'
      );

      // Currently FAILS - should be 0 but is > 0 (proving the bug)
      expect(punchActions.length).toBe(0);
    });
  });
});
