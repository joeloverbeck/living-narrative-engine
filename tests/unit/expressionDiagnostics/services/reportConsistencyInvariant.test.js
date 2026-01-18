/**
 * @file reportConsistencyInvariant.test.js
 * @description Tests for report consistency invariants between BlockerSectionGenerator
 * and NonAxisFeasibilityAnalyzer outputs.
 *
 * Invariants tested:
 * - For any clause X >= t: if passCount > 0, then maxValue >= t
 * - For any clause X >= t: if maxValue < t, then passCount === 0
 * - Cross-validate between BlockerSectionGenerator and NonAxisFeasibilityAnalyzer outputs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import NonAxisFeasibilityAnalyzer from '../../../../src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js';
import NonAxisClauseExtractor from '../../../../src/expressionDiagnostics/services/NonAxisClauseExtractor.js';

describe('Report Consistency Invariants', () => {
  let mockLogger;
  let clauseExtractor;
  let feasibilityAnalyzer;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    clauseExtractor = new NonAxisClauseExtractor({ logger: mockLogger });
    feasibilityAnalyzer = new NonAxisFeasibilityAnalyzer({
      logger: mockLogger,
      clauseExtractor,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('passCount/maxValue consistency for >= operator', () => {
    it('should ensure passCount > 0 implies maxValue >= threshold', () => {
      // Test invariant: if passCount > 0, then maxValue >= threshold
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
      ];

      const contexts = [
        { emotions: { joy: 0.6 } }, // passes (0.6 >= 0.5)
        { emotions: { joy: 0.3 } }, // fails
        { emotions: { joy: 0.7 } }, // passes (0.7 >= 0.5)
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Invariant: if passRate > 0, maxValue must be >= threshold
      if (result.passRate > 0) {
        expect(result.maxValue).toBeGreaterThanOrEqual(result.threshold);
      }

      // Specific check: passRate should be 2/3, maxValue should be 0.7
      expect(result.passRate).toBeCloseTo(2 / 3, 6);
      expect(result.maxValue).toBe(0.7);
      expect(result.maxValue).toBeGreaterThanOrEqual(0.5);
    });

    it('should ensure maxValue < threshold implies passCount === 0', () => {
      // Test invariant: if maxValue < threshold, then passRate must be 0
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.sadness' }, 0.8] } },
      ];

      const contexts = [
        { emotions: { sadness: 0.1 } },
        { emotions: { sadness: 0.3 } },
        { emotions: { sadness: 0.5 } }, // max value
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Max value (0.5) is less than threshold (0.8)
      expect(result.maxValue).toBe(0.5);
      expect(result.maxValue).toBeLessThan(0.8);

      // Therefore passRate MUST be 0 - three-tier classification uses EMPIRICALLY_UNREACHABLE
      expect(result.passRate).toBe(0);
      expect(result.classification).toBe('EMPIRICALLY_UNREACHABLE');
    });
  });

  describe('passCount/maxValue consistency for > operator', () => {
    it('should ensure passCount > 0 implies maxValue > threshold', () => {
      const prereqs = [
        { logic: { '>': [{ var: 'emotions.anger' }, 0.4] } },
      ];

      const contexts = [
        { emotions: { anger: 0.5 } }, // passes (0.5 > 0.4)
        { emotions: { anger: 0.4 } }, // fails (not greater)
        { emotions: { anger: 0.6 } }, // passes
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Invariant: if passRate > 0, maxValue must be > threshold
      if (result.passRate > 0) {
        expect(result.maxValue).toBeGreaterThan(result.threshold);
      }
    });

    it('should ensure maxValue <= threshold implies passCount === 0 for > operator', () => {
      const prereqs = [
        { logic: { '>': [{ var: 'emotions.fear' }, 0.5] } },
      ];

      const contexts = [
        { emotions: { fear: 0.3 } },
        { emotions: { fear: 0.4 } },
        { emotions: { fear: 0.5 } }, // equals threshold, not greater
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Max value (0.5) equals threshold, no value exceeds it
      expect(result.maxValue).toBe(0.5);
      expect(result.passRate).toBe(0);
    });
  });

  describe('passCount/minValue consistency for <= operator', () => {
    it('should ensure passCount > 0 implies minValue <= threshold', () => {
      const prereqs = [
        { logic: { '<=': [{ var: 'emotions.anxiety' }, 0.6] } },
      ];

      const contexts = [
        { emotions: { anxiety: 0.4 } }, // passes
        { emotions: { anxiety: 0.7 } }, // fails
        { emotions: { anxiety: 0.5 } }, // passes
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // passRate should be 2/3 (two values pass)
      expect(result.passRate).toBeCloseTo(2 / 3, 6);
    });

    it('should ensure all values > threshold implies passCount === 0 for <= operator', () => {
      const prereqs = [
        { logic: { '<=': [{ var: 'emotions.excitement' }, 0.3] } },
      ];

      const contexts = [
        { emotions: { excitement: 0.5 } }, // fails
        { emotions: { excitement: 0.6 } }, // fails
        { emotions: { excitement: 0.7 } }, // fails
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // All values exceed threshold, passRate must be 0 - three-tier uses EMPIRICALLY_UNREACHABLE
      expect(result.passRate).toBe(0);
      expect(result.classification).toBe('EMPIRICALLY_UNREACHABLE');
    });
  });

  describe('delta clause consistency', () => {
    it('should maintain consistency invariant for delta clauses', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.joy' },
                  { var: 'previousEmotions.joy' },
                ],
              },
              0.1,
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { joy: 0.5 },
          previousEmotions: { joy: 0.3 },
        }, // delta = 0.2, passes
        {
          emotions: { joy: 0.4 },
          previousEmotions: { joy: 0.35 },
        }, // delta = 0.05, fails
        {
          emotions: { joy: 0.6 },
          previousEmotions: { joy: 0.3 },
        }, // delta = 0.3, passes
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Invariant check for delta clauses
      if (result.passRate > 0) {
        expect(result.maxValue).toBeGreaterThanOrEqual(result.threshold);
      }

      // Specific checks
      expect(result.signal).toBe('delta');
      expect(result.passRate).toBeCloseTo(2 / 3, 6);
      expect(result.maxValue).toBe(0.3); // max delta
      expect(result.maxValue).toBeGreaterThanOrEqual(0.1);
    });

    it('should return IMPOSSIBLE for delta clause when max delta < threshold', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.anger' },
                  { var: 'previousEmotions.anger' },
                ],
              },
              0.5, // High threshold that can't be reached
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { anger: 0.4 },
          previousEmotions: { anger: 0.3 },
        }, // delta = 0.1
        {
          emotions: { anger: 0.5 },
          previousEmotions: { anger: 0.4 },
        }, // delta = 0.1
        {
          emotions: { anger: 0.6 },
          previousEmotions: { anger: 0.4 },
        }, // delta = 0.2
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Max delta (0.2) < threshold (0.5), so passRate must be 0
      // Three-tier classification: ceiling effect detected (max < threshold)
      expect(result.maxValue).toBeCloseTo(0.2, 10);
      expect(result.maxValue).toBeLessThan(0.5);
      expect(result.passRate).toBe(0);
      expect(result.classification).toBe('EMPIRICALLY_UNREACHABLE');
    });
  });

  describe('cross-classification consistency', () => {
    it('should not classify as both passing and impossible', () => {
      // This is the core Issue A test: ensure a clause is never shown
      // as both passing (passCount > 0) and impossible (maxValue < threshold)
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.4] } },
      ];

      // Mix of passing and failing contexts
      const contexts = [
        { emotions: { confusion: 0.5 } }, // passes
        { emotions: { confusion: 0.2 } }, // fails
        { emotions: { confusion: 0.6 } }, // passes
        { emotions: { confusion: 0.1 } }, // fails
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Key invariant: cannot be both passing (passRate > 0) and have max < threshold
      if (result.passRate > 0) {
        expect(result.maxValue).toBeGreaterThanOrEqual(result.threshold);
        // Three-tier: none of the impossible/unreachable statuses should appear when passing
        expect(result.classification).not.toBe('IMPOSSIBLE');
        expect(result.classification).not.toBe('THEORETICALLY_IMPOSSIBLE');
        expect(result.classification).not.toBe('EMPIRICALLY_UNREACHABLE');
      }

      // Any of the impossible statuses imply zero pass rate
      if (
        result.classification === 'IMPOSSIBLE' ||
        result.classification === 'THEORETICALLY_IMPOSSIBLE' ||
        result.classification === 'EMPIRICALLY_UNREACHABLE'
      ) {
        expect(result.passRate).toBe(0);
      }
    });

    it('should ensure classification matches passRate', () => {
      const testCases = [
        {
          // EMPIRICALLY_UNREACHABLE case (max < threshold, ceiling effect)
          prereqs: [{ logic: { '>=': [{ var: 'emotions.a' }, 0.9] } }],
          contexts: [{ emotions: { a: 0.1 } }, { emotions: { a: 0.2 } }],
          expectedClassification: 'EMPIRICALLY_UNREACHABLE',
          expectedPassRate: 0,
        },
        {
          // OK case
          prereqs: [{ logic: { '>=': [{ var: 'emotions.b' }, 0.3] } }],
          contexts: Array(100).fill(null).map((_, i) => ({
            emotions: { b: i < 50 ? 0.5 : 0.1 },
          })),
          expectedClassification: 'OK',
        },
      ];

      for (const testCase of testCases) {
        const results = feasibilityAnalyzer.analyze(
          testCase.prereqs,
          testCase.contexts,
          'test_expr'
        );

        expect(results).toHaveLength(1);
        const result = results[0];

        expect(result.classification).toBe(testCase.expectedClassification);

        if (testCase.expectedPassRate !== undefined) {
          expect(result.passRate).toBe(testCase.expectedPassRate);
        }
      }
    });
  });
});
