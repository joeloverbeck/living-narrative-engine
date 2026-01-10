/**
 * @file Unit tests for PathSensitiveAnalyzer negative weight formula handling
 * @see src/expressionDiagnostics/services/PathSensitiveAnalyzer.js
 *
 * These tests verify that negative weight formulas correctly account for
 * mood axis ranges of [-1, 1], not [0, 1].
 *
 * Bug context: The analyzer was marking relief paths as unreachable for
 * tearful_gratitude.expression.json because it incorrectly calculated
 * maxPossible using formulas that assumed [0,1] axis range.
 *
 * Relief prototype:
 *   weights: { valence: 0.8, arousal: -0.4, threat: -0.9 }
 *   gates: ["threat <= 0.20"]
 *
 * With the buggy formula (1 - interval.min), negative weights gave wrong contribution.
 * Correct formula is (-interval.min) for [-1, 1] range.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PathSensitiveAnalyzer from '../../../../src/expressionDiagnostics/services/PathSensitiveAnalyzer.js';

describe('PathSensitiveAnalyzer - Negative Weight Formula Fix', () => {
  let mockDataRegistry;
  let mockGateConstraintAnalyzer;
  let mockIntensityBoundsCalculator;
  let mockLogger;

  // Prototype definitions matching the real emotion_prototypes.lookup.json
  const emotionPrototypes = {
    gratitude: {
      weights: { valence: 0.7, social: 0.3 },
      gates: ['valence >= 0.30'],
    },
    relief: {
      weights: { valence: 0.8, arousal: -0.4, threat: -0.9 },
      gates: ['threat <= 0.20'],
    },
    affection: {
      weights: { valence: 0.6, social: 0.25, arousal: 0.15 },
      gates: ['valence >= 0.20', 'social >= 0.10'],
    },
    admiration: {
      weights: { valence: 0.5, social: 0.3, agency_control: 0.2 },
      gates: ['valence >= 0.15', 'social >= 0.05'],
    },
    awe: {
      weights: { valence: 0.4, arousal: 0.35, agency_control: -0.25 },
      gates: ['arousal >= 0.20'],
    },
    inspiration: {
      weights: { valence: 0.45, arousal: 0.3, agency_control: 0.25 },
      gates: ['valence >= 0.25', 'arousal >= 0.10'],
    },
    // Simple test prototypes
    test_negative_only: {
      weights: { threat: -1.0 },
      gates: [],
    },
    test_mixed_weights: {
      weights: { valence: 0.5, threat: -0.5 },
      gates: [],
    },
  };

  beforeEach(() => {
    mockDataRegistry = {
      getLookupData: jest.fn((key) => {
        if (key === 'core:emotion_prototypes') {
          return { entries: emotionPrototypes };
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

  /**
   * Creates a PathSensitiveAnalyzer instance with mocked dependencies
   */
  function createAnalyzer() {
    return new PathSensitiveAnalyzer({
      dataRegistry: mockDataRegistry,
      gateConstraintAnalyzer: mockGateConstraintAnalyzer,
      intensityBoundsCalculator: mockIntensityBoundsCalculator,
      logger: mockLogger,
    });
  }

  describe('maxIntensity calculation for negative weights', () => {
    it('should calculate maxIntensity >= 0.4 for relief prototype', () => {
      // This test reproduces the bug where relief's maxPossible was 0.38 instead of >= 0.4
      // Relief has: weights={valence:0.8, arousal:-0.4, threat:-0.9}, gate="threat<=0.20"
      const analyzer = createAnalyzer();

      // Expression requiring relief >= 0.4
      const expression = {
        id: 'test:relief_threshold',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.relief' }, 0.4] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reliefReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'relief' && r.direction === 'high'
      );

      expect(reliefReachability).toBeDefined();

      // With correct formula, maxPossible should be >= 0.4
      // The buggy code gave 0.38, correct code should give higher
      console.log('Relief reachability:', {
        prototypeId: reliefReachability.prototypeId,
        direction: reliefReachability.direction,
        threshold: reliefReachability.threshold,
        minPossible: reliefReachability.minPossible,
        maxPossible: reliefReachability.maxPossible,
        isReachable: reliefReachability.isReachable,
        gap: reliefReachability.gap,
      });

      // Key assertion: relief >= 0.4 should be reachable (maxPossible >= 0.4)
      expect(reliefReachability.isReachable).toBe(true);
      expect(reliefReachability.maxPossible).toBeGreaterThanOrEqual(0.4);
    });

    it('should mark relief >= 0.4 as reachable for tearful_gratitude structure', () => {
      // Full reproduction of the tearful_gratitude expression structure
      const analyzer = createAnalyzer();

      const expression = {
        id: 'test:tearful_gratitude_scenario',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.gratitude' }, 0.6] },
                { '<=': [{ var: 'moodAxes.threat' }, 30] },
                {
                  or: [
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'previousMoodAxes.threat' },
                            { var: 'moodAxes.threat' },
                          ],
                        },
                        15,
                      ],
                    },
                    { '>=': [{ var: 'emotions.relief' }, 0.4] },
                  ],
                },
                { '>=': [{ var: 'moodAxes.valence' }, 10] },
                {
                  or: [
                    { '>=': [{ var: 'emotions.affection' }, 0.5] },
                    { '>=': [{ var: 'emotions.admiration' }, 0.45] },
                    { '>=': [{ var: 'emotions.awe' }, 0.45] },
                    { '>=': [{ var: 'emotions.inspiration' }, 0.45] },
                  ],
                },
              ],
            },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      // Find all relief-related reachabilities
      const reliefReachabilities = result.reachabilityByBranch.filter(
        (r) => r.prototypeId === 'relief'
      );

      expect(reliefReachabilities.length).toBeGreaterThan(0);

      // At least one relief path should be reachable
      const hasReachableReliefPath = reliefReachabilities.some(
        (r) => r.isReachable
      );
      expect(hasReachableReliefPath).toBe(true);

      // All relief paths with threshold 0.4 should have maxPossible >= 0.4
      const highReliefPaths = reliefReachabilities.filter(
        (r) => r.threshold === 0.4 && r.direction === 'high'
      );

      expect(highReliefPaths.length).toBeGreaterThan(0);

      for (const r of highReliefPaths) {
        console.log('Relief path:', {
          branchId: r.branchId,
          maxPossible: r.maxPossible,
          isReachable: r.isReachable,
          gap: r.gap,
        });
      }

      // Verify all high relief paths have sufficient maxPossible
      const allPathsReachable = highReliefPaths.every(
        (r) => r.maxPossible >= 0.4
      );
      expect(allPathsReachable).toBe(true);
    });

    it('should use best case for unconstrained negative weight axes', () => {
      // When an axis has no interval constraint, negative weights should
      // assume the best case (axis at -1) giving contribution of |w| * 1
      const analyzer = createAnalyzer();

      // Expression with prototype having negative weight on unconstrained axis
      const expression = {
        id: 'test:unconstrained_negative',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.test_negative_only' }, 0.5] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'test_negative_only'
      );

      expect(reachability).toBeDefined();

      // With unconstrained threat axis and negative weight,
      // best case is threat=-1, giving contribution = |−1| * (−(−1)) = 1 * 1 = 1
      // So maxPossible should be 1.0 (or close to it)
      console.log('Unconstrained negative weight:', {
        maxPossible: reachability.maxPossible,
        isReachable: reachability.isReachable,
      });

      // Buggy code would give 0 for unconstrained negative weights
      // Correct code gives 1.0
      expect(reachability.maxPossible).toBeGreaterThan(0.5);
      expect(reachability.isReachable).toBe(true);
    });

    it('should correctly handle mixed positive and negative weights', () => {
      const analyzer = createAnalyzer();

      const expression = {
        id: 'test:mixed_weights',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.test_mixed_weights' }, 0.7] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'test_mixed_weights'
      );

      expect(reachability).toBeDefined();

      // test_mixed_weights: valence=0.5 (positive), threat=-0.5 (negative)
      // Best case: valence=1 gives 0.5*1=0.5, threat=-1 gives 0.5*1=0.5
      // Total raw: 1.0, weightSum: 1.0, result: 1.0
      console.log('Mixed weights:', {
        maxPossible: reachability.maxPossible,
        isReachable: reachability.isReachable,
      });

      // Should be able to reach 0.7 threshold
      expect(reachability.maxPossible).toBeGreaterThanOrEqual(0.7);
      expect(reachability.isReachable).toBe(true);
    });
  });

  describe('minIntensity calculation for negative weights', () => {
    it('should calculate minIntensity correctly for negative weights with intervals', () => {
      const analyzer = createAnalyzer();

      // Expression with a LOW threshold requirement
      const expression = {
        id: 'test:low_relief',
        prerequisites: [
          {
            logic: { '<': [{ var: 'emotions.relief' }, 0.3] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'relief' && r.direction === 'low'
      );

      expect(reachability).toBeDefined();

      console.log('Low relief:', {
        minPossible: reachability.minPossible,
        threshold: reachability.threshold,
        isReachable: reachability.isReachable,
      });

      // For LOW direction, isReachable means minPossible < threshold
      // minPossible should be able to go below 0.3
      expect(reachability.isReachable).toBe(true);
    });

    it('should calculate correct minIntensity for unconstrained negative weights', () => {
      const analyzer = createAnalyzer();

      const expression = {
        id: 'test:low_negative_only',
        prerequisites: [
          {
            logic: { '<': [{ var: 'emotions.test_negative_only' }, 0.5] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'test_negative_only' && r.direction === 'low'
      );

      expect(reachability).toBeDefined();

      console.log('Low unconstrained negative:', {
        minPossible: reachability.minPossible,
        isReachable: reachability.isReachable,
      });

      // For unconstrained axis with negative weight,
      // worst case is threat=1, giving contribution = |−1| * (−1) = -1 (clamped to 0)
      // minPossible should be 0 or close
      expect(reachability.minPossible).toBeLessThanOrEqual(0.5);
      expect(reachability.isReachable).toBe(true);
    });
  });

  describe('formula verification with constrained intervals', () => {
    it('should handle threat interval [0.20, 1] correctly for negative weight', () => {
      // When threat gate is "threat <= 0.20", interval becomes [-1, 0.20]
      // For negative weight on threat:
      // - max contribution: at interval.min=-1, contribution = |w| * (-(-1)) = |w| * 1
      // - min contribution: at interval.max=0.20, contribution = |w| * (-0.20)
      const analyzer = createAnalyzer();

      // Expression that will constrain threat via relief's gate
      const expression = {
        id: 'test:constrained_threat',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'emotions.relief' }, 0.6] },
          },
        ],
      };

      const result = analyzer.analyze(expression);

      const reliefReachability = result.reachabilityByBranch.find(
        (r) => r.prototypeId === 'relief' && r.direction === 'high'
      );

      expect(reliefReachability).toBeDefined();

      // Relief has: valence=0.8, arousal=-0.4, threat=-0.9
      // Gate: threat <= 0.20, so threat interval = [-1, 0.20]
      //
      // For maxPossible:
      // - valence: unconstrained, positive weight → max at 1, contrib = 0.8 * 1 = 0.8
      // - arousal: unconstrained, negative weight → max at -1, contrib = 0.4 * 1 = 0.4
      // - threat: constrained [-1, 0.20], negative weight → max at -1, contrib = 0.9 * 1 = 0.9
      // Total raw: 0.8 + 0.4 + 0.9 = 2.1
      // Weight sum: 0.8 + 0.4 + 0.9 = 2.1
      // maxPossible = 2.1 / 2.1 = 1.0
      //
      // The buggy formula would compute:
      // - threat contrib = 0.9 * (1 - (-1)) = 0.9 * 2 = 1.8 (WRONG)

      console.log('Constrained relief:', {
        maxPossible: reliefReachability.maxPossible,
        threshold: reliefReachability.threshold,
        isReachable: reliefReachability.isReachable,
      });

      expect(reliefReachability.isReachable).toBe(true);
      expect(reliefReachability.maxPossible).toBeGreaterThanOrEqual(0.6);
    });
  });
});
