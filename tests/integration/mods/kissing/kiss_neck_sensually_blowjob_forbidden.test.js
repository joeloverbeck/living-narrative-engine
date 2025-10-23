/**
 * @file Integration tests verifying kissing:kiss_neck_sensually is forbidden when actor has giving_blowjob component.
 * @description Tests the forbidden_components.actor restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import kissNeckSensuallyAction from '../../../../data/mods/kissing/actions/kiss_neck_sensually.action.json';

const ACTION_ID = 'kissing:kiss_neck_sensually';

describe('kissing:kiss_neck_sensually - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('kissing', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([kissNeckSensuallyAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__kissNeckOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__kissNeckOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'kissing:actors_with_arms_facing_each_other_or_behind_target'
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
      const scenario = testFixture.createCloseActors(['Sam', 'Taylor']);
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
      const scenario = testFixture.createCloseActors(['Uma', 'Victor']);

      scenario.actor.components['positioning:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });

  describe('Three-actor scenario: Actor receiving blowjob can kiss others', () => {
    it('should be available to actor receiving blowjob when targeting a third actor', async () => {
      const actor = new ModEntityBuilder('actor1')
        .withName('Will')
        .atLocation('room1')
        .asActor()
        .build();

      const targetGiving = new ModEntityBuilder('target1')
        .withName('Xena')
        .atLocation('room1')
        .asActor()
        .build();

      const targetThird = new ModEntityBuilder('target2')
        .withName('Yara')
        .atLocation('room1')
        .asActor()
        .build();

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      actor.components['positioning:receiving_blowjob'] = {
        giving_entity_id: targetGiving.id,
        consented: true,
      };

      targetGiving.components['positioning:giving_blowjob'] = {
        receiving_entity_id: actor.id,
        initiated: true,
        consented: true,
      };

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

      await expect(
        testFixture.executeAction(actor.id, targetThird.id)
      ).resolves.not.toThrow();

      testFixture.reset([room, actor, targetGiving, targetThird]);
      configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(targetGiving.id, actor.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });
});
