/**
 * @file Integration tests for first-aid:disinfect_wounded_part action definition and discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import disinfectAction from '../../../../data/mods/first-aid/actions/disinfect_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:disinfect_wounded_part';
const ROOM_ID = 'room1';

describe('first-aid:disinfect_wounded_part action definition', () => {
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
        'first-aid:wounded_actor_body_parts': (context) => {
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
            if (
              partHealth &&
              partHealth.currentHealth < partHealth.maxHealth
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
        'items:disinfectant_liquids_in_inventory': (context) => {
          const actorId =
            context.actor?.id || context.actorEntity?.id || context.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const inventory = fixture.testEnv.entityManager.getComponentData(
            actorId,
            'items:inventory'
          );
          const itemIds = inventory?.items || [];

          const matches = itemIds.filter((itemId) => {
            const container = fixture.testEnv.entityManager.getComponentData(
              itemId,
              'items:liquid_container'
            );
            if (!container) {
              return false;
            }

            const tags = container.tags || [];
            return (
              Array.isArray(tags) &&
              tags.includes('disinfectant') &&
              container.currentVolumeMilliliters > 0
            );
          });

          return { success: true, value: new Set(matches) };
        },
      }
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
        'items:liquid_container',
        buildLiquidContainer(
          hasDisinfectant
            ? { currentVolumeMilliliters: disinfectantVolume }
            : { tags: ['saline'], currentVolumeMilliliters: 25 }
        )
      )
      .build();

    const medicBuilder = new ModEntityBuilder('actor1')
      .withName('Medic')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withComponent('items:inventory', {
        items: ['items:antiseptic_bottle'],
        capacity: { maxWeight: 50, maxItems: 10 },
      });

    if (hasMedicine) {
      medicBuilder.withComponent('skills:medicine_skill', { value: 40 });
    }

    const medic = medicBuilder.build();

    const patient = new ModEntityBuilder('target1')
      .withName('Patient')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withBody('patient-torso')
      .build();

    const patientTorso = new ModEntityBuilder('patient-torso')
      .asBodyPart({ parent: null, children: [], subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:part_health', {
        currentHealth: wounded ? 5 : 10,
        maxHealth: 10,
      })
      .build();

    fixture.reset([room, medic, patient, patientTorso, disinfectant]);
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
    expect(disinfectAction.name).toBe('Disinfect Wounded Part');
    expect(disinfectAction.template).toBe(
      "disinfect {target}'s {woundedBodyPart} with {disinfectant}"
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
      'core:actors_in_location'
    );
    expect(disinfectAction.targets.secondary.scope).toBe(
      'first-aid:wounded_actor_body_parts'
    );
    expect(disinfectAction.targets.secondary.contextFrom).toBe('primary');
    expect(disinfectAction.targets.tertiary.scope).toBe(
      'items:disinfectant_liquids_in_inventory'
    );
    expect(disinfectAction.required_components.actor).toEqual(
      expect.arrayContaining(['skills:medicine_skill', 'items:inventory'])
    );
    expect(disinfectAction.forbidden_components.actor).toEqual(
      expect.arrayContaining([
        'positioning:hugging',
        'positioning:giving_blowjob',
        'positioning:doing_complex_performance',
        'positioning:bending_over',
        'positioning:being_restrained',
        'positioning:restraining',
        'positioning:fallen',
      ])
    );
    expect(disinfectAction.forbidden_components.secondary).toEqual(
      expect.arrayContaining(['core:dead'])
    );
  });

  it('is discoverable when the medic has skill, disinfectant, and a wounded target', () => {
    loadScenario();
    const medicContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );
    const patientContext = fixture.testEnv.entityManager.getEntityInstance(
      'target1'
    );

    const nearbyTargets =
      fixture.testEnv.unifiedScopeResolver.resolveSync('core:actors_in_location', {
        actor: medicContext,
        actorEntity: medicContext,
      }) || {};
    expect(Array.from(nearbyTargets.value || [])).toContain('target1');

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_actor_body_parts',
        {
          actor: patientContext,
          actorEntity: patientContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('patient-torso');

    const disinfectants =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:disinfectant_liquids_in_inventory',
        {
          actor: medicContext,
          actorEntity: medicContext,
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

  it('is hidden when the disinfectant container is empty', () => {
    loadScenario({ disinfectantVolume: 0 });
    const medicContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const disinfectants =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:disinfectant_liquids_in_inventory',
        { actor: medicContext, actorEntity: medicContext }
      ) || {};
    expect(Array.from(disinfectants.value || [])).not.toContain(
      'items:antiseptic_bottle'
    );

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when the target has no wounded body parts', () => {
    loadScenario({ wounded: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });
});
