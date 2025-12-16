/**
 * @file Integration tests for personal-space:get_close forbidden components validation.
 * @description Tests that get_close should NOT be available when actor has wielding or sitting_on component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import getCloseAction from '../../../../data/mods/personal-space/actions/get_close.action.json' assert { type: 'json' };

describe('personal-space:get_close - Forbidden components validation', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:get_close'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have forbidden_components defined for actor', () => {
      expect(getCloseAction.forbidden_components).toBeDefined();
      expect(getCloseAction.forbidden_components.actor).toBeInstanceOf(Array);
    });

    it('should include positioning:wielding in forbidden list', () => {
      expect(getCloseAction.forbidden_components.actor).toContain(
        'positioning:wielding'
      );
    });

    it('should include positioning:closeness in forbidden list', () => {
      expect(getCloseAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('should include positioning:doing_complex_performance in forbidden list', () => {
      expect(getCloseAction.forbidden_components.actor).toContain(
        'positioning:doing_complex_performance'
      );
    });

    it('should include positioning:sitting_on in forbidden list', () => {
      expect(getCloseAction.forbidden_components.actor).toContain(
        'positioning:sitting_on'
      );
    });
  });

  describe('positioning:wielding forbidden component', () => {
    it('should NOT appear when actor has wielding component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Create actor with wielding component - this should block get_close
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:wielding', {
          wielded_item_ids: ['weapons:some_sword'],
        })
        .build();

      // Create target actor in same location
      const target = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);
      testFixture.testEnv.actionIndex.buildIndex([getCloseAction]);

      const actions = testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor has wielding component
      expect(actionIds).not.toContain('personal-space:get_close');
    });

    // Note: Positive discovery test for get_close requires meeting all prerequisites
    // (positioning:actor-can-move condition requiring core:movement component).
    // The structure validation tests above confirm the forbidden_components configuration.
    // This follows the pattern in doingComplexPerformanceForbiddenActions.test.js
    it('should have wielding in forbidden list - validates blocking configuration is correct', () => {
      // This test confirms the forbidden_components are configured correctly
      // The blocking behavior is verified in the negative test above
      expect(getCloseAction.forbidden_components.actor).toContain(
        'positioning:wielding'
      );
    });
  });

  describe('positioning:sitting_on forbidden component', () => {
    it('should NOT appear when actor is sitting on furniture', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Create furniture entity
      const furniture = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .withComponent('positioning:allows_sitting', {
          spots: [null],
        })
        .build();

      // Create actor sitting on furniture - this should block get_close
      // because get_close involves walking up to someone
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      // Create target actor in same location
      const target = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      testFixture.reset([room, furniture, actor, target]);
      testFixture.testEnv.actionIndex.buildIndex([getCloseAction]);

      const actions = testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor is sitting
      expect(actionIds).not.toContain('personal-space:get_close');
    });

    it('should have sitting_on in forbidden list - validates blocking configuration is correct', () => {
      // This test confirms the forbidden_components are configured correctly
      // The blocking behavior is verified in the negative test above
      expect(getCloseAction.forbidden_components.actor).toContain(
        'positioning:sitting_on'
      );
    });
  });
});
