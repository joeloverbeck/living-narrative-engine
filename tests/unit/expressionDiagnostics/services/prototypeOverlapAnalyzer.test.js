/**
 * @file Unit tests for PrototypeOverlapAnalyzer
 * Tests the main orchestrator for prototype overlap analysis pipeline.
 */

import { describe, it, expect } from '@jest/globals';
import PrototypeOverlapAnalyzer from '../../../../src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js';

describe('PrototypeOverlapAnalyzer', () => {
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
    filterCandidates: jest.fn().mockReturnValue({
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
        gateImplication: null,
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

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const { analyzer } = createAnalyzer();
      expect(analyzer).toBeInstanceOf(PrototypeOverlapAnalyzer);
    });

    it('should throw when logger is missing', () => {
      const config = createConfig();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config,
            logger: null,
          })
      ).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const config = createConfig();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error, info
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config,
            logger: invalidLogger,
          })
      ).toThrow();
    });

    it('should throw when prototypeRegistryService is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: null,
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });

    it('should throw when candidatePairFilter is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: null,
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });

    it('should throw when behavioralOverlapEvaluator is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: null,
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });

    it('should throw when overlapClassifier is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: null,
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });

    it('should throw when overlapRecommendationBuilder is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: null,
            config: createConfig(),
            logger,
          })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: null,
            logger,
          })
      ).toThrow();
    });

    it('should throw when config lacks sampleCountPerPair', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: { maxCandidatePairs: 50 },
            logger,
          })
      ).toThrow();
    });

    it('should throw when config lacks maxCandidatePairs', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new PrototypeOverlapAnalyzer({
            prototypeRegistryService: createMockRegistryService(),
            candidatePairFilter: createMockCandidatePairFilter(),
            behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator(),
            overlapClassifier: createMockOverlapClassifier(),
            overlapRecommendationBuilder: createMockOverlapRecommendationBuilder(),
            config: { sampleCountPerPair: 100 },
            logger,
          })
      ).toThrow();
    });
  });

  describe('Orchestration', () => {
    it('calls services in correct order', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const callOrder = [];
      const prototypeRegistryService = {
        getPrototypesByType: jest.fn(() => {
          callOrder.push('getPrototypesByType');
          return [protoA, protoB];
        }),
      };
      const candidatePairFilter = {
        filterCandidates: jest.fn(() => {
          callOrder.push('filterCandidates');
          return {
            candidates: [candidatePair],
            stats: {
              totalPossiblePairs: 1,
              passedFiltering: 1,
              rejectedByActiveAxisOverlap: 0,
              rejectedBySignAgreement: 0,
              rejectedByCosineSimilarity: 0,
              prototypesWithValidWeights: 2,
            },
          };
        }),
      };
      const behavioralOverlapEvaluator = {
        evaluate: jest.fn(async () => {
          callOrder.push('evaluate');
          return {
            gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
            intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02, dominanceP: 0.3, dominanceQ: 0.3 },
            divergenceExamples: [],
          };
        }),
      };
      const overlapClassifier = {
        classify: jest.fn(() => {
          callOrder.push('classify');
          // Use v2 classification type
          return { type: 'merge_recommended', thresholds: {}, metrics: {} };
        }),
      };
      const overlapRecommendationBuilder = {
        build: jest.fn(() => {
          callOrder.push('build');
          return { severity: 0.9 };
        }),
      };

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      await analyzer.analyze();

      expect(callOrder).toEqual([
        'getPrototypesByType',
        'filterCandidates',
        'evaluate',
        'classify',
        'build',
      ]);
    });

    it('passes prototypes to candidatePairFilter', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const prototypes = [protoA, protoB];

      const prototypeRegistryService = createMockRegistryService(prototypes);
      const candidatePairFilter = createMockCandidatePairFilter([]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
      });

      await analyzer.analyze();

      expect(candidatePairFilter.filterCandidates).toHaveBeenCalledWith(
        prototypes
      );
    });

    it('passes candidate pairs to behavioralOverlapEvaluator', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator();

      const { analyzer, config } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
      });

      await analyzer.analyze();

      expect(behavioralOverlapEvaluator.evaluate).toHaveBeenCalledWith(
        protoA,
        protoB,
        config.sampleCountPerPair,
        expect.any(Function) // onSampleProgress callback
      );
    });

    it('passes metrics to overlapClassifier', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);
      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
        intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02, dominanceP: 0.3, dominanceQ: 0.3 },
        divergenceExamples: [],
      };

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator =
        createMockBehavioralOverlapEvaluator(behaviorResult);
      const overlapClassifier = createMockOverlapClassifier();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
      });

      await analyzer.analyze();

      expect(overlapClassifier.classify).toHaveBeenCalledWith(
        candidatePair.candidateMetrics,
        { gateOverlap: behaviorResult.gateOverlap, intensity: behaviorResult.intensity }
      );
    });

    it('passes classification to recommendationBuilder when redundant (v2 type)', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);
      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
        intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02, dominanceP: 0.3, dominanceQ: 0.3 },
        passRates: { passRateA: 0.9, passRateB: 0.88, coPassRate: 0.85 },
        highCoactivation: { count: 3, threshold: 0.8, ratio: 0.03 },
        gateImplication: { A_implies_B: true, B_implies_A: false, evidence: [] },
        divergenceExamples: [{ context: {}, intensityA: 0.5, intensityB: 0.6, absDiff: 0.1 }],
      };
      // Use v2 classification type
      const classification = { type: 'merge_recommended', thresholds: {}, metrics: {} };

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator =
        createMockBehavioralOverlapEvaluator(behaviorResult);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder =
        createMockOverlapRecommendationBuilder();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(overlapRecommendationBuilder.build).toHaveBeenCalledWith(
        protoA,
        protoB,
        classification,
        candidatePair.candidateMetrics,
        {
          gateOverlap: behaviorResult.gateOverlap,
          intensity: behaviorResult.intensity,
          passRates: behaviorResult.passRates,
          highCoactivation: behaviorResult.highCoactivation,
          gateImplication: behaviorResult.gateImplication,
        },
        behaviorResult.divergenceExamples,
        [], // bandingSuggestions - empty for merge_recommended (not in BANDING_TYPES)
        'emotion'
      );
    });

    it('passes null gateImplication to recommendationBuilder when not available', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);
      // behaviorResult with null gateImplication (default from createMockBehavioralOverlapEvaluator)
      const behaviorResult = {
        gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
        intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02, dominanceP: 0.3, dominanceQ: 0.3 },
        passRates: { passRateA: 0.9, passRateB: 0.88, coPassRate: 0.85 },
        highCoactivation: { count: 3, threshold: 0.8, ratio: 0.03 },
        gateImplication: null, // Explicitly null - gates unparseable or not present
        divergenceExamples: [],
      };
      const classification = { type: 'subsumed_recommended', thresholds: {}, metrics: {} };

      const prototypeRegistryService = createMockRegistryService([protoA, protoB]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator(behaviorResult);
      const overlapClassifier = createMockOverlapClassifier(classification);
      const overlapRecommendationBuilder = createMockOverlapRecommendationBuilder();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(overlapRecommendationBuilder.build).toHaveBeenCalledWith(
        protoA,
        protoB,
        classification,
        candidatePair.candidateMetrics,
        {
          gateOverlap: behaviorResult.gateOverlap,
          intensity: behaviorResult.intensity,
          passRates: behaviorResult.passRates,
          highCoactivation: behaviorResult.highCoactivation,
          gateImplication: null, // Verify null is passed, not omitted
        },
        behaviorResult.divergenceExamples,
        [], // bandingSuggestions - empty for subsumed_recommended (not in BANDING_TYPES)
        'emotion'
      );
    });

    it('does not call recommendationBuilder for not_redundant classification', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier({
        type: 'not_redundant',
        thresholds: {},
        metrics: {},
      });
      const overlapRecommendationBuilder =
        createMockOverlapRecommendationBuilder();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      await analyzer.analyze();

      expect(overlapRecommendationBuilder.build).not.toHaveBeenCalled();
    });
  });

  describe('Progress reporting', () => {
    it('invokes onProgress callback during analysis', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
      });

      const progressCalls = [];
      const onProgress = jest.fn((stage, progressData) => {
        progressCalls.push({ stage, ...progressData });
      });

      await analyzer.analyze({ onProgress });

      expect(onProgress).toHaveBeenCalled();
    });

    it('reports candidate filtering progress', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
      });

      const progressCalls = [];
      const onProgress = jest.fn((stage, progressData) => {
        progressCalls.push({ stage, ...progressData });
      });

      await analyzer.analyze({ onProgress });

      const filteringCalls = progressCalls.filter((c) => c.stage === 'filtering');
      expect(filteringCalls.length).toBeGreaterThan(0);
      // New format uses { current, total } for filtering stage
      expect(filteringCalls).toContainEqual({ stage: 'filtering', current: 0, total: 1 });
      expect(filteringCalls).toContainEqual({ stage: 'filtering', current: 1, total: 1 });
    });

    it('reports evaluation progress per pair with nested structure', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const protoC = createPrototype('proto_c');
      const pair1 = createCandidatePair(protoA, protoB);
      const pair2 = createCandidatePair(protoA, protoC);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
        protoC,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([pair1, pair2]);

      // Mock evaluator that invokes the progress callback
      const behavioralOverlapEvaluator = {
        evaluate: jest.fn(async (protoA, protoB, sampleCount, onSampleProgress) => {
          // Simulate sample-level progress callback
          if (onSampleProgress) {
            onSampleProgress(sampleCount, sampleCount); // Report completion
          }
          return {
            gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
            intensity: { pearsonCorrelation: 0.95, meanAbsDiff: 0.05, dominanceP: 0.3, dominanceQ: 0.3 },
            divergenceExamples: [],
          };
        }),
      };

      const { analyzer, config } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
      });

      const progressCalls = [];
      const onProgress = jest.fn((stage, progressData) => {
        progressCalls.push({ stage, ...progressData });
      });

      await analyzer.analyze({ onProgress });

      const evaluatingCalls = progressCalls.filter(
        (c) => c.stage === 'evaluating'
      );

      // New format uses { pairIndex, pairTotal, sampleIndex, sampleTotal }
      expect(evaluatingCalls.length).toBeGreaterThan(0);

      // Check that all evaluating calls have the expected structure
      for (const call of evaluatingCalls) {
        expect(call).toHaveProperty('pairIndex');
        expect(call).toHaveProperty('pairTotal');
        expect(call).toHaveProperty('sampleIndex');
        expect(call).toHaveProperty('sampleTotal');
        expect(call.pairTotal).toBe(2);
      }

      // Final call should indicate completion
      const finalCall = evaluatingCalls[evaluatingCalls.length - 1];
      expect(finalCall.pairIndex).toBe(2);
      expect(finalCall.pairTotal).toBe(2);
      expect(finalCall.sampleIndex).toBe(config.sampleCountPerPair);
      expect(finalCall.sampleTotal).toBe(config.sampleCountPerPair);
    });
  });

  describe('Results', () => {
    it('returns recommendations sorted by severity descending', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const protoC = createPrototype('proto_c');
      const pair1 = createCandidatePair(protoA, protoB);
      const pair2 = createCandidatePair(protoA, protoC);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
        protoC,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([pair1, pair2]);
      // Use v2 classification type
      const overlapClassifier = createMockOverlapClassifier({
        type: 'merge_recommended',
        thresholds: {},
        metrics: {},
      });

      // Return different severities for each pair
      let callCount = 0;
      const overlapRecommendationBuilder = {
        build: jest.fn(() => {
          callCount++;
          return { severity: callCount === 1 ? 0.5 : 0.9 };
        }),
      };

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations.length).toBe(2);
      expect(result.recommendations[0].severity).toBe(0.9); // Higher first
      expect(result.recommendations[1].severity).toBe(0.5);
    });

    it('returns metadata with correct counts', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const protoC = createPrototype('proto_c');
      const pair1 = createCandidatePair(protoA, protoB);
      const pair2 = createCandidatePair(protoA, protoC);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
        protoC,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([pair1, pair2]);

      // First pair is merge_recommended (v2), second is keep_distinct
      let classifyCallCount = 0;
      const overlapClassifier = {
        classify: jest.fn(() => {
          classifyCallCount++;
          return {
            // Use v2 classification types
            type: classifyCallCount === 1 ? 'merge_recommended' : 'keep_distinct',
            thresholds: {},
            metrics: {},
          };
        }),
      };

      const { analyzer, config } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
      });

      const result = await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(result.metadata.prototypeFamily).toBe('emotion');
      expect(result.metadata.totalPrototypes).toBe(3);
      expect(result.metadata.candidatePairsFound).toBe(2);
      expect(result.metadata.candidatePairsEvaluated).toBe(2);
      expect(result.metadata.redundantPairsFound).toBe(1);
      expect(result.metadata.sampleCountPerPair).toBe(config.sampleCountPerPair);
    });

    it('filters out non-redundant classifications from recommendations (v2 types)', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const protoC = createPrototype('proto_c');
      const pair1 = createCandidatePair(protoA, protoB);
      const pair2 = createCandidatePair(protoA, protoC);
      const pair3 = createCandidatePair(protoB, protoC);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
        protoC,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([
        pair1,
        pair2,
        pair3,
      ]);

      // Alternate between v2 types: merge_recommended, keep_distinct, subsumed_recommended
      let classifyCallCount = 0;
      const overlapClassifier = {
        classify: jest.fn(() => {
          classifyCallCount++;
          // Use v2 classification types
          const types = ['merge_recommended', 'keep_distinct', 'subsumed_recommended'];
          return {
            type: types[(classifyCallCount - 1) % 3],
            thresholds: {},
            metrics: {},
          };
        }),
      };

      let buildCallCount = 0;
      const overlapRecommendationBuilder = {
        build: jest.fn(() => {
          buildCallCount++;
          return { severity: 0.9 - buildCallCount * 0.1 };
        }),
      };

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
        overlapRecommendationBuilder,
      });

      const result = await analyzer.analyze();

      // Only merge_recommended (1st) and subsumed_recommended (3rd) should be included
      expect(result.recommendations.length).toBe(2);
      expect(overlapRecommendationBuilder.build).toHaveBeenCalledTimes(2);
    });
  });

  describe('Safety', () => {
    it('respects maxCandidatePairs limit', async () => {
      const prototypes = Array.from({ length: 10 }, (_, i) =>
        createPrototype(`proto_${i}`)
      );
      // Create more pairs than the limit
      const candidatePairs = [];
      for (let i = 0; i < 100; i++) {
        candidatePairs.push(
          createCandidatePair(prototypes[i % 10], prototypes[(i + 1) % 10])
        );
      }

      const prototypeRegistryService = createMockRegistryService(prototypes);
      const candidatePairFilter = createMockCandidatePairFilter(candidatePairs);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator();

      const { analyzer, logger } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        config: { sampleCountPerPair: 100, maxCandidatePairs: 10 },
      });

      await analyzer.analyze();

      // Should only evaluate maxCandidatePairs (10)
      expect(behavioralOverlapEvaluator.evaluate).toHaveBeenCalledTimes(10);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Truncated')
      );
    });

    it('handles empty prototype list gracefully', async () => {
      const prototypeRegistryService = createMockRegistryService([]);
      const candidatePairFilter = createMockCandidatePairFilter();

      const { analyzer, logger } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations).toEqual([]);
      expect(result.metadata.totalPrototypes).toBe(0);
      expect(candidatePairFilter.filterCandidates).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fewer than 2 prototypes')
      );
    });

    it('handles single prototype gracefully', async () => {
      const protoA = createPrototype('proto_a');
      const prototypeRegistryService = createMockRegistryService([protoA]);
      const candidatePairFilter = createMockCandidatePairFilter();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations).toEqual([]);
      expect(result.metadata.totalPrototypes).toBe(1);
      expect(candidatePairFilter.filterCandidates).not.toHaveBeenCalled();
    });

    it('handles zero candidate pairs gracefully', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([]); // No candidates
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
      });

      const result = await analyzer.analyze();

      expect(result.recommendations).toEqual([]);
      expect(result.metadata.candidatePairsFound).toBe(0);
      expect(behavioralOverlapEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('Options handling', () => {
    it('uses default prototypeFamily when not specified', async () => {
      const prototypeRegistryService = createMockRegistryService([]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
      });

      await analyzer.analyze();

      expect(prototypeRegistryService.getPrototypesByType).toHaveBeenCalledWith(
        'emotion'
      );
    });

    it('uses specified prototypeFamily', async () => {
      const prototypeRegistryService = createMockRegistryService([]);

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
      });

      await analyzer.analyze({ prototypeFamily: 'sexual' });

      expect(prototypeRegistryService.getPrototypesByType).toHaveBeenCalledWith(
        'sexual'
      );
    });

    it('uses specified sampleCount override', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        config: { sampleCountPerPair: 100, maxCandidatePairs: 50 },
      });

      await analyzer.analyze({ sampleCount: 500 });

      expect(behavioralOverlapEvaluator.evaluate).toHaveBeenCalledWith(
        protoA,
        protoB,
        500,
        expect.any(Function) // onSampleProgress callback
      );
    });

    it('uses config sampleCountPerPair when not overridden', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const behavioralOverlapEvaluator = createMockBehavioralOverlapEvaluator();

      const { analyzer } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        behavioralOverlapEvaluator,
        config: { sampleCountPerPair: 8000, maxCandidatePairs: 50 },
      });

      await analyzer.analyze();

      expect(behavioralOverlapEvaluator.evaluate).toHaveBeenCalledWith(
        protoA,
        protoB,
        8000,
        expect.any(Function) // onSampleProgress callback
      );
    });
  });

  describe('Logging', () => {
    it('logs debug message with prototype count', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);

      const { analyzer, logger } = createAnalyzer({
        prototypeRegistryService,
      });

      await analyzer.analyze({ prototypeFamily: 'emotion' });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 prototypes')
      );
    });

    it('logs debug message with candidate pair count', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);

      const { analyzer, logger } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
      });

      await analyzer.analyze();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stage A found 1 candidate pairs')
      );
    });

    it('logs info message on completion', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const prototypeRegistryService = createMockRegistryService([
        protoA,
        protoB,
      ]);
      const candidatePairFilter = createMockCandidatePairFilter([candidatePair]);
      const overlapClassifier = createMockOverlapClassifier({
        type: 'merge',
        thresholds: {},
        metrics: {},
      });

      const { analyzer, logger } = createAnalyzer({
        prototypeRegistryService,
        candidatePairFilter,
        overlapClassifier,
      });

      await analyzer.analyze();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Analysis complete')
      );
    });
  });

  describe('Determinism', () => {
    it('produces same results for same inputs', async () => {
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const candidatePair = createCandidatePair(protoA, protoB);

      const createDeterministicMocks = () => ({
        prototypeRegistryService: createMockRegistryService([protoA, protoB]),
        candidatePairFilter: createMockCandidatePairFilter([candidatePair]),
        behavioralOverlapEvaluator: createMockBehavioralOverlapEvaluator({
          gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28, pOnlyRate: 0.01, qOnlyRate: 0.01 },
          intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02, dominanceP: 0.3, dominanceQ: 0.3 },
          divergenceExamples: [],
        }),
        overlapClassifier: createMockOverlapClassifier({
          type: 'merge',
          thresholds: {},
          metrics: {},
        }),
        overlapRecommendationBuilder: createMockOverlapRecommendationBuilder({
          severity: 0.85,
          type: 'prototype_merge_suggestion',
        }),
      });

      const { analyzer: analyzer1 } = createAnalyzer(createDeterministicMocks());
      const { analyzer: analyzer2 } = createAnalyzer(createDeterministicMocks());

      const result1 = await analyzer1.analyze();
      const result2 = await analyzer2.analyze();

      expect(result1.recommendations.length).toBe(result2.recommendations.length);
      expect(result1.metadata.redundantPairsFound).toBe(
        result2.metadata.redundantPairsFound
      );
    });
  });
});
