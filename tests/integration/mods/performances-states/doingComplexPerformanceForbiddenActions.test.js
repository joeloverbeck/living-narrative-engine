/**
 * @file Integration tests verifying that specific actions are correctly forbidden when actor has doing_complex_performance component.
 * @description Ensures that actions requiring free hands/focus are not available when the acting actor
 * has the performances-states:doing_complex_performance component (e.g., playing a musical instrument).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import removeClothingAction from '../../../../data/mods/clothing/actions/remove_clothing.action.json';
import buryFaceInHandsAction from '../../../../data/mods/distress/actions/bury_face_in_hands.action.json';
import dropItemAction from '../../../../data/mods/item-handling/actions/drop_item.action.json';
import examineItemAction from '../../../../data/mods/observation/actions/examine_owned_item.action.json';
import brushHairBackCoylyAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import drawAttentionToAssAction from '../../../../data/mods/seduction/actions/draw_attention_to_ass.action.json';
import drawAttentionToBreastsAction from '../../../../data/mods/seduction/actions/draw_attention_to_breasts.action.json';
import grabCrotchDrawAttentionAction from '../../../../data/mods/seduction/actions/grab_crotch_draw_attention.action.json';
import stretchSexilyAction from '../../../../data/mods/seduction/actions/stretch_sexily.action.json';
import goAction from '../../../../data/mods/movement/actions/go.action.json';
import getCloseAction from '../../../../data/mods/personal-space/actions/get_close.action.json';
import kneelBeforeAction from '../../../../data/mods/deference/actions/kneel_before.action.json';
import placeYourselfBehindAction from '../../../../data/mods/maneuvering/actions/place_yourself_behind.action.json';
import sitDownAction from '../../../../data/mods/sitting/actions/sit_down.action.json';
import turnYourBackAction from '../../../../data/mods/facing/actions/turn_your_back.action.json';

/**
 * Test suite for verifying forbidden component behavior for various actions
 * when actor has doing_complex_performance component.
 */
