/**
 * @file Integration tests for hand-holding:hold_hand action discovery.
 * @description Ensures the hold hand action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import holdHandAction from '../../../../data/mods/hand-holding/actions/hold_hand.action.json';

const ACTION_ID = 'hand-holding:hold_hand';

describe('hand-holding:hold_hand action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('hand-holding', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([holdHandAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__holdHandOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__holdHandOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'positioning:close_actors_facing_each_other_or_behind_target'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closeness =
            actorEntity.components?.['positioning:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            if (partner.components?.['hand-holding:hand_held']) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']?.facing_away_from ||
              [];
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);
            const actorBehind = partnerFacingAway.includes(actorId);

            if (facingEachOther || actorBehind) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected hand-holding action schema', () => {
      expect(holdHandAction).toBeDefined();
      expect(holdHandAction.id).toBe(ACTION_ID);
      expect(holdHandAction.template).toBe("hold {target}'s hand");
      expect(holdHandAction.targets).toBe(
        'positioning:close_actors_facing_each_other_or_behind_target'
      );
      expect(holdHandAction.forbidden_components.actor).toEqual([
        'hand-holding:holding_hand',
        'hand-holding:hand_held',
        'positioning:hugging',
      ]);
      expect(holdHandAction.forbidden_components.primary).toEqual([
        'hand-holding:hand_held',
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors who are not already holding hands', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is blocked when the actor already holds a hand and returns once released', () => {
      const scenario = testFixture.createCloseActors(['Nina', 'Owen']);
      scenario.actor.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.actor.id,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      let availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      let ids = availableActions.map((action) => action.id);
      expect(ids).not.toContain(ACTION_ID);

      delete scenario.actor.components['hand-holding:holding_hand'];
      delete scenario.target.components['hand-holding:hand_held'];
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      ids = availableActions.map((action) => action.id);
      expect(ids).toContain(ACTION_ID);
    });

    it('is blocked when the target already has their hand held', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);
      scenario.target.components['hand-holding:hand_held'] = {
        holding_entity_id: 'someone_else',
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is blocked when the actor has their hand held by someone else', () => {
      const scenario = testFixture.createCloseActors(['Marla', 'Iker']);
      scenario.actor.components['hand-holding:hand_held'] = {
        holding_entity_id: 'someone_else',
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actors are not in closeness', () => {
      const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
