/**
 * @file Integration tests for positioning:sit_down action discovery.
 * @description Tests forbidden components including fucking_anally.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios, ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitDownAction from '../../../../data/mods/positioning/actions/sit_down.action.json';

describe('positioning:sit_down action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Forbidden components validation', () => {
    it('should have correct forbidden components structure', () => {
      expect(sitDownAction.forbidden_components).toBeDefined();
      expect(sitDownAction.forbidden_components.actor).toBeInstanceOf(Array);
      expect(sitDownAction.forbidden_components.actor).toContain('positioning:sitting_on');
      expect(sitDownAction.forbidden_components.actor).toContain('positioning:kneeling_before');
    });

    it('should NOT appear when actor has fucking_anally component', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Alice is actively fucking someone anally
      scenario.actor.components['positioning:fucking_anally'] = {
        being_fucked_entity_id: 'other_entity',
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation(room.id)
        .withComponent('positioning:allows_sitting_on', {})
        .build();

      testFixture.reset([room, chair, scenario.actor]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('positioning:sit_down');
    });
  });
});
