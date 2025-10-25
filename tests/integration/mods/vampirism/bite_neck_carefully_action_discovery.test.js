/**
 * @file Action discovery tests for vampirism:bite_neck_carefully
 * @description Validates action availability under various component and positioning configurations
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import biteNeckCarefullyAction from '../../../../data/mods/vampirism/actions/bite_neck_carefully.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'vampirism:bite_neck_carefully';

describe('vampirism:bite_neck_carefully - Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();

    // Use SimpleEntityManager for integration tests
    const simpleEntityManager = new SimpleEntityManager();
    testBed.mocks.entityManager = simpleEntityManager;
    testBed.entityManager = simpleEntityManager;
    if (testBed.service) {
      testBed.service.entityManager = simpleEntityManager;
    }

    // Mock action index to return our action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      biteNeckCarefullyAction,
    ]);

    // Mock target resolution service
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        // Check actor required components first
        const actorRequired = biteNeckCarefullyAction.required_components?.actor ?? [];
        for (const comp of actorRequired) {
          if (!actorEntity.components?.[comp]) {
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

        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']?.facing_away_from ?? [];
        const actorKneelingBefore =
          actorEntity.components?.['positioning:kneeling_before']?.entity_id ?? null;
        const actorStandingBehind =
          actorEntity.components?.['positioning:standing_behind']?.target_id ?? null;

        // Check actor forbidden components before processing targets
        const actorForbidden = biteNeckCarefullyAction.forbidden_components?.actor ?? [];
        for (const comp of actorForbidden) {
          if (actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        const validTargets = closeness.reduce((acc, partnerId) => {
          const partner = getEntity(partnerId);
          if (!partner) {
            return acc;
          }

          // Check target forbidden components
          const targetForbidden = biteNeckCarefullyAction.forbidden_components?.primary ?? [];
          for (const comp of targetForbidden) {
            if (partner.components?.[comp]) {
              return acc;
            }
          }

          const partnerFacingAway =
            partner.components?.['positioning:facing_away']?.facing_away_from ?? [];
          const partnerKneelingBefore =
            partner.components?.['positioning:kneeling_before']?.entity_id ?? null;

          const facingEachOther =
            !actorFacingAway.includes(partnerId) &&
            !partnerFacingAway.includes(actorEntity.id);
          const actorBehind = actorStandingBehind === partnerId;
          const actorKneeling = actorKneelingBefore === partnerId;
          const partnerKneeling = partnerKneelingBefore === actorEntity.id;

          const isValidTarget =
            (facingEachOther || actorBehind) && !actorKneeling && !partnerKneeling;

          if (isValidTarget) {
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
    it('discovers action when actor is a vampire with closeness and facing target', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Add vampire marker to actor
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });

    it('discovers action when vampire actor is behind target', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Add vampire marker and standing_behind component
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:standing_behind',
        { target_id: target.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does not discover when actor is not a vampire', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Actor has closeness but NOT vampirism:is_vampire
      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when closeness component is missing', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      // Add vampire marker but no closeness
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actor already has biting_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: 'other_entity', initiated: true }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actor has giving_blowjob component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:giving_blowjob',
        { target_id: target.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when target has being_bitten_in_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: 'other_vampire' }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actors are not in proximity', async () => {
      const actor = testBed.createActorWithValidation('actor1', {
        name: 'Dracula',
      });
      const target = testBed.createActorWithValidation('target1', {
        name: 'Jonathan',
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      // Different locations, no closeness
      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actor is kneeling before target', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:kneeling_before',
        { entity_id: target.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when target is kneeling before vampire actor', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:kneeling_before',
        { entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Discovery Diagnostics', () => {
    it('provides diagnostic information when discovery fails', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      const { diagnostics } = await testBed.discoverActionsWithDiagnostics(
        actor,
        { includeDiagnostics: true }
      );

      expect(diagnostics).toBeDefined();
    });
  });
});
