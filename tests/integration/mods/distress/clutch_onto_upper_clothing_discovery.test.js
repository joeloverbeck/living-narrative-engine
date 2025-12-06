/**
 * @file Integration tests for distress:clutch_onto_upper_clothing action discovery.
 * @description Ensures the pleading clothing clutch action is discoverable only when closeness, facing, and clothing requirements are satisfied.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

// Mock grabbingUtils to ensure prerequisite passes - actor needs at least 1 free grabbing appendage
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn().mockReturnValue(2),
}));
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import clutchOntoUpperClothingAction from '../../../../data/mods/distress/actions/clutch_onto_upper_clothing.action.json';
import clutchOntoUpperClothingRule from '../../../../data/mods/distress/rules/clutch_onto_upper_clothing.rule.json';
import eventIsActionClutchOntoUpperClothing from '../../../../data/mods/distress/conditions/event-is-action-clutch-onto-upper-clothing.condition.json';

const ACTION_ID = 'distress:clutch_onto_upper_clothing';

/**
 *
 * @param slot
 */
function extractGarmentIdsFromSlot(slot) {
  if (!slot) {
    return [];
  }

  if (typeof slot === 'string') {
    return [slot];
  }

  if (Array.isArray(slot)) {
    return slot.flatMap((entry) => extractGarmentIdsFromSlot(entry));
  }

  if (typeof slot === 'object') {
    if (Array.isArray(slot.base)) {
      return slot.base.flatMap((entry) => extractGarmentIdsFromSlot(entry));
    }

    if (slot.base) {
      return extractGarmentIdsFromSlot(slot.base);
    }

    if (slot.id) {
      return [slot.id];
    }
  }

  return [];
}

