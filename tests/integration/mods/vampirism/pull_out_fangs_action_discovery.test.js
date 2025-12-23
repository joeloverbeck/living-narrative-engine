/**
 * @file Action discovery tests for vampirism:pull_out_fangs
 * @description Validates availability of the pull_out_fangs action when vampire is actively biting the target.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import pullOutFangsAction from '../../../../data/mods/vampirism/actions/pull_out_fangs.action.json';

const ACTION_ID = 'vampirism:pull_out_fangs';

describe('vampirism:pull_out_fangs - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('vampirism', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([pullOutFangsAction]);

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when vampire withdraws fangs from bitten target', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      scenario.actor.components['biting-states:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['biting-states:being_bitten_in_neck'] = {
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
    it('does NOT discover when actor lacks biting-states:biting_neck component', () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      scenario.target.components['biting-states:being_bitten_in_neck'] = {
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

    it('does NOT discover when target lacks biting-states:being_bitten_in_neck component', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Target',
      ]);

      scenario.actor.components['biting-states:biting_neck'] = {
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

      scenario.actor.components['biting-states:biting_neck'] = {
        bitten_entity_id: 'someone-else',
        initiated: true,
      };
      scenario.target.components['biting-states:being_bitten_in_neck'] = {
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

    it('does NOT discover when actor has biting-states:being_bitten_in_neck (forbidden)', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Victim',
        'Vampire',
      ]);

      scenario.actor.components['biting-states:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.actor.components['biting-states:being_bitten_in_neck'] = {
        biting_entity_id: scenario.target.id,
      };
      scenario.target.components['biting-states:being_bitten_in_neck'] = {
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

    it('does NOT discover when actors lack closeness', () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      // Remove closeness
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      scenario.actor.components['biting-states:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['biting-states:being_bitten_in_neck'] = {
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
