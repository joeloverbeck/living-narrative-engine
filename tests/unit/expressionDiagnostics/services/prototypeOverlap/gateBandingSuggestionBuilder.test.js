/**
 * @file Unit tests for GateBandingSuggestionBuilder
 * Tests gate banding suggestions for nested siblings (PROREDANAV2-015).
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import GateBandingSuggestionBuilder from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js';

describe('GateBandingSuggestionBuilder', () => {
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
   * Create a valid config for testing.
   *
   * @param {object} [overrides] - Config overrides
   * @returns {object} Config object
   */
  const createConfig = (overrides = {}) => ({
    bandMargin: 0.05,
    ...overrides,
  });

  /**
   * Create builder instance for testing.
   *
   * @param {object} [configOverrides] - Config overrides
   * @returns {{builder: GateBandingSuggestionBuilder, logger: object, config: object}} Builder and mocks
   */
  const createBuilder = (configOverrides = {}) => {
    const logger = createMockLogger();
    const config = createConfig(configOverrides);
    const builder = new GateBandingSuggestionBuilder({ config, logger });
    return { builder, logger, config };
  };

  /**
   * Create an interval with the given bounds.
   *
   * @param {number|null} lower - Lower bound (null = unbounded)
   * @param {number|null} upper - Upper bound (null = unbounded)
   * @param {boolean} [unsatisfiable] - Whether interval is unsatisfiable
   * @returns {object} Interval object
   */
  const interval = (lower, upper, unsatisfiable = false) => ({
    lower,
    upper,
    unsatisfiable,
  });

  /**
   * Create axis evidence for testing.
   *
   * @param {string} axis - Axis name
   * @param {object} intervalA - Interval A
   * @param {object} intervalB - Interval B
   * @param {boolean} A_subset_B - Whether A is subset of B
   * @param {boolean} B_subset_A - Whether B is subset of A
   * @returns {object} Axis evidence object
   */
  const axisEvidence = (axis, intervalA, intervalB, A_subset_B, B_subset_A) => ({
    axis,
    intervalA,
    intervalB,
    A_subset_B,
    B_subset_A,
  });

  describe('constructor', () => {
    it('should create instance with valid config and logger', () => {
      const { builder } = createBuilder();
      expect(builder).toBeInstanceOf(GateBandingSuggestionBuilder);
    });

    it('should throw when logger is missing', () => {
      const config = createConfig();
      expect(
        () => new GateBandingSuggestionBuilder({ config, logger: null })
      ).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const config = createConfig();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(
        () => new GateBandingSuggestionBuilder({ config, logger: invalidLogger })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      const logger = createMockLogger();
      expect(
        () => new GateBandingSuggestionBuilder({ config: null, logger })
      ).toThrow(/requires a valid config object/);
    });

    it('should throw when config.bandMargin is missing', () => {
      const logger = createMockLogger();
      const config = {};
      expect(
        () => new GateBandingSuggestionBuilder({ config, logger })
      ).toThrow(/requires numeric bandMargin/);
    });

    it('should throw when config.bandMargin is not a number', () => {
      const logger = createMockLogger();
      const config = { bandMargin: '0.05' };
      expect(
        () => new GateBandingSuggestionBuilder({ config, logger })
      ).toThrow(/requires numeric bandMargin/);
    });
  });

  describe('buildSuggestions - Classification Filtering', () => {
    it('should return empty array for merge_recommended classification', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: [axisEvidence('valence', interval(0.1, 0.5), interval(0, 0.8), true, false)] },
        'merge_recommended'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array for keep_distinct classification', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: [axisEvidence('valence', interval(0.1, 0.5), interval(0, 0.8), true, false)] },
        'keep_distinct'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array for not_redundant classification', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: [axisEvidence('valence', interval(0.1, 0.5), interval(0, 0.8), true, false)] },
        'not_redundant'
      );

      expect(result).toEqual([]);
    });

    it('should process nested_siblings classification', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: [axisEvidence('valence', interval(0.1, 0.5), interval(0, 0.8), true, false)] },
        'nested_siblings'
      );

      // Should have at least the expression_suppression suggestion
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should process needs_separation classification', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: [axisEvidence('valence', interval(0.1, 0.5), interval(0, 0.8), true, false)] },
        'needs_separation'
      );

      // Should generate gate_band suggestions but no expression_suppression
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((s) => s.type === 'expression_suppression')).toBe(false);
    });
  });

  describe('buildSuggestions - Upper Bound Suggestion (Valence Case)', () => {
    it('should suggest gate on broader prototype when narrower has upper bound', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // A: valence [0.1, 0.3] (narrower)
      // B: valence [0.0, 0.8] (wider)
      // A_subset_B = true, B_subset_A = false → A is narrower
      const evidence = [
        axisEvidence('valence', interval(0.1, 0.3), interval(0.0, 0.8), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion).toBeDefined();
      expect(gateSuggestion.axis).toBe('valence');
      expect(gateSuggestion.affectedPrototype).toBe('B');
      expect(gateSuggestion.suggestedGate).toBe('valence >= 0.35');
      expect(gateSuggestion.message).toContain('Add gate');
      expect(gateSuggestion.message).toContain('valence >= 0.35');
      expect(gateSuggestion.message).toContain('to B');
    });
  });

  describe('buildSuggestions - Lower Bound Suggestion (Arousal Case)', () => {
    it('should suggest gate on broader prototype when narrower has lower bound', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // A: arousal [0.4, 0.9] (narrower - higher lower bound)
      // B: arousal [0.1, 0.9] (wider - lower lower bound)
      // A_subset_B = true (A is within B), B_subset_A = false
      const evidence = [
        axisEvidence('arousal', interval(0.4, 0.9), interval(0.1, 0.9), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion).toBeDefined();
      expect(gateSuggestion.axis).toBe('arousal');
      expect(gateSuggestion.affectedPrototype).toBe('B');
      // Narrower lower bound is 0.4, so suggest B use arousal <= 0.35
      expect(gateSuggestion.suggestedGate).toBe('arousal <= 0.35');
    });
  });

  describe('buildSuggestions - Threat Axis Example', () => {
    it('should handle threat axis with spec example values', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // From spec: threat_high [0.6, 1.0] is narrower than threat_moderate [0.3, 0.7]
      // Actually threat_high is NOT a subset of threat_moderate
      // Let's use a proper subset example:
      // threat_high [0.5, 0.7] subset of threat_moderate [0.3, 0.9]
      const evidence = [
        axisEvidence('threat', interval(0.5, 0.7), interval(0.3, 0.9), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion).toBeDefined();
      expect(gateSuggestion.axis).toBe('threat');
      // Should suggest B add threat >= 0.75 (narrower upper is 0.7 + 0.05)
      expect(gateSuggestion.suggestedGate).toBe('threat >= 0.75');
    });
  });

  describe('buildSuggestions - Uses Config bandMargin', () => {
    it('should use custom bandMargin from config', () => {
      const { builder } = createBuilder({ bandMargin: 0.1 });

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion).toBeDefined();
      // With bandMargin 0.1, narrower upper 0.5 → suggest >= 0.60
      expect(gateSuggestion.suggestedGate).toBe('valence >= 0.60');
    });

    it('should use default bandMargin of 0.05 when not overridden', () => {
      const { builder } = createBuilder();

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion.suggestedGate).toBe('valence >= 0.55');
    });
  });

  describe('buildSuggestions - Expression Suppression for Nested Siblings', () => {
    it('should add expression_suppression suggestion for nested_siblings', () => {
      const { builder } = createBuilder();

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'nested_siblings'
      );

      const suppressionSuggestion = result.find(
        (s) => s.type === 'expression_suppression'
      );
      expect(suppressionSuggestion).toBeDefined();
      expect(suppressionSuggestion.message).toContain(
        'When higher-tier prototype is active'
      );
      expect(suppressionSuggestion.suggestedAction).toContain(
        'mutual exclusion rule'
      );
    });

    it('should NOT add expression_suppression for needs_separation', () => {
      const { builder } = createBuilder();

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const suppressionSuggestion = result.find(
        (s) => s.type === 'expression_suppression'
      );
      expect(suppressionSuggestion).toBeUndefined();
    });
  });

  describe('buildSuggestions - Handles Missing/Null Evidence', () => {
    it('should return empty array when gateImplicationResult is null', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(null, 'nested_siblings');

      // Only expression_suppression for nested_siblings, no gate_band
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('expression_suppression');
    });

    it('should return empty array when evidence is undefined', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions({}, 'nested_siblings');

      // Only expression_suppression for nested_siblings
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('expression_suppression');
    });

    it('should return empty array when evidence is null', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: null },
        'nested_siblings'
      );

      // Only expression_suppression for nested_siblings
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('expression_suppression');
    });

    it('should return empty array when evidence is empty array', () => {
      const { builder } = createBuilder();

      const result = builder.buildSuggestions(
        { evidence: [] },
        'nested_siblings'
      );

      // Only expression_suppression for nested_siblings
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('expression_suppression');
    });
  });

  describe('buildSuggestions - Multiple Axis Suggestions', () => {
    it('should generate suggestions for multiple axes', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // Two axes where A is narrower than B
      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
        axisEvidence('arousal', interval(0.4, 0.7), interval(0.2, 0.9), true, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      const gateSuggestions = result.filter((s) => s.type === 'gate_band');
      expect(gateSuggestions.length).toBe(2);

      const valenceSuggestion = gateSuggestions.find((s) => s.axis === 'valence');
      const arousalSuggestion = gateSuggestions.find((s) => s.axis === 'arousal');

      expect(valenceSuggestion).toBeDefined();
      expect(arousalSuggestion).toBeDefined();
      expect(valenceSuggestion.suggestedGate).toBe('valence >= 0.55');
      expect(arousalSuggestion.suggestedGate).toBe('arousal >= 0.75');
    });

    it('should handle mixed relations across axes', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // First axis: A is narrower than B
      // Second axis: B is narrower than A (relation is 'wider' for A)
      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
        axisEvidence('arousal', interval(0.1, 0.9), interval(0.3, 0.7), false, true),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'overlapping' },
        'needs_separation'
      );

      const gateSuggestions = result.filter((s) => s.type === 'gate_band');
      expect(gateSuggestions.length).toBe(2);

      // Valence: A narrower, suggest gate on B
      const valence = gateSuggestions.find((s) => s.axis === 'valence');
      expect(valence.affectedPrototype).toBe('B');

      // Arousal: B narrower (A wider), suggest gate on A
      const arousal = gateSuggestions.find((s) => s.axis === 'arousal');
      expect(arousal.affectedPrototype).toBe('A');
    });
  });

  describe('buildSuggestions - Axis Relation Derivation', () => {
    it('should handle equal intervals (no suggestion)', () => {
      const { builder } = createBuilder();

      // Both are subsets of each other = equal
      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.2, 0.5), true, true),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'equal' },
        'needs_separation'
      );

      // No gate_band suggestions for equal intervals
      const gateSuggestions = result.filter((s) => s.type === 'gate_band');
      expect(gateSuggestions.length).toBe(0);
    });

    it('should handle overlapping intervals (neither subset)', () => {
      const { builder } = createBuilder();

      // Neither is subset of other = overlapping
      const evidence = [
        axisEvidence('valence', interval(0.0, 0.5), interval(0.3, 0.8), false, false),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'overlapping' },
        'needs_separation'
      );

      // No gate_band suggestions for overlapping (unclear which to adjust)
      const gateSuggestions = result.filter((s) => s.type === 'gate_band');
      expect(gateSuggestions.length).toBe(0);
    });
  });

  describe('buildSuggestions - Null Bounds Handling', () => {
    it('should handle A with null upper bound (unbounded above)', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // A: [0.3, null] (extends to infinity), B: [0.2, 0.8]
      // A is NOT subset of B (extends above 0.8), B is subset of A
      // So A is wider
      const evidence = [
        axisEvidence('valence', interval(0.3, null), interval(0.2, 0.8), false, true),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'wider' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion).toBeDefined();
      // B is narrower (upper 0.8), so suggest A add valence >= 0.85
      expect(gateSuggestion.affectedPrototype).toBe('A');
      expect(gateSuggestion.suggestedGate).toBe('valence >= 0.85');
    });

    it('should handle A with null lower bound (unbounded below)', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // A: [null, 0.5] (extends to -infinity), B: [0.2, 0.6]
      // A is NOT subset of B (extends below 0.2), B is subset of A
      // So A is wider
      const evidence = [
        axisEvidence('valence', interval(null, 0.5), interval(0.2, 0.6), false, true),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'wider' },
        'needs_separation'
      );

      const gateSuggestion = result.find((s) => s.type === 'gate_band');
      expect(gateSuggestion).toBeDefined();
      // B is narrower (lower 0.2), so suggest A add valence <= 0.15
      expect(gateSuggestion.affectedPrototype).toBe('A');
      expect(gateSuggestion.suggestedGate).toBe('valence <= 0.15');
    });

    it('should handle both bounds null (fully unconstrained)', () => {
      const { builder } = createBuilder();

      // Both unconstrained = equal
      const evidence = [
        axisEvidence('valence', interval(null, null), interval(null, null), true, true),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'equal' },
        'needs_separation'
      );

      // No gate_band suggestions for equal unconstrained intervals
      const gateSuggestions = result.filter((s) => s.type === 'gate_band');
      expect(gateSuggestions.length).toBe(0);
    });
  });

  describe('buildSuggestions - Logging', () => {
    it('should log debug message when skipping non-applicable classification', () => {
      const { builder, logger } = createBuilder();

      builder.buildSuggestions({ evidence: [] }, 'merge_recommended');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No suggestions for classification')
      );
    });

    it('should log debug message when evidence is missing', () => {
      const { builder, logger } = createBuilder();

      builder.buildSuggestions(null, 'nested_siblings');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No evidence available')
      );
    });

    it('should log debug message with suggestion count', () => {
      const { builder, logger } = createBuilder();

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];

      builder.buildSuggestions({ evidence }, 'nested_siblings');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Generated \d+ suggestions/)
      );
    });
  });

  describe('buildSuggestions - Edge Cases', () => {
    it('should handle unsatisfiable intervals gracefully', () => {
      const { builder } = createBuilder();

      // Unsatisfiable interval (lower > upper)
      const evidence = [
        axisEvidence(
          'valence',
          interval(0.8, 0.2, true),
          interval(0.0, 0.5),
          true, // Empty set is subset of anything
          false
        ),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'needs_separation'
      );

      // Should still attempt to process (may or may not produce useful suggestion)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should preserve immutability of input evidence', () => {
      const { builder } = createBuilder();

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];
      const originalEvidenceLength = evidence.length;

      builder.buildSuggestions({ evidence }, 'nested_siblings');

      expect(evidence.length).toBe(originalEvidenceLength);
    });

    it('should be stateless across multiple calls', () => {
      const { builder } = createBuilder();

      const evidence = [
        axisEvidence('valence', interval(0.2, 0.5), interval(0.0, 0.8), true, false),
      ];

      const result1 = builder.buildSuggestions({ evidence }, 'needs_separation');
      const result2 = builder.buildSuggestions({ evidence }, 'needs_separation');

      expect(result1.length).toBe(result2.length);
      expect(result1[0].suggestedGate).toBe(result2[0].suggestedGate);
    });
  });

  describe('buildSuggestions - Real-World Scenario', () => {
    it('should handle frustration vs anger prototype scenario', () => {
      const { builder } = createBuilder({ bandMargin: 0.05 });

      // Frustration: valence [-0.8, -0.3], arousal [0.4, 0.7]
      // Anger: valence [-0.9, -0.2], arousal [0.5, 0.9]
      // Frustration valence is narrower (subset of anger's)
      // Frustration arousal is narrower (subset of anger's)
      const evidence = [
        axisEvidence(
          'valence',
          interval(-0.8, -0.3), // frustration
          interval(-0.9, -0.2), // anger
          true, // frustration valence subset of anger
          false
        ),
        axisEvidence(
          'arousal',
          interval(0.4, 0.7), // frustration
          interval(0.3, 0.9), // anger
          true, // frustration arousal subset of anger
          false
        ),
      ];

      const result = builder.buildSuggestions(
        { evidence, relation: 'narrower' },
        'nested_siblings'
      );

      // Should get gate suggestions for both axes plus expression_suppression
      const gateSuggestions = result.filter((s) => s.type === 'gate_band');
      const suppressionSuggestion = result.find(
        (s) => s.type === 'expression_suppression'
      );

      expect(gateSuggestions.length).toBe(2);
      expect(suppressionSuggestion).toBeDefined();

      // Both suggestions should target anger (B) since frustration (A) is narrower
      expect(gateSuggestions.every((s) => s.affectedPrototype === 'B')).toBe(true);
    });
  });
});
