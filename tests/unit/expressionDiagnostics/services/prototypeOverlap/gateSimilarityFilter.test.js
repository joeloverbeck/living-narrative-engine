/**
 * @file Unit tests for GateSimilarityFilter
 * Tests Route B candidate selection based on gate structure similarity.
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GateSimilarityFilter from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/GateSimilarityFilter.js';

describe('GateSimilarityFilter', () => {
  /**
   * Create a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Create a mock config with Route B settings.
   *
   * @param {object} overrides - Config overrides
   * @returns {object} Mock config
   */
  const createMockConfig = (overrides = {}) => ({
    gateBasedMinIntervalOverlap: 0.6,
    ...overrides,
  });

  /**
   * Create a mock GateConstraintExtractor.
   *
   * @param {Map<string, object>} intervals - Intervals to return
   * @param {string} parseStatus - Parse status
   * @returns {object} Mock extractor
   */
  const createMockExtractor = (intervals = new Map(), parseStatus = 'complete') => ({
    extract: jest.fn().mockReturnValue({ intervals, parseStatus }),
  });

  /**
   * Create a mock GateImplicationEvaluator.
   *
   * @param {object} result - Evaluation result to return
   * @returns {object} Mock evaluator
   */
  const createMockEvaluator = (result = {}) => ({
    evaluate: jest.fn().mockReturnValue({
      A_implies_B: false,
      B_implies_A: false,
      isVacuous: false,
      relation: 'distinct',
      ...result,
    }),
  });

  /**
   * Create an interval object.
   *
   * @param {number} lower - Lower bound
   * @param {number} upper - Upper bound
   * @returns {object} Interval object
   */
  const interval = (lower, upper) => ({ lower, upper });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const filter = new GateSimilarityFilter({
        config: createMockConfig(),
        logger: createMockLogger(),
        gateConstraintExtractor: createMockExtractor(),
        gateImplicationEvaluator: createMockEvaluator(),
      });

      expect(filter).toBeInstanceOf(GateSimilarityFilter);
    });

    it('should throw when logger is missing', () => {
      expect(
        () =>
          new GateSimilarityFilter({
            config: createMockConfig(),
            logger: null,
            gateConstraintExtractor: createMockExtractor(),
            gateImplicationEvaluator: createMockEvaluator(),
          })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new GateSimilarityFilter({
            config: null,
            logger,
            gateConstraintExtractor: createMockExtractor(),
            gateImplicationEvaluator: createMockEvaluator(),
          })
      ).toThrow('GateSimilarityFilter requires a valid config object');
    });

    it('should throw when config.gateBasedMinIntervalOverlap is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new GateSimilarityFilter({
            config: {},
            logger,
            gateConstraintExtractor: createMockExtractor(),
            gateImplicationEvaluator: createMockEvaluator(),
          })
      ).toThrow('gateBasedMinIntervalOverlap');
    });

    it('should throw when gateConstraintExtractor is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new GateSimilarityFilter({
            config: createMockConfig(),
            logger,
            gateConstraintExtractor: null,
            gateImplicationEvaluator: createMockEvaluator(),
          })
      ).toThrow();
    });

    it('should throw when gateImplicationEvaluator is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new GateSimilarityFilter({
            config: createMockConfig(),
            logger,
            gateConstraintExtractor: createMockExtractor(),
            gateImplicationEvaluator: null,
          })
      ).toThrow();
    });
  });

  describe('checkGateSimilarity - Gate Implication', () => {
    it('should select pair when A implies B (non-vacuous)', () => {
      const evaluator = createMockEvaluator({
        A_implies_B: true,
        B_implies_A: false,
        isVacuous: false,
        relation: 'narrower',
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig(),
        logger: createMockLogger(),
        gateConstraintExtractor: createMockExtractor(),
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(true);
      expect(result.reason).toBe('gate_implication');
      expect(result.implication.A_implies_B).toBe(true);
      expect(result.implication.relation).toBe('narrower');
    });

    it('should select pair when B implies A (non-vacuous)', () => {
      const evaluator = createMockEvaluator({
        A_implies_B: false,
        B_implies_A: true,
        isVacuous: false,
        relation: 'wider',
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig(),
        logger: createMockLogger(),
        gateConstraintExtractor: createMockExtractor(),
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(true);
      expect(result.reason).toBe('gate_implication');
      expect(result.implication.B_implies_A).toBe(true);
    });

    it('should not select when implication is vacuous', () => {
      const evaluator = createMockEvaluator({
        A_implies_B: true,
        B_implies_A: true,
        isVacuous: true,
        relation: 'vacuous',
      });

      const extractor = createMockExtractor(new Map(), 'complete');

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.99 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      // Vacuous implication should not pass via implication route
      // It may still pass via overlap if ratio >= threshold
      expect(result.reason).not.toBe('gate_implication');
    });

    it('should skip implication check when parse status is not complete', () => {
      const evaluator = createMockEvaluator({
        A_implies_B: true,
        B_implies_A: false,
        isVacuous: false,
      });

      const extractor = {
        extract: jest.fn().mockReturnValue({
          intervals: new Map(),
          parseStatus: 'partial',
        }),
      };

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.99 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      // Should skip implication check and not call evaluator
      expect(evaluator.evaluate).not.toHaveBeenCalled();
      expect(result.reason).not.toBe('gate_implication');
    });
  });

  describe('checkGateSimilarity - Gate Interval Overlap', () => {
    it('should select pair when interval overlap ratio meets threshold', () => {
      // Use intervals that will pass the threshold
      // Overlap: [0.2, 0.8] = 0.6 length
      // Union: [0.0, 1.0] = 1.0 length
      // Ratio: 0.6 / 1.0 = 0.6 - should pass at 0.6 threshold
      const intervalsAHigh = new Map([['arousal', interval(0.0, 0.8)]]);
      const intervalsBHigh = new Map([['arousal', interval(0.2, 1.0)]]);

      let extractorCallCount = 0;
      const extractor = {
        extract: jest.fn().mockImplementation(() => {
          extractorCallCount++;
          if (extractorCallCount === 1) {
            return { intervals: intervalsAHigh, parseStatus: 'complete' };
          }
          return { intervals: intervalsBHigh, parseStatus: 'complete' };
        }),
      };

      const evaluator = createMockEvaluator({
        A_implies_B: false,
        B_implies_A: false,
        isVacuous: false,
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.6 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(true);
      expect(result.reason).toBe('gate_overlap');
      expect(result.overlapRatio).toBeCloseTo(0.6, 2);
    });

    it('should reject pair when interval overlap ratio is below threshold', () => {
      const intervalsA = new Map([['arousal', interval(0.0, 0.3)]]);
      const intervalsB = new Map([['arousal', interval(0.7, 1.0)]]);

      // No overlap between [0.0, 0.3] and [0.7, 1.0]
      // Ratio: 0 / 1.0 = 0

      let extractorCallCount = 0;
      const extractor = {
        extract: jest.fn().mockImplementation(() => {
          extractorCallCount++;
          if (extractorCallCount === 1) {
            return { intervals: intervalsA, parseStatus: 'complete' };
          }
          return { intervals: intervalsB, parseStatus: 'complete' };
        }),
      };

      const evaluator = createMockEvaluator({
        A_implies_B: false,
        B_implies_A: false,
        isVacuous: false,
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.6 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(false);
      expect(result.reason).toBe(null);
      expect(result.overlapRatio).toBe(0);
    });

    it('should return 1.0 overlap when both have no constraints', () => {
      const extractor = createMockExtractor(new Map(), 'complete');
      const evaluator = createMockEvaluator({
        A_implies_B: false,
        B_implies_A: false,
        isVacuous: false,
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.6 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      expect(result.passes).toBe(true);
      expect(result.reason).toBe('gate_overlap');
      expect(result.overlapRatio).toBe(1.0);
    });

    it('should return 0.5 overlap when one has no constraints', () => {
      const intervalsA = new Map([['arousal', interval(0.0, 0.5)]]);
      const intervalsB = new Map(); // No constraints

      let extractorCallCount = 0;
      const extractor = {
        extract: jest.fn().mockImplementation(() => {
          extractorCallCount++;
          if (extractorCallCount === 1) {
            return { intervals: intervalsA, parseStatus: 'complete' };
          }
          return { intervals: intervalsB, parseStatus: 'complete' };
        }),
      };

      const evaluator = createMockEvaluator({
        A_implies_B: false,
        B_implies_A: false,
        isVacuous: false,
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.6 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      // 0.5 is below 0.6 threshold
      expect(result.passes).toBe(false);
      expect(result.overlapRatio).toBe(0.5);
    });
  });

  describe('filterPairs', () => {
    let filter;
    let evaluator;

    beforeEach(() => {
      const extractor = {
        extract: jest.fn().mockReturnValue({
          intervals: new Map(),
          parseStatus: 'complete',
        }),
      };

      evaluator = createMockEvaluator({
        A_implies_B: true,
        B_implies_A: false,
        isVacuous: false,
        relation: 'narrower',
      });

      filter = new GateSimilarityFilter({
        config: createMockConfig(),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });
    });

    it('should return empty candidates for invalid input', () => {
      const result = filter.filterPairs(null);

      expect(result.candidates).toEqual([]);
      expect(result.stats.passed).toBe(0);
      expect(result.stats.rejected).toBe(0);
    });

    it('should filter pairs and return candidates with routeB provenance', () => {
      const pairs = [
        {
          prototypeA: { id: 'proto1', gates: [] },
          prototypeB: { id: 'proto2', gates: [] },
          candidateMetrics: { jaccard: 0.3 },
        },
      ];

      const result = filter.filterPairs(pairs);

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].selectedBy).toBe('routeB');
      expect(result.candidates[0].routeMetrics.reason).toBe('gate_implication');
      expect(result.candidates[0].candidateMetrics.jaccard).toBe(0.3);
      expect(result.stats.passed).toBe(1);
      expect(result.stats.rejected).toBe(0);
      expect(result.stats.byImplication).toBe(1);
      expect(result.stats.byOverlap).toBe(0);
    });

    it('should track stats for implication and overlap selections', () => {
      // First pair passes by implication, second fails implication but passes overlap
      let callCount = 0;
      evaluator.evaluate = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          // First pair - passes by implication
          return {
            A_implies_B: true,
            B_implies_A: false,
            isVacuous: false,
            relation: 'narrower',
          };
        }
        // Second pair - fails implication (will pass by overlap since both unconstrained)
        return {
          A_implies_B: false,
          B_implies_A: false,
          isVacuous: false,
          relation: 'distinct',
        };
      });

      const pairs = [
        {
          prototypeA: { id: 'proto1', gates: [] },
          prototypeB: { id: 'proto2', gates: [] },
        },
        {
          prototypeA: { id: 'proto3', gates: [] },
          prototypeB: { id: 'proto4', gates: [] },
        },
      ];

      const result = filter.filterPairs(pairs);

      expect(result.stats.byImplication).toBe(1);
      // Second pair may pass by overlap (both unconstrained = 1.0 overlap)
      expect(result.candidates.length).toBe(2);
    });

    it('should handle empty pairs array', () => {
      const result = filter.filterPairs([]);

      expect(result.candidates).toEqual([]);
      expect(result.stats.passed).toBe(0);
      expect(result.stats.rejected).toBe(0);
    });

    it('should preserve candidateMetrics from input pairs', () => {
      const pairs = [
        {
          prototypeA: { id: 'proto1', gates: [] },
          prototypeB: { id: 'proto2', gates: [] },
          candidateMetrics: { jaccard: 0.45, signAgreement: 0.9 },
        },
      ];

      const result = filter.filterPairs(pairs);

      expect(result.candidates[0].candidateMetrics).toEqual({
        jaccard: 0.45,
        signAgreement: 0.9,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle prototypes with null gates', () => {
      const extractor = createMockExtractor(new Map(), 'complete');
      const evaluator = createMockEvaluator();

      const filter = new GateSimilarityFilter({
        config: createMockConfig(),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: null },
        { gates: undefined }
      );

      // Should handle gracefully - extractor receives empty arrays
      expect(extractor.extract).toHaveBeenCalledWith([]);
      expect(result).toBeDefined();
    });

    it('should handle multi-axis interval comparison', () => {
      // Prototypes constrain different axes
      const intervalsA = new Map([
        ['arousal', interval(0.0, 0.5)],
        ['threat', interval(0.3, 0.7)],
      ]);
      const intervalsB = new Map([
        ['arousal', interval(0.3, 0.8)],
        ['dominance', interval(0.2, 0.6)],
      ]);

      let extractorCallCount = 0;
      const extractor = {
        extract: jest.fn().mockImplementation(() => {
          extractorCallCount++;
          if (extractorCallCount === 1) {
            return { intervals: intervalsA, parseStatus: 'complete' };
          }
          return { intervals: intervalsB, parseStatus: 'complete' };
        }),
      };

      const evaluator = createMockEvaluator({
        A_implies_B: false,
        B_implies_A: false,
        isVacuous: false,
      });

      const filter = new GateSimilarityFilter({
        config: createMockConfig({ gateBasedMinIntervalOverlap: 0.3 }),
        logger: createMockLogger(),
        gateConstraintExtractor: extractor,
        gateImplicationEvaluator: evaluator,
      });

      const result = filter.checkGateSimilarity(
        { gates: [] },
        { gates: [] }
      );

      // Should compute average overlap across all axes
      expect(result).toBeDefined();
      expect(typeof result.overlapRatio).toBe('number');
    });
  });
});
