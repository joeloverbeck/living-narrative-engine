/**
 * @file Integration tests verifying affection:link_arms is forbidden when target has giving_blowjob component.
 * @description Tests the forbidden_components.target restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import linkArmsAction from '../../../../data/mods/affection/actions/link_arms.action.json';

const ACTION_ID = 'affection:link_arms';

function createActorWithArmAnatomy(id, name, location, partners = []) {
  const torsoId = `${id}-torso`;
  const armId = `${id}-arm`;

  const entity = new ModEntityBuilder(id)
    .withName(name)
    .atLocation(location)
    .withLocationComponent(location)
    .asActor()
    .withComponent('positioning:closeness', { partners })
    .withBody(torsoId)
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [armId], subType: 'torso' })
    .atLocation(location)
    .withLocationComponent(location)
    .build();

  const arm = new ModEntityBuilder(armId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'arm' })
    .atLocation(location)
    .withLocationComponent(location)
    .build();

  return { entity, parts: [torso, arm] };
}

describe('affection:link_arms - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = async () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([linkArmsAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__linkArmsOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      const hasSubType = (entityId, subType) => {
        const { entityManager } = testEnv;
        const entity = entityManager.getEntityInstance(entityId);
        const rootId = entity?.components?.['anatomy:body']?.body?.root;
        if (!rootId) return false;

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
            partData.subType.toLowerCase().includes(subType)
          ) {
            return true;
          }
          const children = partData?.children || [];
          stack.push(...children);
        }
        return false;
      };

      scopeResolver.__linkArmsOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'affection:actors_with_arm_subtypes_facing_each_other_or_behind_target'
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

          const validTargets = closeness.reduce((acc, partnerId) => {
            if (!hasSubType(partnerId, 'arm')) {
              return acc;
            }
            acc.add(partnerId);
            return acc;
          }, new Set());

          return { success: true, value: validTargets };
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
    it('should be available when target does NOT have giving_blowjob component', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'arm', 'arm']
      );
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });
  });

  describe('Forbidden: Action not available when target giving blowjob', () => {
    it('should NOT be available when target has giving_blowjob component', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Charlie', 'Diana'],
        ['torso', 'arm', 'arm']
      );

      // Target is giving a blowjob
      scenario.target.components['positioning:giving_blowjob'] = {
        receiving_entity_id: scenario.actor.id,
        initiated: true,
        consented: true,
      };

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

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
      const actorData = createActorWithArmAnatomy('actor1', 'Alex', 'room1', [
        'target1',
        'target2',
      ]);

      const targetGivingData = createActorWithArmAnatomy(
        'target1',
        'Blair',
        'room1',
        ['actor1', 'target2']
      );

      const targetThirdData = createActorWithArmAnatomy(
        'target2',
        'Casey',
        'room1',
        ['actor1', 'target1']
      );

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Alex is receiving a blowjob from Blair
      actorData.entity.components['positioning:receiving_blowjob'] = {
        giving_entity_id: targetGivingData.entity.id,
        consented: true,
      };

      // Blair is giving a blowjob to Alex
      targetGivingData.entity.components['positioning:giving_blowjob'] = {
        receiving_entity_id: actorData.entity.id,
        initiated: true,
        consented: true,
      };

      // Set up closeness for all three actors
      testFixture.reset([
        room,
        actorData.entity,
        targetGivingData.entity,
        targetThirdData.entity,
        ...actorData.parts,
        ...targetGivingData.parts,
        ...targetThirdData.parts,
      ]);
      await configureActionDiscovery();

      // Test 1: Action should succeed when targeting Casey (no forbidden component)
      await expect(
        testFixture.executeAction(actorData.entity.id, targetThirdData.entity.id)
      ).resolves.not.toThrow();

      // Test 2: Action should fail when targeting Blair (has giving_blowjob)
      testFixture.reset([
        room,
        actorData.entity,
        targetGivingData.entity,
        targetThirdData.entity,
        ...actorData.parts,
        ...targetGivingData.parts,
        ...targetThirdData.parts,
      ]);
      await configureActionDiscovery();

      await expect(async () => {
        await testFixture.executeAction(
          actorData.entity.id,
          targetGivingData.entity.id
        );
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });
});
