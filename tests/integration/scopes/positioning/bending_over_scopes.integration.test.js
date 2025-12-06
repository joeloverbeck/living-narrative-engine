/**
 * @file Integration tests for bending over scope definitions
 * @description Tests available_surfaces and surface_im_bending_over scopes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { POSITION_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

describe('Bending over scopes integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    // Initialize JSON Logic Evaluation Service
    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    // Create scope registry
    scopeRegistry = new ScopeRegistry({ logger });

    // Register test scopes
    const mockScopes = {
      'positioning:available_surfaces': {
        definition:
          'positioning:available_surfaces := entities(positioning:allows_bending_over)[][{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]}]',
        modId: 'positioning',
      },
      'positioning:surface_im_bending_over': {
        definition:
          'positioning:surface_im_bending_over := entities(positioning:allows_bending_over)[][{"==": [{"var": "entity.id"}, {"var": "actor.components.positioning:bending_over.surface_id"}]}]',
        modId: 'positioning',
      },
    };

    // Initialize scope registry with parsed ASTs
    const scopesWithAsts = {};
    for (const [id, scope] of Object.entries(mockScopes)) {
      const expr = scope.definition.split(':=')[1].trim();
      scopesWithAsts[id] = {
        ...scope,
        expr,
        ast: parseDslExpression(expr),
      };
    }

    scopeRegistry.initialize(scopesWithAsts);

    // Create scope engine
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  describe('available_surfaces scope', () => {
    it('should return surfaces in actor location', () => {
      // Create test entities
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor',
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'kitchen:room' },
          },
        },
        {
          id: 'kitchen:counter',
          components: {
            'positioning:allows_bending_over': {},
            [POSITION_COMPONENT_ID]: { locationId: 'kitchen:room' },
          },
        },
        {
          id: 'dining:table',
          components: {
            'positioning:allows_bending_over': {},
            [POSITION_COMPONENT_ID]: { locationId: 'dining:room' },
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
        location: { id: 'kitchen:room' },
      };

      // Parse and resolve the scope
      const scopeDef = scopeRegistry.getScope('positioning:available_surfaces');
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      // Should include counter but not table
      expect(result).toBeInstanceOf(Set);
      expect(result.has('kitchen:counter')).toBe(true);
      expect(result.has('dining:table')).toBe(false);
    });

    it('should return empty set when no surfaces in location', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor',
          components: {
            [POSITION_COMPONENT_ID]: { locationId: 'empty:room' },
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
        location: { id: 'empty:room' },
      };

      const scopeDef = scopeRegistry.getScope('positioning:available_surfaces');
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('surface_im_bending_over scope', () => {
    it('should return current surface when bending', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor',
          components: {
            'positioning:bending_over': { surface_id: 'kitchen:counter' },
          },
        },
        {
          id: 'kitchen:counter',
          components: {
            'positioning:allows_bending_over': {},
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'positioning:surface_im_bending_over'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('kitchen:counter')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should return empty set when not bending', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor',
          components: {},
        },
        {
          id: 'kitchen:counter',
          components: {
            'positioning:allows_bending_over': {},
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'positioning:surface_im_bending_over'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
