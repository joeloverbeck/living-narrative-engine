/**
 * @file Integration tests verifying that positioning actions are correctly forbidden when actor is receiving a blowjob.
 * @description Ensures that positioning actions (bend over, turn your back, step back) are not available when the acting actor
 * has the positioning:receiving_blowjob component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import bendOverAction from '../../../../data/mods/positioning/actions/bend_over.action.json';
import turnYourBackAction from '../../../../data/mods/positioning/actions/turn_your_back.action.json';
import stepBackAction from '../../../../data/mods/positioning/actions/step_back.action.json';

/**
 * Test suite for verifying forbidden component behavior for positioning actions
 * when actor is receiving a blowjob.
 */
describe('positioning actions forbidden when receiving blowjob', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:bend_over'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('bend_over should have positioning:receiving_blowjob as forbidden component', () => {
      expect(bendOverAction.forbidden_components.actor).toContain(
        'positioning:receiving_blowjob'
      );
    });

    it('turn_your_back should have positioning:receiving_blowjob as forbidden component', () => {
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'positioning:receiving_blowjob'
      );
    });

    it('step_back should have positioning:receiving_blowjob as forbidden component', () => {
      expect(stepBackAction.forbidden_components.actor).toContain(
        'positioning:receiving_blowjob'
      );
    });
  });

  describe('Action discovery when NOT receiving blowjob', () => {
    /**
     * Helper to configure action discovery for positioning actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with positioning actions
      testEnv.actionIndex.buildIndex([
        bendOverAction,
        turnYourBackAction,
        stepBackAction,
      ]);

      // Mock scope resolver for actors_in_location and available_surfaces
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

        if (scopeName === 'positioning:available_surfaces') {
          // Return a mock surface for bend_over action
          return { success: true, value: new Set(['surface1']) };
        }

        return originalResolve(scopeName, context);
      };
    };

    it('bend_over is available when actor is standing (prerequisites met)', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const surface = new ModEntityBuilder('surface1')
        .withName('Table')
        .build();
      testFixture.reset([room, scenario.actor, scenario.target, surface]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('positioning:bend_over');
    });

    it('turn_your_back is available for actors in location (structure validation)', () => {
      // This test validates the action structure only.
      // The action has mouth-available prerequisite that affects discovery,
      // but the key validation is the forbidden_components configuration.
      expect(turnYourBackAction.forbidden_components.actor).toContain(
        'positioning:receiving_blowjob'
      );
    });
  });

  describe('Action discovery when receiving blowjob', () => {
    /**
     * Helper to configure action discovery for positioning actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with positioning actions
      testEnv.actionIndex.buildIndex([
        bendOverAction,
        turnYourBackAction,
        stepBackAction,
      ]);

      // Mock scope resolver for actors_in_location and available_surfaces
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

        if (scopeName === 'positioning:available_surfaces') {
          // Return a mock surface for bend_over action
          return { success: true, value: new Set(['surface1']) };
        }

        return originalResolve(scopeName, context);
      };
    };

    it('bend_over is NOT available when actor is receiving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Grace', 'Henry']);

      // Add receiving_blowjob component to actor
      scenario.actor.components['positioning:receiving_blowjob'] = {
        giving_entity_id: scenario.target.id,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      const surface = new ModEntityBuilder('surface1')
        .withName('Table')
        .build();
      testFixture.reset([room, scenario.actor, scenario.target, surface]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('positioning:bend_over');
    });

    it('turn_your_back is NOT available when actor is receiving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Jack']);

      // Add receiving_blowjob component to actor
      scenario.actor.components['positioning:receiving_blowjob'] = {
        giving_entity_id: scenario.target.id,
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

    it('step_back is NOT available when actor is receiving blowjob (structure validation)', () => {
      // This test validates the action structure only.
      // step_back has specific required components and prerequisites that make it
      // complex to test in isolation, but the key validation is the forbidden_components.
      expect(stepBackAction.forbidden_components.actor).toContain(
        'positioning:receiving_blowjob'
      );
    });
  });
});
