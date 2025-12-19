/**
 * @file Integration tests for first-aid:disinfect_my_wounded_part action definition and discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import disinfectAction from '../../../../data/mods/first-aid/actions/disinfect_my_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:disinfect_my_wounded_part';
const ROOM_ID = 'room1';

describe('first-aid:disinfect_my_wounded_part action definition', () => {
  let fixture;

  const registerScopes = async () => {
    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv,
      'first-aid',
      'wounded_actor_body_parts'
    );
    await ScopeResolverHelpers.registerCustomScope(
      fixture.testEnv,
      'items',
      'disinfectant_liquids_in_inventory',
      { loadConditions: false }
    );
  };

  const buildLiquidContainer = (overrides = {}) => ({
    currentVolumeMilliliters: 25,
    maxCapacityMilliliters: 100,
    servingSizeMilliliters: 5,
    isRefillable: true,
    flavorText: 'A sharp-smelling antiseptic.',
    tags: ['disinfectant'],
    ...overrides,
  });

  const loadScenario = ({
    hasMedicine = true,
    hasDisinfectant = true,
    wounded = true,
    disinfectantVolume = 25,
    alreadyDisinfected = false,
    woundOnArm = false,
    coverWound = false,
    woundOnAss = false,
  } = {}) => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const disinfectantId = 'items:antiseptic_bottle';
    const disinfectant = new ModEntityBuilder(disinfectantId)
      .withName('Antiseptic Bottle')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent(
        'containers-core:liquid_container',
        buildLiquidContainer(
          hasDisinfectant
            ? { currentVolumeMilliliters: disinfectantVolume }
            : { tags: ['saline'], currentVolumeMilliliters: disinfectantVolume }
        )
      )
      .build();

    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('Medic')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withBody('actor-torso')
      .withComponent('items:inventory', {
        items: hasDisinfectant ? [disinfectantId] : [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });

    if (hasMedicine) {
      actorBuilder.withComponent('skills:medicine_skill', { value: 40 });
    }

    if (coverWound) {
      actorBuilder
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: {
              base: ['torso_wrap'],
            },
            ...(woundOnAss && {
              legs: {
                base: ['black_breeches'],
              },
            }),
          },
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_shoulder'],
              allowedLayers: ['base', 'outer'],
            },
            ...(woundOnAss && {
              torso_lower: {
                coveredSockets: ['left_ass'],
                allowedLayers: ['base', 'outer'],
              },
            }),
          },
        });
    }

    const actor = actorBuilder.build();

    const torsoChildren = [];
    if (woundOnArm) torsoChildren.push('actor-left-arm');
    if (woundOnAss) torsoChildren.push('actor-left-ass');

    const torsoHealth =
      woundOnArm || woundOnAss
        ? { currentHealth: 10, maxHealth: 10 }
        : { currentHealth: wounded ? 5 : 10, maxHealth: 10 };

    const actorTorsoBuilder = new ModEntityBuilder('actor-torso')
      .withName('torso')
      .asBodyPart({ parent: null, children: torsoChildren, subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:visibility_rules', {
        clothingSlotId: 'torso_upper',
        nonBlockingLayers: ['underwear', 'accessories'],
      })
      .withComponent('anatomy:part_health', torsoHealth);

    if (alreadyDisinfected && !woundOnArm) {
      actorTorsoBuilder.withComponent('first-aid:disinfected', {
        appliedById: 'actor1',
        sourceItemId: disinfectantId,
      });
    }

    const actorTorso = actorTorsoBuilder.build();

    const entities = [room, actor, actorTorso, disinfectant];

    if (woundOnArm) {
      const actorLeftArmBuilder = new ModEntityBuilder('actor-left-arm')
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
        });

      if (alreadyDisinfected) {
        actorLeftArmBuilder.withComponent('first-aid:disinfected', {
          appliedById: 'actor1',
          sourceItemId: disinfectantId,
        });
      }

      entities.push(actorLeftArmBuilder.build());
    }

    if (woundOnAss) {
      const leftAssBuilder = new ModEntityBuilder('actor-left-ass')
        .withName('left ass cheek')
        .asBodyPart({
          parent: 'actor-torso',
          children: [],
          subType: 'ass_cheek',
          socketId: 'left_ass',
        })
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .withComponent('anatomy:part_health', {
          currentHealth: wounded ? 5 : 10,
          maxHealth: 10,
        })
        .withComponent('anatomy:visibility_rules', {
          clothingSlotId: 'torso_lower',
          nonBlockingLayers: ['underwear', 'accessories'],
        });
      entities.push(leftAssBuilder.build());
    }

    if (woundOnAss) {
      entities.push(
        new ModEntityBuilder('black_breeches')
          .withName('Black Breeches')
          .withComponent('clothing:coverage_mapping', {
            covers: ['torso_lower'],
            coveragePriority: 'base',
          })
          .withComponent('clothing:wearable', {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
            allowedLayers: ['base', 'outer'],
          })
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .build()
      );
    }

    if (coverWound) {
      entities.push(new ModEntityBuilder('torso_wrap').withName('Torso Wrap').build());
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
    expect(disinfectAction.id).toBe(ACTION_ID);
    expect(disinfectAction.name).toBe('Disinfect My Wounded Part');
    expect(disinfectAction.template).toBe(
      'disinfect my {woundedBodyPart} with {disinfectant}'
    );
    expect(disinfectAction.generateCombinations).toBe(true);
    expect(disinfectAction.visual).toEqual({
      backgroundColor: '#1b5e20',
      textColor: '#e8f5e9',
      hoverBackgroundColor: '#2e7d32',
      hoverTextColor: '#ffffff',
    });
    expect(disinfectAction.chanceBased).toBeUndefined();
  });

  it('uses the correct scopes and component gates', () => {
    expect(disinfectAction.targets.primary.scope).toBe(
      'first-aid:wounded_actor_body_parts'
    );
    expect(disinfectAction.targets.secondary.scope).toBe(
      'items:disinfectant_liquids_in_inventory'
    );
    expect(disinfectAction.required_components.actor).toEqual(
      expect.arrayContaining(['skills:medicine_skill', 'items:inventory'])
    );
    expect(disinfectAction.forbidden_components.actor).toEqual(
      expect.arrayContaining([
        'positioning:hugging',
        'sex-states:giving_blowjob',
        'positioning:doing_complex_performance',
        'bending-states:bending_over',
        'positioning:being_restrained',
        'positioning:restraining',
        'positioning:fallen',
      ])
    );
    expect(disinfectAction.forbidden_components.primary).toEqual(
      expect.arrayContaining(['first-aid:disinfected'])
    );
    expect(disinfectAction.forbidden_components.secondary).toBeUndefined();
  });

  it('is discoverable when the actor has skill, disinfectant, and a wounded part', () => {
    loadScenario();
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('actor-torso');

    const disinfectants =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:disinfectant_liquids_in_inventory',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(disinfectants.value || [])).toContain(
      'items:antiseptic_bottle'
    );

    const candidates = fixture.testEnv.actionIndex.getCandidateActions({
      id: 'actor1',
    });
    expect(candidates.map((action) => action.id)).toContain(ACTION_ID);
    expect(fixture.testEnv.validateAction('actor1', ACTION_ID)).toBe(true);
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is hidden without medicine skill', () => {
    loadScenario({ hasMedicine: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when no disinfectant liquid is available', () => {
    loadScenario({ hasDisinfectant: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when the actor has no wounded body parts', () => {
    loadScenario({ wounded: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when the only wounded body part is covered by clothing', () => {
    loadScenario({ woundOnArm: true, coverWound: true });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toHaveLength(0);

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when a wounded torso is covered by clothing', () => {
    loadScenario({ woundOnArm: false, coverWound: true });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toHaveLength(0);

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when a wounded ass cheek is covered via secondary coverage mapping', () => {
    loadScenario({ woundOnAss: true, coverWound: true });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toHaveLength(0);

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('allows disinfection when the wounded ass cheek is uncovered after removing secondary coverage clothing', () => {
    loadScenario({ woundOnAss: true, coverWound: false });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('actor-left-ass');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is hidden when the wounded body part is already disinfected', () => {
    loadScenario({ alreadyDisinfected: true });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('actor-torso');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });
});
