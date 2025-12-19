/**
 * @file Integration tests for affection:touch_nose_tenderly action discovery.
 * @description Ensures the tender nose touch action is discoverable only when requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import touchNoseTenderlyAction from '../../../../data/mods/affection/actions/touch_nose_tenderly.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'affection:touch_nose_tenderly';

describe('affection:touch_nose_tenderly action discovery', () => {
  let testBed;
  let addNoseAnatomy;
  let createScenarioWithNoses;
  let entityHasNose;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();

    const simpleEntityManager = new SimpleEntityManager();
    testBed.mocks.entityManager = simpleEntityManager;
    testBed.entityManager = simpleEntityManager;
    if (testBed.service) {
      testBed.service.entityManager = simpleEntityManager;
    }

    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      touchNoseTenderlyAction,
    ]);

    const entityManager = /** @type {SimpleEntityManager} */ (
      testBed.mocks.entityManager
    );

    addNoseAnatomy = (entityId) => {
      const headId = `${entityId}_head`;
      const noseId = `${entityId}_nose`;

      entityManager.createEntity(headId);
      entityManager.addComponent(headId, 'anatomy:part', {
        parent: null,
        children: [noseId],
        subType: 'head',
      });

      entityManager.createEntity(noseId);
      entityManager.addComponent(noseId, 'anatomy:part', {
        parent: headId,
        children: [],
        subType: 'nose',
      });
      entityManager.addComponent(noseId, 'anatomy:joint', {
        parentId: headId,
        socketId: 'head-nose',
      });

      entityManager.addComponent(entityId, 'anatomy:body', { root: headId });
    };

    entityHasNose = (entityId) => {
      const body = entityManager.getComponent(entityId, 'anatomy:body');
      const rootId = body?.body?.root ?? body?.root ?? null;
      if (!rootId) {
        return false;
      }

      const rootPart = entityManager.getComponent(rootId, 'anatomy:part');
      const childIds = rootPart?.children || [];

      if (
        rootPart?.subType &&
        rootPart.subType.toLowerCase().includes('nose')
      ) {
        return true;
      }

      return childIds.some((childId) => {
        const part = entityManager.getComponent(childId, 'anatomy:part');
        return part?.subType && part.subType.toLowerCase().includes('nose');
      });
    };

    createScenarioWithNoses = (options = {}) => {
      const scenario = testBed.createActorTargetScenario(options);
      addNoseAnatomy(scenario.actor.id);
      addNoseAnatomy(scenario.target.id);
      return scenario;
    };

    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        const closeness =
          actorEntity.components?.['personal-space-states:closeness']?.partners ?? [];
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return ActionResult.success([]);
        }

        const entityManager = testBed.mocks.entityManager;
        const getEntity = entityManager.getEntityInstance
          ? entityManager.getEntityInstance.bind(entityManager)
          : entityManager.getEntity.bind(entityManager);
        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']
            ?.facing_away_from ?? [];
        const actorKneelingBefore =
          actorEntity.components?.['positioning:kneeling_before']?.entityId ??
          null;

        const validTargets = closeness.reduce((acc, partnerId) => {
          const partner = getEntity(partnerId);
          if (!partner) {
            return acc;
          }

          const partnerFacingAway =
            partner.components?.['positioning:facing_away']?.facing_away_from ??
            [];
          const partnerKneelingBefore =
            partner.components?.['positioning:kneeling_before']?.entityId ??
            null;

          const facingEachOther =
            !actorFacingAway.includes(partnerId) &&
            !partnerFacingAway.includes(actorEntity.id);
          const actorBehind =
            partnerFacingAway.includes(actorEntity.id) &&
            !actorFacingAway.includes(partnerId);
          const actorKneeling = actorKneelingBefore === partnerId;
          const partnerKneeling = partnerKneelingBefore === actorEntity.id;

          const isValidTarget =
            ((facingEachOther || actorBehind) &&
              !actorKneeling &&
              !partnerKneeling) ||
            partnerKneeling;

          if (isValidTarget && entityHasNose(partnerId)) {
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
      expect(touchNoseTenderlyAction).toBeDefined();
      expect(touchNoseTenderlyAction.id).toBe(ACTION_ID);
      expect(touchNoseTenderlyAction.template).toBe(
        "touch the tip of {target}'s nose tenderly"
      );
      expect(touchNoseTenderlyAction.targets).toBe(
        'affection:close_actors_with_nose_or_entity_kneeling_before_actor'
      );
      expect(touchNoseTenderlyAction.required_components.actor).toContain(
        'personal-space-states:closeness'
      );
      expect(touchNoseTenderlyAction.visual.backgroundColor).toBe('#6a1b9a');
      expect(touchNoseTenderlyAction.visual.textColor).toBe('#f3e5f5');
      expect(touchNoseTenderlyAction.visual.hoverBackgroundColor).toBe(
        '#8e24aa'
      );
      expect(touchNoseTenderlyAction.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Positive discovery scenarios', () => {
    it('is available for close actors facing each other', async () => {
      const { actor } = createScenarioWithNoses();

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });

    it('is available when the actor stands behind the target', async () => {
      const { actor, target } = createScenarioWithNoses();
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:facing_away',
        { facing_away_from: [actor.id] }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });

    it('is available when the target is kneeling before the actor', async () => {
      const { actor, target } = createScenarioWithNoses();
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:kneeling_before',
        { entityId: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toHaveAction(ACTION_ID);
    });
  });

  describe('Negative discovery scenarios', () => {
    it('is not available when actors are not in closeness', async () => {
      const { actor } = createScenarioWithNoses({
        closeProximity: false,
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', async () => {
      const { actor, target } = createScenarioWithNoses();
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:facing_away',
        { facing_away_from: [target.id] }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when the actor is kneeling before the target', async () => {
      const { actor, target } = createScenarioWithNoses();
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:kneeling_before',
        { entityId: target.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when closeness component is missing', async () => {
      const { actor } = createScenarioWithNoses({
        closeProximity: false,
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });
    it('is not available when the target lacks a nose part', async () => {
      const { actor, target } = testBed.createActorTargetScenario();
      // Only give the actor a nose to ensure target requirement is enforced
      addNoseAnatomy(actor.id);

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });
  });
});
