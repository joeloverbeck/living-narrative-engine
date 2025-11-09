/**
 * @file Unit tests for ScopeEvaluationTracer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ScopeEvaluationTracer } from '../../../../tests/common/mods/scopeEvaluationTracer.js';

describe('ScopeEvaluationTracer', () => {
  let tracer;

  beforeEach(() => {
    tracer = new ScopeEvaluationTracer();
  });

  describe('State management', () => {
    it('should start disabled', () => {
      expect(tracer.isEnabled()).toBe(false);
    });

    it('should enable tracing', () => {
      tracer.enable();
      expect(tracer.isEnabled()).toBe(true);
    });

    it('should disable tracing', () => {
      tracer.enable();
      tracer.disable();
      expect(tracer.isEnabled()).toBe(false);
    });

    it('should track enabled state', () => {
      expect(tracer.isEnabled()).toBe(false);
      tracer.enable();
      expect(tracer.isEnabled()).toBe(true);
      tracer.disable();
      expect(tracer.isEnabled()).toBe(false);
    });
  });

  describe('Step logging', () => {
    it('should log resolver step when enabled', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', "resolve(kind='actor')", { type: 'Context' }, new Set(['actor-123']));

      const trace = tracer.getTrace();
      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].type).toBe('RESOLVER_STEP');
      expect(trace.steps[0].resolver).toBe('SourceResolver');
      expect(trace.steps[0].operation).toBe("resolve(kind='actor')");
    });

    it('should not log when disabled', () => {
      tracer.logStep('SourceResolver', "resolve(kind='actor')", { type: 'Context' }, new Set(['actor-123']));

      const trace = tracer.getTrace();
      expect(trace.steps).toHaveLength(0);
    });

    it('should serialize Set input/output', () => {
      tracer.enable();
      const inputSet = new Set(['entity-1', 'entity-2', 'entity-3']);
      const outputSet = new Set(['entity-1']);

      tracer.logStep('FilterResolver', 'filter(logic)', inputSet, outputSet);

      const trace = tracer.getTrace();
      const step = trace.steps[0];

      expect(step.input.type).toBe('Set');
      expect(step.input.size).toBe(3);
      expect(step.input.values).toEqual(['entity-1', 'entity-2', 'entity-3']);
      expect(step.input.truncated).toBe(false);

      expect(step.output.type).toBe('Set');
      expect(step.output.size).toBe(1);
      expect(step.output.values).toEqual(['entity-1']);
      expect(step.output.truncated).toBe(false);
    });

    it('should serialize Array input/output', () => {
      tracer.enable();
      const inputArray = ['a', 'b', 'c'];
      const outputArray = ['a'];

      tracer.logStep('StepResolver', 'resolve(field)', inputArray, outputArray);

      const trace = tracer.getTrace();
      const step = trace.steps[0];

      expect(step.input.type).toBe('Array');
      expect(step.input.size).toBe(3);
      expect(step.input.values).toEqual(['a', 'b', 'c']);
      expect(step.input.truncated).toBe(false);

      expect(step.output.type).toBe('Array');
      expect(step.output.size).toBe(1);
      expect(step.output.values).toEqual(['a']);
      expect(step.output.truncated).toBe(false);
    });

    it('should serialize Object input/output', () => {
      tracer.enable();
      const inputObj = { foo: 'bar', baz: 'qux' };
      const outputObj = { result: 'value' };

      tracer.logStep('SourceResolver', 'resolve()', inputObj, outputObj);

      const trace = tracer.getTrace();
      const step = trace.steps[0];

      expect(step.input.type).toBe('Object');
      expect(step.input.keys).toEqual(['foo', 'baz']);

      expect(step.output.type).toBe('Object');
      expect(step.output.keys).toEqual(['result']);
    });

    it('should limit large collections to 10 items', () => {
      tracer.enable();
      const largeSet = new Set(Array.from({ length: 20 }, (_, i) => `entity-${i}`));
      const largeArray = Array.from({ length: 15 }, (_, i) => i);

      tracer.logStep('FilterResolver', 'filter()', largeSet, largeArray);

      const trace = tracer.getTrace();
      const step = trace.steps[0];

      expect(step.input.type).toBe('Set');
      expect(step.input.size).toBe(20);
      expect(step.input.values).toHaveLength(10);
      expect(step.input.truncated).toBe(true);

      expect(step.output.type).toBe('Array');
      expect(step.output.size).toBe(15);
      expect(step.output.values).toHaveLength(10);
      expect(step.output.truncated).toBe(true);
    });
  });

  describe('Filter evaluation logging', () => {
    it('should log filter evaluation', () => {
      tracer.enable();
      tracer.logFilterEvaluation(
        'entity-456',
        { '==': [1, 1] },
        true,
        { var1: 'value1' }
      );

      const trace = tracer.getTrace();
      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].type).toBe('FILTER_EVALUATION');
      expect(trace.steps[0].entityId).toBe('entity-456');
      expect(trace.steps[0].logic).toEqual({ '==': [1, 1] });
      expect(trace.steps[0].result).toBe(true);
      expect(trace.steps[0].context).toEqual({ var1: 'value1' });
    });

    it('should include entity ID', () => {
      tracer.enable();
      tracer.logFilterEvaluation('entity-123', {}, true, {});

      const trace = tracer.getTrace();
      expect(trace.steps[0].entityId).toBe('entity-123');
    });

    it('should include result (pass/fail)', () => {
      tracer.enable();
      tracer.logFilterEvaluation('entity-1', {}, true, {});
      tracer.logFilterEvaluation('entity-2', {}, false, {});

      const trace = tracer.getTrace();
      expect(trace.steps[0].result).toBe(true);
      expect(trace.steps[1].result).toBe(false);
    });

    it('should include breakdown if provided', () => {
      tracer.enable();
      const breakdown = {
        and: {
          'condition_ref': false,
          '==': true,
        },
      };

      tracer.logFilterEvaluation('entity-1', {}, false, {}, breakdown);

      const trace = tracer.getTrace();
      expect(trace.steps[0].breakdown).toEqual(breakdown);
    });
  });

  describe('Error logging', () => {
    it('should log errors with phase', () => {
      tracer.enable();
      const error = new Error('Test error');
      tracer.logError('resolution', error, { node: 'Source' });

      const trace = tracer.getTrace();
      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].type).toBe('ERROR');
      expect(trace.steps[0].phase).toBe('resolution');
    });

    it('should capture error message and stack', () => {
      tracer.enable();
      const error = new Error('Test error message');
      tracer.logError('validation', error);

      const trace = tracer.getTrace();
      const errorStep = trace.steps[0];

      expect(errorStep.error.message).toBe('Test error message');
      expect(errorStep.error.name).toBe('Error');
      expect(errorStep.error.stack).toBeTruthy();
    });

    it('should include error context', () => {
      tracer.enable();
      const error = new Error('Test error');
      const context = { entityId: 'entity-123', operation: 'resolve' };
      tracer.logError('execution', error, context);

      const trace = tracer.getTrace();
      expect(trace.steps[0].context).toEqual(context);
    });
  });

  describe('Trace data', () => {
    it('should return raw trace data', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set(['actor-1']));
      tracer.logFilterEvaluation('actor-1', {}, true, {});

      const trace = tracer.getTrace();
      expect(trace.steps).toHaveLength(2);
      expect(trace.summary).toBeDefined();
    });

    it('should calculate summary statistics', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set(['actor-1']));
      tracer.logStep('FilterResolver', 'filter()', new Set(['actor-1']), new Set(['actor-1']));
      tracer.logFilterEvaluation('actor-1', {}, true, {});
      tracer.logError('test', new Error('test'), {});

      const trace = tracer.getTrace();
      const { summary } = trace;

      expect(summary.totalSteps).toBe(4);
      expect(summary.resolverSteps).toBe(2);
      expect(summary.filterEvaluations).toBe(1);
      expect(summary.errors).toBe(1);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track resolvers used', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
      tracer.logStep('StepResolver', 'resolve()', new Set(), new Set());
      tracer.logStep('FilterResolver', 'filter()', new Set(), new Set());

      const trace = tracer.getTrace();
      expect(trace.summary.resolversUsed).toEqual([
        'SourceResolver',
        'StepResolver',
        'FilterResolver',
      ]);
    });

    it('should preserve final output', () => {
      tracer.enable();
      const finalOutput = new Set(['entity-1', 'entity-2']);
      tracer.logStep('SourceResolver', 'resolve()', {}, finalOutput);

      const trace = tracer.getTrace();
      expect(trace.summary.finalOutput).toBeDefined();
      expect(trace.summary.finalOutput.type).toBe('Set');
      expect(trace.summary.finalOutput.size).toBe(2);
    });

    it('should calculate duration', () => {
      tracer.enable();
      // Wait a bit to ensure duration > 0
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      return wait(10).then(() => {
        tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
        const trace = tracer.getTrace();
        expect(trace.summary.duration).toBeGreaterThan(0);
      });
    });
  });

  describe('Formatting', () => {
    it('should format empty trace', () => {
      const formatted = tracer.format();
      expect(formatted).toContain('SCOPE EVALUATION TRACE:');
      expect(formatted).toContain('No steps recorded.');
    });

    it('should format resolver steps', () => {
      tracer.enable();
      tracer.logStep(
        'SourceResolver',
        "resolve(kind='actor')",
        { type: 'Context' },
        new Set(['actor-123'])
      );

      const formatted = tracer.format();
      expect(formatted).toContain('1. [SourceResolver]');
      expect(formatted).toContain("resolve(kind='actor')");
      expect(formatted).toContain('Input:');
      expect(formatted).toContain('Output:');
      expect(formatted).toContain("Set (1 item) ['actor-123']");
    });

    it('should format filter evaluations', () => {
      tracer.enable();
      tracer.logFilterEvaluation('entity-1', {}, true, {});
      tracer.logFilterEvaluation('entity-2', {}, false, {});

      const formatted = tracer.format();
      expect(formatted).toContain('[FilterResolver]');
      expect(formatted).toContain('Evaluating 2 entities');
      expect(formatted).toContain('Entity: entity-1');
      expect(formatted).toContain('Result: PASS ✓');
      expect(formatted).toContain('Entity: entity-2');
      expect(formatted).toContain('Result: FAIL ✗');
    });

    it('should format errors', () => {
      tracer.enable();
      tracer.logError('resolution', new Error('Test error'), { node: 'Source' });

      const formatted = tracer.format();
      expect(formatted).toContain('[ERROR] resolution');
      expect(formatted).toContain('Error: Test error');
    });

    it('should format complete trace', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', "resolve(kind='actor')", {}, new Set(['actor-1']));
      tracer.logStep('StepResolver', 'resolve(field)', new Set(['actor-1']), new Set(['target-1', 'target-2']));
      tracer.logFilterEvaluation('target-1', { '==': [1, 1] }, false, {});
      tracer.logFilterEvaluation('target-2', { '==': [1, 1] }, true, {});

      const formatted = tracer.format();
      expect(formatted).toContain('SCOPE EVALUATION TRACE:');
      expect(formatted).toContain('1. [SourceResolver]');
      expect(formatted).toContain('2. [StepResolver]');
      expect(formatted).toContain('3. [FilterResolver]');
      expect(formatted).toContain('Summary:');
    });

    it('should include summary section', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set(['entity-1']));

      const formatted = tracer.format();
      expect(formatted).toContain('Summary:');
      expect(formatted).toMatch(/\d+ steps/);
      expect(formatted).toMatch(/\d+ms/);
      expect(formatted).toMatch(/Final size: \d+/);
    });

    it('should use ✓/✗ symbols', () => {
      tracer.enable();
      tracer.logFilterEvaluation('entity-1', {}, true, {});
      tracer.logFilterEvaluation('entity-2', {}, false, {});

      const formatted = tracer.format();
      expect(formatted).toContain('✓');
      expect(formatted).toContain('✗');
    });
  });

  describe('Clear', () => {
    it('should clear steps array', () => {
      tracer.enable();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
      tracer.logFilterEvaluation('entity-1', {}, true, {});

      expect(tracer.getTrace().steps).toHaveLength(2);

      tracer.clear();

      expect(tracer.getTrace().steps).toHaveLength(0);
    });

    it('should reset start time', () => {
      tracer.enable();
      const firstTime = Date.now();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set());

      // Wait and clear
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      return wait(10).then(() => {
        tracer.clear();
        const secondTime = Date.now();

        tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
        const trace = tracer.getTrace();

        // Duration should be measured from clear time, not original enable time
        expect(trace.summary.duration).toBeLessThan(secondTime - firstTime);
      });
    });

    it('should preserve enabled state', () => {
      tracer.enable();
      expect(tracer.isEnabled()).toBe(true);

      tracer.clear();
      expect(tracer.isEnabled()).toBe(true);

      tracer.disable();
      expect(tracer.isEnabled()).toBe(false);

      tracer.clear();
      expect(tracer.isEnabled()).toBe(false);
    });
  });

  describe('Value serialization edge cases', () => {
    it('should handle primitive types', () => {
      tracer.enable();

      tracer.logStep('Test', 'test', 'string value', 42);
      tracer.logStep('Test', 'test', true, null);
      tracer.logStep('Test', 'test', undefined, 3.14);

      const trace = tracer.getTrace();

      expect(trace.steps[0].input.type).toBe('String');
      expect(trace.steps[0].input.value).toBe('string value');
      expect(trace.steps[0].output.type).toBe('Number');
      expect(trace.steps[0].output.value).toBe(42);

      expect(trace.steps[1].input.type).toBe('Boolean');
      expect(trace.steps[1].input.value).toBe(true);
      expect(trace.steps[1].output.type).toBe('Object');
      expect(trace.steps[1].output.value).toBe(null);

      expect(trace.steps[2].input.type).toBe('Undefined');
      expect(trace.steps[2].output.type).toBe('Number');
      expect(trace.steps[2].output.value).toBe(3.14);
    });

    it('should handle empty collections', () => {
      tracer.enable();

      tracer.logStep('Test', 'test', new Set(), []);

      const trace = tracer.getTrace();

      expect(trace.steps[0].input.type).toBe('Set');
      expect(trace.steps[0].input.size).toBe(0);
      expect(trace.steps[0].input.values).toEqual([]);
      expect(trace.steps[0].input.truncated).toBe(false);

      expect(trace.steps[0].output.type).toBe('Array');
      expect(trace.steps[0].output.size).toBe(0);
      expect(trace.steps[0].output.values).toEqual([]);
      expect(trace.steps[0].output.truncated).toBe(false);
    });

    it('should handle nested objects', () => {
      tracer.enable();

      const nestedObj = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
        array: [1, 2, 3],
      };

      tracer.logStep('Test', 'test', nestedObj, {});

      const trace = tracer.getTrace();

      expect(trace.steps[0].input.type).toBe('Object');
      expect(trace.steps[0].input.keys).toContain('level1');
      expect(trace.steps[0].input.keys).toContain('array');
    });
  });

  describe('Performance characteristics', () => {
    it('should have minimal overhead when disabled', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
        tracer.logFilterEvaluation(`entity-${i}`, {}, true, {});
        tracer.logError('test', new Error('test'), {});
      }

      const duration = Date.now() - start;

      // Should complete very quickly when disabled (< 50ms for 3000 no-op calls)
      expect(duration).toBeLessThan(50);
      expect(tracer.getTrace().steps).toHaveLength(0);
    });

    it('should have acceptable overhead when enabled', () => {
      tracer.enable();
      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        tracer.logStep('SourceResolver', 'resolve()', {}, new Set([`entity-${i}`]));
        tracer.logFilterEvaluation(`entity-${i}`, { '==': [1, 1] }, true, {});
      }

      const duration = Date.now() - start;

      // Should complete within reasonable time when enabled (< 100ms for 200 calls with serialization)
      expect(duration).toBeLessThan(100);
      expect(tracer.getTrace().steps).toHaveLength(200);
    });
  });

  describe('Breakdown formatting', () => {
    it('should format nested breakdown with symbols', () => {
      tracer.enable();

      const breakdown = {
        and: {
          'condition_ref:positioning:facing-away': false,
          '==': true,
        },
      };

      tracer.logFilterEvaluation('entity-1', {}, false, {}, breakdown);

      const formatted = tracer.format();
      expect(formatted).toContain('Breakdown:');
      expect(formatted).toContain('and:');
      expect(formatted).toContain('✗ condition_ref:positioning:facing-away');
      expect(formatted).toContain('✓ ==');
    });

    it('should handle multi-level breakdown', () => {
      tracer.enable();

      const breakdown = {
        or: {
          first: {
            and: {
              a: true,
              b: false,
            },
          },
          second: true,
        },
      };

      tracer.logFilterEvaluation('entity-1', {}, true, {}, breakdown);

      const formatted = tracer.format();
      expect(formatted).toContain('Breakdown:');
      expect(formatted).toContain('or:');
      expect(formatted).toContain('first:');
      expect(formatted).toContain('and:');
      expect(formatted).toContain('✓ a');
      expect(formatted).toContain('✗ b');
      expect(formatted).toContain('✓ second');
    });
  });

  describe('Multiple filter evaluations grouping', () => {
    it('should group consecutive filter evaluations into one step', () => {
      tracer.enable();

      // Simulate a FilterResolver evaluating 3 entities
      tracer.logFilterEvaluation('entity-1', { '==': [1, 1] }, true, {});
      tracer.logFilterEvaluation('entity-2', { '==': [1, 2] }, false, {});
      tracer.logFilterEvaluation('entity-3', { '==': [1, 1] }, true, {});

      const formatted = tracer.format();

      // Should be grouped as a single FilterResolver step
      expect(formatted).toContain('1. [FilterResolver] Evaluating 3 entities');
      expect(formatted).toContain('Entity: entity-1');
      expect(formatted).toContain('Entity: entity-2');
      expect(formatted).toContain('Entity: entity-3');

      // Output should show only passed entities
      expect(formatted).toContain("Output: Set (2 items) ['entity-1', 'entity-3']");
    });

    it('should separate filter groups when resolver steps are interleaved', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve()', {}, new Set(['actor-1']));
      tracer.logFilterEvaluation('entity-1', {}, true, {});
      tracer.logFilterEvaluation('entity-2', {}, false, {});
      tracer.logStep('StepResolver', 'resolve()', new Set(['entity-1']), new Set(['target-1']));
      tracer.logFilterEvaluation('target-1', {}, true, {});

      const formatted = tracer.format();

      // Should have two separate FilterResolver steps
      expect(formatted).toContain('1. [SourceResolver]');
      expect(formatted).toContain('2. [FilterResolver] Evaluating 2 entities');
      expect(formatted).toContain('3. [StepResolver]');
      expect(formatted).toContain('4. [FilterResolver] Evaluating 1 entity');
    });
  });

  describe('Timestamp tracking', () => {
    it('should include timestamp for each step', () => {
      tracer.enable();

      const before = Date.now();
      tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
      const after = Date.now();

      const trace = tracer.getTrace();
      const timestamp = trace.steps[0].timestamp;

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should have monotonically increasing timestamps', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve()', {}, new Set());
      tracer.logFilterEvaluation('entity-1', {}, true, {});
      tracer.logError('test', new Error('test'), {});

      const trace = tracer.getTrace();

      expect(trace.steps[1].timestamp).toBeGreaterThanOrEqual(trace.steps[0].timestamp);
      expect(trace.steps[2].timestamp).toBeGreaterThanOrEqual(trace.steps[1].timestamp);
    });
  });
});
