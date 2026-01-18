/**
 * @file NonAxisFeasibilityAnalyzer.test.js
 * @description Unit tests for NonAxisFeasibilityAnalyzer service
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

describe('NonAxisFeasibilityAnalyzer', () => {
  let analyzer;
  let mockLogger;
  let mockClauseExtractor;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockClauseExtractor = {
      extract: jest.fn().mockReturnValue([]),
    };

    analyzer = new NonAxisFeasibilityAnalyzer({
      logger: mockLogger,
      clauseExtractor: mockClauseExtractor,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new NonAxisFeasibilityAnalyzer({
            clauseExtractor: mockClauseExtractor,
          })
      ).toThrow();
    });

    it('should throw error when logger is missing required methods', () => {
      expect(
        () =>
          new NonAxisFeasibilityAnalyzer({
            logger: { info: jest.fn() },
            clauseExtractor: mockClauseExtractor,
          })
      ).toThrow();
    });

    it('should throw error when clauseExtractor is missing', () => {
      expect(
        () =>
          new NonAxisFeasibilityAnalyzer({
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw error when clauseExtractor is missing required methods', () => {
      expect(
        () =>
          new NonAxisFeasibilityAnalyzer({
            logger: mockLogger,
            clauseExtractor: {},
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      expect(analyzer).toBeInstanceOf(NonAxisFeasibilityAnalyzer);
    });
  });

  describe('EMPIRICALLY_UNREACHABLE classification (three-tier system)', () => {
    it('should classify as EMPIRICALLY_UNREACHABLE when passRate is 0 and maxValue < threshold', () => {
      const clause = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // Contexts where emotions.confusion is always below 0.5 (ceiling effect)
      const contexts = [
        { emotions: { confusion: 0.1 } },
        { emotions: { confusion: 0.2 } },
        { emotions: { confusion: 0.3 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('EMPIRICALLY_UNREACHABLE');
      expect(results[0].passRate).toBe(0);
      expect(results[0].maxValue).toBe(0.3);
    });

    it('should classify as UNOBSERVED for > operator when max equals threshold (no ceiling evidence)', () => {
      const clause = {
        varPath: 'emotions.anger',
        operator: '>',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // Contexts where emotions.anger never exceeds 0.5, but reaches it
      // max(0.5) is NOT < threshold(0.5), so no ceiling evidence detected
      const contexts = [
        { emotions: { anger: 0.3 } },
        { emotions: { anger: 0.5 } }, // equals but not greater
        { emotions: { anger: 0.4 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('UNOBSERVED');
      expect(results[0].passRate).toBe(0);
    });

    it('should classify as EMPIRICALLY_UNREACHABLE for <= operator when all values exceed threshold (floor effect)', () => {
      const clause = {
        varPath: 'emotions.joy',
        operator: '<=',
        threshold: 0.2,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // All values exceed threshold - floor detected (min > threshold)
      const contexts = [
        { emotions: { joy: 0.5 } },
        { emotions: { joy: 0.6 } },
        { emotions: { joy: 0.7 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('EMPIRICALLY_UNREACHABLE');
      expect(results[0].passRate).toBe(0);
    });
  });

  describe('RARE classification', () => {
    it('should classify as RARE when passRate is between 0 and 0.001', () => {
      const clause = {
        varPath: 'emotions.surprise',
        operator: '>=',
        threshold: 0.9,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // Create 10000 contexts where only 5 pass (0.05% pass rate)
      const contexts = [];
      for (let i = 0; i < 10000; i++) {
        contexts.push({
          emotions: { surprise: i < 5 ? 0.95 : 0.1 },
        });
      }

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('RARE');
      expect(results[0].passRate).toBe(0.0005);
    });

    it('should classify as RARE when passRate is exactly 0.0005', () => {
      const clause = {
        varPath: 'emotions.fear',
        operator: '>=',
        threshold: 0.8,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // 2000 contexts, 1 passes = 0.0005 pass rate
      const contexts = [];
      for (let i = 0; i < 2000; i++) {
        contexts.push({
          emotions: { fear: i === 0 ? 0.9 : 0.1 },
        });
      }

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('RARE');
      expect(results[0].passRate).toBe(0.0005);
    });
  });

  describe('OK classification', () => {
    it('should classify as OK when passRate is >= 0.001', () => {
      const clause = {
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.3,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // 1000 contexts, 10 pass = 1% pass rate
      const contexts = [];
      for (let i = 0; i < 1000; i++) {
        contexts.push({
          emotions: { joy: i < 10 ? 0.5 : 0.1 },
        });
      }

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('OK');
      expect(results[0].passRate).toBe(0.01);
    });

    it('should classify as OK when passRate is 50%', () => {
      const clause = {
        varPath: 'emotions.excitement',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { excitement: 0.6 } },
        { emotions: { excitement: 0.3 } },
        { emotions: { excitement: 0.7 } },
        { emotions: { excitement: 0.2 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('OK');
      expect(results[0].passRate).toBe(0.5);
    });

    it('should classify as OK when all contexts pass', () => {
      const clause = {
        varPath: 'emotions.calm',
        operator: '>=',
        threshold: 0.1,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { calm: 0.5 } },
        { emotions: { calm: 0.6 } },
        { emotions: { calm: 0.7 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('OK');
      expect(results[0].passRate).toBe(1);
    });
  });

  describe('statistics calculation', () => {
    it('should correctly compute passRate', () => {
      const clause = {
        varPath: 'emotions.anger',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { anger: 0.6 } }, // pass
        { emotions: { anger: 0.3 } }, // fail
        { emotions: { anger: 0.7 } }, // pass
        { emotions: { anger: 0.2 } }, // fail
        { emotions: { anger: 0.5 } }, // pass (exactly at threshold)
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBe(0.6);
    });

    it('should correctly compute maxValue', () => {
      const clause = {
        varPath: 'emotions.sadness',
        operator: '>=',
        threshold: 0.9,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { sadness: 0.1 } },
        { emotions: { sadness: 0.5 } },
        { emotions: { sadness: 0.8 } },
        { emotions: { sadness: 0.3 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].maxValue).toBe(0.8);
    });

    it('should correctly compute p95Value', () => {
      const clause = {
        varPath: 'emotions.fear',
        operator: '>=',
        threshold: 0.9,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // Values: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0
      const contexts = [];
      for (let i = 1; i <= 10; i++) {
        contexts.push({ emotions: { fear: i / 10 } });
      }

      const results = analyzer.analyze([], contexts, 'test_expr');

      // p95 at index 0.95 * 9 = 8.55 -> interpolate between index 8 and 9
      // sortedValues[8] = 0.9, sortedValues[9] = 1.0
      // 0.9 * 0.45 + 1.0 * 0.55 = 0.405 + 0.55 = 0.955
      expect(results[0].p95Value).toBeCloseTo(0.955, 3);
    });

    it('should correctly compute marginMax', () => {
      const clause = {
        varPath: 'emotions.disgust',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { disgust: 0.3 } },
        { emotions: { disgust: 0.4 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      // maxValue = 0.4, threshold = 0.5, marginMax = 0.4 - 0.5 = -0.1
      expect(results[0].marginMax).toBeCloseTo(-0.1, 6);
    });
  });

  describe('clauseId determinism', () => {
    it('should produce identical clauseId for same inputs', () => {
      const clause = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [{ emotions: { confusion: 0.5 } }];

      const results1 = analyzer.analyze([], contexts, 'expr_001');
      const results2 = analyzer.analyze([], contexts, 'expr_001');

      expect(results1[0].clauseId).toBe(results2[0].clauseId);
    });

    it('should produce different clauseId for different thresholds', () => {
      const clause1 = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      const clause2 = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };

      const contexts = [{ emotions: { confusion: 0.7 } }];

      mockClauseExtractor.extract.mockReturnValueOnce([clause1]);
      const results1 = analyzer.analyze([], contexts, 'expr_001');

      mockClauseExtractor.extract.mockReturnValueOnce([clause2]);
      const results2 = analyzer.analyze([], contexts, 'expr_001');

      expect(results1[0].clauseId).not.toBe(results2[0].clauseId);
    });

    it('should produce different clauseId for different varPaths', () => {
      const clause1 = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      const clause2 = {
        varPath: 'emotions.anger',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };

      const contexts = [
        { emotions: { confusion: 0.7, anger: 0.7 } },
      ];

      mockClauseExtractor.extract.mockReturnValueOnce([clause1]);
      const results1 = analyzer.analyze([], contexts, 'expr_001');

      mockClauseExtractor.extract.mockReturnValueOnce([clause2]);
      const results2 = analyzer.analyze([], contexts, 'expr_001');

      expect(results1[0].clauseId).not.toBe(results2[0].clauseId);
    });
  });

  describe('evidence generation', () => {
    it('should generate appropriate evidence note for EMPIRICALLY_UNREACHABLE classification', () => {
      const clause = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // Max 0.2 < threshold 0.5, so ceiling effect detected
      const contexts = [
        { emotions: { confusion: 0.1 } },
        { emotions: { confusion: 0.2 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].classification).toBe('EMPIRICALLY_UNREACHABLE');
      // EMPIRICALLY_UNREACHABLE generates "Empirical ceiling" evidence note
      expect(results[0].evidence.note).toContain('Empirical ceiling');
      expect(results[0].evidence.note).toContain('max(final)');
      expect(results[0].evidence.bestSampleRef).toBeNull();
    });

    it('should generate appropriate evidence note for RARE classification', () => {
      const clause = {
        varPath: 'emotions.surprise',
        operator: '>=',
        threshold: 0.9,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      // 10000 contexts, 5 pass = 0.05% pass rate
      const contexts = [];
      for (let i = 0; i < 10000; i++) {
        contexts.push({
          emotions: { surprise: i < 5 ? 0.95 : 0.1 },
        });
      }

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].evidence.note).toContain('rarely met');
      expect(results[0].evidence.bestSampleRef).toBe('sample_0');
    });

    it('should generate appropriate evidence note for OK classification', () => {
      const clause = {
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.3,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { joy: 0.5 } },
        { emotions: { joy: 0.6 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].evidence.note).toContain('achievable');
      expect(results[0].evidence.bestSampleRef).toBe('sample_0');
    });
  });

  describe('edge cases', () => {
    it('should return UNKNOWN classification for empty contexts', () => {
      const clause = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const results = analyzer.analyze([], [], 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('UNKNOWN');
      expect(results[0].passRate).toBeNull();
      expect(results[0].maxValue).toBeNull();
      expect(results[0].p95Value).toBeNull();
      expect(results[0].marginMax).toBeNull();
    });

    it('should return empty array when no clauses are extracted', () => {
      mockClauseExtractor.extract.mockReturnValue([]);

      const contexts = [{ emotions: { joy: 0.5 } }];
      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toEqual([]);
    });

    it('should handle null context values gracefully', () => {
      const clause = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { confusion: null } },
        { emotions: { confusion: 0.5 } },
        { emotions: null },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      // Only one valid value (0.5), which passes the threshold
      expect(results[0].passRate).toBe(1);
      expect(results[0].maxValue).toBe(0.5);
    });

    it('should handle missing nested paths gracefully', () => {
      const clause = {
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        {}, // no emotions property
        { emotions: {} }, // no confusion property
        { emotions: { confusion: 0.5 } }, // valid
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(1);
      // Only one valid value
      expect(results[0].passRate).toBe(1);
    });

    it('should return empty array for empty prerequisites', () => {
      mockClauseExtractor.extract.mockReturnValue([]);

      const results = analyzer.analyze([], [], 'test_expr');

      expect(results).toEqual([]);
    });
  });

  describe('operator evaluation', () => {
    it('should correctly evaluate >= operator', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { test: 0.49 } }, // fail
        { emotions: { test: 0.5 } }, // pass
        { emotions: { test: 0.51 } }, // pass
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBeCloseTo(2 / 3, 6);
    });

    it('should correctly evaluate > operator', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '>',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { test: 0.49 } }, // fail
        { emotions: { test: 0.5 } }, // fail (not greater)
        { emotions: { test: 0.51 } }, // pass
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBeCloseTo(1 / 3, 6);
    });

    it('should correctly evaluate <= operator', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '<=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { test: 0.49 } }, // pass
        { emotions: { test: 0.5 } }, // pass
        { emotions: { test: 0.51 } }, // fail
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBeCloseTo(2 / 3, 6);
    });

    it('should correctly evaluate < operator', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '<',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { test: 0.49 } }, // pass
        { emotions: { test: 0.5 } }, // fail (not less)
        { emotions: { test: 0.51 } }, // fail
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBeCloseTo(1 / 3, 6);
    });
  });

  describe('signal type handling', () => {
    it('should use "delta" signal for delta clauses', () => {
      const clause = {
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.1,
        isDelta: true,
        sourcePath: 'prereqs[0]',
        clauseType: 'delta',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        {
          emotions: { joy: 0.5 },
          previousEmotions: { joy: 0.3 },
        },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].signal).toBe('delta');
    });

    it('should use "final" signal for non-delta clauses', () => {
      const clause = {
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.3,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [{ emotions: { joy: 0.5 } }];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].signal).toBe('final');
    });

    it('should correctly compute delta values for delta clauses', () => {
      const clause = {
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.1,
        isDelta: true,
        sourcePath: 'prereqs[0]',
        clauseType: 'delta',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        {
          emotions: { joy: 0.5 },
          previousEmotions: { joy: 0.3 },
        }, // delta = 0.2, passes
        {
          emotions: { joy: 0.4 },
          previousEmotions: { joy: 0.35 },
        }, // delta = 0.05, fails
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBe(0.5);
      expect(results[0].maxValue).toBe(0.2); // max delta
    });
  });

  describe('population field', () => {
    it('should always set population to "in_regime"', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [{ emotions: { test: 0.6 } }];
      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].population).toBe('in_regime');
    });
  });

  describe('multiple clauses', () => {
    it('should analyze multiple clauses and return results for each', () => {
      const clauses = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          threshold: 0.3,
          isDelta: false,
          sourcePath: 'prereqs[0]',
          clauseType: 'emotion',
        },
        {
          varPath: 'emotions.anger',
          operator: '<=',
          threshold: 0.5,
          isDelta: false,
          sourcePath: 'prereqs[1]',
          clauseType: 'emotion',
        },
      ];
      mockClauseExtractor.extract.mockReturnValue(clauses);

      const contexts = [
        { emotions: { joy: 0.5, anger: 0.3 } },
        { emotions: { joy: 0.2, anger: 0.6 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results).toHaveLength(2);
      expect(results[0].varPath).toBe('emotions.joy');
      expect(results[1].varPath).toBe('emotions.anger');
    });
  });

  describe('invariants', () => {
    it('should ensure passRate is in range [0, 1]', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [
        { emotions: { test: 0.6 } },
        { emotions: { test: 0.4 } },
      ];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].passRate).toBeGreaterThanOrEqual(0);
      expect(results[0].passRate).toBeLessThanOrEqual(1);
    });

    it('should allow negative marginMax', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '>=',
        threshold: 0.8,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [{ emotions: { test: 0.5 } }];

      const results = analyzer.analyze([], contexts, 'test_expr');

      expect(results[0].marginMax).toBeLessThan(0);
      expect(results[0].marginMax).toBeCloseTo(-0.3, 6);
    });

    it('should never throw on empty input', () => {
      mockClauseExtractor.extract.mockReturnValue([]);

      expect(() => analyzer.analyze([], [], 'test_expr')).not.toThrow();
      expect(() => analyzer.analyze(null, [], 'test_expr')).not.toThrow();
      expect(() => analyzer.analyze([], null, 'test_expr')).not.toThrow();
    });
  });

  describe('logging', () => {
    it('should log debug message when no clauses are found', () => {
      mockClauseExtractor.extract.mockReturnValue([]);

      analyzer.analyze([], [], 'test_expr');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no non-axis clauses found')
      );
    });

    it('should log debug message with clause count', () => {
      const clause = {
        varPath: 'emotions.test',
        operator: '>=',
        threshold: 0.5,
        isDelta: false,
        sourcePath: 'prereqs[0]',
        clauseType: 'emotion',
      };
      mockClauseExtractor.extract.mockReturnValue([clause]);

      const contexts = [{ emotions: { test: 0.6 } }];
      analyzer.analyze([], contexts, 'test_expr');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('analyzed 1 clause(s)')
      );
    });
  });
});