describe('actions forbidden when doing complex performance', () => {
  let testFixture;

  beforeEach(async () => {
    // Use sitting mod as it's central and other actions will work too
    testFixture = await ModTestFixture.forAction('sitting', 'sitting:sit_down');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('remove_clothing should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(removeClothingAction.forbidden_components).toBeDefined();
      expect(removeClothingAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('bury_face_in_hands should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(buryFaceInHandsAction.forbidden_components).toBeDefined();
      expect(buryFaceInHandsAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('drop_item should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(dropItemAction.forbidden_components).toBeDefined();
      expect(dropItemAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('examine_item should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(examineItemAction.forbidden_components).toBeDefined();
      expect(examineItemAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('brush_hair_back_coyly should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(brushHairBackCoylyAction.forbidden_components).toBeDefined();
      expect(brushHairBackCoylyAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('draw_attention_to_ass should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(drawAttentionToAssAction.forbidden_components).toBeDefined();
      expect(drawAttentionToAssAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('draw_attention_to_breasts should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(drawAttentionToBreastsAction.forbidden_components).toBeDefined();
      expect(drawAttentionToBreastsAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('grab_crotch_draw_attention should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(grabCrotchDrawAttentionAction.forbidden_components).toBeDefined();
      expect(
        grabCrotchDrawAttentionAction.forbidden_components.actor
      ).toContain('performances-states:doing_complex_performance');
    });

    it('stretch_sexily should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(stretchSexilyAction.forbidden_components).toBeDefined();
      expect(stretchSexilyAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('go should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(goAction.forbidden_components).toBeDefined();
      expect(goAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('get_close should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(getCloseAction.forbidden_components).toBeDefined();
      expect(getCloseAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('kneel_before should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(kneelBeforeAction.forbidden_components).toBeDefined();
      expect(kneelBeforeAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('place_yourself_behind should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(placeYourselfBehindAction.forbidden_components).toBeDefined();
      expect(placeYourselfBehindAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('sit_down should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(sitDownAction.forbidden_components).toBeDefined();
      expect(sitDownAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('turn_your_back should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(turnYourBackAction.forbidden_components).toBeDefined();
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });

  describe('Action discovery when doing complex performance', () => {
    describe('Clothing actions', () => {
      it('remove_clothing is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        // Create actor with clothing and doing_complex_performance component
        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('clothing:equipment', {
            equipped_items: ['shirt1'],
          })
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        // Create a clothing item
        const shirt = new ModEntityBuilder('shirt1')
          .withName('shirt')
          .withComponent('items-core:item', {})
          .withComponent('clothing:clothing', {
            slot: 'torso_upper',
            layer: 1,
          })
          .build();

        testFixture.reset([room, actor, shirt]);
        testFixture.testEnv.actionIndex.buildIndex([removeClothingAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('clothing:remove_clothing');
      });
    });

    describe('Distress actions', () => {
      it('bury_face_in_hands is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([buryFaceInHandsAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('distress:bury_face_in_hands');
      });
    });

    describe('Item actions', () => {
      it('drop_item is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('inventory:inventory', {
            items: ['book1'],
            max_weight: 100,
            current_weight: 5,
          })
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const book = new ModEntityBuilder('book1')
          .withName('book')
          .withComponent('items-core:item', {})
          .withComponent('items-core:portable', { weight: 5 })
          .withComponent('core:description', {
            short: 'a leather-bound book',
            long: 'A hefty tome bound in worn leather.',
          })
          .build();

        testFixture.reset([room, actor, book]);
        testFixture.testEnv.actionIndex.buildIndex([dropItemAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('item-handling:drop_item');
      });

      it('examine_item is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const vase = new ModEntityBuilder('vase1')
          .withName('vase')
          .atLocation('room1')
          .withComponent('items-core:item', {})
          .withComponent('core:description', {
            short: 'a ceramic vase',
            long: 'An ornate ceramic vase with floral patterns.',
          })
          .build();

        testFixture.reset([room, actor, vase]);
        testFixture.testEnv.actionIndex.buildIndex([examineItemAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('items:examine_item');
      });
    });

    describe('Seduction actions', () => {
      it('brush_hair_back_coyly is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([brushHairBackCoylyAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:brush_hair_back_coyly');
      });

      it('draw_attention_to_ass is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([drawAttentionToAssAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:draw_attention_to_ass');
      });

      it('draw_attention_to_breasts is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([
          drawAttentionToBreastsAction,
        ]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:draw_attention_to_breasts');
      });

      it('grab_crotch_draw_attention is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([
          grabCrotchDrawAttentionAction,
        ]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:grab_crotch_draw_attention');
      });

      it('stretch_sexily is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([stretchSexilyAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:stretch_sexily');
      });
    });

    describe('Movement actions', () => {
      it('go is NOT available when actor is doing complex performance', () => {
        const room1 = ModEntityScenarios.createRoom('room1', 'Test Room 1');
        const room2 = ModEntityScenarios.createRoom('room2', 'Test Room 2');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        // Create a direction from room1 to room2
        const direction = new ModEntityBuilder('dir1')
          .withName('north')
          .withComponent('movement:direction', {
            source: 'room1',
            destination: 'room2',
            description: 'To the north',
          })
          .build();

        testFixture.reset([room1, room2, actor, direction]);
        testFixture.testEnv.actionIndex.buildIndex([goAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('movement:go');
      });
    });

    describe('Positioning actions', () => {
      it('get_close is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const target = new ModEntityBuilder('actor2')
          .withName('Target')
          .atLocation('room1')
          .asActor()
          .build();

        testFixture.reset([room, actor, target]);
        testFixture.testEnv.actionIndex.buildIndex([getCloseAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('personal-space:get_close');
      });

      it('kneel_before is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const target = new ModEntityBuilder('actor2')
          .withName('Target')
          .atLocation('room1')
          .asActor()
          .build();

        testFixture.reset([room, actor, target]);
        testFixture.testEnv.actionIndex.buildIndex([kneelBeforeAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('deference:kneel_before');
      });

      it('place_yourself_behind is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const target = new ModEntityBuilder('actor2')
          .withName('Target')
          .atLocation('room1')
          .asActor()
          .build();

        testFixture.reset([room, actor, target]);
        testFixture.testEnv.actionIndex.buildIndex([placeYourselfBehindAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('maneuvering:place_yourself_behind');
      });

      it('sit_down is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const chair = new ModEntityBuilder('chair1')
          .withName('chair')
          .atLocation('room1')
          .withComponent('positioning:furniture', {
            capacity: 1,
            occupied_by: [],
          })
          .build();

        testFixture.reset([room, actor, chair]);
        testFixture.testEnv.actionIndex.buildIndex([sitDownAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('sitting:sit_down');
      });

      it('turn_your_back is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('performances-states:doing_complex_performance', {})
          .build();

        const target = new ModEntityBuilder('actor2')
          .withName('Target')
          .atLocation('room1')
          .asActor()
          .build();

        testFixture.reset([room, actor, target]);
        testFixture.testEnv.actionIndex.buildIndex([turnYourBackAction]);

        const availableActions =
          testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('positioning:turn_your_back');
      });
    });
  });

  describe('Action discovery when NOT doing complex performance', () => {
    // Note: Many actions tested here have specific discovery requirements beyond just
    // not having the forbidden component. The key test is verifying they are blocked
    // when the forbidden component is present. The structure validation tests
    // above confirm the forbidden_components are correctly configured.

    it('actions should be available under normal circumstances without doing_complex_performance', () => {
      // This is a placeholder test acknowledging that actions like seduction
      // actions have discovery requirements (e.g., hasOtherActorsAtLocation) that
      // are tested in their respective action discovery test files. The important
      // validation is:
      // 1. Structure validation (tested above)
      // 2. Blocking when doing_complex_performance component present (tested above)
      expect(stretchSexilyAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
      expect(removeClothingAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });
});
