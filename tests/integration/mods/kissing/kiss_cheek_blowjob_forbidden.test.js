/**
 * @file Integration tests verifying kissing:kiss_cheek is forbidden when actor has giving_blowjob component.
 * @description Tests the forbidden_components.actor restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import kissCheekAction from '../../../../data/mods/kissing/actions/kiss_cheek.action.json';

const ACTION_ID = 'kissing:kiss_cheek';

describe('kissing:kiss_cheek - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('kissing', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([kissCheekAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__kissCheekOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__kissCheekOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'kissing:close_actors_facing_each_other') {
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
            actorEntity.components?.['personal-space-states:closeness']?.partners;
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
    it('should be available when actor does NOT have giving_blowjob component', () => {
      const scenario = testFixture.createCloseActors(['Emma', 'Finn']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });
  });

  describe('Forbidden: Action not available when actor giving blowjob', () => {
    it('should NOT be available when actor has giving_blowjob component', async () => {
      const scenario = testFixture.createCloseActors(['Grace', 'Henry']);

      // Actor is giving a blowjob
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      // Test through actual action execution which goes through full pipeline
      // The action should be blocked by actor validation with forbidden component error
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });
  });

  describe('Three-actor scenario: Actor receiving blowjob can kiss others', () => {
    it('should be available to actor receiving blowjob when targeting a third actor', async () => {
      // Create three actors using ModEntityBuilder
      const actor = new ModEntityBuilder('actor1')
        .withName('Ivy')
        .atLocation('room1')
        .asActor()
        .build();

      const targetGiving = new ModEntityBuilder('target1')
        .withName('Jack')
        .atLocation('room1')
        .asActor()
        .build();

      const targetThird = new ModEntityBuilder('target2')
        .withName('Kelly')
        .atLocation('room1')
        .asActor()
        .build();

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Ivy is receiving a blowjob from Jack
      actor.components['sex-states:receiving_blowjob'] = {
        giving_entity_id: targetGiving.id,
        consented: true,
      };

      // Jack is giving a blowjob to Ivy
      targetGiving.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: actor.id,
        initiated: true,
        consented: true,
      };

      // Set up closeness for all three actors
      actor.components['personal-space-states:closeness'] = {
        partners: [targetGiving.id, targetThird.id],
      };
      targetGiving.components['personal-space-states:closeness'] = {
        partners: [actor.id, targetThird.id],
      };
      targetThird.components['personal-space-states:closeness'] = {
        partners: [actor.id, targetGiving.id],
      };

      testFixture.reset([room, actor, targetGiving, targetThird]);
      configureActionDiscovery();

      // Test 1: Action should succeed when Ivy targets Kelly (Ivy receiving, not giving)
      await expect(
        testFixture.executeAction(actor.id, targetThird.id)
      ).resolves.not.toThrow();

      // Test 2: Action should fail when Ivy targets Jack (Jack is giving)
      // But this tests actor forbidden, not target forbidden, so Jack can be targeted
      // Instead, test that Jack cannot initiate kiss (he's giving)
      testFixture.reset([room, actor, targetGiving, targetThird]);
      configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(targetGiving.id, actor.id);
      }).rejects.toThrow(/forbidden component.*sex-states:giving_blowjob/i);
    });
  });
});
