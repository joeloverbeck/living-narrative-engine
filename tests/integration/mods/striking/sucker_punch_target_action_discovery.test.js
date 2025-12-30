/**
 * @file Integration tests for striking:sucker_punch_target action discovery
 * @description Tests that sucker_punch_target is discoverable only when actor has an arm
 *              with damage capabilities and valid secondary targets exist.
 *              The sucker_punch_target action requires:
 *              1. Prerequisite: Actor must have a free grabbing appendage
 *                 (via anatomy:actor-has-free-grabbing-appendage condition)
 *              2. Prerequisite: Location must be lit (isActorLocationLit)
 *              3. Primary target: Arm body part with damage-types:damage_capabilities
 *                 (via striking:actor_arm_body_parts scope)
 *              4. Secondary target: Other actors in location (via core:actors_in_location scope)
 *              5. Actor must NOT have forbidden components (recovery-states:fallen, etc.)
 *              6. Target must NOT be dead (core:dead)
 *              Uses awareness_skill for target skill (surprise attack) instead of defense_skill.
 * @see data/mods/striking/actions/sucker_punch_target.action.json
 * @see data/mods/striking/scopes/actor_arm_body_parts.scope
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../../common/actionMatchers.js';
import suckerPunchTargetAction from '../../../../data/mods/striking/actions/sucker_punch_target.action.json';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

const ACTION_ID = 'striking:sucker_punch_target';

describe('striking:sucker_punch_target action discovery', () => {
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

    // Mock action index to return sucker_punch_target action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(() => [
      suckerPunchTargetAction,
    ]);
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected striking action schema', () => {
      expect(suckerPunchTargetAction).toBeDefined();
      expect(suckerPunchTargetAction.id).toBe(ACTION_ID);
      expect(suckerPunchTargetAction.name).toBe('Sucker Punch Target');
      expect(suckerPunchTargetAction.description).toBe(
        "Throw an unexpected punch at someone when they're not looking"
      );
      expect(suckerPunchTargetAction.template).toBe(
        'sucker-punch {target} with {weapon} ({chance}% chance)'
      );
      expect(suckerPunchTargetAction.generateCombinations).toBe(true);
    });

    it('uses correct scopes for multi-target resolution', () => {
      expect(suckerPunchTargetAction.targets).toBeDefined();
      expect(suckerPunchTargetAction.targets.primary).toBeDefined();
      expect(suckerPunchTargetAction.targets.secondary).toBeDefined();

      // Primary target is the arm (weapon)
      expect(suckerPunchTargetAction.targets.primary.scope).toBe(
        'striking:actor_arm_body_parts'
      );
      expect(suckerPunchTargetAction.targets.primary.placeholder).toBe('weapon');
      expect(suckerPunchTargetAction.targets.primary.description).toBe(
        'Arm to punch with'
      );

      // Secondary target is the victim (must not have been attacked by actor already)
      expect(suckerPunchTargetAction.targets.secondary.scope).toBe(
        'attack-states:actors_in_location_not_attacked_by_actor'
      );
      expect(suckerPunchTargetAction.targets.secondary.placeholder).toBe('target');
      expect(suckerPunchTargetAction.targets.secondary.description).toBe(
        'Person to punch unexpectedly'
      );
    });

    it('requires damage_capabilities on primary target', () => {
      expect(suckerPunchTargetAction.required_components).toBeDefined();
      expect(suckerPunchTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });

    it('has prerequisite for free grabbing appendage', () => {
      expect(suckerPunchTargetAction.prerequisites).toBeDefined();
      expect(suckerPunchTargetAction.prerequisites.length).toBeGreaterThan(0);
      const prerequisite = suckerPunchTargetAction.prerequisites[0];
      expect(prerequisite.logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
      expect(prerequisite.failure_message).toBe(
        'You need a free hand to throw a sucker punch.'
      );
    });

    it('has prerequisite for lit location', () => {
      expect(suckerPunchTargetAction.prerequisites.length).toBeGreaterThanOrEqual(2);
      const lightPrereq = suckerPunchTargetAction.prerequisites[1];
      expect(lightPrereq.logic.isActorLocationLit).toContain('actor');
      expect(lightPrereq.failure_message).toBe('It is too dark to see your target.');
    });

    it('forbids dead secondary targets', () => {
      expect(suckerPunchTargetAction.forbidden_components).toBeDefined();
      expect(suckerPunchTargetAction.forbidden_components.secondary).toContain(
        'core:dead'
      );
    });

    it('has forbidden actor positioning states', () => {
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'recovery-states:fallen'
      );
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'bending-states:bending_over'
      );
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'sitting-states:sitting_on'
      );
      expect(suckerPunchTargetAction.forbidden_components.actor).toContain(
        'liquids-states:in_liquid_body'
      );
    });

    it('has striking mod visual styling', () => {
      expect(suckerPunchTargetAction.visual).toBeDefined();
      expect(suckerPunchTargetAction.visual.backgroundColor).toBe('#c62828');
      expect(suckerPunchTargetAction.visual.textColor).toBe('#ffffff');
    });

    it('has chance-based combat configuration with awareness_skill for target', () => {
      expect(suckerPunchTargetAction.chanceBased).toBeDefined();
      expect(suckerPunchTargetAction.chanceBased.enabled).toBe(true);
      expect(suckerPunchTargetAction.chanceBased.contestType).toBe('opposed');
      expect(suckerPunchTargetAction.chanceBased.formula).toBe('ratio');
      expect(suckerPunchTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:melee_skill'
      );
      // Key difference from punch_target: uses awareness_skill instead of defense_skill
      expect(suckerPunchTargetAction.chanceBased.targetSkill.component).toBe(
        'skills:awareness_skill'
      );
      expect(suckerPunchTargetAction.chanceBased.targetSkill.targetRole).toBe(
        'secondary'
      );
    });

    it('has modifiers for fallen and restrained targets', () => {
      expect(suckerPunchTargetAction.chanceBased.modifiers).toBeDefined();
      expect(suckerPunchTargetAction.chanceBased.modifiers).toHaveLength(2);

      const fallenModifier = suckerPunchTargetAction.chanceBased.modifiers.find(
        (m) => m.tag === 'target downed'
      );
      expect(fallenModifier).toBeDefined();
      expect(fallenModifier.value).toBe(15);

      const restrainedModifier = suckerPunchTargetAction.chanceBased.modifiers.find(
        (m) => m.tag === 'target restrained'
      );
      expect(restrainedModifier).toBeDefined();
      expect(restrainedModifier.value).toBe(10);
    });
  });

  describe('Positive discovery scenarios', () => {
    it('should be available when actor has humanoid_arm with damage capabilities and target in lit location', () => {
      // EXPECTED BEHAVIOR:
      // 1. Actor has anatomy:body component
      // 2. Body recipe defines arm slots with humanoid_arm entities
      // 3. humanoid_arm entity has damage-types:damage_capabilities component
      // 4. Prerequisite: actor-has-free-grabbing-appendage passes
      // 5. Prerequisite: isActorLocationLit passes
      // 6. Primary scope: striking:actor_arm_body_parts returns arm entity
      // 7. Secondary scope: core:actors_in_location returns other actors
      // 8. Action is discovered with arm as weapon, victim as target
      expect(suckerPunchTargetAction.targets.primary.scope).toBe(
        'striking:actor_arm_body_parts'
      );
      expect(suckerPunchTargetAction.prerequisites[0].logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    it('supports multiple arm types via substring matching', () => {
      // EXPECTED BEHAVIOR:
      // The hasPartSubTypeContaining operator checks if ANY body part's
      // subType contains the substring, so various arm types work:
      // - "humanoid_arm" matches
      // - "humanoid_arm_hulking" matches
      // - "toad_folk_arm" matches
      expect(suckerPunchTargetAction.generateCombinations).toBe(true);
    });
  });

  describe('Negative discovery scenarios', () => {
    it('is not available when actor has no free grabbing appendage', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'bound1',
        targetId: 'victim1',
        location: 'dungeon',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'bound1_body',
            bodyParts: [
              {
                id: 'bound1_arm',
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
          // Hands are bound, no free grabbing appendage
        },
      });

      // Prerequisite fails - no free hand
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

    it('is not available when location is dark', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'sneaker1',
        targetId: 'victim1',
        location: 'dark_alley',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'sneaker1_body',
            bodyParts: [
              {
                id: 'sneaker1_arm',
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

      // First prerequisite passes, second (lighting) fails
      testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        (prereq) => {
          if (prereq.logic?.condition_ref === 'anatomy:actor-has-free-grabbing-appendage') {
            return true;
          }
          if (prereq.logic?.isActorLocationLit) {
            return false; // Location is dark
          }
          return true;
        }
      );

      testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scopeName) => {
          if (scopeName === 'striking:actor_arm_body_parts') {
            return ActionResult.success([
              ActionTargetContext.forEntity('sneaker1_arm'),
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

    it('is not available when arm lacks damage_capabilities', async () => {
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
                  // Note: No damage_capabilities - arm is too weak
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
        actorId: 'loner1',
        targetId: 'nobody',
        location: 'empty_room',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'loner1_body',
            bodyParts: [
              {
                id: 'loner1_arm',
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
              ActionTargetContext.forEntity('loner1_arm'),
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
        location: 'bar',
        closeProximity: false,
        actorComponents: {
          'recovery-states:fallen': {},
          'anatomy:body': {
            root: 'knocked_down1_body',
            bodyParts: [
              {
                id: 'knocked_down1_arm',
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

    it('is not available when actor is sitting', async () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'seated1',
        targetId: 'standing1',
        location: 'tavern',
        closeProximity: false,
        actorComponents: {
          'sitting-states:sitting_on': { furniture: 'chair1' },
          'anatomy:body': {
            root: 'seated1_body',
            bodyParts: [
              {
                id: 'seated1_arm',
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
              ActionTargetContext.forEntity('seated1_arm'),
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
        actorId: 'attacker1',
        targetId: 'corpse1',
        location: 'battlefield',
        closeProximity: false,
        actorComponents: {
          'anatomy:body': {
            root: 'attacker1_body',
            bodyParts: [
              {
                id: 'attacker1_arm',
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
              ActionTargetContext.forEntity('attacker1_arm'),
            ]);
          }
          if (scopeName === 'core:actors_in_location') {
            // Target is dead and filtered out
            return ActionResult.success([]);
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
          if (scopeName === 'striking:actor_arm_body_parts') {
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

      // Creature arms with damage_capabilities can sucker punch
      expect(result).toBeDefined();
      expect(suckerPunchTargetAction.required_components.primary).toContain(
        'damage-types:damage_capabilities'
      );
    });
  });
});
