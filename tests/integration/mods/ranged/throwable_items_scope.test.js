/**
 * @file Integration tests for ranged:throwable_items scope
 * @description Tests the throwable_items scope that unions wielded items and inventory items filtered by items:portable
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { JsonLogicCustomOperators } from '../../../../src/logic/jsonLogicCustomOperators.js';

describe('ranged:throwable_items scope', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;
  let jsonLogicCustomOperators;
  let warnSpy;

  /**
   * Normalizes scope results to an array of entity IDs
   * @param {Set} resultSet - The Set returned by scope resolution
   * @returns {string[]} - Array of entity IDs
   */
  const normalizeScopeResults = (resultSet) => {
    const normalizedValues = Array.from(resultSet)
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object') {
          if (typeof entry.id === 'string' && entry.id.trim()) {
            return entry.id.trim();
          }
          if (typeof entry.itemId === 'string' && entry.itemId.trim()) {
            return entry.itemId.trim();
          }
        }
        return null;
      })
      .filter((id) => typeof id === 'string' && id.length > 0);

    return Array.from(new Set(normalizedValues));
  };

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    // Spy on logger.warn to detect has_component warnings
    warnSpy = jest.spyOn(logger, 'warn');

    // Mock GameDataRepository
    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    scopeRegistry = new ScopeRegistry();

    // Read the actual throwable_items scope file
    const throwableItemsScope = readFileSync(
      new URL(
        '../../../../data/mods/ranged/scopes/throwable_items.scope',
        import.meta.url
      ),
      'utf8'
    ).trim();

    const scopeDefinitions = {
      'ranged:throwable_items': throwableItemsScope,
    };

    const parsedScopes = {};
    for (const [scopeId, definition] of Object.entries(scopeDefinitions)) {
      const [modId] = scopeId.split(':');
      const expr = definition.split(':=')[1].trim();
      parsedScopes[scopeId] = {
        expr,
        definition,
        modId: modId || 'ranged',
        ast: parseDslExpression(expr),
      };
    }

    scopeRegistry.initialize(parsedScopes);

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  /**
   * Helper to set up entity manager with custom operators
   * @param {Array} entities - Entities to add to the manager
   * @returns {object} - Runtime context with entityManager and jsonLogicEval
   */
  const setupRuntimeContext = (entities) => {
    entityManager = new SimpleEntityManager(entities);

    // Register custom operators with the entityManager
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      entityManager,
      bodyGraphService: {
        hasPartWithComponentValue: jest.fn(),
        findPartsByType: jest.fn(),
        getAllParts: jest.fn(),
        buildAdjacencyCache: jest.fn(),
      },
      lightingStateService: {
        isLocationLit: jest.fn().mockReturnValue(true),
      },
    });
    jsonLogicCustomOperators.registerOperators(jsonLogicEval);

    return {
      entityManager,
      logger,
      jsonLogicEval,
    };
  };

  describe('scope resolution without warnings', () => {
    it('should resolve without has_component warnings when actor has portable items in inventory', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            'items:inventory': { items: ['rock-001', 'dagger-001'] },
          },
        },
        {
          id: 'rock-001',
          components: {
            'core:name': { value: 'Small Rock' },
            'items:portable': { weight: 1.0 },
          },
        },
        {
          id: 'dagger-001',
          components: {
            'core:name': { value: 'Rusty Dagger' },
            'items:portable': { weight: 0.5 },
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      // Should NOT log any warnings about invalid componentId
      const hasComponentWarnings = warnSpy.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('Invalid componentId')
      );
      expect(hasComponentWarnings).toHaveLength(0);

      // Should return the portable items
      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('rock-001');
      expect(normalized).toContain('dagger-001');
    });

    it('should resolve without warnings when actor has wielded portable items', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            'item-handling-states:wielding': { wielded_item_ids: ['sword-001'] },
            'items:inventory': { items: [] },
          },
        },
        {
          id: 'sword-001',
          components: {
            'core:name': { value: 'Iron Sword' },
            'items:portable': { weight: 3.0 },
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      // Should NOT log any warnings
      const hasComponentWarnings = warnSpy.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('Invalid componentId')
      );
      expect(hasComponentWarnings).toHaveLength(0);

      // Should return the wielded item
      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('sword-001');
    });

    it('should resolve without warnings when actor has both wielded and inventory items', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            'item-handling-states:wielding': { wielded_item_ids: ['sword-001'] },
            'items:inventory': { items: ['rock-001'] },
          },
        },
        {
          id: 'sword-001',
          components: {
            'core:name': { value: 'Iron Sword' },
            'items:portable': { weight: 3.0 },
          },
        },
        {
          id: 'rock-001',
          components: {
            'core:name': { value: 'Small Rock' },
            'items:portable': { weight: 1.0 },
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      // Should NOT log any warnings
      const hasComponentWarnings = warnSpy.mock.calls.filter(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('Invalid componentId')
      );
      expect(hasComponentWarnings).toHaveLength(0);

      // Should return both items (union of wielded and inventory)
      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toHaveLength(2);
      expect(normalized).toContain('sword-001');
      expect(normalized).toContain('rock-001');
    });
  });

  describe('filtering behavior', () => {
    it('should only return items with items:portable component', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            'items:inventory': {
              items: ['rock-001', 'immovable-001'],
            },
          },
        },
        {
          id: 'rock-001',
          components: {
            'core:name': { value: 'Small Rock' },
            'items:portable': { weight: 1.0 },
          },
        },
        {
          id: 'immovable-001',
          components: {
            'core:name': { value: 'Heavy Statue' },
            // No items:portable component - should be filtered out
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);

      // Should only contain the portable item
      expect(normalized).toContain('rock-001');
      expect(normalized).not.toContain('immovable-001');
    });

    it('should return empty set when no portable items exist', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            'items:inventory': { items: ['immovable-001'] },
          },
        },
        {
          id: 'immovable-001',
          components: {
            'core:name': { value: 'Heavy Statue' },
            // No items:portable component
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty set when actor has no inventory or wielded items', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Unarmed' },
            'items:inventory': { items: [] },
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle missing wielding component gracefully', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            // No item-handling-states:wielding component
            'items:inventory': { items: ['rock-001'] },
          },
        },
        {
          id: 'rock-001',
          components: {
            'core:name': { value: 'Small Rock' },
            'items:portable': { weight: 1.0 },
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      // Should still return inventory items without errors
      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('rock-001');
    });

    it('should handle missing inventory component gracefully', () => {
      setupRuntimeContext([
        {
          id: 'test:actor',
          components: {
            'core:actor': { name: 'Thrower' },
            'item-handling-states:wielding': { wielded_item_ids: ['sword-001'] },
            // No items:inventory component
          },
        },
        {
          id: 'sword-001',
          components: {
            'core:name': { value: 'Iron Sword' },
            'items:portable': { weight: 3.0 },
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

      const scopeDef = scopeRegistry.getScope('ranged:throwable_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      // Should still return wielded items without errors
      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('sword-001');
    });
  });
});
