/**
 * @file Integration tests for affection:ruffle_hair_playfully action discovery.
 * @description Ensures the playful hair ruffle action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import ruffleHairAction from '../../../../data/mods/affection/actions/ruffle_hair_playfully.action.json';

const ACTION_ID = 'affection:ruffle_hair_playfully';

describe('affection:ruffle_hair_playfully action discovery', () => {
  let testFixture;
  let configureActionDiscovery;
  let addAnatomyFeatures;
  let createCloseActorsWithHair;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([ruffleHairAction]);

      const entityManager = testEnv.entityManager;
      const hasHair = (entityId) => {
        const bodyComponent = entityManager.getComponent(
          entityId,
          'anatomy:body'
        );
        const rootId = bodyComponent?.body?.root ?? bodyComponent?.root ?? null;
        if (!rootId) {
          return false;
        }

        const toVisit = [rootId];
        const visited = new Set();

        while (toVisit.length > 0) {
          const currentId = toVisit.pop();
          if (!currentId || visited.has(currentId)) {
            continue;
          }
          visited.add(currentId);

          const part = entityManager.getComponent(currentId, 'anatomy:part');
          if (part?.subType && part.subType.toLowerCase().includes('hair')) {
            return true;
          }

          const children = Array.isArray(part?.children) ? part.children : [];
          toVisit.push(...children);
        }

        return false;
      };

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__ruffleHairOriginalResolve ||
        scopeResolver.resolveSync?.bind(scopeResolver) ||
        scopeResolver.resolve?.bind(scopeResolver);

      if (originalResolve) {
        scopeResolver.__ruffleHairOriginalResolve = originalResolve;
        scopeResolver.resolveSync = (scopeName, context) => {
          if (
            scopeName ===
            'affection:close_actors_with_hair_or_entity_kneeling_before_actor'
          ) {
            const actorId = context?.actor?.id;
            if (!actorId) {
              return { success: true, value: new Set() };
            }

            const actorEntity = entityManager.getEntityInstance(actorId);
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
              if (!partner || !hasHair(partnerId)) {
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
                partner.components?.['deference-states:kneeling_before']
                  ?.entityId === actorId;

              const normalPosition =
                (facingEachOther || actorBehind) &&
                !actorKneelingBefore &&
                !partnerKneelingBefore;
              const partnerKneeling = partnerKneelingBefore;

              if (normalPosition || partnerKneeling) {
                acc.add(partnerId);
              }

              return acc;
            }, new Set());

            return { success: true, value: validTargets };
          }

          return originalResolve(scopeName, context);
        };
      }
    };

    addAnatomyFeatures = (entityId, featureSubTypes = []) => {
      const entityManager = testFixture?.testEnv?.entityManager;
      if (!entityManager) {
        return;
      }

      const rootId = `${entityId}_head`;
      const childIds = featureSubTypes.map(
        (subType, index) => `${entityId}_${subType}_${index + 1}`
      );

      entityManager.createEntity(rootId);
      entityManager.addComponent(rootId, 'anatomy:part', {
        parent: null,
        children: childIds,
        subType: 'head',
      });

      childIds.forEach((partId, index) => {
        const subType = featureSubTypes[index];
        entityManager.createEntity(partId);
        entityManager.addComponent(partId, 'anatomy:part', {
          parent: rootId,
          children: [],
          subType,
        });
        entityManager.addComponent(partId, 'anatomy:joint', {
          parentId: rootId,
          socketId: `${subType}_socket`,
        });
      });

      entityManager.addComponent(entityId, 'anatomy:body', { root: rootId });
    };

    createCloseActorsWithHair = (names) => {
      const scenario = testFixture.createAnatomyScenario(
        names,
        ['torso', 'head', 'hair'],
        { includeRoom: true }
      );
      addAnatomyFeatures(scenario.actor.id, ['hair']);
      return scenario;
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected affection action schema', () => {
      expect(ruffleHairAction).toBeDefined();
      expect(ruffleHairAction.id).toBe(ACTION_ID);
      expect(ruffleHairAction.template).toBe(
        "ruffle {target}'s hair playfully"
      );
      expect(ruffleHairAction.targets).toBe(
        'affection:close_actors_with_hair_or_entity_kneeling_before_actor'
      );
    });

    it('requires actor closeness and uses the affection color palette', () => {
      expect(ruffleHairAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(ruffleHairAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', () => {
      const scenario = createCloseActorsWithHair(['Alice', 'Bob']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);
      expect(ids).toContain(ACTION_ID);
    });

    it('is available when the actor stands behind the target', () => {
      const scenario = createCloseActorsWithHair(['Maya', 'Noah']);
      scenario.target.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([
        room,
        scenario.actor,
        scenario.target,
        ...scenario.bodyParts,
      ]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actors are not in closeness', () => {
      const scenario = createCloseActorsWithHair(['Ivy', 'Liam']);
      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([
        room,
        scenario.actor,
        scenario.target,
        ...scenario.bodyParts,
      ]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', () => {
      const scenario = createCloseActorsWithHair(['Chloe', 'Evan']);
      scenario.actor.components['facing-states:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([
        room,
        scenario.actor,
        scenario.target,
        ...scenario.bodyParts,
      ]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the target lacks hair anatomy', () => {
      const scenario = testFixture.createCloseActors(['Jamie', 'Quinn']);
      // Only give hair anatomy to the actor to isolate the missing target requirement
      addAnatomyFeatures(scenario.actor.id, ['hair']);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
