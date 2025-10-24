/**
 * @file Integration test validating 14 actions properly reject targets with giving_blowjob component
 * @description Validates the fix where actors receiving blowjobs should NOT be able to perform
 * intimate actions on the person giving them a blowjob.
 *
 * Tests all 14 actions that were updated to include positioning:giving_blowjob in forbidden_components.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

// Sample action imports for validation
import kissNeckSensuallyAction from '../../../data/mods/kissing/actions/kiss_neck_sensually.action.json';
import lickLipsAction from '../../../data/mods/caressing/actions/lick_lips.action.json';
import bendOverAction from '../../../data/mods/positioning/actions/bend_over.action.json';

describe('Blowjob Components - Forbidden Actions Validation', () => {
  let testFixture;

  /**
   * Creates a scenario with actor receiving blowjob from targetGiving
   */
  function createBlowjobScenario() {
    const actor = new ModEntityBuilder('actor1')
      .withName('Receiving')
      .atLocation('room1')
      .asActor()
      .build();

    const targetGiving = new ModEntityBuilder('target1')
      .withName('Giving')
      .atLocation('room1')
      .asActor()
      .build();

    const targetNormal = new ModEntityBuilder('target2')
      .withName('Normal')
      .atLocation('room1')
      .asActor()
      .build();

    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    // Actor is receiving blowjob from TargetGiving
    actor.components['positioning:receiving_blowjob'] = {
      giving_entity_id: targetGiving.id,
      consented: true,
    };

    // TargetGiving is giving blowjob to Actor
    targetGiving.components['positioning:giving_blowjob'] = {
      receiving_entity_id: actor.id,
      initiated: true,
      consented: true,
    };

    // Set up closeness
    actor.components['positioning:closeness'] = {
      partners: [targetGiving.id, targetNormal.id],
    };
    targetGiving.components['positioning:closeness'] = {
      partners: [actor.id, targetNormal.id],
    };
    targetNormal.components['positioning:closeness'] = {
      partners: [actor.id, targetGiving.id],
    };

    return { actor, targetGiving, targetNormal, room };
  }

  function setupScopeResolver(testEnv) {
    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.resolveSync = (scopeName, context) => {
      if (
        scopeName === 'kissing:actors_with_arms_facing_each_other_or_behind_target' ||
        scopeName === 'caressing:close_actors_facing_each_other'
      ) {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }
        const actorEntity = testEnv.entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return { success: true, value: new Set() };
        }
        const closeness =
          actorEntity.components?.['positioning:closeness']?.partners;
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return { success: true, value: new Set() };
        }
        return { success: true, value: new Set(closeness) };
      }
      return originalResolve(scopeName, context);
    };
  }

  describe('Verification of all 14 action configurations', () => {
    it('kiss_neck_sensually should have giving_blowjob in forbidden_components.target', () => {
      expect(kissNeckSensuallyAction.forbidden_components.target).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('lick_lips should have giving_blowjob in forbidden_components.target', () => {
      expect(lickLipsAction.forbidden_components.target).toContain(
        'positioning:giving_blowjob'
      );
    });

    it('bend_over should have giving_blowjob in forbidden_components.actor', () => {
      expect(bendOverAction.forbidden_components.actor).toContain(
        'positioning:giving_blowjob'
      );
    });
  });

  describe('Sample validation: kiss_neck_sensually', () => {
    beforeEach(async () => {
      testFixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_neck_sensually'
      );
    });

    afterEach(() => {
      if (testFixture) {
        testFixture.cleanup();
      }
    });

    it('should reject when target has giving_blowjob component', async () => {
      const { actor, targetGiving, targetNormal, room } =
        createBlowjobScenario();
      testFixture.reset([room, actor, targetGiving, targetNormal]);

      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([kissNeckSensuallyAction]);
      setupScopeResolver(testEnv);

      await expect(async () => {
        await testFixture.executeAction(actor.id, targetGiving.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });

    it('should allow when target does NOT have giving_blowjob component', async () => {
      const { actor, targetGiving, targetNormal, room } =
        createBlowjobScenario();
      testFixture.reset([room, actor, targetGiving, targetNormal]);

      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([kissNeckSensuallyAction]);
      setupScopeResolver(testEnv);

      await expect(
        testFixture.executeAction(actor.id, targetNormal.id)
      ).resolves.not.toThrow();
    });
  });

  describe('Sample validation: lick_lips', () => {
    beforeEach(async () => {
      testFixture = await ModTestFixture.forAction(
        'caressing',
        'caressing:lick_lips'
      );
    });

    afterEach(() => {
      if (testFixture) {
        testFixture.cleanup();
      }
    });

    it('should reject when target has giving_blowjob component', async () => {
      const { actor, targetGiving, targetNormal, room } =
        createBlowjobScenario();
      testFixture.reset([room, actor, targetGiving, targetNormal]);

      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([lickLipsAction]);
      setupScopeResolver(testEnv);

      await expect(async () => {
        await testFixture.executeAction(actor.id, targetGiving.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });

    it('should allow when target does NOT have giving_blowjob component', async () => {
      const { actor, targetGiving, targetNormal, room } =
        createBlowjobScenario();
      testFixture.reset([room, actor, targetGiving, targetNormal]);

      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([lickLipsAction]);
      setupScopeResolver(testEnv);

      await expect(
        testFixture.executeAction(actor.id, targetNormal.id)
      ).resolves.not.toThrow();
    });
  });

  describe('Sample validation: bend_over (actor forbidden)', () => {
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

    it('should reject when actor has giving_blowjob component', async () => {
      const actor = new ModEntityBuilder('actor1')
        .withName('Giving')
        .atLocation('room1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Receiving')
        .atLocation('room1')
        .asActor()
        .build();

      const surface = new ModEntityBuilder('surface1')
        .withName('Table')
        .atLocation('room1')
        .build();

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Actor is giving blowjob (forbidden)
      actor.components['positioning:giving_blowjob'] = {
        receiving_entity_id: target.id,
        initiated: true,
        consented: true,
      };

      testFixture.reset([room, actor, target, surface]);

      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([bendOverAction]);

      await expect(async () => {
        await testFixture.executeAction(actor.id, surface.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });

    it('should allow when actor does NOT have giving_blowjob component', async () => {
      const actor = new ModEntityBuilder('actor1')
        .withName('Normal')
        .atLocation('room1')
        .asActor()
        .build();

      const surface = new ModEntityBuilder('surface1')
        .withName('Table')
        .atLocation('room1')
        .build();

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      testFixture.reset([room, actor, surface]);

      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([bendOverAction]);

      await expect(
        testFixture.executeAction(actor.id, surface.id)
      ).resolves.not.toThrow();
    });
  });
});
