/**
 * @file deltaClauseFeasibility.test.js
 * @description Tests for delta/arithmetic clause feasibility analysis.
 *
 * Issue C: Test that delta clauses like (previousMoodAxes.X - moodAxes.X) >= 12
 * are properly analyzed for feasibility (not returned as UNKNOWN).
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import NonAxisClauseExtractor from '../../../../src/expressionDiagnostics/services/NonAxisClauseExtractor.js';
import NonAxisFeasibilityAnalyzer from '../../../../src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js';

describe('Delta Clause Feasibility', () => {
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

  describe('NonAxisClauseExtractor delta detection', () => {
    it('should extract delta pattern with emotions', () => {
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

      const clauses = clauseExtractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].isDelta).toBe(true);
      expect(clauses[0].clauseType).toBe('delta');
      expect(clauses[0].varPath).toBe('emotions.joy');
      expect(clauses[0].operator).toBe('>=');
      expect(clauses[0].threshold).toBe(0.1);
    });

    it('should extract delta pattern with sexualStates', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'sexualStates.arousal' },
                  { var: 'previousSexualStates.arousal' },
                ],
              },
              0.15,
            ],
          },
        },
      ];

      const clauses = clauseExtractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].isDelta).toBe(true);
      expect(clauses[0].clauseType).toBe('delta');
      expect(clauses[0].varPath).toBe('sexualStates.arousal');
      expect(clauses[0].threshold).toBe(0.15);
    });

    it('should extract negative delta (decrease) pattern', () => {
      // Testing for a decrease: previousValue - currentValue >= threshold
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'previousEmotions.anger' },
                  { var: 'emotions.anger' },
                ],
              },
              0.2,
            ],
          },
        },
      ];

      const clauses = clauseExtractor.extract(prereqs);

      expect(clauses).toHaveLength(1);
      expect(clauses[0].isDelta).toBe(true);
      // The varPath should be the first var in the subtraction
      expect(clauses[0].varPath).toBe('previousEmotions.anger');
    });

    it('should not extract delta with non-var operands', () => {
      // Delta where one operand is a constant (not supported)
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.joy' },
                  0.5, // constant, not a var
                ],
              },
              0.1,
            ],
          },
        },
      ];

      const clauses = clauseExtractor.extract(prereqs);

      // Should not extract as delta (both operands must be vars)
      expect(clauses).toHaveLength(0);
    });
  });

  describe('NonAxisFeasibilityAnalyzer delta evaluation', () => {
    it('should compute correct delta values and pass rate', () => {
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
        }, // delta = 0.2, passes (0.2 >= 0.1)
        {
          emotions: { joy: 0.4 },
          previousEmotions: { joy: 0.35 },
        }, // delta = 0.05, fails (0.05 < 0.1)
        {
          emotions: { joy: 0.6 },
          previousEmotions: { joy: 0.4 },
        }, // delta = 0.2, passes
        {
          emotions: { joy: 0.3 },
          previousEmotions: { joy: 0.25 },
        }, // delta = 0.05, fails
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.signal).toBe('delta');
      expect(result.passRate).toBe(0.5); // 2 out of 4 pass
      expect(result.maxValue).toBe(0.2); // max delta
      expect(result.classification).toBe('OK');
    });

    it('should return IMPOSSIBLE when no delta can reach threshold', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.sadness' },
                  { var: 'previousEmotions.sadness' },
                ],
              },
              0.5, // High threshold
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { sadness: 0.3 },
          previousEmotions: { sadness: 0.2 },
        }, // delta = 0.1
        {
          emotions: { sadness: 0.4 },
          previousEmotions: { sadness: 0.3 },
        }, // delta = 0.1
        {
          emotions: { sadness: 0.35 },
          previousEmotions: { sadness: 0.15 },
        }, // delta = 0.2
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.signal).toBe('delta');
      expect(result.passRate).toBe(0);
      expect(result.maxValue).toBeCloseTo(0.2, 10); // max delta is 0.2, below 0.5 threshold
      // Three-tier classification: ceiling effect detected (max < threshold)
      expect(result.classification).toBe('EMPIRICALLY_UNREACHABLE');
    });

    it('should NOT return UNKNOWN for valid delta clauses', () => {
      // This is the key Issue C test: delta clauses should get proper analysis
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
              0.15,
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { anger: 0.5 },
          previousEmotions: { anger: 0.3 },
        }, // delta = 0.2, passes
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // CRITICAL: Must not be UNKNOWN for valid delta with contexts
      expect(result.classification).not.toBe('UNKNOWN');
      expect(result.passRate).not.toBeNull();
      expect(result.maxValue).not.toBeNull();
    });

    it('should handle missing previousEmotions gracefully', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.fear' },
                  { var: 'previousEmotions.fear' },
                ],
              },
              0.1,
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { fear: 0.5 },
          // previousEmotions missing
        },
        {
          emotions: { fear: 0.6 },
          previousEmotions: { fear: 0.4 },
        }, // delta = 0.2, passes
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Should only count the context with valid previous value
      expect(result.passRate).toBe(1); // 1/1 valid context passes
      expect(result.maxValue).toBeCloseTo(0.2, 10);
    });

    it('should handle null/undefined values in delta computation', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.surprise' },
                  { var: 'previousEmotions.surprise' },
                ],
              },
              0.1,
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { surprise: null },
          previousEmotions: { surprise: 0.3 },
        },
        {
          emotions: { surprise: 0.5 },
          previousEmotions: { surprise: null },
        },
        {
          emotions: { surprise: 0.6 },
          previousEmotions: { surprise: 0.3 },
        }, // Valid: delta = 0.3
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Only one valid context (third one)
      expect(result.passRate).toBe(1); // 1/1 valid = 100%
      expect(result.maxValue).toBe(0.3);
    });
  });

  describe('Delta clause classification thresholds', () => {
    it('should classify as RARE when delta passRate is very low but not zero', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.excitement' },
                  { var: 'previousEmotions.excitement' },
                ],
              },
              0.4,
            ],
          },
        },
      ];

      // Create 10000 contexts where only 5 pass (0.05% pass rate)
      const contexts = [];
      for (let i = 0; i < 10000; i++) {
        contexts.push({
          emotions: { excitement: i < 5 ? 0.8 : 0.3 },
          previousEmotions: { excitement: i < 5 ? 0.3 : 0.2 },
        });
      }

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.passRate).toBe(0.0005);
      expect(result.classification).toBe('RARE');
    });

    it('should classify as OK when delta passRate is above RARE threshold', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.calm' },
                  { var: 'previousEmotions.calm' },
                ],
              },
              0.1,
            ],
          },
        },
      ];

      // 100 contexts, 50 pass (50% pass rate)
      const contexts = [];
      for (let i = 0; i < 100; i++) {
        contexts.push({
          emotions: { calm: i < 50 ? 0.5 : 0.2 },
          previousEmotions: { calm: i < 50 ? 0.3 : 0.15 },
        });
      }

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.passRate).toBe(0.5);
      expect(result.classification).toBe('OK');
    });
  });

  describe('Delta clause evidence generation', () => {
    it('should generate appropriate evidence note for delta clause', () => {
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
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      // Evidence note should mention delta
      expect(result.evidence).toBeDefined();
      expect(result.evidence.note).toBeDefined();
      expect(result.evidence.note).toContain('delta');
    });

    it('should provide bestSampleRef for passing delta clause', () => {
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
              0.1,
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { anger: 0.6 },
          previousEmotions: { anger: 0.4 },
        }, // delta = 0.2, passes
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.evidence.bestSampleRef).not.toBeNull();
      expect(result.evidence.bestSampleRef).toBe('sample_0');
    });
  });

  describe('Multiple delta clauses', () => {
    it('should analyze multiple independent delta clauses', () => {
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
        {
          logic: {
            '>=': [
              {
                '-': [
                  { var: 'emotions.anger' },
                  { var: 'previousEmotions.anger' },
                ],
              },
              0.2,
            ],
          },
        },
      ];

      const contexts = [
        {
          emotions: { joy: 0.5, anger: 0.6 },
          previousEmotions: { joy: 0.3, anger: 0.3 },
        }, // joy delta = 0.2 (pass), anger delta = 0.3 (pass)
        {
          emotions: { joy: 0.4, anger: 0.4 },
          previousEmotions: { joy: 0.35, anger: 0.35 },
        }, // joy delta = 0.05 (fail), anger delta = 0.05 (fail)
      ];

      const results = feasibilityAnalyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(2);

      // First delta clause (joy)
      expect(results[0].varPath).toBe('emotions.joy');
      expect(results[0].signal).toBe('delta');
      expect(results[0].passRate).toBe(0.5);

      // Second delta clause (anger)
      expect(results[1].varPath).toBe('emotions.anger');
      expect(results[1].signal).toBe('delta');
      expect(results[1].passRate).toBe(0.5);
    });
  });
});
