/**
 * @file Integration test for sit_down action scope resolution
 * @description Tests that entities with positioning:allows_sitting component are properly discovered by scopes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { clearEntityCache } from '../../../src/scopeDsl/core/entityHelpers.js';

describe('Sit Down Scope Resolution - Integration', () => {
  let entityManager;
  let scopeEngine;
  let mockLogger;
  let jsonLogicEval;
  let registry;

  beforeEach(() => {
    // Clear any global entity cache to prevent test interference
    clearEntityCache();

    // Create logger with addLog method for trace support
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      addLog: jest.fn(),
    };

    // Create entity manager
    entityManager = new SimpleEntityManager();

    // Create data registry and JSON logic evaluator
    registry = new InMemoryDataRegistry({ logger: mockLogger });
    jsonLogicEval = new JsonLogicEvaluationService({ logger: mockLogger });

    // Register component definitions in the data registry
    registry.store('components', 'positioning:allows_sitting', {
      id: 'positioning:allows_sitting',
      dataSchema: {
        type: 'object',
        properties: {
          spots: {
            type: 'array',
            items: { type: ['null', 'string'] },
          },
        },
        required: ['spots'],
      },
    });

    registry.store('components', 'core:position', {
      id: 'core:position',
      dataSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
        },
        required: ['locationId'],
      },
    });

    registry.store('components', 'core:actor', {
      id: 'core:actor',
      dataSchema: {
        type: 'object',
        properties: {
          isPlayerControlled: { type: 'boolean' },
        },
      },
    });

    registry.store('components', 'core:name', {
      id: 'core:name',
      dataSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
    });

    // Create scope engine with no parameters (it will use runtime context)
    scopeEngine = new ScopeEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('positioning:available_furniture scope resolution', () => {
    it('should find park bench entity with allows_sitting component at same location', () => {
      // Create park bench entity using factory
      const parkBench = createEntityInstance({
        instanceId: 'test:park_bench_instance',
        definitionId: 'test:park_bench',
        baseComponents: {
          'core:name': { text: 'park bench' },
          'core:position': { locationId: 'test:park' },
          'positioning:allows_sitting': { spots: [null, null] },
        },
      });

      // Create actor entity using factory
      const actor = createEntityInstance({
        instanceId: 'test:actor_instance',
        definitionId: 'test:actor',
        baseComponents: {
          'core:name': { text: 'Test Actor' },
          'core:actor': { isPlayerControlled: false },
          'core:position': { locationId: 'test:park' },
        },
      });

      // Add entities to manager
      entityManager.addEntity(parkBench);
      entityManager.addEntity(actor);

      // Create runtime context
      const runtimeCtx = {
        entityManager: entityManager,
        registry: registry,
        jsonLogicEval: jsonLogicEval,
        logger: mockLogger,
      };

      // Parse the scope expression with filtering
      const scopeExpr = `entities(positioning:allows_sitting)[][{
        "and": [
          {
            "==": [
              {"var": "entity.components.core:position.locationId"},
              {"var": "actor.components.core:position.locationId"}
            ]
          },
          {
            "some": [
              {"var": "entity.components.positioning:allows_sitting.spots"},
              {"==": [{"var": ""}, null]}
            ]
          }
        ]
      }]`;

      const ast = parseDslExpression(scopeExpr);

      // Resolve the scope - convert actor Entity to plain object with components
      const actorForScope = {
        id: actor.id,
        components: actor.getAllComponents(),
      };

      const result = scopeEngine.resolve(ast, actorForScope, runtimeCtx);

      // Verify the park bench was found
      expect(result).toBeDefined();
      expect(result.size).toBe(1);
      expect(result.has('test:park_bench_instance')).toBe(true);

      // Additional verification: Check that getEntitiesWithComponent works
      const entitiesWithSitting = entityManager.getEntitiesWithComponent(
        'positioning:allows_sitting'
      );
      expect(entitiesWithSitting).toBeDefined();
      expect(entitiesWithSitting.length).toBe(1);
      expect(entitiesWithSitting[0].id).toBe('test:park_bench_instance');
    });

    it('should not find entities with allows_sitting at different locations', () => {
      // Create park bench at different location using factory
      const parkBench = createEntityInstance({
        instanceId: 'test:park_bench_instance',
        definitionId: 'test:park_bench',
        baseComponents: {
          'core:name': { text: 'park bench' },
          'core:position': { locationId: 'test:different_location' },
          'positioning:allows_sitting': { spots: [null, null] },
        },
      });

      // Create actor at park using factory
      const actor = createEntityInstance({
        instanceId: 'test:actor_instance',
        definitionId: 'test:actor',
        baseComponents: {
          'core:name': { text: 'Test Actor' },
          'core:actor': { isPlayerControlled: false },
          'core:position': { locationId: 'test:park' },
        },
      });

      // Add entities
      entityManager.addEntity(parkBench);
      entityManager.addEntity(actor);

      // Parse the scope expression
      const scopeExpr = `entities(positioning:allows_sitting)[][{
        "and": [
          {
            "==": [
              {"var": "entity.components.core:position.locationId"},
              {"var": "actor.components.core:position.locationId"}
            ]
          },
          {
            "some": [
              {"var": "entity.components.positioning:allows_sitting.spots"},
              {"==": [{"var": ""}, null]}
            ]
          }
        ]
      }]`;

      const ast = parseDslExpression(scopeExpr);

      // Resolve the scope - convert actor Entity to plain object with components
      const actorForScope = {
        id: actor.id,
        components: actor.getAllComponents(),
      };

      const result = scopeEngine.resolve(ast, actorForScope, {
        entityManager: entityManager,
        registry: registry,
        jsonLogicEval: jsonLogicEval,
        logger: mockLogger,
      });

      // Should find no entities since they're at different locations
      expect(result).toBeDefined();
      expect(result.size).toBe(0);
    });

    it('should find entities only with available spots', () => {
      // Create occupied bench (all spots taken) using factory
      const occupiedBench = createEntityInstance({
        instanceId: 'test:occupied_bench_instance',
        definitionId: 'test:occupied_bench',
        baseComponents: {
          'core:name': { text: 'occupied bench' },
          'core:position': { locationId: 'test:park' },
          'positioning:allows_sitting': {
            spots: ['occupant1', 'occupant2'], // All spots occupied
          },
        },
      });

      // Create available bench (has null spots) using factory
      const availableBench = createEntityInstance({
        instanceId: 'test:available_bench_instance',
        definitionId: 'test:available_bench',
        baseComponents: {
          'core:name': { text: 'available bench' },
          'core:position': { locationId: 'test:park' },
          'positioning:allows_sitting': {
            spots: [null, 'occupant1'], // One spot available
          },
        },
      });

      // Create actor using factory
      const actor = createEntityInstance({
        instanceId: 'test:actor_instance',
        definitionId: 'test:actor',
        baseComponents: {
          'core:name': { text: 'Test Actor' },
          'core:actor': { isPlayerControlled: false },
          'core:position': { locationId: 'test:park' },
        },
      });

      // Add entities
      entityManager.addEntity(occupiedBench);
      entityManager.addEntity(availableBench);
      entityManager.addEntity(actor);

      // Parse the scope expression
      const scopeExpr = `entities(positioning:allows_sitting)[][{
        "and": [
          {
            "==": [
              {"var": "entity.components.core:position.locationId"},
              {"var": "actor.components.core:position.locationId"}
            ]
          },
          {
            "some": [
              {"var": "entity.components.positioning:allows_sitting.spots"},
              {"==": [{"var": ""}, null]}
            ]
          }
        ]
      }]`;

      const ast = parseDslExpression(scopeExpr);

      // Resolve the scope - convert actor Entity to plain object with components
      const actorForScope = {
        id: actor.id,
        components: actor.getAllComponents(),
      };

      const result = scopeEngine.resolve(ast, actorForScope, {
        entityManager: entityManager,
        registry: registry,
        jsonLogicEval: jsonLogicEval,
        logger: mockLogger,
      });

      // Should find only the available bench
      expect(result).toBeDefined();
      expect(result.size).toBe(1);
      expect(result.has('test:available_bench_instance')).toBe(true);
      expect(result.has('test:occupied_bench_instance')).toBe(false);
    });
  });
});
