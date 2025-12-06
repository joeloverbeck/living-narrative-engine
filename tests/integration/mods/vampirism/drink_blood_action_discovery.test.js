/**
 * @file Action discovery tests for vampirism:drink_blood
 * @description Validates action availability when vampire is currently biting target's neck
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import drinkBloodAction from '../../../../data/mods/vampirism/actions/drink_blood.action.json';

const ACTION_ID = 'vampirism:drink_blood';

describe('vampirism:drink_blood - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('vampirism', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([drinkBloodAction]);

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when vampire is biting target', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      // Establish bite relationship
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('discovers action with reciprocal component ID matching', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
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

  describe('Negative Discovery Cases', () => {
    it('does NOT discover when actor lacks positioning:biting_neck component', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Only add being_bitten component to target, not biting to actor
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does NOT discover when actor has positioning:being_bitten_in_neck (actor is victim)', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Victim',
        'Vampire',
      ]);

      // Actor is the victim being bitten
      scenario.actor.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.target.id,
      };
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does NOT discover when target lacks positioning:being_bitten_in_neck component', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Target',
      ]);

      // Only add biting component to actor, not being_bitten to target
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does NOT discover when component IDs do not match reciprocally', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      // Mismatched IDs
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: 'wrong-id',
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does NOT discover when no bite relationship exists', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does NOT discover when actors lack closeness', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Remove closeness
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
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
