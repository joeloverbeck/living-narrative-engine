/**
 * @file Integration tests for affection:pat_ass_affectionately action discovery.
 * @description Ensures the affectionate ass pat action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import patAssAffectionatelyAction from '../../../../data/mods/affection/actions/pat_ass_affectionately.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'affection:pat_ass_affectionately';

describe('affection:pat_ass_affectionately action discovery', () => {
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
      patAssAffectionatelyAction,
    ]);

    // Mock target resolution for caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target
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

          // Check if partner has ass anatomy
          const hasAssAnatomy =
            partner.components?.['anatomy:body_part_graph']?.parts?.some(
              (part) => part.type === 'ass_cheek'
            );
          if (!hasAssAnatomy) {
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

          // Block both kneeling directions for ass actions
          const actorKneeling = actorKneelingBefore === partnerId;
          const partnerKneeling = partnerKneelingBefore === actorEntity.id;

          const isValidTarget =
            (facingEachOther || actorBehind) && !actorKneeling && !partnerKneeling;

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
      expect(patAssAffectionatelyAction).toBeDefined();
      expect(patAssAffectionatelyAction.id).toBe(ACTION_ID);
      expect(patAssAffectionatelyAction.template).toBe("pat {target}'s ass");
      expect(patAssAffectionatelyAction.targets).toBe(
        'caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target'
      );
    });

    it('requires actor closeness and uses the affection color palette', () => {
      expect(patAssAffectionatelyAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(patAssAffectionatelyAction.visual).toEqual({
        backgroundColor: '#6a1b9a',
        textColor: '#f3e5f5',
        hoverBackgroundColor: '#8e24aa',
        hoverTextColor: '#ffffff',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other with ass anatomy', async () => {
      const { actor, target } = testBed.createActorTargetScenario();

      // Add ass anatomy to target
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'anatomy:body_part_graph',
        {
          parts: [
            { id: 'left_ass_cheek', type: 'ass_cheek' },
            { id: 'right_ass_cheek', type: 'ass_cheek' },
          ],
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });

    it('is available when actor is behind target with ass anatomy', async () => {
      const { actor, target } = testBed.createActorTargetScenario();

      // Add ass anatomy to target
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'anatomy:body_part_graph',
        {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        }
      );

      // Actor behind target (target facing away from actor)
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:facing_away',
        {
          facing_away_from: [actor.id],
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });

    it('is not available when actors are not in closeness', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', async () => {
      const { actor, target } = testBed.createActorTargetScenario();

      // Add ass anatomy to target
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'anatomy:body_part_graph',
        {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        }
      );

      // Actor facing away from target
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

    it('is not available when target faces away from actor (unless actor behind)', async () => {
      const { actor, target } = testBed.createActorTargetScenario();

      // Add ass anatomy to target
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'anatomy:body_part_graph',
        {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        }
      );

      // Target facing away from actor, but actor also facing away from target (incompatible)
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:facing_away',
        {
          facing_away_from: [actor.id],
        }
      );
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

    it('is not available when actor kneels before target', async () => {
      const { actor, target } = testBed.createActorTargetScenario();

      // Add ass anatomy to target
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'anatomy:body_part_graph',
        {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        }
      );

      // Actor kneeling before target
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:kneeling_before',
        { entityId: target.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when target kneels before actor', async () => {
      const { actor, target } = testBed.createActorTargetScenario();

      // Add ass anatomy to target
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'anatomy:body_part_graph',
        {
          parts: [{ id: 'left_ass_cheek', type: 'ass_cheek' }],
        }
      );

      // Target kneeling before actor
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:kneeling_before',
        { entityId: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when target lacks ass anatomy', async () => {
      const { actor } = testBed.createActorTargetScenario();
      // Target doesn't have ass anatomy

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });
  });
});
