/**
 * @file Unit tests for OR branch feasibility in PathSensitiveAnalyzer
 * @see src/expressionDiagnostics/services/PathSensitiveAnalyzer.js
 *
 * These tests reproduce the bug where the analyzer incorrectly marks
 * an expression as "impossible" when only ONE OR branch is infeasible
 * but OTHER branches are feasible.
 *
 * Bug scenario: melancholic_disappointment.expression.json
 * - requires disappointment >= 0.45 (gates: future_expectancy <= -0.10)
 * - has OR branches including lonely_yearning surge (gates: future_expectancy >= -0.05)
 * - lonely_yearning branch conflicts with disappointment gates (INFEASIBLE)
 * - BUT other branches like disappointment crossing should be FEASIBLE
 * - Expected: expression is feasible (4/5 branches work)
 * - Actual (BUG): expression marked impossible
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PathSensitiveAnalyzer from '../../../../src/expressionDiagnostics/services/PathSensitiveAnalyzer.js';

describe('PathSensitiveAnalyzer - OR Branch Feasibility', () => {
  let mockDataRegistry;
  let mockGateConstraintAnalyzer;
  let mockIntensityBoundsCalculator;
  let mockLogger;

  /**
   * Mock emotion prototypes with conflicting gates.
   * - disappointment requires: future_expectancy <= -0.10
   * - lonely_yearning requires: future_expectancy >= -0.05
   * These CANNOT be satisfied simultaneously.
   */
  const mockEmotionPrototypes = {
    entries: {
      disappointment: {
        gates: ['valence <= -0.10', 'future_expectancy <= -0.10'],
        weights: { valence: -0.7, future_expectancy: -0.6 },
      },
      sadness: {
        gates: ['valence <= -0.20'],
        weights: { valence: -0.8 },
      },
      lonely_yearning: {
        // KEY CONFLICT: future_expectancy >= -0.05 vs disappointment's <= -0.10
        gates: ['future_expectancy >= -0.05', 'valence <= -0.10'],
        weights: { engagement: 0.9, future_expectancy: 0.35 },
      },
    },
  };

  beforeEach(() => {
    mockDataRegistry = {
      getLookupData: jest.fn((key) => {
        if (key === 'core:emotion_prototypes') {
          return mockEmotionPrototypes;
        }
        return null;
      }),
    };
    mockGateConstraintAnalyzer = {
      analyze: jest.fn(),
    };
    mockIntensityBoundsCalculator = {
      analyzeExpression: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
  });

  describe('Expression with conflicting gate in ONE OR branch', () => {
    let analyzer;

    /**
     * Expression structure (simplified melancholic_disappointment pattern):
     * - AND: disappointment >= 0.45 (gates enforced)
     * - AND: sadness >= 0.35 (gates enforced)
     * - OR:
     *   - Branch 1: disappointment crossing (just uses disappointment)
     *   - Branch 2: lonely_yearning surge (adds lonely_yearning with conflicting gates)
     *
     * Branch 1 should be FEASIBLE (disappointment gates only)
     * Branch 2 should be INFEASIBLE (disappointment + lonely_yearning gates conflict)
     * Overall expression should be FEASIBLE because Branch 1 works
     */
    const expressionWithConflictingOrBranch = {
      id: 'test:melancholic_pattern',
      prerequisites: [
        {
          logic: {
            and: [
              // Requirement 1: disappointment >= 0.45 (gates: future_expectancy <= -0.10)
              { '>=': [{ var: 'emotions.disappointment' }, 0.45] },
              // Requirement 2: sadness >= 0.35
              { '>=': [{ var: 'emotions.sadness' }, 0.35] },
              // OR block with two branches
              {
                or: [
                  // Branch 1: disappointment crossing (FEASIBLE)
                  // Only requires disappointment, which is already in the AND block
                  {
                    and: [
                      { '<': [{ var: 'previousEmotions.disappointment' }, 0.45] },
                      { '>=': [{ var: 'emotions.disappointment' }, 0.45] },
                    ],
                  },
                  // Branch 2: lonely_yearning surge (INFEASIBLE - gate conflict)
                  // Adds lonely_yearning >= 0.45 which has gates conflicting with disappointment
                  {
                    and: [
                      { '>=': [{ var: 'emotions.lonely_yearning' }, 0.45] },
                      {
                        '>=': [
                          {
                            '-': [
                              { var: 'emotions.lonely_yearning' },
                              { var: 'previousEmotions.lonely_yearning' },
                            ],
                          },
                          0.08,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should enumerate exactly 2 branches for the OR node', () => {
      const result = analyzer.analyze(expressionWithConflictingOrBranch);
      expect(result.branchCount).toBe(2);
    });

    it('should mark the expression as feasible when at least one OR branch has no gate conflicts', () => {
      const result = analyzer.analyze(expressionWithConflictingOrBranch);

      // This is the critical test: the expression should NOT be "unreachable"
      // because Branch 1 (disappointment crossing) is feasible
      expect(result.overallStatus).not.toBe('unreachable');

      // Should be either 'fully_reachable' or 'partially_reachable'
      expect(['fully_reachable', 'partially_reachable']).toContain(
        result.overallStatus
      );
    });

    it('should have at least one feasible branch', () => {
      const result = analyzer.analyze(expressionWithConflictingOrBranch);
      expect(result.feasibleBranchCount).toBeGreaterThanOrEqual(1);
    });

    it('should correctly identify which branches are feasible vs infeasible', () => {
      const result = analyzer.analyze(expressionWithConflictingOrBranch);

      const feasibleBranches = result.branches.filter((b) => !b.isInfeasible);

      // Branch 1 (disappointment crossing) should be feasible
      // It only uses disappointment + sadness, no gate conflicts
      expect(feasibleBranches.length).toBeGreaterThanOrEqual(1);

      // The lonely_yearning branch should exist and be infeasible
      const lonelyYearningBranch = result.branches.find(
        (b) =>
          b.requiredPrototypes.includes('lonely_yearning') ||
          b.description.includes('lonely_yearning')
      );

      // Assert branch exists and is infeasible
      expect(lonelyYearningBranch).toBeDefined();
      expect(lonelyYearningBranch.isInfeasible).toBe(true);
    });

    it('should only apply prototype gates for prototypes required in THAT branch', () => {
      const result = analyzer.analyze(expressionWithConflictingOrBranch);

      // Find the branch that does NOT include lonely_yearning
      const branchWithoutLonelyYearning = result.branches.find(
        (b) =>
          !b.requiredPrototypes.includes('lonely_yearning') &&
          !b.activePrototypes.includes('lonely_yearning')
      );

      // This branch should exist and be feasible
      expect(branchWithoutLonelyYearning).toBeDefined();
      expect(branchWithoutLonelyYearning.isInfeasible).toBe(false);

      // The branch should not have any future_expectancy conflicts
      // (since lonely_yearning's conflicting gate shouldn't apply)
      const hasFutureExpectancyConflict =
        branchWithoutLonelyYearning.conflicts.some((c) =>
          c.axis.includes('future_expectancy')
        );
      expect(hasFutureExpectancyConflict).toBe(false);
    });

    it('should include lonely_yearning gates only in the lonely_yearning branch', () => {
      const result = analyzer.analyze(expressionWithConflictingOrBranch);

      // Find the lonely_yearning branch
      const lonelyYearningBranch = result.branches.find(
        (b) =>
          b.requiredPrototypes.includes('lonely_yearning') ||
          b.activePrototypes.includes('lonely_yearning')
      );

      // Branch must exist
      expect(lonelyYearningBranch).toBeDefined();

      // This branch should have the future_expectancy conflict
      expect(lonelyYearningBranch.isInfeasible).toBe(true);

      // The conflict should mention future_expectancy
      const hasFutureExpectancyConflict = lonelyYearningBranch.conflicts.some(
        (c) => c.axis.includes('future_expectancy')
      );
      expect(hasFutureExpectancyConflict).toBe(true);
    });
  });

  describe('Debug: understanding branch state', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should log branch details for debugging', () => {
      const expressionWithConflictingOrBranch = {
        id: 'test:melancholic_pattern',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.disappointment' }, 0.45] },
                { '>=': [{ var: 'emotions.sadness' }, 0.35] },
                {
                  or: [
                    {
                      and: [
                        { '<': [{ var: 'previousEmotions.disappointment' }, 0.45] },
                        { '>=': [{ var: 'emotions.disappointment' }, 0.45] },
                      ],
                    },
                    {
                      and: [
                        { '>=': [{ var: 'emotions.lonely_yearning' }, 0.45] },
                        {
                          '>=': [
                            {
                              '-': [
                                { var: 'emotions.lonely_yearning' },
                                { var: 'previousEmotions.lonely_yearning' },
                              ],
                            },
                            0.08,
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expressionWithConflictingOrBranch);

      // Log detailed branch info
      console.log('=== Branch Analysis ===');
      console.log('Overall status:', result.overallStatus);
      console.log('Branch count:', result.branchCount);
      console.log('Feasible branch count:', result.feasibleBranchCount);

      for (const branch of result.branches) {
        console.log(`\n--- ${branch.branchId} ---`);
        console.log('Description:', branch.description);
        console.log('Required prototypes:', branch.requiredPrototypes);
        console.log('Active prototypes:', branch.activePrototypes);
        console.log('Inactive prototypes:', branch.inactivePrototypes);
        console.log('Is infeasible:', branch.isInfeasible);
        console.log('Conflicts:', branch.conflicts);
      }

      // This is just a debug test - always pass
      expect(true).toBe(true);
    });
  });

  describe('Prototype collection in nested expressions', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
    });

    it('should collect prototypes from previousEmotions references', () => {
      const expression = {
        id: 'test:prev_emotions',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.disappointment' }, 0.45] },
                { '<': [{ var: 'previousEmotions.disappointment' }, 0.45] },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Should recognize 'disappointment' from both current and previous references
      expect(result.branches[0].requiredPrototypes).toContain('disappointment');
    });

    it('should collect prototypes from arithmetic expressions', () => {
      const expression = {
        id: 'test:arithmetic',
        prerequisites: [
          {
            logic: {
              '>=': [
                {
                  '-': [
                    { var: 'emotions.lonely_yearning' },
                    { var: 'previousEmotions.lonely_yearning' },
                  ],
                },
                0.08,
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Should recognize 'lonely_yearning' from the arithmetic expression
      expect(result.branches[0].requiredPrototypes).toContain('lonely_yearning');
    });
  });
});
