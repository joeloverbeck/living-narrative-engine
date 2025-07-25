/**
 * @file ScopeDSL Test Utilities
 * @description Specialized utilities for ScopeDSL E2E testing
 */

import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { createEntityDefinition } from '../entities/entityFactories.js';

/**
 * Specialized test utilities for ScopeDSL E2E tests
 *
 * Provides standardized methods for:
 * - Creating mock scope definitions with parsed ASTs
 * - Direct scope resolution testing
 * - Performance measurement and benchmarking
 * - Large dataset creation for scalability testing
 */
export class ScopeTestUtilities {
  /**
   * Creates test scope definitions with parsed ASTs
   *
   * @param {object} dependencies - Required services
   * @param {object} dependencies.dslParser - DSL parser service
   * @param {object} dependencies.logger - Logger service
   * @param {Array} [additionalScopes] - Additional scope definitions
   * @returns {object} Scope definitions with ASTs ready for registry
   */
  static createTestScopes({ dslParser, logger }, additionalScopes = []) {
    const baseScopes = [
      {
        id: 'test:actor_source',
        expr: 'actor',
        description: 'Test scope for actor source resolution',
      },
      {
        id: 'test:location_source',
        expr: 'location',
        description: 'Test scope for location source resolution',
      },
      {
        id: 'test:entities_with_component',
        expr: 'entities(core:actor)',
        description: 'Test scope for entities with component resolution',
      },
      {
        id: 'test:nested_component_access',
        expr: 'actor.core:stats.strength',
        description: 'Test scope for nested component access',
      },
      {
        id: 'test:missing_component_access',
        expr: 'actor.nonexistent:component',
        description: 'Test scope for missing component graceful handling',
      },
      {
        id: 'test:json_logic_filter',
        expr: 'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, "5"]}]',
        description: 'Test scope for JSON Logic filtering',
      },
      {
        id: 'test:complex_multi_filter',
        expr: 'entities(core:actor)[{"and": [{">": [{"var": "entity.components.core:stats.level"}, "3"]}, {">": [{"var": "entity.components.core:health.current"}, "50"]}]}]',
        description: 'Test scope for complex multi-condition filtering',
      },
      {
        id: 'test:step_with_filter',
        expr: 'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target',
        description: 'Test scope combining step and filter resolution',
      },
    ];

    const allScopes = [...baseScopes, ...additionalScopes];
    const scopeDefinitions = {};

    // Parse each scope's DSL expression
    for (const scope of allScopes) {
      let ast;
      try {
        ast = dslParser.parse(scope.expr);
      } catch (e) {
        console.error(
          `[ScopeTestUtilities] Failed to parse ${scope.id}: "${scope.expr}"`,
          e
        );
        logger.warn(
          `Failed to parse test scope DSL expression: ${scope.id}`,
          e
        );
        // Use a simple fallback AST for error testing (valid source kind)
        ast = { type: 'Source', kind: 'actor' };
      }

      scopeDefinitions[scope.id] = {
        id: scope.id,
        expr: scope.expr,
        ast: ast,
        description: scope.description,
      };
    }

    return scopeDefinitions;
  }

  /**
   * Performs direct scope resolution for E2E testing
   *
   * @param {string} scopeId - Scope ID to resolve
   * @param {object} actor - Actor entity for context
   * @param {object} gameContext - Game context with entities and location
   * @param {object} dependencies - Required services
   * @param {object} dependencies.scopeRegistry - Scope registry service
   * @param {object} dependencies.scopeEngine - Scope engine service
   * @param {object} [options] - Resolution options
   * @param {boolean} [options.trace] - Enable tracing
   * @returns {Promise<Set<string>>} Resolved entity IDs
   */
  static async resolveScopeE2E(
    scopeId,
    actor,
    gameContext,
    { scopeRegistry, scopeEngine },
    options = {}
  ) {
    const { trace = false } = options;

    // Get the scope AST from registry
    const scopeAst = scopeRegistry.getScopeAst(scopeId);
    if (!scopeAst) {
      throw new Error(`Scope not found: ${scopeId}`);
    }

    // Create runtime context - ensure all required services are present
    const runtimeContext = {
      location: gameContext.currentLocation,
      entityManager: gameContext.entityManager,
      allEntities: gameContext.allEntities || [],
      jsonLogicEval: gameContext.jsonLogicEval,
      logger: gameContext.logger,
      spatialIndexManager: gameContext.spatialIndexManager,
    };

    // Validate required services for filter operations (only when they're needed)
    // For simple scopes like 'actor' or 'location', jsonLogicEval may not be needed
    // But log a warning if it's missing for completeness
    if (!runtimeContext.jsonLogicEval) {
      console.warn(
        `ScopeTestUtilities.resolveScopeE2E: jsonLogicEval service is missing from gameContext. This may cause issues with filter scopes like ${scopeId}.`
      );
    }

    // Create trace context if needed
    const traceContext = trace ? new TraceContext() : null;

    // Resolve the scope - engine expects (ast, actorEntity, runtimeCtx, trace)
    const result = await scopeEngine.resolve(
      scopeAst,
      actor,
      runtimeContext,
      traceContext
    );

    return result;
  }

