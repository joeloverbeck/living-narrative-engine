/**
 * @file Integration tests verifying that caressing actions are correctly forbidden when actor is giving a blowjob.
 * @description Ensures that mouth engagement actions (cupping chin, licking lips, nuzzling neck, running fingers through hair,
 * running thumb across lips, and wiping cheek) are not available when the acting actor has the positioning:giving_blowjob component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';

// Import action definitions
import cupChinAction from '../../../../data/mods/caressing/actions/cup_chin.action.json';
import lickLipsAction from '../../../../data/mods/caressing/actions/lick_lips.action.json';
import nuzzleFaceIntoNeckAction from '../../../../data/mods/caressing/actions/nuzzle_face_into_neck.action.json';
import runFingersThroughHairAction from '../../../../data/mods/caressing/actions/run_fingers_through_hair.action.json';
import runThumbAcrossLipsAction from '../../../../data/mods/caressing/actions/run_thumb_across_lips.action.json';
import thumbWipeCheekAction from '../../../../data/mods/caressing/actions/thumb_wipe_cheek.action.json';

/**
 * Test suite for verifying forbidden component behavior for caressing actions
 * when actor is giving a blowjob.
 */
describe('caressing actions forbidden when giving blowjob', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('caressing', 'caressing:cup_chin');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('cup_chin should have positioning:giving_blowjob as forbidden component', () => {
      expect(cupChinAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('lick_lips should have positioning:giving_blowjob as forbidden component', () => {
      expect(lickLipsAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('nuzzle_face_into_neck should have positioning:giving_blowjob as forbidden component', () => {
      expect(nuzzleFaceIntoNeckAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('run_fingers_through_hair should have positioning:giving_blowjob as forbidden component', () => {
      expect(runFingersThroughHairAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('run_thumb_across_lips should have positioning:giving_blowjob as forbidden component', () => {
      expect(runThumbAcrossLipsAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('thumb_wipe_cheek should have positioning:giving_blowjob as forbidden component', () => {
      expect(thumbWipeCheekAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });
  });

  describe('Action discovery when NOT giving blowjob', () => {
    /**
     * Helper to configure action discovery for caressing actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with all caressing actions
      testEnv.actionIndex.buildIndex([
        cupChinAction,
        lickLipsAction,
        nuzzleFaceIntoNeckAction,
        runFingersThroughHairAction,
        runThumbAcrossLipsAction,
        thumbWipeCheekAction,
      ]);

      // Mock scope resolver for close_actors_facing_each_other
      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__caressingOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__caressingOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName === 'caressing:close_actors_facing_each_other' ||
          scopeName === 'caressing:close_actors_facing_each_other_or_behind_target'
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

            // For close_actors_facing_each_other_or_behind_target, also check if actor is behind target
            const actorBehind = scopeName.includes('or_behind_target')
              ? actorFacingAway.includes(partnerId) &&
                !partnerFacingAway.includes(actorId)
              : false;

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

    it('cup_chin is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:cup_chin');
    });

    it('lick_lips is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Charlie', 'Diana']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:lick_lips');
    });

    it('nuzzle_face_into_neck is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Eve', 'Frank']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:nuzzle_face_into_neck');
    });

    it('run_fingers_through_hair is available for close actors', () => {
      const scenario = testFixture.createCloseActors(['Grace', 'Henry']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:run_fingers_through_hair');
    });

    it('run_thumb_across_lips is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Ivy', 'Jack']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:run_thumb_across_lips');
    });

    it('thumb_wipe_cheek is available for close actors facing each other', () => {
      const scenario = testFixture.createCloseActors(['Kate', 'Leo']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:thumb_wipe_cheek');
    });
  });

  describe('Action discovery when giving blowjob', () => {
    /**
     * Helper to configure action discovery for caressing actions
     */
    const configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build index with all caressing actions
      testEnv.actionIndex.buildIndex([
        cupChinAction,
        lickLipsAction,
        nuzzleFaceIntoNeckAction,
        runFingersThroughHairAction,
        runThumbAcrossLipsAction,
        thumbWipeCheekAction,
      ]);

      // Mock scope resolver for close_actors_facing_each_other
      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__caressingOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__caressingOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName === 'caressing:close_actors_facing_each_other' ||
          scopeName === 'caressing:close_actors_facing_each_other_or_behind_target'
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

            // For close_actors_facing_each_other_or_behind_target, also check if actor is behind target
            const actorBehind = scopeName.includes('or_behind_target')
              ? actorFacingAway.includes(partnerId) &&
                !partnerFacingAway.includes(actorId)
              : false;

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

    it('cup_chin is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Maya', 'Noah']);

      // Add giving_blowjob component to actor
      scenario.actor.components['positioning:giving_blowjob'] = {
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

      expect(ids).not.toContain('caressing:cup_chin');
    });

    it('lick_lips is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Olivia', 'Peter']);

      // Add giving_blowjob component to actor
      scenario.actor.components['positioning:giving_blowjob'] = {
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

      expect(ids).not.toContain('caressing:lick_lips');
    });

    it('nuzzle_face_into_neck is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Quinn', 'Rachel']);

      // Add giving_blowjob component to actor
      scenario.actor.components['positioning:giving_blowjob'] = {
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

      expect(ids).not.toContain('caressing:nuzzle_face_into_neck');
    });

    it('run_fingers_through_hair is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Sam', 'Tina']);

      // Add giving_blowjob component to actor
      scenario.actor.components['positioning:giving_blowjob'] = {
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

      expect(ids).not.toContain('caressing:run_fingers_through_hair');
    });

    it('run_thumb_across_lips is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Uma', 'Victor']);

      // Add giving_blowjob component to actor
      scenario.actor.components['positioning:giving_blowjob'] = {
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

      expect(ids).not.toContain('caressing:run_thumb_across_lips');
    });

    it('thumb_wipe_cheek is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createCloseActors(['Wendy', 'Xavier']);

      // Add giving_blowjob component to actor
      scenario.actor.components['positioning:giving_blowjob'] = {
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

      expect(ids).not.toContain('caressing:thumb_wipe_cheek');
    });
  });
});
