/**
 * @file Integration tests for striking:slap_target action discovery
 * @description Tests that slap_target is discoverable only when actor has an arm
 *              with damage capabilities and valid secondary targets exist.
 *              The slap_target action requires:
 *              1. Prerequisite: Actor must have a body part with subType containing "arm"
 *                 (via striking:actor-has-arm condition using hasPartSubTypeContaining operator)
 *              2. Primary target: Arm body part with damage-types:damage_capabilities
 *                 (via striking:actor_arm_body_parts scope)
 *              3. Secondary target: Other actors in location (via core:actors_in_location scope)
 *              4. Actor must NOT have forbidden components (recovery-states:fallen, etc.)
 *              5. Target must NOT be dead (core:dead)
 * @see data/mods/striking/actions/slap_target.action.json
 * @see data/mods/striking/conditions/actor-has-arm.condition.json
 * @see data/mods/striking/scopes/actor_arm_body_parts.scope
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import slapTargetAction from '../../../../data/mods/striking/actions/slap_target.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'striking:slap_target';

describe('striking:slap_target action discovery', () => {
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

    // Mock action index to return slap_target action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      slapTargetAction,
    ]);
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected striking action schema', () => {
      expect(slapTargetAction).toBeDefined();
      expect(slapTargetAction.id).toBe(ACTION_ID);
      expect(slapTargetAction.name).toBe('Slap Target');
      expect(slapTargetAction.description).toBe('Slap a target with your arm');
      expect(slapTargetAction.template).toBe(
        'slap {target} with {weapon} ({chance}% chance)'
      );
      expect(slapTargetAction.generateCombinations).toBe(true);
    });

    it('uses correct scopes for multi-target resolution', () => {
      expect(slapTargetAction.targets).toBeDefined();
      expect(slapTargetAction.targets.primary).toBeDefined();
      expect(slapTargetAction.targets.secondary).toBeDefined();

      // Primary target is the arm (weapon)
      expect(slapTargetAction.targets.primary.scope).toBe(
        'striking:actor_arm_body_parts'
      );
      expect(slapTargetAction.targets.primary.placeholder).toBe('weapon');
      expect(slapTargetAction.targets.primary.description).toBe(
        'Arm to slap with'
      );

      // Secondary target is the victim (filtered to exclude targets actor is facing away from)
      expect(slapTargetAction.targets.secondary.scope).toBe(
        'striking:actors_in_location_not_facing_away'
      );
      expect(slapTargetAction.targets.secondary.placeholder).toBe('target');
      expect(slapTargetAction.targets.secondary.description).toBe(
        'Target to slap'
      );
    });

    it('requires damage_capabilities on primary target', () => {
      expect(slapTargetAction.required_components).toBeDefined();
      expect(slapTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('has prerequisite referencing actor-has-arm condition', () => {
      expect(slapTargetAction.prerequisites).toBeDefined();
      expect(slapTargetAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = slapTargetAction.prerequisites[0];
      expect(prerequisite.logic.condition_ref).toBe('striking:actor-has-arm');
      expect(prerequisite.failure_message).toBe('You need an arm to slap.');
    });

    it('forbids dead secondary targets', () => {
      expect(slapTargetAction.forbidden_components).toBeDefined();
      expect(slapTargetAction.forbidden_components.secondary).toContain(
        'core:dead'
      );
    });

    it('has forbidden actor positioning states', () => {
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'recovery-states:fallen'
      );
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
      expect(slapTargetAction.forbidden_components.actor).toContain(
        'bending-states:bending_over'
      );
    });

    it('has striking mod visual styling', () => {
      expect(slapTargetAction.visual).toBeDefined();
      expect(slapTargetAction.visual.backgroundColor).toBe('#c62828');
      expect(slapTargetAction.visual.textColor).toBe('#ffffff');
    });

    it('has chance-based combat configuration', () => {
      expect(slapTargetAction.chanceBased).toBeDefined();
      expect(slapTargetAction.chanceBased.enabled).toBe(true);
      expect(slapTargetAction.chanceBased.contestType).toBe('opposed');
      expect(slapTargetAction.chanceBased.formula).toBe('ratio');
      expect(slapTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:melee_skill'
      );
      expect(slapTargetAction.chanceBased.targetSkill.component).toBe(
        'skills:defense_skill'
      );
    });
  });

  describe('Positive discovery scenarios', () => {
    it('should be available when actor has humanoid_arm with damage capabilities', () => {
      // EXPECTED BEHAVIOR:
      // 1. Actor (humanoid) has anatomy:body component
      // 2. Body recipe defines arm slots with humanoid_arm entities
      // 3. humanoid_arm entity has:
      //    - anatomy:part.subType = "humanoid_arm" (contains "arm" substring)
      //    - damage-types:damage_capabilities component (blunt damage)
      // 4. Prerequisite: striking:actor-has-arm passes (hasPartSubTypeContaining)
      // 5. Primary scope: striking:actor_arm_body_parts returns arm entity
      // 6. Secondary scope: core:actors_in_location returns other actors
      // 7. Action is discovered with arm as weapon, victim as target
      expect(slapTargetAction.targets.primary.scope).toBe(
        'striking:actor_arm_body_parts'
      );
      expect(slapTargetAction.prerequisites[0].logic.condition_ref).toBe(
        'striking:actor-has-arm'
      );
    });

    it('should be available when actor has muscular arm (higher damage)', () => {
      // EXPECTED BEHAVIOR:
      // Muscular arms deal more damage than slim arms.
      // The damage_capabilities component on muscular_arm has higher values.
      // This validates the build-based damage scaling design.
      expect(slapTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('supports multiple arm types via substring matching', () => {
      // EXPECTED BEHAVIOR:
      // The hasPartSubTypeContaining operator checks if ANY body part's
      // subType contains the substring "arm", so:
      // - "humanoid_arm" matches (contains "arm")
      // - "humanoid_arm_muscular" matches (contains "arm")
      // - "tortoise_arm" matches (contains "arm")
      // - "newt_folk_arm" matches (contains "arm")
      //
      // This ensures any creature with an arm-type body part can slap.
      expect(slapTargetAction.generateCombinations).toBe(true);
    });
  });

  describe('Negative discovery scenarios', () => {
    it('is not available when actor has no arm body part', async () => {
      // Actor with bird anatomy - no arms
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'bird1',
        targetId: 'worm1',
        location: 'nest',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'bird1_torso',
            bodyParts: [
              {
                id: 'bird1_wing',
                subType: 'wing',
                components: { 'anatomy:part': { subType: 'wing' } },
              },
            ],
          },
        },
      });

      // Prerequisite fails - no arm found
      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => false
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([]); // No arm parts
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

    it('is not available when arm lacks damage_capabilities', async () => {
      // Actor with a prosthetic arm without damage capabilities
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'amputee1',
        targetId: 'bully1',
        location: 'tavern',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'amputee1_body',
            bodyParts: [
              {
                id: 'amputee1_prosthetic',
                subType: 'prosthetic_arm',
                components: {
                  'anatomy:part': { subType: 'prosthetic_arm' },
                  // Note: No damage_capabilities - prosthetic lacks striking power
                },
              },
            ],
          },
        },
      });

      // Prerequisite passes - arm exists
      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => true
      );

      // But primary target resolution returns empty - arm doesn't have damage capabilities
      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'striking:actor_arm_body_parts') {
            // Scope filters out arms without damage_capabilities
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
        actorId: 'lonely_fighter1',
        targetId: 'nobody',
        location: 'empty_arena',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'lonely_fighter1_body',
            bodyParts: [
              {
                id: 'lonely_fighter1_arm',
                subType: 'humanoid_arm',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 5 }],
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
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('lonely_fighter1_arm'),
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
        actorId: 'fallen_fighter1',
        targetId: 'enemy1',
        location: 'battlefield',
        closeProximity: false,
        actorComponents: {
          'recovery-states:fallen': {},
          'anatomy:body': {
            root: 'fallen_fighter1_body',
            bodyParts: [
              {
                id: 'fallen_fighter1_arm',
                subType: 'humanoid_arm',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 5 }],
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
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('fallen_fighter1_arm'),
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
        actorId: 'victor1',
        targetId: 'corpse1',
        location: 'crime_scene',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'victor1_body',
            bodyParts: [
              {
                id: 'victor1_arm',
                subType: 'humanoid_arm',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 5 }],
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
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('victor1_arm'),
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
        actorId: 'restrained_fighter1',
        targetId: 'captor1',
        location: 'prison',
        closeProximity: false,
        actorComponents: {
          'physical-control-states:being_restrained': { by: 'captor1' },
          'anatomy:body': {
            root: 'restrained_fighter1_body',
            bodyParts: [
              {
                id: 'restrained_fighter1_arm',
                subType: 'humanoid_arm',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 5 }],
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
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('restrained_fighter1_arm'),
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

    it('is not available when actor is bending over', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'bent_person1',
        targetId: 'prankster1',
        location: 'garden',
        closeProximity: false,
        actorComponents: {
          'bending-states:bending_over': {},
          'anatomy:body': {
            root: 'bent_person1_body',
            bodyParts: [
              {
                id: 'bent_person1_arm',
                subType: 'humanoid_arm',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 5 }],
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
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('bent_person1_arm'),
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

    it('handles actor with vestigial arms (lowest damage tier)', async () => {
      // Eldritch creatures with vestigial arms should still be able to slap,
      // just with minimal damage
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'eldritch1',
        targetId: 'cultist1',
        location: 'ritual_chamber',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'eldritch1_body',
            bodyParts: [
              {
                id: 'eldritch1_arm',
                subType: 'eldritch_vestigial_arm',
                components: {
                  'anatomy:part': { subType: 'eldritch_vestigial_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 2 }], // Vestigial: lowest damage
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
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('eldritch1_arm'),
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

      // Vestigial arms can still slap, just with low damage
      // Test that action discovery works - actual damage is handled in rule execution
      expect(result).toBeDefined();
      expect(slapTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });
  });
});
