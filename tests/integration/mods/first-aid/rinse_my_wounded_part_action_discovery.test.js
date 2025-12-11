/**
 * @file Integration tests for first-aid:rinse_my_wounded_part action definition and discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import rinseAction from '../../../../data/mods/first-aid/actions/rinse_my_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:rinse_my_wounded_part';
const ROOM_ID = 'room1';

describe('first-aid:rinse_my_wounded_part action definition', () => {
  let fixture;

  const registerScopes = async () => {
    ScopeResolverHelpers._registerResolvers(
      fixture.testEnv,
      fixture.testEnv.entityManager,
      {
        'first-aid:wounded_actor_body_parts': (context) => {
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

          const coverageContext = { actor: { id: actorId } };
          const isCovered = (socketId) =>
            socketId &&
            fixture.testEnv.jsonLogic.evaluate(
              { isSocketCovered: ['actor', socketId] },
              coverageContext
            );
          const equipment = fixture.testEnv.entityManager.getComponentData(
            actorId,
            'clothing:equipment'
          );
          const hasCoveringInSlot = (slotId) => {
            if (!slotId) return false;
            const slot = equipment?.equipped?.[slotId];
            if (!slot || typeof slot !== 'object') return false;
            const layers = ['underwear', 'base', 'outer', 'armor'];
            return layers.some((layer) => {
              const items = slot[layer];
              return Array.isArray(items)
                ? items.length > 0
                : Boolean(items);
            });
          };

          const result = new Set();
          const queue = [rootId];
          while (queue.length > 0) {
            const current = queue.shift();
            const partHealth = fixture.testEnv.entityManager.getComponentData(
              current,
              'anatomy:part_health'
            );
            const joint = fixture.testEnv.entityManager.getComponentData(
              current,
              'anatomy:joint'
            );
            const socketId = joint?.socketId;
            const visibilityRules = fixture.testEnv.entityManager.getComponentData(
              current,
              'anatomy:visibility_rules'
            );
            const clothingSlotId = visibilityRules?.clothingSlotId;
            if (
              partHealth &&
              partHealth.currentHealth < partHealth.maxHealth &&
              !hasCoveringInSlot(clothingSlotId) &&
              !isCovered(socketId)
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
        'first-aid:water_sources_available': (context) => {
          const actorId =
            context.actor?.id || context.actorEntity?.id || context.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const result = new Set();

          // Check inventory
          const inventory = fixture.testEnv.entityManager.getComponentData(
            actorId,
            'items:inventory'
          );
          const itemIds = inventory?.items || [];

          itemIds.forEach((itemId) => {
            const container = fixture.testEnv.entityManager.getComponentData(
              itemId,
              'containers-core:liquid_container'
            );
            if (!container) return;

            const tags = container.tags || [];
            if (
              Array.isArray(tags) &&
              tags.includes('water') &&
              container.currentVolumeMilliliters > 0
            ) {
              result.add(itemId);
            }
          });

          // Check location
          const actorPosition = fixture.testEnv.entityManager.getComponentData(
            actorId,
            'core:position'
          );
          const locationId = actorPosition?.locationId;
          if (locationId) {
            fixture.testEnv.entityManager.getEntityIds().forEach((entityId) => {
              if (result.has(entityId)) return; // Skip already added inventory items

              const pos = fixture.testEnv.entityManager.getComponentData(
                entityId,
                'core:position'
              );
              if (pos?.locationId !== locationId) return;

              const container = fixture.testEnv.entityManager.getComponentData(
                entityId,
                'containers-core:liquid_container'
              );
              if (!container) return;

              const tags = container.tags || [];
              if (
                Array.isArray(tags) &&
                tags.includes('water') &&
                container.currentVolumeMilliliters > 0
              ) {
                result.add(entityId);
              }
            });
          }

          return { success: true, value: result };
        },
      }
    );
  };

  const buildWaterContainer = (overrides = {}) => ({
    currentVolumeMilliliters: 500,
    maxCapacityMilliliters: 1000,
    servingSizeMilliliters: 100,
    isRefillable: true,
    flavorText: 'Clean water.',
    tags: ['water'],
    ...overrides,
  });

  const loadScenario = ({
    hasMedicine = true,
    hasWater = true,
    wounded = true,
    waterVolume = 500,
    alreadyRinsed = false,
    woundOnArm = false,
    coverWound = false,
    waterInInventory = true,
    waterAtLocation = false,
    hasInventory = true,
  } = {}) => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Treatment Room');

    const waterId = 'items:water_canteen';
    const waterBuilder = new ModEntityBuilder(waterId)
      .withName('Water Canteen')
      .withComponent('items:item', {})
      .withComponent('items:portable', {});

    if (hasWater) {
      waterBuilder.withComponent(
        'containers-core:liquid_container',
        buildWaterContainer({ currentVolumeMilliliters: waterVolume })
      );
    } else {
      waterBuilder.withComponent(
        'containers-core:liquid_container',
        buildWaterContainer({ tags: ['saline'], currentVolumeMilliliters: 500 })
      );
    }

    if (waterAtLocation && !waterInInventory) {
      waterBuilder.atLocation(ROOM_ID).withLocationComponent(ROOM_ID);
    }

    const water = waterBuilder.build();

    const torsoChildren = [];
    if (woundOnArm) torsoChildren.push('actor-left-arm');

    const torsoHealth =
      woundOnArm
        ? { currentHealth: 10, maxHealth: 10 }
        : { currentHealth: wounded ? 5 : 10, maxHealth: 10 };

    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('Medic')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withBody('actor-torso');

    if (hasInventory) {
      actorBuilder.withComponent('items:inventory', {
        items: waterInInventory ? ['items:water_canteen'] : [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });
    }

    if (hasMedicine) {
      actorBuilder.withComponent('skills:medicine_skill', { value: 40 });
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

    const actorTorsoBuilder = new ModEntityBuilder('actor-torso')
      .asBodyPart({ parent: null, children: torsoChildren, subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:visibility_rules', {
        clothingSlotId: 'torso_upper',
        nonBlockingLayers: ['underwear', 'accessories'],
      })
      .withComponent('anatomy:part_health', torsoHealth);

    if (alreadyRinsed && !woundOnArm) {
      actorTorsoBuilder.withComponent('first-aid:rinsed', {
        appliedById: 'actor1',
        sourceItemId: 'items:water_canteen',
      });
    }

    const actorTorso = actorTorsoBuilder.build();

    const entities = [room, actor, actorTorso, water];

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

      if (alreadyRinsed) {
        actorLeftArmBuilder.withComponent('first-aid:rinsed', {
          appliedById: 'actor1',
          sourceItemId: waterId,
        });
      }

      entities.push(actorLeftArmBuilder.build());
    }

    if (coverWound) {
      entities.push(
        new ModEntityBuilder('actor_torso_wrap').withName('Actor Torso Wrap').build()
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
    expect(rinseAction.id).toBe(ACTION_ID);
    expect(rinseAction.name).toBe('Rinse My Wounded Part');
    expect(rinseAction.template).toBe(
      'rinse my {woundedBodyPart} with {waterSource}'
    );
    expect(rinseAction.generateCombinations).toBe(true);
    expect(rinseAction.visual).toEqual({
      backgroundColor: '#1b5e20',
      textColor: '#e8f5e9',
      hoverBackgroundColor: '#2e7d32',
      hoverTextColor: '#ffffff',
    });
    expect(rinseAction.chanceBased).toBeUndefined();
  });

  it('uses the correct scopes and component gates', () => {
    expect(rinseAction.targets.primary.scope).toBe(
      'first-aid:wounded_actor_body_parts'
    );
    expect(rinseAction.targets.secondary.scope).toBe(
      'first-aid:water_sources_available'
    );
    expect(rinseAction.required_components.actor).toEqual(
      expect.arrayContaining(['skills:medicine_skill'])
    );
    // Note: does NOT require items:inventory unlike disinfect
    expect(rinseAction.required_components.actor).not.toContain('items:inventory');
    expect(rinseAction.forbidden_components.actor).toEqual(
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
    expect(rinseAction.forbidden_components.primary).toEqual(
      expect.arrayContaining(['first-aid:rinsed'])
    );
  });

  it('is discoverable when the actor has medicine skill, wounded body part, and water available', () => {
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

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        {
          actor: actorContext,
          actorEntity: actorContext,
        }
      ) || {};
    expect(Array.from(waterSources.value || [])).toContain(
      'items:water_canteen'
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

  it('is discoverable when water source is in actor inventory', () => {
    loadScenario({ waterInInventory: true, waterAtLocation: false });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance('actor1');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: actorContext, actorEntity: actorContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).toContain('items:water_canteen');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is discoverable when water source is at location (not in inventory)', () => {
    loadScenario({ waterInInventory: false, waterAtLocation: true });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance('actor1');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: actorContext, actorEntity: actorContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).toContain('items:water_canteen');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is discoverable when actor has no inventory component but water is at location', () => {
    loadScenario({ hasInventory: false, waterInInventory: false, waterAtLocation: true });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance('actor1');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: actorContext, actorEntity: actorContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).toContain('items:water_canteen');

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

  it('is hidden when no water source is available', () => {
    loadScenario({ hasWater: false });
    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it('is hidden when the water container is empty', () => {
    loadScenario({ waterVolume: 0 });
    const actorContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: actorContext, actorEntity: actorContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).not.toContain(
      'items:water_canteen'
    );

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

  it('is hidden when the wounded body part is already rinsed', () => {
    loadScenario({ alreadyRinsed: true });
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

  it("is hidden when the actor's wounded body part is covered by clothing", () => {
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
});
