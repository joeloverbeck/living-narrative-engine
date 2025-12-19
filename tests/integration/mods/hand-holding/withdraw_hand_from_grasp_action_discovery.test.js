/**
 * @file Integration tests for hand-holding:withdraw_hand_from_grasp action discovery.
 * @description Ensures the withdraw action appears only for the entity whose hand is currently being held.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import withdrawAction from '../../../../data/mods/hand-holding/actions/withdraw_hand_from_grasp.action.json';
import holdHandAction from '../../../../data/mods/hand-holding/actions/hold_hand.action.json';

const ACTION_ID = 'hand-holding:withdraw_hand_from_grasp';

describe('hand-holding:withdraw_hand_from_grasp action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('hand-holding', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([withdrawAction, holdHandAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__withdrawHandOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__withdrawHandOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'hand-holding:actor_whose_hand_target_is_holding') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const handHeldComponent =
            actorEntity.components?.['hand-holding:hand_held'];
          const holderId = handHeldComponent?.holding_entity_id;
          const closeness =
            actorEntity.components?.['personal-space-states:closeness']?.partners || [];

          if (!holderId || !closeness.includes(holderId)) {
            return { success: true, value: new Set() };
          }

          const holderEntity = entityManager.getEntityInstance(holderId);
          if (!holderEntity) {
            return { success: true, value: new Set() };
          }

          const holderComponent =
            holderEntity.components?.['hand-holding:holding_hand'];
          if (holderComponent?.held_entity_id !== actorId) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];
          const holderFacingAway =
            holderEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];

          const facingEachOther =
            !actorFacingAway.includes(holderId) &&
            !holderFacingAway.includes(actorId);
          const actorBehind = holderFacingAway.includes(actorId);

          if (!facingEachOther && !actorBehind) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set([holderId]) };
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
    it('matches the expected withdraw_hand_from_grasp action schema', () => {
      expect(withdrawAction).toBeDefined();
      expect(withdrawAction.id).toBe(ACTION_ID);
      expect(withdrawAction.template).toBe(
        "withdraw your hand from {target}'s grasp"
      );
      expect(withdrawAction.targets).toBe(
        'hand-holding:actor_whose_hand_target_is_holding'
      );
      expect(withdrawAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
        'hand-holding:hand_held',
      ]);
      expect(withdrawAction.required_components.primary).toEqual([
        'hand-holding:holding_hand',
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available only when both hand-holding components link the pair', () => {
      const scenario = testFixture.createCloseActors(['Riley', 'Sky']);
      scenario.actor.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.target.id,
        consented: true,
      };
      scenario.target.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.actor.id,
        initiated: true,
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

    it('disappears when the actor is no longer marked as hand_held', () => {
      const scenario = testFixture.createCloseActors(['Morgan', 'Tali']);
      scenario.actor.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.target.id,
        consented: true,
      };
      scenario.target.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.actor.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      let availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      let ids = availableActions.map((action) => action.id);
      expect(ids).toContain(ACTION_ID);

      delete scenario.actor.components['hand-holding:hand_held'];
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      ids = availableActions.map((action) => action.id);
      expect(ids).not.toContain(ACTION_ID);
    });

    it('disappears when the target is no longer holding the actor', () => {
      const scenario = testFixture.createCloseActors(['Quinn', 'Uma']);
      scenario.actor.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.target.id,
        consented: true,
      };
      scenario.target.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.actor.id,
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      let availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      let ids = availableActions.map((action) => action.id);
      expect(ids).toContain(ACTION_ID);

      delete scenario.target.components['hand-holding:holding_hand'];
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      ids = availableActions.map((action) => action.id);
      expect(ids).not.toContain(ACTION_ID);
    });

    it('is hidden from other close actors who are not part of the linkage', () => {
      const scenario = testFixture.createCloseActors(['Ari', 'Blake']);
      scenario.actor.components['hand-holding:hand_held'] = {
        holding_entity_id: scenario.target.id,
        consented: true,
      };
      scenario.target.components['hand-holding:holding_hand'] = {
        held_entity_id: scenario.actor.id,
        initiated: true,
      };

      const thirdActor = ModEntityScenarios.createActorTargetPair({
        names: ['Casey', 'Drew'],
        location: 'room1',
        closeProximity: true,
        idPrefix: 'extra_',
      });

      scenario.actor.components['personal-space-states:closeness'].partners.push(
        thirdActor.actor.id
      );
      thirdActor.actor.components['personal-space-states:closeness'].partners.push(
        scenario.actor.id
      );

      thirdActor.actor.components['hand-holding:holding_hand'] = {
        held_entity_id: thirdActor.target.id,
        initiated: true,
      };
      thirdActor.target.components['hand-holding:hand_held'] = {
        holding_entity_id: thirdActor.actor.id,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([
        room,
        scenario.actor,
        scenario.target,
        thirdActor.actor,
        thirdActor.target,
      ]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        thirdActor.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
