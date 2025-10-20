/**
 * @file Integration tests for violence:force_to_knees action discovery.
 * @description Ensures the force to knees action is only discoverable when proximity and facing requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
import forceToKneesAction from '../../../../data/mods/violence/actions/force_to_knees.action.json';

const ACTION_ID = 'violence:force_to_knees';

describe('violence:force_to_knees action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('violence', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      clearEntityCache();
      testEnv.actionIndex.buildIndex([forceToKneesAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__forceToKneesOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);
      const originalResolveAsync =
        scopeResolver.__forceToKneesOriginalResolveAsync ||
        (scopeResolver.resolve
          ? scopeResolver.resolve.bind(scopeResolver)
          : async (scopeName, context) => originalResolve(scopeName, context));

      scopeResolver.__forceToKneesOriginalResolve = originalResolve;
      scopeResolver.__forceToKneesOriginalResolveAsync = originalResolveAsync;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'positioning:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          const closeness =
            actorEntity?.components?.['positioning:closeness']?.partners ||
            entityManager.getComponentData(actorId, 'positioning:closeness')
              ?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity?.components?.['positioning:facing_away']
              ?.facing_away_from ||
            entityManager.getComponentData(actorId, 'positioning:facing_away')
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner?.components?.['positioning:facing_away']
                ?.facing_away_from ||
              entityManager.getComponentData(
                partnerId,
                'positioning:facing_away'
              )?.facing_away_from || [];

            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);

            if (facingEachOther) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };
      scopeResolver.resolve = async (scopeName, context) => {
        if (scopeName === 'positioning:close_actors_facing_each_other') {
          return scopeResolver.resolveSync(scopeName, context);
        }

        return originalResolveAsync(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      const { testEnv } = testFixture;
      if (testEnv?.unifiedScopeResolver?.__forceToKneesOriginalResolve) {
        testEnv.unifiedScopeResolver.resolveSync =
          testEnv.unifiedScopeResolver.__forceToKneesOriginalResolve;
      }
      if (testEnv?.unifiedScopeResolver?.__forceToKneesOriginalResolveAsync) {
        testEnv.unifiedScopeResolver.resolve =
          testEnv.unifiedScopeResolver.__forceToKneesOriginalResolveAsync;
      } else if (testEnv?.unifiedScopeResolver) {
        delete testEnv.unifiedScopeResolver.resolve;
      }
      clearEntityCache();
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected violence action schema', () => {
      expect(forceToKneesAction).toBeDefined();
      expect(forceToKneesAction.id).toBe(ACTION_ID);
      expect(forceToKneesAction.template).toBe(
        'force {target} to their knees before you'
      );
      expect(forceToKneesAction.targets.primary.scope).toBe(
        'positioning:close_actors_facing_each_other'
      );
      expect(forceToKneesAction.targets.primary.placeholder).toBe('target');
    });

    it('requires actor closeness, forbids kneeling actors and targets, and uses violence colors', () => {
      expect(forceToKneesAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(forceToKneesAction.forbidden_components.actor).toEqual([
        'positioning:kneeling_before',
      ]);
      expect(forceToKneesAction.forbidden_components.primary).toEqual([
        'positioning:kneeling_before',
      ]);
      expect(forceToKneesAction.visual).toEqual({
        backgroundColor: '#8b0000',
        textColor: '#ffffff',
        hoverBackgroundColor: '#b71c1c',
        hoverTextColor: '#ffebee',
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

    it('is not available when actors are not in closeness', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Liam']);
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetEntity = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      expect(actorEntity?.components?.['positioning:closeness']).toBeUndefined();
      expect(targetEntity?.components?.['positioning:closeness']).toBeUndefined();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the target already kneels before the actor', async () => {
      const scenario = testFixture.createCloseActors(['Chloe', 'Evan']);

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      await testFixture.entityManager.addComponent(
        scenario.target.id,
        'positioning:kneeling_before',
        { entityId: scenario.actor.id }
      );
      const targetKneeling = testFixture.entityManager.getComponentData(
        scenario.target.id,
        'positioning:kneeling_before'
      );
      expect(targetKneeling?.entityId).toBe(scenario.actor.id);

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor kneels before the target', async () => {
      const scenario = testFixture.createCloseActors(['Gina', 'Harper']);

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      await testFixture.entityManager.addComponent(
        scenario.actor.id,
        'positioning:kneeling_before',
        { entityId: scenario.target.id }
      );
      const actorKneeling = testFixture.entityManager.getComponentData(
        scenario.actor.id,
        'positioning:kneeling_before'
      );
      expect(actorKneeling?.entityId).toBe(scenario.target.id);

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', async () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      await testFixture.entityManager.addComponent(
        scenario.actor.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.target.id] }
      );
      const actorFacingAway = testFixture.entityManager.getComponentData(
        scenario.actor.id,
        'positioning:facing_away'
      );
      expect(actorFacingAway?.facing_away_from).toEqual([scenario.target.id]);

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the target faces away from the actor', async () => {
      const scenario = testFixture.createCloseActors(['Nina', 'Oscar']);

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      await testFixture.entityManager.addComponent(
        scenario.target.id,
        'positioning:facing_away',
        { facing_away_from: [scenario.actor.id] }
      );
      const targetFacingAway = testFixture.entityManager.getComponentData(
        scenario.target.id,
        'positioning:facing_away'
      );
      expect(targetFacingAway?.facing_away_from).toEqual([
        scenario.actor.id,
      ]);

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
