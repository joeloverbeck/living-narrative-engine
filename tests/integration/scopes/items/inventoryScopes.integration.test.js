/**
 * @file Integration tests for items inventory scopes
 * @description Tests the actor_inventory_items and close_actors_with_inventory scopes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';


describe('Items - Inventory Scopes Integration', () => {
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
    const scopeDefinitions = {
      'items:actor_inventory_items':
        'items:actor_inventory_items := actor.components.items:inventory.items[]',
      'positioning:close_actors':
        'positioning:close_actors := actor.components.positioning:closeness.partners[]',
      'items:close_actors_with_inventory':
        'items:close_actors_with_inventory := positioning:close_actors[{"!!": {"var": "entity.components.items:inventory"}}]',
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
    it('should return all items from actor inventory', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Test Actor' },
            'items:inventory': {
              items: ['item-1', 'item-2', 'item-3'],
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

      const scopeDef = scopeRegistry.getScope('items:actor_inventory_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('item-1')).toBe(true);
      expect(result.has('item-2')).toBe(true);
      expect(result.has('item-3')).toBe(true);
    });

    it('should return empty array when inventory is empty', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Test Actor' },
            'items:inventory': {
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

      const scopeDef = scopeRegistry.getScope('items:actor_inventory_items');
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

      const scopeDef = scopeRegistry.getScope('items:actor_inventory_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('close_actors_with_inventory scope', () => {
    it('should return only nearby actors with inventory', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            'positioning:closeness': {
              partners: ['test:actor2', 'test:actor3', 'test:actor4'],
            },
          },
        },
        {
          id: 'test:actor2',
          components: {
            'core:actor': { name: 'Actor 2' },
            'items:inventory': {
              items: [],
              capacity: { maxWeight: 50, maxItems: 10 },
            },
          },
        },
        {
          id: 'test:actor3',
          components: {
            'core:actor': { name: 'Actor 3' },
            'items:inventory': {
              items: [],
              capacity: { maxWeight: 30, maxItems: 5 },
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

      const actor = entityManager.getEntityInstance('test:actor1');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
      };

      const scopeDef = scopeRegistry.getScope(
        'items:close_actors_with_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has('test:actor2')).toBe(true);
      expect(result.has('test:actor3')).toBe(true);
      expect(result.has('test:actor4')).toBe(false);
    });

    it('should not include actors not in closeness circle', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            'positioning:closeness': {
              partners: ['test:actor2'],
            },
          },
        },
        {
          id: 'test:actor2',
          components: {
            'core:actor': { name: 'Actor 2' },
            'items:inventory': {
              items: [],
              capacity: { maxWeight: 50, maxItems: 10 },
            },
          },
        },
        {
          id: 'test:actor3',
          components: {
            'core:actor': { name: 'Actor 3' },
            'items:inventory': {
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

      const scopeDef = scopeRegistry.getScope(
        'items:close_actors_with_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('test:actor2')).toBe(true);
      expect(result.has('test:actor3')).toBe(false);
    });

    it('should return empty set when no closeness partners exist', () => {
      entityManager = new SimpleEntityManager([
        {
          id: 'test:actor1',
          components: {
            'core:actor': { name: 'Actor 1' },
            'positioning:closeness': {
              partners: [],
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

      const scopeDef = scopeRegistry.getScope(
        'items:close_actors_with_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});
