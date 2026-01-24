/**
 * @file Unit tests for configurable composite score weights
 * Tests that weights can be customized via config and fallback behavior works correctly
 * @see src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import PrototypeOverlapAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';

describe('PrototypeOverlapAnalyzer - configurable composite weights', () => {
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
    getAllPrototypes: jest.fn().mockReturnValue(prototypes),
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
   * Create a mock behavioral overlap evaluator.
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

  const createBehaviorResult = ({
    correlation = 0.6,
    globalMeanAbsDiff = 0.1,
  } = {}) => ({
    gateOverlap: { onEitherRate: 0.5, onBothRate: 0.4, pOnlyRate: 0.05, qOnlyRate: 0.05 },
    intensity: {
      pearsonCorrelation: correlation,
      meanAbsDiff: 0.1,
      dominanceP: 0.1,
      dominanceQ: 0.1,
      globalMeanAbsDiff,
      globalL2Distance: 0.2,
      globalOutputCorrelation: 0.7,
    },
    passRates: { passRateA: 0.45, passRateB: 0.45, coPassCount: 40 },
    gateImplication: null,
    divergenceExamples: [],
  });

  const createClassification = ({
    gateOverlapRatio = 0.5,
    pearsonCorrelation = 0.6,
    globalMeanAbsDiff = 0.1,
  } = {}) => ({
    type: 'keep_distinct',
    metrics: {
      gateOverlapRatio,
      pearsonCorrelation,
      globalMeanAbsDiff,
      globalL2Distance: 0.2,
      globalOutputCorrelation: 0.7,
    },
  });

  describe('custom weight configuration', () => {
    it('uses config weights when provided', async () => {
      const config = createConfig({
        compositeScoreGateOverlapWeight: 0.2,
        compositeScoreCorrelationWeight: 0.1,
        compositeScoreGlobalDiffWeight: 0.7,
      });

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

      const classification = createClassification({
        gateOverlapRatio: 0.5,
        pearsonCorrelation: 0.6,
        globalMeanAbsDiff: 0.1,
      });

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([createBehaviorResult()]),
        overlapClassifier: createMockOverlapClassifier([classification]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: createMockLogger(),
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // Expected: 0.5×0.20 + 0.8×0.10 + 0.9×0.70 = 0.10 + 0.08 + 0.63 = 0.81
      expect(closestPair.compositeScore).toBeCloseTo(0.81, 2);
    });

    it('uses default weights when config properties missing', async () => {
      const config = createConfig({});

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

      const classification = createClassification({
        gateOverlapRatio: 0.5,
        pearsonCorrelation: 0.6,
        globalMeanAbsDiff: 0.1,
      });

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([createBehaviorResult()]),
        overlapClassifier: createMockOverlapClassifier([classification]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: createMockLogger(),
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // Expected with defaults (0.30, 0.20, 0.50):
      // 0.5×0.30 + 0.8×0.20 + 0.9×0.50 = 0.15 + 0.16 + 0.45 = 0.76
      expect(closestPair.compositeScore).toBeCloseTo(0.76, 2);
    });
  });

  describe('fallback behavior', () => {
    it('correctly renormalizes weights when globalMeanAbsDiff is NaN', async () => {
      const config = createConfig({
        compositeScoreGateOverlapWeight: 0.3,
        compositeScoreCorrelationWeight: 0.2,
        compositeScoreGlobalDiffWeight: 0.5,
      });

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

      const classification = createClassification({
        gateOverlapRatio: 0.8,
        pearsonCorrelation: 0.6,
        globalMeanAbsDiff: NaN,
      });

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([
          createBehaviorResult({ globalMeanAbsDiff: NaN }),
        ]),
        overlapClassifier: createMockOverlapClassifier([classification]),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: createMockLogger(),
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // Fallback renormalizes 0.30 + 0.20 = 0.50 → gate=0.60, corr=0.40
      // Expected: 0.8×0.60 + 0.8×0.40 = 0.48 + 0.32 = 0.80
      expect(closestPair.compositeScore).toBeCloseTo(0.8, 2);
    });
  });

  describe('rebalanced weight behavior', () => {
    it('prioritizes globalMeanAbsDiff with new default weights', async () => {
      const config = createConfig({});

      const prototypes = [
        { id: 'proto:a', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:b', weights: { axis1: 1 }, gates: [] },
        { id: 'proto:c', weights: { axis1: 1 }, gates: [] },
      ];

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

      const classifications = [
        createClassification({
          gateOverlapRatio: 0.9,
          pearsonCorrelation: 0.5,
          globalMeanAbsDiff: 0.6,
        }),
        createClassification({
          gateOverlapRatio: 0.3,
          pearsonCorrelation: 0.9,
          globalMeanAbsDiff: 0.05,
        }),
      ];

      const analyzer = new PrototypeOverlapAnalyzer({
        prototypeRegistryService: createMockRegistryService(prototypes),
        candidatePairFilter: createMockCandidatePairFilter(candidatePairs),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator([
          createBehaviorResult({ correlation: 0.5, globalMeanAbsDiff: 0.6 }),
          createBehaviorResult({ correlation: 0.9, globalMeanAbsDiff: 0.05 }),
        ]),
        overlapClassifier: createMockOverlapClassifier(classifications),
        overlapRecommendationBuilder: createMockRecommendationBuilder(),
        gateBandingSuggestionBuilder: createMockGateBandingSuggestionBuilder(),
        config,
        logger: createMockLogger(),
      });

      const result = await analyzer.analyze('expression');
      const closestPair = result.metadata?.summaryInsight?.closestPair;

      // With new weights (0.30, 0.20, 0.50):
      // Pair 1: 0.9×0.30 + 0.75×0.20 + 0.4×0.50 = 0.27 + 0.15 + 0.20 = 0.62
      // Pair 2: 0.3×0.30 + 0.95×0.20 + 0.95×0.50 = 0.09 + 0.19 + 0.475 = 0.755
      expect(closestPair.prototypeB).toBe('proto:c');
      expect(closestPair.compositeScore).toBeGreaterThan(0.7);
    });
  });
});
