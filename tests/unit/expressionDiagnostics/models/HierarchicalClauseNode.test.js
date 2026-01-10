/**
 * @file Unit tests for HierarchicalClauseNode
 * @see src/expressionDiagnostics/models/HierarchicalClauseNode.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import HierarchicalClauseNode from '../../../../src/expressionDiagnostics/models/HierarchicalClauseNode.js';

describe('HierarchicalClauseNode', () => {
  describe('constructor', () => {
    it('should create a leaf node with required parameters', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
      });

      expect(node.id).toBe('0');
      expect(node.nodeType).toBe('leaf');
      expect(node.description).toBe('emotions.joy >= 0.5');
      expect(node.logic).toBeNull();
      expect(node.children).toEqual([]);
      expect(node.failureCount).toBe(0);
      expect(node.evaluationCount).toBe(0);
      expect(node.violationSum).toBe(0);
    });

    it('should create a compound node with children', () => {
      const child1 = new HierarchicalClauseNode({
        id: '0.0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
      });
      const child2 = new HierarchicalClauseNode({
        id: '0.1',
        nodeType: 'leaf',
        description: 'emotions.fear <= 0.3',
      });

      const parent = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'AND of 2 conditions',
        children: [child1, child2],
      });

      expect(parent.nodeType).toBe('and');
      expect(parent.children).toHaveLength(2);
      expect(parent.children[0].id).toBe('0.0');
      expect(parent.children[1].id).toBe('0.1');
    });

    it('should accept logic for leaf nodes', () => {
      const logic = { '>=': [{ var: 'emotions.joy' }, 0.5] };
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        logic,
      });

      expect(node.logic).toEqual(logic);
    });

    it('should throw error for empty id', () => {
      expect(
        () =>
          new HierarchicalClauseNode({
            id: '',
            nodeType: 'leaf',
            description: 'test',
          })
      ).toThrow('id must be a non-empty string');
    });

    it('should throw error for invalid nodeType', () => {
      expect(
        () =>
          new HierarchicalClauseNode({
            id: '0',
            nodeType: 'invalid',
            description: 'test',
          })
      ).toThrow("nodeType must be 'and', 'or', or 'leaf'");
    });

    it('should throw error for non-string description', () => {
      expect(
        () =>
          new HierarchicalClauseNode({
            id: '0',
            nodeType: 'leaf',
            description: null,
          })
      ).toThrow('description must be a string');
    });
  });

  describe('recordEvaluation', () => {
    let node;

    beforeEach(() => {
      node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test condition',
      });
    });

    it('should track passing evaluations', () => {
      node.recordEvaluation(true);
      node.recordEvaluation(true);
      node.recordEvaluation(true);

      expect(node.evaluationCount).toBe(3);
      expect(node.failureCount).toBe(0);
      expect(node.failureRate).toBe(0);
    });

    it('should track failing evaluations', () => {
      node.recordEvaluation(false);
      node.recordEvaluation(false);

      expect(node.evaluationCount).toBe(2);
      expect(node.failureCount).toBe(2);
      expect(node.failureRate).toBe(1);
    });

    it('should track mixed evaluations', () => {
      node.recordEvaluation(true);
      node.recordEvaluation(false);
      node.recordEvaluation(true);
      node.recordEvaluation(false);

      expect(node.evaluationCount).toBe(4);
      expect(node.failureCount).toBe(2);
      expect(node.failureRate).toBe(0.5);
    });

    it('should accumulate violation sum for failures', () => {
      node.recordEvaluation(false, 0.3);
      node.recordEvaluation(false, 0.2);
      node.recordEvaluation(true);

      expect(node.violationSum).toBe(0.5);
      expect(node.averageViolation).toBe(0.25);
    });

    it('should ignore violation for passing evaluations', () => {
      node.recordEvaluation(true, 0.5);

      expect(node.violationSum).toBe(0);
    });

    it('should handle zero violation', () => {
      node.recordEvaluation(false, 0);

      expect(node.failureCount).toBe(1);
      expect(node.violationSum).toBe(0);
    });
  });

  describe('computed properties', () => {
    it('should calculate failureRate correctly', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      expect(node.failureRate).toBe(0);

      node.recordEvaluation(true);
      node.recordEvaluation(false);
      node.recordEvaluation(false);
      node.recordEvaluation(true);

      expect(node.failureRate).toBe(0.5);
    });

    it('should return 0 failureRate when no evaluations', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      expect(node.failureRate).toBe(0);
    });

    it('should calculate averageViolation correctly', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      node.recordEvaluation(false, 0.4);
      node.recordEvaluation(false, 0.6);

      expect(node.averageViolation).toBe(0.5);
    });

    it('should return 0 averageViolation when no failures', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      node.recordEvaluation(true);

      expect(node.averageViolation).toBe(0);
    });

    it('should identify compound nodes correctly', () => {
      const andNode = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'AND node',
      });
      const orNode = new HierarchicalClauseNode({
        id: '1',
        nodeType: 'or',
        description: 'OR node',
      });
      const leafNode = new HierarchicalClauseNode({
        id: '2',
        nodeType: 'leaf',
        description: 'Leaf node',
      });

      expect(andNode.isCompound).toBe(true);
      expect(orNode.isCompound).toBe(true);
      expect(leafNode.isCompound).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to zero', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      node.recordEvaluation(false, 0.5);
      node.recordEvaluation(true);

      node.resetStats();

      expect(node.failureCount).toBe(0);
      expect(node.evaluationCount).toBe(0);
      expect(node.violationSum).toBe(0);
      expect(node.failureRate).toBe(0);
      expect(node.averageViolation).toBe(0);
    });

    it('should recursively reset children', () => {
      const child = new HierarchicalClauseNode({
        id: '0.0',
        nodeType: 'leaf',
        description: 'child',
      });
      const parent = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'parent',
        children: [child],
      });

      child.recordEvaluation(false, 0.3);
      parent.recordEvaluation(false);

      parent.resetStats();

      expect(parent.failureCount).toBe(0);
      expect(child.failureCount).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize a leaf node', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
      });

      node.recordEvaluation(true);
      node.recordEvaluation(false, 0.2);

      const json = node.toJSON();

      expect(json).toEqual({
        id: '0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        failureCount: 1,
        evaluationCount: 2,
        failureRate: 0.5,
        averageViolation: 0.2,
        violationP50: 0.2,
        violationP90: 0.2,
        isCompound: false,
        thresholdValue: null,
        comparisonOperator: null,
        variablePath: null,
        violationSampleCount: 1,
        maxObservedValue: null,
        observedP99: null,
        ceilingGap: null,
        nearMissCount: 0,
        nearMissRate: 0,
        nearMissEpsilon: null,
        lastMileFailCount: 0,
        othersPassedCount: 0,
        lastMileFailRate: null,
        isSingleClause: false,
        children: [],
      });
    });

    it('should serialize a tree with children', () => {
      const child = new HierarchicalClauseNode({
        id: '0.0',
        nodeType: 'leaf',
        description: 'child condition',
      });
      const parent = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'AND of 1 condition',
        children: [child],
      });

      child.recordEvaluation(false, 0.1);
      parent.recordEvaluation(false);

      const json = parent.toJSON();

      expect(json.isCompound).toBe(true);
      expect(json.children).toHaveLength(1);
      expect(json.children[0].id).toBe('0.0');
      expect(json.children[0].failureCount).toBe(1);
    });
  });

  describe('fromJSON', () => {
    it('should recreate a node from JSON', () => {
      const original = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test condition',
      });

      original.recordEvaluation(true);
      original.recordEvaluation(false, 0.3);
      original.recordEvaluation(false, 0.3);

      const json = original.toJSON();
      const restored = HierarchicalClauseNode.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.nodeType).toBe(original.nodeType);
      expect(restored.description).toBe(original.description);
      expect(restored.evaluationCount).toBe(original.evaluationCount);
      expect(restored.failureCount).toBe(original.failureCount);
      expect(restored.failureRate).toBeCloseTo(original.failureRate, 5);
    });

    it('should recreate a tree with children from JSON', () => {
      const child = new HierarchicalClauseNode({
        id: '0.0',
        nodeType: 'leaf',
        description: 'child',
      });
      const parent = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'parent',
        children: [child],
      });

      child.recordEvaluation(false, 0.2);
      parent.recordEvaluation(false);

      const json = parent.toJSON();
      const restored = HierarchicalClauseNode.fromJSON(json);

      expect(restored.children).toHaveLength(1);
      expect(restored.children[0].id).toBe('0.0');
      expect(restored.children[0].failureCount).toBe(1);
    });
  });

  describe('threshold metadata', () => {
    let node;

    beforeEach(() => {
      node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test condition',
      });
    });

    it('should have null threshold values by default', () => {
      expect(node.thresholdValue).toBeNull();
      expect(node.comparisonOperator).toBeNull();
      expect(node.variablePath).toBeNull();
    });

    it('should store threshold metadata via setThresholdMetadata()', () => {
      node.setThresholdMetadata(0.55, '>=', 'emotions.joy');

      expect(node.thresholdValue).toBe(0.55);
      expect(node.comparisonOperator).toBe('>=');
      expect(node.variablePath).toBe('emotions.joy');
    });

    it('should include threshold metadata in toJSON()', () => {
      node.setThresholdMetadata(0.55, '>=', 'emotions.joy');

      const json = node.toJSON();

      expect(json.thresholdValue).toBe(0.55);
      expect(json.comparisonOperator).toBe('>=');
      expect(json.variablePath).toBe('emotions.joy');
    });

    it('should include null threshold metadata in toJSON() when not set', () => {
      const json = node.toJSON();

      expect(json.thresholdValue).toBeNull();
      expect(json.comparisonOperator).toBeNull();
      expect(json.variablePath).toBeNull();
    });

    it('should handle all comparison operators', () => {
      const operators = ['>=', '<=', '>', '<', '=='];

      for (const op of operators) {
        node.setThresholdMetadata(0.5, op, 'test.path');
        expect(node.comparisonOperator).toBe(op);
      }
    });

    it('should handle integer threshold values', () => {
      node.setThresholdMetadata(50, '<=', 'mood.valence');

      expect(node.thresholdValue).toBe(50);
      expect(node.comparisonOperator).toBe('<=');
      expect(node.variablePath).toBe('mood.valence');
    });
  });

  describe('violation sample collection', () => {
    let node;

    beforeEach(() => {
      node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test condition',
      });
    });

    it('should store violation values when recording failures', () => {
      node.recordEvaluation(false, 0.15);
      node.recordEvaluation(false, 0.25);
      node.recordEvaluation(true, 0); // pass, no violation stored

      expect(node.violationValues).toHaveLength(2);
      expect(node.violationValues).toContain(0.15);
      expect(node.violationValues).toContain(0.25);
    });

    it('should not store zero violations', () => {
      node.recordEvaluation(false, 0);
      node.recordEvaluation(false, 0.1);

      expect(node.violationValues).toHaveLength(1);
      expect(node.violationValues[0]).toBe(0.1);
    });

    it('should clear violationValues on resetStats()', () => {
      node.recordEvaluation(false, 0.15);
      node.recordEvaluation(false, 0.25);

      node.resetStats();

      expect(node.violationValues).toHaveLength(0);
      expect(node.violationSampleCount).toBe(0);
    });

    it('should return correct violationSampleCount', () => {
      expect(node.violationSampleCount).toBe(0);

      node.recordEvaluation(false, 0.1);
      node.recordEvaluation(false, 0.2);
      node.recordEvaluation(false, 0.3);

      expect(node.violationSampleCount).toBe(3);
    });

    it('should include violationSampleCount in toJSON()', () => {
      node.recordEvaluation(false, 0.1);
      node.recordEvaluation(false, 0.2);

      const json = node.toJSON();

      expect(json.violationSampleCount).toBe(2);
    });
  });

  describe('violation percentile calculation', () => {
    let node;

    beforeEach(() => {
      node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test condition',
      });
    });

    it('should return null when no violations recorded', () => {
      expect(node.violationP50).toBeNull();
      expect(node.violationP90).toBeNull();
      expect(node.getViolationPercentile(0.5)).toBeNull();
    });

    it('should return the single value for all percentiles when only one violation', () => {
      node.recordEvaluation(false, 0.25);

      expect(node.violationP50).toBe(0.25);
      expect(node.violationP90).toBe(0.25);
      expect(node.getViolationPercentile(0.1)).toBe(0.25);
      expect(node.getViolationPercentile(0.99)).toBe(0.25);
    });

    it('should calculate correct p50 (median) for odd-length array', () => {
      // Add values: 0.1, 0.2, 0.3, 0.4, 0.5 (sorted)
      [0.3, 0.1, 0.5, 0.2, 0.4].forEach((v) =>
        node.recordEvaluation(false, v)
      );

      expect(node.violationP50).toBe(0.3); // Middle value
    });

    it('should interpolate between values for even-length arrays', () => {
      // Add values: 0.1, 0.2, 0.3, 0.4 (sorted)
      [0.1, 0.2, 0.3, 0.4].forEach((v) => node.recordEvaluation(false, v));

      // p50 with 4 elements: index = 0.5 * 3 = 1.5
      // interpolate between sorted[1]=0.2 and sorted[2]=0.3
      expect(node.violationP50).toBe(0.25);
    });

    it('should have p90 >= p50 for any distribution', () => {
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach((v) =>
        node.recordEvaluation(false, v)
      );

      expect(node.violationP90).toBeGreaterThanOrEqual(node.violationP50);
    });

    it('should calculate correct p90 for 10-element array', () => {
      // Add values 0.1 to 1.0 in random order
      [0.5, 0.3, 0.8, 0.1, 0.9, 0.2, 0.7, 0.4, 0.6, 1.0].forEach((v) =>
        node.recordEvaluation(false, v)
      );

      // p90 with 10 elements: index = 0.9 * 9 = 8.1
      // sorted = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
      // interpolate between sorted[8]=0.9 and sorted[9]=1.0
      // fraction = 0.1, result = 0.9 * 0.9 + 1.0 * 0.1 = 0.91
      expect(node.violationP90).toBeCloseTo(0.91, 10);
    });

    it('should not mutate the original violationValues array', () => {
      [0.5, 0.1, 0.3].forEach((v) => node.recordEvaluation(false, v));

      const originalOrder = [...node.violationValues];

      // Call getViolationPercentile which internally sorts
      node.getViolationPercentile(0.5);

      expect(node.violationValues).toEqual(originalOrder);
    });

    it('should include violationP50 and violationP90 in toJSON()', () => {
      node.recordEvaluation(false, 0.1);
      node.recordEvaluation(false, 0.2);

      const json = node.toJSON();

      expect(json).toHaveProperty('violationP50');
      expect(json).toHaveProperty('violationP90');
      expect(json.violationP50).toBeCloseTo(0.15, 10); // interpolated median of [0.1, 0.2]
      expect(json.violationP90).toBeCloseTo(0.19, 10); // p90 for 2 elements: index=0.9*1=0.9, interp 0.1*0.1 + 0.2*0.9 = 0.19
    });

    it('should return boundary values for p0 and p100', () => {
      [0.1, 0.5, 0.9].forEach((v) => node.recordEvaluation(false, v));

      expect(node.getViolationPercentile(0)).toBe(0.1);
      expect(node.getViolationPercentile(1)).toBe(0.9);
    });
  });

  describe('observed value tracking', () => {
    let node;

    beforeEach(() => {
      node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test condition',
      });
    });

    it('should track maximum observed value', () => {
      node.recordObservedValue(0.3);
      node.recordObservedValue(0.7);
      node.recordObservedValue(0.5);

      expect(node.maxObservedValue).toBe(0.7);
    });

    it('should handle negative values correctly', () => {
      // Mood axes use [-100, 100] range
      node.recordObservedValue(-50);
      node.recordObservedValue(-20);
      node.recordObservedValue(-80);

      expect(node.maxObservedValue).toBe(-20);
    });

    it('should return null when no values observed', () => {
      expect(node.maxObservedValue).toBeNull();
      expect(node.observedP99).toBeNull();
    });

    it('should calculate p99 of observed values', () => {
      // Add 100 values from 0.01 to 1.0
      for (let i = 1; i <= 100; i++) {
        node.recordObservedValue(i / 100);
      }

      // p99 with 100 elements: index = 0.99 * 99 = 98.01
      // interpolate between sorted[98]=0.99 and sorted[99]=1.0
      expect(node.observedP99).toBeCloseTo(0.99, 2);
    });

    it('should calculate ceiling gap correctly', () => {
      node.setThresholdMetadata(0.8, '>=', 'emotions.joy');
      node.recordObservedValue(0.5);
      node.recordObservedValue(0.6);

      // 0.8 - 0.6 = 0.2 (positive = ceiling effect)
      expect(node.ceilingGap).toBeCloseTo(0.2, 10);
    });

    it('should have negative ceilingGap when threshold is achievable', () => {
      node.setThresholdMetadata(0.5, '>=', 'emotions.joy');
      node.recordObservedValue(0.7);

      // 0.5 - 0.7 = -0.2 (negative = achievable)
      expect(node.ceilingGap).toBeCloseTo(-0.2, 10);
    });

    it('should return null ceilingGap when threshold not set', () => {
      node.recordObservedValue(0.5);

      expect(node.ceilingGap).toBeNull();
    });

    it('should return null ceilingGap when no observations', () => {
      node.setThresholdMetadata(0.8, '>=', 'emotions.joy');

      expect(node.ceilingGap).toBeNull();
    });

    it('should reset observed value tracking', () => {
      node.recordObservedValue(0.5);
      node.recordObservedValue(0.6);
      node.resetStats();

      expect(node.maxObservedValue).toBeNull();
      expect(node.observedP99).toBeNull();
    });

    it('should include observed value fields in toJSON()', () => {
      node.setThresholdMetadata(0.8, '>=', 'emotions.joy');
      node.recordObservedValue(0.5);
      node.recordObservedValue(0.6);

      const json = node.toJSON();

      expect(json).toHaveProperty('maxObservedValue');
      expect(json).toHaveProperty('observedP99');
      expect(json).toHaveProperty('ceilingGap');
      expect(json.maxObservedValue).toBe(0.6);
      expect(json.observedP99).toBeCloseTo(0.599, 2); // p99 of [0.5, 0.6]
      expect(json.ceilingGap).toBeCloseTo(0.2, 10); // 0.8 - 0.6
    });

    it('should skip non-numeric values in recordObservedValue', () => {
      node.recordObservedValue(null);
      node.recordObservedValue(undefined);
      node.recordObservedValue('string');
      node.recordObservedValue(NaN);
      node.recordObservedValue({}); // object

      expect(node.maxObservedValue).toBeNull();
    });

    it('should return single value for p99 when only one observation', () => {
      node.recordObservedValue(0.42);

      expect(node.observedP99).toBe(0.42);
    });
  });

  describe('near-miss tracking', () => {
    let node;

    beforeEach(() => {
      node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test node',
      });
    });

    it('should count near-miss samples', () => {
      const threshold = 0.5;
      const epsilon = 0.05;

      node.recordNearMiss(0.48, threshold, epsilon); // within epsilon
      node.recordNearMiss(0.52, threshold, epsilon); // within epsilon
      node.recordNearMiss(0.30, threshold, epsilon); // outside epsilon

      expect(node.nearMissCount).toBe(2);
    });

    it('should calculate near-miss rate as proportion of evaluations', () => {
      // Record 10 evaluations
      for (let i = 0; i < 10; i++) {
        node.recordEvaluation(i < 5, 0.1);
      }
      // Record 3 near-misses
      node.recordNearMiss(0.48, 0.5, 0.05);
      node.recordNearMiss(0.52, 0.5, 0.05);
      node.recordNearMiss(0.51, 0.5, 0.05);

      expect(node.nearMissRate).toBe(0.3); // 3 / 10
    });

    it('should return null for nearMissRate when no evaluations recorded', () => {
      expect(node.nearMissRate).toBeNull();
    });

    it('should reset near-miss tracking', () => {
      node.recordEvaluation(true);
      node.recordNearMiss(0.48, 0.5, 0.05);

      expect(node.nearMissCount).toBe(1);
      expect(node.nearMissEpsilon).toBe(0.05);

      node.resetStats();

      expect(node.nearMissCount).toBe(0);
      expect(node.nearMissEpsilon).toBeNull();
    });

    it('should include near-miss fields in toJSON()', () => {
      node.recordEvaluation(false, 0.1);
      node.recordNearMiss(0.48, 0.5, 0.05);

      const json = node.toJSON();

      expect(json).toHaveProperty('nearMissCount', 1);
      expect(json).toHaveProperty('nearMissRate', 1); // 1/1
      expect(json).toHaveProperty('nearMissEpsilon', 0.05);
    });

    it('should not count samples outside epsilon', () => {
      const threshold = 0.5;
      const epsilon = 0.05;

      node.recordNearMiss(0.44, threshold, epsilon); // exactly at epsilon boundary
      node.recordNearMiss(0.40, threshold, epsilon); // outside epsilon
      node.recordNearMiss(0.56, threshold, epsilon); // exactly at epsilon boundary
      node.recordNearMiss(0.60, threshold, epsilon); // outside epsilon

      expect(node.nearMissCount).toBe(0);
    });

    it('should count samples just inside epsilon boundary', () => {
      const threshold = 0.5;
      const epsilon = 0.05;

      node.recordNearMiss(0.4501, threshold, epsilon); // just inside
      node.recordNearMiss(0.5499, threshold, epsilon); // just inside

      expect(node.nearMissCount).toBe(2);
    });

    it('should track the epsilon value used', () => {
      expect(node.nearMissEpsilon).toBeNull();

      node.recordNearMiss(0.48, 0.5, 0.05);
      expect(node.nearMissEpsilon).toBe(0.05);

      // Epsilon updates with each call
      node.recordNearMiss(0.48, 0.5, 0.10);
      expect(node.nearMissEpsilon).toBe(0.10);
    });

    it('should skip non-numeric values in recordNearMiss', () => {
      node.recordNearMiss(null, 0.5, 0.05);
      node.recordNearMiss(0.48, null, 0.05);
      node.recordNearMiss('string', 0.5, 0.05);
      node.recordNearMiss(0.48, 'string', 0.05);

      expect(node.nearMissCount).toBe(0);
    });

    it('should return 0 for nearMissRate when no near-misses recorded', () => {
      node.recordEvaluation(true);
      node.recordEvaluation(false, 0.1);

      // No near-misses recorded
      expect(node.nearMissRate).toBe(0);
    });

    it('should handle different epsilon values correctly', () => {
      // Simulating mood axes with epsilon = 5
      const moodThreshold = 50;
      const moodEpsilon = 5;

      node.recordNearMiss(48, moodThreshold, moodEpsilon); // within
      node.recordNearMiss(53, moodThreshold, moodEpsilon); // within
      node.recordNearMiss(40, moodThreshold, moodEpsilon); // outside
      node.recordNearMiss(60, moodThreshold, moodEpsilon); // outside

      expect(node.nearMissCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle deeply nested trees', () => {
      const leaf = new HierarchicalClauseNode({
        id: '0.0.0.0',
        nodeType: 'leaf',
        description: 'deep leaf',
      });
      const level3 = new HierarchicalClauseNode({
        id: '0.0.0',
        nodeType: 'and',
        description: 'level 3',
        children: [leaf],
      });
      const level2 = new HierarchicalClauseNode({
        id: '0.0',
        nodeType: 'or',
        description: 'level 2',
        children: [level3],
      });
      const root = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'root',
        children: [level2],
      });

      leaf.recordEvaluation(false, 0.5);

      const json = root.toJSON();
      expect(json.children[0].children[0].children[0].failureCount).toBe(1);
    });

    it('should handle empty children array', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'and',
        description: 'empty AND',
        children: [],
      });

      expect(node.isCompound).toBe(true);
      expect(node.children).toEqual([]);
    });

    it('should handle very small failure rates', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'rare failure',
      });

      for (let i = 0; i < 10000; i++) {
        node.recordEvaluation(true);
      }
      node.recordEvaluation(false, 0.01);

      expect(node.failureRate).toBeCloseTo(1 / 10001, 6);
    });
  });

  describe('Last-mile tracking', () => {
    it('should track last-mile failures', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      node.recordOthersPassed();
      node.recordOthersPassed();
      node.recordLastMileFail(); // Only one of the two

      expect(node.othersPassedCount).toBe(2);
      expect(node.lastMileFailCount).toBe(1);
      expect(node.lastMileFailRate).toBe(0.5);
    });

    it('should return null when no samples had others pass', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });
      expect(node.lastMileFailRate).toBeNull();
    });

    it('should reset last-mile tracking', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });
      node.recordOthersPassed();
      node.recordLastMileFail();
      node.resetStats();

      expect(node.othersPassedCount).toBe(0);
      expect(node.lastMileFailCount).toBe(0);
      expect(node.lastMileFailRate).toBeNull();
    });

    it('should include last-mile fields in toJSON()', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });
      node.recordOthersPassed();
      node.recordLastMileFail();

      const json = node.toJSON();

      expect(json).toHaveProperty('lastMileFailRate', 1);
      expect(json).toHaveProperty('lastMileFailCount', 1);
      expect(json).toHaveProperty('othersPassedCount', 1);
    });

    it('should track isSingleClause property', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      expect(node.isSingleClause).toBe(false);
      node.isSingleClause = true;
      expect(node.isSingleClause).toBe(true);
    });

    it('should include isSingleClause in toJSON()', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });
      node.isSingleClause = true;

      const json = node.toJSON();
      expect(json).toHaveProperty('isSingleClause', true);
    });

    it('should not reset isSingleClause in resetStats()', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });
      node.isSingleClause = true;
      node.resetStats();

      expect(node.isSingleClause).toBe(true);
    });

    it('should maintain invariant lastMileFailCount <= othersPassedCount', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'test',
      });

      // Record some samples where others passed
      for (let i = 0; i < 10; i++) {
        node.recordOthersPassed();
      }
      // Record fewer failures
      for (let i = 0; i < 5; i++) {
        node.recordLastMileFail();
      }

      expect(node.lastMileFailCount).toBeLessThanOrEqual(
        node.othersPassedCount
      );
      expect(node.lastMileFailRate).toBe(0.5);
    });

    it('should handle 100% last-mile failure rate', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'always blocks',
      });

      // Every time others pass, this one fails
      for (let i = 0; i < 10; i++) {
        node.recordOthersPassed();
        node.recordLastMileFail();
      }

      expect(node.lastMileFailRate).toBe(1);
      expect(node.lastMileFailCount).toBe(10);
      expect(node.othersPassedCount).toBe(10);
    });

    it('should handle 0% last-mile failure rate', () => {
      const node = new HierarchicalClauseNode({
        id: '0',
        nodeType: 'leaf',
        description: 'never blocks',
      });

      // Others pass, but this one also passes
      for (let i = 0; i < 10; i++) {
        node.recordOthersPassed();
        // No recordLastMileFail() call - this clause passes
      }

      expect(node.lastMileFailRate).toBe(0);
      expect(node.lastMileFailCount).toBe(0);
      expect(node.othersPassedCount).toBe(10);
    });
  });
});
