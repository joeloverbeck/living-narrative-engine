/**
 * @file Unit tests for OverlapRecommendationBuilder v2 evidence fields
 * Tests the expanded evidence payload for PROREDANAV2-014.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapRecommendationBuilder from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js';

describe('OverlapRecommendationBuilder - v2 Evidence', () => {
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
    activeAxisEpsilon: 0.08,
    ...overrides,
  });

  /**
   * Create a prototype object for testing.
   *
   * @param {string} id - Prototype ID
   * @param {object} [weights] - Weight overrides
   * @returns {object} Prototype object
   */
  const createPrototype = (id, weights = {}) => ({
    id,
    gates: [],
    weights: {
      arousal: 0.3,
      valence: 0.4,
      dominance: -0.2,
      ...weights,
    },
  });

  /**
   * Create candidate metrics (Stage A output).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Candidate metrics
   */
  const createCandidateMetrics = (overrides = {}) => ({
    activeAxisOverlap: 0.9,
    signAgreement: 0.95,
    weightCosineSimilarity: 0.98,
    ...overrides,
  });

  /**
   * Create full v2 behavioral metrics.
   *
   * @param {object} [overrides] - Override specific sections
   * @returns {object} Behavioral metrics with all v2 fields
   */
  const createV2BehaviorMetrics = (overrides = {}) => {
    const gateOverlap = {
      onEitherRate: 0.3,
      onBothRate: 0.28,
      pOnlyRate: 0.01,
      qOnlyRate: 0.01,
      jaccard: 0.85,
      ...(overrides.gateOverlap || {}),
    };
    const intensity = {
      pearsonCorrelation: 0.99,
      meanAbsDiff: 0.02,
      dominanceP: 0.3,
      dominanceQ: 0.3,
      rmse: 0.05,
      pctWithinEps: 0.92,
      ...(overrides.intensity || {}),
    };
    const passRates = {
      pA_given_B: 0.95,
      pB_given_A: 0.93,
      coPassCount: 1500,
      ...(overrides.passRates || {}),
    };
    const highCoactivation = {
      thresholds: [
        { threshold: 0.5, coactivationRate: 0.88 },
        { threshold: 0.7, coactivationRate: 0.72 },
        { threshold: 0.9, coactivationRate: 0.45 },
      ],
      ...(overrides.highCoactivation || {}),
    };
    const gateImplication = overrides.gateImplication ?? null;

    return { gateOverlap, intensity, passRates, highCoactivation, gateImplication };
  };

  /**
   * Create classification result for testing.
   *
   * @param {string} type - Classification type
   * @param {object} [extras] - Additional properties
   * @returns {object} Classification
   */
  const createClassification = (type, extras = {}) => ({
    type,
    metrics: {
      activeAxisOverlap: 0.9,
      weightCosineSimilarity: 0.98,
      pearsonCorrelation: 0.99,
      onEitherRate: 0.3,
      onBothRate: 0.28,
    },
    thresholds: {},
    ...extras,
  });

  /**
   * Create builder instance for testing.
   *
   * @param {object} [configOverrides] - Config overrides
   * @returns {{builder: OverlapRecommendationBuilder, logger: object}} Builder and logger
   */
  const createBuilder = (configOverrides) => {
    const logger = createMockLogger();
    const config = createConfig(configOverrides ?? {});
    const builder = new OverlapRecommendationBuilder({ config, logger });
    return { builder, logger };
  };

  describe('evidence structure completeness', () => {
    it('should include all v1 fields for backward compatibility', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.evidence).toHaveProperty('sharedDrivers');
      expect(result.evidence).toHaveProperty('keyDifferentiators');
      expect(result.evidence).toHaveProperty('divergenceExamples');
      expect(Array.isArray(result.evidence.sharedDrivers)).toBe(true);
      expect(Array.isArray(result.evidence.keyDifferentiators)).toBe(true);
      expect(Array.isArray(result.evidence.divergenceExamples)).toBe(true);
    });

    it('should include all v2 evidence sections', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.evidence).toHaveProperty('pearsonCorrelation');
      expect(result.evidence).toHaveProperty('gateOverlap');
      expect(result.evidence).toHaveProperty('passRates');
      expect(result.evidence).toHaveProperty('intensitySimilarity');
      expect(result.evidence).toHaveProperty('highCoactivation');
      expect(result.evidence).toHaveProperty('gateImplication');
    });
  });

  describe('gateOverlap section', () => {
    it('should include onEitherRate, onBothRate, and jaccard', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = createV2BehaviorMetrics({
        gateOverlap: { onEitherRate: 0.35, onBothRate: 0.3, jaccard: 0.86 },
      });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.gateOverlap.onEitherRate).toBeCloseTo(0.35, 5);
      expect(result.evidence.gateOverlap.onBothRate).toBeCloseTo(0.3, 5);
      expect(result.evidence.gateOverlap.jaccard).toBeCloseTo(0.86, 5);
    });

    it('should default to NaN when gateOverlap fields are missing', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = { gateOverlap: {}, intensity: {} };

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(Number.isNaN(result.evidence.gateOverlap.onEitherRate)).toBe(true);
      expect(Number.isNaN(result.evidence.gateOverlap.onBothRate)).toBe(true);
      expect(Number.isNaN(result.evidence.gateOverlap.jaccard)).toBe(true);
    });
  });

  describe('passRates section', () => {
    it('should include pA_given_B, pB_given_A, and coPassCount', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = createV2BehaviorMetrics({
        passRates: { pA_given_B: 0.95, pB_given_A: 0.88, coPassCount: 2000 },
      });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.passRates.pA_given_B).toBeCloseTo(0.95, 5);
      expect(result.evidence.passRates.pB_given_A).toBeCloseTo(0.88, 5);
      expect(result.evidence.passRates.coPassCount).toBe(2000);
    });

    it('should default to NaN for conditional rates when missing', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = { gateOverlap: {}, intensity: {}, passRates: {} };

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(Number.isNaN(result.evidence.passRates.pA_given_B)).toBe(true);
      expect(Number.isNaN(result.evidence.passRates.pB_given_A)).toBe(true);
    });

    it('should default coPassCount to 0 when missing', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = { gateOverlap: {}, intensity: {}, passRates: {} };

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.passRates.coPassCount).toBe(0);
    });
  });

  describe('intensitySimilarity section', () => {
    it('should include rmse and pctWithinEps', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = createV2BehaviorMetrics({
        intensity: { rmse: 0.03, pctWithinEps: 0.95 },
      });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.intensitySimilarity.rmse).toBeCloseTo(0.03, 5);
      expect(result.evidence.intensitySimilarity.pctWithinEps).toBeCloseTo(0.95, 5);
    });

    it('should default to NaN when intensity fields are missing', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = { gateOverlap: {}, intensity: {} };

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(Number.isNaN(result.evidence.intensitySimilarity.rmse)).toBe(true);
      expect(Number.isNaN(result.evidence.intensitySimilarity.pctWithinEps)).toBe(true);
    });
  });

  describe('highCoactivation section', () => {
    it('should include thresholds array with threshold and coactivationRate', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const thresholds = [
        { threshold: 0.5, coactivationRate: 0.9 },
        { threshold: 0.7, coactivationRate: 0.75 },
      ];
      const metrics = createV2BehaviorMetrics({
        highCoactivation: { thresholds },
      });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.highCoactivation.thresholds).toHaveLength(2);
      expect(result.evidence.highCoactivation.thresholds[0].threshold).toBeCloseTo(0.5, 5);
      expect(result.evidence.highCoactivation.thresholds[0].coactivationRate).toBeCloseTo(0.9, 5);
      expect(result.evidence.highCoactivation.thresholds[1].threshold).toBeCloseTo(0.7, 5);
      expect(result.evidence.highCoactivation.thresholds[1].coactivationRate).toBeCloseTo(0.75, 5);
    });

    it('should default to empty array when thresholds are missing', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = { gateOverlap: {}, intensity: {}, highCoactivation: {} };

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.highCoactivation.thresholds).toEqual([]);
    });

    it('should handle malformed threshold entries gracefully', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const thresholds = [
        { threshold: 0.5, coactivationRate: 0.9 },
        null,
        { threshold: undefined, coactivationRate: 'invalid' },
      ];
      const metrics = createV2BehaviorMetrics({
        highCoactivation: { thresholds },
      });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.highCoactivation.thresholds).toHaveLength(3);
      expect(result.evidence.highCoactivation.thresholds[0].threshold).toBeCloseTo(0.5, 5);
      expect(Number.isNaN(result.evidence.highCoactivation.thresholds[1].threshold)).toBe(true);
      expect(Number.isNaN(result.evidence.highCoactivation.thresholds[2].coactivationRate)).toBe(true);
    });
  });

  describe('gateImplication section', () => {
    it('should include direction, confidence, implyingPrototype, and impliedPrototype when present', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const gateImplication = {
        direction: 'A_implies_B',
        confidence: 0.92,
        implyingPrototype: 'proto_a',
        impliedPrototype: 'proto_b',
      };
      const metrics = createV2BehaviorMetrics({ gateImplication });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('subsumed'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.gateImplication).not.toBeNull();
      expect(result.evidence.gateImplication.direction).toBe('A_implies_B');
      expect(result.evidence.gateImplication.confidence).toBeCloseTo(0.92, 5);
      expect(result.evidence.gateImplication.implyingPrototype).toBe('proto_a');
      expect(result.evidence.gateImplication.impliedPrototype).toBe('proto_b');
    });

    it('should be null when gateImplication is not provided', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = createV2BehaviorMetrics(); // no gateImplication

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.gateImplication).toBeNull();
    });

    it('should handle partial gateImplication gracefully', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const gateImplication = {
        direction: 'B_implies_A',
        // missing confidence, implyingPrototype, impliedPrototype
      };
      const metrics = createV2BehaviorMetrics({ gateImplication });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('subsumed'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.gateImplication.direction).toBe('B_implies_A');
      expect(Number.isNaN(result.evidence.gateImplication.confidence)).toBe(true);
      expect(result.evidence.gateImplication.implyingPrototype).toBeNull();
      expect(result.evidence.gateImplication.impliedPrototype).toBeNull();
    });
  });

  describe('pearsonCorrelation field', () => {
    it('should include pearsonCorrelation at evidence root level', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = createV2BehaviorMetrics({
        intensity: { pearsonCorrelation: 0.97 },
      });

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.evidence.pearsonCorrelation).toBeCloseTo(0.97, 5);
    });

    it('should default pearsonCorrelation to NaN when missing', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');
      const metrics = { gateOverlap: {}, intensity: {} };

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(Number.isNaN(result.evidence.pearsonCorrelation)).toBe(true);
    });
  });

  describe('NaN handling for missing metrics', () => {
    it('should handle completely empty behaviorMetrics gracefully', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        {}, // empty behaviorMetrics
        []
      );

      // Should not throw
      expect(result).toHaveProperty('evidence');
      expect(Number.isNaN(result.evidence.pearsonCorrelation)).toBe(true);
      expect(Number.isNaN(result.evidence.gateOverlap.onEitherRate)).toBe(true);
      expect(Number.isNaN(result.evidence.passRates.pA_given_B)).toBe(true);
      expect(Number.isNaN(result.evidence.intensitySimilarity.rmse)).toBe(true);
      expect(result.evidence.highCoactivation.thresholds).toEqual([]);
      expect(result.evidence.gateImplication).toBeNull();
    });

    it('should handle null behaviorMetrics gracefully', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        null,
        []
      );

      expect(result).toHaveProperty('evidence');
      expect(Number.isNaN(result.evidence.pearsonCorrelation)).toBe(true);
    });
  });

  describe('v2 classification type mapping', () => {
    it('should map merge_recommended to prototype_merge_suggestion', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge_recommended'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_merge_suggestion');
    });

    it('should map subsumed_recommended to prototype_subsumption_suggestion', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('subsumed_recommended', { subsumedPrototype: 'a' }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_subsumption_suggestion');
    });

    it('should map nested_siblings to prototype_nested_siblings', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('nested_siblings', { nestingDirection: 'A_contains_B' }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_nested_siblings');
    });

    it('should map needs_separation to prototype_needs_separation', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('needs_separation'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_needs_separation');
    });

    it('should map keep_distinct to prototype_distinct_info', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('keep_distinct'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_distinct_info');
    });

    it('should map convert_to_expression to prototype_expression_conversion', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('convert_to_expression', {
          conversionHint: 'Consider intensity-scaled expression',
        }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_expression_conversion');
    });
  });

  describe('v2 classification type actions', () => {
    it('should generate actions for merge_recommended', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge_recommended'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0]).toContain('merging');
    });

    it('should generate actions for subsumed_recommended', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('subsumed_recommended', { subsumedPrototype: 'a' }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0]).toContain('removing');
      expect(result.actions[0]).toContain('proto_a');
    });

    it('should generate actions for nested_siblings with A_contains_B direction', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('parent_proto');
      const protoB = createPrototype('child_proto');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('nested_siblings', { nestingDirection: 'A_contains_B' }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0]).toContain('child_proto');
      expect(result.actions[0]).toContain('specialized');
      expect(result.actions[0]).toContain('parent_proto');
    });

    it('should generate actions for nested_siblings with B_contains_A direction', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('inner_proto');
      const protoB = createPrototype('outer_proto');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('nested_siblings', { nestingDirection: 'B_contains_A' }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0]).toContain('inner_proto');
      expect(result.actions[0]).toContain('specialized');
      expect(result.actions[0]).toContain('outer_proto');
    });

    it('should generate actions for convert_to_expression with conversionHint', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('convert_to_expression', {
          conversionHint: 'Use intensity-modulated base expression',
        }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0]).toContain('expression');
      expect(result.actions[0]).toContain('Use intensity-modulated base expression');
    });

    it('should generate actions for needs_separation', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('needs_separation'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions.some((a) => a.includes('overlap'))).toBe(true);
    });

    it('should generate actions for keep_distinct', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('keep_distinct'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0]).toContain('No action needed');
      expect(result.actions[0]).toContain('distinct');
    });
  });

  describe('backward compatibility', () => {
    it('should still map v1 merge type correctly', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('merge'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_merge_suggestion');
    });

    it('should still map v1 subsumed type correctly', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('subsumed', { subsumedPrototype: 'b' }),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_subsumption_suggestion');
    });

    it('should still map v1 not_redundant type correctly', () => {
      const { builder } = createBuilder();
      const protoA = createPrototype('proto_a');
      const protoB = createPrototype('proto_b');

      const result = builder.build(
        protoA,
        protoB,
        createClassification('not_redundant'),
        createCandidateMetrics(),
        createV2BehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_overlap_info');
    });
  });
});
