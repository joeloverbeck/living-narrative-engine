/**
 * @file Integration tests for first-aid wounded/bleeding body part scopes
 * @description Verifies that the first-aid scopes return only body part entity IDs
 * that are wounded (currentHealth < maxHealth) and optionally bleeding.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';

const woundedScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../data/mods/first-aid/scopes/wounded_actor_body_parts.scope'
  ),
  'utf8'
);

const bleedingScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../data/mods/first-aid/scopes/bleeding_actor_body_parts.scope'
  ),
  'utf8'
);

describe('First-Aid body part scopes', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;
  let mockBodyGraphService;
  let dataRegistry;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    dataRegistry = new InMemoryDataRegistry({ logger });

    mockBodyGraphService = {
      getAllParts: jest.fn(() => []),
      buildAdjacencyCache: jest.fn(),
      findPartsByType: jest.fn(() => []),
      hasPartWithComponentValue: jest.fn(() => ({ found: false })),
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: {
        getConditionDefinition: (id) => dataRegistry.get('conditions', id),
      },
    });
    const jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService: mockBodyGraphService,
      entityManager,
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    const woundedDefinitions = parseScopeDefinitions(
      woundedScopeContent,
      'wounded_actor_body_parts.scope'
    );
    const bleedingDefinitions = parseScopeDefinitions(
      bleedingScopeContent,
      'bleeding_actor_body_parts.scope'
    );

    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();
    scopeRegistry.initialize({
      'first-aid:wounded_actor_body_parts': woundedDefinitions.get(
        'first-aid:wounded_actor_body_parts'
      ),
      'first-aid:bleeding_actor_body_parts': bleedingDefinitions.get(
        'first-aid:bleeding_actor_body_parts'
      ),
    });

    scopeEngine = new ScopeEngine({ scopeRegistry });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createActorWithBody(actorId, bodyData, locationId = 'test:location') {
    entityManager.addEntity({
      id: actorId,
      definitionId: 'test:actor',
      components: {
        'core:actor': {},
        'core:position': { locationId },
        'anatomy:body': bodyData,
      },
    });
    return entityManager.getEntityInstance(actorId);
  }

  function createBodyPart(
    partId,
    { currentHealth, maxHealth, bleeding = false, vitalOrganType = null }
  ) {
    const components = {
      'anatomy:part': {
        subType: 'test_part',
        hit_probability_weight: 1,
        health_calculation_weight: 1,
      },
      'anatomy:part_health': {
        currentHealth,
        maxHealth,
        state: currentHealth < maxHealth ? 'wounded' : 'healthy',
      },
      'core:name': { text: partId },
    };

    if (bleeding) {
      components['anatomy:bleeding'] = { severity: 'moderate' };
    }

    if (vitalOrganType) {
      components['anatomy:vital_organ'] = { organType: vitalOrganType };
    }

    entityManager.addEntity({
      id: partId,
      definitionId: 'anatomy:body_part',
      components,
    });

    return entityManager.getEntityInstance(partId);
  }

  function setupBodyGraphService(actorId, bodyComponent, partIds) {
    mockBodyGraphService.getAllParts.mockImplementation((bodyComp, entityId) => {
      if (entityId === actorId) {
        return partIds;
      }
      return [];
    });

    mockBodyGraphService.buildAdjacencyCache.mockResolvedValue(undefined);

    return bodyComponent;
  }

  it('returns only wounded parts for first-aid:wounded_actor_body_parts', () => {
    const actorId = 'test:patient';
    const woundedPartId = 'test:patient:left_arm';
    const healthyPartId = 'test:patient:right_arm';

    createBodyPart(woundedPartId, { currentHealth: 50, maxHealth: 100 });
    createBodyPart(healthyPartId, { currentHealth: 100, maxHealth: 100 });

    const bodyData = {
      body: {
        root: woundedPartId,
        parts: {
          [woundedPartId]: { children: [healthyPartId] },
          [healthyPartId]: { children: [] },
        },
      },
    };

    const actorEntity = createActorWithBody(actorId, bodyData);
    setupBodyGraphService(actorId, bodyData, [woundedPartId, healthyPartId]);

    const runtimeCtx = {
      entityManager,
      location: { id: 'test:location' },
      logger,
      jsonLogicEval,
      target: actorEntity,
      container: {
        resolve: (token) => {
          if (token === 'BodyGraphService') return mockBodyGraphService;
          return null;
        },
      },
    };

    const result = scopeEngine.resolve(
      scopeRegistry.getScopeAst('first-aid:wounded_actor_body_parts'),
      actorEntity,
      runtimeCtx
    );

    expect(result).toBeInstanceOf(Set);
    expect(Array.from(result)).toEqual([woundedPartId]);
    expect(mockBodyGraphService.getAllParts).toHaveBeenCalledWith(
      bodyData,
      actorId
    );
  });

  it('excludes vital organs from first-aid:wounded_actor_body_parts', () => {
    const actorId = 'test:patient-vital';
    const vitalPartId = 'test:patient:heart';
    const woundedPartId = 'test:patient:left_arm';

    createBodyPart(vitalPartId, {
      currentHealth: 20,
      maxHealth: 40,
      vitalOrganType: 'heart',
    });
    createBodyPart(woundedPartId, { currentHealth: 50, maxHealth: 100 });

    const bodyData = {
      body: {
        root: vitalPartId,
        parts: {
          [vitalPartId]: { children: [woundedPartId] },
          [woundedPartId]: { children: [] },
        },
      },
    };

    const actorEntity = createActorWithBody(actorId, bodyData);
    setupBodyGraphService(actorId, bodyData, [vitalPartId, woundedPartId]);

    const runtimeCtx = {
      entityManager,
      location: { id: 'test:location' },
      logger,
      jsonLogicEval,
      target: actorEntity,
      container: {
        resolve: (token) => {
          if (token === 'BodyGraphService') return mockBodyGraphService;
          return null;
        },
      },
    };

    const result = scopeEngine.resolve(
      scopeRegistry.getScopeAst('first-aid:wounded_actor_body_parts'),
      actorEntity,
      runtimeCtx
    );

    expect(result).toBeInstanceOf(Set);
    expect(Array.from(result)).toEqual([woundedPartId]);
    expect(mockBodyGraphService.getAllParts).toHaveBeenCalledWith(
      bodyData,
      actorId
    );
  });

  it('returns only bleeding wounded parts for first-aid:bleeding_actor_body_parts', () => {
    const actorId = 'test:patient-bleeding';
    const bleedingPartId = 'test:patient:left_leg';
    const woundedPartId = 'test:patient:right_leg';
    const healthyPartId = 'test:patient:torso';

    createBodyPart(bleedingPartId, {
      currentHealth: 40,
      maxHealth: 100,
      bleeding: true,
    });
    createBodyPart(woundedPartId, { currentHealth: 60, maxHealth: 100 });
    createBodyPart(healthyPartId, { currentHealth: 100, maxHealth: 100 });

    const bodyData = {
      body: {
        root: bleedingPartId,
        parts: {
          [bleedingPartId]: { children: [woundedPartId, healthyPartId] },
          [woundedPartId]: { children: [] },
          [healthyPartId]: { children: [] },
        },
      },
    };

    const actorEntity = createActorWithBody(actorId, bodyData);
    setupBodyGraphService(actorId, bodyData, [
      bleedingPartId,
      woundedPartId,
      healthyPartId,
    ]);

    const runtimeCtx = {
      entityManager,
      location: { id: 'test:location' },
      logger,
      jsonLogicEval,
      target: actorEntity,
      container: {
        resolve: (token) => {
          if (token === 'BodyGraphService') return mockBodyGraphService;
          return null;
        },
      },
    };

    const result = scopeEngine.resolve(
      scopeRegistry.getScopeAst('first-aid:bleeding_actor_body_parts'),
      actorEntity,
      runtimeCtx
    );

    expect(result).toBeInstanceOf(Set);
    expect(Array.from(result)).toEqual([bleedingPartId]);
    expect(mockBodyGraphService.getAllParts).toHaveBeenCalledWith(
      bodyData,
      actorId
    );
  });
});
