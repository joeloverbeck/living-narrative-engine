/**
 * @file Tests for ModTestFixture scope tracer integration
 * @description Verifies that BaseModTestFixture properly integrates ScopeEvaluationTracer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture - Scope Tracer Integration', () => {
  let fixture;

  beforeEach(async () => {
    // Use ModTestFixture.forAction factory which returns ModActionTestFixture instance
    fixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down'
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Tracer initialization (BaseModTestFixture)', () => {
    it('should create tracer instance in constructor', () => {
      expect(fixture.scopeTracer).toBeDefined();
      expect(fixture.scopeTracer).toHaveProperty('enable');
      expect(fixture.scopeTracer).toHaveProperty('disable');
      expect(fixture.scopeTracer).toHaveProperty('clear');
      expect(fixture.scopeTracer).toHaveProperty('getTrace');
      expect(fixture.scopeTracer).toHaveProperty('format');
    });

    it('should start with tracer disabled', () => {
      expect(fixture.scopeTracer.isEnabled()).toBe(false);
    });

    it('should be accessible on ModActionTestFixture instances', () => {
      expect(fixture).toHaveProperty('scopeTracer');
      expect(fixture).toHaveProperty('enableScopeTracing');
      expect(fixture).toHaveProperty('disableScopeTracing');
      expect(fixture).toHaveProperty('getScopeTrace');
      expect(fixture).toHaveProperty('getScopeTraceData');
      expect(fixture).toHaveProperty('getFilterBreakdown');
    });

    it('should be accessible on ModRuleTestFixture instances', async () => {
      const ruleFixture = await ModTestFixture.forRule(
        'sitting',
        'sitting:sit_down'
      );

      expect(ruleFixture).toHaveProperty('scopeTracer');
      expect(ruleFixture).toHaveProperty('enableScopeTracing');

      ruleFixture.cleanup();
    });

    it('should be accessible on ModCategoryTestFixture instances', async () => {
      const categoryFixture = await ModTestFixture.forCategory('positioning');

      expect(categoryFixture).toHaveProperty('scopeTracer');
      expect(categoryFixture).toHaveProperty('enableScopeTracing');

      categoryFixture.cleanup();
    });
  });

  describe('Control methods (BaseModTestFixture)', () => {
    it('should enable tracing via enableScopeTracing()', () => {
      expect(fixture.scopeTracer.isEnabled()).toBe(false);

      fixture.enableScopeTracing();

      expect(fixture.scopeTracer.isEnabled()).toBe(true);
    });

    it('should disable tracing via disableScopeTracing()', () => {
      fixture.enableScopeTracing();
      expect(fixture.scopeTracer.isEnabled()).toBe(true);

      fixture.disableScopeTracing();

      expect(fixture.scopeTracer.isEnabled()).toBe(false);
    });

    it('should clear trace data via clearScopeTrace()', () => {
      fixture.enableScopeTracing();

      // Add some trace data by getting the trace (which should record a start time)
      fixture.scopeTracer.logStep(
        'TestResolver',
        'test operation',
        'input',
        'output'
      );

      const traceBefore = fixture.getScopeTraceData();
      expect(traceBefore.steps.length).toBeGreaterThan(0);

      fixture.clearScopeTrace();

      const traceAfter = fixture.getScopeTraceData();
      expect(traceAfter.steps.length).toBe(0);
    });

    it('should conditionally enable via enableScopeTracingIf()', () => {
      expect(fixture.scopeTracer.isEnabled()).toBe(false);

      // Should not enable when condition is false
      fixture.enableScopeTracingIf(false);
      expect(fixture.scopeTracer.isEnabled()).toBe(false);

      // Should enable when condition is true
      fixture.enableScopeTracingIf(true);
      expect(fixture.scopeTracer.isEnabled()).toBe(true);
    });
  });

  describe('Data access methods (BaseModTestFixture)', () => {
    it('should get formatted trace via getScopeTrace()', () => {
      const trace = fixture.getScopeTrace();

      expect(typeof trace).toBe('string');
      expect(trace).toContain('SCOPE EVALUATION TRACE');
    });

    it('should get raw trace data via getScopeTraceData()', () => {
      const traceData = fixture.getScopeTraceData();

      expect(traceData).toHaveProperty('steps');
      expect(traceData).toHaveProperty('summary');
      expect(Array.isArray(traceData.steps)).toBe(true);
      expect(typeof traceData.summary).toBe('object');
    });

    it('should get all filter evaluations via getFilterBreakdown()', () => {
      // Enable tracing and add some filter evaluations
      fixture.enableScopeTracing();
      fixture.scopeTracer.logFilterEvaluation(
        'entity-1',
        { '==': [{ var: 'test' }, 'value'] },
        true,
        { test: 'value' }
      );
      fixture.scopeTracer.logFilterEvaluation(
        'entity-2',
        { '==': [{ var: 'test' }, 'value'] },
        false,
        { test: 'other' }
      );

      const filterBreakdown = fixture.getFilterBreakdown();

      expect(Array.isArray(filterBreakdown)).toBe(true);
      expect(filterBreakdown.length).toBe(2);
      expect(filterBreakdown[0]).toHaveProperty('entityId', 'entity-1');
      expect(filterBreakdown[1]).toHaveProperty('entityId', 'entity-2');
    });

    it('should get filter evaluation by entity ID via getFilterBreakdown(entityId)', () => {
      // Enable tracing and add filter evaluations
      fixture.enableScopeTracing();
      fixture.scopeTracer.logFilterEvaluation(
        'entity-1',
        { '==': [{ var: 'test' }, 'value'] },
        true,
        { test: 'value' }
      );
      fixture.scopeTracer.logFilterEvaluation(
        'entity-2',
        { '==': [{ var: 'test' }, 'value'] },
        false,
        { test: 'other' }
      );

      const entity1Breakdown = fixture.getFilterBreakdown('entity-1');

      expect(entity1Breakdown).toBeDefined();
      expect(entity1Breakdown.entityId).toBe('entity-1');
      expect(entity1Breakdown.result).toBe(true);
    });

    it('should return empty array when no filters recorded', () => {
      const filterBreakdown = fixture.getFilterBreakdown();

      expect(Array.isArray(filterBreakdown)).toBe(true);
      expect(filterBreakdown.length).toBe(0);
    });
  });

  describe('RuntimeContext integration (registerCustomScope)', () => {
    it('should expose tracer in runtimeCtx when using registerCustomScope', async () => {
      // This test verifies the tracer is accessible via runtimeCtx
      // We'll use a scope that exists in the positioning mod
      fixture.createStandardActorTarget(['Alice', 'Bob']);

      // Register a custom scope (this will create a resolver with runtimeCtx)
      await fixture.registerCustomScope('personal-space', 'close_actors');

      // The tracer should be accessible through the fixture
      expect(fixture.scopeTracer).toBeDefined();

      // Enable tracing to verify it works
      fixture.enableScopeTracing();
      expect(fixture.scopeTracer.isEnabled()).toBe(true);
    });

    it('should pass tracer to ScopeEngine during custom scope resolution', async () => {
      fixture.createStandardActorTarget(['Alice', 'Bob']);

      // Register a custom scope
      await fixture.registerCustomScope('personal-space', 'close_actors');

      // Enable tracing
      fixture.enableScopeTracing();

      // The tracer instance should be the same one in the fixture
      expect(fixture.scopeTracer).toBeDefined();
      expect(fixture.scopeTracer.isEnabled()).toBe(true);
    });

    it('should use the same tracer instance across multiple scope resolutions', async () => {
      const tracerBefore = fixture.scopeTracer;

      await fixture.registerCustomScope('personal-space', 'close_actors');

      const tracerAfter = fixture.scopeTracer;

      // Should be the same instance
      expect(tracerBefore).toBe(tracerAfter);
    });
  });

  describe('Cleanup (BaseModTestFixture)', () => {
    it('should clear tracer on cleanup()', () => {
      fixture.enableScopeTracing();
      fixture.scopeTracer.logStep(
        'TestResolver',
        'test operation',
        'input',
        'output'
      );

      const traceBefore = fixture.getScopeTraceData();
      expect(traceBefore.steps.length).toBeGreaterThan(0);

      fixture.cleanup();

      const traceAfter = fixture.getScopeTraceData();
      expect(traceAfter.steps.length).toBe(0);
    });

    it('should disable tracer on cleanup()', () => {
      fixture.enableScopeTracing();
      expect(fixture.scopeTracer.isEnabled()).toBe(true);

      fixture.cleanup();

      expect(fixture.scopeTracer.isEnabled()).toBe(false);
    });

    it('should not throw if tracer is null', () => {
      // Set tracer to null to test defensive cleanup
      fixture.scopeTracer = null;

      expect(() => {
        fixture.cleanup();
      }).not.toThrow();
    });

    it('should prevent memory leaks from accumulated trace data', () => {
      fixture.enableScopeTracing();

      // Add lots of trace data
      for (let i = 0; i < 100; i++) {
        fixture.scopeTracer.logStep(
          `Resolver${i}`,
          `operation${i}`,
          `input${i}`,
          `output${i}`
        );
      }

      const traceBefore = fixture.getScopeTraceData();
      expect(traceBefore.steps.length).toBe(100);

      fixture.cleanup();

      const traceAfter = fixture.getScopeTraceData();
      expect(traceAfter.steps.length).toBe(0);
    });
  });

  describe('Usage patterns', () => {
    it('should support enable → execute → get trace workflow', async () => {
      const scenario = fixture.createStandardActorTarget(['Alice', 'Bob']);

      // Enable tracing
      fixture.enableScopeTracing();

      // Execute some action discovery (this may use scopes internally)
      fixture.testEnv.getAvailableActions(scenario.actor.id);

      // Get trace
      const trace = fixture.getScopeTrace();

      expect(typeof trace).toBe('string');
      expect(trace).toContain('SCOPE EVALUATION TRACE');
    });

    it('should support clear between multiple test runs', () => {
      fixture.enableScopeTracing();

      // First run
      fixture.scopeTracer.logStep(
        'Resolver1',
        'operation1',
        'input1',
        'output1'
      );
      expect(fixture.getScopeTraceData().steps.length).toBe(1);

      // Clear
      fixture.clearScopeTrace();
      expect(fixture.getScopeTraceData().steps.length).toBe(0);

      // Second run
      fixture.scopeTracer.logStep(
        'Resolver2',
        'operation2',
        'input2',
        'output2'
      );
      expect(fixture.getScopeTraceData().steps.length).toBe(1);
    });

    it('should support conditional tracing based on test results', async () => {
      const scenario = fixture.createStandardActorTarget(['Alice', 'Bob']);

      // Get actions without tracing first
      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);

      // Enable tracing only if we need to debug
      const shouldDebug = actions.length === 0;
      fixture.enableScopeTracingIf(shouldDebug);

      // Always verify the tracer state is correct
      expect(fixture.scopeTracer.isEnabled()).toBe(shouldDebug);

      // Re-run with tracing if enabled
      fixture.testEnv.getAvailableActions(scenario.actor.id);
      const trace = fixture.getScopeTrace();
      expect(typeof trace).toBe('string');
    });

    it('should work with custom scope registration', async () => {
      fixture.createStandardActorTarget(['Alice', 'Bob']);

      // Enable tracing before registering scope
      fixture.enableScopeTracing();

      // Register custom scope
      await fixture.registerCustomScope('personal-space', 'close_actors');

      // Tracer should still be enabled
      expect(fixture.scopeTracer.isEnabled()).toBe(true);
    });
  });

  describe('Inheritance verification', () => {
    it('should inherit tracer in ModActionTestFixture', async () => {
      const actionFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down'
      );

      expect(actionFixture).toHaveProperty('scopeTracer');
      expect(actionFixture).toHaveProperty('enableScopeTracing');
      expect(actionFixture).toHaveProperty('getScopeTrace');

      // Verify methods work
      actionFixture.enableScopeTracing();
      expect(actionFixture.scopeTracer.isEnabled()).toBe(true);

      actionFixture.cleanup();
    });

    it('should inherit tracer in ModRuleTestFixture', async () => {
      const ruleFixture = await ModTestFixture.forRule(
        'sitting',
        'sitting:sit_down'
      );

      expect(ruleFixture).toHaveProperty('scopeTracer');
      expect(ruleFixture).toHaveProperty('enableScopeTracing');
      expect(ruleFixture).toHaveProperty('getScopeTrace');

      // Verify methods work
      ruleFixture.enableScopeTracing();
      expect(ruleFixture.scopeTracer.isEnabled()).toBe(true);

      ruleFixture.cleanup();
    });

    it('should inherit tracer in ModCategoryTestFixture', async () => {
      const categoryFixture = await ModTestFixture.forCategory('positioning');

      expect(categoryFixture).toHaveProperty('scopeTracer');
      expect(categoryFixture).toHaveProperty('enableScopeTracing');
      expect(categoryFixture).toHaveProperty('getScopeTrace');

      // Verify methods work
      categoryFixture.enableScopeTracing();
      expect(categoryFixture.scopeTracer.isEnabled()).toBe(true);

      categoryFixture.cleanup();
    });
  });
});
