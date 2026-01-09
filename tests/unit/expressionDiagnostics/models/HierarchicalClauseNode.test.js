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
        isCompound: false,
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
});
