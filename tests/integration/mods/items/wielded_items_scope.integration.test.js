/**
 * @jest-environment node
 * @file Integration tests for items:wielded_items scope
 * @description Tests the scope that returns entity IDs of items currently being wielded
 *
 * The scope:
 * - Accesses actor's item-handling-states:wielding component
 * - Returns wielded_item_ids array via [] iterator
 * @see data/mods/items/scopes/wielded_items.scope
 * @see tickets/UNWITEACT-001-create-scope-file.md
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';

describe('items:wielded_items scope', () => {
  let scopeEngine;
  let scopeRegistry;
  let mockLogger;
  let mockEntityManager;

  const createEntityInstance = (id, components) => ({
    id,
    components: components || {},
  });

  const normalizeScopeResults = (resultSet) => {
    return Array.from(resultSet)
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && typeof entry.id === 'string')
          return entry.id;
        return null;
      })
      .filter((id) => typeof id === 'string' && id.length > 0);
  };

  beforeEach(() => {
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const entities = new Map();

    mockEntityManager = {
      getComponentData: (entityId, componentId) => {
        const entity = entities.get(entityId);
        if (entity && entity.components) {
          return entity.components[componentId] || null;
        }
        return null;
      },
      getEntityInstance: (entityId) => entities.get(entityId) || null,
      _addEntity: (entity) => entities.set(entity.id, entity),
      _clear: () => entities.clear(),
    };

    scopeRegistry = new ScopeRegistry();

    const wieldedItemsScope = readFileSync(
      new URL(
        '../../../../data/mods/items/scopes/wielded_items.scope',
        import.meta.url
      ),
      'utf8'
    ).trim();

    const scopeDefinitions = {
      'items:wielded_items': wieldedItemsScope,
    };

    const parsedScopes = {};
    for (const [scopeId, definition] of Object.entries(scopeDefinitions)) {
      const [modId] = scopeId.split(':');
      const expr = definition.split(':=')[1].trim();
      parsedScopes[scopeId] = {
        expr,
        definition,
        modId: modId || 'core',
        ast: parseDslExpression(expr),
      };
    }

    scopeRegistry.initialize(parsedScopes);

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger: mockLogger,
    });
  });

  describe('Basic Functionality', () => {
    test('should return wielded item IDs when actor has wielding component', () => {
      const sword = createEntityInstance('weapons:iron_sword', {
        'weapons:weapon': { damage: 10 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'item-handling-states:wielding': {
          wielded_item_ids: ['weapons:iron_sword'],
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('weapons:iron_sword');
      expect(normalized).toHaveLength(1);
    });

    test('should return multiple wielded item IDs', () => {
      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Dual Wielder' },
        'item-handling-states:wielding': {
          wielded_item_ids: ['weapons:iron_sword', 'weapons:dagger'],
        },
      });

      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toHaveLength(2);
      expect(normalized).toContain('weapons:iron_sword');
      expect(normalized).toContain('weapons:dagger');
    });

    test('should return empty set when wielded_item_ids is empty array', () => {
      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Unarmed Actor' },
        'item-handling-states:wielding': {
          wielded_item_ids: [],
        },
      });

      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should return empty set when actor has no wielding component', () => {
      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Unarmed Actor' },
        // No item-handling-states:wielding component
      });

      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should preserve order of wielded items (primary/secondary)', () => {
      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Sword and Shield' },
        'item-handling-states:wielding': {
          wielded_item_ids: ['weapons:longsword', 'weapons:shield'],
        },
      });

      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toHaveLength(2);
      // Order is preserved (first item = primary)
      expect(normalized[0]).toBe('weapons:longsword');
      expect(normalized[1]).toBe('weapons:shield');
    });
  });

  describe('Integration with unwield_item action', () => {
    test('scope returns valid targets for unwielding', () => {
      // Scenario: Actor is wielding a sword and shield
      // The scope should return both as valid targets for unwield_item
      const actor = createEntityInstance('warrior-1', {
        'core:actor': { name: 'Warrior' },
        'item-handling-states:wielding': {
          wielded_item_ids: ['weapons:iron_sword', 'weapons:round_shield'],
        },
      });

      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toHaveLength(2);
      // Both items can be unwielded
      expect(normalized).toContain('weapons:iron_sword');
      expect(normalized).toContain('weapons:round_shield');
    });

    test('scope returns empty when nothing is wielded (no action available)', () => {
      // Scenario: Actor has no wielded items
      // The scope should return empty, meaning unwield_item action shouldn't appear
      const actor = createEntityInstance('unarmed-actor', {
        'core:actor': { name: 'Unarmed' },
        // No item-handling-states:wielding component
      });

      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };

      const scopeDef = scopeRegistry.getScope('items:wielded_items');
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result.size).toBe(0);
    });
  });
});
