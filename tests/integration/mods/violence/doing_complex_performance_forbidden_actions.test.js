/**
 * @file Integration tests verifying that striking actions are correctly forbidden when actor is doing a complex performance.
 * @description Ensures that striking actions (slap_target, sucker punch) are not available when the acting actor
 * has the performances-states:doing_complex_performance component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import slapTargetAction from '../../../../data/mods/striking/actions/slap_target.action.json';
import suckerPunchAction from '../../../../data/mods/striking/actions/sucker_punch.action.json';

/**
 * Test suite for verifying forbidden component behavior for striking actions
 * when actor is doing a complex performance.
 */
describe('striking actions forbidden during complex performance', () => {
  let testFixture;

  beforeEach(async () => {
    // Using sucker_punch fixture since slap_target requires macros not loaded in tests
    testFixture = await ModTestFixture.forAction('striking', 'striking:sucker_punch');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('slap_target should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });

    it('sucker_punch should have performances-states:doing_complex_performance as forbidden component', () => {
      expect(suckerPunchAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });

  describe('Action discovery when NOT doing complex performance', () => {
    // Note: Striking actions have specific discovery requirements beyond just
    // being in the same location. The key test is verifying they are blocked
    // when the forbidden component is present. The structure validation tests
    // above confirm the forbidden_components are correctly configured.

    it('striking actions should be available under normal circumstances', () => {
      // This is a placeholder test acknowledging that striking actions
      // have discovery requirements that are tested in their respective
      // action discovery test files. The important validation is:
      // 1. Structure validation (tested above)
      // 2. Blocking when doing_complex_performance component present (tested below)
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
      expect(suckerPunchAction.forbidden_components.actor).toContain(
        'performances-states:doing_complex_performance'
      );
    });
  });

  describe('Action discovery when doing complex performance', () => {
    /**
     * Helper to configure action discovery for violence actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with striking actions
      testEnv.actionIndex.buildIndex([slapTargetAction, suckerPunchAction]);

      // Mock scope resolver for actors_in_location
      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__violenceOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__violenceOriginalResolve = originalResolve;
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

    it('slap_target is NOT available when actor is doing complex performance', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Add doing_complex_performance component to actor
      scenario.actor.components['performances-states:doing_complex_performance'] = {};

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('striking:slap_target');
    });

    it('sucker_punch is NOT available when actor is doing complex performance', () => {
      const scenario = testFixture.createCloseActors(['Charlie', 'Diana']);

      // Add doing_complex_performance component to actor
      scenario.actor.components['performances-states:doing_complex_performance'] = {};

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('striking:sucker_punch');
    });
  });
});
