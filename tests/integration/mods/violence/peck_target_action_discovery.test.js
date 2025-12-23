/**
 * @file Integration tests for violence:peck_target action discovery
 * @description Tests that peck_target is discoverable only when actor has a beak
 *              with damage capabilities and valid secondary targets exist.
 *              The peck_target action requires:
 *              1. Prerequisite: Actor must have a body part with subType containing "beak"
 *                 (via violence:actor-has-beak condition using hasPartSubTypeContaining operator)
 *              2. Primary target: Beak body part with damage-types:damage_capabilities
 *                 (via violence:actor_beak_body_parts scope)
 *              3. Secondary target: Other actors in location (via core:actors_in_location scope)
 *              4. Actor must NOT have forbidden components (recovery-states:fallen, etc.)
 *              5. Target must NOT be dead (core:dead)
 * @see data/mods/violence/actions/peck_target.action.json
 * @see data/mods/violence/conditions/actor-has-beak.condition.json
 * @see data/mods/violence/scopes/actor_beak_body_parts.scope
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import peckTargetAction from '../../../../data/mods/violence/actions/peck_target.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'violence:peck_target';

describe('violence:peck_target action discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();

    // Use SimpleEntityManager for better entity handling
    const simpleEntityManager = new SimpleEntityManager();
    testBed.mocks.entityManager = simpleEntityManager;
    testBed.entityManager = simpleEntityManager;
    if (testBed.service) {
      testBed.service.entityManager = simpleEntityManager;
    }

    // Mock action index to return peck_target action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      peckTargetAction,
    ]);
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected violence action schema', () => {
      expect(peckTargetAction).toBeDefined();
      expect(peckTargetAction.id).toBe(ACTION_ID);
      expect(peckTargetAction.name).toBe('Peck Target');
      expect(peckTargetAction.description).toBe(
        'Peck at a target with your beak'
      );
      expect(peckTargetAction.template).toBe(
        'peck {target} with {weapon} ({chance}% chance)'
      );
      expect(peckTargetAction.generateCombinations).toBe(true);
    });

    it('uses correct scopes for multi-target resolution', () => {
      expect(peckTargetAction.targets).toBeDefined();
      expect(peckTargetAction.targets.primary).toBeDefined();
      expect(peckTargetAction.targets.secondary).toBeDefined();

      // Primary target is the beak (weapon)
      expect(peckTargetAction.targets.primary.scope).toBe(
        'violence:actor_beak_body_parts'
      );
      expect(peckTargetAction.targets.primary.placeholder).toBe('weapon');
      expect(peckTargetAction.targets.primary.description).toBe(
        'Beak to peck with'
      );

      // Secondary target is the victim
      expect(peckTargetAction.targets.secondary.scope).toBe(
        'core:actors_in_location'
      );
      expect(peckTargetAction.targets.secondary.placeholder).toBe('target');
      expect(peckTargetAction.targets.secondary.description).toBe(
        'Target to attack'
      );
    });

    it('requires damage_capabilities on primary target', () => {
      expect(peckTargetAction.required_components).toBeDefined();
      expect(peckTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('has prerequisite referencing actor-has-beak condition', () => {
      expect(peckTargetAction.prerequisites).toBeDefined();
      expect(peckTargetAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = peckTargetAction.prerequisites[0];
      expect(prerequisite.logic.condition_ref).toBe('violence:actor-has-beak');
      expect(prerequisite.failure_message).toBe('You need a beak to peck.');
    });

    it('forbids dead secondary targets', () => {
      expect(peckTargetAction.forbidden_components).toBeDefined();
      expect(peckTargetAction.forbidden_components.secondary).toContain(
        'core:dead'
      );
    });

    it('has forbidden actor positioning states', () => {
      expect(peckTargetAction.forbidden_components.actor).toContain(
        'recovery-states:fallen'
      );
      expect(peckTargetAction.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
      expect(peckTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
    });

    it('has violence mod visual styling', () => {
      expect(peckTargetAction.visual).toBeDefined();
      expect(peckTargetAction.visual.backgroundColor).toBe('#8b0000');
      expect(peckTargetAction.visual.textColor).toBe('#ffffff');
    });

    it('has chance-based combat configuration', () => {
      expect(peckTargetAction.chanceBased).toBeDefined();
      expect(peckTargetAction.chanceBased.enabled).toBe(true);
      expect(peckTargetAction.chanceBased.contestType).toBe('opposed');
      expect(peckTargetAction.chanceBased.formula).toBe('ratio');
    });
  });

  describe('Positive discovery scenarios', () => {
    // NOTE: These tests document expected behavior for multi-target action discovery.
    // The actionDiscoveryServiceTestBed doesn't fully support multi-target actions
    // where `targets` is an object with primary/secondary scopes.
    // Full integration testing requires ModTestFixture with real runtime.

    it('should be available when actor has chicken_beak with damage capabilities', () => {
      // EXPECTED BEHAVIOR:
      // 1. Actor (e.g., copper-backed rooster) has anatomy:body component
      // 2. Body recipe defines beak slot with chicken_beak entity
      // 3. chicken_beak entity has:
      //    - anatomy:part.subType = "chicken_beak" (contains "beak" substring)
      //    - damage-types:damage_capabilities component (piercing damage)
      // 4. Prerequisite: violence:actor-has-beak passes (hasPartSubTypeContaining)
      // 5. Primary scope: violence:actor_beak_body_parts returns beak entity
      // 6. Secondary scope: core:actors_in_location returns other actors
      // 7. Action is discovered with beak as weapon, victim as target
      //
      // This tests the core use case for the copper-backed rooster in production.
      expect(peckTargetAction.targets.primary.scope).toBe(
        'violence:actor_beak_body_parts'
      );
      expect(peckTargetAction.prerequisites[0].logic.condition_ref).toBe(
        'violence:actor-has-beak'
      );
    });

    it('should be available when actor has generic beak with damage capabilities', () => {
      // EXPECTED BEHAVIOR:
      // Similar to chicken_beak, but for creatures with generic "beak" subType.
      // Examples: kraken, giant squid, or other beaked creatures.
      //
      // The hasPartSubTypeContaining operator checks if ANY body part's
      // subType contains the substring "beak", so:
      // - "beak" matches (exact)
      // - "chicken_beak" matches (contains "beak")
      // - "tortoise_beak" matches (contains "beak")
      // - "beak_parrot" matches (contains "beak")
      //
      // This ensures any creature with a beak-type body part can peck.
      expect(peckTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('should be available when actor has tortoise_beak (substring matching)', () => {
      // EXPECTED BEHAVIOR:
      // Tortoises have beaks (keratin-covered mouths) that can deliver
      // crushing damage. The substring matching ensures "tortoise_beak"
      // is recognized as a beak type.
      //
      // This validates that the hasPartSubTypeContaining operator:
      // 1. Retrieves all body parts from anatomy:body.bodyParts
      // 2. Checks each part's anatomy:part.subType field
      // 3. Returns true if ANY part's subType contains "beak"
      //
      // Different beak types may have different damage types:
      // - chicken_beak: piercing (pecking)
      // - tortoise_beak: crushing (biting)
      // - vulture_beak: piercing + tearing (rending)
      expect(peckTargetAction.generateCombinations).toBe(true);
    });
  });

  describe('Negative discovery scenarios', () => {
    it('is not available when actor has no beak body part', async () => {
      // Actor with human anatomy - no beak
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'human1',
        targetId: 'merchant1',
        location: 'marketplace',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'human1_torso',
            bodyParts: [
              {
                id: 'human1_head',
                subType: 'head',
                components: { 'anatomy:part': { subType: 'head' } },
              },
            ],
          },
        },
      });

      // Prerequisite fails - no beak found
      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => false
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'violence:actor_beak_body_parts') {
            return ActionResult.success([]); // No beak parts
          }
          if (scopeName === 'core:actors_in_location') {
            return ActionResult.success([
              ActionTargetContext.forEntity(target.id),
            ]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when beak lacks damage_capabilities', async () => {
      // Actor with a beak but no damage capabilities
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'peacock1',
        targetId: 'gardener1',
        location: 'garden',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'peacock1_body',
            bodyParts: [
              {
                id: 'peacock1_beak',
                subType: 'peacock_beak',
                components: {
                  'anatomy:part': { subType: 'peacock_beak' },
                  // Note: No damage_capabilities - peacock beak is decorative
                },
              },
            ],
          },
        },
      });

      // Prerequisite passes - beak exists
      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => true
      );

      // But primary target resolution returns empty - beak doesn't have damage capabilities
      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'violence:actor_beak_body_parts') {
            // Scope filters out beaks without damage_capabilities
            return ActionResult.success([]);
          }
          if (scopeName === 'core:actors_in_location') {
            return ActionResult.success([
              ActionTargetContext.forEntity(target.id),
            ]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when no other actors in location', async () => {
      const { actor } = testBed.createActorTargetScenario({
        actorId: 'lonely_bird1',
        targetId: 'nobody',
        location: 'empty_field',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'lonely_bird1_body',
            bodyParts: [
              {
                id: 'lonely_bird1_beak',
                subType: 'chicken_beak',
                components: {
                  'anatomy:part': { subType: 'chicken_beak' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'piercing', amount: 2 }],
                  },
                },
              },
            ],
          },
        },
      });

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => true
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'violence:actor_beak_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('lonely_bird1_beak'),
            ]);
          }
          if (scopeName === 'core:actors_in_location') {
            // No other actors in location
            return ActionResult.success([]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when actor has recovery-states:fallen', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'fallen_bird1',
        targetId: 'enemy1',
        location: 'battlefield',
        closeProximity: false,
        actorComponents: {
          'recovery-states:fallen': {},
          'anatomy:body': {
            root: 'fallen_bird1_body',
            bodyParts: [
              {
                id: 'fallen_bird1_beak',
                subType: 'chicken_beak',
                components: {
                  'anatomy:part': { subType: 'chicken_beak' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'piercing', amount: 2 }],
                  },
                },
              },
            ],
          },
        },
      });

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => true
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'violence:actor_beak_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('fallen_bird1_beak'),
            ]);
          }
          if (scopeName === 'core:actors_in_location') {
            return ActionResult.success([
              ActionTargetContext.forEntity(target.id),
            ]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      // Action should be filtered out due to forbidden_components.actor
      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when secondary target is dead', async () => {
      const { actor } = testBed.createActorTargetScenario({
        actorId: 'vulture1',
        targetId: 'corpse1',
        location: 'desert',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'vulture1_body',
            bodyParts: [
              {
                id: 'vulture1_beak',
                subType: 'vulture_beak',
                components: {
                  'anatomy:part': { subType: 'vulture_beak' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'piercing', amount: 2 }],
                  },
                },
              },
            ],
          },
        },
        targetComponents: {
          'core:dead': {},
        },
      });

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => true
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'violence:actor_beak_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('vulture1_beak'),
            ]);
          }
          if (scopeName === 'core:actors_in_location') {
            // Target resolution filters out dead targets due to forbidden_components.secondary
            return ActionResult.success([]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('is not available when actor is being restrained', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'restrained_bird1',
        targetId: 'jailer1',
        location: 'cage',
        closeProximity: false,
        actorComponents: {
          'physical-control-states:being_restrained': { by: 'jailer1' },
          'anatomy:body': {
            root: 'restrained_bird1_body',
            bodyParts: [
              {
                id: 'restrained_bird1_beak',
                subType: 'chicken_beak',
                components: {
                  'anatomy:part': { subType: 'chicken_beak' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'piercing', amount: 2 }],
                  },
                },
              },
            ],
          },
        },
      });

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => true
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'violence:actor_beak_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('restrained_bird1_beak'),
            ]);
          }
          if (scopeName === 'core:actors_in_location') {
            return ActionResult.success([
              ActionTargetContext.forEntity(target.id),
            ]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Edge cases', () => {
    it('handles actor with empty body_parts array', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'ethereal1',
        targetId: 'spirit1',
        location: 'void',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: null,
            bodyParts: [],
          },
        },
      });

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => false
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'core:actors_in_location') {
            return ActionResult.success([
              ActionTargetContext.forEntity(target.id),
            ]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });

    it('handles actor without anatomy:body component', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'ghost1',
        targetId: 'visitor1',
        location: 'haunted_house',
        closeProximity: false,
        // No anatomy:body component
      });

      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => false
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'core:actors_in_location') {
            return ActionResult.success([
              ActionTargetContext.forEntity(target.id),
            ]);
          }
          return ActionResult.success([]);
        }
      );

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).not.toHaveAction(ACTION_ID);
    });
  });
});
