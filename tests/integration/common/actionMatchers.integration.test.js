/**
 * @file Integration tests for action discovery matchers
 * @description Tests matchers with real ModTestFixture and action discovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../common/mods/ModEntityBuilder.js';
import '../../common/actionMatchers.js'; // Auto-extends Jest
import placeHandsOnShouldersAction from '../../../data/mods/affection/actions/place_hands_on_shoulders.action.json';
import turnAroundAction from '../../../data/mods/physical-control/actions/turn_around.action.json';

describe('actionMatchers integration - real action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:place_hands_on_shoulders'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('toHaveAction with real scenarios', () => {
    it('should pass when action is discovered for close actors', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Setup action index
      testFixture.testEnv.actionIndex.buildIndex([
        placeHandsOnShouldersAction,
        turnAroundAction,
      ]);

      // Configure scope resolver
      const scopeResolver = testFixture.testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'personal-space:close_actors_or_entity_kneeling_before_actor'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const actorEntity =
            testFixture.testEnv.entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closeness =
            actorEntity.components?.['personal-space-states:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          return { success: true, value: new Set(closeness) };
        }

        return originalResolve(scopeName, context);
      };

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      // Use custom matcher
      expect(actions).toHaveAction('affection:place_hands_on_shoulders');
    });

    it('should fail with detailed message when action not discovered (missing closeness)', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Remove closeness component
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      testFixture.testEnv.actionIndex.buildIndex([
        placeHandsOnShouldersAction,
        turnAroundAction,
      ]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      let errorMessage;
      try {
        expect(actions).toHaveAction('affection:place_hands_on_shoulders');
      } catch (err) {
        errorMessage = err.message;
      }

      // Verify detailed error message
      expect(errorMessage).toBeDefined();
      expect(errorMessage).toContain('❌');
      expect(errorMessage).toContain(
        "Action 'affection:place_hands_on_shoulders' was NOT discovered"
      );
      expect(errorMessage).toContain('ComponentFilteringStage');
      expect(errorMessage).toContain('Actor missing required components');
      expect(errorMessage).toContain('To debug:');
    });

    it('should work with .not when action not discovered', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Remove closeness component
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      testFixture.testEnv.actionIndex.buildIndex([placeHandsOnShouldersAction]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      // Should pass because action is NOT discovered
      expect(actions).not.toHaveAction('affection:place_hands_on_shoulders');
    });
  });

  describe('toDiscoverActionCount with real scenarios', () => {
    it('should pass when count matches', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      testFixture.testEnv.actionIndex.buildIndex([
        placeHandsOnShouldersAction,
        turnAroundAction,
      ]);

      // Configure scope resolver
      const scopeResolver = testFixture.testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'personal-space:close_actors_or_entity_kneeling_before_actor'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const actorEntity =
            testFixture.testEnv.entityManager.getEntityInstance(actorId);
          const closeness =
            actorEntity?.components?.['personal-space-states:closeness']?.partners || [];

          return { success: true, value: new Set(closeness) };
        }

        return originalResolve(scopeName, context);
      };

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      // Verify we get expected number of actions
      expect(actions).toDiscoverActionCount(actions.length);
    });

    it('should fail with detailed message when fewer actions discovered', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Only index one action
      testFixture.testEnv.actionIndex.buildIndex([turnAroundAction]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      let errorMessage;
      try {
        // Expect more actions than actually available
        expect(actions).toDiscoverActionCount(5);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toBeDefined();
      expect(errorMessage).toContain('FEWER actions than expected');
      expect(errorMessage).toContain('pipeline stages');
      expect(errorMessage).toContain('Prerequisites not met');
    });

    it('should show correct actions in error message', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      testFixture.testEnv.actionIndex.buildIndex([
        turnAroundAction,
        placeHandsOnShouldersAction,
      ]);

      // Configure scope resolver
      const scopeResolver = testFixture.testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'personal-space:close_actors_or_entity_kneeling_before_actor'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const actorEntity =
            testFixture.testEnv.entityManager.getEntityInstance(actorId);
          const closeness =
            actorEntity?.components?.['personal-space-states:closeness']?.partners || [];

          return { success: true, value: new Set(closeness) };
        }

        return originalResolve(scopeName, context);
      };

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      let errorMessage;
      try {
        expect(actions).toDiscoverActionCount(10);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toBeDefined();
      expect(errorMessage).toContain('Actions discovered:');

      // Should list actual actions (at least one should be present)
      const hasActionList =
        errorMessage.includes('physical-control:turn_around') ||
        errorMessage.includes('affection:place_hands_on_shoulders');
      expect(hasActionList).toBe(true);
    });
  });

  describe('Multiple actions scenario', () => {
    it('should validate multiple actions correctly', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      testFixture.testEnv.actionIndex.buildIndex([
        placeHandsOnShouldersAction,
        turnAroundAction,
      ]);

      // Configure scope resolver
      const scopeResolver = testFixture.testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'personal-space:close_actors_or_entity_kneeling_before_actor'
        ) {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const actorEntity =
            testFixture.testEnv.entityManager.getEntityInstance(actorId);
          const closeness =
            actorEntity?.components?.['personal-space-states:closeness']?.partners || [];

          return { success: true, value: new Set(closeness) };
        }

        return originalResolve(scopeName, context);
      };

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      // Check for presence of specific action that should be discovered
      expect(actions).toHaveAction('affection:place_hands_on_shoulders');

      // Verify action count is reasonable (at least 1)
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe('Zero actions scenario', () => {
    it('should handle zero actions discovered', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Don't index any actions - should result in zero available actions
      testFixture.testEnv.actionIndex.buildIndex([]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      // Should pass because no actions expected
      expect(actions).toDiscoverActionCount(0);
    });

    it('should show helpful message when expecting actions but none found', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Don't index any actions
      testFixture.testEnv.actionIndex.buildIndex([]);

      const actions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );

      let errorMessage;
      try {
        expect(actions).toDiscoverActionCount(3);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toBeDefined();
      expect(errorMessage).toContain('(none)');
      expect(errorMessage).toContain('FEWER actions than expected (0 < 3)');
    });
  });
});
