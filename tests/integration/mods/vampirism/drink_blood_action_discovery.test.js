/**
 * @file Action discovery tests for vampirism:drink_blood
 * @description Validates action availability when vampire is currently biting target's neck
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import drinkBloodAction from '../../../../data/mods/vampirism/actions/drink_blood.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'vampirism:drink_blood';

describe('vampirism:drink_blood - Action Discovery', () => {
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
      drinkBloodAction,
    ]);

    // Mock target resolution service to implement positioning:actor_being_bitten_by_me scope
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        // Check actor required components first
        const actorRequired = drinkBloodAction.required_components?.actor ?? [];
        for (const comp of actorRequired) {
          if (!actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        // Check actor forbidden components
        const actorForbidden = drinkBloodAction.forbidden_components?.actor ?? [];
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

        // Get actor's biting_neck component
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

          // Check reciprocal bite relationship
          const partnerBeingBitten =
            partner.components?.['positioning:being_bitten_in_neck'];
          if (!partnerBeingBitten) {
            return acc;
          }

          // Validate reciprocal IDs match
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
    it('discovers action when vampire is biting target', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Establish bite relationship
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

    it('discovers action with reciprocal component ID matching', async () => {
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

      // Only add being_bitten component to target, not biting to actor
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when actor has positioning:being_bitten_in_neck (actor is victim)', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Actor is the victim being bitten
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: target.id }
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: target.id, initiated: false }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when target lacks positioning:being_bitten_in_neck component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      // Only add biting component to actor, not being_bitten to target
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

      // Mismatched IDs
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'positioning:biting_neck',
        { bitten_entity_id: 'wrong-id', initiated: true }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'positioning:being_bitten_in_neck',
        { biting_entity_id: actor.id }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does NOT discover when no bite relationship exists', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

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
