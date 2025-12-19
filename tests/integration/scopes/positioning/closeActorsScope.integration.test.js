/**
 * @file Integration tests for personal-space:close_actors scope
 * @description Tests the migrated close_actors scope functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { addMockAstsToScopes } from '../../../common/scopeDsl/mockAstGenerator.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('personal-space:close_actors scope integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    // Initialize test environment
    logger = new ConsoleLogger('ERROR');

    // Create scope registry and register the personal-space:close_actors scope
    scopeRegistry = new ScopeRegistry();
    scopeRegistry.initialize(
      addMockAstsToScopes({
        'personal-space:close_actors': {
          expr: 'actor.components.personal-space-states:closeness.partners[]',
          definition:
            'personal-space:close_actors := actor.components.personal-space-states:closeness.partners[]',
          modId: 'positioning',
        },
      })
    );

    // Create scope engine
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  describe('Basic functionality', () => {
    it('should resolve actors in closeness circle', () => {
      // Create test actors
      entityManager = new SimpleEntityManager([
        {
          id: 'test-actor-1',
          components: {
            'core:actor': { name: 'Actor 1' },
            'personal-space-states:closeness': {
              partners: ['test-actor-2', 'test-actor-3'],
            },
          },
        },
        {
          id: 'test-actor-2',
          components: {
            'core:actor': { name: 'Actor 2' },
            'personal-space-states:closeness': {
              partners: ['test-actor-1', 'test-actor-3'],
            },
          },
        },
        {
          id: 'test-actor-3',
          components: {
            'core:actor': { name: 'Actor 3' },
            'personal-space-states:closeness': {
              partners: ['test-actor-1', 'test-actor-2'],
            },
          },
        },
      ]);

      const actor1 = entityManager.getEntityInstance('test-actor-1');
      jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
      };

      // Parse the scope expression
      const scopeDef = scopeRegistry.getScope('personal-space:close_actors');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());

      const result = scopeEngine.resolve(ast, actor1, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('test-actor-2')).toBe(true);
      expect(result.has('test-actor-3')).toBe(true);
    });

    it('should return empty set when no actors in closeness', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'lone-actor',
          components: {
            'core:actor': { name: 'Lone Actor' },
            'personal-space-states:closeness': { partners: [] },
          },
        },
      ]);

      const loneActor = entityManager.getEntityInstance('lone-actor');
      jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
      };

      const scopeDef = scopeRegistry.getScope('personal-space:close_actors');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());

      const result = scopeEngine.resolve(ast, loneActor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should handle missing closeness component gracefully', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'no-closeness',
          components: {
            'core:actor': { name: 'No Closeness' },
          },
        },
      ]);

      const actorWithoutCloseness =
        entityManager.getEntityInstance('no-closeness');
      jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
      };

      const scopeDef = scopeRegistry.getScope('personal-space:close_actors');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());

      const result = scopeEngine.resolve(
        ast,
        actorWithoutCloseness,
        runtimeCtx
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('Integration with other scopes', () => {
    it('should work with facing_away scope filtering', () => {
      // Create actors with both closeness and facing_away components
      entityManager = new SimpleEntityManager([
        {
          id: 'main-actor',
          components: {
            'core:actor': { name: 'Main Actor' },
            'personal-space-states:closeness': {
              partners: ['close-1', 'close-2', 'close-3'],
            },
            'positioning:facing_away': {
              facing_away_from: ['close-2'],
            },
          },
        },
        {
          id: 'close-1',
          components: {
            'core:actor': { name: 'Close 1' },
            'personal-space-states:closeness': {
              partners: ['main-actor'],
            },
          },
        },
        {
          id: 'close-2',
          components: {
            'core:actor': { name: 'Close 2' },
            'personal-space-states:closeness': {
              partners: ['main-actor'],
            },
          },
        },
        {
          id: 'close-3',
          components: {
            'core:actor': { name: 'Close 3' },
            'personal-space-states:closeness': {
              partners: ['main-actor'],
            },
          },
        },
      ]);

      const mainActor = entityManager.getEntityInstance('main-actor');
      jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
      };

      // Get all close actors
      const scopeDef = scopeRegistry.getScope('personal-space:close_actors');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());

      const result = scopeEngine.resolve(ast, mainActor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('close-1')).toBe(true);
      expect(result.has('close-2')).toBe(true);
      expect(result.has('close-3')).toBe(true);

      // Note: positioning:actors_im_facing_away_from scope would need to be registered
      // separately for a complete test. For now, we're just testing
      // the close_actors scope.
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large closeness circles efficiently', () => {
      const numActors = 20;
      const actorIds = [];
      const entities = [];

      // Create main actor
      for (let i = 1; i <= numActors; i++) {
        actorIds.push(`actor-${i}`);
      }

      entities.push({
        id: 'main',
        components: {
          'core:actor': { name: 'Main' },
          'personal-space-states:closeness': { partners: actorIds },
        },
      });

      // Create all other actors
      for (const id of actorIds) {
        entities.push({
          id,
          components: {
            'core:actor': { name: id },
            'personal-space-states:closeness': { partners: ['main'] },
          },
        });
      }

      entityManager = new SimpleEntityManager(entities);
      const mainActor = entityManager.getEntityInstance('main');
      jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
      };

      const scopeDef = scopeRegistry.getScope('personal-space:close_actors');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());

      const startTime = Date.now();
      const result = scopeEngine.resolve(ast, mainActor, runtimeCtx);
      const elapsed = Date.now() - startTime;

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(numActors);
      expect(elapsed).toBeLessThan(100); // Should resolve quickly
    });

    it('should handle circular references correctly', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'circular-1',
          components: {
            'core:actor': { name: 'Circular 1' },
            'personal-space-states:closeness': {
              partners: ['circular-2'],
            },
          },
        },
        {
          id: 'circular-2',
          components: {
            'core:actor': { name: 'Circular 2' },
            'personal-space-states:closeness': {
              partners: ['circular-1'],
            },
          },
        },
      ]);

      const actor1 = entityManager.getEntityInstance('circular-1');
      const actor2 = entityManager.getEntityInstance('circular-2');
      jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
      };

      const scopeDef = scopeRegistry.getScope('personal-space:close_actors');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());

      const result1 = scopeEngine.resolve(ast, actor1, runtimeCtx);
      const result2 = scopeEngine.resolve(ast, actor2, runtimeCtx);

      expect(result1).toBeInstanceOf(Set);
      expect(result1.size).toBe(1);
      expect(result1.has('circular-2')).toBe(true);

      expect(result2).toBeInstanceOf(Set);
      expect(result2.size).toBe(1);
      expect(result2.has('circular-1')).toBe(true);
    });
  });
});