describe('distress:clutch_onto_upper_clothing action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'distress',
      ACTION_ID,
      clutchOntoUpperClothingRule,
      eventIsActionClutchOntoUpperClothing
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([clutchOntoUpperClothingAction]);

      const resolver = testEnv.unifiedScopeResolver;
      if (!resolver) {
        return;
      }

      if (!resolver.__distressOriginalResolve) {
        resolver.__distressOriginalResolve =
          resolver.resolveSync.bind(resolver);
      }

      resolver.resolveSync = (scopeName, context) => {
        const { entityManager } = testEnv;
        const resolveEntity = (entry) => {
          if (!entry) {
            return null;
          }

          if (typeof entry === 'string') {
            return entityManager.getEntityInstance(entry);
          }

          if (entry.id) {
            return entityManager.getEntityInstance(entry.id);
          }

          return null;
        };
        if (
          scopeName ===
          'distress:close_actors_facing_each_other_with_torso_clothing'
        ) {
          const actorContext = context?.actor;
          const actorId = actorContext?.id || actorContext || context;
          const actorEntity = resolveEntity(actorId);

          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closenessPartners =
            actorEntity.components?.['positioning:closeness']?.partners || [];
          const actorFacingAway = new Set(
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || []
          );

          const validTargets = new Set();

          for (const partnerId of closenessPartners) {
            if (actorFacingAway.has(partnerId)) {
              continue;
            }

            const partnerEntity = entityManager.getEntityInstance(partnerId);
            if (!partnerEntity) {
              continue;
            }

            const partnerFacingAway = new Set(
              partnerEntity.components?.['positioning:facing_away']
                ?.facing_away_from || []
            );
            if (partnerFacingAway.has(actorEntity.id || actorId)) {
              continue;
            }

            const equipment =
              partnerEntity.components?.['clothing:equipment']?.equipped || {};
            const torsoUpper = equipment.torso_upper;
            const garmentIds = extractGarmentIdsFromSlot(torsoUpper);

            if (garmentIds.length > 0) {
              validTargets.add(partnerId);
            }
          }

          return { success: true, value: validTargets };
        }

        if (scopeName === 'clothing:target_topmost_torso_upper_clothing') {
          const targetContext =
            context?.target || context?.primary || context?.entity || context;
          const targetEntity = resolveEntity(targetContext);

          if (!targetEntity) {
            return { success: true, value: new Set() };
          }

          const equipment =
            targetEntity.components?.['clothing:equipment']?.equipped || {};
          const torsoUpper = equipment.torso_upper;
          const garmentIds = extractGarmentIdsFromSlot(torsoUpper);

          return { success: true, value: new Set(garmentIds) };
        }

        return resolver.__distressOriginalResolve.call(
          resolver,
          scopeName,
          context
        );
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      const resolver = testFixture.testEnv?.unifiedScopeResolver;
      if (resolver?.__distressOriginalResolve) {
        resolver.resolveSync = resolver.__distressOriginalResolve;
        delete resolver.__distressOriginalResolve;
      }
      testFixture.cleanup();
    }
  });

  const discoverActionForActor = (actorId) => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return false;
    }

    const actorEntity = testEnv.entityManager.getEntityInstance(actorId);
    if (!actorEntity) {
      return false;
    }

    const candidateActions = testEnv.actionIndex.getCandidateActions({
      id: actorId,
    });
    const resolver = testEnv.unifiedScopeResolver;

    return candidateActions.some((action) => {
      if (action.id !== ACTION_ID) {
        return false;
      }

      const baseContext = {
        actor: { id: actorId, components: actorEntity.components },
      };

      const primaryResult = resolver.resolveSync(
        action.targets.primary.scope,
        baseContext
      );

      if (!primaryResult.success || primaryResult.value.size === 0) {
        return false;
      }

      return Array.from(primaryResult.value).some((primaryId) => {
        const primaryEntity =
          testEnv.entityManager.getEntityInstance(primaryId);
        const secondaryContext = {
          actor: baseContext.actor,
          target: primaryEntity
            ? { id: primaryId, components: primaryEntity.components }
            : { id: primaryId, components: {} },
          primary: primaryEntity
            ? { id: primaryId, components: primaryEntity.components }
            : { id: primaryId, components: {} },
        };

        const secondaryResult = resolver.resolveSync(
          action.targets.secondary.scope,
          secondaryContext
        );

        return secondaryResult.success && secondaryResult.value.size > 0;
      });
    });
  };

  describe('Action metadata validation', () => {
    it('matches the expected distress action schema and template', () => {
      expect(clutchOntoUpperClothingAction).toBeDefined();
      expect(clutchOntoUpperClothingAction.id).toBe(ACTION_ID);
      expect(clutchOntoUpperClothingAction.name).toBe(
        'Clutch Pleadingly Onto Clothing'
      );
      expect(clutchOntoUpperClothingAction.template).toBe(
        "clutch pleadingly onto {primary}'s {secondary}"
      );
      expect(clutchOntoUpperClothingAction.targets.primary.scope).toBe(
        'distress:close_actors_facing_each_other_with_torso_clothing'
      );
      expect(clutchOntoUpperClothingAction.targets.secondary.scope).toBe(
        'clothing:target_topmost_torso_upper_clothing'
      );
    });

    it('requires closeness and uses the Obsidian Frost palette', () => {
      expect(clutchOntoUpperClothingAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(clutchOntoUpperClothingAction.forbidden_components).toEqual({
        actor: ['positioning:hugging', 'positioning:restraining'],
        primary: ['positioning:giving_blowjob'],
        secondary: [],
      });
      expect(clutchOntoUpperClothingAction.visual).toEqual({
        backgroundColor: '#0b132b',
        textColor: '#f2f4f8',
        hoverBackgroundColor: '#1c2541',
        hoverTextColor: '#e0e7ff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when actors are close, facing, and the target has torso clothing', () => {
      const scenario = testFixture.createCloseActors(['Iris', 'Jonah'], {
        location: 'atrium',
      });

      const garment = {
        id: 'garment1',
        components: {
          'core:name': { text: 'wool coat' },
          'core:position': { locationId: 'atrium' },
        },
      };

      scenario.target.components['clothing:equipment'] = {
        equipped: {
          torso_upper: { base: garment.id },
        },
      };

      const room = ModEntityScenarios.createRoom('atrium', 'Atrium');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
      expect(discoverActionForActor(scenario.actor.id)).toBe(true);
    });

    it('is not available when actors lack closeness', () => {
      const scenario = testFixture.createCloseActors(['Kara', 'Leon']);
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      const garment = {
        id: 'garment2',
        components: {
          'core:name': { text: 'linen shirt' },
        },
      };

      scenario.target.components['clothing:equipment'] = {
        equipped: {
          torso_upper: { base: garment.id },
        },
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);
      configureActionDiscovery();

      expect(discoverActionForActor(scenario.actor.id)).toBe(false);
    });

    it('is not available when actors are facing away from each other', () => {
      const scenario = testFixture.createCloseActors(['Mira', 'Noah']);

      scenario.actor.components['positioning:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };

      const garment = {
        id: 'garment3',
        components: {
          'core:name': { text: 'denim jacket' },
        },
      };

      scenario.target.components['clothing:equipment'] = {
        equipped: {
          torso_upper: { base: garment.id },
        },
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);
      configureActionDiscovery();

      expect(discoverActionForActor(scenario.actor.id)).toBe(false);
    });

    it('is not available when the target lacks torso-upper clothing', () => {
      const scenario = testFixture.createCloseActors(['Olivia', 'Preston']);

      scenario.target.components['clothing:equipment'] = {
        equipped: {
          torso_lower: { base: 'pants1' },
        },
      };

      const garment = {
        id: 'pants1',
        components: {
          'core:name': { text: 'casual slacks' },
        },
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);
      configureActionDiscovery();

      expect(discoverActionForActor(scenario.actor.id)).toBe(false);
    });

    it('is not available when the actor is currently hugging someone else', () => {
      const scenario = testFixture.createCloseActors(['Quinn', 'Riley'], {
        location: 'arboretum',
      });

      scenario.actor.components['positioning:hugging'] = {
        embraced_entity_id: scenario.target.id,
        initiated: true,
      };

      const garment = {
        id: 'cloak1',
        components: {
          'core:name': { text: 'soft cloak' },
          'core:position': { locationId: 'arboretum' },
        },
      };

      scenario.target.components['clothing:equipment'] = {
        equipped: {
          torso_upper: { base: garment.id },
        },
      };

      const room = ModEntityScenarios.createRoom('arboretum', 'Arboretum');
      testFixture.reset([room, scenario.actor, scenario.target, garment]);
      configureActionDiscovery();

      expect(discoverActionForActor(scenario.actor.id)).toBe(false);
    });
  });
});
