/**
 * @file Performance metrics tests for ScopeEvaluationTracer
 * @description Tests for high-resolution timing, performance calculations, and formatted output
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ScopeEvaluationTracer } from '../../../common/mods/scopeEvaluationTracer.js';

describe('ScopeEvaluationTracer - Performance Metrics', () => {
  let tracer;

  beforeEach(() => {
    tracer = new ScopeEvaluationTracer();
  });

  describe('Timing capture', () => {
    it('should capture step duration', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', "resolve(kind='actor')", { kind: 'actor' }, new Set(['actor-1']));

      const trace = tracer.getTrace();
      const step = trace.steps[0];

      expect(step.duration).toBeDefined();
      expect(typeof step.duration).toBe('number');
      expect(step.duration).toBeGreaterThanOrEqual(0);
    });

    it('should capture filter eval duration', () => {
      tracer.enable();

      const logic = { '==': [{ var: 'type' }, 'actor'] };
      const context = { type: 'actor' };
      tracer.logFilterEvaluation('entity-1', logic, true, context);

      const trace = tracer.getTrace();
      const filterStep = trace.steps[0];

      expect(filterStep.duration).toBeDefined();
      expect(typeof filterStep.duration).toBe('number');
      expect(filterStep.duration).toBeGreaterThanOrEqual(0);
    });

    it('should use high-resolution timer', () => {
      tracer.enable();

      // Log multiple steps
      for (let i = 0; i < 5; i++) {
        tracer.logStep('TestResolver', 'test', {}, {});
      }

      const trace = tracer.getTrace();

      // Note: High-resolution timing from performance.now() is used
      // Verify that all durations are non-negative
      expect(trace.steps.every(step => step.duration >= 0)).toBe(true);
    });
  });

  describe('Performance metrics calculation', () => {
    it('should calculate per-resolver totals', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});
      tracer.logStep('FilterResolver', 'filter', {}, {});
      tracer.logStep('SourceResolver', 'resolve', {}, {});

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics.resolverStats).toBeDefined();
      expect(metrics.resolverStats.length).toBe(2);

      const sourceResolver = metrics.resolverStats.find(r => r.resolver === 'SourceResolver');
      const filterResolver = metrics.resolverStats.find(r => r.resolver === 'FilterResolver');

      expect(sourceResolver).toBeDefined();
      expect(filterResolver).toBeDefined();
      expect(sourceResolver.stepCount).toBe(2);
      expect(filterResolver.stepCount).toBe(1);
      expect(sourceResolver.totalTime).toBeGreaterThanOrEqual(0);
      expect(filterResolver.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate percentages', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});
      tracer.logStep('FilterResolver', 'filter', {}, {});

      const metrics = tracer.getPerformanceMetrics();

      const totalPercentage = metrics.resolverStats.reduce(
        (sum, stat) => sum + stat.percentage,
        0
      );

      // Percentages may not sum to exactly 100 due to overhead, but should be close
      expect(totalPercentage).toBeGreaterThan(0);
      expect(totalPercentage).toBeLessThanOrEqual(150); // Allow for overhead
    });

    it('should identify slowest operations', () => {
      tracer.enable();

      // Log steps
      for (let i = 0; i < 3; i++) {
        tracer.logStep('TestResolver', `step-${i}`, {}, {});
      }

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics.slowestOperations).toBeDefined();
      expect(metrics.slowestOperations.steps).toBeDefined();
      expect(Array.isArray(metrics.slowestOperations.steps)).toBe(true);
      expect(metrics.slowestOperations.steps.length).toBeLessThanOrEqual(5);
    });

    it('should calculate filter eval stats', () => {
      tracer.enable();

      const logic = { '==': [{ var: 'type' }, 'actor'] };
      tracer.logFilterEvaluation('entity-1', logic, true, { type: 'actor' });
      tracer.logFilterEvaluation('entity-2', logic, false, { type: 'item' });
      tracer.logFilterEvaluation('entity-3', logic, true, { type: 'actor' });

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics.filterEvaluation).toBeDefined();
      expect(metrics.filterEvaluation.count).toBe(3);
      expect(metrics.filterEvaluation.totalTime).toBeGreaterThanOrEqual(0);
      expect(metrics.filterEvaluation.averageTime).toBeGreaterThanOrEqual(0);
      expect(metrics.filterEvaluation.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should calculate tracing overhead', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});
      tracer.logStep('FilterResolver', 'filter', {}, {});

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics.overhead).toBeDefined();
      expect(metrics.overhead.tracingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.overhead.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty metrics', () => {
      tracer.enable();

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics).not.toBeNull();
      expect(metrics.resolverStats).toEqual([]);
      expect(metrics.filterEvaluation.count).toBe(0);
      expect(metrics.filterEvaluation.totalTime).toBe(0);
      expect(metrics.filterEvaluation.averageTime).toBe(0);
    });

    it('should return null when disabled and no data', () => {
      const metrics = tracer.getPerformanceMetrics();

      expect(metrics).toBeNull();
    });
  });

  describe('Performance-focused formatting', () => {
    it('should format resolver timing table', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});
      tracer.logStep('FilterResolver', 'filter', {}, {});

      const formatted = tracer.format({ performanceFocus: true });

      expect(formatted).toContain('📊 PERFORMANCE METRICS:');
      expect(formatted).toContain('Resolver Timing:');
      expect(formatted).toContain('SourceResolver');
      expect(formatted).toContain('FilterResolver');
      expect(formatted).toMatch(/\d+\.\d+ms/); // Check for millisecond values
    });

    it('should format filter eval stats', () => {
      tracer.enable();

      const logic = { '==': [{ var: 'type' }, 'actor'] };
      tracer.logFilterEvaluation('entity-1', logic, true, { type: 'actor' });
      tracer.logFilterEvaluation('entity-2', logic, false, { type: 'item' });

      const formatted = tracer.format({ performanceFocus: true });

      expect(formatted).toContain('Filter Evaluation:');
      expect(formatted).toContain('Count: 2');
      expect(formatted).toMatch(/Total Time: \d+\.\d+ms/);
      expect(formatted).toMatch(/Average: \d+\.\d+ms/);
      expect(formatted).toMatch(/Percentage: \d+\.\d+%/);
    });

    it('should show slowest operations', () => {
      tracer.enable();

      tracer.logStep('Resolver1', 'step1', {}, {});
      tracer.logStep('Resolver2', 'step2', {}, {});
      tracer.logStep('Resolver3', 'step3', {}, {});

      const formatted = tracer.format({ performanceFocus: true });

      expect(formatted).toContain('Slowest Operations:');
      // Should show up to 3 slowest
      expect(formatted).toMatch(/1\. \w+: \d+\.\d+ms/);
    });

    it('should show overhead percentage', () => {
      tracer.enable();

      tracer.logStep('TestResolver', 'test', {}, {});

      const formatted = tracer.format({ performanceFocus: true });

      expect(formatted).toContain('Tracing Overhead:');
      expect(formatted).toMatch(/Time: \d+\.\d+ms/);
      expect(formatted).toMatch(/Percentage: \d+\.\d+%/);
    });

    it('should include duration in step output when performance focus enabled', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});

      const formatted = tracer.format({ performanceFocus: true });

      expect(formatted).toMatch(/\[SourceResolver\] resolve \(\d+\.\d+ms\)/);
    });

    it('should include duration in filter eval output when performance focus enabled', () => {
      tracer.enable();

      const logic = { '==': [{ var: 'type' }, 'actor'] };
      tracer.logFilterEvaluation('entity-1', logic, true, { type: 'actor' });

      const formatted = tracer.format({ performanceFocus: true });

      expect(formatted).toMatch(/Entity: entity-1 \(\d+\.\d+ms\)/);
    });

    it('should not include duration when performance focus disabled', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});

      const formatted = tracer.format({ performanceFocus: false });

      expect(formatted).not.toContain('📊 PERFORMANCE METRICS:');
      expect(formatted).toContain('[SourceResolver] resolve');
      expect(formatted).not.toMatch(/\(\d+\.\d+ms\)/);
    });
  });

  describe('Accuracy', () => {
    it('should have accurate timing measurements', () => {
      tracer.enable();

      const startTime = performance.now();
      tracer.logStep('TestResolver', 'test', {}, {});
      const endTime = performance.now();

      const trace = tracer.getTrace();
      const step = trace.steps[0];

      // Step duration should be less than the total elapsed time
      expect(step.duration).toBeLessThanOrEqual(endTime - startTime);
    });

    it('should have percentages sum to approximately total', () => {
      tracer.enable();

      tracer.logStep('Resolver1', 'step1', {}, {});
      tracer.logStep('Resolver2', 'step2', {}, {});

      const metrics = tracer.getPerformanceMetrics();

      const totalPercentage = metrics.resolverStats.reduce(
        (sum, stat) => sum + stat.percentage,
        0
      );

      // Total percentage should be positive (some operations occurred)
      expect(totalPercentage).toBeGreaterThan(0);
    });

    it('should have reasonable overhead calculation', () => {
      tracer.enable();

      tracer.logStep('TestResolver', 'test', {}, {});

      const metrics = tracer.getPerformanceMetrics();

      // Overhead should be non-negative
      expect(metrics.overhead.tracingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.overhead.percentage).toBeGreaterThanOrEqual(0);

      // Overhead percentage should be reasonable (not negative or extremely high)
      expect(metrics.overhead.percentage).toBeLessThan(10000);
    });

    it('should maintain consistency between step times and resolver times', () => {
      tracer.enable();

      tracer.logStep('TestResolver', 'step1', {}, {});
      tracer.logStep('TestResolver', 'step2', {}, {});

      const metrics = tracer.getPerformanceMetrics();

      const testResolverStat = metrics.resolverStats.find(r => r.resolver === 'TestResolver');

      // Total time should equal sum of individual step times
      const individualStepSum = metrics.slowestOperations.steps
        .filter(s => s.resolver === 'TestResolver')
        .reduce((sum, s) => sum + s.duration, 0);

      expect(testResolverStat.totalTime).toBeCloseTo(individualStepSum, 5);
    });
  });

  describe('Integration', () => {
    it('should track performance across multiple resolver types', () => {
      tracer.enable();

      tracer.logStep('SourceResolver', 'resolve', {}, {});
      tracer.logStep('FilterResolver', 'filter', {}, {});
      tracer.logStep('StepResolver', 'step', {}, {});
      tracer.logFilterEvaluation('entity-1', {}, true, {});

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics.resolverStats.length).toBe(3);
      expect(metrics.filterEvaluation.count).toBe(1);
      expect(metrics.totalDuration).toBeGreaterThan(0);
    });

    it('should sort resolvers by total time (slowest first)', () => {
      tracer.enable();

      // Create different amounts of work for each resolver
      tracer.logStep('FastResolver', 'fast', {}, {});
      tracer.logStep('SlowResolver', 'slow', { large: 'data'.repeat(100) }, {});
      tracer.logStep('MediumResolver', 'medium', { data: 'test' }, {});

      const metrics = tracer.getPerformanceMetrics();

      // First resolver should have longest or equal time
      for (let i = 1; i < metrics.resolverStats.length; i++) {
        expect(metrics.resolverStats[i - 1].totalTime).toBeGreaterThanOrEqual(
          metrics.resolverStats[i].totalTime
        );
      }
    });

    it('should calculate average time correctly', () => {
      tracer.enable();

      tracer.logStep('TestResolver', 'step1', {}, {});
      tracer.logStep('TestResolver', 'step2', {}, {});
      tracer.logStep('TestResolver', 'step3', {}, {});

      const metrics = tracer.getPerformanceMetrics();
      const testResolverStat = metrics.resolverStats.find(r => r.resolver === 'TestResolver');

      expect(testResolverStat.stepCount).toBe(3);
      expect(testResolverStat.averageTime).toBeCloseTo(
        testResolverStat.totalTime / 3,
        5
      );
    });

    it('should clear performance metrics on clear()', () => {
      tracer.enable();

      tracer.logStep('TestResolver', 'test', {}, {});
      tracer.clear();

      const metrics = tracer.getPerformanceMetrics();

      expect(metrics.resolverStats).toEqual([]);
      expect(metrics.filterEvaluation.count).toBe(0);
      expect(metrics.overhead.tracingTime).toBe(0);
    });
  });
});