  /**
   * Creates a mock entity dataset for performance and scalability testing
   *
   * @param {number} size - Number of entities to create
   * @param {string} complexity - Complexity level: 'simple', 'moderate', 'complex'
   * @param {object} dependencies - Required services
   * @param {object} dependencies.entityManager - Entity manager service
   * @param {object} dependencies.registry - Data registry service
   * @returns {Promise<Array>} Created test entities
   */
  static async createMockEntityDataset(
    size,
    complexity = 'moderate',
    { entityManager, registry }
  ) {
    const entities = [];
    const complexityConfigs = {
      simple: {
        componentCount: 3,
        nestedLevels: 1,
        arrayProperties: 0,
      },
      moderate: {
        componentCount: 6,
        nestedLevels: 2,
        arrayProperties: 2,
      },
      complex: {
        componentCount: 10,
        nestedLevels: 4,
        arrayProperties: 5,
      },
    };

    const config = complexityConfigs[complexity] || complexityConfigs.moderate;

    for (let i = 0; i < size; i++) {
      const entityId = `mock-entity-${i}`;
      const components = {
        'core:name': { name: `Mock Entity ${i}` },
        'core:actor': { isPlayer: i === 0 },
        'core:position': {
          locationId: `test-location-${(i % 3) + 1}`,
          x: Math.random() * 100,
          y: Math.random() * 100,
        },
      };

      // Add complexity-based components
      if (config.componentCount > 3) {
        components['core:stats'] = {
          level: Math.floor(Math.random() * 20) + 1,
          strength: Math.floor(Math.random() * 100) + 1,
          health: Math.floor(Math.random() * 100) + 50,
        };

        components['core:health'] = {
          current: Math.floor(Math.random() * 100) + 50,
          max: 100,
        };

        components['core:movement'] = {
          locked: Math.random() < 0.1, // 10% chance of being locked
        };
      }

      if (config.componentCount > 6) {
        components['core:inventory'] = {
          items: Array.from({ length: config.arrayProperties }, (_, j) => ({
            id: `item-${j}`,
            name: `Item ${j}`,
            quantity: Math.floor(Math.random() * 10) + 1,
          })),
        };

        components['core:abilities'] = {
          skills: Array.from({ length: config.arrayProperties }, (_, j) => ({
            name: `skill-${j}`,
            level: Math.floor(Math.random() * 10) + 1,
          })),
        };
      }

      if (config.nestedLevels > 2) {
        components['core:complex_data'] = {
          level1: {
            level2: {
              level3: {
                level4: {
                  deepValue: `deep-value-${i}`,
                  deepArray: Array.from(
                    { length: 3 },
                    (_, j) => `deep-item-${i}-${j}`
                  ),
                },
              },
            },
          },
        };
      }

      // Create entity definition and instance
      const definition = createEntityDefinition(entityId, components);
      registry.store('entityDefinitions', entityId, definition);

      await entityManager.createEntityInstance(entityId, {
        instanceId: entityId,
        definitionId: entityId,
      });

      entities.push({
        id: entityId,
        components,
      });
    }

    return entities;
  }

  /**
   * Measures scope resolution performance
   *
   * @param {string} scopeId - Scope ID to test
   * @param {object} testContext - Test context with actor and game state
   * @param {object} dependencies - Required services
   * @param {number} [iterations] - Number of iterations to run
   * @returns {Promise<object>} Performance metrics
   */
  static async measureResolutionPerformance(
    scopeId,
    testContext,
    dependencies,
    iterations = 10
  ) {
    const results = [];
    let totalTime = 0;
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      try {
        const result = await this.resolveScopeE2E(
          scopeId,
          testContext.actor,
          testContext.gameContext,
          dependencies
        );

        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

        results.push({
          iteration: i + 1,
          duration,
          memoryUsed,
          resultSize: result.size,
          success: true,
        });

        totalTime += duration;
        successCount++;
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        results.push({
          iteration: i + 1,
          duration,
          memoryUsed: 0,
          resultSize: 0,
          success: false,
          error: error.message,
        });

        totalTime += duration;
      }
    }

    return {
      totalIterations: iterations,
      successCount,
      failureCount: iterations - successCount,
      successRate: (successCount / iterations) * 100,
      averageTime: totalTime / iterations,
      totalTime,
      results,
      performance: {
        fastestTime: Math.min(
          ...results.filter((r) => r.success).map((r) => r.duration)
        ),
        slowestTime: Math.max(
          ...results.filter((r) => r.success).map((r) => r.duration)
        ),
        averageMemoryUsage:
          results
            .filter((r) => r.success)
            .reduce((sum, r) => sum + r.memoryUsed, 0) / successCount,
      },
    };
  }

  /**
   * Creates a trace context for scope resolution testing
   *
   * @returns {TraceContext} A new trace context instance
   */
  static createTraceContext() {
    return new TraceContext();
  }

  /**
   * Sets up comprehensive test conditions for scope resolution
   *
   * @param {object} registry - Data registry service
   * @param {Array} [additionalConditions] - Additional conditions to register
   * @returns {Array} All registered test conditions
   */
  static setupScopeTestConditions(registry, additionalConditions = []) {
    const testConditions = [
      {
        id: 'core:actor-can-move',
        description:
          'Checks if the actor has functioning legs capable of movement',
        logic: {
          '==': [{ var: 'actor.core:movement.locked' }, false],
        },
      },
      {
        id: 'core:exit-is-unblocked',
        description: 'Checks if an exit is unblocked',
        logic: {
          '==': [{ var: 'blocked' }, false],
        },
      },
      {
        id: 'core:has-health',
        description: 'Checks if the actor has health component',
        logic: {
          has: [{ var: 'actor' }, 'core:health'],
        },
      },
      {
        id: 'test:level-above-threshold',
        description: 'Checks if actor level is above a threshold',
        logic: {
          '>': [{ var: 'actor.core:stats.level' }, 5],
        },
      },
      {
        id: 'test:health-above-threshold',
        description: 'Checks if actor health is above threshold',
        logic: {
          '>': [{ var: 'actor.core:health.current' }, 50],
        },
      },
    ];

    const allConditions = [...testConditions, ...additionalConditions];

    for (const condition of allConditions) {
      registry.store('conditions', condition.id, condition);
    }

    return allConditions;
  }
}

export default ScopeTestUtilities;
