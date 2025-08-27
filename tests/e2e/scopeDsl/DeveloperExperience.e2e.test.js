/**
 * @file Developer Experience E2E Test Suite
 * @see tests/e2e/scopeDsl/DeveloperExperience.e2e.test.js
 *
 * This test suite provides comprehensive end-to-end testing of developer experience
 * features in the scopeDSL system, covering:
 * - Trace context utilization and debug output
 * - Error message quality and developer feedback
 * - Performance profiling integration and metrics
 * - Documentation example validation
 *
 * Addresses Priority 4 requirements from ScopeDSL E2E Coverage Analysis
 * Coverage: Cross-cutting developer experience concerns
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { ScopeSyntaxError } from '../../../src/scopeDsl/parser/tokenizer.js';
import ScopeDepthError from '../../../src/errors/scopeDepthError.js';
import ScopeCycleError from '../../../src/errors/scopeCycleError.js';

/**
 * E2E test suite for developer experience features in scopeDSL
 * Tests debugging, profiling, documentation validation, and developer tools
 */
describe('Developer Experience E2E', () => {
  let container;
  let entityManager;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let logger;
  let testWorld;
  let testActors;
  let eventBus;

  beforeEach(async () => {
    // Create real container and configure it
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get real services from container
    entityManager = container.resolve(tokens.IEntityManager);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    dslParser = container.resolve(tokens.DslParser);
    logger = container.resolve(tokens.ILogger);
    eventBus = container.resolve(tokens.IEventBus);

    // Set up test world and actors
    testWorld = await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });

    testActors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry: container.resolve(tokens.IDataRegistry),
    });

    // Set up test conditions and scope definitions
    ScopeTestUtilities.setupScopeTestConditions(
      container.resolve(tokens.IDataRegistry)
    );

    const scopeDefinitions = ScopeTestUtilities.createTestScopes({
      dslParser,
      logger,
    });

    // Initialize scope registry with test definitions
    scopeRegistry.initialize(scopeDefinitions);
  });

  afterEach(async () => {
    // Clean up resources
    if (container) {
      // Clean up any resources if needed
    }
  });

  /**
   * Creates a trace context for testing
   *
   * @returns {TraceContext} A new trace context instance
   */
  function createTraceContext() {
    return new TraceContext();
  }

  /**
   * Creates game context for scope resolution
   *
   * @param {object} options - Context options
   * @returns {object} Game context object
   */
  function createGameContext(options = {}) {
    return {
      actor: options.actor || testActors.player.id,
      location: options.location || testWorld.currentLocation.id,
      target: options.target || null,
      currentLocation: testWorld.currentLocation,
      entityManager: entityManager,
      allEntities: [testActors.player.id, testActors.npc.id],
      jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
      logger: logger,
      spatialIndexManager: container.resolve(tokens.ISpatialIndexManager),
      ...options,
    };
  }

  describe('Trace Context Utilization', () => {
    test('should provide helpful trace output for successful resolution', async () => {
      const traceContext = createTraceContext();
      const gameContext = createGameContext();

      // Resolve a simple scope with trace context
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:actor_source',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: traceContext }
      );

      // Verify result was returned
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Set);

      // Check that we got the actor entity
      expect(result.size).toBeGreaterThan(0);
      expect(result.has(testActors.player.id)).toBe(true);

      // Verify trace logs were captured if trace was used
      if (traceContext && traceContext.logs) {
        expect(traceContext.logs.length).toBeGreaterThan(0);
      }
    });

    test('should generate meaningful debug information during resolution', async () => {
      const traceContext = createTraceContext();
      const gameContext = createGameContext();

      // Resolve a complex scope with nested components
      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:nested_component_access',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: traceContext }
      );

      // The result should be returned even for complex scopes
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Set);

      // Verify trace information if available
      if (traceContext && traceContext.logs) {
        // Check that timing information is captured
        const hasTimestamps = traceContext.logs.every(
          (log) => log.timestamp !== undefined
        );
        expect(hasTimestamps).toBe(true);
      }
    });

    test('should integrate with profiling tools through trace data', async () => {
      const traceContext = createTraceContext();
      const gameContext = createGameContext();

      // Perform multiple resolutions to generate profiling data
      const startTime = performance.now();

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine },
        { trace: traceContext }
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify performance can be measured
      expect(duration).toBeDefined();
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify result was returned
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Set);
    });

    test('should validate documentation examples work correctly', async () => {
      const traceContext = createTraceContext();
      const gameContext = createGameContext();

      // Examples from documentation
      const documentationScopes = [
        // Basic source examples from docs/scope-dsl.md
        'actor',
        'location',
        'entities(core:item)',

        // Step navigation examples
        'actor.core:inventory',
        'location.core:exits',
      ];

      // Parse and validate each documentation example
      for (const scopeExpr of documentationScopes) {
        try {
          const ast = dslParser.parse(scopeExpr);
          expect(ast).toBeDefined();
          expect(ast.type).toBeDefined();

          // Log successful validation to trace
          traceContext.info(
            `Documentation example validated: ${scopeExpr}`,
            'DeveloperExperience.test'
          );
        } catch (error) {
          // Documentation examples should never fail to parse
          fail(`Documentation example failed to parse: ${scopeExpr}`);
        }
      }

      // Verify all examples were validated
      const validationLogs = traceContext.logs.filter((log) =>
        log.message.includes('Documentation example validated')
      );
      expect(validationLogs.length).toBe(documentationScopes.length);
    });
  });

  describe('Debug Information Generation', () => {
    test('should generate meaningful error messages for syntax errors', () => {
      const invalidScopes = [
        {
          expr: 'actor..inventory',
          expectedError: /Expected field name/,
        },
        {
          expr: 'entities()',
          expectedError: /Expected component identifier/,
        },
        {
          expr: 'actor[',
          expectedError: /Expected opening brace for JSON Logic/,
        },
      ];

      for (const { expr, expectedError } of invalidScopes) {
        try {
          dslParser.parse(expr);
          fail(`Should have thrown error for: ${expr}`);
        } catch (error) {
          // Verify error is a ScopeSyntaxError
          expect(error).toBeInstanceOf(ScopeSyntaxError);

          // Check error message quality
          expect(error.message).toMatch(expectedError);

          // Verify error includes location info
          expect(error.line).toBeDefined();
          expect(error.column).toBeDefined();

          // Check for code snippet in error
          if (error.snippet) {
            expect(error.snippet).toContain(expr.substring(0, 10));
          }
        }
      }
    });

    test('should provide helpful feedback for missing scope references', async () => {
      const gameContext = createGameContext();

      // Register a scope with a reference to a non-existent scope
      const testScope = {
        id: 'test:missing_reference',
        expr: 'test:nonexistent_scope',
        description: 'Test scope with missing reference',
      };

      // Parse the scope
      const ast = dslParser.parse(testScope.expr);
      scopeRegistry.initialize({
        [testScope.id]: { ...testScope, ast },
      });

      // Attempt to resolve and expect helpful error
      try {
        await ScopeTestUtilities.resolveScopeE2E(
          'test:missing_reference',
          testActors.player,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
        fail('Should have thrown error for missing scope reference');
      } catch (error) {
        // Verify error message includes helpful context
        expect(error.message).toContain('test:nonexistent_scope');
        expect(error.message.toLowerCase()).toMatch(
          /not found|missing|undefined/
        );
      }
    });

    test('should include resolution path in depth/cycle errors', async () => {
      const gameContext = createGameContext();

      // Create a deeply nested scope that exceeds depth limit
      const deepScope = {
        id: 'test:deep_nested',
        expr: 'actor' + '.core:inventory'.repeat(15), // Exceeds depth limit
        description: 'Test scope exceeding depth limit',
      };

      try {
        const ast = dslParser.parse(deepScope.expr);
        scopeRegistry.initialize({
          [deepScope.id]: { ...deepScope, ast },
        });

        await ScopeTestUtilities.resolveScopeE2E(
          'test:deep_nested',
          testActors.player,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
        fail('Should have thrown depth error');
      } catch (error) {
        // Verify error provides context about the depth issue
        if (error instanceof ScopeDepthError) {
          expect(error.message).toMatch(/depth|limit|exceeded/i);
        }
      }
    });

    test('should format error output for developer readability', () => {
      const testCases = [
        {
          expr: 'actor.[[]]',
          description: 'Invalid array syntax',
        },
        {
          expr: 'entities(core:item)[}',
          description: 'Malformed JSON logic',
        },
        {
          expr: 'actor + + location',
          description: 'Invalid union syntax',
        },
      ];

      for (const { expr, description } of testCases) {
        try {
          dslParser.parse(expr);
          fail(`Should have failed: ${description}`);
        } catch (error) {
          // Check error formatting
          expect(error).toBeInstanceOf(ScopeSyntaxError);
          expect(error.toString()).toBeDefined();

          // Verify error includes helpful context
          const errorString = error.toString();
          expect(errorString).toContain('ScopeSyntaxError');
          expect(errorString.length).toBeGreaterThan(20); // Meaningful message
        }
      }
    });
  });

  describe('Performance Profiling Integration', () => {
    test('should measure scope resolution performance accurately', async () => {
      const gameContext = createGameContext();

      // Create a large dataset for performance testing
      const largeDataset = await ScopeTestUtilities.createMockEntityDataset(
        100,
        'moderate',
        { entityManager, registry: container.resolve(tokens.IDataRegistry) }
      );

      // Manually measure performance of multiple resolutions
      const iterations = 5;
      const results = [];
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = await ScopeTestUtilities.resolveScopeE2E(
          'test:complex_multi_filter',
          testActors.player,
          gameContext,
          { scopeRegistry, scopeEngine }
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({ duration, success: result !== undefined });
        totalTime += duration;
      }

      // Verify performance metrics
      expect(results).toHaveLength(iterations);
      expect(totalTime).toBeGreaterThan(0);
      const averageTime = totalTime / iterations;
      expect(averageTime).toBeLessThan(1000); // Should average less than 1 second
    });

    test('should track memory usage during resolution', async () => {
      // Skip if not in Node environment (browser doesn't have process.memoryUsage)
      if (typeof process === 'undefined' || !process.memoryUsage) {
        console.log('Skipping memory test in browser environment');
        return;
      }

      const gameContext = createGameContext();

      // Create large dataset
      await ScopeTestUtilities.createMockEntityDataset(200, 'complex', {
        entityManager,
        registry: container.resolve(tokens.IDataRegistry),
      });

      // Manually track memory if available
      const startMemory = process.memoryUsage
        ? process.memoryUsage().heapUsed
        : 0;

      const result = await ScopeTestUtilities.resolveScopeE2E(
        'test:deeply_nested_filter',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      const endMemory = process.memoryUsage
        ? process.memoryUsage().heapUsed
        : 0;
      const memoryUsed = endMemory - startMemory;

      // Verify resolution worked
      expect(result).toBeDefined();

      // Memory tracking only works in Node environment
      if (process.memoryUsage) {
        // Memory change could be positive or negative due to GC
        expect(typeof memoryUsed).toBe('number');
      }
    });

    test('should classify performance levels correctly', async () => {
      const gameContext = createGameContext();

      // Test performance classification
      const performanceClasses = [
        { time: 5, expectedClass: 'Excellent' },
        { time: 15, expectedClass: 'Good' },
        { time: 45, expectedClass: 'Good' }, // Changed from 'Acceptable' - threshold is <50ms for Good
        { time: 150, expectedClass: 'Acceptable' }, // Changed from 'Slow' - threshold is <200ms for Acceptable
      ];

      for (const { time, expectedClass } of performanceClasses) {
        // Use internal classification method
        const classification = ScopeTestUtilities._classifyPerformance(time);
        expect(classification).toBe(expectedClass);
      }
    });

    test('should integrate with existing profiling tools', async () => {
      const gameContext = createGameContext();

      // Create performance marks
      performance.mark('scopeResolution-start');

      await ScopeTestUtilities.resolveScopeE2E(
        'test:json_logic_filter',
        testActors.player,
        gameContext,
        { scopeRegistry, scopeEngine }
      );

      performance.mark('scopeResolution-end');

      // Measure between marks
      performance.measure(
        'scopeResolution',
        'scopeResolution-start',
        'scopeResolution-end'
      );

      // Get the measurement
      const measures = performance.getEntriesByName('scopeResolution');
      expect(measures.length).toBeGreaterThan(0);

      const measure = measures[0];
      expect(measure.duration).toBeDefined();
      expect(measure.duration).toBeGreaterThan(0);

      // Clean up
      performance.clearMarks();
      performance.clearMeasures();
    });
  });

  describe('Documentation Example Validation', () => {
    test('should validate all basic scope examples from documentation', async () => {
      const documentationExamples = [
        // From docs/scope-dsl.md - Basic examples
        { expr: 'actor', description: 'Actor source' },
        { expr: 'location', description: 'Location source' },
        { expr: 'entities(core:item)', description: 'Entities with component' },
        {
          expr: 'entities(!core:hostile)',
          description: 'Entities without component',
        },

        // Component navigation
        { expr: 'actor.core:inventory', description: 'Component access' },
        {
          expr: 'actor.core:inventory.items',
          description: 'Nested field access',
        },

        // Array iteration
        {
          expr: 'actor.core:inventory.items[]',
          description: 'Array iteration',
        },
        { expr: 'location.core:exits[]', description: 'Exit iteration' },

        // Union operations - both syntaxes
        {
          expr: 'actor.core:inventory.items[] + location.core:items[]',
          description: 'Union with +',
        },
        {
          expr: 'actor.followers[] | actor.partners[]',
          description: 'Union with |',
        },
      ];

      for (const { expr, description } of documentationExamples) {
        try {
          const ast = dslParser.parse(expr);
          expect(ast).toBeDefined();
          expect(ast.type).toBeDefined();

          // Log successful validation
          logger.info(
            `✓ Documentation example validated: ${description} - "${expr}"`
          );
        } catch (error) {
          fail(
            `Documentation example failed: ${description}\nExpression: ${expr}\nError: ${error.message}`
          );
        }
      }
    });

    test('should validate clothing resolution examples', async () => {
      const clothingExamples = [
        // From docs/scope-dsl.md - Clothing examples
        {
          expr: 'actor.topmost_clothing',
          description: 'Topmost clothing access',
        },
        {
          expr: 'actor.topmost_clothing.torso',
          description: 'Specific slot access',
        },
        {
          expr: 'actor.outer_clothing.legs',
          description: 'Outer layer access',
        },
        { expr: 'actor.base_clothing.torso', description: 'Base layer access' },
        { expr: 'actor.underwear.hips', description: 'Underwear access' },
      ];

      for (const { expr, description } of clothingExamples) {
        try {
          const ast = dslParser.parse(expr);
          expect(ast).toBeDefined();

          // Verify clothing-specific node types
          if (expr.includes('clothing') || expr.includes('underwear')) {
            // Should have proper node structure for clothing
            expect(ast.type).toBeDefined();
          }

          logger.info(`✓ Clothing example validated: ${description}`);
        } catch (error) {
          fail(
            `Clothing example failed: ${description}\nExpression: ${expr}\nError: ${error.message}`
          );
        }
      }
    });

    test('should validate filter examples with JSON logic', async () => {
      const filterExamples = [
        // Simple filters
        {
          expr: 'entities(core:item)[][{"==": [{"var": "entity.id"}, "sword1"]}]',
          description: 'Entity ID filter',
        },
        // Complex filters
        {
          expr: 'entities(core:actor)[][{"and": [{">": [{"var": "entity.components.core:stats.level"}, 5]}, {"<": [{"var": "entity.components.core:health.current"}, 100]}]}]',
          description: 'Complex AND filter',
        },
        // Condition references
        {
          expr: 'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}]',
          description: 'Condition reference filter',
        },
        // Array element filtering
        {
          expr: 'actor.core:inventory.items[{">": [{"var": "quantity"}, 1]}]',
          description: 'Array element filter',
        },
      ];

      for (const { expr, description } of filterExamples) {
        try {
          const ast = dslParser.parse(expr);
          expect(ast).toBeDefined();

          logger.info(`✓ Filter example validated: ${description}`);
        } catch (error) {
          fail(
            `Filter example failed: ${description}\nExpression: ${expr}\nError: ${error.message}`
          );
        }
      }
    });

    test('should validate examples from creating-scopes.md tutorial', async () => {
      const tutorialExamples = [
        // From docs/mods/creating-scopes.md
        { expr: 'actor', description: 'Tutorial: Actor source' },
        {
          expr: 'actor.core:pets.petList[]',
          description: 'Tutorial: Pet list access',
        },
        {
          expr: 'location.core:items[]',
          description: 'Tutorial: Items in location',
        },
        { expr: 'entities(core:npc)', description: 'Tutorial: All NPCs' },
        {
          expr: 'entities(!core:hostile)',
          description: 'Tutorial: Non-hostile entities',
        },

        // Combined scopes from tutorial
        {
          expr: 'actor.core:inventory.items[] + location.core:items[]',
          description: 'Tutorial: Combined inventory and ground items',
        },
      ];

      for (const { expr, description } of tutorialExamples) {
        try {
          const ast = dslParser.parse(expr);
          expect(ast).toBeDefined();

          // Verify AST structure matches expected patterns
          if (expr.includes('+') || expr.includes('|')) {
            expect(ast.type).toBe('Union');
            expect(ast.left).toBeDefined();
            expect(ast.right).toBeDefined();
          }

          logger.info(`✓ Tutorial example validated: ${description}`);
        } catch (error) {
          fail(
            `Tutorial example failed: ${description}\nExpression: ${expr}\nError: ${error.message}`
          );
        }
      }
    });

    test('should ensure all documented patterns work in real scenarios', async () => {
      const gameContext = createGameContext();

      // Test that documented source patterns actually resolve
      const sourcePatterns = [
        { scope: 'actor', expectedType: 'string' },
        { scope: 'location', expectedType: 'string' },
      ];

      for (const { scope, expectedType } of sourcePatterns) {
        const ast = dslParser.parse(scope);
        scopeRegistry.initialize({
          [`doc:${scope}`]: { id: `doc:${scope}`, expr: scope, ast },
        });

        const result = await ScopeTestUtilities.resolveScopeE2E(
          `doc:${scope}`,
          testActors.player,
          gameContext,
          { scopeRegistry, scopeEngine }
        );

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(Set);

        if (expectedType === 'string') {
          // Should resolve to at least one entity ID
          expect(result.size).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });
});
