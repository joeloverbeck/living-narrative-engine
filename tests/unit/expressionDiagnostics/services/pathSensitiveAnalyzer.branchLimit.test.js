/**
 * @file Tests for PathSensitiveAnalyzer branch limit behavior
 * @description Regression tests verifying that branch limit counting is accurate
 * and only triggers warnings when genuinely exceeding the limit.
 *
 * Bug context: The original implementation counted leaf visits instead of final paths,
 * causing premature truncation for expressions like flustered_jealousy.expression.json
 * which has 45 actual paths but triggered the 100-branch warning.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PathSensitiveAnalyzer from '../../../../src/expressionDiagnostics/services/PathSensitiveAnalyzer.js';

describe('PathSensitiveAnalyzer - Branch Limit Accuracy', () => {
  let mockDataRegistry;
  let mockGateConstraintAnalyzer;
  let mockIntensityBoundsCalculator;
  let mockLogger;

  beforeEach(() => {
    mockDataRegistry = {
      getLookupData: jest.fn().mockReturnValue(null),
    };
    mockGateConstraintAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        constraints: [],
        knifeEdges: [],
        gateCount: 0,
      }),
    };
    mockIntensityBoundsCalculator = {
      analyzeExpression: jest.fn().mockReturnValue({
        bounds: {},
        intensityAnalysis: [],
      }),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  /**
   * Creates expression definition with nested OR structure similar to flustered_jealousy.
   * Structure: AND with 3 OR nodes producing 5 × 3 × 3 = 45 paths
   */
  function createFlustered45PathExpression() {
    return {
      id: 'test:flustered_like',
      description: 'Test expression mimicking flustered_jealousy structure',
      priority: 67,
      prerequisites: [
        {
          logic: {
            and: [
              // Simple leaves (7 total, like flustered_jealousy)
              { '<': [{ var: 'emotions.rage' }, 0.55] },
              { '>=': [{ var: 'moodAxes.arousal' }, 15] },
              { '>=': [{ var: 'moodAxes.threat' }, 10] },
              { '>=': [{ var: 'moodAxes.engagement' }, -5] },
              { '<=': [{ var: 'moodAxes.self_evaluation' }, -5] },
              { '<=': [{ var: 'emotions.freeze' }, 0.55] },
              { '<=': [{ var: 'emotions.panic' }, 0.2] },
              // OR-1: 2 branches with nested OR (2 + 3 = 5 sub-paths total)
              {
                or: [
                  {
                    and: [
                      { '>=': [{ var: 'emotions.jealousy' }, 0.45] },
                      {
                        or: [
                          { '>=': [{ var: 'emotions.love_attachment' }, 0.25] },
                          {
                            '>=': [
                              { var: 'sexualStates.romantic_yearning' },
                              0.25,
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    and: [
                      { '>=': [{ var: 'emotions.envy' }, 0.55] },
                      {
                        or: [
                          { '>=': [{ var: 'emotions.shame' }, 0.25] },
                          { '>=': [{ var: 'emotions.embarrassment' }, 0.25] },
                          { '<=': [{ var: 'moodAxes.self_evaluation' }, -10] },
                        ],
                      },
                    ],
                  },
                ],
              },
              // OR-2: 3 branches
              {
                or: [
                  { '>=': [{ var: 'emotions.freeze' }, 0.14] },
                  { '>=': [{ var: 'emotions.unease' }, 0.25] },
                  { '>=': [{ var: 'emotions.anxiety' }, 0.25] },
                ],
              },
              // OR-3: 3 branches (temporal delta checks)
              {
                or: [
                  {
                    '>=': [
                      {
                        '-': [
                          { var: 'emotions.jealousy' },
                          { var: 'previousEmotions.jealousy' },
                        ],
                      },
                      0.08,
                    ],
                  },
                  {
                    '>=': [
                      {
                        '-': [
                          { var: 'emotions.envy' },
                          { var: 'previousEmotions.envy' },
                        ],
                      },
                      0.08,
                    ],
                  },
                  {
                    '>=': [
                      {
                        '-': [
                          { var: 'emotions.freeze' },
                          { var: 'previousEmotions.freeze' },
                        ],
                      },
                      0.1,
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Creates expression with >100 actual paths to verify warning triggers correctly.
   * Structure: AND with 3 OR nodes each having 5 branches = 5 × 5 × 5 = 125 paths
   */
  function createOver100PathExpression() {
    return {
      id: 'test:many_paths',
      description: 'Expression designed to exceed 100 paths',
      priority: 50,
      prerequisites: [
        {
          logic: {
            and: [
              // OR-1: 5 branches
              {
                or: [
                  { '>=': [{ var: 'emotions.a1' }, 0.1] },
                  { '>=': [{ var: 'emotions.a2' }, 0.1] },
                  { '>=': [{ var: 'emotions.a3' }, 0.1] },
                  { '>=': [{ var: 'emotions.a4' }, 0.1] },
                  { '>=': [{ var: 'emotions.a5' }, 0.1] },
                ],
              },
              // OR-2: 5 branches
              {
                or: [
                  { '>=': [{ var: 'emotions.b1' }, 0.1] },
                  { '>=': [{ var: 'emotions.b2' }, 0.1] },
                  { '>=': [{ var: 'emotions.b3' }, 0.1] },
                  { '>=': [{ var: 'emotions.b4' }, 0.1] },
                  { '>=': [{ var: 'emotions.b5' }, 0.1] },
                ],
              },
              // OR-3: 5 branches
              {
                or: [
                  { '>=': [{ var: 'emotions.c1' }, 0.1] },
                  { '>=': [{ var: 'emotions.c2' }, 0.1] },
                  { '>=': [{ var: 'emotions.c3' }, 0.1] },
                  { '>=': [{ var: 'emotions.c4' }, 0.1] },
                  { '>=': [{ var: 'emotions.c5' }, 0.1] },
                ],
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Creates simple expression with exactly known path count for validation.
   * Structure: AND(OR(2), OR(3)) = 2 × 3 = 6 paths
   */
  function createSimple6PathExpression() {
    return {
      id: 'test:simple_6',
      description: 'Simple expression with 6 paths',
      priority: 50,
      prerequisites: [
        {
          logic: {
            and: [
              {
                or: [
                  { '>=': [{ var: 'emotions.x1' }, 0.1] },
                  { '>=': [{ var: 'emotions.x2' }, 0.1] },
                ],
              },
              {
                or: [
                  { '>=': [{ var: 'emotions.y1' }, 0.1] },
                  { '>=': [{ var: 'emotions.y2' }, 0.1] },
                  { '>=': [{ var: 'emotions.y3' }, 0.1] },
                ],
              },
            ],
          },
        },
      ],
    };
  }

  describe('Accurate path counting', () => {
    it('should NOT trigger warning for expression with 45 paths (flustered_jealousy pattern)', () => {
      // Arrange
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      const expression = createFlustered45PathExpression();

      // Act
      const result = analyzer.analyze(expression);

      // Assert - no warning should be logged
      expect(mockLogger.warn).not.toHaveBeenCalled();
      // Should have 45 branches (5 × 3 × 3)
      expect(result.branches.length).toBe(45);
    });

    it('should enumerate exactly 6 paths for simple AND(OR(2), OR(3)) expression', () => {
      // Arrange
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      const expression = createSimple6PathExpression();

      // Act
      const result = analyzer.analyze(expression);

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(result.branches.length).toBe(6);
    });

    it('should trigger warning for expression with >100 actual paths', () => {
      // Arrange
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      const expression = createOver100PathExpression();

      // Act
      const result = analyzer.analyze(expression);

      // Assert - warning should be logged for >100 paths
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Branch limit')
      );
      // Should be capped at 100 branches
      expect(result.branches.length).toBe(100);
    });

    it('should include actual path count in warning message when limit exceeded', () => {
      // Arrange
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      const expression = createOver100PathExpression();

      // Act
      analyzer.analyze(expression);

      // Assert - warning should mention 125 actual paths
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/125 paths found/)
      );
    });
  });

  describe('Custom maxBranches option', () => {
    it('should respect custom lower maxBranches limit', () => {
      // Arrange
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      const expression = createFlustered45PathExpression();

      // Act - limit to 20 branches
      const result = analyzer.analyze(expression, { maxBranches: 20 });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Branch limit (20) reached')
      );
      expect(result.branches.length).toBe(20);
    });

    it('should allow higher maxBranches limit', () => {
      // Arrange
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });
      const expression = createOver100PathExpression();

      // Act - allow up to 200 branches
      const result = analyzer.analyze(expression, { maxBranches: 200 });

      // Assert - no warning since 125 < 200
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(result.branches.length).toBe(125);
    });
  });

  describe('Regression: Bug fix validation', () => {
    it('should count final paths, not leaf visits', () => {
      // Arrange
      // This test validates the fix for the bug where pathCount++ was
      // incrementing on every leaf visit instead of every final path.
      const analyzer = new PathSensitiveAnalyzer({
        dataRegistry: mockDataRegistry,
        gateConstraintAnalyzer: mockGateConstraintAnalyzer,
        intensityBoundsCalculator: mockIntensityBoundsCalculator,
        logger: mockLogger,
      });

      // Expression with structure that causes many leaf visits but few final paths
      // AND(OR(a,b), c) = 2 final paths, but 4 leaf visits in buggy implementation
      const expression = {
        id: 'test:leaf_visit_bug',
        description: 'Test for leaf visit vs final path counting',
        priority: 50,
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    { '>=': [{ var: 'emotions.a' }, 0.1] },
                    { '>=': [{ var: 'emotions.b' }, 0.1] },
                  ],
                },
                { '>=': [{ var: 'emotions.c' }, 0.1] },
              ],
            },
          },
        ],
      };

      // Act
      const result = analyzer.analyze(expression, { maxBranches: 3 });

      // Assert - exactly 2 paths, not truncated due to leaf visit overcounting
      expect(result.branches.length).toBe(2);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
