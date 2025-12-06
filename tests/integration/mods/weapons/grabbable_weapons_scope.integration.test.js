/**
 * @jest-environment node
 * @file Integration tests for weapons:grabbable_weapons_in_inventory scope
 * @description Tests the scope that filters weapons by hand availability and held status
 *
 * The scope uses:
 * - canActorGrabItem operator (from WEAHANREQFIL-001)
 * - isItemBeingGrabbed operator (from WEAHANREQFIL-002)
 * @see data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope
 * @see tickets/WEAHANREQFIL-004-create-scope-and-update-manifest.md
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../../../src/logic/jsonLogicCustomOperators.js';

// Mock grabbingUtils to control test behavior
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
  getHeldItems: jest.fn(),
}));

describe('weapons:grabbable_weapons_in_inventory scope', () => {
  let scopeEngine;
  let scopeRegistry;
  let jsonLogicService;
  let customOperators;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockGameDataRepository;
  let mockCountFreeGrabbingAppendages;
  let mockGetHeldItems;

  // Helper to create entity instances with components
  const createEntityInstance = (id, components) => ({
    id,
    components: components || {},
  });

  // Helper to normalize scope results to an array of entity IDs
  const normalizeScopeResults = (resultSet) => {
    return Array.from(resultSet)
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          if (typeof entry.id === 'string') return entry.id;
          if (typeof entry.itemId === 'string') return entry.itemId;
        }
        return null;
      })
      .filter((id) => typeof id === 'string' && id.length > 0);
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import mocked functions
    const grabbingUtils = await import(
      '../../../../src/utils/grabbingUtils.js'
    );
    mockCountFreeGrabbingAppendages = grabbingUtils.countFreeGrabbingAppendages;
    mockGetHeldItems = grabbingUtils.getHeldItems;

    // Default: no items being held
    mockGetHeldItems.mockReturnValue([]);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    // Track entities and their components
    const entities = new Map();

    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        const entity = entities.get(entityId);
        if (entity && entity.components) {
          return entity.components[componentId] || null;
        }
        return null;
      }),
      getEntityInstance: jest.fn((entityId) => {
        return entities.get(entityId) || null;
      }),
      // Helper to add entities for testing
      _addEntity: (entity) => {
        entities.set(entity.id, entity);
      },
      _clear: () => {
        entities.clear();
      },
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(() => null),
    };

    // Create services with custom operators
    jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
      gameDataRepository: mockGameDataRepository,
    });

    customOperators = new JsonLogicCustomOperators({
      logger: mockLogger,
      bodyGraphService: mockBodyGraphService,
      entityManager: mockEntityManager,
    });

    // Register custom operators (includes canActorGrabItem and isItemBeingGrabbed)
    customOperators.registerOperators(jsonLogicService);

    // Set up scope registry with actual scope file
    scopeRegistry = new ScopeRegistry();

    const grabbableWeaponsScope = readFileSync(
      new URL(
        '../../../../data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope',
        import.meta.url
      ),
      'utf8'
    ).trim();

    const scopeDefinitions = {
      'weapons:grabbable_weapons_in_inventory': grabbableWeaponsScope,
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

  describe('Basic Filtering', () => {
    test('should return weapons when actor has enough free hands', () => {
      // Actor with 2 free hands
      mockCountFreeGrabbingAppendages.mockReturnValue(2);
      mockGetHeldItems.mockReturnValue([]);

      const sword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['sword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('sword-1');
    });

    test('should exclude weapons requiring more hands than actor has free', () => {
      // Actor with only 1 free hand
      mockCountFreeGrabbingAppendages.mockReturnValue(1);
      mockGetHeldItems.mockReturnValue([]);

      const twoHandedSword = createEntityInstance('longsword-1', {
        'weapons:weapon': { damage: 20 },
        'anatomy:requires_grabbing': { handsRequired: 2 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['longsword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(twoHandedSword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).not.toContain('longsword-1');
    });

    test('should exclude weapons already being held', () => {
      // Actor has 2 free hands but sword is already held
      mockCountFreeGrabbingAppendages.mockReturnValue(2);
      mockGetHeldItems.mockReturnValue([
        { itemId: 'sword-1', appendageId: 'right-hand' },
      ]);

      const sword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['sword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).not.toContain('sword-1');
    });

    test('should return empty array when no weapons are grabbable', () => {
      // Actor has 0 free hands
      mockCountFreeGrabbingAppendages.mockReturnValue(0);
      mockGetHeldItems.mockReturnValue([]);

      const sword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['sword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should default to 1 hand for weapons without anatomy:requires_grabbing', () => {
      // Actor with 1 free hand - should be able to grab weapons that default to 1 hand
      mockCountFreeGrabbingAppendages.mockReturnValue(1);
      mockGetHeldItems.mockReturnValue([]);

      // Weapon without requires_grabbing component
      const dagger = createEntityInstance('dagger-1', {
        'weapons:weapon': { damage: 5 },
        // No anatomy:requires_grabbing - should default to 1 hand
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['dagger-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(dagger);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('dagger-1');
    });

    test('should include weapons with handsRequired: 0 (rings, etc.)', () => {
      // Actor with 0 free hands - should still be able to use items requiring 0 hands
      mockCountFreeGrabbingAppendages.mockReturnValue(0);
      mockGetHeldItems.mockReturnValue([]);

      const ring = createEntityInstance('ring-1', {
        'weapons:weapon': { damage: 1 },
        'anatomy:requires_grabbing': { handsRequired: 0 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['ring-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(ring);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('ring-1');
    });

    test('should return empty array when actor has no anatomy:body', () => {
      // countFreeGrabbingAppendages returns 0 when no body component
      mockCountFreeGrabbingAppendages.mockReturnValue(0);
      mockGetHeldItems.mockReturnValue([]);

      const sword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      // Actor without anatomy:body
      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Bodiless Actor' },
        'items:inventory': {
          items: ['sword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        // No anatomy:body
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    test('should handle actor with multiple grabbing appendages', () => {
      // Actor with 4 free hands (like a four-armed creature)
      mockCountFreeGrabbingAppendages.mockReturnValue(4);
      mockGetHeldItems.mockReturnValue([]);

      const twoHandedSword = createEntityInstance('longsword-1', {
        'weapons:weapon': { damage: 20 },
        'anatomy:requires_grabbing': { handsRequired: 2 },
      });

      const oneHandedSword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Four-Armed Warrior' },
        'items:inventory': {
          items: ['longsword-1', 'sword-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(twoHandedSword);
      mockEntityManager._addEntity(oneHandedSword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      expect(result).toBeInstanceOf(Set);
      const normalized = normalizeScopeResults(result);
      expect(normalized).toHaveLength(2);
      expect(normalized).toContain('longsword-1');
      expect(normalized).toContain('sword-1');
    });
  });

  describe('Scenario Tests', () => {
    test('should show 1-hand sword when actor has 1 free hand', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(1);
      mockGetHeldItems.mockReturnValue([]);

      const sword = createEntityInstance('shortsword-1', {
        'weapons:weapon': { damage: 8 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const actor = createEntityInstance('warrior-1', {
        'core:actor': { name: 'Warrior' },
        'items:inventory': {
          items: ['shortsword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('shortsword-1');
    });

    test('should hide 2-hand sword when actor has 1 free hand', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(1);
      mockGetHeldItems.mockReturnValue([]);

      const greatsword = createEntityInstance('greatsword-1', {
        'weapons:weapon': { damage: 25 },
        'anatomy:requires_grabbing': { handsRequired: 2 },
      });

      const actor = createEntityInstance('warrior-1', {
        'core:actor': { name: 'Warrior' },
        'items:inventory': {
          items: ['greatsword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(greatsword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).not.toContain('greatsword-1');
    });

    test('should show 2-hand sword when actor has 2 free hands', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(2);
      mockGetHeldItems.mockReturnValue([]);

      const greatsword = createEntityInstance('greatsword-1', {
        'weapons:weapon': { damage: 25 },
        'anatomy:requires_grabbing': { handsRequired: 2 },
      });

      const actor = createEntityInstance('warrior-1', {
        'core:actor': { name: 'Warrior' },
        'items:inventory': {
          items: ['greatsword-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(greatsword);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('greatsword-1');
    });

    test('should hide weapon that actor is currently wielding', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(2);
      // Actor is holding sword-1
      mockGetHeldItems.mockReturnValue([
        { itemId: 'sword-1', appendageId: 'right-hand' },
      ]);

      const sword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const dagger = createEntityInstance('dagger-1', {
        'weapons:weapon': { damage: 5 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      const actor = createEntityInstance('warrior-1', {
        'core:actor': { name: 'Warrior' },
        'items:inventory': {
          items: ['sword-1', 'dagger-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);
      mockEntityManager._addEntity(dagger);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      // sword-1 is being held, so it should NOT appear
      expect(normalized).not.toContain('sword-1');
      // dagger-1 is not held and actor has hands free
      expect(normalized).toContain('dagger-1');
    });
  });

  describe('Non-weapon item filtering', () => {
    test('should exclude non-weapon items from results', () => {
      mockCountFreeGrabbingAppendages.mockReturnValue(2);
      mockGetHeldItems.mockReturnValue([]);

      const sword = createEntityInstance('sword-1', {
        'weapons:weapon': { damage: 10 },
        'anatomy:requires_grabbing': { handsRequired: 1 },
      });

      // Food item - no weapons:weapon component
      const apple = createEntityInstance('apple-1', {
        'items:item': { name: 'Apple' },
        'items:consumable': { nutrition: 5 },
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['sword-1', 'apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        },
      });

      mockEntityManager._addEntity(actor);
      mockEntityManager._addEntity(sword);
      mockEntityManager._addEntity(apple);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        jsonLogicEval: jsonLogicService,
      };

      const scopeDef = scopeRegistry.getScope(
        'weapons:grabbable_weapons_in_inventory'
      );
      const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
      const result = scopeEngine.resolve(ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('sword-1');
      expect(normalized).not.toContain('apple-1');
    });
  });
});
