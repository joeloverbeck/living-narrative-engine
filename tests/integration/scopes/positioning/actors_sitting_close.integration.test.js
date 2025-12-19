/**
 * @file Integration tests for sitting:actors_sitting_close scope
 * @description Tests the actors_sitting_close scope that filters closeness partners for sitting actors
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { addMockAstsToScopes } from '../../../common/scopeDsl/mockAstGenerator.js';

describe('sitting:actors_sitting_close scope integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    // Mock GameDataRepository with empty conditions
    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    scopeRegistry = new ScopeRegistry();

    // Register the scope
    const mockScopes = {
      'sitting:actors_sitting_close': {
        expr: 'actor.components.personal-space-states:closeness.partners[][{"!!": {"var": "entity.components.positioning:sitting_on"}}]',
        definition:
          'sitting:actors_sitting_close := actor.components.personal-space-states:closeness.partners[][{"!!": {"var": "entity.components.positioning:sitting_on"}}]',
        modId: 'sitting',
      },
    };

    scopeRegistry.initialize(addMockAstsToScopes(mockScopes));

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  it('should return sitting actors in closeness circle', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: ['test:actor2', 'test:actor3'],
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            spot_index: 0,
          },
          'personal-space-states:closeness': {
            partners: ['test:actor1'],
          },
        },
      },
      {
        id: 'test:actor3',
        components: {
          'core:actor': { name: 'Actor 3' },
          'personal-space-states:closeness': {
            partners: ['test:actor1'],
          },
        },
      },
    ]);

    const actor1 = entityManager.getEntityInstance('test:actor1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor: actor1,
      jsonLogicEval,
    };

    const scopeDef = scopeRegistry.getScope('sitting:actors_sitting_close');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('test:actor2')).toBe(true);
  });

  it('should handle non-sitting partners correctly', () => {
    // Test with mix of sitting and non-sitting actors
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: ['test:actor2', 'test:actor3'],
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            spot_index: 0,
          },
        },
      },
      {
        id: 'test:actor3',
        components: {
          'core:actor': { name: 'Actor 3' },
        },
      },
    ]);

    const actor1 = entityManager.getEntityInstance('test:actor1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor: actor1,
      jsonLogicEval,
    };

    const scopeDef = scopeRegistry.getScope('sitting:actors_sitting_close');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('test:actor2')).toBe(true);
    expect(result.has('test:actor3')).toBe(false);
  });

  it('should return empty set when actor has no closeness', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
        },
      },
    ]);

    const actor1 = entityManager.getEntityInstance('test:actor1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor: actor1,
      jsonLogicEval,
    };

    const scopeDef = scopeRegistry.getScope('sitting:actors_sitting_close');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return empty set when no partners are sitting', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: [],
          },
        },
      },
    ]);

    const actor1 = entityManager.getEntityInstance('test:actor1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor: actor1,
      jsonLogicEval,
    };

    const scopeDef = scopeRegistry.getScope('sitting:actors_sitting_close');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return multiple sitting actors', () => {
    // Test with mixed sitting and non-sitting actors in closeness circle
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'personal-space-states:closeness': {
            partners: ['test:actor2', 'test:actor3', 'test:actor4'],
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            spot_index: 0,
          },
          'personal-space-states:closeness': {
            partners: ['test:actor1'],
          },
        },
      },
      {
        id: 'test:actor3',
        components: {
          'core:actor': { name: 'Actor 3' },
          'personal-space-states:closeness': {
            partners: ['test:actor1'],
          },
        },
      },
      {
        id: 'test:actor4',
        components: {
          'core:actor': { name: 'Actor 4' },
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_2',
            spot_index: 0,
          },
          'personal-space-states:closeness': {
            partners: ['test:actor1'],
          },
        },
      },
    ]);

    const actor1 = entityManager.getEntityInstance('test:actor1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor: actor1,
      jsonLogicEval,
    };

    const scopeDef = scopeRegistry.getScope('sitting:actors_sitting_close');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has('test:actor2')).toBe(true);
    expect(result.has('test:actor4')).toBe(true);
  });
});
