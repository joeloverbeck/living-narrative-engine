/**
 * @file Action discovery tests for vampirism:pull_out_fangs
 * @description Validates availability of the pull_out_fangs action when vampire is actively biting the target.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import pullOutFangsAction from '../../../../data/mods/vampirism/actions/pull_out_fangs.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'vampirism:pull_out_fangs';

describe('vampirism:pull_out_fangs - Action Discovery', () => {
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
      pullOutFangsAction,
    ]);

    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        const actorRequired = pullOutFangsAction.required_components?.actor ?? [];
        for (const comp of actorRequired) {
          if (!actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        const actorForbidden = pullOutFangsAction.forbidden_components?.actor ?? [];
        for (const comp of actorForbidden) {
          if (actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        const closeness =
          actorEntity.components?.['positioning:closeness']?.partners ?? [];
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return ActionResult.success([]);
        }

        const entityManager = testBed.mocks.entityManager;
        const getEntity = entityManager.getEntityInstance
          ? entityManager.getEntityInstance.bind(entityManager)
          : entityManager.getEntity.bind(entityManager);

        const actorBitingNeck =
          actorEntity.components?.['positioning:biting_neck'];
        if (!actorBitingNeck) {
          return ActionResult.success([]);
        }

        const validTargets = closeness.reduce((acc, partnerId) => {
          const partner = getEntity(partnerId);
          if (!partner) {
            return acc;
          }

          const partnerBeingBitten =
            partner.components?.['positioning:being_bitten_in_neck'];
          if (!partnerBeingBitten) {
            return acc;
          }

          const actorBitesPartner =
            actorBitingNeck.bitten_entity_id === partnerId;
          const partnerBittenByActor =
            partnerBeingBitten.biting_entity_id === actorEntity.id;

          if (actorBitesPartner && partnerBittenByActor) {
            acc.add(partnerId);
          }

          return acc;
        }, new Set());

        return ActionResult.success(Array.from(validTargets));
      }
    );
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when vampire withdraws fangs from bitten target', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: target.id, initiated: true }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does NOT discover when actor lacks positioning:biting_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when target lacks positioning:being_bitten_in_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: target.id, initiated: true }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when component IDs do not match reciprocally', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: 'someone-else', initiated: true }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when actor has positioning:being_bitten_in_neck (forbidden)', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: target.id, initiated: true }
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: target.id }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when actors lack closeness', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: target.id, initiated: true }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });
  });
});
