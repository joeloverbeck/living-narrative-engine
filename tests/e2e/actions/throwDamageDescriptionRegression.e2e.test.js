/**
 * @file throwDamageDescriptionRegression.e2e.test.js
 * @description Regression coverage for throw_item_at_target pipeline to ensure
 * REGENERATE_DESCRIPTION reflects surface damage (non-perfect health) after APPLY_DAMAGE.
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
import GetDamageCapabilitiesHandler from '../../../src/logic/operationHandlers/getDamageCapabilitiesHandler.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import { createDamageTypeEffectsService } from './helpers/damageTypeEffectsServiceFactory.js';

const ACTION_ID = 'ranged:throw_item_at_target';
const ROOM_ID = 'throw-room';

const createSafeDispatcher = (eventBus) => ({
  dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
});

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

  const getDamageCapabilitiesHandler = new GetDamageCapabilitiesHandler({
    entityManager,
    logger,
    safeEventDispatcher: safeDispatcher,
    jsonLogicService: jsonLogic,
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

  operationRegistry.register(
    'GET_DAMAGE_CAPABILITIES',
    getDamageCapabilitiesHandler.execute.bind(getDamageCapabilitiesHandler)
  );

  return { damageTypeEffectsService };
};

const buildScenarioEntities = ({
  damageAmount = 4,
  partHealth = 50,
  partMaxHealth = 50,
}) => {
  const torso = new ModEntityBuilder('throw-target-torso')
    .withName('Torso')
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

  const target = new ModEntityBuilder('throw-target')
    .withName('Rill')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:defense_skill', { value: 0 })
    .withComponent('anatomy:body', { body: { root: torso.id } })
    .withComponent('core:description', { text: 'Awaiting description.' })
    .build();

  const thrownItem = new ModEntityBuilder('throwable-item')
    .withName('Containment Vessel')
    .withComponent('items-core:portable', {})
    .withComponent('core:weight', { weight: 0.8 })
    .withComponent('damage-types:damage_capabilities', {
      entries: [
        {
          name: 'blunt',
          amount: damageAmount,
        },
      ],
    })
    .build();

  const attacker = new ModEntityBuilder('throw-attacker')
    .withName('Aldous')
    .asActor()
    .withComponent('core:position', { locationId: ROOM_ID })
    .withComponent('skills:ranged_skill', { value: 80 })
    .withComponent('items:inventory', { items: [thrownItem.id], capacity: 5 })
    .build();

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Throw Room')
    .withComponent('core:position', { locationId: ROOM_ID })
    .build();

  const torsoData = torso.components['anatomy:part'];
  torsoData.ownerEntityId = target.id;

  return { attacker, target, torso, thrownItem, room };
};

const executeThrow = async ({
  fixture,
  testEnv,
  safeDispatcher,
  rngProvider = () => 0.5,
}) => {
  const { attacker, target, torso, thrownItem, room } = buildScenarioEntities({
    damageAmount: 4,
  });

  fixture.reset([attacker, target, torso, thrownItem, room]);
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
    primaryId: thrownItem.id,
    secondaryId: target.id,
    originalInput: `throw ${thrownItem.id} at ${target.id}`,
  });

  await new Promise((resolve) => setTimeout(resolve, 30));

  const afterDescription =
    testEnv.entityManager.getComponentData(target.id, 'core:description')?.
      text || '';

  const updatedHealth =
    testEnv.entityManager.getComponentData(
      torso.id,
      'anatomy:part_health'
    )?.currentHealth;

  return { beforeDescription, afterDescription, updatedHealth };
};

describe('Throw item description regression (APPLY_DAMAGE + REGENERATE_DESCRIPTION)', () => {
  let fixture;
  let testEnv;
  let safeDispatcher;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'ranged',
      ACTION_ID,
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning', 'anatomy', 'items'],
      }
    );
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

  it('marks surface damage as non-perfect health after a successful throw', async () => {
    const { beforeDescription, afterDescription, updatedHealth } =
      await executeThrow({
        fixture,
        testEnv,
        safeDispatcher,
        rngProvider: () => 0.1,
      });

    expect(updatedHealth).toBe(46);
    expect(afterDescription).not.toEqual(beforeDescription);
    expect(afterDescription).toContain('Health:');
    expect(afterDescription).not.toContain('Perfect health.');
    expect(afterDescription.toLowerCase()).toContain('bruised');
  });
});
