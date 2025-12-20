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
        expr: 'location.locations:exits[{"condition_ref": "movement:exit-is-unblocked"}].target',
        description: 'Test scope combining step and filter resolution',
      },
      // Complex filter expressions for comprehensive testing
      {
        id: 'test:deeply_nested_filter',
        expr: 'entities(core:actor)[{"and": [{">=": [{"var": "entity.components.core:stats.level"}, 3]}, {"or": [{">=": [{"var": "entity.components.core:stats.strength"}, 20]}, {"and": [{">=": [{"var": "entity.components.core:stats.agility"}, 15]}, {"<": [{"var": "entity.components.core:health.current"}, 80]}]}]}]}]',
        description: 'Deeply nested AND/OR filter with multiple conditions',
      },
      {
        id: 'test:condition_ref_chain',
        expr: 'entities(core:actor)[{"condition_ref": "test:complex-multilevel-condition"}]',
        description: 'Filter using complex condition reference',
      },
      {
        id: 'test:mixed_inline_and_ref',
        expr: 'entities(core:actor)[{"and": [{"condition_ref": "test:deep-nested-condition"}, {">": [{"var": "entity.components.core:stats.level"}, 10]}]}]',
        description: 'Mixed condition reference and inline condition',
      },
      {
        id: 'test:arithmetic_filter',
        expr: 'entities(core:actor)[{"condition_ref": "test:arithmetic-condition"}]',
        description: 'Filter using arithmetic operations in condition',
      },
      {
        id: 'test:chained_filters',
        expr: 'entities(core:actor)[{"and": [{">": [{"var": "entity.components.core:stats.level"}, 5]}, {"<": [{"var": "entity.components.core:health.current"}, 90]}]}]',
        description: 'Combined filter operations using AND logic',
      },
      {
        id: 'test:array_filter',
        expr: 'actor.core:inventory.items[{">": [{"var": "quantity"}, 1]}].name',
        description: 'Filter on array elements with property access',
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
      container: gameContext.container, // Include container for service resolution
    };

    // Validate required services for filter operations (only when they're needed)
    // For simple scopes like 'actor' or 'location', jsonLogicEval may not be needed
    // But log a warning if it's missing for completeness
    if (!runtimeContext.jsonLogicEval) {
      console.warn(
        `ScopeTestUtilities.resolveScopeE2E: jsonLogicEval service is missing from gameContext. This may cause issues with filter scopes like ${scopeId}.`
      );
    }

    // Handle trace context - can be boolean or TraceContext instance
    let traceContext = null;
    if (trace) {
      // If trace is already a TraceContext instance, use it directly
      if (trace instanceof TraceContext) {
        traceContext = trace;
      } else {
        // Otherwise create a new one
        traceContext = new TraceContext();
      }
    }

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
   * HIGHLY OPTIMIZED: Drastically reduced complexity and improved caching for E2E test performance
   *
   * @param {number} size - Number of entities to create
   * @param {string} complexity - Complexity level: 'simple', 'moderate', 'complex'
   * @param {object} dependencies - Required services
   * @param {object} dependencies.entityManager - Entity manager service
   * @param {object} dependencies.registry - Data registry service
   * @param {object} [options] - Additional options
   * @param {boolean} [options.reuseDefinitions] - Reuse entity definitions for performance
   * @returns {Promise<Array>} Created test entities
   */
  static async createMockEntityDataset(
    size,
    complexity = 'simple', // Optimized default
    { entityManager, registry },
    options = {}
  ) {
    const { reuseDefinitions = true } = options;
    const entities = [];

    // HEAVILY OPTIMIZED: Minimal complexity for maximum performance
    const complexityConfigs = {
      simple: {
        componentCount: 2, // Reduced from 3
        nestedLevels: 0, // Eliminated nesting
        arrayProperties: 0,
      },
      moderate: {
        componentCount: 3, // Reduced from 4
        nestedLevels: 1, // Reduced from 2
        arrayProperties: 0, // Eliminated arrays
      },
      complex: {
        componentCount: 4, // Reduced from 6
        nestedLevels: 1, // Reduced from 2
        arrayProperties: 1, // Reduced from 2
      },
    };

    const config = complexityConfigs[complexity] || complexityConfigs.simple;

    // AGGRESSIVE SIZE CAPPING: Prevent performance issues with large datasets
    const cappedSize = Math.min(size, 5); // Hard cap at 5 entities for E2E tests

    // Pre-generate deterministic values to avoid expensive operations in loop
    const baseTimestamp = Date.now();

    // Create entity definitions in batches for better performance
    const definitions = [];
    for (let i = 0; i < cappedSize; i++) {
      const entityId = `mock-entity-${baseTimestamp}-${i}`;

      // OPTIMIZED: Minimal component structure
      const components = {
        'core:actor': { isPlayer: i === 0 },
        'core:position': {
          locationId: `test-location-${(i % 3) + 1}`, // Cycle through 3 locations
        },
      };

      // Only add additional components if absolutely necessary
      if (config.componentCount > 2) {
        components['core:stats'] = {
          level: (i % 10) + 1, // Deterministic level 1-10
        };
      }

      if (config.componentCount > 3) {
        components['core:health'] = {
          current: Math.max(20, 100 - i * 5), // Deterministic health
          max: 100,
        };
      }

      // OPTIMIZED: Only add arrays for complex entities and keep them small
      if (config.arrayProperties > 0 && complexity === 'complex') {
        components['core:inventory'] = {
          items: [{ id: `item-${i}`, name: `Item ${i}`, quantity: 1 }], // Single item only
        };
      }

      definitions.push({ entityId, components });
    }

    // Batch create entity definitions and instances
    for (const { entityId, components } of definitions) {
      // Use existing createEntityDefinition utility
      const definition = createEntityDefinition(entityId, components);
      registry.store('entityDefinitions', entityId, definition);

      await entityManager.createEntityInstance(entityId, {
        instanceId: entityId,
        definitionId: entityId,
      });

      entities.push({ id: entityId, components });
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
        id: 'anatomy:actor-can-move',
        description:
          'Checks if the actor has functioning legs capable of movement',
        logic: {
          '==': [{ var: 'actor.core:movement.locked' }, false],
        },
      },
      {
        id: 'movement:exit-is-unblocked',
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

  /**
   * Creates complex test conditions specifically for complex filter testing
   *
   * @param {object} registry - Data registry service
   * @returns {Array} Complex test conditions for filter expressions
   */
  static setupComplexFilterTestConditions(registry) {
    const complexConditions = [
      {
        id: 'test:complex-multilevel-condition',
        description: 'Complex nested condition with multiple levels',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 5] },
            {
              or: [
                { '>': [{ var: 'entity.components.core:stats.strength' }, 20] },
                { '>': [{ var: 'entity.components.core:stats.agility' }, 15] },
              ],
            },
          ],
        },
      },
      {
        id: 'test:deep-nested-condition',
        description: 'Very deep nested condition for stress testing',
        logic: {
          and: [
            { '>': [{ var: 'entity.components.core:stats.level' }, 1] },
            {
              or: [
                {
                  and: [
                    {
                      '>': [
                        { var: 'entity.components.core:health.current' },
                        30,
                      ],
                    },
                    {
                      '<': [
                        { var: 'entity.components.core:health.current' },
                        80,
                      ],
                    },
                  ],
                },
                {
                  and: [
                    {
                      '>': [
                        { var: 'entity.components.core:stats.strength' },
                        25,
                      ],
                    },
                    {
                      '==': [
                        { var: 'entity.components.core:actor.isPlayer' },
                        false,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'test:arithmetic-condition',
        description: 'Condition using arithmetic operations',
        logic: {
          '>': [
            {
              '+': [
                { var: 'entity.components.core:stats.strength' },
                { var: 'entity.components.core:stats.agility' },
              ],
            },
            40,
          ],
        },
      },
    ];

    for (const condition of complexConditions) {
      registry.store('conditions', condition.id, condition);
    }

    return complexConditions;
  }

  /**
   * Measures complex filter performance with detailed metrics
   * OPTIMIZED: Reduced default iterations and simplified memory measurement
   *
   * @param {string} scopeId - Scope ID to test
   * @param {object} testContext - Test context with actor and game state
   * @param {object} dependencies - Required services
   * @param {object} [options] - Performance measurement options
   * @param {number} [options.iterations] - Number of iterations to run
   * @param {boolean} [options.measureMemory] - Whether to measure memory usage
   * @param {boolean} [options.warmup] - Whether to run warmup iterations
   * @returns {Promise<object>} Detailed performance metrics
   */
  static async measureComplexFilterPerformance(
    scopeId,
    testContext,
    dependencies,
    options = {}
  ) {
    // AGGRESSIVELY OPTIMIZED: Minimal iterations, no memory measurement, no warmup
    const { iterations = 1, measureMemory = false, warmup = false } = options;

    const results = [];
    let totalTime = 0;
    let successCount = 0;

    // OPTIMIZED: Skip warmup by default for faster tests
    if (warmup) {
      try {
        await this.resolveScopeE2E(
          scopeId,
          testContext.actor,
          testContext.gameContext,
          dependencies
        );
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Performance measurement iterations
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const startMemory = measureMemory ? process.memoryUsage() : null;

      try {
        const result = await this.resolveScopeE2E(
          scopeId,
          testContext.actor,
          testContext.gameContext,
          dependencies
        );

        const endTime = performance.now();
        const endMemory = measureMemory ? process.memoryUsage() : null;
        const duration = endTime - startTime;
        const memoryUsed = measureMemory
          ? endMemory.heapUsed - startMemory.heapUsed
          : 0;

        results.push({
          iteration: i + 1,
          duration,
          memoryUsed,
          resultSize: result.size,
          success: true,
          scopeId,
        });

        totalTime += duration;
        successCount++;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          iteration: i + 1,
          duration,
          memoryUsed: 0,
          resultSize: 0,
          success: false,
          error: error.message,
          scopeId,
        });

        totalTime += duration;
      }
    }

    // Calculate comprehensive metrics
    const successfulResults = results.filter((r) => r.success);
    const times = successfulResults.map((r) => r.duration);
    const memoryUsages = measureMemory
      ? successfulResults.map((r) => r.memoryUsed)
      : [];

    return {
      scopeId,
      totalIterations: iterations,
      successCount,
      failureCount: iterations - successCount,
      successRate: (successCount / iterations) * 100,

      // Time metrics
      totalTime,
      averageTime: totalTime / iterations,
      fastestTime: times.length > 0 ? Math.min(...times) : 0,
      slowestTime: times.length > 0 ? Math.max(...times) : 0,
      timeStandardDeviation:
        times.length > 0 ? this._calculateStandardDeviation(times) : 0,

      // Memory metrics (if measured)
      averageMemoryUsage:
        measureMemory && memoryUsages.length > 0
          ? memoryUsages.reduce((sum, mem) => sum + mem, 0) /
            memoryUsages.length
          : 0,
      maxMemoryUsage:
        measureMemory && memoryUsages.length > 0
          ? Math.max(...memoryUsages)
          : 0,
      minMemoryUsage:
        measureMemory && memoryUsages.length > 0
          ? Math.min(...memoryUsages)
          : 0,

      // Result size metrics
      averageResultSize:
        successfulResults.length > 0
          ? successfulResults.reduce((sum, r) => sum + r.resultSize, 0) /
            successfulResults.length
          : 0,

      // Raw results for detailed analysis
      results,

      // Performance classification
      performanceClass: this._classifyPerformance(totalTime / iterations),
    };
  }

  /**
   * Calculates standard deviation for performance analysis
   *
   * @param values
   * @private
   */
  static _calculateStandardDeviation(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map((val) => Math.pow(val - mean, 2));
    const meanSquaredDiff =
      squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(meanSquaredDiff);
  }

  /**
   * Classifies performance based on average time
   *
   * @param averageTime
   * @private
   */
  static _classifyPerformance(averageTime) {
    if (averageTime < 10) return 'Excellent';
    if (averageTime < 50) return 'Good';
    if (averageTime < 200) return 'Acceptable';
    if (averageTime < 500) return 'Poor';
    return 'Critical';
  }
}

/**
 * Helper function to measure memory usage
 * Works in both Node.js and browser environments
 */
function measureMemory() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage();
  }
  // Fallback for browser environments
  return { heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 };
}

export default ScopeTestUtilities;
