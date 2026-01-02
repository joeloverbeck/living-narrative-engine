/**
 * @file Integration tests for inventory scopes
 * @description Tests the actor_inventory_items scope
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('Inventory - Inventory Scopes Integration', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    // Mock GameDataRepository
    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    scopeRegistry = new ScopeRegistry();

    // Register scopes with proper AST parsing
    const actorInventoryScope = readFileSync(
      new URL(
        '../../../../data/mods/inventory/scopes/actor_inventory_items.scope',
        import.meta.url
      ),
      'utf8'
    ).trim();

    const scopeDefinitions = {
      'inventory:actor_inventory_items': actorInventoryScope,
    };

    const parsedScopes = {};
    for (const [scopeId, definition] of Object.entries(scopeDefinitions)) {
      const [, modId] = scopeId.split(':');
      const expr = definition.split(':=')[1].trim();
      parsedScopes[scopeId] = {
        expr,
        definition,
        modId: modId ? scopeId.split(':')[0] : 'core',
        ast: parseDslExpression(expr),
      };
    }

    scopeRegistry.initialize(parsedScopes);

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
    });
  });

  describe('actor_inventory_items scope', () => {
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

    it('should return all items from actor inventory', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Test Actor' },
            'inventory:inventory': {
              items: ['item-1', 'item-2', 'item-3'],
              capacity: { maxWeight: 50, maxItems: 10 },
            },
          },
        },
        {
          id: 'item-1',
          components: {
            'items-core:item': {},
          },
        },
        {
          id: 'item-2',
          components: {
            'items-core:item': {},
          },
        },
        {
          id: 'item-3',
          components: {
            'items-core:item': {},
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope('inventory:actor_inventory_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);

      expect(normalized).toHaveLength(3);
      expect(normalized).toEqual(
        expect.arrayContaining(['item-1', 'item-2', 'item-3'])
      );
    });

    it('should resolve item references stored as objects with itemId', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Test Actor' },
            'inventory:inventory': {
              items: [{ itemId: 'item-1' }, { itemId: 'item-2' }],
              capacity: { maxWeight: 50, maxItems: 10 },
            },
          },
        },
        {
          id: 'item-1',
          components: {
            'items-core:item': {},
          },
        },
        {
          id: 'item-2',
          components: {
            'items-core:item': {},
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope('inventory:actor_inventory_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);

      expect(normalized).toHaveLength(2);
      expect(normalized).toEqual(expect.arrayContaining(['item-1', 'item-2']));
    });

    it('should return empty array when inventory is empty', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Test Actor' },
            'inventory:inventory': {
              items: [],
              capacity: { maxWeight: 50, maxItems: 10 },
            },
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope('inventory:actor_inventory_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should handle missing inventory component gracefully', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Test Actor' },
          },
        },
      ]);

      const actor = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope('inventory:actor_inventory_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
