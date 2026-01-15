/**
 * @file Unit tests for BlockerTreeTraversal service
 * @description Tests for OR/AND tree traversal operations including flattening,
 * pass rate calculations, and tree analysis methods.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import BlockerTreeTraversal from '../../../../src/expressionDiagnostics/services/BlockerTreeTraversal.js';

describe('BlockerTreeTraversal', () => {
  let service;

  beforeEach(() => {
    service = new BlockerTreeTraversal();
  });

  // ============================================================================
  // flattenLeaves
  // ============================================================================

  describe('flattenLeaves', () => {
    it('should return empty array for null node', () => {
      const result = service.flattenLeaves(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined node', () => {
      const result = service.flattenLeaves(undefined);
      expect(result).toEqual([]);
    });

    it('should return single leaf node in array', () => {
      const leaf = { nodeType: 'leaf', description: 'Test leaf' };
      const result = service.flattenLeaves(leaf);
      expect(result).toEqual([leaf]);
    });

    it('should return non-compound node as leaf', () => {
      const node = { isCompound: false, description: 'Non-compound' };
      const result = service.flattenLeaves(node);
      expect(result).toEqual([node]);
    });

    it('should flatten nested AND tree', () => {
      const tree = {
        nodeType: 'and',
        isCompound: true,
        children: [
          { nodeType: 'leaf', description: 'Leaf 1' },
          { nodeType: 'leaf', description: 'Leaf 2' },
        ],
      };
      const result = service.flattenLeaves(tree);
      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Leaf 1');
      expect(result[1].description).toBe('Leaf 2');
    });

    it('should flatten deeply nested tree', () => {
      const tree = {
        nodeType: 'and',
        isCompound: true,
        children: [
          {
            nodeType: 'or',
            isCompound: true,
            children: [
              { nodeType: 'leaf', description: 'Leaf A' },
              { nodeType: 'leaf', description: 'Leaf B' },
            ],
          },
          { nodeType: 'leaf', description: 'Leaf C' },
        ],
      };
      const result = service.flattenLeaves(tree);
      expect(result).toHaveLength(3);
      expect(result.map((l) => l.description)).toEqual([
        'Leaf A',
        'Leaf B',
        'Leaf C',
      ]);
    });

    it('should accumulate results into provided array', () => {
      const existing = [{ description: 'Existing' }];
      const leaf = { nodeType: 'leaf', description: 'New leaf' };
      const result = service.flattenLeaves(leaf, existing);
      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Existing');
      expect(result[1].description).toBe('New leaf');
    });

    it('should handle node with empty children array', () => {
      const node = {
        nodeType: 'and',
        isCompound: true,
        children: [],
      };
      const result = service.flattenLeaves(node);
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // collectOrBlocks
  // ============================================================================

  describe('collectOrBlocks', () => {
    it('should return empty array for null input', () => {
      const result = service.collectOrBlocks(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      const result = service.collectOrBlocks('not an array');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      const result = service.collectOrBlocks([]);
      expect(result).toEqual([]);
    });

    it('should collect OR blocks from blockers', () => {
      const orNode = {
        nodeType: 'or',
        description: 'OR block',
        evaluationCount: 100,
        failureCount: 20,
      };
      const blockers = [{ hierarchicalBreakdown: orNode }];
      const result = service.collectOrBlocks(blockers);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(orNode);
    });

    it('should deduplicate OR blocks with same id', () => {
      const orNode = { nodeType: 'or', id: 'or-1' };
      const blockers = [
        { hierarchicalBreakdown: orNode },
        { hierarchicalBreakdown: orNode },
      ];
      const result = service.collectOrBlocks(blockers);
      expect(result).toHaveLength(1);
    });

    it('should deduplicate OR blocks with generated key', () => {
      const orNode1 = {
        nodeType: 'or',
        description: 'Same OR',
        evaluationCount: 100,
        failureCount: 20,
      };
      const orNode2 = {
        nodeType: 'or',
        description: 'Same OR',
        evaluationCount: 100,
        failureCount: 20,
      };
      const blockers = [
        { hierarchicalBreakdown: orNode1 },
        { hierarchicalBreakdown: orNode2 },
      ];
      const result = service.collectOrBlocks(blockers);
      expect(result).toHaveLength(1);
    });

    it('should find nested OR blocks', () => {
      const nestedOr = {
        nodeType: 'or',
        id: 'nested-or',
        children: [{ nodeType: 'leaf' }],
      };
      const tree = {
        nodeType: 'and',
        isCompound: true,
        children: [nestedOr, { nodeType: 'leaf' }],
      };
      const blockers = [{ hierarchicalBreakdown: tree }];
      const result = service.collectOrBlocks(blockers);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('nested-or');
    });

    it('should skip blockers without hierarchicalBreakdown', () => {
      const blockers = [{ someOtherProp: 'value' }, null, undefined];
      const result = service.collectOrBlocks(blockers);
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // collectFunnelLeaves
  // ============================================================================

  describe('collectFunnelLeaves', () => {
    it('should return empty array when both inputs are empty', () => {
      const result = service.collectFunnelLeaves({
        blockers: [],
        clauseFailures: [],
      });
      expect(result).toEqual([]);
    });

    it('should prefer clauseFailures over blockers', () => {
      const clauseLeaf = { nodeType: 'leaf', description: 'Clause' };
      const blockerLeaf = { nodeType: 'leaf', description: 'Blocker' };
      const result = service.collectFunnelLeaves({
        blockers: [{ hierarchicalBreakdown: blockerLeaf }],
        clauseFailures: [{ hierarchicalBreakdown: clauseLeaf }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Clause');
    });

    it('should fall back to blockers when clauseFailures is empty', () => {
      const blockerLeaf = { nodeType: 'leaf', description: 'Blocker' };
      const result = service.collectFunnelLeaves({
        blockers: [{ hierarchicalBreakdown: blockerLeaf }],
        clauseFailures: [],
      });
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Blocker');
    });

    it('should use source directly if no hierarchicalBreakdown', () => {
      const source = { nodeType: 'leaf', description: 'Direct' };
      const result = service.collectFunnelLeaves({
        blockers: [source],
        clauseFailures: [],
      });
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Direct');
    });

    it('should handle null sources', () => {
      const result = service.collectFunnelLeaves({
        blockers: null,
        clauseFailures: null,
      });
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // buildStructuredTree
  // ============================================================================

  describe('buildStructuredTree', () => {
    it('should return null for null node', () => {
      expect(service.buildStructuredTree(null)).toBeNull();
    });

    it('should return leaf structure for leaf node', () => {
      const leaf = { nodeType: 'leaf', description: 'Test' };
      const result = service.buildStructuredTree(leaf);
      expect(result).toEqual({
        type: 'leaf',
        node: leaf,
        children: [],
      });
    });

    it('should return leaf structure for non-compound node', () => {
      const node = { isCompound: false, description: 'Non-compound' };
      const result = service.buildStructuredTree(node);
      expect(result).toEqual({
        type: 'leaf',
        node,
        children: [],
      });
    });

    it('should build AND structure', () => {
      const tree = {
        nodeType: 'and',
        isCompound: true,
        children: [{ nodeType: 'leaf', description: 'Child' }],
      };
      const result = service.buildStructuredTree(tree);
      expect(result.type).toBe('and');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe('leaf');
    });

    it('should build OR structure', () => {
      const tree = {
        nodeType: 'or',
        isCompound: true,
        children: [{ nodeType: 'leaf', description: 'Child' }],
      };
      const result = service.buildStructuredTree(tree);
      expect(result.type).toBe('or');
      expect(result.children).toHaveLength(1);
    });

    it('should build deeply nested structure', () => {
      const tree = {
        nodeType: 'and',
        isCompound: true,
        children: [
          {
            nodeType: 'or',
            isCompound: true,
            children: [{ nodeType: 'leaf', description: 'Deep leaf' }],
          },
        ],
      };
      const result = service.buildStructuredTree(tree);
      expect(result.type).toBe('and');
      expect(result.children[0].type).toBe('or');
      expect(result.children[0].children[0].type).toBe('leaf');
    });
  });

  // ============================================================================
  // calculateOrPassRate
  // ============================================================================

  describe('calculateOrPassRate', () => {
    it('should return 0 for null node', () => {
      expect(service.calculateOrPassRate(null)).toBe(0);
    });

    it('should calculate from evaluationCount and failureCount', () => {
      const orNode = { evaluationCount: 100, failureCount: 20 };
      expect(service.calculateOrPassRate(orNode)).toBe(0.8);
    });

    it('should return 0 for zero evaluation count', () => {
      const orNode = { evaluationCount: 0, failureCount: 0 };
      expect(service.calculateOrPassRate(orNode)).toBe(0);
    });

    it('should use failureRate fallback', () => {
      const orNode = { failureRate: 0.3 };
      expect(service.calculateOrPassRate(orNode)).toBe(0.7);
    });

    it('should return 0 when no rate information available', () => {
      const orNode = { description: 'No rate info' };
      expect(service.calculateOrPassRate(orNode)).toBe(0);
    });

    it('should prefer evaluationCount over failureRate', () => {
      const orNode = {
        evaluationCount: 100,
        failureCount: 50,
        failureRate: 0.1,
      };
      expect(service.calculateOrPassRate(orNode)).toBe(0.5);
    });
  });

  // ============================================================================
  // calculateOrInRegimeFailureRate
  // ============================================================================

  describe('calculateOrInRegimeFailureRate', () => {
    it('should return null for null node', () => {
      expect(service.calculateOrInRegimeFailureRate(null)).toBeNull();
    });

    it('should calculate from inRegime counts', () => {
      const orNode = {
        inRegimeEvaluationCount: 100,
        inRegimeFailureCount: 25,
      };
      expect(service.calculateOrInRegimeFailureRate(orNode)).toBe(0.25);
    });

    it('should return null for zero inRegime evaluation count', () => {
      const orNode = {
        inRegimeEvaluationCount: 0,
        inRegimeFailureCount: 0,
      };
      expect(service.calculateOrInRegimeFailureRate(orNode)).toBeNull();
    });

    it('should use inRegimeFailureRate fallback', () => {
      const orNode = { inRegimeFailureRate: 0.15 };
      expect(service.calculateOrInRegimeFailureRate(orNode)).toBe(0.15);
    });

    it('should return null when no rate information available', () => {
      const orNode = { description: 'No rate info' };
      expect(service.calculateOrInRegimeFailureRate(orNode)).toBeNull();
    });
  });

  // ============================================================================
  // resolveOrUnionCount
  // ============================================================================

  describe('resolveOrUnionCount', () => {
    it('should return null for null node', () => {
      expect(service.resolveOrUnionCount(null)).toBeNull();
    });

    it('should return orUnionPassCount if present', () => {
      const orNode = { orUnionPassCount: 75 };
      expect(service.resolveOrUnionCount(orNode)).toBe(75);
    });

    it('should calculate from evaluationCount - failureCount', () => {
      const orNode = { evaluationCount: 100, failureCount: 30 };
      expect(service.resolveOrUnionCount(orNode)).toBe(70);
    });

    it('should prefer orUnionPassCount over calculation', () => {
      const orNode = {
        orUnionPassCount: 50,
        evaluationCount: 100,
        failureCount: 30,
      };
      expect(service.resolveOrUnionCount(orNode)).toBe(50);
    });

    it('should return null when no data available', () => {
      const orNode = { description: 'No counts' };
      expect(service.resolveOrUnionCount(orNode)).toBeNull();
    });

    it('should handle non-finite values', () => {
      const orNode = { evaluationCount: Infinity, failureCount: 10 };
      expect(service.resolveOrUnionCount(orNode)).toBeNull();
    });
  });

  // ============================================================================
  // resolveOrUnionInRegimeCount
  // ============================================================================

  describe('resolveOrUnionInRegimeCount', () => {
    it('should return null for null node', () => {
      expect(service.resolveOrUnionInRegimeCount(null)).toBeNull();
    });

    it('should return orUnionPassInRegimeCount if present', () => {
      const orNode = { orUnionPassInRegimeCount: 60 };
      expect(service.resolveOrUnionInRegimeCount(orNode)).toBe(60);
    });

    it('should calculate from inRegime counts', () => {
      const orNode = {
        inRegimeEvaluationCount: 80,
        inRegimeFailureCount: 20,
      };
      expect(service.resolveOrUnionInRegimeCount(orNode)).toBe(60);
    });

    it('should return null when no data available', () => {
      const orNode = { description: 'No counts' };
      expect(service.resolveOrUnionInRegimeCount(orNode)).toBeNull();
    });
  });

  // ============================================================================
  // isAndOnlyBlockers
  // ============================================================================

  describe('isAndOnlyBlockers', () => {
    it('should return false for null input', () => {
      expect(service.isAndOnlyBlockers(null)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(service.isAndOnlyBlockers([])).toBe(false);
    });

    it('should return false when blocker has no tree', () => {
      const blockers = [{ description: 'No tree' }];
      expect(service.isAndOnlyBlockers(blockers)).toBe(false);
    });

    it('should return true for AND-only tree', () => {
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [{ nodeType: 'leaf' }],
          },
        },
      ];
      expect(service.isAndOnlyBlockers(blockers)).toBe(true);
    });

    it('should return false when OR node is present', () => {
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'or',
            children: [{ nodeType: 'leaf' }],
          },
        },
      ];
      expect(service.isAndOnlyBlockers(blockers)).toBe(false);
    });

    it('should return false for nested OR', () => {
      const blockers = [
        {
          hierarchicalBreakdown: {
            nodeType: 'and',
            children: [
              {
                nodeType: 'or',
                children: [{ nodeType: 'leaf' }],
              },
            ],
          },
        },
      ];
      expect(service.isAndOnlyBlockers(blockers)).toBe(false);
    });
  });

  // ============================================================================
  // isAndOnlyBreakdown
  // ============================================================================

  describe('isAndOnlyBreakdown', () => {
    it('should return false for null node', () => {
      expect(service.isAndOnlyBreakdown(null)).toBe(false);
    });

    it('should return false for non-object node', () => {
      expect(service.isAndOnlyBreakdown('string')).toBe(false);
    });

    it('should return true for leaf node', () => {
      expect(service.isAndOnlyBreakdown({ nodeType: 'leaf' })).toBe(true);
    });

    it('should return false for OR node', () => {
      expect(service.isAndOnlyBreakdown({ nodeType: 'or' })).toBe(false);
    });

    it('should return true for AND node with leaf children', () => {
      const node = {
        nodeType: 'and',
        children: [{ nodeType: 'leaf' }, { nodeType: 'leaf' }],
      };
      expect(service.isAndOnlyBreakdown(node)).toBe(true);
    });

    it('should return false for AND node with OR child', () => {
      const node = {
        nodeType: 'and',
        children: [{ nodeType: 'or' }],
      };
      expect(service.isAndOnlyBreakdown(node)).toBe(false);
    });

    it('should return false for unknown nodeType', () => {
      expect(service.isAndOnlyBreakdown({ nodeType: 'unknown' })).toBe(false);
    });

    it('should handle AND node with empty children', () => {
      const node = { nodeType: 'and', children: [] };
      expect(service.isAndOnlyBreakdown(node)).toBe(true);
    });
  });

  // ============================================================================
  // isEmotionThresholdLeaf
  // ============================================================================

  describe('isEmotionThresholdLeaf', () => {
    it('should return false for null leaf', () => {
      expect(service.isEmotionThresholdLeaf(null)).toBe(false);
    });

    it('should return false for leaf without variablePath', () => {
      const leaf = { description: 'No path' };
      expect(service.isEmotionThresholdLeaf(leaf)).toBe(false);
    });

    it('should return true for emotions.* path with threshold', () => {
      const leaf = { variablePath: 'emotions.happiness', thresholdValue: 0.5 };
      expect(service.isEmotionThresholdLeaf(leaf)).toBe(true);
    });

    it('should return true for previousEmotions.* path with threshold', () => {
      const leaf = {
        variablePath: 'previousEmotions.anger',
        thresholdValue: 0.3,
      };
      expect(service.isEmotionThresholdLeaf(leaf)).toBe(true);
    });

    it('should return false for non-emotion path', () => {
      const leaf = { variablePath: 'state.value', thresholdValue: 0.5 };
      expect(service.isEmotionThresholdLeaf(leaf)).toBe(false);
    });

    it('should return false for emotion path without threshold', () => {
      const leaf = { variablePath: 'emotions.sadness' };
      expect(service.isEmotionThresholdLeaf(leaf)).toBe(false);
    });

    it('should return false for non-string variablePath', () => {
      const leaf = { variablePath: 123, thresholdValue: 0.5 };
      expect(service.isEmotionThresholdLeaf(leaf)).toBe(false);
    });
  });

  // ============================================================================
  // findDominantSuppressor
  // ============================================================================

  describe('findDominantSuppressor', () => {
    it('should return null axis when no suppressors', () => {
      const result = service.findDominantSuppressor({});
      expect(result).toEqual({ axis: null, contribution: 0 });
    });

    it('should return null axis for all positive contributions', () => {
      const axisContributions = {
        axis1: { meanContribution: 0.5 },
        axis2: { meanContribution: 0.3 },
      };
      const result = service.findDominantSuppressor(axisContributions);
      expect(result.axis).toBeNull();
      expect(result.contribution).toBe(0);
    });

    it('should find most negative contributor', () => {
      const axisContributions = {
        axis1: { meanContribution: -0.2 },
        axis2: { meanContribution: -0.5 },
        axis3: { meanContribution: 0.3 },
      };
      const result = service.findDominantSuppressor(axisContributions);
      expect(result.axis).toBe('axis2');
      expect(result.contribution).toBe(-0.5);
    });

    it('should handle single axis', () => {
      const axisContributions = {
        axis1: { meanContribution: -0.1 },
      };
      const result = service.findDominantSuppressor(axisContributions);
      expect(result.axis).toBe('axis1');
      expect(result.contribution).toBe(-0.1);
    });
  });

  // ============================================================================
  // findMostTunableLeaf
  // ============================================================================

  describe('findMostTunableLeaf', () => {
    it('should return null for null hierarchical breakdown', () => {
      expect(service.findMostTunableLeaf(null)).toBeNull();
    });

    it('should return null for tree with no tunable leaves', () => {
      const hb = {
        nodeType: 'and',
        isCompound: true,
        children: [{ nodeType: 'leaf', nearMissRate: 0, failureRate: 0.5 }],
      };
      expect(service.findMostTunableLeaf(hb)).toBeNull();
    });

    it('should find most tunable leaf by impact score', () => {
      const hb = {
        nodeType: 'and',
        isCompound: true,
        children: [
          {
            nodeType: 'leaf',
            description: 'Low impact',
            nearMissRate: 0.05,
            lastMileFailRate: 0.1,
          },
          {
            nodeType: 'leaf',
            description: 'High impact',
            nearMissRate: 0.15,
            lastMileFailRate: 0.8,
          },
        ],
      };
      const result = service.findMostTunableLeaf(hb);
      expect(result.description).toBe('High impact');
      expect(result.tunability).toBe('high');
    });

    it('should classify tunability correctly', () => {
      const hb = {
        nodeType: 'leaf',
        nearMissRate: 0.05,
        lastMileFailRate: 0.5,
      };
      const result = service.findMostTunableLeaf(hb);
      expect(result.tunability).toBe('moderate');
    });

    it('should use siblingConditionedFailRate when available', () => {
      const hb = {
        nodeType: 'leaf',
        nearMissRate: 0.1,
        siblingConditionedFailRate: 0.9,
        lastMileFailRate: 0.1,
      };
      const result = service.findMostTunableLeaf(hb);
      expect(result.impactScore).toBeCloseTo(0.09);
    });

    it('should include epsilon and leafCount', () => {
      const hb = {
        nodeType: 'leaf',
        nearMissRate: 0.2,
        nearMissEpsilon: 0.01,
        failureRate: 0.5,
      };
      const result = service.findMostTunableLeaf(hb);
      expect(result.epsilon).toBe(0.01);
      expect(result.leafCount).toBe(1);
    });
  });

  // ============================================================================
  // findWorstLastMileLeaf
  // ============================================================================

  describe('findWorstLastMileLeaf', () => {
    it('should return null for null hierarchical breakdown', () => {
      expect(service.findWorstLastMileLeaf(null)).toBeNull();
    });

    it('should return null for tree with no last-mile data', () => {
      const hb = {
        nodeType: 'leaf',
        description: 'No last-mile',
      };
      expect(service.findWorstLastMileLeaf(hb)).toBeNull();
    });

    it('should find leaf with highest last-mile failure rate', () => {
      const hb = {
        nodeType: 'and',
        isCompound: true,
        children: [
          { nodeType: 'leaf', description: 'Low rate', lastMileFailRate: 0.2 },
          { nodeType: 'leaf', description: 'High rate', lastMileFailRate: 0.9 },
          {
            nodeType: 'leaf',
            description: 'Medium rate',
            lastMileFailRate: 0.5,
          },
        ],
      };
      const result = service.findWorstLastMileLeaf(hb);
      expect(result.description).toBe('High rate');
      expect(result.lastMileFailRate).toBe(0.9);
    });

    it('should use default description for unknown leaves', () => {
      const hb = { nodeType: 'leaf', lastMileFailRate: 0.5 };
      const result = service.findWorstLastMileLeaf(hb);
      expect(result.description).toBe('Unknown condition');
    });

    it('should skip leaves with zero or negative last-mile rate', () => {
      const hb = {
        nodeType: 'and',
        isCompound: true,
        children: [
          { nodeType: 'leaf', description: 'Zero', lastMileFailRate: 0 },
          { nodeType: 'leaf', description: 'Valid', lastMileFailRate: 0.3 },
        ],
      };
      const result = service.findWorstLastMileLeaf(hb);
      expect(result.description).toBe('Valid');
    });
  });
});
