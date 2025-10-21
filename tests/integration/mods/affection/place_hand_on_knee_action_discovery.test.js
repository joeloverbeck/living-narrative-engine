/**
 * @file Integration tests for affection:place_hand_on_knee action discovery.
 * @description Ensures the knee placement action is discoverable only when proximity requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import placeHandOnKneeAction from '../../../../data/mods/affection/actions/place_hand_on_knee.action.json';

const ACTION_ID = 'affection:place_hand_on_knee';

describe('affection:place_hand_on_knee action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([placeHandOnKneeAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__placeHandOnKneeOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__placeHandOnKneeOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'positioning:close_actors') {
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

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (partner) {
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
      expect(placeHandOnKneeAction).toBeDefined();
      expect(placeHandOnKneeAction.id).toBe(ACTION_ID);
      expect(placeHandOnKneeAction.name).toBe('Place hand on knee');
      expect(placeHandOnKneeAction.template).toBe(
        "place a hand on {target}'s knee"
      );
      expect(placeHandOnKneeAction.targets).toBe('positioning:close_actors');
    });

    it('requires actor closeness, no forbidden components, and uses the affection color palette', () => {
      expect(placeHandOnKneeAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(placeHandOnKneeAction.forbidden_components.actor).toEqual([]);
      expect(placeHandOnKneeAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors sharing the closeness component', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when the actor lacks the closeness component', () => {
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

    it('is withheld when the scope resolves no close partners', () => {
      const scenario = testFixture.createCloseActors(['Nia', 'Owen']);
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
