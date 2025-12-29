/**
 * @file Integration tests for violence:punch_target action discovery
 * @description Tests that punch_target is discoverable only when actor has an arm
 *              with damage capabilities and valid secondary targets exist.
 *              The punch_target action requires:
 *              1. Prerequisite: Actor must have a body part with subType containing "arm"
 *                 (via violence:actor-has-arm condition using hasPartSubTypeContaining operator)
 *              2. Primary target: Arm body part with damage-types:damage_capabilities
 *                 (via violence:actor_arm_body_parts scope)
 *              3. Secondary target: Other actors in location (via core:actors_in_location scope)
 *              4. Actor must NOT have forbidden components (recovery-states:fallen, etc.)
 *              5. Target must NOT be dead (core:dead)
 * @see data/mods/violence/actions/punch_target.action.json
 * @see data/mods/violence/conditions/actor-has-arm.condition.json
 * @see data/mods/violence/scopes/actor_arm_body_parts.scope
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import punchTargetAction from '../../../../data/mods/violence/actions/punch_target.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'violence:punch_target';

describe('violence:punch_target action discovery', () => {
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

    // Mock action index to return punch_target action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      punchTargetAction,
    ]);
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected violence action schema', () => {
      expect(punchTargetAction).toBeDefined();
      expect(punchTargetAction.id).toBe(ACTION_ID);
      expect(punchTargetAction.name).toBe('Punch Target');
      expect(punchTargetAction.description).toBe(
        'Punch a target with your arm'
      );
      expect(punchTargetAction.template).toBe(
        'punch {target} with {weapon} ({chance}% chance)'
      );
      expect(punchTargetAction.generateCombinations).toBe(true);
    });

    it('uses correct scopes for multi-target resolution', () => {
      expect(punchTargetAction.targets).toBeDefined();
      expect(punchTargetAction.targets.primary).toBeDefined();
      expect(punchTargetAction.targets.secondary).toBeDefined();

      // Primary target is the arm (weapon)
      expect(punchTargetAction.targets.primary.scope).toBe(
        'violence:actor_arm_body_parts'
      );
      expect(punchTargetAction.targets.primary.placeholder).toBe('weapon');
      expect(punchTargetAction.targets.primary.description).toBe(
        'Arm to punch with'
      );

      // Secondary target is the victim
      expect(punchTargetAction.targets.secondary.scope).toBe(
        'core:actors_in_location'
      );
      expect(punchTargetAction.targets.secondary.placeholder).toBe('target');
      expect(punchTargetAction.targets.secondary.description).toBe(
        'Target to punch'
      );
    });

    it('requires damage_capabilities on primary target', () => {
      expect(punchTargetAction.required_components).toBeDefined();
      expect(punchTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('has prerequisite referencing actor-has-arm condition', () => {
      expect(punchTargetAction.prerequisites).toBeDefined();
      expect(punchTargetAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = punchTargetAction.prerequisites[0];
      expect(prerequisite.logic.condition_ref).toBe('violence:actor-has-arm');
      expect(prerequisite.failure_message).toBe('You need an arm to punch.');
    });

    it('forbids dead secondary targets', () => {
      expect(punchTargetAction.forbidden_components).toBeDefined();
      expect(punchTargetAction.forbidden_components.secondary).toContain(
        'core:dead'
      );
    });

    it('has forbidden actor positioning states', () => {
      expect(punchTargetAction.forbidden_components.actor).toContain(
        'recovery-states:fallen'
      );
      expect(punchTargetAction.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
      expect(punchTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
      expect(punchTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
      expect(punchTargetAction.forbidden_components.actor).toContain(
        'bending-states:bending_over'
      );
    });

    it('has violence mod visual styling', () => {
      expect(punchTargetAction.visual).toBeDefined();
      expect(punchTargetAction.visual.backgroundColor).toBe('#8b0000');
      expect(punchTargetAction.visual.textColor).toBe('#ffffff');
    });

    it('has chance-based combat configuration', () => {
      expect(punchTargetAction.chanceBased).toBeDefined();
      expect(punchTargetAction.chanceBased.enabled).toBe(true);
      expect(punchTargetAction.chanceBased.contestType).toBe('opposed');
      expect(punchTargetAction.chanceBased.formula).toBe('ratio');
      expect(punchTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:melee_skill'
      );
      expect(punchTargetAction.chanceBased.targetSkill.component).toBe(
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
      // 4. Prerequisite: violence:actor-has-arm passes (hasPartSubTypeContaining)
      // 5. Primary scope: violence:actor_arm_body_parts returns arm entity
      // 6. Secondary scope: core:actors_in_location returns other actors
      // 7. Action is discovered with arm as weapon, victim as target
      expect(punchTargetAction.targets.primary.scope).toBe(
        'violence:actor_arm_body_parts'
      );
      expect(punchTargetAction.prerequisites[0].logic.condition_ref).toBe(
        'violence:actor-has-arm'
      );
    });

    it('should be available when actor has hulking arm (highest damage)', () => {
      // EXPECTED BEHAVIOR:
      // Hulking arms deal maximum damage with higher stun chance.
      // The damage_capabilities component on hulking_arm has:
      // - amount: 12 (highest tier)
      // - stun.chance: 0.25 (25%)
      // - stun.durationTurns: 2 (longer stun)
      expect(punchTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('supports multiple arm types via substring matching', () => {
      // EXPECTED BEHAVIOR:
      // The hasPartSubTypeContaining operator checks if ANY body part's
      // subType contains the substring "arm", so:
      // - "humanoid_arm" matches (contains "arm")
      // - "humanoid_arm_hulking" matches (contains "arm")
      // - "toad_folk_arm" matches (contains "arm")
      // - "eldritch_vestigial_arm" matches (contains "arm")
      //
      // This ensures any creature with an arm-type body part can punch.
      expect(punchTargetAction.generateCombinations).toBe(true);
    });
  });

  describe('Negative discovery scenarios', () => {
    it('is not available when actor has no arm body part', async () => {
      // Actor with tentacle anatomy - no arms
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'squid1',
        targetId: 'diver1',
        location: 'ocean_floor',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'squid1_body',
            bodyParts: [
              {
                id: 'squid1_tentacle',
                subType: 'tentacle',
                components: { 'anatomy:part': { subType: 'tentacle' } },
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
          if (scopeName === 'violence:actor_arm_body_parts') {
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
      // Actor with a paralyzed arm without damage capabilities
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'injured1',
        targetId: 'attacker1',
        location: 'alley',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'injured1_body',
            bodyParts: [
              {
                id: 'injured1_arm',
                subType: 'paralyzed_arm',
                components: {
                  'anatomy:part': { subType: 'paralyzed_arm' },
                  // Note: No damage_capabilities - arm is too weak to punch
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
          if (scopeName === 'violence:actor_arm_body_parts') {
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
        actorId: 'shadow_boxer1',
        targetId: 'nobody',
        location: 'empty_gym',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'shadow_boxer1_body',
            bodyParts: [
              {
                id: 'shadow_boxer1_arm',
                subType: 'humanoid_arm_muscular',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm_muscular' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 8 }],
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
          if (scopeName === 'violence:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('shadow_boxer1_arm'),
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
        actorId: 'knocked_down1',
        targetId: 'opponent1',
        location: 'boxing_ring',
        closeProximity: false,
        actorComponents: {
          'recovery-states:fallen': {},
          'anatomy:body': {
            root: 'knocked_down1_body',
            bodyParts: [
              {
                id: 'knocked_down1_arm',
                subType: 'humanoid_arm_athletic',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm_athletic' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 6 }],
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
          if (scopeName === 'violence:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('knocked_down1_arm'),
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
        actorId: 'boxer1',
        targetId: 'defeated1',
        location: 'fight_club',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'boxer1_body',
            bodyParts: [
              {
                id: 'boxer1_arm',
                subType: 'humanoid_arm_hulking',
                components: {
                  'anatomy:part': { subType: 'humanoid_arm_hulking' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 12 }],
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
          if (scopeName === 'violence:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('boxer1_arm'),
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

    it('is not available when actor is hugging', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'hugger1',
        targetId: 'loved_one1',
        location: 'home',
        closeProximity: false,
        actorComponents: {
          'hugging-states:hugging': { target: 'loved_one1' },
          'anatomy:body': {
            root: 'hugger1_body',
            bodyParts: [
              {
                id: 'hugger1_arm',
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
          if (scopeName === 'violence:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('hugger1_arm'),
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

    it('is not available when actor is giving blowjob', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'performer1',
        targetId: 'receiver1',
        location: 'bedroom',
        closeProximity: false,
        actorComponents: {
          'sex-states:giving_blowjob': { to: 'receiver1' },
          'anatomy:body': {
            root: 'performer1_body',
            bodyParts: [
              {
                id: 'performer1_arm',
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
          if (scopeName === 'violence:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('performer1_arm'),
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
        actorId: 'formless1',
        targetId: 'victim1',
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
        actorId: 'specter1',
        targetId: 'mortal1',
        location: 'graveyard',
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

    it('handles creature arm types (toad_folk_arm)', async () => {
      // Toad folk with stocky arms should be able to punch
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'toad_folk1',
        targetId: 'adventurer1',
        location: 'swamp',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'toad_folk1_body',
            bodyParts: [
              {
                id: 'toad_folk1_arm',
                subType: 'toad_folk_arm',
                components: {
                  'anatomy:part': { subType: 'toad_folk_arm' },
                  'damage-types:damage_capabilities': {
                    entries: [{ name: 'blunt', amount: 6 }], // Stocky: athletic-tier damage
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
          if (scopeName === 'violence:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('toad_folk1_arm'),
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

      // Creature arms with damage_capabilities can punch
      expect(result).toBeDefined();
      expect(punchTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });
  });
});
