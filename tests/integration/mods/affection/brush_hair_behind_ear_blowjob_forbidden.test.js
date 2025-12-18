/**
 * @file Integration tests verifying affection:brush_hair_behind_ear is forbidden when actor has giving_blowjob component.
 * @description Tests the forbidden_components.actor restriction for blowjob scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import brushHairBehindEarAction from '../../../../data/mods/affection/actions/brush_hair_behind_ear.action.json';

const ACTION_ID = 'affection:brush_hair_behind_ear';

describe('affection:brush_hair_behind_ear - giving_blowjob forbidden component', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = async () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([brushHairBehindEarAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__brushHairOriginalResolve ||
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

      scopeResolver.__brushHairOriginalResolve = originalResolve;
      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'affection:close_actors_with_hair_or_entity_kneeling_before_actor'
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
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) return acc;

            if (!hasSubType(partnerId, 'hair')) {
              return acc;
            }

            return acc.add(partnerId);
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
    it('should have sex-states:giving_blowjob as forbidden component', () => {
      expect(brushHairBehindEarAction.forbidden_components.actor).toContain(
        'sex-states:giving_blowjob'
      );
    });
  });

  describe('Baseline: Action available without giving_blowjob', () => {
    it('should be available when actor does NOT have giving_blowjob component', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'hair']
      );
      return configureActionDiscovery().then(() => {
        const availableActions = testFixture.testEnv.getAvailableActions(
          scenario.actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).toContain(ACTION_ID);
      });
    });
  });

  describe('Forbidden: Action not available when actor giving blowjob', () => {
    it('should NOT be available when actor has giving_blowjob component', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Charlie', 'Dana'],
        ['torso', 'hair']
      );

      // Actor is giving a blowjob
      scenario.actor.components['sex-states:giving_blowjob'] = {
        receiving_entity_id: scenario.target.id,
        initiated: true,
        consented: true,
      };

      testFixture.reset([...scenario.allEntities]);
      return configureActionDiscovery().then(() => {
        const availableActions = testFixture.testEnv.getAvailableActions(
          scenario.actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain(ACTION_ID);
      });
    });
  });
});
