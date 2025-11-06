/**
 * @file Integration tests verifying that specific actions are correctly forbidden when actor has doing_complex_performance component.
 * @description Ensures that actions requiring free hands/focus are not available when the acting actor
 * has the positioning:doing_complex_performance component (e.g., playing a musical instrument).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios, ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import removeClothingAction from '../../../../data/mods/clothing/actions/remove_clothing.action.json';
import buryFaceInHandsAction from '../../../../data/mods/distress/actions/bury_face_in_hands.action.json';
import dropItemAction from '../../../../data/mods/items/actions/drop_item.action.json';
import examineItemAction from '../../../../data/mods/items/actions/examine_item.action.json';
import brushHairBackCoylyAction from '../../../../data/mods/seduction/actions/brush_hair_back_coyly.action.json';
import drawAttentionToAssAction from '../../../../data/mods/seduction/actions/draw_attention_to_ass.action.json';
import drawAttentionToBreastsAction from '../../../../data/mods/seduction/actions/draw_attention_to_breasts.action.json';
import grabCrotchDrawAttentionAction from '../../../../data/mods/seduction/actions/grab_crotch_draw_attention.action.json';
import stretchSexilyAction from '../../../../data/mods/seduction/actions/stretch_sexily.action.json';

/**
 * Test suite for verifying forbidden component behavior for various actions
 * when actor has doing_complex_performance component.
 */
describe('actions forbidden when doing complex performance', () => {
  let testFixture;

  beforeEach(async () => {
    // Use any simple action for fixture initialization
    testFixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('remove_clothing should have positioning:doing_complex_performance as forbidden component', () => {
      expect(removeClothingAction.forbidden_components).toBeDefined();
      expect(removeClothingAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('bury_face_in_hands should have positioning:doing_complex_performance as forbidden component', () => {
      expect(buryFaceInHandsAction.forbidden_components).toBeDefined();
      expect(buryFaceInHandsAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('drop_item should have positioning:doing_complex_performance as forbidden component', () => {
      expect(dropItemAction.forbidden_components).toBeDefined();
      expect(dropItemAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('examine_item should have positioning:doing_complex_performance as forbidden component', () => {
      expect(examineItemAction.forbidden_components).toBeDefined();
      expect(examineItemAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('brush_hair_back_coyly should have positioning:doing_complex_performance as forbidden component', () => {
      expect(brushHairBackCoylyAction.forbidden_components).toBeDefined();
      expect(brushHairBackCoylyAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('draw_attention_to_ass should have positioning:doing_complex_performance as forbidden component', () => {
      expect(drawAttentionToAssAction.forbidden_components).toBeDefined();
      expect(drawAttentionToAssAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('draw_attention_to_breasts should have positioning:doing_complex_performance as forbidden component', () => {
      expect(drawAttentionToBreastsAction.forbidden_components).toBeDefined();
      expect(drawAttentionToBreastsAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('grab_crotch_draw_attention should have positioning:doing_complex_performance as forbidden component', () => {
      expect(grabCrotchDrawAttentionAction.forbidden_components).toBeDefined();
      expect(grabCrotchDrawAttentionAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('stretch_sexily should have positioning:doing_complex_performance as forbidden component', () => {
      expect(stretchSexilyAction.forbidden_components).toBeDefined();
      expect(stretchSexilyAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
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
            equipped_items: ['shirt1']
          })
          .withComponent('positioning:doing_complex_performance', {})
          .build();

        // Create a clothing item
        const shirt = new ModEntityBuilder('shirt1')
          .withName('shirt')
          .withComponent('items:item', {})
          .withComponent('clothing:clothing', {
            slot: 'torso_upper',
            layer: 1
          })
          .build();

        testFixture.reset([room, actor, shirt]);
        testFixture.testEnv.actionIndex.buildIndex([removeClothingAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
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
          .withComponent('positioning:doing_complex_performance', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([buryFaceInHandsAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
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
          .withComponent('items:inventory', {
            items: ['book1'],
            max_weight: 100,
            current_weight: 5
          })
          .withComponent('positioning:doing_complex_performance', {})
          .build();

        const book = new ModEntityBuilder('book1')
          .withName('book')
          .withComponent('items:item', {})
          .withComponent('items:portable', { weight: 5 })
          .withComponent('core:description', {
            short: 'a leather-bound book',
            long: 'A hefty tome bound in worn leather.'
          })
          .build();

        testFixture.reset([room, actor, book]);
        testFixture.testEnv.actionIndex.buildIndex([dropItemAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('items:drop_item');
      });

      it('examine_item is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('positioning:doing_complex_performance', {})
          .build();

        const vase = new ModEntityBuilder('vase1')
          .withName('vase')
          .atLocation('room1')
          .withComponent('items:item', {})
          .withComponent('core:description', {
            short: 'a ceramic vase',
            long: 'An ornate ceramic vase with floral patterns.'
          })
          .build();

        testFixture.reset([room, actor, vase]);
        testFixture.testEnv.actionIndex.buildIndex([examineItemAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
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
          .withComponent('positioning:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([brushHairBackCoylyAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:brush_hair_back_coyly');
      });

      it('draw_attention_to_ass is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('positioning:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([drawAttentionToAssAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:draw_attention_to_ass');
      });

      it('draw_attention_to_breasts is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('positioning:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([drawAttentionToBreastsAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:draw_attention_to_breasts');
      });

      it('grab_crotch_draw_attention is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('positioning:doing_complex_performance', {})
          .withComponent('anatomy:has_anatomy', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([grabCrotchDrawAttentionAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:grab_crotch_draw_attention');
      });

      it('stretch_sexily is NOT available when actor is doing complex performance', () => {
        const room = ModEntityScenarios.createRoom('room1', 'Test Room');

        const actor = new ModEntityBuilder('actor1')
          .withName('Performer')
          .atLocation('room1')
          .asActor()
          .withComponent('positioning:doing_complex_performance', {})
          .build();

        testFixture.reset([room, actor]);
        testFixture.testEnv.actionIndex.buildIndex([stretchSexilyAction]);

        const availableActions = testFixture.testEnv.getAvailableActions('actor1');
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain('seduction:stretch_sexily');
      });
    });
  });

  describe('Action discovery when NOT doing complex performance', () => {
    it('actions should be available under normal circumstances without doing_complex_performance', () => {
      // This test confirms that the absence of doing_complex_performance
      // does not prevent action discovery (assuming other requirements are met)
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Regular Actor')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, actor]);
      testFixture.testEnv.actionIndex.buildIndex([stretchSexilyAction]);

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const ids = availableActions.map((action) => action.id);

      // stretch_sexily has no special requirements, so should be available
      expect(ids).toContain('seduction:stretch_sexily');
    });
  });
});
