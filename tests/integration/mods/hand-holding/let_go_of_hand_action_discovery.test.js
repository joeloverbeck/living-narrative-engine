/**
 * @file Integration tests for hand-holding:let_go_of_hand action discovery.
 * @description Ensures the let go of hand action appears only for actively held partners.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import letGoAction from '../../../../data/mods/hand-holding/actions/let_go_of_hand.action.json';
import holdHandAction from '../../../../data/mods/hand-holding/actions/hold_hand.action.json';

const ACTION_ID = 'hand-holding:let_go_of_hand';

describe('hand-holding:let_go_of_hand action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('hand-holding', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([letGoAction, holdHandAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__letGoOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__letGoOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'personal-space:close_actors_facing_each_other_or_behind_target'
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

          const holdingComponent =
            actorEntity.components?.['hand-holding:holding_hand'];
          const heldTargetId = holdingComponent?.held_entity_id;
          if (!heldTargetId) {
            return { success: true, value: new Set() };
          }

          const closeness =
            actorEntity.components?.['personal-space-states:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            if (partnerId !== heldTargetId) {
              return acc;
            }

            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from || [];
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
    it('matches the expected let_go_of_hand action schema', () => {
      expect(letGoAction).toBeDefined();
      expect(letGoAction.id).toBe(ACTION_ID);
      expect(letGoAction.template).toBe("let go of {target}'s hand");
      expect(letGoAction.targets).toBe(
        'personal-space:close_actors_facing_each_other_or_behind_target'
      );
      expect(letGoAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
        'hand-holding:holding_hand',
      ]);
      expect(letGoAction.required_components.primary).toEqual([
        'hand-holding:hand_held',
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it("is available when the actor is currently holding the target's hand", () => {
      const scenario = testFixture.createCloseActors(['Avery', 'Blair']);
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

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is removed from discovery once the components are cleared', () => {
      const scenario = testFixture.createCloseActors(['Cam', 'Dylan']);
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
      expect(ids).toContain(ACTION_ID);

      delete scenario.actor.components['hand-holding:holding_hand'];
      delete scenario.target.components['hand-holding:hand_held'];
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      ids = availableActions.map((action) => action.id);
      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor lacks the holding component', () => {
      const scenario = testFixture.createCloseActors(['Eden', 'Flynn']);
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
