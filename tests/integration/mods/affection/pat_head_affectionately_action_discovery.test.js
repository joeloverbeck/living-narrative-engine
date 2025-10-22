/**
 * @file Integration tests for affection:pat_head_affectionately action discovery.
 * @description Ensures the affectionate head pat action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import patHeadAffectionatelyAction from '../../../../data/mods/affection/actions/pat_head_affectionately.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'affection:pat_head_affectionately';

describe('affection:pat_head_affectionately action discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();

    const simpleEntityManager = new SimpleEntityManager();
    testBed.mocks.entityManager = simpleEntityManager;
    testBed.entityManager = simpleEntityManager;
    if (testBed.service) {
      testBed.service.entityManager = simpleEntityManager;
    }

    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      patHeadAffectionatelyAction,
    ]);

    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        const closeness =
          actorEntity.components?.['positioning:closeness']?.partners ?? [];
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return ActionResult.success([]);
        }

        const entityManager = testBed.mocks.entityManager;
        const getEntity = entityManager.getEntityInstance
          ? entityManager.getEntityInstance.bind(entityManager)
          : entityManager.getEntity.bind(entityManager);
        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']?.facing_away_from ?? [];
        const actorKneelingBefore =
          actorEntity.components?.['positioning:kneeling_before']?.entityId ?? null;

        const validTargets = closeness.reduce((acc, partnerId) => {
          const partner = getEntity(partnerId);
          if (!partner) {
            return acc;
          }

          const partnerFacingAway =
            partner.components?.['positioning:facing_away']?.facing_away_from ?? [];
          const partnerKneelingBefore =
            partner.components?.['positioning:kneeling_before']?.entityId ?? null;

          const facingEachOther =
            !actorFacingAway.includes(partnerId) &&
            !partnerFacingAway.includes(actorEntity.id);
          const actorBehind =
            partnerFacingAway.includes(actorEntity.id) &&
            !actorFacingAway.includes(partnerId);
          const actorKneeling = actorKneelingBefore === partnerId;
          const partnerKneeling = partnerKneelingBefore === actorEntity.id;

          const isValidTarget =
            ((facingEachOther || actorBehind) && !actorKneeling && !partnerKneeling) ||
            partnerKneeling;

          if (isValidTarget) {
            acc.add(partnerId);
          }

          return acc;
        }, new Set());

        const contexts = Array.from(validTargets).map((targetId) =>
          ActionTargetContext.forEntity(targetId)
        );

        return ActionResult.success(contexts);
      }
    );
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected affection action schema', () => {
      expect(patHeadAffectionatelyAction).toBeDefined();
      expect(patHeadAffectionatelyAction.id).toBe(ACTION_ID);
      expect(patHeadAffectionatelyAction.template).toBe('pat {target} on the head');
      expect(patHeadAffectionatelyAction.targets).toBe(
        'positioning:close_actors_or_entity_kneeling_before_actor'
      );
    });

    it('requires actor closeness and uses the affection color palette', () => {
      expect(patHeadAffectionatelyAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(patHeadAffectionatelyAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', async () => {
      const { actor } = testBed.createActorTargetScenario();

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });

    it('is available when the target kneels before the actor', async () => {
      const { actor, target } = testBed.createActorTargetScenario();
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:kneeling_before',
        { entityId: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });

    it('is not available when actors are not in closeness', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', async () => {
      const { actor, target } = testBed.createActorTargetScenario();
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:facing_away',
        {
          facing_away_from: [target.id],
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });
  });
});
