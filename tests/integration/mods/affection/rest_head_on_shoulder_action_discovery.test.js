/**
 * @file Integration tests for affection:rest_head_on_shoulder action discovery.
 * @description Ensures the comforting head rest action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import restHeadOnShoulderAction from '../../../../data/mods/affection/actions/rest_head_on_shoulder.action.json';

const ACTION_ID = 'affection:rest_head_on_shoulder';

describe('affection:rest_head_on_shoulder action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([restHeadOnShoulderAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__restHeadOnShoulderOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__restHeadOnShoulderOriginalResolve = originalResolve;
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
      expect(restHeadOnShoulderAction).toBeDefined();
      expect(restHeadOnShoulderAction.id).toBe(ACTION_ID);
      expect(restHeadOnShoulderAction.name).toBe('Rest Head on Shoulder');
      expect(restHeadOnShoulderAction.template).toBe(
        "rest your head on {target}'s shoulder"
      );
      expect(restHeadOnShoulderAction.targets).toBe(
        'personal-space:close_actors_facing_each_other_or_behind_target'
      );
    });

    it('requires actor closeness and uses the affection color palette', () => {
      expect(restHeadOnShoulderAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(restHeadOnShoulderAction.visual).toEqual({
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

    it('is not available when the actor is currently being hugged', () => {
      const scenario = testFixture.createCloseActors(['Nina', 'Omar']);
      scenario.actor.components['positioning:being_hugged'] = {
        hugging_entity_id: scenario.target.id,
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
