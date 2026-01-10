/**
 * @file Test fixtures for advanced metrics integration tests
 * Provides controlled expressions with known statistical properties
 * for validating percentiles, near-miss, last-mile, and ceiling detection.
 * @see specs/monte-carlo-advanced-metrics.md
 */

/**
 * Expression with moderate threshold for percentile testing.
 *
 * Distribution analysis (emotions from mood axes):
 * - valence is uniform [-1, 1] normalized from moodAxes
 * - joy = clamp(valence, 0, 1)
 * - ~50% chance valence < 0 → joy = 0
 * - ~50% chance valence >= 0 → joy uniform [0, 1]
 *
 * For joy >= 0.5:
 * - valence < 0: always fails (50%)
 * - valence >= 0 but < 0.5: fails (25%)
 * - Total expected failure rate: ~75%
 */
export const uniformThresholdExpression = {
  id: 'test:uniform_threshold',
  description: 'Uniform threshold expression for percentile testing',
  prerequisites: [
    {
      logic: {
        and: [{ '>=': [{ var: 'emotions.joy' }, 0.5] }],
      },
    },
  ],
  expectedMetrics: {
    // With emotion calculation, ~75% failure rate
    failureRate: { min: 0.70, max: 0.80 },
  },
};

/**
 * Expression with very high threshold for ceiling effect testing.
 * joy >= 0.95 is nearly unreachable with normal distributions.
 *
 * Expected behavior:
 * - Very high failure rate (>95%)
 * - maxObserved < threshold (ceiling detected)
 * - ceilingGap > 0
 */
export const ceilingEffectExpression = {
  id: 'test:ceiling',
  description: 'Ceiling effect expression - threshold nearly unreachable',
  prerequisites: [
    {
      logic: {
        and: [{ '>=': [{ var: 'emotions.joy' }, 0.95] }],
      },
    },
  ],
  expectedMetrics: {
    failureRate: { min: 0.95, max: 1.0 },
    ceilingDetected: true,
  },
};

/**
 * Multi-clause expression for last-mile blocker testing.
 *
 * Clause A (joy >= 0.1): Easy to pass
 * - ~50% valence >= 0, and of those 90% have joy >= 0.1
 * - Plus some passes from the 50% where valence < 0 → joy = 0 (fails)
 * - Overall pass rate: ~45%
 *
 * Clause B (anger >= 0.7): Hard to pass
 * - anger = clamp(threat * 0.7 + arousal * 0.8, 0, 1)
 * - Much harder to reach 0.7 threshold
 * - Expected pass rate: ~10-15%
 *
 * Clause B should be the decisive blocker (higher last-mile rate).
 */
export const lastMileExpression = {
  id: 'test:last_mile',
  description: 'Last-mile blocker identification - anger should be decisive',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.1] },
          { '>=': [{ var: 'emotions.anger' }, 0.7] },
        ],
      },
    },
  ],
  expectedMetrics: {
    // anger (clause B) should have higher last-mile rate
    angerLastMileHigher: true,
  },
};

/**
 * Single-clause expression for edge case testing.
 * When there's only one clause:
 * - isSingleClause should be true
 * - lastMileFailRate should equal failureRate
 */
export const singleClauseExpression = {
  id: 'test:single_clause',
  description: 'Single clause expression for edge case testing',
  prerequisites: [
    {
      logic: { '>=': [{ var: 'emotions.joy' }, 0.5] },
    },
  ],
  expectedMetrics: {
    isSingleClause: true,
    // lastMileFailRate ≈ failureRate for single clause
  },
};

/**
 * Expression that always passes for edge case testing.
 * joy >= 0 always succeeds since joy is always >= 0.
 */
export const alwaysPassExpression = {
  id: 'test:always_pass',
  description: 'Expression that always passes',
  prerequisites: [
    {
      logic: {
        and: [{ '>=': [{ var: 'emotions.joy' }, 0] }],
      },
    },
  ],
  expectedMetrics: {
    failureRate: 0,
    triggerRate: 1,
  },
};

/**
 * Expression that always fails for edge case testing.
 * joy >= 2 never succeeds since max joy is 1.
 */
export const alwaysFailExpression = {
  id: 'test:always_fail',
  description: 'Expression that always fails',
  prerequisites: [
    {
      logic: {
        and: [{ '>=': [{ var: 'emotions.joy' }, 2] }],
      },
    },
  ],
  expectedMetrics: {
    failureRate: 1,
    triggerRate: 0,
    // Ceiling should definitely be detected
    ceilingDetected: true,
  },
};

/**
 * Expression with low threshold for near-miss testing.
 * Values should cluster near the threshold, resulting in high near-miss rate.
 *
 * fear <= 0.3: Most samples pass, but many are close to threshold.
 * - 50% threat < 0 → fear = 0 → passes
 * - 50% threat >= 0 → fear = threat → 30% pass, 20% fail
 * - Near-miss zone: values in [0.25, 0.35] range
 */
export const nearMissExpression = {
  id: 'test:near_miss',
  description: 'Expression for near-miss rate testing',
  prerequisites: [
    {
      logic: {
        and: [{ '<=': [{ var: 'emotions.fear' }, 0.3] }],
      },
    },
  ],
  expectedMetrics: {
    // Should have measurable near-miss rate
    hasNearMisses: true,
  },
};

/**
 * Expression with multiple clauses of varying difficulty.
 * Useful for testing that harder clauses are correctly identified.
 *
 * Clause 1: joy >= 0.3 (moderate, ~60% pass)
 * Clause 2: fear <= 0.5 (easy, ~75% pass)
 * Clause 3: confidence >= 0.8 (hard, ~10% pass)
 */
export const multiDifficultyExpression = {
  id: 'test:multi_difficulty',
  description: 'Multiple clauses with varying difficulty levels',
  prerequisites: [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.3] },
          { '<=': [{ var: 'emotions.fear' }, 0.5] },
          { '>=': [{ var: 'emotions.confidence' }, 0.8] },
        ],
      },
    },
  ],
  expectedMetrics: {
    // confidence clause should be the worst blocker
    confidenceHighestFailure: true,
  },
};
