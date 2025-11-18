/**
 * @file Integration tests for caressing:caress_bare_back action discovery.
 * @description Ensures the caress bare back action is discoverable only when proximity, orientation, and uncovered back requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import caressBareBackAction from '../../../../data/mods/caressing/actions/caress_bare_back.action.json';

const ACTION_ID = 'caressing:caress_bare_back';
const BACK_SOCKETS = ['upper_back', 'lower_back'];

/**
 *
 * @param entity
 */
function ensureBackSlotMetadata(entity) {
  entity.components['clothing:slot_metadata'] = {
    slotMappings: {
      back_accessory: {
        coveredSockets: BACK_SOCKETS,
        allowedLayers: ['accessory', 'armor'],
      },
    },
  };
}

/**
 *
 * @param entity
 * @param root0
 * @param root0.covered
 */
function setBackCoverage(entity, { covered } = { covered: false }) {
  ensureBackSlotMetadata(entity);

  if (covered) {
    entity.components['clothing:equipment'] = {
      equipped: {
        back_accessory: {
          armor: ['backplate'],
        },
      },
    };
  } else {
    delete entity.components['clothing:equipment'];
  }
}

describe('caressing:caress_bare_back action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('caressing', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([caressBareBackAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__caressBareBackOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__caressBareBackOriginalResolve = originalResolve;

      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'caressing:close_actors_with_uncovered_back') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const closenessPartners =
            actorEntity.components?.['positioning:closeness']?.partners || [];
          if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']?.facing_away_from || [];

          const getCoveringSlots = (targetEntity, socketName) => {
            const slotMappings =
              targetEntity.components?.['clothing:slot_metadata']?.slotMappings;
            if (!slotMappings) {
              return [];
            }

            return Object.entries(slotMappings).reduce((acc, [slotId, mapping]) => {
              if (
                mapping &&
                Array.isArray(mapping.coveredSockets) &&
                mapping.coveredSockets.includes(socketName)
              ) {
                acc.push(slotId);
              }
              return acc;
            }, []);
          };

          const slotHasCoveringItems = (targetEntity, slotName) => {
            const equipped = targetEntity.components?.['clothing:equipment']?.equipped;
            if (!equipped) {
              return false;
            }

            const slotData = equipped[slotName];
            if (!slotData || typeof slotData !== 'object' || Array.isArray(slotData)) {
              return false;
            }

            return Object.entries(slotData).some(([layer, items]) => {
              if (layer === 'accessories') {
                return false;
              }

              if (Array.isArray(items)) {
                return items.length > 0;
              }

              if (typeof items === 'string') {
                return items.trim().length > 0;
              }

              if (items && typeof items === 'object') {
                return Object.keys(items).length > 0;
              }

              return false;
            });
          };

          const isSocketCovered = (targetEntity, socketName) => {
            const coveringSlots = getCoveringSlots(targetEntity, socketName);
            if (coveringSlots.length === 0) {
              return false;
            }

            return coveringSlots.some((slotName) =>
              slotHasCoveringItems(targetEntity, slotName)
            );
          };

          const isBackUncovered = (targetEntity) =>
            BACK_SOCKETS.every((socket) => !isSocketCovered(targetEntity, socket));

          const validTargets = closenessPartners.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']?.facing_away_from || [];

            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);
            const actorBehindTarget = partnerFacingAway.includes(actorId);

            if ((facingEachOther || actorBehindTarget) && isBackUncovered(partner)) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };

      const prerequisiteService = testEnv.prerequisiteService;
      if (prerequisiteService) {
        const originalPrereqEvaluate =
          prerequisiteService.__caressBareBackOriginalPrereqEval ||
          prerequisiteService.evaluate.bind(prerequisiteService);

        prerequisiteService.__caressBareBackOriginalPrereqEval =
          originalPrereqEvaluate;

        prerequisiteService.evaluate = (
          prerequisites,
          actionDefinition,
          actor,
          trace
        ) => {
          if (actionDefinition?.id === ACTION_ID) {
            return true;
          }

          return originalPrereqEvaluate(
            prerequisites,
            actionDefinition,
            actor,
            trace
          );
        };
      }
    };
  });

  afterEach(() => {
    if (testFixture?.testEnv?.prerequisiteService) {
      const prerequisiteService = testFixture.testEnv.prerequisiteService;
      if (prerequisiteService.__caressBareBackOriginalPrereqEval) {
        prerequisiteService.evaluate =
          prerequisiteService.__caressBareBackOriginalPrereqEval;
        delete prerequisiteService.__caressBareBackOriginalPrereqEval;
      }
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected caressing action schema', () => {
      expect(caressBareBackAction).toBeDefined();
      expect(caressBareBackAction.id).toBe(ACTION_ID);
      expect(caressBareBackAction.template).toBe(
        "caress the bare skin of {primary}'s back"
      );
      expect(caressBareBackAction.targets.primary.scope).toBe(
        'caressing:close_actors_with_uncovered_back'
      );
    });

    it('requires actor closeness and uses the caressing color palette', () => {
      expect(caressBareBackAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(caressBareBackAction.visual).toEqual({
        backgroundColor: '#311b92',
        textColor: '#d1c4e9',
        hoverBackgroundColor: '#4527a0',
        hoverTextColor: '#ede7f6',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other with uncovered backs', () => {
      const scenario = testFixture.createCloseActors(['Avery', 'Quinn']);
      setBackCoverage(scenario.target, { covered: false });

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is available when the actor is behind the target with an uncovered back', () => {
      const scenario = testFixture.createCloseActors(['Jordan', 'Riley']);
      setBackCoverage(scenario.target, { covered: false });
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when the target back is covered', () => {
      const scenario = testFixture.createCloseActors(['Blair', 'Harper']);
      setBackCoverage(scenario.target, { covered: true });

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actors are not in closeness', () => {
      const scenario = testFixture.createCloseActors(['Indigo', 'Sage']);
      setBackCoverage(scenario.target, { covered: false });

      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when orientation requirements are not met', () => {
      const scenario = testFixture.createCloseActors(['Morgan', 'Shawn']);
      setBackCoverage(scenario.target, { covered: false });

      scenario.actor.components['positioning:facing_away'] = {
        facing_away_from: [scenario.target.id],
      };
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [],
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
