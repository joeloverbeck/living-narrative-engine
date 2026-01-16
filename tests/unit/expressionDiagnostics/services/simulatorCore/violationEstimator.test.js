/**
 * @file Unit tests for ViolationEstimator.
 * @see src/expressionDiagnostics/services/simulatorCore/ViolationEstimator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ViolationEstimator from '../../../../../src/expressionDiagnostics/services/simulatorCore/ViolationEstimator.js';

describe('ViolationEstimator', () => {
  let estimator;
  let mockPrerequisiteEvaluator;

  beforeEach(() => {
    estimator = new ViolationEstimator();
    mockPrerequisiteEvaluator = jest.fn();
  });

  describe('constructor', () => {
    it('should create an instance without dependencies', () => {
      expect(() => new ViolationEstimator()).not.toThrow();
    });
  });

  describe('countFailedClauses', () => {
    it('should return 0 for missing expression prerequisites', () => {
      const result = estimator.countFailedClauses([], {}, {}, mockPrerequisiteEvaluator);
      expect(result).toBe(0);
    });

    it('should return 0 for null expression', () => {
      const result = estimator.countFailedClauses([], null, {}, mockPrerequisiteEvaluator);
      expect(result).toBe(0);
    });

    it('should return 0 for undefined clauseTracking', () => {
      const expression = { prerequisites: [{ logic: { '>=': [{ var: 'x' }, 5] } }] };
      const result = estimator.countFailedClauses(undefined, expression, {}, mockPrerequisiteEvaluator);
      expect(result).toBe(0);
    });

    it('should count failed atomic clauses via prerequisiteEvaluator', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'x' }, 5] } },
          { logic: { '>=': [{ var: 'y' }, 10] } },
        ],
      };
      const clauseTracking = [
        { clauseIndex: 0, description: 'x >= 5' },
        { clauseIndex: 1, description: 'y >= 10' },
      ];
      const context = { x: 3, y: 12 };

      mockPrerequisiteEvaluator
        .mockReturnValueOnce(false) // x >= 5 fails
        .mockReturnValueOnce(true); // y >= 10 passes

      const result = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toBe(1);
      expect(mockPrerequisiteEvaluator).toHaveBeenCalledTimes(2);
    });

    it('should count failed leaves in hierarchical tree', () => {
      const expression = {
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'moodAxes.valence' }, 50] },
                { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              ],
            },
          },
        ],
      };
      const clauseTracking = [
        {
          clauseIndex: 0,
          hierarchicalTree: {
            isCompound: true,
            children: [
              {
                isCompound: false,
                logic: { '>=': [{ var: 'moodAxes.valence' }, 50] },
              },
              {
                isCompound: false,
                logic: { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              },
            ],
          },
        },
      ];
      const context = { moodAxes: { valence: 40, arousal: 35 } };

      const result = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // valence 40 < 50 fails, arousal 35 >= 30 passes
      expect(result).toBe(1);
      // prerequisiteEvaluator should NOT be called for hierarchical trees
      expect(mockPrerequisiteEvaluator).not.toHaveBeenCalled();
    });

    it('should handle nested hierarchical trees', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: true,
            children: [
              {
                isCompound: true,
                children: [
                  { isCompound: false, logic: { '>=': [{ var: 'x' }, 10] } },
                  { isCompound: false, logic: { '>=': [{ var: 'y' }, 20] } },
                ],
              },
              { isCompound: false, logic: { '>=': [{ var: 'z' }, 30] } },
            ],
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { x: 5, y: 25, z: 25 };

      const result = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // x < 10 (fail), y >= 20 (pass), z < 30 (fail) = 2 failures
      expect(result).toBe(2);
    });

    it('should treat evaluation errors as failures', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [{ var: 'nonexistent.deeply.nested' }, 50] },
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = {};

      // Should return 1 (error treated as failure)
      const result = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toBe(1);
    });
  });

  describe('getFailedLeavesSummary', () => {
    it('should return empty array for missing prerequisites', () => {
      const result = estimator.getFailedLeavesSummary([], {}, {}, mockPrerequisiteEvaluator);
      expect(result).toEqual([]);
    });

    it('should return empty array for null expression', () => {
      const result = estimator.getFailedLeavesSummary([], null, {}, mockPrerequisiteEvaluator);
      expect(result).toEqual([]);
    });

    it('should collect failed atomic clauses with description', () => {
      const expression = {
        prerequisites: [
          { logic: { '>=': [{ var: 'x' }, 5] } },
        ],
      };
      const clauseTracking = [
        { clauseIndex: 0, description: 'x must be at least 5' },
      ];
      const context = { x: 3 };

      mockPrerequisiteEvaluator.mockReturnValue(false);

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('x must be at least 5');
      expect(result[0].actual).toBeNull();
      expect(result[0].threshold).toBeNull();
      expect(result[0].violation).toBeNull();
    });

    it('should use default description when clause description is missing', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'x' }, 5] } }],
      };
      const clauseTracking = [{ clauseIndex: 0 }];
      const context = { x: 3 };

      mockPrerequisiteEvaluator.mockReturnValue(false);

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].description).toBe('Clause 1');
    });

    it('should extract violation info from hierarchical tree leaves', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [{ var: 'moodAxes.valence' }, 70] },
            description: 'valence >= 70',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { moodAxes: { valence: 60 } };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('valence >= 70');
      expect(result[0].actual).toBe(60);
      expect(result[0].threshold).toBe(70);
      expect(result[0].violation).toBe(10);
    });

    it('should limit results to first 5 failed leaves', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: true,
            children: [
              { isCompound: false, logic: { '>=': [{ var: 'a' }, 100] }, description: 'a' },
              { isCompound: false, logic: { '>=': [{ var: 'b' }, 100] }, description: 'b' },
              { isCompound: false, logic: { '>=': [{ var: 'c' }, 100] }, description: 'c' },
              { isCompound: false, logic: { '>=': [{ var: 'd' }, 100] }, description: 'd' },
              { isCompound: false, logic: { '>=': [{ var: 'e' }, 100] }, description: 'e' },
              { isCompound: false, logic: { '>=': [{ var: 'f' }, 100] }, description: 'f' },
              { isCompound: false, logic: { '>=': [{ var: 'g' }, 100] }, description: 'g' },
            ],
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { a: 10, b: 20, c: 30, d: 40, e: 50, f: 60, g: 70 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(5);
      expect(result.map((r) => r.description)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('should handle nested compound nodes in tree', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: true,
            children: [
              {
                isCompound: true,
                children: [
                  { isCompound: false, logic: { '>=': [{ var: 'x' }, 50] }, description: 'x >= 50' },
                ],
              },
              { isCompound: false, logic: { '>=': [{ var: 'y' }, 50] }, description: 'y >= 50' },
            ],
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { x: 30, y: 40 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('x >= 50');
      expect(result[1].description).toBe('y >= 50');
    });

    it('should use "Unknown condition" for leaves without description', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [{ var: 'x' }, 50] },
            // no description
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { x: 30 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].description).toBe('Unknown condition');
    });

    it('should not include passing leaves', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: true,
            children: [
              { isCompound: false, logic: { '>=': [{ var: 'x' }, 50] }, description: 'x >= 50' },
              { isCompound: false, logic: { '>=': [{ var: 'y' }, 50] }, description: 'y >= 50' },
            ],
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { x: 60, y: 40 }; // x passes, y fails

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('y >= 50');
    });
  });

  describe('violation info extraction', () => {
    it('should extract violation info for >= operator', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [{ var: 'val' }, 70] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 60 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].actual).toBe(60);
      expect(result[0].threshold).toBe(70);
      expect(result[0].violation).toBe(10);
    });

    it('should extract violation info for <= operator', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '<=': [{ var: 'val' }, 30] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 40 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].actual).toBe(40);
      expect(result[0].threshold).toBe(30);
      expect(result[0].violation).toBe(10);
    });

    it('should extract violation info for > operator', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>': [{ var: 'val' }, 50] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 50 }; // equal, not greater

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].actual).toBe(50);
      expect(result[0].threshold).toBe(50);
      expect(result[0].violation).toBe(0);
    });

    it('should extract violation info for < operator', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '<': [{ var: 'val' }, 10] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 20 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].actual).toBe(20);
      expect(result[0].threshold).toBe(10);
      expect(result[0].violation).toBe(10);
    });

    it('should extract violation info for == operator', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '==': [{ var: 'val' }, 100] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 95 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].actual).toBe(95);
      expect(result[0].threshold).toBe(100);
      expect(result[0].violation).toBe(5);
    });

    it('should handle right-side variable reference', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [50, { var: 'val' }] }, // threshold on left
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 60 };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // When threshold is on left, actual becomes right value
      expect(result[0].actual).toBe(60);
      expect(result[0].threshold).toBe(50);
      expect(result[0].violation).toBe(10);
    });

    it('should return null values for unknown variable paths', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [{ var: 'unknown.path' }, 50] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = {};

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // Should still fail but with null violation info
      expect(result).toHaveLength(1);
      expect(result[0].actual).toBeNull();
      expect(result[0].threshold).toBeNull();
      expect(result[0].violation).toBeNull();
    });

    it('should return null values for non-comparison operators', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { 'in': [{ var: 'val' }, ['a', 'b', 'c']] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { val: 'd' };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result[0].actual).toBeNull();
      expect(result[0].threshold).toBeNull();
      expect(result[0].violation).toBeNull();
    });

    it('should return null values for null logic', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: null,
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = {};

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(1);
      expect(result[0].actual).toBeNull();
      expect(result[0].threshold).toBeNull();
      expect(result[0].violation).toBeNull();
    });

    it('should handle literal operands correctly', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            // Both operands are literals - unusual but should not crash
            logic: { '>=': [5, 10] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = {};

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // Both are literals, neither is a var, so isLeftVar=false
      // actual = right = 10, threshold = left = 5
      expect(result[0].actual).toBe(10);
      expect(result[0].threshold).toBe(5);
      expect(result[0].violation).toBe(5);
    });

    it('should handle arithmetic expressions in operands', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '>=': [{ '+': [{ var: 'x' }, { var: 'y' }] }, 100] },
            description: 'x + y >= 100',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { x: 30, y: 40 }; // 30 + 40 = 70 < 100

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // When left side is a computed expression (not a simple var), the heuristic
      // treats right as "actual" and left as "threshold" (same as literal operands case)
      // The violation magnitude is still correct for nearest-miss tracking
      expect(result[0].actual).toBe(100);
      expect(result[0].threshold).toBe(70);
      expect(result[0].violation).toBe(30);
    });

    it('should handle string operands gracefully (return null violation)', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '==': [{ var: 'name' }, 'expected'] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { name: 'actual' };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // Strings can't compute numeric violation
      expect(result[0].actual).toBeNull();
      expect(result[0].threshold).toBeNull();
      expect(result[0].violation).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty children array in compound node', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: true,
            children: [],
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = {};

      const failedCount = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );
      expect(failedCount).toBe(0);

      const summary = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );
      expect(summary).toEqual([]);
    });

    it('should handle undefined children in compound node', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: true,
            children: undefined,
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = {};

      const failedCount = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );
      expect(failedCount).toBe(0);
    });

    it('should handle null hierarchicalTree', () => {
      const expression = {
        prerequisites: [{ logic: { '>=': [{ var: 'x' }, 5] } }],
      };
      const clauseTracking = [{ clauseIndex: 0, hierarchicalTree: null }];
      const context = { x: 10 };

      mockPrerequisiteEvaluator.mockReturnValue(true);

      const result = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toBe(0);
      expect(mockPrerequisiteEvaluator).toHaveBeenCalled();
    });

    it('should handle missing isCompound on node (treated as leaf)', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            // isCompound is undefined/missing
            logic: { '>=': [{ var: 'x' }, 50] },
            description: 'test',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { x: 30 };

      const result = estimator.countFailedClauses(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      // Without isCompound, node.isCompound is falsy, so treated as leaf
      expect(result).toBe(1);
    });

    it('should handle boolean operand values', () => {
      const clauseTracking = [
        {
          hierarchicalTree: {
            isCompound: false,
            logic: { '==': [{ var: 'flag' }, true] },
            description: 'flag must be true',
          },
        },
      ];
      const expression = { prerequisites: [{}] };
      const context = { flag: false };

      const result = estimator.getFailedLeavesSummary(
        clauseTracking,
        expression,
        context,
        mockPrerequisiteEvaluator
      );

      expect(result).toHaveLength(1);
      // Booleans can't be compared numerically
      expect(result[0].actual).toBeNull();
      expect(result[0].threshold).toBeNull();
      expect(result[0].violation).toBeNull();
    });
  });
});
