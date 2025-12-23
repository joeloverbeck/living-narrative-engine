/**
 * @file Integration tests for first-aid:treat_wounded_part action definition and discovery.
 *
 * KEY DIFFERENCE FROM DISINFECT/RINSE: This action allows targeting covered wounds.
 * The penalty for treating covered wounds is handled via a -20 modifier in the
 * chance calculation, not by excluding them from the scope.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import treatAction from '../../../../data/mods/first-aid/actions/treat_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:treat_wounded_part';
const ROOM_ID = 'room1';

describe('first-aid:treat_wounded_part action definition', () => {
  let fixture;

  const registerScopes = async () => {
    ScopeResolverHelpers._registerResolvers(
      fixture.testEnv,
      fixture.testEnv.entityManager,
      {
        'core:actors_in_location': (context) => {
          const actorId =
            context.actor?.id || context.actorEntity?.id || context.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const actorPosition =
            fixture.testEnv.entityManager.getComponentData(
              actorId,
              'core:position'
            );
          const locationId = actorPosition?.locationId;
          if (!locationId) {
            return { success: true, value: new Set() };
          }

          const nearby = fixture.testEnv
            .entityManager.getEntityIds()
            .filter((id) => {
              if (id === actorId) {
                return false;
              }
              const pos = fixture.testEnv.entityManager.getComponentData(
                id,
                'core:position'
              );
              return (
                fixture.testEnv.entityManager.hasComponent(id, 'core:actor') &&
                pos?.locationId === locationId
              );
            });

          return { success: true, value: new Set(nearby) };
        },
        // KEY DIFFERENCE: This scope does NOT filter by clothing coverage
        // Unlike wounded_target_body_parts used by disinfect/rinse
        'first-aid:treatable_target_body_parts': (context) => {
          const targetId =
            context.target?.id ||
            context.primary?.id ||
            context.actor?.id ||
            context.actorEntity?.id ||
            context.id;
          if (!targetId) {
            return { success: true, value: new Set() };
          }

          const body = fixture.testEnv.entityManager.getComponentData(
            targetId,
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
            // DO NOT filter by coverage - key difference from disinfect/rinse
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
    noOtherActors = false,
  } = {}) => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const medicBuilder = new ModEntityBuilder('actor1')
      .withName('Medic')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor();

    if (hasMedicine) {
      medicBuilder.withComponent('skills:medicine_skill', { value: 40 });
    }

    if (actorFallen) {
      medicBuilder.withComponent('recovery-states:fallen', {});
    }

    if (actorBendingOver) {
      medicBuilder.withComponent('bending-states:bending_over', {});
    }

    const medic = medicBuilder.build();

    const entities = [room, medic];

    if (!noOtherActors) {
      const patientBuilder = new ModEntityBuilder('target1')
        .withName('Patient')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .withBody('patient-torso');

      if (coverWound) {
        patientBuilder
          .withComponent('clothing:equipment', {
            equipped: {
              torso_upper: {
                base: ['patient_torso_wrap'],
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

      const patient = patientBuilder.build();
      entities.push(patient);

      const torsoChildren = [];
      if (woundOnArm) torsoChildren.push('patient-left-arm');

      const torsoHealth =
        woundOnArm
          ? { currentHealth: 10, maxHealth: 10 }
          : { currentHealth: wounded ? 5 : 10, maxHealth: 10 };

      const patientTorso = new ModEntityBuilder('patient-torso')
        .asBodyPart({ parent: null, children: torsoChildren, subType: 'torso' })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:visibility_rules', {
          clothingSlotId: 'torso_upper',
          nonBlockingLayers: ['underwear', 'accessories'],
        })
        .withComponent('anatomy:part_health', torsoHealth)
        .build();
      entities.push(patientTorso);

      if (woundOnArm) {
        const patientLeftArm = new ModEntityBuilder('patient-left-arm')
          .withName('left arm')
          .asBodyPart({
            parent: 'patient-torso',
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
        entities.push(patientLeftArm);
      }

      if (coverWound) {
        entities.push(
          new ModEntityBuilder('patient_torso_wrap')
            .withName('Patient Torso Wrap')
            .build()
        );
      }
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
    expect(treatAction.id).toBe(ACTION_ID);
    expect(treatAction.name).toBe('Treat Wounded Part');
    expect(treatAction.template).toBe(
      "treat {target}'s wound in {woundedBodyPart} ({chance}% chance)"
    );
    expect(treatAction.generateCombinations).toBe(true);
    expect(treatAction.visual).toEqual({
      backgroundColor: '#1b5e20',
      textColor: '#e8f5e9',
      hoverBackgroundColor: '#2e7d32',
      hoverTextColor: '#ffffff',
    });
    // Key difference: this action has chanceBased configuration
    expect(treatAction.chanceBased).toBeDefined();
    expect(treatAction.chanceBased.enabled).toBe(true);
    expect(treatAction.chanceBased.contestType).toBe('fixed_difficulty');
    expect(treatAction.chanceBased.modifiers).toHaveLength(5);
  });

  it('uses the correct scopes and component gates', () => {
    expect(treatAction.targets.primary.scope).toBe('core:actors_in_location');
    expect(treatAction.targets.secondary.scope).toBe(
      'first-aid:treatable_target_body_parts'
    );
    expect(treatAction.targets.secondary.contextFrom).toBe('primary');
    // No tertiary target (unlike disinfect which has disinfectant)
    expect(treatAction.targets.tertiary).toBeUndefined();
    expect(treatAction.required_components.actor).toEqual(
      expect.arrayContaining(['skills:medicine_skill'])
    );
    // No items:inventory requirement (unlike disinfect)
    expect(treatAction.required_components.actor).not.toContain(
      'items:inventory'
    );
    expect(treatAction.forbidden_components.actor).toEqual(
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
    // No forbidden_components.secondary (unlike disinfect which forbids first-aid:disinfected)
    expect(treatAction.forbidden_components.secondary).toBeUndefined();
  });

  it('is discoverable when actor has medicine_skill and target has wounded parts', () => {
    loadScenario();
    const medicContext =
      fixture.testEnv.entityManager.getEntityInstance('actor1');
    const patientContext =
      fixture.testEnv.entityManager.getEntityInstance('target1');

    const nearbyTargets =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'core:actors_in_location',
        {
          actor: medicContext,
          actorEntity: medicContext,
        }
      ) || {};
    expect(Array.from(nearbyTargets.value || [])).toContain('target1');

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_target_body_parts',
        {
          actor: patientContext,
          actorEntity: patientContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('patient-torso');

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

  it('is hidden when target has no wounded body parts', () => {
    loadScenario({ wounded: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when no other actors are in location', () => {
    loadScenario({ noOtherActors: true });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  // KEY DIFFERENCE TEST: Covered wounds ARE targetable (unlike disinfect/rinse)
  it('is discoverable even when wounded body part is covered by clothing', () => {
    loadScenario({ woundOnArm: true, coverWound: true });
    const patientContext =
      fixture.testEnv.entityManager.getEntityInstance('target1');

    // Verify the scope returns the covered wounded part
    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_target_body_parts',
        {
          target: patientContext,
          actor: patientContext,
          actorEntity: patientContext,
          primary: patientContext,
        }
      ) || {};
    // Covered wound IS included (key difference from disinfect/rinse)
    expect(Array.from(woundedParts.value || [])).toContain('patient-left-arm');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    // Action should be discoverable even with covered wounds
    expect(matches).toHaveLength(1);
  });

  it('shows covered wounds in target list (unlike disinfect/rinse which hides them)', () => {
    // This test explicitly validates the key behavioral difference
    loadScenario({ coverWound: true, wounded: true });
    const patientContext =
      fixture.testEnv.entityManager.getEntityInstance('target1');

    // With treat action, covered torso wound IS targetable
    const treatableWoundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:treatable_target_body_parts',
        {
          target: patientContext,
          actor: patientContext,
          actorEntity: patientContext,
          primary: patientContext,
        }
      ) || {};

    // Covered torso wound should be in the list for treat action
    expect(Array.from(treatableWoundedParts.value || [])).toContain(
      'patient-torso'
    );

    // Action should be discoverable
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });
});
