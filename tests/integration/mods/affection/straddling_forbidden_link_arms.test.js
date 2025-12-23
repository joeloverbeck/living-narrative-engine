/**
 * @file Integration tests verifying link_arms action is forbidden when actor is straddling
 * @description Tests anatomical constraint that prevents linking arms while straddling someone's waist
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import linkArmsAction from '../../../../data/mods/affection/actions/link_arms.action.json';

const ACTION_ID = 'affection:link_arms';

function createActorWithArms(id, name, location, partners = []) {
  const torsoId = `${id}-torso`;
  const armId = `${id}-arm`;

  const entity = new ModEntityBuilder(id)
    .withName(name)
    .atLocation(location)
    .withLocationComponent(location)
    .asActor()
    .withComponent('personal-space-states:closeness', { partners })
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

describe('link_arms forbidden when straddling - Integration Tests', () => {
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
            actorEntity.components?.['personal-space-states:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['facing-states:facing_away']
              ?.facing_away_from || [];

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['facing-states:facing_away']
                ?.facing_away_from || [];
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);
            const actorBehind = partnerFacingAway.includes(actorId);

            const actorKneelingBefore =
              actorEntity.components?.['deference-states:kneeling_before']
                ?.entityId === partnerId;
            const partnerKneelingBefore =
              partner.components?.['deference-states:kneeling_before']?.entityId ===
              actorId;

            const armAvailable = hasSubType(partnerId, 'arm');

            const normalPosition =
              (facingEachOther || actorBehind) && !actorKneelingBefore;
            const partnerKneeling = partnerKneelingBefore;

            if (armAvailable && (normalPosition || partnerKneeling)) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Discovery - Straddling Constraints', () => {
    it('should NOT be available when actor is straddling target (facing)', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = createActorWithArms('actor1', 'Alice', 'room1', [
        'target1',
      ]);
      actor.entity.components['straddling-states:straddling_waist'] = {
        target_id: 'target1',
        facing_away: false,
      };

      const target = createActorWithArms('target1', 'Bob', 'room1', ['actor1']);
      target.entity.components['sitting-states:sitting_on'] = {
        furniture_id: 'chair1',
        spot_index: 0,
      };

      testFixture.reset([
        room,
        actor.entity,
        target.entity,
        ...actor.parts,
        ...target.parts,
      ]);
      await configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should NOT be available when actor is straddling target (facing away)', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = createActorWithArms('actor1', 'Alice', 'room1', [
        'target1',
      ]);
      actor.entity.components['straddling-states:straddling_waist'] = {
        target_id: 'target1',
        facing_away: true,
      };

      const target = createActorWithArms('target1', 'Bob', 'room1', ['actor1']);
      target.entity.components['sitting-states:sitting_on'] = {
        furniture_id: 'chair1',
        spot_index: 0,
      };

      testFixture.reset([
        room,
        actor.entity,
        target.entity,
        ...actor.parts,
        ...target.parts,
      ]);
      await configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should BE available when actor is close but NOT straddling', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'arm', 'arm'],
        { location: 'room1' }
      );

      // Ensure no straddling component exists
      delete scenario.actor.components['straddling-states:straddling_waist'];

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);
    });

    it('should BE available when actor was straddling but dismounted', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Actor who was straddling but has dismounted (no straddling component)
      const actor = createActorWithArms('actor1', 'Alice', 'room1', [
        'target1',
      ]);

      const target = createActorWithArms('target1', 'Bob', 'room1', ['actor1']);

      testFixture.reset([
        room,
        actor.entity,
        target.entity,
        ...actor.parts,
        ...target.parts,
      ]);
      await configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);
    });
  });

  describe('Action Execution - Straddling Prevention', () => {
    it('should throw validation error if action somehow attempted while straddling', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = createActorWithArms('actor1', 'Alice', 'room1', [
        'target1',
      ]);
      actor.entity.components['straddling-states:straddling_waist'] = {
        target_id: 'target1',
        facing_away: false,
      };

      const target = createActorWithArms('target1', 'Bob', 'room1', ['actor1']);

      testFixture.reset([
        room,
        actor.entity,
        target.entity,
        ...actor.parts,
        ...target.parts,
      ]);

      // Attempt to execute action (should throw validation error)
      await expect(async () => {
        await testFixture.executeAction(actor.entity.id, target.entity.id);
      }).rejects.toThrow(/forbidden component.*straddling-states:straddling_waist/i);
    });

    it('should succeed when actor is NOT straddling', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'arm', 'arm'],
        { location: 'room1' }
      );

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      expect(testFixture.events).toHaveActionSuccess(
        'Alice links arms with Bob.'
      );
    });
  });

  describe('Multiple Actor Scenarios', () => {
    it('should NOT be available when actor straddles one of multiple close partners', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = createActorWithArms('actor1', 'Alice', 'room1', [
        'target1',
        'target2',
      ]);
      actor.entity.components['straddling-states:straddling_waist'] = {
        target_id: 'target1',
        facing_away: false,
      };

      const target1 = createActorWithArms('target1', 'Bob', 'room1', [
        'actor1',
      ]);
      const target2 = createActorWithArms('target2', 'Charlie', 'room1', [
        'actor1',
      ]);

      testFixture.reset([
        room,
        actor.entity,
        target1.entity,
        target2.entity,
        ...actor.parts,
        ...target1.parts,
        ...target2.parts,
      ]);
      await configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const actionIds = availableActions.map((action) => action.id);

      // Action should not be available for ANY target since actor is straddling
      expect(actionIds).not.toContain(ACTION_ID);
    });
  });
});
