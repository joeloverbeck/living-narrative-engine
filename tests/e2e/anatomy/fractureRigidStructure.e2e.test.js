/**
 * @file E2E tests for fracture immunity in the action pipeline.
 * @see src/anatomy/applicators/fractureApplicator.js
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import ResolveOutcomeHandler from '../../../src/logic/operationHandlers/resolveOutcomeHandler.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import { createDamageTypeEffectsService } from '../actions/helpers/damageTypeEffectsServiceFactory.js';
import practiceStickDefinition from '../../../data/mods/fantasy/entities/definitions/rill_practice_stick.entity.json' assert { type: 'json' };

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'fracture-room';
const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';
const FRACTURED_COMPONENT_ID = 'anatomy:fractured';
const RIGID_STRUCTURE_COMPONENT_ID = 'anatomy:has_rigid_structure';

const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

const buildWeaponFromDefinition = (id, definition) => {
  const builder = new ModEntityBuilder(id);
  Object.entries(definition.components || {}).forEach(([componentId, data]) => {
    builder.withComponent(componentId, data);
  });
  return builder;
};

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partType,
  partName,
  partHealth = 6,
  partMaxHealth = 6,
  hasRigidStructure = false,
}) => {
  const partBuilder = new ModEntityBuilder(`${weaponId}-target-part`)
    .withName(partName)
    .withComponent('anatomy:part', {
      type: partType,
      subType: partType,
      orientation: 'mid',
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: partHealth,
      maxHealth: partMaxHealth,
      status: 'healthy',
    });

  if (hasRigidStructure) {
    partBuilder.withComponent(RIGID_STRUCTURE_COMPONENT_ID, {});
  }

  const part = partBuilder.build();

  const target = new ModEntityBuilder(`${weaponId}-target`)
    .withName('Effect Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: part.id } })
    .build();

  const weapon = weaponBuilder.withName('Fracture Test Weapon').build();

  const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
    .withName('Effect Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('inventory:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('item-handling-states:wielding', {
      wielded_item_ids: [weaponId],
    })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Effect Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  return { attacker, target, part, weapon, room };
};

const installActionHandlers = ({ testEnv, safeDispatcher, rngProvider }) => {
  const { entityManager, logger, jsonLogic, operationRegistry } = testEnv;

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: safeDispatcher,
  });

  const { damageTypeEffectsService } = createDamageTypeEffectsService({
    testEnv,
    safeEventDispatcher: safeDispatcher,
    rngProvider,
  });

  const damagePropagationService = new DamagePropagationService({
    entityManager,
    logger,
    eventBus: safeDispatcher,
  });

  const injuryAggregationService = new InjuryAggregationService({
    entityManager,
    logger,
    bodyGraphService,
  });

  const deathCheckService = new DeathCheckService({
    entityManager,
    logger,
    eventBus: safeDispatcher,
    injuryAggregationService,
    bodyGraphService,
  });

  const damageAccumulator = new DamageAccumulator({ logger });
  const damageNarrativeComposer = new DamageNarrativeComposer({ logger });

  const applyDamageHandler = new ApplyDamageHandler({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    jsonLogicService: jsonLogic,
    bodyGraphService,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
    damageAccumulator,
    damageNarrativeComposer,
  });

  const chanceCalculationService = {
    resolveOutcome: () => ({
      outcome: 'SUCCESS',
      roll: 1,
      threshold: 50,
      margin: -49,
      isCritical: false,
      modifiers: [],
    }),
  };

  const resolveOutcomeHandler = new ResolveOutcomeHandler({
    chanceCalculationService,
    logger,
  });

  operationRegistry.register(
    'APPLY_DAMAGE',
    applyDamageHandler.execute.bind(applyDamageHandler)
  );
  operationRegistry.register(
    'RESOLVE_OUTCOME',
    resolveOutcomeHandler.execute.bind(resolveOutcomeHandler)
  );
};

describe('Fracture Rigid Structure - E2E', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;

  const executeSwing = async ({
    weaponDefinition,
    weaponId,
    partType,
    partName,
    partHealth,
    partMaxHealth,
    hasRigidStructure,
    rngProvider,
  }) => {
    const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
    const { attacker, target, part, weapon, room } = createCombatants({
      weaponBuilder,
      weaponId,
      partType,
      partName,
      partHealth,
      partMaxHealth,
      hasRigidStructure,
    });

    fixture.reset([attacker, target, part, weapon, room]);
    fixture.clearEvents();

    installActionHandlers({ testEnv, safeDispatcher, rngProvider });

    await testEnv.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actionId: ACTION_ID,
      actorId: attacker.id,
      primaryId: weapon.id,
      secondaryId: target.id,
      originalInput: `swing ${weapon.id} at ${target.id}`,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    return { part, target };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('weapons', ACTION_ID, null, null, {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy'],
    });
    testEnv = fixture.testEnv;
    safeDispatcher = createSafeDispatcher(testEnv.eventBus);
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fixture?.cleanup();
  });

  it('fractures rigid-structure parts in the action pipeline', async () => {
    const { part } = await executeSwing({
      weaponDefinition: practiceStickDefinition,
      weaponId: 'fracture-rigid-stick',
      partType: 'leg',
      partName: 'Target Leg',
      partHealth: 6,
      partMaxHealth: 6,
      hasRigidStructure: true,
      rngProvider: () => 0.05,
    });

    const fractureEvent = fixture.events.find(
      (event) => event.eventType === 'anatomy:fractured'
    );
    const damageAppliedEvent = fixture.events.find(
      (event) => event.eventType === DAMAGE_APPLIED_EVENT
    );
    const fractureComponent = testEnv.entityManager.getComponentData(
      part.id,
      FRACTURED_COMPONENT_ID
    );

    expect(damageAppliedEvent).toBeDefined();
    expect(fractureEvent).toBeDefined();
    expect(fractureComponent).toEqual(
      expect.objectContaining({ sourceDamageType: 'blunt' })
    );
  });

  it('skips fractures for soft-tissue parts without rigid structure', async () => {
    const { part } = await executeSwing({
      weaponDefinition: practiceStickDefinition,
      weaponId: 'fracture-soft-stick',
      partType: 'breast',
      partName: 'Target Breast',
      partHealth: 6,
      partMaxHealth: 6,
      hasRigidStructure: false,
      rngProvider: () => 0.05,
    });

    const fractureEvent = fixture.events.find(
      (event) => event.eventType === 'anatomy:fractured'
    );
    const damageAppliedEvent = fixture.events.find(
      (event) => event.eventType === DAMAGE_APPLIED_EVENT
    );
    const fractureComponent = testEnv.entityManager.getComponentData(
      part.id,
      FRACTURED_COMPONENT_ID
    );

    expect(damageAppliedEvent).toBeDefined();
    expect(fractureEvent).toBeUndefined();
    expect(fractureComponent).toBeNull();
  });
});
