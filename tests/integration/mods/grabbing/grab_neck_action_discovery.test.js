/**
 * @file Integration tests for grabbing:grab_neck action discovery.
 * @description Ensures the grab neck action is only discoverable when proximity requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import grabNeckAction from '../../../../data/mods/grabbing/actions/grab_neck.action.json';

const ACTION_ID = 'grabbing:grab_neck';

describe('grabbing:grab_neck action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('grabbing', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([grabNeckAction]);

    // Register positioning scopes (replaces 40+ lines of manual implementation)
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action structure validation', () => {
    it('matches the expected grabbing action schema', () => {
      expect(grabNeckAction).toBeDefined();
      expect(grabNeckAction.id).toBe(ACTION_ID);
      expect(grabNeckAction.template).toBe("grab {target}'s neck");
      expect(grabNeckAction.targets).toBe(
        'personal-space:close_actors_facing_each_other_or_behind_target'
      );
    });

    it('requires actor closeness and uses the grabbing color palette', () => {
      expect(grabNeckAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(grabNeckAction.visual).toEqual({
        backgroundColor: '#4a4a4a',
        textColor: '#f5f5f5',
        hoverBackgroundColor: '#5a5a5a',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is available when the actor stands behind the target', () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);
      scenario.target.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actors are not in closeness', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', () => {
      const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);

      scenario.actor.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
