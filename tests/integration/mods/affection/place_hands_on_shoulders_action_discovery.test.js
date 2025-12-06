/**
 * @file Integration tests for affection:place_hands_on_shoulders action discovery.
 * @description Ensures the shoulders placement action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import placeHandsOnShouldersAction from '../../../../data/mods/affection/actions/place_hands_on_shoulders.action.json';

const ACTION_ID = 'affection:place_hands_on_shoulders';

describe('affection:place_hands_on_shoulders action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([placeHandsOnShouldersAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__placeHandsOnShouldersOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__placeHandsOnShouldersOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'positioning:close_actors_or_entity_kneeling_before_actor'
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

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from || [];
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);
            const actorBehind = partnerFacingAway.includes(actorId);

            // Check kneeling states
            const actorKneelingBefore =
              actorEntity.components?.['positioning:kneeling_before']
                ?.entityId === partnerId;
            const partnerKneelingBefore =
              partner.components?.['positioning:kneeling_before']?.entityId ===
              actorId;

            // Available if:
            // - (facing each other OR actor behind) AND neither kneeling incompatibly
            // - OR partner is kneeling before actor
            const normalPosition =
              (facingEachOther || actorBehind) &&
              !actorKneelingBefore &&
              !partnerKneelingBefore;
            const partnerKneeling = partnerKneelingBefore;

            if (normalPosition || partnerKneeling) {
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
      expect(placeHandsOnShouldersAction).toBeDefined();
      expect(placeHandsOnShouldersAction.id).toBe(ACTION_ID);
      expect(placeHandsOnShouldersAction.name).toBe('Place Hands on Shoulders');
      expect(placeHandsOnShouldersAction.template).toBe(
        "place your hands on {target}'s shoulders"
      );
      expect(placeHandsOnShouldersAction.targets).toBe(
        'positioning:close_actors_or_entity_kneeling_before_actor'
      );
    });

    it('requires actor closeness, no forbidden components, and uses the affection color palette', () => {
      expect(placeHandsOnShouldersAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(placeHandsOnShouldersAction.forbidden_components.actor).toEqual(
        []
      );
      expect(placeHandsOnShouldersAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is available when the actor stands behind the target', () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
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

    it('is not available when actors are not in closeness', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);
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

    it('is not available when the actor faces away from the target', () => {
      const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);
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
