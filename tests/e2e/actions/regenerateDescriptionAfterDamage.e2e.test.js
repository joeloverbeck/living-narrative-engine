/**
 * @file regenerateDescriptionAfterDamage.e2e.test.js
 * @description E2E coverage for REGENERATE_DESCRIPTION after APPLY_DAMAGE using the real BodyDescriptionComposer.
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
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { PartDescriptionGenerator } from '../../../src/anatomy/PartDescriptionGenerator.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import rapierDefinition from '../../../data/mods/fantasy/entities/definitions/vespera_rapier.entity.json' assert { type: 'json' };
import longswordDefinition from '../../../data/mods/fantasy/entities/definitions/threadscar_melissa_longsword.entity.json' assert { type: 'json' };
import { createDamageTypeEffectsService } from './helpers/damageTypeEffectsServiceFactory.js';

const ACTION_ID = 'weapons:swing_at_target';
const ROOM_ID = 'description-room';

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

const cloneWith = (definition, damageEntries) => {
  const cloned = JSON.parse(JSON.stringify(definition));
  cloned.components = cloned.components || {};
  cloned.components['damage-types:damage_capabilities'] = {
    ...(cloned.components['damage-types:damage_capabilities'] || {}),
    entries: damageEntries,
  };
  return cloned;
};

const bleedingRapierDefinition = cloneWith(rapierDefinition, [
  {
    name: 'slashing',
    amount: 12,
    penetration: 0.4,
    bleed: {
      enabled: true,
      severity: 'moderate',
      chance: 1.0,
    },
  },
]);

const burningRapierDefinition = cloneWith(rapierDefinition, [
  {
    name: 'burning_slash',
    amount: 8,
    penetration: 0.25,
    burn: {
      enabled: true,
      dps: 2,
      durationTurns: 3,
      canStack: true,
    },
  },
]);

const plainImpactDefinition = cloneWith(rapierDefinition, [
  {
    name: 'blunt',
    amount: 20,
    penetration: 0.2,
  },
]);

const createCombatants = ({
  weaponBuilder,
  weaponId,
  partHealth = 50,
  partMaxHealth = 50,
  initialDescription = 'Pristine description',
}) => {
  const part = new ModEntityBuilder(`${weaponId}-target-part`)
    .withName('Target Part')
    .withComponent('anatomy:part', {
      type: 'torso',
      subType: 'torso',
      orientation: 'mid',
      children: [],
    })
    .withComponent('anatomy:part_health', {
      currentHealth: partHealth,
      maxHealth: partMaxHealth,
      status: 'healthy',
    })
    .build();

  const target = new ModEntityBuilder(`${weaponId}-target`)
    .withName('Description Target')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { level: 10 })
    .withComponent('anatomy:body', { body: { root: part.id } })
    .withComponent('core:description', { text: initialDescription })
    .build();

  const weapon = weaponBuilder.withName('Description Test Weapon').build();

  const attacker = new ModEntityBuilder(`${weaponId}-attacker`)
    .withName('Description Attacker')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:melee_skill', { level: 90 })
    .withComponent('inventory:inventory', { items: [weaponId], capacity: 5 })
    .withComponent('item-handling-states:wielding', { wielded_item_ids: [weaponId] })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Description Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  const partData = part.components['anatomy:part'];
  partData.ownerEntityId = target.id;

  return { attacker, target, part, weapon, room };
};

const installRealHandlers = ({ testEnv, safeDispatcher, rngProvider }) => {
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

  const descriptorFormatter = new DescriptorFormatter();
  const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
    descriptorFormatter,
  });

  const partDescriptionGenerator = new PartDescriptionGenerator({
    logger,
    bodyPartDescriptionBuilder,
    entityManager,
  });

  const injuryNarrativeFormatterService = new InjuryNarrativeFormatterService({
    logger,
  });

  const bodyDescriptionComposer = new BodyDescriptionComposer({
    bodyPartDescriptionBuilder,
    bodyGraphService,
    entityFinder: entityManager,
    partDescriptionGenerator,
    anatomyFormattingService: null,
    injuryAggregationService,
    injuryNarrativeFormatterService,
    logger,
  });

  const regenerateDescriptionHandler = new RegenerateDescriptionHandler({
    entityManager,
    bodyDescriptionComposer,
    logger,
    safeEventDispatcher: safeDispatcher,
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
    'REGENERATE_DESCRIPTION',
    regenerateDescriptionHandler.execute.bind(regenerateDescriptionHandler)
  );

  operationRegistry.register(
    'RESOLVE_OUTCOME',
    resolveOutcomeHandler.execute.bind(resolveOutcomeHandler)
  );

  return { damageTypeEffectsService };
};

const executeSwing = async ({
  weaponDefinition,
  weaponId,
  partHealth = 50,
  partMaxHealth = 50,
  initialDescription = 'Pristine description',
  rngProvider = () => 0.5,
  fixture,
  testEnv,
  safeDispatcher,
}) => {
  const weaponBuilder = buildWeaponFromDefinition(weaponId, weaponDefinition);
  const { attacker, target, part, weapon, room } = createCombatants({
    weaponBuilder,
    weaponId,
    partHealth,
    partMaxHealth,
    initialDescription,
  });

  const partData = part.components['anatomy:part'];
  partData.ownerEntityId = target.id;

  fixture.reset([attacker, target, part, weapon, room]);
  fixture.clearEvents();

  installRealHandlers({
    testEnv,
    safeDispatcher,
    rngProvider,
  });

  const beforeDescription =
    testEnv.entityManager.getComponentData(target.id, 'core:description')?.
      text || '';

  await testEnv.eventBus.dispatch('core:attempt_action', {
    eventName: 'core:attempt_action',
    actionId: ACTION_ID,
    actorId: attacker.id,
    primaryId: weapon.id,
    secondaryId: target.id,
    originalInput: `swing ${weapon.id} at ${target.id}`,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));

  const afterDescription =
    testEnv.entityManager.getComponentData(target.id, 'core:description')?.
      text || '';

  return { target, part, beforeDescription, afterDescription };
};

describe('REGENERATE_DESCRIPTION after APPLY_DAMAGE (E2E)', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;

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
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('regenerates description after damage and includes injury state', async () => {
    const { beforeDescription, afterDescription } = await executeSwing({
      weaponDefinition: plainImpactDefinition,
      weaponId: 'regen-basic-rapier',
      partHealth: 50,
      partMaxHealth: 50,
      rngProvider: () => 0.25,
      fixture,
      testEnv,
      safeDispatcher,
    });

    expect(afterDescription).not.toEqual(beforeDescription);
    expect(afterDescription).toContain('Health:');
    expect(afterDescription.toLowerCase()).toMatch(/wounded|injured/);
  });

  it('surfaces bleeding effects in regenerated description', async () => {
    const { afterDescription } = await executeSwing({
      weaponDefinition: bleedingRapierDefinition,
      weaponId: 'regen-bleed-rapier',
      partHealth: 40,
      partMaxHealth: 40,
      rngProvider: () => 0.0,
      fixture,
      testEnv,
      safeDispatcher,
    });

    expect(afterDescription.toLowerCase()).toContain('blood');
  });

  it('surfaces burning effects in regenerated description', async () => {
    const { afterDescription } = await executeSwing({
      weaponDefinition: burningRapierDefinition,
      weaponId: 'regen-burn-rapier',
      partHealth: 45,
      partMaxHealth: 45,
      rngProvider: () => 0.0,
      fixture,
      testEnv,
      safeDispatcher,
    });

    expect(afterDescription.toLowerCase()).toContain('burn');
  });

  it('reports destroyed or missing parts after severe damage', async () => {
    const { afterDescription } = await executeSwing({
      weaponDefinition: longswordDefinition,
      weaponId: 'regen-destroy-long',
      partHealth: 20,
      partMaxHealth: 20,
      rngProvider: () => 0.4,
      fixture,
      testEnv,
      safeDispatcher,
    });

    expect(afterDescription.toLowerCase()).toMatch(/missing|destroyed/);
  });
});
