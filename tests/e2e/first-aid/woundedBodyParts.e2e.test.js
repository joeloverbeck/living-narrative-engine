/**
 * @file woundedBodyParts.e2e.test.js
 * @description E2E coverage that ties APPLY_DAMAGE mutations to the first-aid wounded/bleeding scopes.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { createCapturingEventBus } from '../../common/mockFactories/index.js';
import { createDamageTypeEffectsService } from '../actions/helpers/damageTypeEffectsServiceFactory.js';

const ROOM_ID = 'triage-room';
const woundedScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/first-aid/scopes/wounded_target_body_parts.scope'
  ),
  'utf8'
);
const bleedingScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/first-aid/scopes/bleeding_actor_body_parts.scope'
  ),
  'utf8'
);

describe('First-aid scopes after APPLY_DAMAGE', () => {
  let entityManager;
  let eventBus;
  let logger;
  let safeDispatcher;
  let bodyGraphService;
  let jsonLogicEval;
  let scopeEngine;
  let scopeRegistry;
  let applyDamageHandler;
  let actorEntity;
  let actorBody;

  beforeEach(async () => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    eventBus = createCapturingEventBus();
    safeDispatcher = {
      dispatch: (eventType, payload) => eventBus.dispatch(eventType, payload),
    };

    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: safeDispatcher,
    });

    const dataRegistry = new InMemoryDataRegistry({ logger });
    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    const jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    const woundedDefinitions = parseScopeDefinitions(
      woundedScopeContent,
      'wounded_target_body_parts.scope'
    );
    const bleedingDefinitions = parseScopeDefinitions(
      bleedingScopeContent,
      'bleeding_actor_body_parts.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();
    scopeRegistry.initialize({
      'first-aid:wounded_target_body_parts': woundedDefinitions.get(
        'first-aid:wounded_target_body_parts'
      ),
      'first-aid:bleeding_actor_body_parts': bleedingDefinitions.get(
        'first-aid:bleeding_actor_body_parts'
      ),
    });
    scopeEngine = new ScopeEngine({ scopeRegistry });

    const { damageTypeEffectsService } = createDamageTypeEffectsService({
      testEnv: { entityManager, logger },
      safeEventDispatcher: safeDispatcher,
      rngProvider: () => 0, // deterministic bleed application
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

    applyDamageHandler = new ApplyDamageHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      jsonLogicService: jsonLogicEval,
      bodyGraphService,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator: new DamageAccumulator({ logger }),
      damageNarrativeComposer: new DamageNarrativeComposer({ logger }),
    });

    const torsoId = 'triage:torso';
    const bleedingArmId = 'triage:left_arm';
    const woundedArmId = 'triage:right_arm';
    const healthyHeadId = 'triage:head';

    createBodyPart(torsoId, {
      ownerId: 'triage:patient',
      parentId: null,
      currentHealth: 120,
      maxHealth: 120,
    });
    createBodyPart(bleedingArmId, {
      ownerId: 'triage:patient',
      parentId: torsoId,
      currentHealth: 90,
      maxHealth: 120,
    });
    createBodyPart(woundedArmId, {
      ownerId: 'triage:patient',
      parentId: torsoId,
      currentHealth: 110,
      maxHealth: 120,
    });
    createBodyPart(healthyHeadId, {
      ownerId: 'triage:patient',
      parentId: torsoId,
      currentHealth: 100,
      maxHealth: 100,
    });

    const body = {
      body: {
        root: torsoId,
        parts: {
          [torsoId]: { children: [bleedingArmId, woundedArmId, healthyHeadId] },
          [bleedingArmId]: { children: [] },
          [woundedArmId]: { children: [] },
          [healthyHeadId]: { children: [] },
        },
      },
    };

    actorEntity = createActorWithBody('triage:patient', body);
    actorBody = actorEntity.components['anatomy:body'];

    await bodyGraphService.buildAdjacencyCache(actorEntity.id);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createBodyPart(
    partId,
    { ownerId, parentId, currentHealth, maxHealth }
  ) {
    const components = {
      'anatomy:part': {
        type: 'torso',
        subType: partId.split(':').pop(),
        ownerEntityId: ownerId,
        hit_probability_weight: 1,
      },
      'anatomy:part_health': {
        currentHealth,
        maxHealth,
        state: 'healthy',
      },
      'anatomy:joint': {
        parentId,
        socketId: parentId ? `${parentId}-socket` : 'root-socket',
      },
      'core:name': { text: partId },
    };

    entityManager.addEntity({
      id: partId,
      definitionId: 'anatomy:body_part',
      components,
    });
  }

  function createActorWithBody(actorId, bodyComponent) {
    entityManager.addEntity({
      id: actorId,
      definitionId: 'test:actor',
      components: {
        'core:actor': {},
        'core:position': { locationId: ROOM_ID },
        'anatomy:body': bodyComponent,
      },
    });
    return entityManager.getEntityInstance(actorId);
  }

  function createExecutionContext() {
    return {
      evaluationContext: { context: {} },
      logger,
    };
  }

  it('returns only damaged parts from wounded/bleeding scopes after APPLY_DAMAGE', async () => {
    const bleedingPartId = 'triage:left_arm';
    const woundedPartId = 'triage:right_arm';
    const healthyPartId = 'triage:head';

    await applyDamageHandler.execute(
      {
        entity_ref: actorEntity.id,
        part_ref: bleedingPartId,
        damage_entry: {
          name: 'slashing',
          amount: 35,
          penetration: 0.3,
          bleed: { enabled: true, severity: 'moderate', chance: 1 },
        },
      },
      createExecutionContext()
    );

    await applyDamageHandler.execute(
      {
        entity_ref: actorEntity.id,
        part_ref: woundedPartId,
        damage_entry: { name: 'blunt', amount: 15, penetration: 0.1 },
      },
      createExecutionContext()
    );

    const bleedingHealth = entityManager.getComponentData(
      bleedingPartId,
      'anatomy:part_health'
    );
    const woundedHealth = entityManager.getComponentData(
      woundedPartId,
      'anatomy:part_health'
    );
    const healthyHealth = entityManager.getComponentData(
      healthyPartId,
      'anatomy:part_health'
    );

    expect(bleedingHealth.currentHealth).toBeLessThan(
      bleedingHealth.maxHealth
    );
    expect(
      entityManager.getComponentData(bleedingPartId, 'anatomy:bleeding')
    ).toBeDefined();
    expect(woundedHealth.currentHealth).toBeLessThan(woundedHealth.maxHealth);
    expect(healthyHealth.currentHealth).toBe(healthyHealth.maxHealth);

    const runtimeCtx = {
      entityManager,
      location: { id: ROOM_ID },
      logger,
      jsonLogicEval,
      target: actorEntity,
      container: {
        resolve: (token) => {
          if (token === 'BodyGraphService') return bodyGraphService;
          return null;
        },
      },
    };

    const getAllPartsSpy = jest.spyOn(bodyGraphService, 'getAllParts');

    const woundedResult = scopeEngine.resolve(
      scopeRegistry.getScopeAst('first-aid:wounded_target_body_parts'),
      actorEntity,
      runtimeCtx
    );
    const bleedingResult = scopeEngine.resolve(
      scopeRegistry.getScopeAst('first-aid:bleeding_actor_body_parts'),
      actorEntity,
      runtimeCtx
    );

    expect(getAllPartsSpy).toHaveBeenCalledWith(actorBody, actorEntity.id);

    const woundedIds = Array.from(woundedResult);
    const bleedingIds = Array.from(bleedingResult);

    expect(woundedIds).toEqual(
      expect.arrayContaining([bleedingPartId, woundedPartId])
    );
    expect(woundedIds).not.toContain(healthyPartId);
    expect(woundedIds).toHaveLength(2);
    expect(bleedingIds).toEqual([bleedingPartId]);
  });
});
