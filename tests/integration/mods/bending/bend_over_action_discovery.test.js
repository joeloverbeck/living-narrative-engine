/**
 * @file Integration tests for bending:bend_over action discovery.
 * @description Tests forbidden components including fucking_anally.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import bendOverAction from '../../../../data/mods/bending/actions/bend_over.action.json';

describe('bending:bend_over action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'bending:bend_over'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Forbidden components validation', () => {
    it('should have correct forbidden components structure', () => {
      expect(bendOverAction.forbidden_components).toBeDefined();
      expect(bendOverAction.forbidden_components.actor).toBeInstanceOf(Array);
      expect(bendOverAction.forbidden_components.actor).toContain(
        'hugging-states:being_hugged'
      );
      expect(bendOverAction.forbidden_components.actor).toContain(
        'biting-states:biting_neck'
      );
    });

    it('should NOT appear when actor has fucking_anally component', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Alice is actively fucking someone anally
      scenario.actor.components['sex-states:fucking_anally'] = {
        being_fucked_entity_id: 'other_entity',
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const furniture = new ModEntityBuilder('table1')
        .withName('Table')
        .atLocation(room.id)
        .withComponent('bending:allows_bending_over', {})
        .build();

      testFixture.reset([room, furniture, scenario.actor]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('bending:bend_over');
    });
  });
});
