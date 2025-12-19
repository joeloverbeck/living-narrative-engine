/**
 * @file Integration tests for violence:tear_out_throat action discovery.
 * @description Ensures the tear out throat action is only discoverable when actor is biting target's neck.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import tearOutThroatAction from '../../../../data/mods/violence/actions/tear_out_throat.action.json';

const ACTION_ID = 'violence:tear_out_throat';

describe('violence:tear_out_throat action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([tearOutThroatAction]);

    // Register positioning scopes (replaces 45+ lines of manual implementation)
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action structure validation', () => {
    it('matches the expected violence action schema', () => {
      expect(tearOutThroatAction).toBeDefined();
      expect(tearOutThroatAction.id).toBe(ACTION_ID);
      expect(tearOutThroatAction.template).toBe("tear out {target}'s throat");
      expect(tearOutThroatAction.targets).toBe(
        'positioning:actor_being_bitten_by_me'
      );
      expect(tearOutThroatAction.required_components.actor).toContain(
        'positioning:biting_neck'
      );
    });

    it('uses violence mod visual scheme', () => {
      expect(tearOutThroatAction.visual).toEqual({
        backgroundColor: '#8b0000',
        textColor: '#ffffff',
        hoverBackgroundColor: '#b71c1c',
        hoverTextColor: '#ffebee',
      });
    });
  });

  describe('Positive discovery scenarios', () => {
    it("is available when actor is biting the target's neck", () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Add biting components with reciprocal relationship
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is available when components reference each other correctly', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });
  });

  describe('Negative discovery scenarios', () => {
    it('is not available when actor is not biting anyone', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // No biting components
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor lacks positioning:biting_neck component', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Only target has component
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it("is not available when actor's biting_neck component references a different entity", () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Actor biting someone else
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: 'other_entity_id',
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when target lacks positioning:being_bitten_in_neck component', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Only actor has component
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
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

  describe('Edge cases', () => {
    it('handles component data mismatches where IDs do not align', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      // Mismatched IDs - actor thinks they're biting target, but target has wrong biter
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: 'different_actor_id',
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      // Should not be available due to ID mismatch
      expect(ids).not.toContain(ACTION_ID);
    });

    it('correctly handles multiple biting relationships', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Actor1',
        'Target1',
      ]);

      // Create second target
      const target2 = testFixture.createEntity({
        id: 'target2',
        name: 'Target2',
        components: {
          'core:position': {
            locationId: 'room1',
          },
          'personal-space-states:closeness': {
            partners: [scenario.actor.id],
          },
        },
      });

      // Actor biting Target1
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      // Target2 has no biting relationship
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target, target2]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      // Should be available for Target1 only
      expect(ids).toContain(ACTION_ID);
    });
  });
});
