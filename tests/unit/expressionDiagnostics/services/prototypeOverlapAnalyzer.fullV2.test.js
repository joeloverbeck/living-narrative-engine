/**
 * @file Unit tests for PrototypeOverlapAnalyzer V2 full integration
 * Tests the orchestrator's integration with GateBandingSuggestionBuilder (PROREDANAV2-017).
 */

import { describe, it, expect } from '@jest/globals';
import PrototypeOverlapAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';

describe('PrototypeOverlapAnalyzer - V2 Full Integration', () => {
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
        rejectedByActiveAxisOverlap: 3,
        rejectedBySignAgreement: 2,
        rejectedByCosineSimilarity: 1,
        prototypesWithValidWeights: 5,
      },
    }),
  });

  /**
   * Create a mock behavioral overlap evaluator.
   *
   * @param {object} [result] - Result to return
   * @returns {object} Mock evaluator
   */
  const createMockBehavioralOverlapEvaluator = (result = null) => ({
    evaluate: jest.fn().mockResolvedValue(
      result ?? {
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.28,
          pOnlyRate: 0.01,
          qOnlyRate: 0.01,
        },
        intensity: {
          pearsonCorrelation: 0.95,
          meanAbsDiff: 0.05,
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        passRates: {
          passRateA: 0.85,
          passRateB: 0.82,
          coPassRate: 0.78,
        },
        highCoactivation: {
          count: 5,
          threshold: 0.8,
          ratio: 0.05,
        },
        gateImplication: {
          A_implies_B: true,
          B_implies_A: false,
          evidence: [
            {
              axis: 'valence',
              intervalA: { lower: 0.3, upper: 0.7 },
              intervalB: { lower: 0.2, upper: 0.8 },
              A_subset_B: true,
              B_subset_A: false,
            },
          ],
        },
        divergenceExamples: [],
      }
    ),
  });

  /**
   * Create a mock overlap classifier.
   *
   * @param {object} [result] - Result to return
   * @returns {object} Mock classifier
   */
  const createMockOverlapClassifier = (result = null) => ({
    classify: jest.fn().mockReturnValue(
      result ?? {
        type: 'not_redundant',
        thresholds: {},
        metrics: {},
      }
    ),
  });

  /**
   * Create a mock overlap recommendation builder.
   *
   * @param {object} [result] - Result to return
   * @returns {object} Mock builder
   */
  const createMockOverlapRecommendationBuilder = (result = null) => ({
    build: jest.fn().mockReturnValue(
      result ?? {
        type: 'prototype_merge_suggestion',
        prototypeFamily: 'emotion',
        prototypes: { a: 'proto_a', b: 'proto_b' },
        severity: 0.9,
        confidence: 0.85,
        actions: [],
        candidateMetrics: {},
        behaviorMetrics: {},
        evidence: {},
        suggestedGateBands: [],
      }
    ),
  });

  /**
   * Create a mock gate banding suggestion builder.
   *
   * @param {Array<object>} [suggestions] - Suggestions to return
   * @returns {object} Mock builder
   */
  const createMockGateBandingSuggestionBuilder = (suggestions = []) => ({
    buildSuggestions: jest.fn().mockReturnValue(suggestions),
  });

  /**
   * Create a test prototype.
   *
   * @param {string} id - Prototype ID
   * @param {object} [weights] - Weight overrides
   * @returns {object} Prototype object
   */
  const createPrototype = (id, weights = {}) => ({
    id,
    type: 'emotion',
    weights: { joy: 0.5, sadness: -0.3, ...weights },
    gates: [],
  });

  /**
   * Create candidate pair result.
   *
   * @param {object} prototypeA - First prototype
   * @param {object} prototypeB - Second prototype
   * @returns {object} Candidate pair
   */
  const createCandidatePair = (prototypeA, prototypeB) => ({
    prototypeA,
    prototypeB,
    candidateMetrics: {
      activeAxisOverlap: 0.9,
      signAgreement: 0.95,
      weightCosineSimilarity: 0.98,
    },
  });

  /**
   * Create an analyzer with all dependencies.
   *
   * @param {object} [overrides] - Override specific dependencies
   * @returns {object} Analyzer and mocks
   */
  const createAnalyzer = (overrides = {}) => {
    const logger = createMockLogger();
    const config = createConfig(overrides.config);
    const prototypeRegistryService =
      overrides.prototypeRegistryService ?? createMockRegistryService();
    const candidatePairFilter =
      overrides.candidatePairFilter ?? createMockCandidatePairFilter();
    const behavioralOverlapEvaluator =
      overrides.behavioralOverlapEvaluator ??
      createMockBehavioralOverlapEvaluator();
    const overlapClassifier =
      overrides.overlapClassifier ?? createMockOverlapClassifier();
    const overlapRecommendationBuilder =
      overrides.overlapRecommendationBuilder ??
      createMockOverlapRecommendationBuilder();
    const gateBandingSuggestionBuilder =
      overrides.gateBandingSuggestionBuilder ??
      createMockGateBandingSuggestionBuilder();

    const analyzer = new PrototypeOverlapAnalyzer({
      prototypeRegistryService,
      candidatePairFilter,
      behavioralOverlapEvaluator,
      overlapClassifier,
      overlapRecommendationBuilder,
      gateBandingSuggestionBuilder,
      config,
      logger,
    });

    return {
      analyzer,
      logger,
      config,
      prototypeRegistryService,
      candidatePairFilter,
      behavioralOverlapEvaluator,
      overlapClassifier,
      overlapRecommendationBuilder,
      gateBandingSuggestionBuilder,
    };
  };

  describe('constructor with gateBandingSuggestionBuilder', () => {
    it('should create instance with gateBandingSuggestionBuilder dependency', () => {
      const { analyzer } = createAnalyzer();
      expect(analyzer).toBeInstanceOf(PrototypeOverlapAnalyzer);
    });

    it('should throw when gateBandingSuggestionBuilder is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            gateBandingSuggestionBuilder: null,
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });

    it('should throw when gateBandingSuggestionBuilder lacks buildSuggestions method', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            gateBandingSuggestionBuilder: { someOtherMethod: jest.fn() },
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });
  });

  describe('Banding suggestions for nested_siblings', () => {
    it('should call gateBandingSuggestionBuilder for nested_siblings classification', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const gateImplication = {
        A_implies_B: true,
        B_implies_A: false,
        evidence: [
          {
            axis: 'valence',
            intervalA: { lower: 0.3, upper: 0.7 },
            intervalB: { lower: 0.2, upper: 0.8 },
            A_subset_B: true,
            B_subset_A: false,
          },
        ],
      };

      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
        intensity: { pearsonCorrelation: 0.8, meanAbsDiff: 0.1, dominanceP: 0.3, dominanceQ: 0.3 },
        passRates: { passRateA: 0.85, passRateB: 0.82, coPassRate: 0.78 },
        highCoactivation: { count: 5, threshold: 0.8, ratio: 0.05 },
        gateImplication,
        divergenceExamples: [],
      };

      const classification = {
        type: 'nested_siblings',
        nestingDirection: 'A_contains_B',
        thresholds: {},
        metrics: {},
      };

      const bandingSuggestions = [
        {
          type: 'gate_band',
          axis: 'valence',
          affectedPrototype: 'B',
          suggestedGate: 'valence >= 0.75',
          reason: 'A has tighter valence constraints (upper: 0.70)',
          message: 'Add gate "valence >= 0.75" to B to exclude overlap with A',
        },
        {
          type: 'expression_suppression',
          message: 'When higher-tier prototype is active, cap lower-tier intensity to 0',
          suggestedAction: 'Add expression-level mutual exclusion rule',
        },
      ];

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator(behaviorResult);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const gateBandingSuggestionBuilder = createMockGateBandingSuggestionBuilder(bandingSuggestions);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
        gateBandingSuggestionBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(gateBandingSuggestionBuilder.buildSuggestions).toHaveBeenCalledWith(
        gateImplication,
        'nested_siblings'
      );
    });

    it('should call gateBandingSuggestionBuilder for needs_separation classification', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const gateImplication = {
        A_implies_B: false,
        B_implies_A: false,
        evidence: [
          {
            axis: 'arousal',
            intervalA: { lower: 0.4, upper: 0.8 },
            intervalB: { lower: 0.3, upper: 0.9 },
            A_subset_B: false,
            B_subset_A: false,
          },
        ],
      };

      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.4, onBothRate: 0.35, pOnlyRate: 0.03, qOnlyRate: 0.02 },
        intensity: { pearsonCorrelation: 0.6, meanAbsDiff: 0.15, dominanceP: 0.4, dominanceQ: 0.4 },
        passRates: { passRateA: 0.75, passRateB: 0.78, coPassRate: 0.68 },
        highCoactivation: { count: 3, threshold: 0.8, ratio: 0.03 },
        gateImplication,
        divergenceExamples: [],
      };

      const classification = {
        type: 'needs_separation',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator(behaviorResult);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const gateBandingSuggestionBuilder = createMockGateBandingSuggestionBuilder([]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
        gateBandingSuggestionBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(gateBandingSuggestionBuilder.buildSuggestions).toHaveBeenCalledWith(
        gateImplication,
        'needs_separation'
      );
    });

    it('should NOT call gateBandingSuggestionBuilder for merge_recommended classification', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'merge_recommended',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const gateBandingSuggestionBuilder = createMockGateBandingSuggestionBuilder([]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        gateBandingSuggestionBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(gateBandingSuggestionBuilder.buildSuggestions).not.toHaveBeenCalled();
    });
  });

  describe('Build includes banding suggestions', () => {
    it('should pass bandingSuggestions to overlapRecommendationBuilder.build()', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const gateImplication = {
        A_implies_B: true,
        B_implies_A: false,
        evidence: [],
      };

      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
        intensity: { pearsonCorrelation: 0.8, meanAbsDiff: 0.1, dominanceP: 0.3, dominanceQ: 0.3 },
        passRates: { passRateA: 0.85, passRateB: 0.82, coPassRate: 0.78 },
        highCoactivation: { count: 5, threshold: 0.8, ratio: 0.05 },
        gateImplication,
        divergenceExamples: [{ context: {}, intensityA: 0.5, intensityB: 0.6, absDiff: 0.1 }],
      };

      const classification = {
        type: 'nested_siblings',
        nestingDirection: 'A_contains_B',
        thresholds: {},
        metrics: {},
      };

      const bandingSuggestions = [
        {
          type: 'gate_band',
          axis: 'valence',
          affectedPrototype: 'B',
          suggestedGate: 'valence >= 0.75',
          reason: 'A has tighter valence constraints',
          message: 'Add gate "valence >= 0.75" to B',
        },
      ];

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator(behaviorResult);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder = createMockOverlapRecommendationBuilder();
      const gateBandingSuggestionBuilder = createMockGateBandingSuggestionBuilder(bandingSuggestions);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
        overlapRecommendationBuilder,
        gateBandingSuggestionBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(overlapRecommendationBuilder.build).toHaveBeenCalledWith(
        protoA,
        protoB,
        classification,
        candidatePair.candidateMetrics,
        expect.objectContaining({
          gateOverlap: behaviorResult.gateOverlap,
          intensity: behaviorResult.intensity,
          passRates: behaviorResult.passRates,
          highCoactivation: behaviorResult.highCoactivation,
          gateImplication,
        }),
        behaviorResult.divergenceExamples,
        bandingSuggestions, // <-- banding suggestions passed
        'emotion'
      );
    });

    it('should pass empty array for non-banding classifications', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'merge_recommended',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder = createMockOverlapRecommendationBuilder();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(overlapRecommendationBuilder.build).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [], // <-- empty array for merge_recommended
        'emotion'
      );
    });
  });

  describe('Extended RECOMMENDATION_TYPES', () => {
    it('should build recommendations for nested_siblings', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'nested_siblings',
        nestingDirection: 'A_contains_B',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder = createMockOverlapRecommendationBuilder({
        type: 'prototype_nested_siblings',
        severity: 0.7,
        suggestedGateBands: [],
      });

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations.length).toBe(1);
      expect(overlapRecommendationBuilder.build).toHaveBeenCalled();
    });

    it('should build recommendations for needs_separation', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'needs_separation',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder = createMockOverlapRecommendationBuilder({
        type: 'prototype_needs_separation',
        severity: 0.6,
        suggestedGateBands: [],
      });

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations.length).toBe(1);
      expect(overlapRecommendationBuilder.build).toHaveBeenCalled();
    });

    it('should NOT build recommendations for keep_distinct', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'keep_distinct',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder = createMockOverlapRecommendationBuilder();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations.length).toBe(0);
      expect(overlapRecommendationBuilder.build).not.toHaveBeenCalled();
    });
  });

  describe('Classification breakdown tracking', () => {
    it('should track nested_siblings in classificationBreakdown', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'nested_siblings',
        nestingDirection: 'A_contains_B',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
      });

      const result = await analyzer.analyze();

      expect(result.metadata.classificationBreakdown.nestedSiblings).toBe(1);
    });

    it('should track needs_separation in classificationBreakdown', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const classification = {
        type: 'needs_separation',
        thresholds: {},
        metrics: {},
      };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier(classification);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
      });

      const result = await analyzer.analyze();

      expect(result.metadata.classificationBreakdown.needsSeparation).toBe(1);
    });
  });
});
