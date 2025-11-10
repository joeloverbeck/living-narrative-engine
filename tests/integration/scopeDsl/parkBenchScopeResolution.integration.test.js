/**
 * Integration test to reproduce and fix the park bench scope resolution issue
 *
 * The issue: A park bench entity with components split between definition and instance
 * is not being found by the scope 'positioning:available_furniture' during filtering.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('Park Bench Scope Resolution Integration', () => {
  let entityManager;
  let scopeEngine;
  let gateway;
  let mockLogger;
  let mockLocationProvider;
  let jsonLogicEval;

  beforeEach(() => {
    // Create real logger with addLog method for trace support
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      addLog: jest.fn(),
    };

    // Create JSON Logic evaluator
    jsonLogicEval = new JsonLogicEvaluationService({ logger: mockLogger });

    // Create entity manager
    entityManager = new SimpleEntityManager();

    // Create gateway manually like other integration tests
    gateway = {
      getEntityInstance: (id) => entityManager.getEntityInstance(id),
      getEntities: () => Array.from(entityManager.entities),
      getEntitiesWithComponent: (componentTypeId) => {
        // Use the SimpleEntityManager method which handles Entity instances properly
        return entityManager.getEntitiesWithComponent(componentTypeId);
      },
      hasComponent: (entityId, componentTypeId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity && entity.hasComponent && entity.hasComponent(componentTypeId)
        );
      },
      getComponentData: (entityId, componentTypeId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity &&
          entity.getComponentData &&
          entity.getComponentData(componentTypeId)
        );
      },
    };

    // Create location provider
    mockLocationProvider = {
      getLocation: () => ({ id: 'test:park_location' }),
    };

    // Create scope engine
    scopeEngine = new ScopeEngine({
      entitiesGateway: gateway,
      locationProvider: mockLocationProvider,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should find park bench with components from definition and instance override', async () => {
    // Arrange: Create park bench definition (has positioning:allows_sitting)
    const parkBenchDefinition = {
      id: 'test:park_bench',
      components: {
        'positioning:allows_sitting': {
          spots: [null, null],
        },
      },
    };

    // Arrange: Create park bench instance (adds core:position via override)
    const parkBenchInstance = {
      instanceId: 'test:park_bench_instance',
      definitionId: 'test:park_bench',
      componentOverrides: {
        'core:position': {
          locationId: 'test:park_location',
        },
      },
    };

    // Arrange: Create actor in same location
    const actorDefinition = {
      id: 'test:actor',
      components: {
        'core:position': {
          locationId: 'test:park_location',
        },
      },
    };

    const actorInstance = {
      instanceId: 'test:actor_instance',
      definitionId: 'test:actor',
    };

    // Create entities using the entity factory
    const parkBench = createEntityInstance({
      instanceId: parkBenchInstance.instanceId,
      definitionId: parkBenchDefinition.id,
      baseComponents: parkBenchDefinition.components,
      overrides: parkBenchInstance.componentOverrides,
    });
    const actor = createEntityInstance({
      instanceId: actorInstance.instanceId,
      definitionId: actorDefinition.id,
      baseComponents: actorDefinition.components,
    });

    // Add entities to manager using addEntity to preserve Entity instance methods
    entityManager.addEntity(parkBench);
    entityManager.addEntity(actor);

    // Act: First test the basic entity query that should find the park bench
    const basicQuery = 'entities(positioning:allows_sitting)';

    // Parse the query to get the AST
    const { parseDslExpression } = await import(
      '../../../src/scopeDsl/parser/parser.js'
    );
    const ast = parseDslExpression(basicQuery);

    // Create runtime context needed by scope engine
    const runtimeCtx = {
      entityManager: entityManager,
      jsonLogicEval: jsonLogicEval,
      logger: mockLogger,
      location: { id: 'test:park_location' },
    };

    const basicResult = await scopeEngine.resolve(
      ast,
      actor,
      runtimeCtx,
      mockLogger
    );

    // Assert: Should find the park bench
    expect(basicResult.size).toBe(1);
    expect(basicResult.has('test:park_bench_instance')).toBe(true);
  });

  it('should verify park bench entity has both definition and override components', async () => {
    // Arrange: Same setup as above
    const parkBenchDefinition = {
      id: 'test:park_bench',
      components: {
        'positioning:allows_sitting': {
          spots: [null, null],
        },
      },
    };

    const parkBenchInstance = {
      instanceId: 'test:park_bench_instance',
      definitionId: 'test:park_bench',
      componentOverrides: {
        'core:position': {
          locationId: 'test:park_location',
        },
      },
    };

    const parkBench = createEntityInstance({
      instanceId: parkBenchInstance.instanceId,
      definitionId: parkBenchDefinition.id,
      baseComponents: parkBenchDefinition.components,
      overrides: parkBenchInstance.componentOverrides,
    });
    entityManager.addEntity(parkBench);

    // Act & Assert: Verify entity has both components
    expect(parkBench.hasComponent('positioning:allows_sitting')).toBe(true);
    expect(parkBench.hasComponent('core:position')).toBe(true);

    const positioningComponent = parkBench.getComponentData(
      'positioning:allows_sitting'
    );
    expect(positioningComponent).toEqual({ spots: [null, null] });

    const positionComponent = parkBench.getComponentData('core:position');
    expect(positionComponent).toEqual({ locationId: 'test:park_location' });

    // Verify getAllComponents returns both
    const allComponents = parkBench.getAllComponents();
    expect(allComponents).toHaveProperty('positioning:allows_sitting');
    expect(allComponents).toHaveProperty('core:position');
  });

  it('should verify entities with positioning:allows_sitting are properly indexed', async () => {
    // Arrange: Same park bench setup
    const parkBenchDefinition = {
      id: 'test:park_bench',
      components: {
        'positioning:allows_sitting': {
          spots: [null, null],
        },
      },
    };

    const parkBenchInstance = {
      instanceId: 'test:park_bench_instance',
      definitionId: 'test:park_bench',
      componentOverrides: {
        'core:position': {
          locationId: 'test:park_location',
        },
      },
    };

    const parkBench = createEntityInstance({
      instanceId: parkBenchInstance.instanceId,
      definitionId: parkBenchDefinition.id,
      baseComponents: parkBenchDefinition.components,
      overrides: parkBenchInstance.componentOverrides,
    });

    // Add entity to manager using addEntity to preserve Entity instance methods
    entityManager.addEntity(parkBench);

    // Act: Query for entities with positioning:allows_sitting
    const entitiesWithSitting = gateway.getEntitiesWithComponent(
      'positioning:allows_sitting'
    );

    // Assert: Should find the park bench
    expect(entitiesWithSitting).toHaveLength(1);
    expect(entitiesWithSitting[0].id).toBe('test:park_bench_instance');
    expect(
      entitiesWithSitting[0].hasComponent('positioning:allows_sitting')
    ).toBe(true);
    expect(entitiesWithSitting[0].hasComponent('core:position')).toBe(true);
  });
});
