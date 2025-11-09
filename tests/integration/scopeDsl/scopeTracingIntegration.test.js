/**
 * @file Integration test for Scope Tracing
 * @description Tests complete trace capture through ScopeEngine and resolvers
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ScopeEvaluationTracer } from '../../common/mods/scopeEvaluationTracer.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('Scope Tracing Integration', () => {
  let testFixture;
  let tracer;
  let scopeEngine;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
    tracer = new ScopeEvaluationTracer();
    scopeEngine = new ScopeEngine();
  });

  afterEach(() => {
    if (testFixture?.cleanup) {
      testFixture.cleanup();
    }
  });

  describe('Complete trace capture', () => {
    it('should capture SourceResolver step', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      // Execute a simple scope resolution that uses SourceResolver
      const ast = { type: 'Source', kind: 'actor' };
      const result = scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      expect(result).toBeDefined();
      expect(result instanceof Set).toBe(true);

      const trace = tracer.getTrace();
      const resolverSteps = trace.steps.filter(s => s.type === 'RESOLVER_STEP');
      const sourceResolverStep = resolverSteps.find(s => s.resolver === 'SourceResolver');

      expect(sourceResolverStep).toBeDefined();
      expect(sourceResolverStep.operation).toContain("resolve(kind='actor')");
    });

    it('should capture StepResolver step', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      // Execute a scope resolution that uses StepResolver
      const ast = {
        type: 'Step',
        field: 'components.positioning:sitting.on',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      };

      const result = scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      expect(result).toBeDefined();

      const trace = tracer.getTrace();
      const resolverSteps = trace.steps.filter(s => s.type === 'RESOLVER_STEP');
      const stepResolverStep = resolverSteps.find(s => s.resolver === 'StepResolver');

      expect(stepResolverStep).toBeDefined();
      expect(stepResolverStep.operation).toContain("resolve(field=");
    });

    it('should capture FilterResolver step', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      // Execute a scope resolution that uses FilterResolver
      const ast = {
        type: 'Filter',
        logic: { '==': [{ var: 'entity.id' }, scenario.actor.id] },
        parent: {
          type: 'Source',
          kind: 'entities',
          param: 'core:actor',
        },
      };

      const result = scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      expect(result).toBeDefined();

      const trace = tracer.getTrace();
      const resolverSteps = trace.steps.filter(s => s.type === 'RESOLVER_STEP');
      const filterResolverStep = resolverSteps.find(s => s.resolver === 'FilterResolver');

      expect(filterResolverStep).toBeDefined();
      expect(filterResolverStep.operation).toBe('resolve(filter)');
    });

    it('should capture filter evaluations', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      // Execute a scope resolution with a filter
      const ast = {
        type: 'Filter',
        logic: { '==': [{ var: 'entity.id' }, scenario.actor.id] },
        parent: {
          type: 'Source',
          kind: 'entities',
          param: 'core:actor',
        },
      };

      const result = scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      expect(result).toBeDefined();

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations.length).toBeGreaterThan(0);

      // Verify filter evaluation structure
      expect(filterEvaluations.length).toBeGreaterThan(0);
      const firstEval = filterEvaluations[0];
      expect(firstEval.entityId).toBeDefined();
      expect(firstEval.logic).toBeDefined();
      expect(firstEval.context).toBeDefined();
      // Result should be a boolean if defined
      expect(['boolean', 'undefined']).toContain(typeof firstEval.result);
    });
  });

  describe('Trace data', () => {
    it('should have correct step count', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = {
        type: 'Filter',
        logic: { '==': [1, 1] },
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const trace = tracer.getTrace();

      expect(trace.steps.length).toBeGreaterThan(0);
      expect(trace.summary).toBeDefined();
      expect(trace.summary.totalSteps).toBe(trace.steps.length);
    });

    it('should list resolvers used', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = {
        type: 'Filter',
        logic: { '==': [1, 1] },
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const trace = tracer.getTrace();

      expect(trace.summary.resolversUsed).toBeDefined();
      expect(Array.isArray(trace.summary.resolversUsed)).toBe(true);
      expect(trace.summary.resolversUsed.length).toBeGreaterThan(0);
    });

    it('should calculate duration', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = { type: 'Source', kind: 'actor' };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const trace = tracer.getTrace();

      expect(trace.summary.duration).toBeDefined();
      expect(typeof trace.summary.duration).toBe('number');
      expect(trace.summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('should preserve final output', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = { type: 'Source', kind: 'actor' };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const trace = tracer.getTrace();

      expect(trace.summary.finalOutput).toBeDefined();
      expect(trace.summary.finalOutputSize).toBeDefined();
      expect(typeof trace.summary.finalOutputSize).toBe('number');
    });
  });

  describe('Formatted output', () => {
    it('should format as human-readable text', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = { type: 'Source', kind: 'actor' };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const formatted = tracer.format();

      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).toContain('SCOPE EVALUATION TRACE:');
    });

    it('should include all steps', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = {
        type: 'Filter',
        logic: { '==': [1, 1] },
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const formatted = tracer.format();
      const trace = tracer.getTrace();

      // Should contain references to resolvers
      expect(formatted).toContain('SourceResolver');

      // Verify summary is included
      expect(formatted).toContain('Summary:');
      expect(formatted).toContain(`${trace.summary.totalSteps} steps`);
    });

    it('should include summary', () => {
      tracer.enable();

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
      const runtimeCtx = {
        entityManager: testFixture.testEnv.entityManager,
        jsonLogicEval: testFixture.testEnv.jsonLogicEval,
        logger: testFixture.testEnv.logger,
        tracer: tracer,
      };

      const ast = { type: 'Source', kind: 'actor' };

      scopeEngine.resolve(ast, scenario.actor, runtimeCtx);

      const formatted = tracer.format();

      expect(formatted).toContain('Summary:');
      expect(formatted).toContain('steps');
      expect(formatted).toContain('ms');
      expect(formatted).toContain('Final size:');
    });
  });
});
