/**
 * @file Integration tests for first-aid:treat_my_wounded_part action definition and discovery.
 *
 * KEY DIFFERENCE FROM treat_wounded_part: This is a self-treatment action.
 * - Single target (primary) - the actor's own wounded body part
 * - Uses treatable_actor_body_parts scope (not treatable_target_body_parts)
 * - Does NOT require another actor nearby
 *
 * KEY DIFFERENCE FROM DISINFECT/RINSE "MY" ACTIONS: This action allows targeting
 * covered wounds. The penalty for treating covered wounds is handled via a -20
 * modifier in the chance calculation, not by excluding them from the scope.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import treatMyAction from '../../../../data/mods/first-aid/actions/treat_my_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:treat_my_wounded_part';
const ROOM_ID = 'room1';

describe('first-aid:treat_my_wounded_part action definition', () => {
  let fixture;

  const registerScopes = async () => {
    ScopeResolverHelpers._registerResolvers(
      fixture.testEnv,
      fixture.testEnv.entityManager,
      {
        // KEY DIFFERENCE: This scope operates on the actor's own body parts
        // and does NOT filter by clothing coverage (allows covered wounds with penalty)
        'first-aid:treatable_actor_body_parts': (context) => {
          const actorId =
            context.actor?.id || context.actorEntity?.id || context.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const body = fixture.testEnv.entityManager.getComponentData(
            actorId,
            'anatomy:body'
          );
          const rootId = body?.body?.root;
          if (!rootId) {
            return { success: true, value: new Set() };
          }

          const result = new Set();
          const queue = [rootId];
          while (queue.length > 0) {
            const current = queue.shift();
            const partHealth = fixture.testEnv.entityManager.getComponentData(
              current,
              'anatomy:part_health'
            );
            const isVitalOrgan = fixture.testEnv.entityManager.hasComponent(
              current,
              'anatomy:vital_organ'
            );
            // Include wounded parts (currentHealth < maxHealth)
            // Exclude vital organs
            // DO NOT filter by coverage - key difference from disinfect/rinse "my" actions
            if (
              partHealth &&
              partHealth.currentHealth < partHealth.maxHealth &&
              !isVitalOrgan
            ) {
              result.add(current);
            }

            const part = fixture.testEnv.entityManager.getComponentData(
              current,
              'anatomy:part'
            );
            if (part?.children?.length) {
              queue.push(...part.children);
            }
          }

          return { success: true, value: result };
        },
      }
    );
  };

  const loadScenario = ({
    hasMedicine = true,
    wounded = true,
    woundOnArm = false,
    coverWound = false,
    actorFallen = false,
    actorBendingOver = false,
    actorHugging = false,
    actorRestraining = false,
    actorBeingRestrained = false,
    actorGivingBlowjob = false,
    actorDoingComplexPerformance = false,
  } = {}) => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const actorChildren = [];
    if (woundOnArm) actorChildren.push('actor-left-arm');

    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('Self-Medic')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withBody('actor-torso');

    if (hasMedicine) {
      actorBuilder.withComponent('skills:medicine_skill', { value: 40 });
    }

    if (actorFallen) {
      actorBuilder.withComponent('recovery-states:fallen', {});
    }

    if (actorBendingOver) {
      actorBuilder.withComponent('bending-states:bending_over', {});
    }

    if (actorHugging) {
      actorBuilder.withComponent('hugging-states:hugging', {});
    }

    if (actorRestraining) {
      actorBuilder.withComponent('physical-control-states:restraining', {});
    }

    if (actorBeingRestrained) {
      actorBuilder.withComponent('physical-control-states:being_restrained', {});
    }

    if (actorGivingBlowjob) {
      actorBuilder.withComponent('sex-states:giving_blowjob', {});
    }

    if (actorDoingComplexPerformance) {
      actorBuilder.withComponent('positioning:doing_complex_performance', {});
    }

    if (coverWound) {
      actorBuilder
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: {
              base: ['actor_torso_wrap'],
            },
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_shoulder'],
              allowedLayers: ['base', 'outer'],
            },
          },
        });
    }

    const actor = actorBuilder.build();

    const torsoChildren = [];
    if (woundOnArm) torsoChildren.push('actor-left-arm');

    const torsoHealth =
      woundOnArm
        ? { currentHealth: 10, maxHealth: 10 }
        : { currentHealth: wounded ? 5 : 10, maxHealth: 10 };

    const actorTorso = new ModEntityBuilder('actor-torso')
      .asBodyPart({ parent: null, children: torsoChildren, subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:visibility_rules', {
        clothingSlotId: 'torso_upper',
        nonBlockingLayers: ['underwear', 'accessories'],
      })
      .withComponent('anatomy:part_health', torsoHealth)
      .build();

    const entities = [room, actor, actorTorso];

    if (woundOnArm) {
      const actorLeftArm = new ModEntityBuilder('actor-left-arm')
        .withName('left arm')
        .asBodyPart({
          parent: 'actor-torso',
          children: [],
          subType: 'arm',
          socketId: 'left_shoulder',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:part_health', {
          currentHealth: wounded ? 5 : 10,
          maxHealth: 10,
        })
        .build();
      entities.push(actorLeftArm);
    }

    if (coverWound) {
      entities.push(
        new ModEntityBuilder('actor_torso_wrap')
          .withName('Actor Torso Wrap')
          .build()
      );
    }

    fixture.reset(entities);
  };

  beforeEach(async () => {
    fixture = new ModActionTestFixture(
      'first-aid',
      ACTION_ID,
      null,
      null,
      { autoRegisterScopes: false }
    );
    await fixture.initialize();
    await registerScopes();
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('has expected structure and visuals', () => {
    expect(treatMyAction.id).toBe(ACTION_ID);
    expect(treatMyAction.name).toBe('Treat My Wounded Part');
    expect(treatMyAction.template).toBe(
      'treat my wound in {woundedBodyPart} ({chance}% chance)'
    );
    expect(treatMyAction.generateCombinations).toBe(true);
    expect(treatMyAction.visual).toEqual({
      backgroundColor: '#1b5e20',
      textColor: '#e8f5e9',
      hoverBackgroundColor: '#2e7d32',
      hoverTextColor: '#ffffff',
    });
    // Key difference: this action has chanceBased configuration
    expect(treatMyAction.chanceBased).toBeDefined();
    expect(treatMyAction.chanceBased.enabled).toBe(true);
    expect(treatMyAction.chanceBased.contestType).toBe('fixed_difficulty');
    expect(treatMyAction.chanceBased.modifiers).toHaveLength(5);
  });

  it('uses the correct scopes and component gates', () => {
    // Single target - actor's own body part
    expect(treatMyAction.targets.primary.scope).toBe(
      'first-aid:treatable_actor_body_parts'
    );
    expect(treatMyAction.targets.primary.placeholder).toBe('woundedBodyPart');
    // No contextFrom - scope operates on actor directly
    expect(treatMyAction.targets.primary.contextFrom).toBeUndefined();
    // No secondary or tertiary target
    expect(treatMyAction.targets.secondary).toBeUndefined();
    expect(treatMyAction.targets.tertiary).toBeUndefined();

    // Required component
    expect(treatMyAction.required_components.actor).toEqual(
      expect.arrayContaining(['skills:medicine_skill'])
    );
    // No items:inventory requirement (unlike disinfect_my)
    expect(treatMyAction.required_components.actor).not.toContain(
      'items:inventory'
    );

    // Forbidden components on actor
    expect(treatMyAction.forbidden_components.actor).toEqual(
      expect.arrayContaining([
        'hugging-states:hugging',
        'sex-states:giving_blowjob',
        'positioning:doing_complex_performance',
        'bending-states:bending_over',
        'physical-control-states:being_restrained',
        'physical-control-states:restraining',
        'recovery-states:fallen',
      ])
    );
    // No forbidden_components.primary (unlike disinfect_my which forbids first-aid:disinfected)
    expect(treatMyAction.forbidden_components.primary).toBeUndefined();
  });

  it('is discoverable when actor has medicine_skill and has wounded parts', () => {
    loadScenario();
    const actorContext =
      fixture.testEnv.entityManager.getEntityInstance('actor1');

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('actor-torso');

    const candidates = fixture.testEnv.actionIndex.getCandidateActions({
      id: 'actor1',
    });
    expect(candidates.map((action) => action.id)).toContain(ACTION_ID);
    expect(fixture.testEnv.validateAction('actor1', ACTION_ID)).toBe(true);
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is hidden without medicine_skill', () => {
    loadScenario({ hasMedicine: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has no wounded body parts', () => {
    loadScenario({ wounded: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has recovery-states:fallen', () => {
    loadScenario({ actorFallen: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has bending-states:bending_over', () => {
    loadScenario({ actorBendingOver: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has hugging-states:hugging', () => {
    loadScenario({ actorHugging: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has physical-control-states:restraining', () => {
    loadScenario({ actorRestraining: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has physical-control-states:being_restrained', () => {
    loadScenario({ actorBeingRestrained: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has sex-states:giving_blowjob', () => {
    loadScenario({ actorGivingBlowjob: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when actor has positioning:doing_complex_performance', () => {
    loadScenario({ actorDoingComplexPerformance: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  // KEY DIFFERENCE TEST: Covered wounds ARE targetable (unlike disinfect_my/rinse_my)
  it('is discoverable even when wounded body part is covered by clothing', () => {
    loadScenario({ woundOnArm: true, coverWound: true });
    const actorContext =
      fixture.testEnv.entityManager.getEntityInstance('actor1');

    // Verify the scope returns the covered wounded part
    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    // Covered wound IS included (key difference from disinfect_my/rinse_my)
    expect(Array.from(woundedParts.value || [])).toContain('actor-left-arm');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    // Action should be discoverable even with covered wounds
    expect(matches).toHaveLength(1);
  });

  it('shows covered wounds in target list (unlike disinfect_my/rinse_my which hides them)', () => {
    // This test explicitly validates the key behavioral difference
    loadScenario({ coverWound: true, wounded: true });
    const actorContext =
      fixture.testEnv.entityManager.getEntityInstance('actor1');

    // With treat_my action, covered torso wound IS targetable
    const treatableWoundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};

    // Covered torso wound should be in the list for treat_my action
    expect(Array.from(treatableWoundedParts.value || [])).toContain(
      'actor-torso'
    );

    // Action should be discoverable
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('modifiers reference primary target (not secondary like treat_wounded_part)', () => {
    // Verify modifiers use targetRole: "primary" since this action only has a primary target
    const modifiers = treatMyAction.chanceBased.modifiers;
    modifiers.forEach((modifier) => {
      expect(modifier.targetRole).toBe('primary');
    });
  });
});
