/**
 * @file Integration tests for hand-holding:squeeze_hand_reassuringly action discovery.
 * @description Ensures the reassuring hand squeeze action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import squeezeHandAction from '../../../../data/mods/hand-holding/actions/squeeze_hand_reassuringly.action.json';

const ACTION_ID = 'hand-holding:squeeze_hand_reassuringly';

describe('hand-holding:squeeze_hand_reassuringly action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('hand-holding', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([squeezeHandAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__squeezeHandOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__squeezeHandOriginalResolve = originalResolve;
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

          const closeness =
            actorEntity.components?.['personal-space-states:closeness']?.partners;
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

            const actorHoldingPartner =
              actorEntity.components?.['hand-holding:holding_hand']
                ?.held_entity_id === partnerId;
            const actorHandHeldByPartner =
              actorEntity.components?.['hand-holding:hand_held']
                ?.holding_entity_id === partnerId;
            const partnerHoldingActor =
              partner.components?.['hand-holding:holding_hand']
                ?.held_entity_id === actorId;
            const partnerHandHeldByActor =
              partner.components?.['hand-holding:hand_held']
                ?.holding_entity_id === actorId;

            if (
              !actorHoldingPartner &&
              !actorHandHeldByPartner &&
              !partnerHoldingActor &&
              !partnerHandHeldByActor
            ) {
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
    it('matches the expected affection action schema', () => {
      expect(squeezeHandAction).toBeDefined();
      expect(squeezeHandAction.id).toBe(ACTION_ID);
      expect(squeezeHandAction.template).toBe(
        "squeeze {target}'s hand reassuringly"
      );
      expect(squeezeHandAction.targets).toBe(
        'personal-space:close_actors_facing_each_other_or_behind_target'
      );
      expect(squeezeHandAction.prerequisites).toEqual([
        {
          logic: {
            condition_ref: 'hand-holding:actors-are-holding-hands',
          },
        },
      ]);
    });

    it('requires actor closeness and uses the hand-holding color palette', () => {
      expect(squeezeHandAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(squeezeHandAction.visual).toEqual({
        backgroundColor: '#2c0e37',
        textColor: '#ffebf0',
        hoverBackgroundColor: '#451952',
        hoverTextColor: '#f3e5f5',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is not available when actors are only close but not holding hands', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is available when the actor initiated the hand hold', () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);
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

    it('is available to the partner whose hand is being held', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);
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
        scenario.target.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actors are not in closeness even with hand holding', () => {
      const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);
      scenario.actor.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.actor.id,
        consented: true,
      };
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', () => {
      const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);
      scenario.actor.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.target.id,
        initiated: true,
      };
      scenario.target.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.actor.id,
        consented: true,
      };
      scenario.actor.components['positioning:facing_away'] = {
        facing_away_from: [scenario.target.id],
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
  });
});
