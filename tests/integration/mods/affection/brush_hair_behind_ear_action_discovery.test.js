/**
 * @file Integration tests for affection:brush_hair_behind_ear action discovery.
 * @description Ensures the brush hair behind ear action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import brushHairBehindEarAction from '../../../../data/mods/affection/actions/brush_hair_behind_ear.action.json';

const ACTION_ID = 'affection:brush_hair_behind_ear';

describe('affection:brush_hair_behind_ear action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = async () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Ensure the action index knows about the affection action under test
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

            const hairAvailable = hasSubType(partnerId, 'hair');

            const normalPosition =
              (facingEachOther || actorBehind) && !actorKneelingBefore;
            const partnerKneeling = partnerKneelingBefore;

            if ((normalPosition || partnerKneeling) && hairAvailable) {
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
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action Structure Validation', () => {
    it('validates the action JSON structure and properties', () => {
      expect(brushHairBehindEarAction.id).toBe(ACTION_ID);
      expect(brushHairBehindEarAction.template).toBe(
        "brush a lock of hair behind {target}'s ear"
      );
      expect(brushHairBehindEarAction.targets).toBe(
        'affection:close_actors_with_hair_or_entity_kneeling_before_actor'
      );
      expect(brushHairBehindEarAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(brushHairBehindEarAction.visual.backgroundColor).toBe('#6a1b9a');
      expect(brushHairBehindEarAction.visual.textColor).toBe('#f3e5f5');
      expect(brushHairBehindEarAction.visual.hoverBackgroundColor).toBe(
        '#8e24aa'
      );
      expect(brushHairBehindEarAction.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Positive Discovery Scenarios', () => {
    it('is available for close actors facing each other', () => {
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

    it('is available when the actor stands behind the target', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Maya', 'Noah'],
        ['torso', 'hair']
      );
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      testFixture.reset([...scenario.allEntities]);
      return configureActionDiscovery().then(() => {
        const availableActions = testFixture.testEnv.getAvailableActions(
          scenario.actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).toContain(ACTION_ID);
      });
    });

    it('is available when the target is kneeling before the actor', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Sophia', 'Liam'],
        ['torso', 'hair']
      );
      scenario.target.components['positioning:kneeling_before'] = {
        entityId: scenario.actor.id,
      };

      testFixture.reset([...scenario.allEntities]);
      return configureActionDiscovery().then(() => {
        const availableActions = testFixture.testEnv.getAvailableActions(
          scenario.actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).toContain(ACTION_ID);
      });
    });
  });

  describe('Negative Discovery Scenarios', () => {
    it('is not available when actors are not in closeness', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Ivy', 'Liam'],
        ['torso', 'hair']
      );
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      testFixture.reset([...scenario.allEntities]);
      return configureActionDiscovery().then(() => {
        const availableActions = testFixture.testEnv.getAvailableActions(
          scenario.actor.id
        );
        const ids = availableActions.map((action) => action.id);

        expect(ids).not.toContain(ACTION_ID);
      });
    });

    it('is not available when the actor faces away from the target', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Chloe', 'Evan'],
        ['torso', 'hair']
      );
      scenario.actor.components['positioning:facing_away'] = {
        facing_away_from: [scenario.target.id],
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

    it('is not available when the actor is kneeling before the target', () => {
      const scenario = testFixture.createAnatomyScenario(
        ['Emma', 'Oliver'],
        ['torso', 'hair']
      );
      scenario.actor.components['positioning:kneeling_before'] = {
        entityId: scenario.target.id,
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

    it('is not available when the target lacks hair anatomy', () => {
      const scenario = testFixture.createCloseActors(['Hare', 'Chicken']);
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
