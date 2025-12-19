/**
 * @file Integration tests for straddling:actor_im_straddling scope
 * @description Tests the actor_im_straddling scope that finds the actor being straddled
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { addMockAstsToScopes } from '../../../common/scopeDsl/mockAstGenerator.js';

describe('straddling:actor_im_straddling scope integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    scopeRegistry = new ScopeRegistry();

    const mockScopes = {
      'straddling:actor_im_straddling': {
        expr: 'entities(core:actor)[][{"==": [{"var": "entity.id"}, {"var": "actor.components.positioning:straddling_waist.target_id"}]}]',
        definition:
          'straddling:actor_im_straddling := entities(core:actor)[][{"==": [{"var": "entity.id"}, {"var": "actor.components.positioning:straddling_waist.target_id"}]}]',
        modId: 'positioning',
      },
    };

    scopeRegistry.initialize(addMockAstsToScopes(mockScopes));

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  it('should return straddled actor from straddling_waist.target_id', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'positioning:straddling_waist': {
            target_id: 'test:actor2',
            facing_away: false,
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
          'sitting-states:sitting_on': {
            furniture_id: 'furniture:chair_1',
            spot_index: 0,
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

    const scopeDef = scopeRegistry.getScope('straddling:actor_im_straddling');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('test:actor2')).toBe(true);
  });

  it('should return empty set when not straddling', () => {
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

    const scopeDef = scopeRegistry.getScope('straddling:actor_im_straddling');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return correct actor when multiple actors exist', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'positioning:straddling_waist': {
            target_id: 'test:actor3',
            facing_away: true,
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
        },
      },
      {
        id: 'test:actor3',
        components: {
          'core:actor': { name: 'Actor 3' },
          'sitting-states:sitting_on': {
            furniture_id: 'furniture:chair_1',
            spot_index: 0,
          },
        },
      },
      {
        id: 'test:actor4',
        components: {
          'core:actor': { name: 'Actor 4' },
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

    const scopeDef = scopeRegistry.getScope('straddling:actor_im_straddling');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('test:actor3')).toBe(true);
  });

  it('should work with facing_away=false', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'positioning:straddling_waist': {
            target_id: 'test:actor2',
            facing_away: false,
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
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

    const scopeDef = scopeRegistry.getScope('straddling:actor_im_straddling');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('test:actor2')).toBe(true);
  });

  it('should work with facing_away=true', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'test:actor1',
        components: {
          'core:actor': { name: 'Actor 1' },
          'positioning:straddling_waist': {
            target_id: 'test:actor2',
            facing_away: true,
          },
        },
      },
      {
        id: 'test:actor2',
        components: {
          'core:actor': { name: 'Actor 2' },
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

    const scopeDef = scopeRegistry.getScope('straddling:actor_im_straddling');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('test:actor2')).toBe(true);
  });
});
