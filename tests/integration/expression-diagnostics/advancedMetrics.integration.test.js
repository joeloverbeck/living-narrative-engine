/**
 * @file Integration tests for Monte Carlo advanced metrics
 * Tests percentiles, near-miss rate, last-mile rate, and ceiling detection
 * end-to-end through MonteCarloSimulator and FailureExplainer.
 * @see specs/monte-carlo-advanced-metrics.md
 * @see src/expressionDiagnostics/services/MonteCarloSimulator.js
 * @see src/expressionDiagnostics/services/FailureExplainer.js
 * @see src/expressionDiagnostics/models/HierarchicalClauseNode.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import FailureExplainer from '../../../src/expressionDiagnostics/services/FailureExplainer.js';
import RandomStateGenerator from '../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import {
  uniformThresholdExpression,
  lastMileExpression,
  singleClauseExpression,
  alwaysPassExpression,
  alwaysFailExpression,
  nearMissExpression,
  multiDifficultyExpression,
} from './fixtures/advancedMetricsFixtures.js';

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

describe('Advanced Metrics Integration', () => {
  let mockLogger;
  let mockDataRegistry;
  let simulator;
  let explainer;
  let mockEmotionCalculatorAdapter;

  // Mock emotion prototypes for the simulator
  const mockEmotionPrototypes = {
    entries: {
      joy: { weights: { valence: 1.0 }, gates: [] },
      fear: { weights: { threat: 1.0 }, gates: [] },
      anger: { weights: { threat: 0.7, arousal: 0.8 }, gates: [] },
      confidence: { weights: { agency_control: 0.8 }, gates: [] },
      curiosity: { weights: { engagement: 0.8 }, gates: [] },
    },
  };

  // Mock sexual prototypes (empty for these tests)
  const mockSexualPrototypes = {
    entries: {},
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
          if (lookupId === 'core:sexual_prototypes') {
            return mockSexualPrototypes;
          }
        }
        return null;
      }),
    };

    mockEmotionCalculatorAdapter = buildEmotionCalculatorAdapter(
      mockDataRegistry,
      mockLogger
    );

    const randomStateGenerator = new RandomStateGenerator({
      logger: mockLogger,
    });

    simulator = new MonteCarloSimulator({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
      randomStateGenerator,
    });

    explainer = new FailureExplainer({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  describe('Percentile Accuracy', () => {
    it('should calculate p50 and p90 for clause failures', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 5000,
      });

      expect(result.clauseFailures).toHaveLength(1);
      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

      // Find the leaf node with violation percentiles
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // With uniform threshold expression, there will always be failures
      // (threshold 0.5 with ~75% failure rate as documented in fixtures)
      expect(leaf.failureCount).toBeGreaterThan(0);
      expect(leaf.violationP50).toBeDefined();
      expect(leaf.violationP90).toBeDefined();
      // p90 should be >= p50 (90th percentile is higher)
      expect(leaf.violationP90).toBeGreaterThanOrEqual(leaf.violationP50);
    });

    it('should have p90 >= p50 for all failing clauses', async () => {
      const result = await simulator.simulate(multiDifficultyExpression, {
        sampleCount: 5000,
      });

      const collectLeaves = (node, leaves = []) => {
        if (node.nodeType === 'leaf') {
          leaves.push(node);
        }
        if (node.children) {
          node.children.forEach((child) => collectLeaves(child, leaves));
        }
        return leaves;
      };

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaves = collectLeaves(breakdown);

      // Filter to leaves that have failures and both percentiles computed
      const leavesWithPercentiles = leaves.filter(
        (leaf) =>
          leaf.failureCount > 0 &&
          leaf.violationP50 !== null &&
          leaf.violationP90 !== null
      );

      // Verify we have at least some leaves with percentile data
      expect(leavesWithPercentiles.length).toBeGreaterThan(0);

      // For all such leaves, p90 should be >= p50
      leavesWithPercentiles.forEach((leaf) => {
        expect(leaf.violationP90).toBeGreaterThanOrEqual(leaf.violationP50);
      });
    });

    it('should return null percentiles when no failures exist', async () => {
      const result = await simulator.simulate(alwaysPassExpression, {
        sampleCount: 1000,
      });

      expect(result.triggerRate).toBe(1);
      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // No failures means percentiles should be null
      expect(leaf.failureCount).toBe(0);
      expect(leaf.violationP50).toBeNull();
      expect(leaf.violationP90).toBeNull();
    });
  });

  describe('Near-Miss Rate Accuracy', () => {
    it('should track near-miss rate for clauses', async () => {
      const result = await simulator.simulate(nearMissExpression, {
        sampleCount: 5000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // Near-miss rate should be defined
      expect(typeof leaf.nearMissRate).toBe('number');
      // Should be between 0 and 1
      expect(leaf.nearMissRate).toBeGreaterThanOrEqual(0);
      expect(leaf.nearMissRate).toBeLessThanOrEqual(1);
    });

    it('should have epsilon defined for near-miss calculation', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 1000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // Epsilon should be defined for emotion domain
      expect(leaf.nearMissEpsilon).toBeDefined();
      // Emotions typically use epsilon = 0.05
      expect(leaf.nearMissEpsilon).toBe(0.05);
    });

    it('should detect near-misses when values cluster near threshold', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 10000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // With uniform distribution and threshold at 0.5, some values should be near
      // Near-miss rate should be > 0 (at least some samples near threshold)
      expect(leaf.nearMissRate).toBeGreaterThan(0);
    });
  });

  describe('Last-Mile Rate Accuracy', () => {
    it('should identify decisive blocker in multi-clause expression', async () => {
      const result = await simulator.simulate(lastMileExpression, {
        sampleCount: 10000,
      });

      const clause = result.clauseFailures[0];
      const breakdown = clause.hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      expect(breakdown.children).toHaveLength(2);

      // Last-mile data is aggregated at the top-level clause, not in individual children
      // The clause.lastMileFailRate reflects the overall "last-mile" blocking pattern
      expect(typeof clause.lastMileFailRate).toBe('number');
      expect(clause.lastMileContext).toBeDefined();
      expect(typeof clause.lastMileContext.othersPassedCount).toBe('number');
      expect(typeof clause.lastMileContext.lastMileFailCount).toBe('number');

      // For a multi-clause AND, the harder clause should dominate failures
      // With 10000 samples, we should have substantial last-mile data
      expect(clause.lastMileContext.othersPassedCount).toBeGreaterThan(0);

      // The lastMileFailRate should be high since anger >= 0.7 is hard
      expect(clause.lastMileFailRate).toBeGreaterThan(0.5);
    });

    it('should mark single-clause expressions correctly', async () => {
      const result = await simulator.simulate(singleClauseExpression, {
        sampleCount: 5000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // Single clause should be marked as such
      expect(leaf.isSingleClause).toBe(true);

      // For single clause expression (joy >= 0.5), there will be failures (~75% rate)
      expect(leaf.failureRate).toBeGreaterThan(0);

      // For single clause, lastMileFailRate should equal failureRate
      expect(Math.abs(leaf.lastMileFailRate - leaf.failureRate)).toBeLessThan(
        0.01
      );
    });

    it('should track othersPassedCount for multi-clause expressions', async () => {
      const result = await simulator.simulate(lastMileExpression, {
        sampleCount: 5000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

      for (const child of breakdown.children) {
        // Each child should have othersPassedCount tracked
        expect(typeof child.othersPassedCount).toBe('number');
        expect(child.othersPassedCount).toBeGreaterThanOrEqual(0);

        // lastMileFailCount should not exceed othersPassedCount
        expect(child.lastMileFailCount).toBeLessThanOrEqual(
          child.othersPassedCount
        );
      }
    });
  });

  describe('Ceiling Detection Accuracy', () => {
    it('should detect ceiling effect when max < threshold', async () => {
      // Use the always-fail expression which has threshold of 2 (impossible)
      const result = await simulator.simulate(alwaysFailExpression, {
        sampleCount: 5000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // Max observed should be tracked
      expect(typeof leaf.maxObservedValue).toBe('number');

      // For joy >= 2, max should definitely be below threshold (max joy is 1)
      expect(leaf.maxObservedValue).toBeLessThanOrEqual(1.0);

      // Ceiling gap should be positive (threshold - max > 0)
      expect(leaf.ceilingGap).toBeGreaterThan(0);
    });

    it('should not detect ceiling when max >= threshold', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 5000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // For joy >= 0.5, values can reach 1.0, so max should exceed threshold
      // Ceiling gap should be <= 0 (threshold - max <= 0)
      expect(leaf.ceilingGap).toBeLessThanOrEqual(0);
    });

    it('should definitely detect ceiling for impossible threshold', async () => {
      const result = await simulator.simulate(alwaysFailExpression, {
        sampleCount: 1000,
      });

      expect(result.triggerRate).toBe(0);

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      // joy >= 2 is impossible (max joy is 1)
      expect(leaf.failureRate).toBe(1);
      expect(leaf.ceilingGap).toBeGreaterThan(0);
    });
  });

  describe('FailureExplainer Integration', () => {
    it('should include advancedAnalysis in blocker results', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 5000,
      });

      const blockers = explainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );

      expect(blockers.length).toBeGreaterThan(0);

      for (const blocker of blockers) {
        expect(blocker.advancedAnalysis).toBeDefined();
        expect(blocker.advancedAnalysis.percentileAnalysis).toBeDefined();
        expect(blocker.advancedAnalysis.nearMissAnalysis).toBeDefined();
        expect(blocker.advancedAnalysis.ceilingAnalysis).toBeDefined();
        expect(blocker.advancedAnalysis.lastMileAnalysis).toBeDefined();
        expect(blocker.advancedAnalysis.recommendation).toBeDefined();
      }
    });

    it('should calculate priorityScore for blockers', async () => {
      const result = await simulator.simulate(multiDifficultyExpression, {
        sampleCount: 5000,
      });

      const blockers = explainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );

      expect(blockers.length).toBeGreaterThan(0);

      for (const blocker of blockers) {
        expect(typeof blocker.priorityScore).toBe('number');
        expect(blocker.priorityScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('should generate redesign recommendation for ceiling effects', async () => {
      // Use alwaysFailExpression which has threshold of 2 (definitely unreachable)
      const result = await simulator.simulate(alwaysFailExpression, {
        sampleCount: 5000,
      });

      const blockers = explainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );

      // Find blocker with ceiling detected
      const ceilingBlocker = blockers.find(
        (b) => b.advancedAnalysis?.ceilingAnalysis?.status === 'ceiling_detected'
      );

      expect(ceilingBlocker).toBeDefined();
      expect(ceilingBlocker.advancedAnalysis.recommendation.action).toBe(
        'redesign'
      );
      expect(ceilingBlocker.advancedAnalysis.recommendation.priority).toBe(
        'critical'
      );
    });

    it('should preserve existing blocker fields', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 5000,
      });

      const blockers = explainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );

      for (const blocker of blockers) {
        // Original fields must still exist
        expect(blocker).toHaveProperty('clauseDescription');
        expect(blocker).toHaveProperty('failureRate');
        expect(blocker).toHaveProperty('explanation');
        expect(blocker).toHaveProperty('rank');
        expect(blocker).toHaveProperty('severity');

        // Types should be correct
        expect(typeof blocker.failureRate).toBe('number');
        expect(blocker.failureRate).toBeGreaterThanOrEqual(0);
        expect(blocker.failureRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve existing ClauseResult fields', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 1000,
      });

      result.clauseFailures.forEach((clause) => {
        // Original fields must still exist
        expect(clause).toHaveProperty('failureRate');
        expect(clause).toHaveProperty('averageViolation');
        expect(clause).toHaveProperty('clauseDescription');
        expect(clause).toHaveProperty('hierarchicalBreakdown');

        // Types should be correct
        expect(typeof clause.failureRate).toBe('number');
        expect(clause.failureRate).toBeGreaterThanOrEqual(0);
        expect(clause.failureRate).toBeLessThanOrEqual(1);
      });
    });

    it('should not affect triggerRate calculation', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 5000,
      });

      const expected = uniformThresholdExpression.expectedMetrics;

      // Trigger rate = 1 - failureRate
      const expectedTriggerMin = 1 - expected.failureRate.max;
      const expectedTriggerMax = 1 - expected.failureRate.min;

      expect(result.triggerRate).toBeGreaterThanOrEqual(expectedTriggerMin);
      expect(result.triggerRate).toBeLessThanOrEqual(expectedTriggerMax);
    });

    it('should still produce hierarchicalBreakdown', async () => {
      const result = await simulator.simulate(lastMileExpression, {
        sampleCount: 1000,
      });

      expect(result.clauseFailures).toHaveLength(1);
      expect(result.clauseFailures[0].hierarchicalBreakdown).not.toBeNull();

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      expect(breakdown.children).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle expressions with no failures', async () => {
      const result = await simulator.simulate(alwaysPassExpression, {
        sampleCount: 1000,
      });

      expect(result.triggerRate).toBe(1);

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      expect(leaf.failureRate).toBe(0);
      expect(leaf.violationP50).toBeNull();
      expect(leaf.violationP90).toBeNull();
    });

    it('should handle expressions with 100% failure', async () => {
      const result = await simulator.simulate(alwaysFailExpression, {
        sampleCount: 1000,
      });

      expect(result.triggerRate).toBe(0);

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      expect(leaf.failureRate).toBe(1);
      expect(leaf.ceilingGap).toBeGreaterThan(0);
    });

    it('should handle empty prerequisites gracefully', async () => {
      const emptyExpression = {
        id: 'test:empty',
        description: 'Empty expression',
        prerequisites: [],
      };

      const result = await simulator.simulate(emptyExpression, {
        sampleCount: 100,
      });

      expect(result.clauseFailures).toHaveLength(0);
      expect(result.triggerRate).toBe(1);

      const blockers = explainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );
      expect(blockers).toHaveLength(0);
    });

    it('should handle null prerequisites gracefully', async () => {
      const nullExpression = {
        id: 'test:null',
        description: 'Null prerequisites',
        prerequisites: null,
      };

      const result = await simulator.simulate(nullExpression, {
        sampleCount: 100,
      });

      expect(result.clauseFailures).toHaveLength(0);
    });

    it('should handle deeply nested expressions', async () => {
      const deepExpression = {
        id: 'test:deep',
        description: 'Deeply nested structure',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  or: [
                    {
                      and: [
                        { '>=': [{ var: 'emotions.joy' }, 0.5] },
                        { '<=': [{ var: 'emotions.fear' }, 0.5] },
                      ],
                    },
                    { '>=': [{ var: 'emotions.confidence' }, 0.8] },
                  ],
                },
                { '>=': [{ var: 'emotions.curiosity' }, 0.3] },
              ],
            },
          },
        ],
      };

      const result = await simulator.simulate(deepExpression, {
        sampleCount: 1000,
      });

      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      expect(breakdown.nodeType).toBe('and');
      expect(breakdown.children[0].nodeType).toBe('or');
      expect(breakdown.children[0].children[0].nodeType).toBe('and');

      // Verify deepest level has advanced metrics
      const deepestAnd = breakdown.children[0].children[0];
      expect(deepestAnd.children[0].evaluationCount).toBeGreaterThan(0);
      expect(typeof deepestAnd.children[0].nearMissRate).toBe('number');
    });
  });

  describe('Statistical Consistency', () => {
    it('should produce consistent results across multiple runs', async () => {
      const results = [];

      // Run simulation 3 times
      for (let i = 0; i < 3; i++) {
        const result = await simulator.simulate(uniformThresholdExpression, {
          sampleCount: 5000,
        });
        results.push(result.triggerRate);
      }

      // All results should be within reasonable variance (±5%)
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      for (const rate of results) {
        expect(Math.abs(rate - avg)).toBeLessThan(0.05);
      }
    });

    it('should have failure rate within expected bounds', async () => {
      const result = await simulator.simulate(uniformThresholdExpression, {
        sampleCount: 10000,
      });

      const expected = uniformThresholdExpression.expectedMetrics;
      const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
      const leaf =
        breakdown.nodeType === 'leaf' ? breakdown : breakdown.children[0];

      expect(leaf.failureRate).toBeGreaterThanOrEqual(expected.failureRate.min);
      expect(leaf.failureRate).toBeLessThanOrEqual(expected.failureRate.max);
    });
  });
});
