/**
 * @file Integration tests for facing:turn_your_back action discovery.
 * @description Tests forbidden components including fucking_anally.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import turnYourBackAction from '../../../../data/mods/facing/actions/turn_your_back.action.json';

describe('facing:turn_your_back action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'facing',
      'facing:turn_your_back'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Forbidden components validation', () => {
    it('should have correct forbidden components structure', () => {
      expect(turnYourBackAction.forbidden_components).toBeDefined();
      expect(turnYourBackAction.forbidden_components.actor).toBeInstanceOf(
        Array
      );
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'positioning:biting_neck'
      );
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'facing-states:facing_away'
      );
    });

    it('should NOT appear when actor has fucking_anally component', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Alice is actively fucking someone anally
      scenario.actor.components['sex-states:fucking_anally'] = {
        being_fucked_entity_id: 'other_entity',
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('facing:turn_your_back');
    });
  });
});
