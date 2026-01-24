/**
 * @file Unit tests for CandidatePairFilter
 * Tests Stage A candidate filtering logic for prototype overlap analysis.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import CandidatePairFilter from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js';

describe('CandidatePairFilter', () => {
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
   * Create a test config with adjustable thresholds.
   *
   * @param {object} [overrides] - Override specific threshold values
   * @returns {object} Config object
   */
  const createConfig = (overrides = {}) => ({
    activeAxisEpsilon: 0.08,
    candidateMinActiveAxisOverlap: 0.6,
    candidateMinSignAgreement: 0.8,
    candidateMinCosineSimilarity: 0.85,
    softSignThreshold: 0.15,
    jaccardEmptySetValue: 1.0,
    ...overrides,
  });

  /**
   * Create a prototype with specified weights.
   *
   * @param {string} id - Prototype ID
   * @param {object} weights - Axis weights
   * @returns {object} Prototype object
   */
  const createPrototype = (id, weights) => ({
    id,
    weights,
  });

  /**
   * Create filter instance for testing.
   *
   * @param {object} [configOverrides] - Config overrides
   * @returns {{filter: CandidatePairFilter, logger: object}} Filter and mock logger
   */
  const createFilter = (configOverrides = {}) => {
    const logger = createMockLogger();
    const config = createConfig(configOverrides);
    const filter = new CandidatePairFilter({ config, logger });
    return { filter, logger };
  };

  describe('constructor', () => {
    it('should create instance with valid dependencies', async () => {
      const { filter } = createFilter();
      expect(filter).toBeInstanceOf(CandidatePairFilter);
    });

    it('should throw when logger is missing', async () => {
      const config = createConfig();
      expect(() => new CandidatePairFilter({ config, logger: null })).toThrow();
    });

    it('should throw when logger lacks required methods', async () => {
      const config = createConfig();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(
        () => new CandidatePairFilter({ config, logger: invalidLogger })
      ).toThrow();
    });

    it('should throw when config is missing', async () => {
      const logger = createMockLogger();
      expect(() => new CandidatePairFilter({ config: null, logger })).toThrow();
    });

    it('should throw when config lacks required thresholds', async () => {
      const logger = createMockLogger();
      const incompleteConfig = { activeAxisEpsilon: 0.08 }; // Missing others
      expect(
        () => new CandidatePairFilter({ config: incompleteConfig, logger })
      ).toThrow();
    });

    it('should log error when config threshold is invalid', async () => {
      const logger = createMockLogger();
      const invalidConfig = {
        activeAxisEpsilon: 'not a number',
        candidateMinActiveAxisOverlap: 0.6,
        candidateMinSignAgreement: 0.8,
        candidateMinCosineSimilarity: 0.85,
      };
      expect(
        () => new CandidatePairFilter({ config: invalidConfig, logger })
      ).toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Active Axis Extraction', () => {
    it('excludes axes below epsilon from active set', async () => {
      // Set epsilon = 0.1, prototype has weights: {a: 0.05, b: 0.15}
      // Only 'b' should be active
      const { filter } = createFilter({ activeAxisEpsilon: 0.1 });
      const p1 = createPrototype('p1', { a: 0.05, b: 0.15, c: 0.2 });
      const p2 = createPrototype('p2', { a: 0.05, b: 0.15, c: 0.2 }); // Identical

      const result = await await filter.filterCandidates([p1, p2]);

      // Should produce a candidate pair (identical prototypes)
      expect(result.candidates).toHaveLength(1);
      // Metrics should reflect that 'a' (below 0.1) is excluded from active set
      // Both have same active axes {b, c}, so Jaccard = 1.0
      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
    });

    it('includes axes at or above epsilon boundary', async () => {
      // epsilon = 0.1, weight = 0.1 should be included
      const { filter } = createFilter({ activeAxisEpsilon: 0.1 });
      const p1 = createPrototype('p1', { a: 0.1, b: 0.2 }); // 'a' is exactly at boundary
      const p2 = createPrototype('p2', { a: 0.1, b: 0.2 });

      const result = await await filter.filterCandidates([p1, p2]);

      // Both active sets: {a, b}, Jaccard = 1.0
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
    });

    it('handles negative weights correctly (absolute value >= epsilon)', async () => {
      const { filter } = createFilter({ activeAxisEpsilon: 0.1 });
      const p1 = createPrototype('p1', { a: -0.15, b: 0.2 });
      const p2 = createPrototype('p2', { a: -0.15, b: 0.2 });

      const result = await await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
    });
  });

  describe('Sign Agreement', () => {
    it('computes sign agreement only for shared active axes', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0, // Allow all through for testing
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      // p1 active: {a, b}, p2 active: {b, c}
      // Shared: {b}, both have b = +0.2 => sign agreement = 1.0
      const p1 = createPrototype('p1', { a: 0.2, b: 0.2 });
      const p2 = createPrototype('p2', { b: 0.2, c: 0.2 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(1);
    });

    it('returns 0 sign agreement when no shared axes', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0, // Allow through
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      // p1 active: {a}, p2 active: {b} - no overlap
      const p1 = createPrototype('p1', { a: 0.2 });
      const p2 = createPrototype('p2', { b: 0.2 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0);
    });

    it('computes correct ratio for mixed sign agreement', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      // Shared axes: {a, b, c, d}
      // a: both positive (match), b: both negative (match)
      // c: opposite signs (no match), d: both positive (match)
      // Sign agreement = 3/4 = 0.75
      const p1 = createPrototype('p1', { a: 0.2, b: -0.2, c: 0.2, d: 0.2 });
      const p2 = createPrototype('p2', { a: 0.2, b: -0.2, c: -0.2, d: 0.2 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0.75);
    });
  });

  describe('Sign Agreement - Soft Sign', () => {
    it('treats near-zero weights as neutral (soft sign)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.08,
        softSignThreshold: 0.15,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { valence: 0.09 });
      const p2 = createPrototype('p2', { valence: -0.09 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(1);
    });

    it('hard sign disagrees for weights opposite and above softSignThreshold', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.08,
        softSignThreshold: 0.15,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { valence: 0.5 });
      const p2 = createPrototype('p2', { valence: -0.5 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0);
    });

    it('soft sign treats zero as neutral', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.0,
        softSignThreshold: 0.15,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { valence: 0 });
      const p2 = createPrototype('p2', { valence: 0.1 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(1);
    });

    it('mixed soft and hard signs are evaluated correctly', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.08,
        softSignThreshold: 0.15,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', {
        valence: 0.8,
        arousal: 0.6,
        dominance: -0.5,
        novelty: 0.1,
      });
      const p2 = createPrototype('p2', {
        valence: -0.7,
        arousal: 0.4,
        dominance: -0.3,
        novelty: 0.5,
      });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.signAgreement).toBeCloseTo(
        0.5,
        5
      );
    });

    it('backward compatible when softSignThreshold is 0', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.08,
        softSignThreshold: 0,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { valence: 0.09 });
      const p2 = createPrototype('p2', { valence: -0.09 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0);
    });
  });

  describe('Jaccard - Empty Set Handling', () => {
    it('returns configured value for Jaccard(empty, empty)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        jaccardEmptySetValue: 1.0,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.01 });
      const p2 = createPrototype('p2', { a: 0.02 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
    });

    it('respects legacy behavior when jaccardEmptySetValue is 0', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        jaccardEmptySetValue: 0.0,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.01 });
      const p2 = createPrototype('p2', { a: 0.02 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(0);
    });
  });

  describe('Cosine Similarity', () => {
    it('returns ~1 for identical weight vectors', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5, b: 0.3, c: -0.2 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3, c: -0.2 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        1.0,
        5
      );
    });

    it('returns ~0 for orthogonal weight vectors', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.0,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      // Orthogonal vectors: dot product = 0
      // p1 = (1, 0), p2 = (0, 1) in 2D
      const p1 = createPrototype('p1', { a: 1.0, b: 0.0 });
      const p2 = createPrototype('p2', { a: 0.0, b: 1.0 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        0.0,
        5
      );
    });

    it('returns ~-1 for opposite weight vectors', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5, b: 0.3, c: -0.2 });
      const p2 = createPrototype('p2', { a: -0.5, b: -0.3, c: 0.2 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        -1.0,
        5
      );
    });

    it('handles vectors with different axis sets (missing treated as 0)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.0,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      // p1 = (0.6, 0.8, 0), p2 = (0.6, 0.8, 0.5)
      // dot = 0.36 + 0.64 + 0 = 1.0
      // |p1| = 1.0, |p2| = sqrt(0.36 + 0.64 + 0.25) = sqrt(1.25)
      // cosine = 1.0 / (1.0 * sqrt(1.25)) = 1/sqrt(1.25)
      const p1 = createPrototype('p1', { a: 0.6, b: 0.8 });
      const p2 = createPrototype('p2', { a: 0.6, b: 0.8, c: 0.5 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      const expected = 1.0 / Math.sqrt(1.25);
      expect(result.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        expected,
        5
      );
    });
  });

  describe('Candidate Gating', () => {
    let lowOverlapPair;
    let highOverlapPair;

    beforeEach(() => {
      // Low overlap pair: different axes
      lowOverlapPair = {
        p1: createPrototype('p1', { a: 0.5, b: 0.3 }),
        p2: createPrototype('p2', { c: 0.5, d: 0.3 }),
      };
      // High overlap pair: nearly identical
      highOverlapPair = {
        p1: createPrototype('p3', { a: 0.5, b: 0.3, c: 0.2 }),
        p2: createPrototype('p4', { a: 0.5, b: 0.3, c: 0.2 }),
      };
    });

    it('filters out pairs below activeAxisOverlap threshold', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.9, // Very high threshold
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      // Low overlap pair has Jaccard = 0 (no shared axes)
      const result = await filter.filterCandidates([
        lowOverlapPair.p1,
        lowOverlapPair.p2,
      ]);

      expect(result.candidates).toHaveLength(0);
    });

    it('filters out pairs below signAgreement threshold', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.9, // High threshold
        candidateMinCosineSimilarity: -1.0,
      });

      // Create pair with opposite signs on all shared axes
      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: -0.5, b: -0.3 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(0);
    });

    it('filters out pairs below cosineSimilarity threshold', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: 0.95, // Very high threshold
      });

      // Orthogonal vectors have cosine = 0
      const p1 = createPrototype('p1', { a: 1.0 });
      const p2 = createPrototype('p2', { b: 1.0 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(0);
    });

    it('passes pairs meeting all thresholds', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.6,
        candidateMinSignAgreement: 0.8,
        candidateMinCosineSimilarity: 0.85,
      });

      // Identical prototypes pass all thresholds
      const result = await filter.filterCandidates([
        highOverlapPair.p1,
        highOverlapPair.p2,
      ]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(1);
      expect(result.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        1.0,
        5
      );
    });

    it('correctly gates based on exact threshold values', async () => {
      // Test boundary condition: metric exactly equals threshold
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.5, // Threshold
        candidateMinSignAgreement: 0.5,
        candidateMinCosineSimilarity: 0.0,
      });

      // Create pair with exactly 0.5 Jaccard overlap
      // {a, b} vs {b, c} => intersection {b}, union {a, b, c} => 1/3 = 0.333
      // Need {a, b} vs {a, c} => intersection {a}, union {a, b, c} => 1/3 still
      // Try {a, b} vs {a, b, c, d} => intersection {a, b}, union {a, b, c, d} => 2/4 = 0.5
      const p1 = createPrototype('p1', { a: 0.2, b: 0.2 });
      const p2 = createPrototype('p2', { a: 0.2, b: 0.2, c: 0.2, d: 0.2 });

      const result = await filter.filterCandidates([p1, p2]);

      // Should pass because >= 0.5
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(0.5);
    });
  });

  describe('Symmetry & Deduplication', () => {
    it('produces symmetric metrics for (A,B) and (B,A)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5, b: 0.3, c: -0.2 });
      const p2 = createPrototype('p2', { a: 0.4, b: -0.2, c: 0.1, d: 0.3 });

      // Run twice with reversed order
      const result1 = await filter.filterCandidates([p1, p2]);
      const result2 = await filter.filterCandidates([p2, p1]);

      // Metrics should be identical
      expect(result1.candidates[0].candidateMetrics.activeAxisOverlap).toBe(
        result2.candidates[0].candidateMetrics.activeAxisOverlap
      );
      expect(result1.candidates[0].candidateMetrics.signAgreement).toBe(
        result2.candidates[0].candidateMetrics.signAgreement
      );
      expect(result1.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        result2.candidates[0].candidateMetrics.weightCosineSimilarity,
        10
      );
    });

    it('returns only one of (A,B) or (B,A), not both', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { a: 0.5 });
      const p3 = createPrototype('p3', { a: 0.5 });

      // 3 prototypes => 3 unique pairs: (p1,p2), (p1,p3), (p2,p3)
      const result = await filter.filterCandidates([p1, p2, p3]);

      expect(result.candidates).toHaveLength(3);

      // Verify no duplicate pairs
      const pairIds = result.candidates.map(
        (r) => `${r.prototypeA.id}-${r.prototypeB.id}`
      );
      const uniquePairIds = new Set(pairIds);
      expect(uniquePairIds.size).toBe(3);
    });

    it('excludes self-pairs (A,A)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });

      // Single prototype cannot form a pair
      const result = await filter.filterCandidates([p1]);

      expect(result.candidates).toHaveLength(0);
    });

    it('includes prototype references in result', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { a: 0.5 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates[0].prototypeA).toBe(p1);
      expect(result.candidates[0].prototypeB).toBe(p2);
    });
  });

  describe('Edge Cases', () => {
    it('returns empty array for empty prototype array', async () => {
      const { filter, logger } = createFilter();

      const result = await filter.filterCandidates([]);

      expect(result.candidates).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Fewer than 2 valid prototypes')
      );
    });

    it('returns empty array for single prototype', async () => {
      const { filter, logger } = createFilter();

      const p1 = createPrototype('p1', { a: 0.5 });
      const result = await filter.filterCandidates([p1]);

      expect(result.candidates).toEqual([]);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('returns empty array for null input', async () => {
      const { filter, logger } = createFilter();

      const result = await filter.filterCandidates(null);

      expect(result.candidates).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid input')
      );
    });

    it('returns empty array for undefined input', async () => {
      const { filter, logger } = createFilter();

      const result = await filter.filterCandidates(undefined);

      expect(result.candidates).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('returns empty array for non-array input', async () => {
      const { filter, logger } = createFilter();

      const result = await filter.filterCandidates('not an array');

      expect(result.candidates).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('filters out prototypes with no weights property', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = { id: 'p2' }; // No weights
      const p3 = createPrototype('p3', { a: 0.5 });

      const result = await filter.filterCandidates([p1, p2, p3]);

      // Only p1-p3 pair should form
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].prototypeA.id).toBe('p1');
      expect(result.candidates[0].prototypeB.id).toBe('p3');
    });

    it('filters out prototypes with invalid weights (non-object)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = { id: 'p2', weights: 'invalid' };
      const p3 = createPrototype('p3', { a: 0.5 });

      const result = await filter.filterCandidates([p1, p2, p3]);

      expect(result.candidates).toHaveLength(1);
    });

    it('filters out prototypes with empty weights object', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', {}); // Empty weights
      const p3 = createPrototype('p3', { a: 0.5 });

      const result = await filter.filterCandidates([p1, p2, p3]);

      expect(result.candidates).toHaveLength(1);
    });

    it('handles prototypes with non-numeric weight values', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5, b: 'invalid' });
      const p2 = createPrototype('p2', { a: 0.5 });

      const result = await filter.filterCandidates([p1, p2]);

      // Should still work, ignoring non-numeric weights
      expect(result.candidates).toHaveLength(1);
    });

    it('handles zero-weight vectors (all weights below epsilon)', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.01, b: 0.02 }); // All below epsilon
      const p2 = createPrototype('p2', { a: 0.01, b: 0.02 });

      const result = await filter.filterCandidates([p1, p2]);

      // Both have empty active sets, Jaccard of empty sets uses configured value
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].candidateMetrics.activeAxisOverlap).toBe(1);
      expect(result.candidates[0].candidateMetrics.signAgreement).toBe(0);
      // Cosine similarity still computed on full vectors
      expect(result.candidates[0].candidateMetrics.weightCosineSimilarity).toBeCloseTo(
        1.0,
        5
      );
    });

    it('handles null prototype entries in array', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p3 = createPrototype('p3', { a: 0.5 });

      const result = await filter.filterCandidates([p1, null, p3]);

      expect(result.candidates).toHaveLength(1);
    });
  });

  describe('Integration scenarios', () => {
    it('handles typical emotion prototype comparison', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.08,
        candidateMinActiveAxisOverlap: 0.6,
        candidateMinSignAgreement: 0.8,
        candidateMinCosineSimilarity: 0.85,
      });

      // Similar emotions (joy and contentment) - should be candidates
      const joy = createPrototype('joy', {
        valence: 0.8,
        arousal: 0.5,
        dominance: 0.3,
        novelty: 0.2,
      });
      const contentment = createPrototype('contentment', {
        valence: 0.7,
        arousal: 0.3,
        dominance: 0.2,
        novelty: 0.2,
      });

      // Different emotion (anger) - should not match joy/contentment
      const anger = createPrototype('anger', {
        valence: -0.7,
        arousal: 0.8,
        dominance: 0.6,
        novelty: 0.3,
      });

      const result = await filter.filterCandidates([joy, contentment, anger]);

      // Joy and contentment should be candidates (similar positive emotions)
      // Anger should not match either due to opposite valence sign
      const joyContentmentPair = result.candidates.find(
        (r) =>
          (r.prototypeA.id === 'joy' && r.prototypeB.id === 'contentment') ||
          (r.prototypeA.id === 'contentment' && r.prototypeB.id === 'joy')
      );
      expect(joyContentmentPair).toBeDefined();

      // Anger pairs should be filtered out due to sign disagreement
      const angerPairs = result.candidates.filter(
        (r) => r.prototypeA.id === 'anger' || r.prototypeB.id === 'anger'
      );
      expect(angerPairs).toHaveLength(0);
    });

    it('produces summary debug log', async () => {
      const { filter, logger } = createFilter();

      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });
      const p3 = createPrototype('p3', { c: 0.5, d: 0.3 }); // Different

      await filter.filterCandidates([p1, p2, p3]);

      // Verify debug log mentions Route A results
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Route A')
      );
    });
  });

  describe('Metric range invariants', () => {
    it('activeAxisOverlap is always in [0, 1]', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.0,
      });

      const testCases = [
        // Identical
        [
          createPrototype('a', { x: 0.5 }),
          createPrototype('b', { x: 0.5 }),
        ],
        // Disjoint
        [
          createPrototype('a', { x: 0.5 }),
          createPrototype('b', { y: 0.5 }),
        ],
        // Partial overlap
        [
          createPrototype('a', { x: 0.5, y: 0.3 }),
          createPrototype('b', { y: 0.5, z: 0.3 }),
        ],
      ];

      for (const [p1, p2] of testCases) {
        const result = await filter.filterCandidates([p1, p2]);
        const overlap = result.candidates[0].candidateMetrics.activeAxisOverlap;
        expect(overlap).toBeGreaterThanOrEqual(0);
        expect(overlap).toBeLessThanOrEqual(1);
      }
    });

    it('signAgreement is always in [0, 1]', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0, // Allow all through
        candidateMinCosineSimilarity: -1.1, // Allow negative cosine through
      });

      const testCases = [
        // All matching signs
        [
          createPrototype('a', { x: 0.5, y: 0.3 }),
          createPrototype('b', { x: 0.5, y: 0.3 }),
        ],
        // All opposite signs
        [
          createPrototype('a', { x: 0.5, y: 0.3 }),
          createPrototype('b', { x: -0.5, y: -0.3 }),
        ],
        // Mixed
        [
          createPrototype('a', { x: 0.5, y: 0.3, z: -0.2 }),
          createPrototype('b', { x: 0.5, y: -0.3, z: 0.2 }),
        ],
      ];

      for (const [p1, p2] of testCases) {
        const result = await filter.filterCandidates([p1, p2]);
        expect(result.candidates).toHaveLength(1);
        const signAgreement = result.candidates[0].candidateMetrics.signAgreement;
        expect(signAgreement).toBeGreaterThanOrEqual(0);
        expect(signAgreement).toBeLessThanOrEqual(1);
      }
    });

    it('weightCosineSimilarity is always in [-1, 1]', async () => {
      const { filter } = createFilter({
        activeAxisEpsilon: 0.1,
        candidateMinActiveAxisOverlap: 0.0,
        candidateMinSignAgreement: 0.0,
        candidateMinCosineSimilarity: -1.1, // Allow all through including negative
      });

      const testCases = [
        // Identical (cosine = 1)
        [
          createPrototype('a', { x: 0.5, y: 0.3 }),
          createPrototype('b', { x: 0.5, y: 0.3 }),
        ],
        // Opposite (cosine = -1)
        [
          createPrototype('a', { x: 0.5, y: 0.3 }),
          createPrototype('b', { x: -0.5, y: -0.3 }),
        ],
        // Orthogonal (cosine = 0)
        [
          createPrototype('a', { x: 1.0 }),
          createPrototype('b', { y: 1.0 }),
        ],
        // Random
        [
          createPrototype('a', { x: 0.3, y: -0.7, z: 0.1 }),
          createPrototype('b', { x: 0.5, y: 0.2, z: -0.8 }),
        ],
      ];

      for (const [p1, p2] of testCases) {
        const result = await filter.filterCandidates([p1, p2]);
        expect(result.candidates).toHaveLength(1);
        const cosine = result.candidates[0].candidateMetrics.weightCosineSimilarity;
        // Use tolerance for floating point comparison
        expect(cosine).toBeGreaterThanOrEqual(-1 - 1e-10);
        expect(cosine).toBeLessThanOrEqual(1 + 1e-10);
      }
    });
  });

  describe('Multi-Route Filtering (v2.1)', () => {
    /**
     * Create a mock GateSimilarityFilter.
     *
     * @param {Array} candidates - Candidates to return
     * @returns {object} Mock filter
     */
    const createMockGateSimilarityFilter = (candidates = []) => ({
      filterPairs: jest.fn().mockReturnValue({
        candidates,
        stats: {
          passed: candidates.length,
          rejected: 0,
          byImplication: 0,
          byOverlap: candidates.length,
        },
      }),
    });

    /**
     * Create a mock BehavioralPrescanFilter.
     *
     * @param {Array} candidates - Candidates to return
     * @returns {object} Mock filter
     */
    const createMockBehavioralPrescanFilter = (candidates = []) => ({
      filterPairs: jest.fn().mockReturnValue({
        candidates,
        stats: {
          passed: candidates.length,
          rejected: 0,
          skipped: 0,
        },
      }),
    });

    /**
     * Create filter with multi-route dependencies.
     *
     * @param {object} options - Options
     * @returns {object} Filter and mocks
     */
    const createMultiRouteFilter = (options = {}) => {
      const logger = createMockLogger();
      const config = createConfig({
        enableMultiRouteFiltering: true,
        ...options.configOverrides,
      });
      const gateSimilarityFilter =
        options.gateSimilarityFilter || createMockGateSimilarityFilter();
      const behavioralPrescanFilter =
        options.behavioralPrescanFilter || createMockBehavioralPrescanFilter();

      const filter = new CandidatePairFilter({
        config,
        logger,
        gateSimilarityFilter,
        behavioralPrescanFilter,
      });

      return { filter, logger, gateSimilarityFilter, behavioralPrescanFilter };
    };

    it('should work without optional dependencies (backward compatibility)', async () => {
      const logger = createMockLogger();
      const config = createConfig({ enableMultiRouteFiltering: true });

      // No optional dependencies provided
      const filter = new CandidatePairFilter({ config, logger });

      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });

      const result = await filter.filterCandidates([p1, p2]);

      // Should still work with Route A only
      expect(result.candidates).toHaveLength(1);
    });

    it('should skip multi-route when enableMultiRouteFiltering is false', async () => {
      const { filter, gateSimilarityFilter, behavioralPrescanFilter } =
        createMultiRouteFilter({
          configOverrides: { enableMultiRouteFiltering: false },
        });

      // Create prototypes that pass Route A
      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });

      await filter.filterCandidates([p1, p2]);

      // Route B and C should not be called
      expect(gateSimilarityFilter.filterPairs).not.toHaveBeenCalled();
      expect(behavioralPrescanFilter.filterPairs).not.toHaveBeenCalled();
    });

    it('should call Route B with pairs rejected by Route A', async () => {
      const { filter, gateSimilarityFilter } = createMultiRouteFilter();

      // Create prototypes that fail Route A (different axes)
      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { b: 0.5 });
      const p3 = createPrototype('p3', { c: 0.5 });

      await filter.filterCandidates([p1, p2, p3]);

      // Route B should receive rejected pairs
      expect(gateSimilarityFilter.filterPairs).toHaveBeenCalled();
      const routeBInput = gateSimilarityFilter.filterPairs.mock.calls[0][0];
      expect(routeBInput.length).toBeGreaterThan(0);
    });

    it('should call Route C with pairs rejected by both Routes A and B', async () => {
      const { filter, behavioralPrescanFilter } = createMultiRouteFilter();

      // Create prototypes that fail Route A
      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { b: 0.5 });

      await filter.filterCandidates([p1, p2]);

      // Route C should be called
      expect(behavioralPrescanFilter.filterPairs).toHaveBeenCalled();
    });

    it('should mark Route A candidates with selectedBy: routeA', async () => {
      const { filter } = createMultiRouteFilter();

      // Prototypes that pass Route A
      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });

      const result = await filter.filterCandidates([p1, p2]);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].selectedBy).toBe('routeA');
    });

    it('should include Route B candidates with routeB provenance', async () => {
      const routeBCandidate = {
        prototypeA: createPrototype('rb1', { x: 0.5 }),
        prototypeB: createPrototype('rb2', { y: 0.5 }),
        selectedBy: 'routeB',
        routeMetrics: { reason: 'gate_implication' },
        candidateMetrics: {},
      };

      const { filter } = createMultiRouteFilter({
        gateSimilarityFilter: createMockGateSimilarityFilter([routeBCandidate]),
      });

      // Prototypes that fail Route A
      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { b: 0.5 });

      const result = await filter.filterCandidates([p1, p2, routeBCandidate.prototypeA, routeBCandidate.prototypeB]);

      const routeBCandidates = result.candidates.filter(
        (c) => c.selectedBy === 'routeB'
      );
      expect(routeBCandidates.length).toBeGreaterThanOrEqual(1);
    });

    it('should include Route C candidates with routeC provenance', async () => {
      const routeCCandidate = {
        prototypeA: createPrototype('rc1', { x: 0.5 }),
        prototypeB: createPrototype('rc2', { y: 0.5 }),
        selectedBy: 'routeC',
        routeMetrics: { gateOverlapRatio: 0.7 },
        candidateMetrics: {},
      };

      const { filter } = createMultiRouteFilter({
        gateSimilarityFilter: createMockGateSimilarityFilter([]),
        behavioralPrescanFilter: createMockBehavioralPrescanFilter([routeCCandidate]),
      });

      // Prototypes that fail Route A
      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { b: 0.5 });

      const result = await filter.filterCandidates([p1, p2, routeCCandidate.prototypeA, routeCCandidate.prototypeB]);

      const routeCCandidates = result.candidates.filter(
        (c) => c.selectedBy === 'routeC'
      );
      expect(routeCCandidates.length).toBeGreaterThanOrEqual(1);
    });

    it('should track route-specific stats when multi-route is enabled', async () => {
      const { filter } = createMultiRouteFilter();

      // Mix of prototypes
      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 }); // Will pass Route A with p2
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });
      const p3 = createPrototype('p3', { c: 0.5 }); // Will be rejected by Route A

      const result = await filter.filterCandidates([p1, p2, p3]);

      // Should have routeStats in the result
      expect(result.stats.routeStats).toBeDefined();
      expect(result.stats.routeStats.routeA).toBeDefined();
      expect(result.stats.routeStats.routeA.passed).toBeGreaterThanOrEqual(0);
    });

    it('should deduplicate candidates across routes', async () => {
      // Create a pair that passes both Route A and Route B
      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });

      // Route B also returns this same pair
      const routeBCandidate = {
        prototypeA: p1,
        prototypeB: p2,
        selectedBy: 'routeB',
        routeMetrics: {},
        candidateMetrics: {},
      };

      const { filter } = createMultiRouteFilter({
        gateSimilarityFilter: createMockGateSimilarityFilter([routeBCandidate]),
      });

      const result = await filter.filterCandidates([p1, p2]);

      // Should only have one candidate for this pair (Route A wins)
      const p1p2Candidates = result.candidates.filter(
        (c) =>
          (c.prototypeA.id === 'p1' && c.prototypeB.id === 'p2') ||
          (c.prototypeA.id === 'p2' && c.prototypeB.id === 'p1')
      );
      expect(p1p2Candidates).toHaveLength(1);
      // Route A should have priority
      expect(p1p2Candidates[0].selectedBy).toBe('routeA');
    });

    it('should handle case where Route B filter is null', async () => {
      const logger = createMockLogger();
      const config = createConfig({ enableMultiRouteFiltering: true });

      const filter = new CandidatePairFilter({
        config,
        logger,
        gateSimilarityFilter: null,
        behavioralPrescanFilter: createMockBehavioralPrescanFilter(),
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { b: 0.5 });

      // Should not throw
      const result = await filter.filterCandidates([p1, p2]);
      expect(result).toBeDefined();
    });

    it('should handle case where Route C filter is null', async () => {
      const logger = createMockLogger();
      const config = createConfig({ enableMultiRouteFiltering: true });

      const filter = new CandidatePairFilter({
        config,
        logger,
        gateSimilarityFilter: createMockGateSimilarityFilter(),
        behavioralPrescanFilter: null,
      });

      const p1 = createPrototype('p1', { a: 0.5 });
      const p2 = createPrototype('p2', { b: 0.5 });

      // Should not throw
      const result = await filter.filterCandidates([p1, p2]);
      expect(result).toBeDefined();
    });

    it('should merge candidates from all routes correctly', async () => {
      // Route A passes p1-p2
      const p1 = createPrototype('p1', { a: 0.5, b: 0.3 });
      const p2 = createPrototype('p2', { a: 0.5, b: 0.3 });

      // Route B finds p3-p4
      const p3 = createPrototype('p3', { x: 0.5 });
      const p4 = createPrototype('p4', { y: 0.5 });
      const routeBCandidate = {
        prototypeA: p3,
        prototypeB: p4,
        selectedBy: 'routeB',
        routeMetrics: { reason: 'gate_overlap' },
        candidateMetrics: {},
      };

      // Route C finds p5-p6
      const p5 = createPrototype('p5', { m: 0.5 });
      const p6 = createPrototype('p6', { n: 0.5 });
      const routeCCandidate = {
        prototypeA: p5,
        prototypeB: p6,
        selectedBy: 'routeC',
        routeMetrics: { gateOverlapRatio: 0.6 },
        candidateMetrics: {},
      };

      const { filter } = createMultiRouteFilter({
        gateSimilarityFilter: createMockGateSimilarityFilter([routeBCandidate]),
        behavioralPrescanFilter: createMockBehavioralPrescanFilter([routeCCandidate]),
      });

      const result = await filter.filterCandidates([p1, p2, p3, p4, p5, p6]);

      // Should have candidates from all routes
      const routeACount = result.candidates.filter((c) => c.selectedBy === 'routeA').length;
      const routeBCount = result.candidates.filter((c) => c.selectedBy === 'routeB').length;
      const routeCCount = result.candidates.filter((c) => c.selectedBy === 'routeC').length;

      expect(routeACount).toBeGreaterThanOrEqual(1);
      expect(routeBCount).toBeGreaterThanOrEqual(1);
      expect(routeCCount).toBeGreaterThanOrEqual(1);
    });
  });
});
