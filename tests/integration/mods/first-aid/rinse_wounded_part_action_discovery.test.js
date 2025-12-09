/**
 * @file Integration tests for first-aid:rinse_wounded_part action definition and discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import rinseAction from '../../../../data/mods/first-aid/actions/rinse_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:rinse_wounded_part';
const ROOM_ID = 'room1';

describe('first-aid:rinse_wounded_part action definition', () => {
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
        'first-aid:wounded_target_body_parts': (context) => {
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

          const coverageContext = { target: { id: targetId } };
          const isCovered = (socketId) =>
            socketId &&
            fixture.testEnv.jsonLogic.evaluate(
              { isSocketCovered: ['target', socketId] },
              coverageContext
            );
          const equipment = fixture.testEnv.entityManager.getComponentData(
            targetId,
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
              'items:liquid_container'
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
                'items:liquid_container'
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
        'items:liquid_container',
        buildWaterContainer({ currentVolumeMilliliters: waterVolume })
      );
    } else {
      waterBuilder.withComponent(
        'items:liquid_container',
        buildWaterContainer({ tags: ['saline'], currentVolumeMilliliters: 500 })
      );
    }

    if (waterAtLocation && !waterInInventory) {
      waterBuilder.atLocation(ROOM_ID).withLocationComponent(ROOM_ID);
    }

    const water = waterBuilder.build();

    const medicBuilder = new ModEntityBuilder('actor1')
      .withName('Medic')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor();

    if (hasInventory) {
      medicBuilder.withComponent('items:inventory', {
        items: waterInInventory ? ['items:water_canteen'] : [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });
    }

    if (hasMedicine) {
      medicBuilder.withComponent('skills:medicine_skill', { value: 40 });
    }

    const medic = medicBuilder.build();

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

    const torsoChildren = [];
    if (woundOnArm) torsoChildren.push('patient-left-arm');

    const torsoHealth =
      woundOnArm
        ? { currentHealth: 10, maxHealth: 10 }
        : { currentHealth: wounded ? 5 : 10, maxHealth: 10 };

    const patientTorsoBuilder = new ModEntityBuilder('patient-torso')
      .asBodyPart({ parent: null, children: torsoChildren, subType: 'torso' })
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('anatomy:visibility_rules', {
        clothingSlotId: 'torso_upper',
        nonBlockingLayers: ['underwear', 'accessories'],
      })
      .withComponent('anatomy:part_health', torsoHealth);

    if (alreadyRinsed && !woundOnArm) {
      patientTorsoBuilder.withComponent('first-aid:rinsed', {
        appliedById: 'actor1',
        sourceItemId: 'items:water_canteen',
      });
    }

    const patientTorso = patientTorsoBuilder.build();

    const entities = [room, medic, patient, patientTorso, water];

    if (woundOnArm) {
      const patientLeftArmBuilder = new ModEntityBuilder('patient-left-arm')
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
        });

      if (alreadyRinsed) {
        patientLeftArmBuilder.withComponent('first-aid:rinsed', {
          appliedById: 'actor1',
          sourceItemId: waterId,
        });
      }

      entities.push(patientLeftArmBuilder.build());
    }

    if (coverWound) {
      entities.push(
        new ModEntityBuilder('patient_torso_wrap').withName('Patient Torso Wrap').build()
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
    expect(rinseAction.name).toBe('Rinse Wounded Part');
    expect(rinseAction.template).toBe(
      "rinse {target}'s {woundedBodyPart} with {waterSource}"
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
      'core:actors_in_location'
    );
    expect(rinseAction.targets.secondary.scope).toBe(
      'first-aid:wounded_target_body_parts'
    );
    expect(rinseAction.targets.secondary.contextFrom).toBe('primary');
    expect(rinseAction.targets.tertiary.scope).toBe(
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
    expect(rinseAction.forbidden_components.secondary).toEqual(
      expect.arrayContaining(['first-aid:rinsed'])
    );
  });

  it('is discoverable when the actor has medicine skill and a wounded target with water available', () => {
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
        'first-aid:wounded_target_body_parts',
        {
          actor: patientContext,
          actorEntity: patientContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('patient-torso');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        {
          actor: medicContext,
          actorEntity: medicContext,
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
    const medicContext = fixture.testEnv.entityManager.getEntityInstance('actor1');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: medicContext, actorEntity: medicContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).toContain('items:water_canteen');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is discoverable when water source is at location (not in inventory)', () => {
    loadScenario({ waterInInventory: false, waterAtLocation: true });
    const medicContext = fixture.testEnv.entityManager.getEntityInstance('actor1');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: medicContext, actorEntity: medicContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).toContain('items:water_canteen');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(1);
  });

  it('is discoverable when actor has no inventory component but water is at location', () => {
    loadScenario({ hasInventory: false, waterInInventory: false, waterAtLocation: true });
    const medicContext = fixture.testEnv.entityManager.getEntityInstance('actor1');

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: medicContext, actorEntity: medicContext }
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
    const medicContext = fixture.testEnv.entityManager.getEntityInstance(
      'actor1'
    );

    const waterSources =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:water_sources_available',
        { actor: medicContext, actorEntity: medicContext }
      ) || {};
    expect(Array.from(waterSources.value || [])).not.toContain(
      'items:water_canteen'
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

  it('is hidden when the wounded body part is already rinsed', () => {
    loadScenario({ alreadyRinsed: true });
    const patientContext = fixture.testEnv.entityManager.getEntityInstance(
      'target1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_target_body_parts',
        {
          actor: patientContext,
          actorEntity: patientContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toContain('patient-torso');

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });

  it("is hidden when the target's only wounded body part is covered by clothing", () => {
    loadScenario({ woundOnArm: true, coverWound: true });
    const patientContext = fixture.testEnv.entityManager.getEntityInstance(
      'target1'
    );

    const woundedParts =
      fixture.testEnv.unifiedScopeResolver.resolveSync(
        'first-aid:wounded_target_body_parts',
        {
          target: patientContext,
          actor: patientContext,
          actorEntity: patientContext,
          primary: patientContext,
        }
      ) || {};
    expect(Array.from(woundedParts.value || [])).toHaveLength(0);

    const availableActions = fixture.testEnv.getAvailableActions('actor1');
    const matches = availableActions.filter((a) => a.id === ACTION_ID);
    expect(matches).toHaveLength(0);
  });
});
