/**
 * @file Snapshot tests for output shape stability of prototype overlap recommendations
 * @see specs/prototype-overlap-analyzer.md
 * @see tickets/PROREDANAV2-021-convert-snapshot-test.md
 *
 * These tests ensure the output structure remains stable across changes.
 * Unintended shape changes will cause snapshot failures.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapRecommendationBuilder from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js';

describe('OverlapRecommendationBuilder - Output Shape Stability', () => {
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
   * Create a test config.
   *
   * @returns {object} Config object
   */
  const createConfig = () => ({
    activeAxisEpsilon: 0.08,
  });

  /**
   * Create the recommendation builder.
   *
   * @returns {OverlapRecommendationBuilder} Builder instance
   */
  const createBuilder = () => {
    const logger = createMockLogger();
    const config = createConfig();
    return new OverlapRecommendationBuilder({ config, logger });
  };

  /**
   * Create mock prototype.
   *
   * @param {string} id - Prototype ID
   * @param {object} [weights] - Weight overrides
   * @returns {object} Mock prototype
   */
  const createPrototype = (id, weights = {}) => ({
    id,
    weights: {
      valence: 0.5,
      arousal: 0.3,
      engagement: 0.2,
      ...weights,
    },
    gates: ['valence >= 0.2'],
  });

  /**
   * Create mock candidate metrics.
   *
   * @returns {object} Candidate metrics
   */
  const createCandidateMetrics = () => ({
    activeAxisOverlap: 0.9,
    signAgreement: 0.95,
    weightCosineSimilarity: 0.98,
  });

  /**
   * Create mock behavior metrics.
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Behavior metrics
   */
  const createBehaviorMetrics = (overrides = {}) => ({
    gateOverlap: {
      onEitherRate: 0.3,
      onBothRate: 0.25,
      pOnlyRate: 0.03,
      qOnlyRate: 0.02,
      jaccard: 0.83,
      ...overrides.gateOverlap,
    },
    intensity: {
      pearsonCorrelation: 0.95,
      meanAbsDiff: 0.02,
      dominanceP: 0.4,
      dominanceQ: 0.35,
      rmse: 0.03,
      pctWithinEps: 0.9,
      ...overrides.intensity,
    },
    passRates: {
      pA_given_B: 0.85,
      pB_given_A: 0.92,
      coPassCount: 1500,
      ...overrides.passRates,
    },
    highCoactivation: {
      thresholds: [
        { threshold: 0.4, coactivationRate: 0.8 },
        { threshold: 0.6, coactivationRate: 0.6 },
      ],
      ...overrides.highCoactivation,
    },
    gateImplication: overrides.gateImplication ?? null,
  });

  /**
   * Create mock divergence examples.
   *
   * @returns {Array<object>} Divergence examples
   */
  const createDivergenceExamples = () => [
    {
      context: { valence: 0.3, arousal: 0.5, engagement: 0.4 },
      intensityA: 0.6,
      intensityB: 0.4,
      absDiff: 0.2,
    },
  ];

  describe('prototype_merge_suggestion output shape', () => {
    it('should have stable output shape for merge_recommended classification', () => {
      const builder = createBuilder();
      const prototypeA = createPrototype('numbness_like');
      const prototypeB = createPrototype('apathy_like');
      const classification = {
        type: 'merge_recommended',
        thresholds: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
        },
        metrics: {
          onEitherRate: 0.3,
          gateOverlapRatio: 0.92,
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
        },
      };

      const recommendation = builder.build(
        prototypeA,
        prototypeB,
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // Verify top-level structure
      expect(recommendation).toMatchObject({
        type: 'prototype_merge_suggestion',
        prototypeFamily: 'emotion',
        prototypes: { a: 'numbness_like', b: 'apathy_like' },
      });

      // Verify all required fields exist
      expect(typeof recommendation.severity).toBe('number');
      expect(typeof recommendation.confidence).toBe('number');
      expect(Array.isArray(recommendation.actions)).toBe(true);
      expect(recommendation.candidateMetrics).toBeDefined();
      expect(recommendation.behaviorMetrics).toBeDefined();
      expect(recommendation.evidence).toBeDefined();
      expect(Array.isArray(recommendation.suggestedGateBands)).toBe(true);

      // Verify severity and confidence are in valid range
      expect(recommendation.severity).toBeGreaterThanOrEqual(0);
      expect(recommendation.severity).toBeLessThanOrEqual(1);
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
    });

    it('should have stable evidence structure for merge', () => {
      const builder = createBuilder();
      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'merge_recommended', thresholds: {}, metrics: {} },
        createCandidateMetrics(),
        createBehaviorMetrics(),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      const evidence = recommendation.evidence;

      // Verify v1 backward-compatible fields
      expect(Array.isArray(evidence.sharedDrivers)).toBe(true);
      expect(Array.isArray(evidence.keyDifferentiators)).toBe(true);
      expect(Array.isArray(evidence.divergenceExamples)).toBe(true);

      // Verify v2 evidence fields
      expect(typeof evidence.pearsonCorrelation).toBe('number');
      expect(evidence.gateOverlap).toMatchObject({
        onEitherRate: expect.any(Number),
        onBothRate: expect.any(Number),
        jaccard: expect.any(Number),
      });
      expect(evidence.passRates).toMatchObject({
        pA_given_B: expect.any(Number),
        pB_given_A: expect.any(Number),
        coPassCount: expect.any(Number),
      });
      expect(evidence.intensitySimilarity).toMatchObject({
        rmse: expect.any(Number),
        pctWithinEps: expect.any(Number),
      });
      expect(evidence.highCoactivation).toBeDefined();
      expect(Array.isArray(evidence.highCoactivation.thresholds)).toBe(true);
    });
  });

  describe('prototype_nested_siblings output shape', () => {
    it('should have stable output shape for nested_siblings classification', () => {
      const builder = createBuilder();
      const prototypeA = createPrototype('interest_like');
      const prototypeB = createPrototype('curiosity_like');
      const classification = {
        type: 'nested_siblings',
        thresholds: {},
        metrics: {},
        narrowerPrototype: 'b',
      };

      const bandingSuggestions = [
        {
          type: 'expression_suppression',
          message: 'Consider expression suppression for narrower prototype',
          suggestedAction: 'Suppress curiosity_like when interest_like is active',
        },
      ];

      const recommendation = builder.build(
        prototypeA,
        prototypeB,
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics({
          passRates: { pA_given_B: 0.5, pB_given_A: 0.99, coPassCount: 1500 },
        }),
        createDivergenceExamples(),
        bandingSuggestions,
        'emotion'
      );

      // Verify type mapping
      expect(recommendation.type).toBe('prototype_nested_siblings');

      // Verify banding suggestions are included
      expect(recommendation.suggestedGateBands).toEqual(bandingSuggestions);

      // Verify actions array is populated
      expect(recommendation.actions.length).toBeGreaterThan(0);
    });

    it('should include expression_suppression in suggestedGateBands', () => {
      const builder = createBuilder();
      const bandingSuggestions = [
        {
          type: 'expression_suppression',
          message: 'Test suppression message',
          suggestedAction: 'Test action',
        },
      ];

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'nested_siblings', thresholds: {}, metrics: {} },
        createCandidateMetrics(),
        createBehaviorMetrics(),
        createDivergenceExamples(),
        bandingSuggestions,
        'emotion'
      );

      expect(recommendation.suggestedGateBands).toHaveLength(1);
      expect(recommendation.suggestedGateBands[0].type).toBe(
        'expression_suppression'
      );
    });
  });

  describe('prototype_subsumption_suggestion output shape', () => {
    it('should have stable output shape for subsumed_recommended classification', () => {
      const builder = createBuilder();
      const classification = {
        type: 'subsumed_recommended',
        thresholds: {},
        metrics: {},
        subsumedPrototype: 'a',
      };

      const recommendation = builder.build(
        createPrototype('subsumed_proto'),
        createPrototype('dominant_proto'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics({
          intensity: { dominanceP: 0.2, dominanceQ: 0.96 },
        }),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // Verify type mapping
      expect(recommendation.type).toBe('prototype_subsumption_suggestion');

      // Verify actions mention subsumption
      const hasSubsumptionAction = recommendation.actions.some(
        (action) =>
          action.toLowerCase().includes('subset') ||
          action.toLowerCase().includes('remov')
      );
      expect(hasSubsumptionAction).toBe(true);
    });
  });

  describe('prototype_expression_conversion output shape', () => {
    it('should have stable output shape for convert_to_expression classification', () => {
      const builder = createBuilder();
      const classification = {
        type: 'convert_to_expression',
        thresholds: {},
        metrics: {},
        narrowerPrototype: 'a',
      };

      const recommendation = builder.build(
        createPrototype('relief_like'),
        createPrototype('contentment_like'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics({
          gateImplication: {
            A_implies_B: true,
            B_implies_A: false,
            direction: 'a_implies_b',
            confidence: 0.95,
          },
        }),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // Verify type mapping
      expect(recommendation.type).toBe('prototype_expression_conversion');

      // Verify actions mention expression conversion
      const hasExpressionAction = recommendation.actions.some(
        (action) => action.toLowerCase().includes('expression')
      );
      expect(hasExpressionAction).toBe(true);
    });
  });

  describe('behaviorMetrics flattened structure', () => {
    it('should have stable flattened behaviorMetrics shape', () => {
      const builder = createBuilder();

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'merge_recommended', thresholds: {}, metrics: {} },
        createCandidateMetrics(),
        createBehaviorMetrics(),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // Verify flattened behaviorMetrics structure
      expect(recommendation.behaviorMetrics).toMatchObject({
        onEitherRate: expect.any(Number),
        onBothRate: expect.any(Number),
        pOnlyRate: expect.any(Number),
        qOnlyRate: expect.any(Number),
        pearsonCorrelation: expect.any(Number),
        meanAbsDiff: expect.any(Number),
        dominanceP: expect.any(Number),
        dominanceQ: expect.any(Number),
      });
    });
  });

  describe('candidateMetrics structure', () => {
    it('should preserve candidateMetrics from input', () => {
      const builder = createBuilder();
      const candidateMetrics = createCandidateMetrics();

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'merge_recommended', thresholds: {}, metrics: {} },
        candidateMetrics,
        createBehaviorMetrics(),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      expect(recommendation.candidateMetrics).toMatchObject({
        activeAxisOverlap: candidateMetrics.activeAxisOverlap,
        signAgreement: candidateMetrics.signAgreement,
        weightCosineSimilarity: candidateMetrics.weightCosineSimilarity,
      });
    });
  });

  describe('thresholdAnalysis structure', () => {
    it('should include thresholdAnalysis when thresholds and metrics present', () => {
      const builder = createBuilder();
      const classification = {
        type: 'merge_recommended',
        thresholds: {
          minOnEitherRateForMerge: 0.05,
          minGateOverlapRatio: 0.9,
          minCorrelationForMerge: 0.98,
          maxMeanAbsDiffForMerge: 0.03,
        },
        metrics: {
          onEitherRate: 0.3,
          gateOverlapRatio: 0.92,
          pearsonCorrelation: 0.99,
          meanAbsDiff: 0.02,
        },
      };

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // thresholdAnalysis provides transparency about classification decision
      expect(recommendation.thresholdAnalysis).toBeDefined();
    });
  });

  describe('backward compatibility', () => {
    it('should NOT include legacyType field (v2 uses type only)', () => {
      const builder = createBuilder();

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'merge_recommended', thresholds: {}, metrics: {} },
        createCandidateMetrics(),
        createBehaviorMetrics(),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // v2 uses `type` field only, no legacyType
      expect(recommendation.legacyType).toBeUndefined();
      expect(recommendation.type).toBe('prototype_merge_suggestion');
    });

    it('should use v2 type field naming convention', () => {
      const builder = createBuilder();

      // Test all v2 classification type mappings
      const typeMappings = [
        { input: 'merge_recommended', output: 'prototype_merge_suggestion' },
        {
          input: 'subsumed_recommended',
          output: 'prototype_subsumption_suggestion',
        },
        { input: 'nested_siblings', output: 'prototype_nested_siblings' },
        { input: 'needs_separation', output: 'prototype_needs_separation' },
        {
          input: 'convert_to_expression',
          output: 'prototype_expression_conversion',
        },
        { input: 'keep_distinct', output: 'prototype_distinct_info' },
      ];

      for (const { input, output } of typeMappings) {
        const recommendation = builder.build(
          createPrototype('proto_a'),
          createPrototype('proto_b'),
          { type: input, thresholds: {}, metrics: {} },
          createCandidateMetrics(),
          createBehaviorMetrics(),
          createDivergenceExamples(),
          [],
          'emotion'
        );

        expect(recommendation.type).toBe(output);
      }
    });
  });

  describe('gateImplication evidence structure', () => {
    it('should include gateImplication in evidence when present', () => {
      const builder = createBuilder();
      const gateImplication = {
        A_implies_B: true,
        B_implies_A: false,
        direction: 'a_implies_b',
        confidence: 0.95,
        implyingPrototype: 'proto_a',
        impliedPrototype: 'proto_b',
      };

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'nested_siblings', thresholds: {}, metrics: {} },
        createCandidateMetrics(),
        createBehaviorMetrics({ gateImplication }),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      // gateImplication should be in evidence
      expect(recommendation.evidence.gateImplication).toBeDefined();
      expect(recommendation.evidence.gateImplication).toMatchObject({
        direction: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should have null gateImplication when not present', () => {
      const builder = createBuilder();

      const recommendation = builder.build(
        createPrototype('proto_a'),
        createPrototype('proto_b'),
        { type: 'merge_recommended', thresholds: {}, metrics: {} },
        createCandidateMetrics(),
        createBehaviorMetrics({ gateImplication: null }),
        createDivergenceExamples(),
        [],
        'emotion'
      );

      expect(recommendation.evidence.gateImplication).toBeNull();
    });
  });
});
