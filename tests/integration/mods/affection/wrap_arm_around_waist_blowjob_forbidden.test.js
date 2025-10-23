/**
 * @file Integration tests verifying affection:wrap_arm_around_waist is forbidden when target has giving_blowjob component.
 * @description Tests the forbidden_components.target restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import wrapArmAroundWaistAction from '../../../../data/mods/affection/actions/wrap_arm_around_waist.action.json';

const ACTION_ID = 'affection:wrap_arm_around_waist';

describe('affection:wrap_arm_around_waist - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([wrapArmAroundWaistAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__wrapArmOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__wrapArmOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'affection:close_actors_facing_each_other') {
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

          return { success: true, value: new Set(closeness) };
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

  describe('Baseline: Action available without giving_blowjob', () => {
    it('should be available when target does NOT have giving_blowjob component', () => {
      const scenario = testFixture.createCloseActors(['Nancy', 'Oscar']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });
  });

  describe('Forbidden: Action not available when target giving blowjob', () => {
    it('should NOT be available when target has giving_blowjob component', async () => {
      const scenario = testFixture.createCloseActors(['Peter', 'Quinn']);

      // Target is giving a blowjob
      scenario.target.components['positioning:giving_blowjob'] = {
        receiving_entity_id: scenario.actor.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      // Test through actual action execution which goes through full pipeline
      // The action should be blocked by target validation with forbidden component error
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });

  describe('Three-actor scenario: Actor with receiving_blowjob can target others', () => {
    it('should be available to actor with receiving_blowjob when targeting a third actor without giving_blowjob', async () => {
      // Create three actors using ModEntityBuilder
      const actor = new ModEntityBuilder('actor1')
        .withName('Riley')
        .atLocation('room1')
        .asActor()
        .build();

      const targetGiving = new ModEntityBuilder('target1')
        .withName('Steve')
        .atLocation('room1')
        .asActor()
        .build();

      const targetThird = new ModEntityBuilder('target2')
        .withName('Tina')
        .atLocation('room1')
        .asActor()
        .build();

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Riley is receiving a blowjob from Steve
      actor.components['positioning:receiving_blowjob'] = {
        giving_entity_id: targetGiving.id,
        consented: true,
      };

      // Steve is giving a blowjob to Riley
      targetGiving.components['positioning:giving_blowjob'] = {
        receiving_entity_id: actor.id,
        initiated: true,
        consented: true,
      };

      // Set up closeness for all three actors
      actor.components['positioning:closeness'] = {
        partners: [targetGiving.id, targetThird.id],
      };
      targetGiving.components['positioning:closeness'] = {
        partners: [actor.id, targetThird.id],
      };
      targetThird.components['positioning:closeness'] = {
        partners: [actor.id, targetGiving.id],
      };

      testFixture.reset([room, actor, targetGiving, targetThird]);
      configureActionDiscovery();

      // Test 1: Action should succeed when targeting Tina (no forbidden component)
      await expect(
        testFixture.executeAction(actor.id, targetThird.id)
      ).resolves.not.toThrow();

      // Test 2: Action should fail when targeting Steve (has giving_blowjob)
      testFixture.reset([room, actor, targetGiving, targetThird]);
      configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(actor.id, targetGiving.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });
});
