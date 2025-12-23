/**
 * @file Integration tests for affection:rest_head_against_chest action discovery.
 * @description Ensures the chest-resting affection action is discoverable only when proximity and anatomy requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import restHeadAgainstChestAction from '../../../../data/mods/affection/actions/rest_head_against_chest.action.json';

const ACTION_ID = 'affection:rest_head_against_chest';

describe('affection:rest_head_against_chest action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([restHeadAgainstChestAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__restHeadAgainstChestOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__restHeadAgainstChestOriginalResolve = originalResolve;

      const hasBreastAnatomy = (entityId) => {
        if (!entityId) {
          return false;
        }

        const { entityManager } = testEnv;
        const entity = entityManager.getEntityInstance(entityId);
        if (!entity) {
          return false;
        }

        const bodyComponent = entity.components?.['anatomy:body'];
        const rootId = bodyComponent?.body?.root;
        if (!rootId) {
          return false;
        }

        const visited = new Set();
        const stack = [rootId];

        while (stack.length > 0) {
          const currentId = stack.pop();
          if (!currentId || visited.has(currentId)) {
            continue;
          }

          visited.add(currentId);

          const partEntity = entityManager.getEntityInstance(currentId);
          if (!partEntity) {
            continue;
          }

          const partComponent = partEntity.components?.['anatomy:part'];
          if (!partComponent) {
            continue;
          }

          if (partComponent.subType === 'breast') {
            return true;
          }

          const children = Array.isArray(partComponent.children)
            ? partComponent.children
            : [];
          for (const childId of children) {
            stack.push(childId);
          }
        }

        return false;
      };

      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'affection:actors_with_breasts_facing_each_other') {
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
              ?.facing_away_from ?? [];
          const actorKneelingBefore =
            actorEntity.components?.['deference-states:kneeling_before']?.entityId ??
            null;

          const validTargets = closeness.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from ?? [];
            const partnerKneelingBefore =
              partner.components?.['deference-states:kneeling_before']?.entityId ??
              null;

            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);
            const actorKneeling = actorKneelingBefore === partnerId;
            const partnerKneeling = partnerKneelingBefore === actorId;

            if (
              facingEachOther &&
              !actorKneeling &&
              !partnerKneeling &&
              hasBreastAnatomy(partnerId)
            ) {
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

  describe('Action structure validation', () => {
    it('matches the expected affection action schema', () => {
      expect(restHeadAgainstChestAction).toBeDefined();
      expect(restHeadAgainstChestAction.id).toBe(ACTION_ID);
      expect(restHeadAgainstChestAction.name).toBe('Rest head against chest');
      expect(restHeadAgainstChestAction.description).toBe(
        "Lean in close and rest your head against your partner's chest for comfort."
      );
      expect(restHeadAgainstChestAction.template).toBe(
        "rest your head on {primary}'s chest"
      );
    });

    it('uses a breast-aware primary target definition', () => {
      expect(restHeadAgainstChestAction.targets).toBeDefined();
      expect(restHeadAgainstChestAction.targets.primary).toEqual(
        expect.objectContaining({
          scope: 'affection:actors_with_breasts_facing_each_other',
          placeholder: 'primary',
          description:
            'Partner facing you with breasts that mirror your own anatomy',
        })
      );
    });

    it('requires closeness, forbids kissing, and keeps the affection palette', () => {
      expect(restHeadAgainstChestAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(restHeadAgainstChestAction.forbidden_components.actor).toEqual([
        'kissing:kissing',
        'positioning:biting_neck',
        'sex-states:giving_blowjob',
      ]);
      expect(restHeadAgainstChestAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when close actors face each other and the target has breasts', () => {
      const scenario = testFixture.createAnatomyScenario(['Alice', 'Beth']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when the target lacks breast anatomy', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Cara']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actors are not facing each other', () => {
      const scenario = testFixture.createAnatomyScenario(['Alice', 'Dana']);
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      testFixture.reset([...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor lacks the closeness component', () => {
      const scenario = testFixture.createAnatomyScenario(['Alice', 'Erin']);
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      testFixture.reset([...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor is already kissing the target', () => {
      const scenario = testFixture.createAnatomyScenario(['Alice', 'Faith']);
      scenario.actor.components['kissing:kissing'] = {
        engagedWith: [scenario.target.id],
      };

      testFixture.reset([...scenario.allEntities]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
