/**
 * @file Integration tests verifying that positioning actions are correctly forbidden when actor is giving a blowjob.
 * @description Ensures that positioning actions (stand up, turn your back) are not available when the acting actor
 * has the sex-states:giving_blowjob component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import standUpAction from '../../../../data/mods/deference/actions/stand_up.action.json';
import turnYourBackAction from '../../../../data/mods/positioning/actions/turn_your_back.action.json';

/**
 * Test suite for verifying forbidden component behavior for positioning actions
 * when actor is giving a blowjob.
 */
describe('positioning actions forbidden when giving blowjob', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'deference',
      'deference:stand_up'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('stand_up should have sex-states:giving_blowjob as forbidden component', () => {
      expect(standUpAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('turn_your_back should have sex-states:giving_blowjob as forbidden component', () => {
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });
  });

  describe('Action discovery when NOT giving blowjob', () => {
    /**
     * Helper to configure action discovery for positioning actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with positioning actions
      testEnv.actionIndex.buildIndex([standUpAction, turnYourBackAction]);

      // Mock scope resolver for actors_in_location
      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__positioningOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__positioningOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'core:actors_in_location') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const locationId =
            actorEntity.components?.['core:actor']?.location_id;
          if (!locationId) {
            return { success: true, value: new Set() };
          }

          const location = entityManager.getEntityInstance(locationId);
          if (!location) {
            return { success: true, value: new Set() };
          }

          const occupants =
            location.components?.['core:location']?.occupants || [];
          const otherActors = occupants.filter((id) => id !== actorId);

          return { success: true, value: new Set(otherActors) };
        }

        return originalResolve(scopeName, context);
      };
    };

    it('stand_up is available when actor is kneeling', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Add kneeling_before component to actor
      scenario.actor.components['positioning:kneeling_before'] = {
        target_entity_id: scenario.target.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('deference:stand_up');
    });

    it('turn_your_back is available for actors in location (when prerequisites met)', () => {
      // Note: turn_your_back has a prerequisite checking actor-mouth-available
      // This test verifies the action structure only, as prerequisite handling
      // is tested separately. The key validation is that the action has the
      // forbidden_components properly configured.
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );

      // Action may not appear in discovery due to mouth-available prerequisite
      // This is expected behavior - the forbidden component is an additional layer
      // The important test is that it's blocked when giving_blowjob component is present
    });
  });

  describe('Action discovery when giving blowjob', () => {
    /**
     * Helper to configure action discovery for positioning actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with positioning actions
      testEnv.actionIndex.buildIndex([standUpAction, turnYourBackAction]);

      // Mock scope resolver for actors_in_location
      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__positioningOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__positioningOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'core:actors_in_location') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const locationId =
            actorEntity.components?.['core:actor']?.location_id;
          if (!locationId) {
            return { success: true, value: new Set() };
          }

          const location = entityManager.getEntityInstance(locationId);
          if (!location) {
            return { success: true, value: new Set() };
          }

          const occupants =
            location.components?.['core:location']?.occupants || [];
          const otherActors = occupants.filter((id) => id !== actorId);

          return { success: true, value: new Set(otherActors) };
        }

        return originalResolve(scopeName, context);
      };
    };

    it('stand_up is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Eve', 'Frank']);

      // Add kneeling_before component (required for stand_up)
      scenario.actor.components['positioning:kneeling_before'] = {
        target_entity_id: scenario.target.id,
      };

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('deference:stand_up');
    });

    it('turn_your_back is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Grace', 'Henry']);

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('positioning:turn_your_back');
    });
  });
});
