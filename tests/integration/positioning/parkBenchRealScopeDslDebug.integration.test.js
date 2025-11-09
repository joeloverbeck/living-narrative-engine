/**
 * @file Integration test to debug park bench scope resolution using real Scope DSL engine
 * This test reproduces the runtime behavior by manually creating entities and using
 * the real Scope DSL engine instead of the mock resolver used in other tests.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('Park Bench Real Scope DSL Debug', () => {
  let entityManager;
  let scopeEngine;
  let scopeRegistry;
  let logger;
  let dataRegistry;
  let jsonLogicEval;

  beforeEach(async () => {
    logger = createMockLogger();
    dataRegistry = new InMemoryDataRegistry({ logger });

    // Create real entity manager (not mock)
    entityManager = new SimpleEntityManager([]);

    // Initialize JSON Logic evaluator
    jsonLogicEval = new JsonLogicEvaluationService({ logger });

    // Create and initialize scope registry
    scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.clear();

    // Create the AST manually to ensure null is preserved correctly
    const availableFurnitureAST = {
      type: 'Filter',
      logic: {
        and: [
          {
            '==': [
              { var: 'entity.components.core:position.locationId' },
              { var: 'actor.components.core:position.locationId' },
            ],
          },
          {
            some: [
              { var: 'entity.components.positioning:allows_sitting.spots' },
              { '==': [{ var: '' }, null] }, // Actual null, not string "null"
            ],
          },
        ],
      },
      parent: {
        type: 'ArrayIterationStep',
        parent: {
          type: 'Source',
          kind: 'entities',
          param: 'positioning:allows_sitting',
        },
      },
    };

    scopeRegistry.initialize({
      'positioning:available_furniture': {
        expr: 'entities(positioning:allows_sitting)[][filter]', // Simplified expression for reference
        ast: availableFurnitureAST,
      },
    });

    // Create real scope engine with scope registry
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      errorHandler: null,
    });
  });

  afterEach(() => {
    entityManager?.cleanup?.();
  });

  describe('Entity Setup and Component Query Testing', () => {
    it('should create park bench entity and verify component queries', async () => {
      // Manually create park bench entity like runtime does
      const parkBenchId = 'p_erotica:park_bench_instance';

      // Create park bench entity first, then add components
      entityManager.createEntity(parkBenchId);
      await entityManager.addComponent(parkBenchId, 'core:position', {
        locationId: 'p_erotica:park_instance',
      });
      await entityManager.addComponent(
        parkBenchId,
        'positioning:allows_sitting',
        {
          spots: [null, null],
        }
      );

      // Also create actor entity in same location
      const actorId = 'p_erotica:ane_arrieta_instance';
      entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, 'core:actor', {
        name: 'Ane Arrieta',
      });
      await entityManager.addComponent(actorId, 'core:position', {
        locationId: 'p_erotica:park_instance',
      });

      logger.info('[TEST] Entities created, verifying component queries...');

      // Verify park bench entity was created (check if it exists in entities Map)
      const entityInstance = entityManager.getEntityInstance(parkBenchId);
      expect(entityInstance).toBeDefined();
      expect(entityInstance.id).toBe(parkBenchId);

      // Check for positioning:allows_sitting component
      const hasAllowsSitting = entityManager.hasComponent(
        parkBenchId,
        'positioning:allows_sitting'
      );
      expect(hasAllowsSitting).toBe(true);

      // This should trigger our enhanced logging
      logger.info(
        '[TEST] Calling EntityManager.getEntitiesWithComponent for positioning:allows_sitting...'
      );
      const entitiesWithSitting = entityManager.getEntitiesWithComponent(
        'positioning:allows_sitting'
      );

      logger.info(
        `[TEST] EntityManager returned ${entitiesWithSitting?.length || 0} entities with positioning:allows_sitting`
      );

      expect(entitiesWithSitting).toBeDefined();
      expect(Array.isArray(entitiesWithSitting)).toBe(true);
      expect(entitiesWithSitting.length).toBeGreaterThan(0);

      // Should contain the park bench
      const parkBenchEntity = entitiesWithSitting.find(
        (entity) => entity.id === parkBenchId
      );
      expect(parkBenchEntity).toBeDefined();
    });
  });

  describe('Real Scope DSL Engine Testing', () => {
    it('should resolve positioning:available_furniture scope using real Scope DSL engine', async () => {
      // Create entities first
      const parkBenchId = 'p_erotica:park_bench_instance';
      const actorId = 'p_erotica:ane_arrieta_instance';

      // Create park bench entity
      entityManager.createEntity(parkBenchId);
      await entityManager.addComponent(parkBenchId, 'core:position', {
        locationId: 'p_erotica:park_instance',
      });
      await entityManager.addComponent(
        parkBenchId,
        'positioning:allows_sitting',
        {
          spots: [null, null],
        }
      );

      // Create actor entity in same location
      entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, 'core:actor', {
        name: 'Ane Arrieta',
      });
      await entityManager.addComponent(actorId, 'core:position', {
        locationId: 'p_erotica:park_instance',
      });

      // Get fresh entity instance with all components properly initialized
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Verify the actor entity has the expected structure
      expect(actorEntity).toBeDefined();
      expect(actorEntity.hasComponent('core:position')).toBe(true);
      expect(actorEntity.getComponentData('core:position')).toEqual({
        locationId: 'p_erotica:park_instance',
      });

      logger.info(
        '[TEST] Resolving positioning:available_furniture scope using real Scope DSL engine...'
      );

      // Verify entities are there before resolution
      const parkBenchCheck = entityManager.getEntityInstance(parkBenchId);
      expect(parkBenchCheck).toBeDefined();
      expect(parkBenchCheck.hasComponent('core:position')).toBe(true);
      expect(parkBenchCheck.hasComponent('positioning:allows_sitting')).toBe(
        true
      );

      // Create runtime context (this is what the real scope DSL engine needs)
      const runtimeCtx = {
        entityManager,
        jsonLogicEval, // Add JSON Logic evaluator for filter evaluation
        logger, // Add logger for diagnostics
        location: { id: 'p_erotica:park_instance' }, // Add current location for scope resolution
      };

      // Parse the scope reference and resolve using real Scope DSL engine
      const scopeRefAST = {
        type: 'ScopeReference',
        scopeId: 'positioning:available_furniture',
      };
      const scopeResult = await scopeEngine.resolve(
        scopeRefAST,
        actorEntity,
        runtimeCtx,
        null // trace is optional
      );

      logger.info('[TEST] Real Scope DSL engine result:', {
        resultSize: scopeResult?.size || 0,
        resultItems: scopeResult ? Array.from(scopeResult) : [],
      });

      // This should find the park bench
      expect(scopeResult).toBeDefined();
      expect(scopeResult instanceof Set).toBe(true);
      expect(scopeResult.size).toBeGreaterThan(0);
      expect(scopeResult.has(parkBenchId)).toBe(true);
    });

    it('should resolve entities(positioning:allows_sitting) source directly', async () => {
      // Create entities first
      const parkBenchId = 'p_erotica:park_bench_instance';
      const actorId = 'p_erotica:ane_arrieta_instance';

      // Create park bench entity
      entityManager.createEntity(parkBenchId);
      await entityManager.addComponent(
        parkBenchId,
        'positioning:allows_sitting',
        {
          spots: [null, null],
        }
      );

      // Create actor entity
      entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, 'core:actor', {
        name: 'Ane Arrieta',
      });
      const actorEntity = entityManager.getEntityInstance(actorId);

      // Create runtime context
      const runtimeCtx = {
        entityManager,
        jsonLogicEval, // Add JSON Logic evaluator for filter evaluation
        logger, // Add logger for diagnostics
        location: { id: 'p_erotica:park_instance' }, // Add current location for scope resolution
      };

      logger.info(
        '[TEST] Testing entities(positioning:allows_sitting) source resolution...'
      );

      // Parse and test the source resolution directly using scope engine
      const sourceAST = parseDslExpression(
        'entities(positioning:allows_sitting)'
      );
      const sourceResult = await scopeEngine.resolve(
        sourceAST,
        actorEntity,
        runtimeCtx,
        null // trace is optional
      );

      logger.info('[TEST] Direct source resolution result:', {
        resultSize: sourceResult?.size || 0,
        resultItems: sourceResult ? Array.from(sourceResult) : [],
      });

      expect(sourceResult).toBeDefined();
      expect(sourceResult instanceof Set).toBe(true);
      expect(sourceResult.size).toBeGreaterThan(0);
      expect(sourceResult.has(parkBenchId)).toBe(true);
    });
  });
});
