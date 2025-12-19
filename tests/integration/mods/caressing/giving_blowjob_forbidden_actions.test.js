/**
 * @file Integration tests verifying that caressing actions are correctly forbidden when actor is giving a blowjob.
 * @description Ensures that mouth engagement actions (cupping chin, licking lips, nuzzling neck, running fingers through hair,
 * running thumb across lips, and wiping cheek) are not available when the acting actor has the sex-states:giving_blowjob component.
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
  const actionsUnderTest = [
    cupChinAction,
    lickLipsAction,
    nuzzleFaceIntoNeckAction,
    runFingersThroughHairAction,
    runThumbAcrossLipsAction,
    thumbWipeCheekAction,
  ];

  const configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    testEnv.actionIndex.buildIndex(actionsUnderTest);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__caressingOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    const hasSubType = (entityId, subType) => {
      const { entityManager } = testEnv;
      const entity = entityManager.getEntityInstance(entityId);
      const rootId = entity?.components?.['anatomy:body']?.body?.root;
      if (!rootId) {
        return false;
      }

      const stack = [rootId];
      const visited = new Set();

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);

        const part = entityManager.getEntityInstance(current);
        const partData = part?.components?.['anatomy:part'];

        if (
          partData?.subType &&
          partData.subType.toLowerCase().includes(subType.toLowerCase())
        ) {
          return true;
        }

        const children = partData?.children || [];
        stack.push(...children);
      }

      return false;
    };

    const getFacingTargets = (context, allowActorBehind) => {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return new Set();
      }

      const { entityManager } = testEnv;
      const actorEntity = entityManager.getEntityInstance(actorId);
      if (!actorEntity) {
        return new Set();
      }

      const closeness =
        actorEntity.components?.['personal-space-states:closeness']?.partners;
      if (!Array.isArray(closeness) || closeness.length === 0) {
        return new Set();
      }

      const actorFacingAway =
        actorEntity.components?.['positioning:facing_away']?.facing_away_from ||
        [];

      return closeness.reduce((acc, partnerId) => {
        const partner = entityManager.getEntityInstance(partnerId);
        if (!partner) {
          return acc;
        }

        const partnerFacingAway =
          partner.components?.['positioning:facing_away']?.facing_away_from ||
          [];
        const facingEachOther =
          !actorFacingAway.includes(partnerId) &&
          !partnerFacingAway.includes(actorId);
        const actorBehind =
          allowActorBehind &&
          actorFacingAway.includes(partnerId) &&
          !partnerFacingAway.includes(actorId);

        if (facingEachOther || actorBehind) {
          acc.add(partnerId);
        }

        return acc;
      }, new Set());
    };

    const resolveHairScope = (context) => {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return new Set();
      }

      const { entityManager } = testEnv;
      const actorEntity = entityManager.getEntityInstance(actorId);
      if (!actorEntity) {
        return new Set();
      }

      const closeness =
        actorEntity.components?.['personal-space-states:closeness']?.partners;
      if (!Array.isArray(closeness) || closeness.length === 0) {
        return new Set();
      }

      const actorFacingAway =
        actorEntity.components?.['positioning:facing_away']?.facing_away_from ||
        [];
      const actorKneelingBefore =
        actorEntity.components?.['positioning:kneeling_before']?.entityId;

      return closeness.reduce((acc, partnerId) => {
        const partner = entityManager.getEntityInstance(partnerId);
        if (!partner) {
          return acc;
        }

        const partnerFacingAway =
          partner.components?.['positioning:facing_away']?.facing_away_from ||
          [];
        const facingEachOther =
          !actorFacingAway.includes(partnerId) &&
          !partnerFacingAway.includes(actorId);
        const actorBehind =
          actorFacingAway.includes(partnerId) &&
          !partnerFacingAway.includes(actorId);
        const actorKneelingBeforePartner = actorKneelingBefore === partnerId;
        const partnerKneelingBeforeActor =
          partner.components?.['positioning:kneeling_before']?.entityId ===
          actorId;

        const hairAvailable = hasSubType(partnerId, 'hair');

        if (
          hairAvailable &&
          (facingEachOther || actorBehind) &&
          !actorKneelingBeforePartner
        ) {
          acc.add(partnerId);
          return acc;
        }

        if (hairAvailable && partnerKneelingBeforeActor) {
          acc.add(partnerId);
        }

        return acc;
      }, new Set());
    };

    const resolveMouthScope = (context) => {
      const potentialTargets = getFacingTargets(context, true);
      return new Set(
        [...potentialTargets].filter((partnerId) =>
          hasSubType(partnerId, 'mouth')
        )
      );
    };

    scopeResolver.__caressingOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      if (
        scopeName === 'caressing:close_actors_facing_each_other' ||
        scopeName ===
          'caressing:close_actors_facing_each_other_or_behind_target'
      ) {
        return {
          success: true,
          value: getFacingTargets(
            context,
            scopeName.includes('or_behind_target')
          ),
        };
      }

      if (
        scopeName ===
        'caressing:close_actors_with_hair_or_entity_kneeling_before_actor'
      ) {
        return { success: true, value: resolveHairScope(context) };
      }

      if (
        scopeName ===
        'kissing:close_actors_with_mouth_facing_each_other_or_behind_target'
      ) {
        return { success: true, value: resolveMouthScope(context) };
      }

      return originalResolve(scopeName, context);
    };
  };

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:cup_chin'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('cup_chin should have sex-states:giving_blowjob as forbidden component', () => {
      expect(cupChinAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('lick_lips should have sex-states:giving_blowjob as forbidden component', () => {
      expect(lickLipsAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('nuzzle_face_into_neck should have sex-states:giving_blowjob as forbidden component', () => {
      expect(nuzzleFaceIntoNeckAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('run_fingers_through_hair should have sex-states:giving_blowjob as forbidden component', () => {
      expect(runFingersThroughHairAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('run_thumb_across_lips should have sex-states:giving_blowjob as forbidden component', () => {
      expect(runThumbAcrossLipsAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });

    it('thumb_wipe_cheek should have sex-states:giving_blowjob as forbidden component', () => {
      expect(thumbWipeCheekAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });
  });

  describe('Action discovery when NOT giving blowjob', () => {
    it('cup_chin is available for close actors facing each other', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'hair', 'mouth']
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:cup_chin');
    });

    it('lick_lips is available for close actors facing each other', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Charlie', 'Diana'],
        ['torso', 'hair', 'mouth']
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:lick_lips');
    });

    it('nuzzle_face_into_neck is available for close actors facing each other', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Eve', 'Frank'],
        ['torso', 'hair', 'mouth']
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:nuzzle_face_into_neck');
    });

    it('run_fingers_through_hair is available for close actors', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Grace', 'Henry'],
        ['torso', 'hair', 'mouth']
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:run_fingers_through_hair');
    });

    it('run_thumb_across_lips is available for close actors facing each other', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Ivy', 'Jack'],
        ['torso', 'hair', 'mouth']
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:run_thumb_across_lips');
    });

    it('thumb_wipe_cheek is available for close actors facing each other', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Kate', 'Leo'],
        ['torso', 'hair', 'mouth']
      );
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain('caressing:thumb_wipe_cheek');
    });
  });

  describe('Action discovery when giving blowjob', () => {
    it('cup_chin is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Maya', 'Noah'],
        ['torso', 'hair', 'mouth']
      );

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('caressing:cup_chin');
    });

    it('lick_lips is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Olivia', 'Peter'],
        ['torso', 'hair', 'mouth']
      );

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('caressing:lick_lips');
    });

    it('nuzzle_face_into_neck is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Quinn', 'Rachel'],
        ['torso', 'hair', 'mouth']
      );

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('caressing:nuzzle_face_into_neck');
    });

    it('run_fingers_through_hair is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Sam', 'Tina'],
        ['torso', 'hair', 'mouth']
      );

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('caressing:run_fingers_through_hair');
    });

    it('run_thumb_across_lips is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Uma', 'Victor'],
        ['torso', 'hair', 'mouth']
      );

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('caressing:run_thumb_across_lips');
    });

    it('thumb_wipe_cheek is NOT available when actor is giving blowjob', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Wendy', 'Xavier'],
        ['torso', 'hair', 'mouth']
      );

      // Add giving_blowjob component to actor
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, ...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain('caressing:thumb_wipe_cheek');
    });
  });
});
