/**
 * @file Integration tests verifying kissing:peck_on_lips is forbidden when actor has giving_blowjob component.
 * @description Tests the forbidden_components.actor restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pecOnLipsAction from '../../../../data/mods/kissing/actions/peck_on_lips.action.json';

const ACTION_ID = 'kissing:peck_on_lips';

describe('kissing:peck_on_lips - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('kissing', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([pecOnLipsAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__pecOnLipsOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__pecOnLipsOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'kissing:close_actors_with_mouth_facing_each_other_or_behind_target'
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
      const scenario = testFixture.createAnatomyScenario(
        ['Nina', 'Oscar'],
        ['torso', 'mouth']
      );
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
      const scenario = testFixture.createAnatomyScenario(
        ['Pete', 'Rita'],
        ['torso', 'mouth']
      );

      scenario.actor.components['positioning:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      testFixture.reset(scenario.allEntities);
      configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, scenario.target.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });

  describe('Three-actor scenario: Actor receiving blowjob can kiss others', () => {
    it('should be available to actor receiving blowjob when targeting a third actor', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Steve', 'Vera'],
        ['torso', 'mouth']
      );

      const actor = scenario.actor;
      const targetThird = scenario.target;

      const targetGiving = new ModEntityBuilder('giver1')
        .withName('Tina')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

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

      testFixture.reset([...scenario.allEntities, targetGiving]);
      configureActionDiscovery();

      await expect(
        testFixture.executeAction(actor.id, targetThird.id)
      ).resolves.not.toThrow();

      testFixture.reset([...scenario.allEntities, targetGiving]);
      configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(targetGiving.id, actor.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });
});
