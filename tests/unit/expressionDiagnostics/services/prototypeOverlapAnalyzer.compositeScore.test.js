/**
 * @file Unit tests for PrototypeOverlapAnalyzer composite score feature
 * Tests the composite score calculation and closest pair ranking
 * Validates that high gate overlap + moderate correlation beats low overlap + high correlation
 * @see src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import PrototypeOverlapAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';

describe('PrototypeOverlapAnalyzer - composite score', () => {
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
   * Create a test config with adjustable values.
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Config object
   */
  const createConfig = (overrides = {}) => ({
    sampleCountPerPair: 100,
    maxCandidatePairs: 50,
    ...overrides,
  });

  /**
   * Create a mock prototype registry service.
   *
   * @param {Array<object>} [prototypes] - Prototypes to return
   * @returns {object} Mock service
   */
  const createMockRegistryService = (prototypes = []) => ({
    getPrototypesByType: jest.fn().mockReturnValue(prototypes),
  });

  /**
   * Create a mock candidate pair filter.
   *
   * @param {Array<object>} [candidatePairs] - Pairs to return
   * @returns {object} Mock filter
   */
  const createMockCandidatePairFilter = (candidatePairs = []) => ({
    filterCandidates: jest.fn().mockResolvedValue({
      candidates: candidatePairs,
      stats: {
        totalPossiblePairs: candidatePairs.length > 0 ? 10 : 0,
        passedFiltering: candidatePairs.length,
        rejectedByActiveAxisOverlap: 0,
        rejectedBySignAgreement: 0,
        rejectedByCosineSimilarity: 0,
        prototypesWithValidWeights: 3,
      },
    }),
  });

  /**
   * Create a mock behavioral overlap evaluator that returns different results per pair.
   *
   * @param {Array<object>} results - Array of results to return for each pair
   * @returns {object} Mock evaluator
   */
  const createMockBehavioralOverlapEvaluator = (results) => {
    let callIndex = 0;
    return {
      evaluate: jest.fn().mockImplementation(() => {
        const result = results[callIndex] ?? results[0];
        callIndex++;
        return Promise.resolve(result);
      }),
    };
  };

  /**
   * Create a mock overlap classifier.
   *
   * @param {Array<object>} classifications - Array of classifications to return
   * @returns {object} Mock classifier
   */
  const createMockOverlapClassifier = (classifications) => {
    let callIndex = 0;
    return {
      classify: jest.fn().mockImplementation(() => {
        const classification = classifications[callIndex] ?? classifications[0];
        callIndex++;
        return classification;
      }),
    };
  };

  /**
   * Create a mock recommendation builder.
   *
   * @returns {object} Mock builder
   */
  const createMockRecommendationBuilder = () => ({
    build: jest.fn().mockReturnValue({
      type: 'keep_distinct',
      confidence: 0.8,
      recommendation: 'Keep these prototypes as separate options.',
      evidence: [],
    }),
  });

  /**
   * Create a mock gate banding suggestion builder.
   *
   * @returns {object} Mock builder
   */
  const createMockGateBandingSuggestionBuilder = () => ({
    buildSuggestions: jest.fn().mockReturnValue([]),
  });

  // ==========================================================================
  // Closest pair includes composite score
  // ==========================================================================
  describe('closestPair output', () => {
    it('includes compositeScore in closestPair', async () => {
      const mockLogger = createMockLogger();
      const config = createConfig();

      const prototypes = [
        { id: 'proto:a', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:b', weights: { axis1: 1 }, gates: [] },
      ];

      const candidatePairs = [
        {
          prototypeA: prototypes[0],
          prototypeB: prototypes[1],
          candidateMetrics: { activeAxisOverlap: 1, signAgreement: 1, weightCosineSimilarity: 0.9 },
        },
      ];

      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.5, onBothRate: 0.4, pOnlyRate: 0.05, qOnlyRate: 0.05 },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.1,
          dominanceQ: 0.1,
          globalMeanAbsDiff: 0.15,
          globalL2Distance: 0.18,
          globalOutputCorrelation: 0.75,
        },
        passRates: { passRateA: 0.45, passRateB: 0.45, coPassCount: 40 },
        gateImplication: null,
        divergenceExamples: [],
      };

      const classification = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.8,
          pearsonCorrelation: 0.8,
          globalMeanAbsDiff: 0.15,
          globalL2Distance: 0.18,
          globalOutputCorrelation: 0.75,
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([behaviorResult]),
        overlapClassifier: createMockOverlapClassifier([classification]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: mockLogger,
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      expect(closestPair).toBeDefined();
      expect(closestPair.compositeScore).toBeDefined();
      expect(typeof closestPair.compositeScore).toBe('number');
      expect(closestPair.compositeScore).toBeGreaterThan(0);
      expect(closestPair.compositeScore).toBeLessThanOrEqual(1);
    });

    it('includes global metrics in closestPair', async () => {
      const mockLogger = createMockLogger();
      const config = createConfig();

      const prototypes = [
        { id: 'proto:a', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:b', weights: { axis1: 1 }, gates: [] },
      ];

      const candidatePairs = [
        {
          prototypeA: prototypes[0],
          prototypeB: prototypes[1],
          candidateMetrics: { activeAxisOverlap: 1, signAgreement: 1, weightCosineSimilarity: 0.9 },
        },
      ];

      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.5, onBothRate: 0.4, pOnlyRate: 0.05, qOnlyRate: 0.05 },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.1,
          dominanceQ: 0.1,
          globalMeanAbsDiff: 0.25,
          globalL2Distance: 0.28,
          globalOutputCorrelation: 0.65,
        },
        passRates: { passRateA: 0.45, passRateB: 0.45, coPassCount: 40 },
        gateImplication: null,
        divergenceExamples: [],
      };

      const classification = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.8,
          pearsonCorrelation: 0.8,
          globalMeanAbsDiff: 0.25,
          globalL2Distance: 0.28,
          globalOutputCorrelation: 0.65,
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([behaviorResult]),
        overlapClassifier: createMockOverlapClassifier([classification]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: mockLogger,
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      expect(closestPair).toBeDefined();
      expect(closestPair.globalMeanAbsDiff).toBe(0.25);
      expect(closestPair.globalL2Distance).toBe(0.28);
      expect(closestPair.globalOutputCorrelation).toBe(0.65);
    });
  });

  // ==========================================================================
  // Composite score ranking: high overlap beats high correlation
  // ==========================================================================
  describe('composite score ranking', () => {
    it('ranks high overlap + moderate correlation above low overlap + high correlation', async () => {
      const mockLogger = createMockLogger();
      const config = createConfig();

      const prototypes = [
        { id: 'proto:a', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:b', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:c', weights: { axis1: 1 }, gates: [] },
      ];

      // Pair 1: Low overlap (5%) but high correlation (0.99)
      // Pair 2: High overlap (80%) but moderate correlation (0.7)
      const candidatePairs = [
        {
          prototypeA: prototypes[0],
          prototypeB: prototypes[1],
          candidateMetrics: { activeAxisOverlap: 1, signAgreement: 1, weightCosineSimilarity: 0.9 },
        },
        {
          prototypeA: prototypes[0],
          prototypeB: prototypes[2],
          candidateMetrics: { activeAxisOverlap: 1, signAgreement: 1, weightCosineSimilarity: 0.9 },
        },
      ];

      // Pair 1: Low overlap, high correlation, high global diff
      const behaviorResult1 = {
        gateOverlap: { onEitherRate: 0.95, onBothRate: 0.05, pOnlyRate: 0.45, qOnlyRate: 0.45 },
        intensity: {
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.01,
          dominanceP: 0.0,
          dominanceQ: 0.0,
          globalMeanAbsDiff: 0.65, // High because exclusive firing
          globalL2Distance: 0.7,
          globalOutputCorrelation: 0.2,
        },
        passRates: { passRateA: 0.5, passRateB: 0.5, coPassCount: 5 },
        gateImplication: null,
        divergenceExamples: [],
      };

      // Pair 2: High overlap, moderate correlation, low global diff
      const behaviorResult2 = {
        gateOverlap: { onEitherRate: 0.85, onBothRate: 0.8, pOnlyRate: 0.025, qOnlyRate: 0.025 },
        intensity: {
          pearsonCorrelation: 0.7,
          meanAbsDiff: 0.15,
          dominanceP: 0.1,
          dominanceQ: 0.1,
          globalMeanAbsDiff: 0.12, // Low because mostly co-firing
          globalL2Distance: 0.15,
          globalOutputCorrelation: 0.68,
        },
        passRates: { passRateA: 0.825, passRateB: 0.825, coPassCount: 80 },
        gateImplication: null,
        divergenceExamples: [],
      };

      const classification1 = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.0526, // 5/95
          pearsonCorrelation: 0.99,
          globalMeanAbsDiff: 0.65,
          globalL2Distance: 0.7,
          globalOutputCorrelation: 0.2,
        },
      };

      const classification2 = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.941, // 80/85
          pearsonCorrelation: 0.7,
          globalMeanAbsDiff: 0.12,
          globalL2Distance: 0.15,
          globalOutputCorrelation: 0.68,
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([
          behaviorResult1,
          behaviorResult2,
        ]),
        overlapClassifier: createMockOverlapClassifier([classification1, classification2]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: mockLogger,
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      expect(closestPair).toBeDefined();

      // The closest pair should be proto:a ↔ proto:c (pair 2) because:
      // - High gate overlap (94.1%) contributes more (×0.5 weight)
      // - Low global diff (0.12) contributes positively (×0.2 weight)
      // Even though pair 1 has higher correlation (0.99 vs 0.7)
      expect(closestPair.prototypeA).toBe('proto:a');
      expect(closestPair.prototypeB).toBe('proto:c');

      // Verify the composite score reflects the expected ranking
      // Pair 2 composite ≈ 0.941×0.3 + 0.85×0.2 + 0.88×0.5 = 0.282 + 0.17 + 0.44 = 0.892
      // Pair 1 composite ≈ 0.053×0.3 + 0.995×0.2 + 0.35×0.5 = 0.016 + 0.199 + 0.175 = 0.39
      expect(closestPair.compositeScore).toBeGreaterThan(0.6);
    });
  });

  // ==========================================================================
  // Fallback behavior when global metrics are missing
  // ==========================================================================
  describe('fallback behavior', () => {
    it('uses simplified formula when globalMeanAbsDiff is NaN', async () => {
      const mockLogger = createMockLogger();
      const config = createConfig();

      const prototypes = [
        { id: 'proto:a', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:b', weights: { axis1: 1 }, gates: [] },
      ];

      const candidatePairs = [
        {
          prototypeA: prototypes[0],
          prototypeB: prototypes[1],
          candidateMetrics: { activeAxisOverlap: 1, signAgreement: 1, weightCosineSimilarity: 0.9 },
        },
      ];

      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.5, onBothRate: 0.4, pOnlyRate: 0.05, qOnlyRate: 0.05 },
        intensity: {
          pearsonCorrelation: 0.8,
          meanAbsDiff: 0.1,
          dominanceP: 0.1,
          dominanceQ: 0.1,
          globalMeanAbsDiff: NaN, // Simulating legacy or edge case
          globalL2Distance: NaN,
          globalOutputCorrelation: NaN,
        },
        passRates: { passRateA: 0.45, passRateB: 0.45, coPassCount: 40 },
        gateImplication: null,
        divergenceExamples: [],
      };

      const classification = {
        type: 'keep_distinct',
        metrics: {
          gateOverlapRatio: 0.8,
          pearsonCorrelation: 0.8,
          globalMeanAbsDiff: NaN,
          globalL2Distance: NaN,
          globalOutputCorrelation: NaN,
        },
      };

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([behaviorResult]),
        overlapClassifier: createMockOverlapClassifier([classification]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: mockLogger,
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      expect(closestPair).toBeDefined();
      // Should still compute a composite score using fallback formula
      expect(closestPair.compositeScore).toBeDefined();
      expect(Number.isFinite(closestPair.compositeScore)).toBe(true);
      expect(closestPair.compositeScore).toBeGreaterThan(0);
    });
  });
});
