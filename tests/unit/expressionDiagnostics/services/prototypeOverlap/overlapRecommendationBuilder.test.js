/**
 * @file Unit tests for OverlapRecommendationBuilder
 * Tests Stage D recommendation building from overlap analysis results.
 */

import { describe, it, expect } from '@jest/globals';
import OverlapRecommendationBuilder from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js';

describe('OverlapRecommendationBuilder', () => {
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
   * Create behavioral metrics (Stage B output).
   *
   * @param {object} [overrides] - Override specific values
   * @returns {object} Behavioral metrics
   */
  const createBehaviorMetrics = (overrides = {}) => {
    const gateOverlap = {
      onEitherRate: 0.3,
      onBothRate: 0.28,
      pOnlyRate: 0.01,
      qOnlyRate: 0.01,
      ...(overrides.gateOverlap || {}),
    };
    const intensity = {
      pearsonCorrelation: 0.99,
      meanAbsDiff: 0.02,
      dominanceP: 0.3,
      dominanceQ: 0.3,
      ...(overrides.intensity || {}),
    };
    return { gateOverlap, intensity };
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
   * Create divergence examples for testing.
   *
   * @param {number} [count] - Number of examples
   * @returns {Array} Divergence examples
   */
  const createDivergenceExamples = (count = 3) => {
    const examples = [];
    for (let i = 0; i < count; i++) {
      examples.push({
        context: { arousal: 0.5 + i * 0.1, valence: 0.3 + i * 0.05 },
        intensityA: 0.6 + i * 0.05,
        intensityB: 0.5 + i * 0.03,
        absDiff: Math.abs(0.6 + i * 0.05 - (0.5 + i * 0.03)),
      });
    }
    return examples;
  };

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

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const { builder } = createBuilder();
      expect(builder).toBeInstanceOf(OverlapRecommendationBuilder);
    });

    it('should throw when logger is missing', () => {
      const config = createConfig();
      expect(
        () => new OverlapRecommendationBuilder({ config, logger: null })
      ).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const config = createConfig();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(
        () =>
          new OverlapRecommendationBuilder({ config, logger: invalidLogger })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      const logger = createMockLogger();
      expect(
        () => new OverlapRecommendationBuilder({ config: null, logger })
      ).toThrow();
    });

    it('should throw when config lacks activeAxisEpsilon', () => {
      const logger = createMockLogger();
      const config = {}; // Missing activeAxisEpsilon
      expect(
        () => new OverlapRecommendationBuilder({ config, logger })
      ).toThrow();
    });

    it('should log error when config is invalid', () => {
      const logger = createMockLogger();
      try {
        new OverlapRecommendationBuilder({
          config: { activeAxisEpsilon: 'invalid' },
          logger,
        });
      } catch {
        // Expected
      }
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Structure tests', () => {
    it('returns all required fields', () => {
      const { builder } = createBuilder();
      const prototypeA = createPrototype('proto_a');
      const prototypeB = createPrototype('proto_b');
      const classification = createClassification('merge');
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();
      const divergenceExamples = createDivergenceExamples();

      const result = builder.build(
        prototypeA,
        prototypeB,
        classification,
        candidateMetrics,
        behaviorMetrics,
        divergenceExamples
      );

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('prototypeFamily');
      expect(result).toHaveProperty('prototypes');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('candidateMetrics');
      expect(result).toHaveProperty('behaviorMetrics');
      expect(result).toHaveProperty('evidence');
    });

    it('maps merge classification to prototype_merge_suggestion', () => {
      const { builder } = createBuilder();
      const classification = createClassification('merge');

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_merge_suggestion');
    });

    it('maps subsumed classification to prototype_subsumption_suggestion', () => {
      const { builder } = createBuilder();
      const classification = createClassification('subsumed', {
        subsumedPrototype: 'a',
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_subsumption_suggestion');
    });

    it('maps not_redundant classification to prototype_overlap_info', () => {
      const { builder } = createBuilder();
      const classification = createClassification('not_redundant');

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_overlap_info');
    });

    it('maps merge_recommended classification to prototype_merge_suggestion', () => {
      const { builder } = createBuilder();
      const classification = createClassification('merge_recommended');

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_merge_suggestion');
    });

    it('maps subsumed_recommended classification to prototype_subsumption_suggestion', () => {
      const { builder } = createBuilder();
      const classification = createClassification('subsumed_recommended', {
        subsumedPrototype: 'b',
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_subsumption_suggestion');
    });

    it('includes correct prototype IDs', () => {
      const { builder } = createBuilder();
      const prototypeA = createPrototype('emotion:happy');
      const prototypeB = createPrototype('emotion:joyful');

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.prototypes.a).toBe('emotion:happy');
      expect(result.prototypes.b).toBe('emotion:joyful');
    });

    it('defaults prototypeFamily to emotion', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.prototypeFamily).toBe('emotion');
    });

    it('accepts sexual as prototypeFamily', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [], // divergenceExamples
        [], // bandingSuggestions
        'sexual'
      );

      expect(result.prototypeFamily).toBe('sexual');
    });
  });

  describe('Severity tests', () => {
    it('computes severity in [0,1] range', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.severity).toBeGreaterThanOrEqual(0);
      expect(result.severity).toBeLessThanOrEqual(1);
    });

    it('increases merge severity with higher correlation', () => {
      const { builder } = createBuilder();

      const lowCorrelationMetrics = createBehaviorMetrics({
        intensity: { pearsonCorrelation: 0.5, meanAbsDiff: 0.02 },
      });
      const highCorrelationMetrics = createBehaviorMetrics({
        intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02 },
      });

      const lowResult = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        lowCorrelationMetrics,
        []
      );

      const highResult = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        highCorrelationMetrics,
        []
      );

      expect(highResult.severity).toBeGreaterThan(lowResult.severity);
    });

    it('increases subsumption severity with higher dominance', () => {
      const { builder } = createBuilder();

      const lowDominanceMetrics = createBehaviorMetrics({
        intensity: { dominanceP: 0.5, dominanceQ: 0.3 },
      });
      const highDominanceMetrics = createBehaviorMetrics({
        intensity: { dominanceP: 0.98, dominanceQ: 0.01 },
      });

      const lowResult = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('subsumed', { subsumedPrototype: 'a' }),
        createCandidateMetrics(),
        lowDominanceMetrics,
        []
      );

      const highResult = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('subsumed', { subsumedPrototype: 'a' }),
        createCandidateMetrics(),
        highDominanceMetrics,
        []
      );

      expect(highResult.severity).toBeGreaterThan(lowResult.severity);
    });

    it('computes low severity for not_redundant', () => {
      const { builder } = createBuilder();
      const classification = createClassification('not_redundant', {
        metrics: { weightCosineSimilarity: 0.5 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        classification,
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      // not_redundant severity = cosineSim * 0.3 = 0.5 * 0.3 = 0.15
      expect(result.severity).toBeLessThan(0.5);
    });

    it('uses merge severity formula for merge_recommended type', () => {
      const { builder } = createBuilder();
      const highCorrelationMetrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.3, onBothRate: 0.28 },
        intensity: { pearsonCorrelation: 0.99, meanAbsDiff: 0.02 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge_recommended'),
        createCandidateMetrics(),
        highCorrelationMetrics,
        []
      );

      // Merge severity formula: (correlation + gateOverlapRatio) / 2 - meanAbsDiff
      // = (0.99 + (0.28/0.3)) / 2 - 0.02 = (0.99 + 0.933) / 2 - 0.02 ≈ 0.94
      expect(result.severity).toBeGreaterThan(0.8);
    });

    it('uses subsumption severity formula for subsumed_recommended type', () => {
      const { builder } = createBuilder();
      const highDominanceMetrics = createBehaviorMetrics({
        intensity: { dominanceP: 0.95, dominanceQ: 0.02 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('subsumed_recommended', { subsumedPrototype: 'b' }),
        createCandidateMetrics(),
        highDominanceMetrics,
        []
      );

      // Subsumption severity = max(dominanceP, dominanceQ) = 0.95
      expect(result.severity).toBeGreaterThan(0.9);
    });
  });

  describe('Confidence tests', () => {
    it('computes confidence in [0,1] range', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('increases confidence with higher onEitherRate', () => {
      const { builder } = createBuilder();

      const lowOnEitherMetrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.01 },
      });
      const highOnEitherMetrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.5 },
      });

      const lowResult = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        lowOnEitherMetrics,
        []
      );

      const highResult = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        highOnEitherMetrics,
        []
      );

      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
    });

    it('returns high confidence for onEitherRate >= 0.2', () => {
      const { builder } = createBuilder();
      const metrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.3 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('returns medium-high confidence for onEitherRate 0.1-0.2', () => {
      const { builder } = createBuilder();
      const metrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.15 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('returns medium confidence for onEitherRate 0.05-0.1', () => {
      const { builder } = createBuilder();
      const metrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.07 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('returns low confidence for onEitherRate < 0.05', () => {
      const { builder } = createBuilder();
      const metrics = createBehaviorMetrics({
        gateOverlap: { onEitherRate: 0.02 },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        metrics,
        []
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Actions tests', () => {
    it('suggests merge/alias actions for merge type', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('emotion:happy'),
        createPrototype('emotion:joyful'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toContain('merging');
      expect(result.actions[0]).toContain('emotion:happy');
      expect(result.actions[0]).toContain('emotion:joyful');
      expect(result.actions[1]).toContain('Alias');
    });

    it('suggests remove/tighten actions for subsumption type', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('emotion:happy'),
        createPrototype('emotion:joyful'),
        createClassification('subsumed', { subsumedPrototype: 'a' }),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toContain('removing');
      expect(result.actions[1]).toContain('Tighten');
    });

    it('includes correct subsumed prototype name when A is subsumed', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('emotion:happy'),
        createPrototype('emotion:joyful'),
        createClassification('subsumed', { subsumedPrototype: 'a' }),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      // Action should mention removing happy (the subsumed one)
      expect(result.actions[0]).toContain('emotion:happy');
      // And it's a subset of joyful
      expect(result.actions[0]).toContain('emotion:joyful');
    });

    it('includes correct subsumed prototype name when B is subsumed', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('emotion:happy'),
        createPrototype('emotion:joyful'),
        createClassification('subsumed', { subsumedPrototype: 'b' }),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      // Action should mention removing joyful (the subsumed one)
      expect(result.actions[0]).toContain('emotion:joyful');
      // And it's a subset of happy
      expect(result.actions[0]).toContain('emotion:happy');
    });

    it('suggests no action needed for not_redundant', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('not_redundant'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toContain('No action needed');
    });

    it('suggests merge/alias actions for merge_recommended type', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('emotion:numbness'),
        createPrototype('emotion:apathy'),
        createClassification('merge_recommended'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toContain('merging');
      expect(result.actions[0]).toContain('emotion:numbness');
      expect(result.actions[0]).toContain('emotion:apathy');
      expect(result.actions[1]).toContain('Alias');
    });

    it('suggests remove/tighten actions for subsumed_recommended type', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('emotion:calm'),
        createPrototype('emotion:relaxed'),
        createClassification('subsumed_recommended', { subsumedPrototype: 'b' }),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toContain('removing');
      expect(result.actions[0]).toContain('emotion:relaxed');
      expect(result.actions[1]).toContain('Tighten');
    });
  });

  describe('Evidence tests', () => {
    it('extracts shared drivers from overlapping weights', () => {
      const { builder } = createBuilder();
      const prototypeA = createPrototype('a', { arousal: 0.4, valence: 0.3 });
      const prototypeB = createPrototype('b', { arousal: 0.5, valence: 0.35 });

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.evidence.sharedDrivers).toBeDefined();
      expect(Array.isArray(result.evidence.sharedDrivers)).toBe(true);

      // Should find arousal and valence as shared drivers
      const arousalDriver = result.evidence.sharedDrivers.find(
        (d) => d.axis === 'arousal'
      );
      const valenceDriver = result.evidence.sharedDrivers.find(
        (d) => d.axis === 'valence'
      );

      expect(arousalDriver).toBeDefined();
      expect(arousalDriver.weightA).toBe(0.4);
      expect(arousalDriver.weightB).toBe(0.5);

      expect(valenceDriver).toBeDefined();
    });

    it('identifies key differentiators with opposite signs', () => {
      const { builder } = createBuilder();
      // Opposite signs on dominance axis
      const prototypeA = createPrototype('a', { dominance: 0.4 });
      const prototypeB = createPrototype('b', { dominance: -0.4 });

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      const oppositeDiff = result.evidence.keyDifferentiators.find(
        (d) => d.axis === 'dominance' && d.reason === 'opposite_sign'
      );
      expect(oppositeDiff).toBeDefined();
    });

    it('identifies differentiators only present in one prototype', () => {
      const { builder } = createBuilder();
      // uniqueAxis only in A, otherUnique only in B
      const prototypeA = createPrototype('a', {
        uniqueAxis: 0.5,
        arousal: 0.3,
      });
      const prototypeB = createPrototype('b', {
        otherUnique: 0.5,
        arousal: 0.3,
      });

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      const onlyInA = result.evidence.keyDifferentiators.find(
        (d) => d.axis === 'uniqueAxis' && d.reason === 'only_in_A'
      );
      const onlyInB = result.evidence.keyDifferentiators.find(
        (d) => d.axis === 'otherUnique' && d.reason === 'only_in_B'
      );

      expect(onlyInA).toBeDefined();
      expect(onlyInB).toBeDefined();
    });

    it('passes through divergence examples unchanged', () => {
      const { builder } = createBuilder();
      const divergenceExamples = [
        {
          context: { arousal: 0.5 },
          intensityA: 0.7,
          intensityB: 0.5,
          absDiff: 0.2,
        },
        {
          context: { arousal: 0.8 },
          intensityA: 0.9,
          intensityB: 0.6,
          absDiff: 0.3,
        },
      ];

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        divergenceExamples
      );

      expect(result.evidence.divergenceExamples).toEqual(divergenceExamples);
    });

    it('validates absDiff equals |intensityA - intensityB|', () => {
      const { builder } = createBuilder();
      const divergenceExamples = [
        {
          context: {},
          intensityA: 0.7,
          intensityB: 0.5,
          absDiff: 0.2, // |0.7 - 0.5| = 0.2 ✓
        },
      ];

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        divergenceExamples
      );

      const example = result.evidence.divergenceExamples[0];
      expect(example.absDiff).toBeCloseTo(
        Math.abs(example.intensityA - example.intensityB),
        10
      );
    });
  });

  describe('Edge cases', () => {
    it('handles NaN values in behaviorMetrics gracefully', () => {
      const { builder } = createBuilder();
      const metricsWithNaN = createBehaviorMetrics({
        intensity: {
          pearsonCorrelation: NaN,
          meanAbsDiff: NaN,
          dominanceP: NaN,
          dominanceQ: NaN,
        },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        metricsWithNaN,
        []
      );

      expect(result.severity).toBeGreaterThanOrEqual(0);
      expect(result.severity).toBeLessThanOrEqual(1);
      expect(Number.isNaN(result.behaviorMetrics.pearsonCorrelation)).toBe(true);
    });

    it('handles empty weights objects', () => {
      const { builder } = createBuilder();
      const prototypeA = { id: 'a', weights: {} };
      const prototypeB = { id: 'b', weights: {} };

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.evidence.sharedDrivers).toEqual([]);
      expect(result.evidence.keyDifferentiators).toEqual([]);
    });

    it('handles missing fields with defaults', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        { id: 'a' }, // No weights
        { id: 'b' }, // No weights
        {}, // Empty classification
        null, // Null candidateMetrics
        null, // Null behaviorMetrics
        null // Null divergenceExamples
      );

      expect(result.type).toBe('prototype_overlap_info');
      expect(result.prototypes.a).toBe('a');
      expect(result.prototypes.b).toBe('b');
      expect(result.candidateMetrics).toEqual({
        activeAxisOverlap: 0,
        signAgreement: 0,
        weightCosineSimilarity: 0,
      });
      expect(result.evidence.divergenceExamples).toEqual([]);
    });

    it('handles null prototypeA gracefully', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        null,
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.prototypes.a).toBe('unknown_a');
    });

    it('handles null prototypeB gracefully', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        null,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.prototypes.b).toBe('unknown_b');
    });

    it('handles undefined classification type', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        { type: undefined },
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_overlap_info');
    });

    it('handles unknown classification type as not_redundant', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        { type: 'unknown_type' },
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(result.type).toBe('prototype_overlap_info');
    });
  });

  describe('Behavior metrics flattening', () => {
    it('flattens nested behavior metrics correctly', () => {
      const { builder } = createBuilder();
      const behaviorMetrics = createBehaviorMetrics({
        gateOverlap: {
          onEitherRate: 0.4,
          onBothRate: 0.35,
          pOnlyRate: 0.03,
          qOnlyRate: 0.02,
        },
        intensity: {
          pearsonCorrelation: 0.95,
          meanAbsDiff: 0.05,
          dominanceP: 0.6,
          dominanceQ: 0.3,
        },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        behaviorMetrics,
        []
      );

      expect(result.behaviorMetrics.onEitherRate).toBe(0.4);
      expect(result.behaviorMetrics.onBothRate).toBe(0.35);
      expect(result.behaviorMetrics.pOnlyRate).toBe(0.03);
      expect(result.behaviorMetrics.qOnlyRate).toBe(0.02);
      expect(result.behaviorMetrics.pearsonCorrelation).toBe(0.95);
      expect(result.behaviorMetrics.meanAbsDiff).toBe(0.05);
      expect(result.behaviorMetrics.dominanceP).toBe(0.6);
      expect(result.behaviorMetrics.dominanceQ).toBe(0.3);
    });
  });

  describe('Determinism', () => {
    it('produces same output for same inputs', () => {
      const { builder } = createBuilder();
      const prototypeA = createPrototype('a');
      const prototypeB = createPrototype('b');
      const classification = createClassification('merge');
      const candidateMetrics = createCandidateMetrics();
      const behaviorMetrics = createBehaviorMetrics();
      const divergenceExamples = createDivergenceExamples();

      const result1 = builder.build(
        prototypeA,
        prototypeB,
        classification,
        candidateMetrics,
        behaviorMetrics,
        divergenceExamples
      );

      const result2 = builder.build(
        prototypeA,
        prototypeB,
        classification,
        candidateMetrics,
        behaviorMetrics,
        divergenceExamples
      );

      expect(result1.type).toBe(result2.type);
      expect(result1.severity).toBe(result2.severity);
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.actions).toEqual(result2.actions);
    });
  });

  describe('Logging', () => {
    it('logs debug message when building recommendation', () => {
      const { builder, logger } = createBuilder();

      builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('OverlapRecommendationBuilder')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('prototype_merge_suggestion')
      );
    });
  });

  describe('Shared drivers sorting', () => {
    it('sorts shared drivers by combined magnitude', () => {
      const { builder } = createBuilder();
      // arousal has higher combined magnitude than valence
      const prototypeA = createPrototype('a', { arousal: 0.9, valence: 0.1 });
      const prototypeB = createPrototype('b', { arousal: 0.8, valence: 0.15 });

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      const drivers = result.evidence.sharedDrivers.filter(
        (d) => d.axis === 'arousal' || d.axis === 'valence'
      );

      // arousal (0.9 + 0.8 = 1.7) should come before valence (0.1 + 0.15 = 0.25)
      const arousalIndex = drivers.findIndex((d) => d.axis === 'arousal');
      const valenceIndex = drivers.findIndex((d) => d.axis === 'valence');

      expect(arousalIndex).toBeLessThan(valenceIndex);
    });
  });

  describe('Severity edge cases', () => {
    it('clamps severity to 0 when formula returns negative', () => {
      const { builder } = createBuilder();
      // Very high meanAbsDiff would make formula negative
      const metricsWithHighDiff = createBehaviorMetrics({
        intensity: {
          pearsonCorrelation: 0.5,
          meanAbsDiff: 1.0, // High diff
          dominanceP: 0.3,
          dominanceQ: 0.3,
        },
        gateOverlap: {
          onEitherRate: 0.3,
          onBothRate: 0.1, // Low ratio
        },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        metricsWithHighDiff,
        []
      );

      expect(result.severity).toBeGreaterThanOrEqual(0);
    });

    it('clamps severity to 1 when formula returns > 1', () => {
      const { builder } = createBuilder();
      // Perfect metrics that might exceed 1
      const perfectMetrics = createBehaviorMetrics({
        intensity: {
          pearsonCorrelation: 1.0,
          meanAbsDiff: 0.0,
          dominanceP: 0.5,
          dominanceQ: 0.5,
        },
        gateOverlap: {
          onEitherRate: 0.5,
          onBothRate: 0.5, // ratio = 1.0
        },
      });

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        perfectMetrics,
        []
      );

      expect(result.severity).toBeLessThanOrEqual(1);
    });
  });

  describe('Epsilon threshold in config', () => {
    it('respects custom activeAxisEpsilon for shared drivers', () => {
      const { builder } = createBuilder({ activeAxisEpsilon: 0.5 });
      // Weights below 0.5 should not be considered "active"
      const prototypeA = createPrototype('a', { arousal: 0.3, valence: 0.6 });
      const prototypeB = createPrototype('b', { arousal: 0.4, valence: 0.7 });

      const result = builder.build(
        prototypeA,
        prototypeB,
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        []
      );

      // arousal (0.3, 0.4) should NOT be a shared driver (below 0.5 epsilon)
      // valence (0.6, 0.7) SHOULD be a shared driver
      const arousalDriver = result.evidence.sharedDrivers.find(
        (d) => d.axis === 'arousal'
      );
      const valenceDriver = result.evidence.sharedDrivers.find(
        (d) => d.axis === 'valence'
      );

      expect(arousalDriver).toBeUndefined();
      expect(valenceDriver).toBeDefined();
    });
  });

  describe('V3 Data-Driven Suggestions', () => {
    /**
     * Create a mock actionable suggestion engine.
     *
     * @param {Array} suggestions - Suggestions to return
     * @returns {object} Mock engine
     */
    const createMockActionableSuggestionEngine = (suggestions = []) => ({
      generateSuggestions: jest.fn().mockReturnValue(suggestions),
    });

    /**
     * Create V3 data structure for testing.
     *
     * @returns {object} V3 data
     */
    const createV3Data = () => ({
      vectorA: {
        gateResults: new Float32Array([1, 1, 0]),
        intensities: new Float32Array([0.5, 0.6, 0]),
      },
      vectorB: {
        gateResults: new Float32Array([1, 0, 1]),
        intensities: new Float32Array([0.5, 0, 0.7]),
      },
      contextPool: [{ arousal: 0.5 }, { arousal: 0.6 }, { arousal: 0.7 }],
    });

    /**
     * Create valid suggestion.
     *
     * @param {object} overrides - Override defaults
     * @returns {object} Suggestion
     */
    const createValidSuggestion = (overrides = {}) => ({
      axis: 'arousal',
      type: 'gate_lower_bound',
      suggestedValue: 0.6,
      confidence: 0.85,
      estimatedImpact: 0.3,
      isValid: true,
      validationMessage: 'Suggestion passes all validation criteria',
      ...overrides,
    });

    /**
     * Create invalid suggestion.
     *
     * @param {object} overrides - Override defaults
     * @returns {object} Suggestion
     */
    const createInvalidSuggestion = (overrides = {}) => ({
      axis: 'valence',
      type: 'gate_upper_bound',
      suggestedValue: 0.9,
      confidence: 0.4,
      estimatedImpact: 0.1,
      isValid: false,
      validationMessage: 'Insufficient information gain',
      ...overrides,
    });

    /**
     * Create builder with actionable suggestion engine.
     *
     * @param {object} engine - Mock engine
     * @param {object} configOverrides - Config overrides
     * @returns {object} Builder and logger
     */
    const createBuilderWithEngine = (engine, configOverrides = {}) => {
      const logger = createMockLogger();
      const config = createConfig(configOverrides);
      const builder = new OverlapRecommendationBuilder({
        config,
        logger,
        actionableSuggestionEngine: engine,
      });
      return { builder, logger };
    };

    it('should generate suggestions when actionableSuggestionEngine is provided', () => {
      const validSuggestion = createValidSuggestion();
      const engine = createMockActionableSuggestionEngine([validSuggestion]);
      const { builder } = createBuilderWithEngine(engine);
      const v3Data = createV3Data();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        v3Data
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toEqual(validSuggestion);
      expect(engine.generateSuggestions).toHaveBeenCalledWith(
        v3Data.vectorA,
        v3Data.vectorB,
        v3Data.contextPool,
        'merge'
      );
    });

    it('should filter invalid suggestions and include only valid ones', () => {
      const validSuggestion = createValidSuggestion();
      const invalidSuggestion = createInvalidSuggestion();
      const engine = createMockActionableSuggestionEngine([
        validSuggestion,
        invalidSuggestion,
      ]);
      const { builder } = createBuilderWithEngine(engine);

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].isValid).toBe(true);
      expect(result.suggestions.find((s) => !s.isValid)).toBeUndefined();
    });

    it('should log warning for filtered invalid suggestions', () => {
      const invalidSuggestion = createInvalidSuggestion({
        validationMessage: 'Confidence too low',
      });
      const engine = createMockActionableSuggestionEngine([invalidSuggestion]);
      const { builder, logger } = createBuilderWithEngine(engine);

      builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Filtered 1 invalid suggestions')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Confidence too low')
      );
    });

    it('should log info for valid suggestions generated', () => {
      const validSuggestion = createValidSuggestion();
      const engine = createMockActionableSuggestionEngine([validSuggestion]);
      const { builder, logger } = createBuilderWithEngine(engine);

      builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated 1 valid data-driven suggestions')
      );
    });

    it('should return empty suggestions when engine not provided', () => {
      const { builder } = createBuilder();

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(result.suggestions).toEqual([]);
    });

    it('should return empty suggestions when v3Data is null', () => {
      const engine = createMockActionableSuggestionEngine([
        createValidSuggestion(),
      ]);
      const { builder } = createBuilderWithEngine(engine);

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        null
      );

      expect(result.suggestions).toEqual([]);
      expect(engine.generateSuggestions).not.toHaveBeenCalled();
    });

    it('should return empty suggestions when vectorA missing from v3Data', () => {
      const engine = createMockActionableSuggestionEngine([
        createValidSuggestion(),
      ]);
      const { builder } = createBuilderWithEngine(engine);

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        { vectorB: {}, contextPool: [] }
      );

      expect(result.suggestions).toEqual([]);
      expect(engine.generateSuggestions).not.toHaveBeenCalled();
    });

    it('should return empty suggestions when vectorB missing from v3Data', () => {
      const engine = createMockActionableSuggestionEngine([
        createValidSuggestion(),
      ]);
      const { builder } = createBuilderWithEngine(engine);

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        { vectorA: {}, contextPool: [] }
      );

      expect(result.suggestions).toEqual([]);
      expect(engine.generateSuggestions).not.toHaveBeenCalled();
    });

    it('should return empty suggestions when contextPool missing from v3Data', () => {
      const engine = createMockActionableSuggestionEngine([
        createValidSuggestion(),
      ]);
      const { builder } = createBuilderWithEngine(engine);

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        { vectorA: {}, vectorB: {} }
      );

      expect(result.suggestions).toEqual([]);
      expect(engine.generateSuggestions).not.toHaveBeenCalled();
    });

    it('should include confidence and impact estimates in suggestions', () => {
      const validSuggestion = createValidSuggestion({
        confidence: 0.92,
        estimatedImpact: 0.45,
      });
      const engine = createMockActionableSuggestionEngine([validSuggestion]);
      const { builder } = createBuilderWithEngine(engine);

      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(result.suggestions[0].confidence).toBe(0.92);
      expect(result.suggestions[0].estimatedImpact).toBe(0.45);
    });

    it('should preserve backward compatibility with 8-param call', () => {
      const { builder } = createBuilder();

      // Original 8-param call should still work
      const result = builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion'
      );

      expect(result.type).toBe('prototype_merge_suggestion');
      expect(result.suggestions).toEqual([]);
    });

    it('should pass classification type to engine', () => {
      const engine = createMockActionableSuggestionEngine([]);
      const { builder } = createBuilderWithEngine(engine);

      builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('subsumed'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(engine.generateSuggestions).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'subsumed'
      );
    });

    it('should handle undefined classification type gracefully', () => {
      const engine = createMockActionableSuggestionEngine([]);
      const { builder } = createBuilderWithEngine(engine);

      builder.build(
        createPrototype('a'),
        createPrototype('b'),
        {},
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(engine.generateSuggestions).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'unknown'
      );
    });

    it('should include suggestions in debug log', () => {
      const validSuggestion = createValidSuggestion();
      const engine = createMockActionableSuggestionEngine([validSuggestion]);
      const { builder, logger } = createBuilderWithEngine(engine);

      builder.build(
        createPrototype('a'),
        createPrototype('b'),
        createClassification('merge'),
        createCandidateMetrics(),
        createBehaviorMetrics(),
        [],
        [],
        'emotion',
        createV3Data()
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('v3Suggestions=1')
      );
    });
  });
});
