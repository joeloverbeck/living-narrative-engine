/**
 * @file Action discovery tests for vampirism:lunge_bite_neck_violently
 * @description Validates action availability for distance vampire attacks (no closeness required)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import lungeBiteNeckViolentlyAction from '../../../../data/mods/vampirism/actions/lunge_bite_neck_violently.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'vampirism:lunge_bite_neck_violently';

describe('vampirism:lunge_bite_neck_violently - Action Discovery', () => {
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
      lungeBiteNeckViolentlyAction,
    ]);

    // Mock target resolution service
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      (_scopeName, actorEntity) => {
        // Check actor required components first
        const actorRequired = lungeBiteNeckViolentlyAction.required_components?.actor ?? [];
        for (const comp of actorRequired) {
          if (!actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        // Check actor forbidden components
        const actorForbidden = lungeBiteNeckViolentlyAction.forbidden_components?.actor ?? [];
        for (const comp of actorForbidden) {
          if (actorEntity.components?.[comp]) {
            return ActionResult.success([]);
          }
        }

        // Get all actors in same location (NO closeness requirement)
        const entityManager = testBed.mocks.entityManager;

        const actorPosition = actorEntity.components?.['core:position'];
        if (!actorPosition?.locationId) {
          return ActionResult.success([]);
        }

        const allEntities = Array.from(entityManager.entities.values());
        const validTargets = allEntities.reduce((acc, targetEntity) => {
          if (targetEntity.id === actorEntity.id) {
            return acc; // Skip self
          }

          const targetPosition = targetEntity.components?.['core:position'];
          if (targetPosition?.locationId !== actorPosition.locationId) {
            return acc; // Different location
          }

          // Check target forbidden components
          const targetForbidden = lungeBiteNeckViolentlyAction.forbidden_components?.primary ?? [];
          for (const comp of targetForbidden) {
            if (targetEntity.components?.[comp]) {
              return acc;
            }
          }

          acc.add(targetEntity.id);
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
    it('discovers action when vampire and target are in same location without closeness', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false, // Key: NO closeness required
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

    it('discovers action when vampire and multiple targets are in same location', async () => {
      const actor = testBed.createActorWithValidation('vampire1', {
        name: 'Predator',
      });
      const target1 = testBed.createActorWithValidation('victim1', {
        name: 'Victim 1',
      });
      const target2 = testBed.createActorWithValidation('victim2', {
        name: 'Victim 2',
      });

      // Place all in same location, no closeness
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'core:position',
        { locationId: 'dark_alley' }
      );
      await testBed.mocks.entityManager.addComponent(
        target1.id,
        'core:position',
        { locationId: 'dark_alley' }
      );
      await testBed.mocks.entityManager.addComponent(
        target2.id,
        'core:position',
        { locationId: 'dark_alley' }
      );

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });

    it('discovers action even when actors are at opposite ends of location', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).toHaveAction(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does not discover when actor is not a vampire', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      // Actor has target in location but NOT vampirism:is_vampire
      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when vampire actor already has biting_neck component', async () => {
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: false,
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
        closeProximity: false,
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
        closeProximity: false,
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

    it('does not discover when no other actors in location', async () => {
      const actor = testBed.createActorWithValidation('lone_vampire', {
        name: 'Lone Vampire',
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'core:position',
        { locationId: 'empty_room' }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });

    it('does not discover when actors in different locations', async () => {
      const actor = testBed.createActorWithValidation('vampire1', {
        name: 'Vampire',
      });
      const target = testBed.createActorWithValidation('victim1', {
        name: 'Victim',
      });

      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'vampirism:is_vampire',
        {}
      );
      await testBed.mocks.entityManager.addComponent(
        actor.id,
        'core:position',
        { locationId: 'room_a' }
      );
      await testBed.mocks.entityManager.addComponent(
        target.id,
        'core:position',
        { locationId: 'room_b' }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);
      expect(result).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Discovery Diagnostics', () => {
    it('provides diagnostic information when discovery fails', async () => {
      const actor = testBed.createActorWithValidation('actor1', {
        name: 'Non-Vampire',
      });

      const { diagnostics } = await testBed.discoverActionsWithDiagnostics(
        actor,
        { includeDiagnostics: true }
      );

      expect(diagnostics).toBeDefined();
    });
  });
});
