/**
 * @file Integration tests for affection:link_arms action discovery.
 * @description Ensures the link arms action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import linkArmsAction from '../../../../data/mods/affection/actions/link_arms.action.json';

const ACTION_ID = 'affection:link_arms';

describe('affection:link_arms action discovery', () => {
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
            const actorBehind = partnerFacingAway.includes(actorId);

            const actorKneelingBefore =
              actorEntity.components?.['positioning:kneeling_before']
                ?.entityId === partnerId;
            const partnerKneelingBefore =
              partner.components?.['positioning:kneeling_before']?.entityId ===
              actorId;

            const armAvailable = hasSubType(partnerId, 'arm');

            const normalPosition =
              (facingEachOther || actorBehind) && !actorKneelingBefore;
            const partnerKneeling = partnerKneelingBefore;

            if (
              armAvailable &&
              !partner.components?.['positioning:being_bitten_in_neck'] && // keep legacy exclusions if present
              !partner.components?.['positioning:being_bitten_in_neck']
            ) {
              if (normalPosition || partnerKneeling) {
                acc.add(partnerId);
              }
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
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected affection action schema', () => {
      expect(linkArmsAction).toBeDefined();
      expect(linkArmsAction.id).toBe(ACTION_ID);
      expect(linkArmsAction.template).toBe('link arms with {target}');
      expect(linkArmsAction.targets).toBe(
        'affection:actors_with_arm_subtypes_facing_each_other_or_behind_target'
      );
    });

    it('requires actor closeness and uses the affection color palette', () => {
      expect(linkArmsAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(linkArmsAction.forbidden_components.actor).toEqual([
        'positioning:straddling_waist',
        'positioning:being_hugged',
        'positioning:hugging',
      ]);
      expect(linkArmsAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', async () => {
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

    it('is available when the actor stands behind the target', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Maya', 'Noah'],
        ['torso', 'arm', 'arm']
      );
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actors are not in closeness', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Ivy', 'Liam'],
        ['torso', 'arm', 'arm']
      );
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Chloe', 'Evan'],
        ['torso', 'arm', 'arm']
      );
      scenario.actor.components['positioning:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor is currently being hugged', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Nina', 'Omar'],
        ['torso', 'arm', 'arm']
      );
      scenario.actor.components['positioning:being_hugged'] = {
        hugging_entity_id: scenario.target.id,
      };

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor is hugging the target', async () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Holly', 'Ian'],
        ['torso', 'arm', 'arm']
      );
      scenario.actor.components['positioning:hugging'] = {
        embraced_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };
      scenario.target.components['positioning:being_hugged'] = {
        hugging_entity_id: scenario.actor.id,
        consented: true,
      };

      testFixture.reset([...scenario.allEntities]);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the target lacks arm anatomy', async () => {
      const scenario = testFixture.createCloseActors(['NoArm', 'Targetless']);
      await configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
