/**
 * @file Integration tests for lying:get_up_from_lying forbidden components validation.
 * @description Tests that get_up_from_lying should NOT be available when actor has being_fucked_vaginally component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import getUpFromLyingAction from '../../../../data/mods/lying/actions/get_up_from_lying.action.json';

describe('lying:get_up_from_lying - Forbidden components validation', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'lying',
      'lying:get_up_from_lying'
    );

    // Register positioning scopes needed for furniture discovery
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have forbidden_components defined for actor', () => {
      expect(getUpFromLyingAction.forbidden_components).toBeDefined();
      expect(getUpFromLyingAction.forbidden_components.actor).toBeInstanceOf(
        Array
      );
    });
  });

  describe('being_fucked_vaginally forbidden component', () => {
    it('should NOT appear when actor has being_fucked_vaginally component', () => {
      // Create basic scenario with actor
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bed']);

      // Create room and furniture
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const furniture = new ModEntityBuilder('bed1')
        .withName('Bed')
        .atLocation(room.id)
        .withComponent('lying:allows_lying_on', {})
        .build();

      // Actor is lying down on the furniture
      scenario.actor.components['lying-states:lying_on'] = {
        furniture_id: 'bed1',
        spot_index: 0,
      };

      // Actor is being fucked vaginally
      scenario.actor.components['sex-states:being_fucked_vaginally'] = {
        actorId: 'other_entity',
      };

      // Actor in same room
      scenario.actor.components['positioning:at_location'] = {
        location_id: room.id,
      };

      testFixture.reset([room, furniture, scenario.actor]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = actions.map((action) => action.id);

      // Action should NOT appear when actor has being_fucked_vaginally component
      expect(actionIds).not.toContain('lying:get_up_from_lying');
    });

    it('should appear when actor does NOT have being_fucked_vaginally component', () => {
      // Create basic scenario with actor
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bed']);

      // Create room and furniture
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const furniture = new ModEntityBuilder('bed1')
        .withName('Bed')
        .atLocation(room.id)
        .withComponent('lying:allows_lying_on', {})
        .build();

      // Actor is lying down on the furniture
      scenario.actor.components['lying-states:lying_on'] = {
        furniture_id: 'bed1',
        spot_index: 0,
      };

      // Actor in same room (no being_fucked_vaginally component)
      scenario.actor.components['positioning:at_location'] = {
        location_id: room.id,
      };

      testFixture.reset([room, furniture, scenario.actor]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = actions.map((action) => action.id);

      // Without the forbidden component, action should be available
      expect(actionIds).toContain('lying:get_up_from_lying');
    });
  });
});
