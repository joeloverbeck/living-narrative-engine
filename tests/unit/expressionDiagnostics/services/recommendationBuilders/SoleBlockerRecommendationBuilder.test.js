/**
 * @file Unit tests for SoleBlockerRecommendationBuilder
 * Tests the extraction of sole-blocker recommendation logic from RecommendationEngine.
 */

import { describe, it, expect } from '@jest/globals';
import SoleBlockerRecommendationBuilder, {
  SOLE_BLOCKER_MIN_RATE,
  SOLE_BLOCKER_MIN_SAMPLES,
} from '../../../../../src/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.js';

describe('SoleBlockerRecommendationBuilder', () => {
  /**
   * Create a builder instance for testing.
   * @returns {SoleBlockerRecommendationBuilder}
   */
  const createBuilder = () => new SoleBlockerRecommendationBuilder();

  /**
   * Create base clause with valid sole-blocker facts.
   * @param {object} [overrides] - Override specific properties
   * @returns {object} Clause with sole-blocker data
   */
  const createValidClause = (overrides = {}) => ({
    clauseId: 'var:emotions.joy:>=:0.6',
    clauseLabel: 'emotions.joy >= 0.6',
    impact: 0.5,
    operator: '>=',
    thresholdValue: 0.6,
    lastMileFailRate: 0.25, // Above MIN_RATE (0.1)
    soleBlockerSampleCount: 250, // Above MIN_SAMPLES (10)
    soleBlockerP50: 0.45,
    soleBlockerP90: 0.55,
    ...overrides,
  });

  describe('exported constants', () => {
    it('should export SOLE_BLOCKER_MIN_RATE as 0.1', () => {
      expect(SOLE_BLOCKER_MIN_RATE).toBe(0.1);
    });

    it('should export SOLE_BLOCKER_MIN_SAMPLES as 10', () => {
      expect(SOLE_BLOCKER_MIN_SAMPLES).toBe(10);
    });
  });

  describe('build() - null returns', () => {
    it('should return null when clause is null', () => {
      const builder = createBuilder();
      expect(builder.build(null)).toBeNull();
    });

    it('should return null when clause is undefined', () => {
      const builder = createBuilder();
      expect(builder.build(undefined)).toBeNull();
    });

    it('should return null when lastMileFailRate is missing', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: undefined });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when lastMileFailRate is not a number', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: 'invalid' });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when lastMileFailRate is below MIN_RATE', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: 0.05 }); // Below 0.1
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null at exactly MIN_RATE boundary (exclusive)', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: 0.09999 });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when soleBlockerSampleCount is below MIN_SAMPLES', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 5 }); // Below 10
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when soleBlockerSampleCount is missing (defaults to 0)', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: undefined });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when soleBlockerP50 is missing', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP50: undefined });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when soleBlockerP50 is not a number', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP50: 'invalid' });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when thresholdValue is missing', () => {
      const builder = createBuilder();
      const clause = createValidClause({ thresholdValue: undefined });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when thresholdValue is not a number', () => {
      const builder = createBuilder();
      const clause = createValidClause({ thresholdValue: 'invalid' });
      expect(builder.build(clause)).toBeNull();
    });
  });

  describe('build() - valid recommendations', () => {
    it('should return valid recommendation with all required fields', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      const result = builder.build(clause);

      expect(result).not.toBeNull();
      expect(result.id).toBe('sole_blocker_edit:var:emotions.joy:>=:0.6');
      expect(result.type).toBe('sole_blocker_edit');
      expect(result.severity).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.why).toBeDefined();
      expect(result.evidence).toBeInstanceOf(Array);
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.predictedEffect).toBeDefined();
      expect(result.relatedClauseIds).toEqual(['var:emotions.joy:>=:0.6']);
      expect(result.thresholdSuggestions).toBeInstanceOf(Array);
    });

    it('should include clauseId in id field', () => {
      const builder = createBuilder();
      const clause = createValidClause({ clauseId: 'custom:test:id' });
      const result = builder.build(clause);

      expect(result.id).toBe('sole_blocker_edit:custom:test:id');
    });

    it('should use "unknown" when clauseId is missing', () => {
      const builder = createBuilder();
      const clause = createValidClause({ clauseId: undefined });
      const result = builder.build(clause);

      expect(result.id).toBe('sole_blocker_edit:unknown');
      expect(result.relatedClauseIds).toEqual([]);
    });
  });

  describe('build() - direction logic', () => {
    it('should set direction to "lower" for >= operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '>=' });
      const result = builder.build(clause);

      expect(result.title).toContain('Lower');
      expect(result.thresholdSuggestions[0].direction).toBe('lower');
    });

    it('should set direction to "lower" for > operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '>' });
      const result = builder.build(clause);

      expect(result.title).toContain('Lower');
      expect(result.thresholdSuggestions[0].direction).toBe('lower');
    });

    it('should set direction to "raise" for <= operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '<=' });
      const result = builder.build(clause);

      expect(result.title).toContain('Raise');
      expect(result.thresholdSuggestions[0].direction).toBe('raise');
    });

    it('should set direction to "raise" for < operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '<' });
      const result = builder.build(clause);

      expect(result.title).toContain('Raise');
      expect(result.thresholdSuggestions[0].direction).toBe('raise');
    });

    it('should set direction to "raise" for == operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '==' });
      const result = builder.build(clause);

      expect(result.title).toContain('Raise');
      expect(result.thresholdSuggestions[0].direction).toBe('raise');
    });
  });

  describe('build() - threshold suggestions', () => {
    it('should include P50 suggestion with correct values', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP50: 0.42 });
      const result = builder.build(clause);

      const p50Suggestion = result.thresholdSuggestions.find(
        (s) => s.percentile === 'P50'
      );
      expect(p50Suggestion).toBeDefined();
      expect(p50Suggestion.targetPassRate).toBe(0.5);
      expect(p50Suggestion.suggestedThreshold).toBe(0.42);
    });

    it('should include P90 suggestion when available', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP90: 0.58 });
      const result = builder.build(clause);

      const p90Suggestion = result.thresholdSuggestions.find(
        (s) => s.percentile === 'P90'
      );
      expect(p90Suggestion).toBeDefined();
      expect(p90Suggestion.targetPassRate).toBe(0.9);
      expect(p90Suggestion.suggestedThreshold).toBe(0.58);
    });

    it('should work with only P50 (P90 undefined)', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP90: undefined });
      const result = builder.build(clause);

      expect(result.thresholdSuggestions).toHaveLength(1);
      expect(result.thresholdSuggestions[0].percentile).toBe('P50');
    });

    it('should include both P50 and P90 suggestions when both available', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      const result = builder.build(clause);

      expect(result.thresholdSuggestions).toHaveLength(2);
      const percentiles = result.thresholdSuggestions.map((s) => s.percentile);
      expect(percentiles).toContain('P50');
      expect(percentiles).toContain('P90');
    });
  });

  describe('build() - confidence levels', () => {
    it('should return "low" confidence for samples < 200', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 50 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('low');
      expect(result.why).toContain('Low confidence');
    });

    it('should return "medium" confidence for samples 200-499', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 300 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('medium');
      expect(result.why).not.toContain('Low confidence');
    });

    it('should return "high" confidence for samples >= 500', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 600 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('high');
      expect(result.why).not.toContain('Low confidence');
    });

    it('should return "low" confidence at boundary 199', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 199 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('low');
    });

    it('should return "medium" confidence at boundary 200', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 200 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('medium');
    });

    it('should return "medium" confidence at boundary 499', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 499 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('medium');
    });

    it('should return "high" confidence at boundary 500', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 500 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('high');
    });
  });

  describe('build() - severity levels', () => {
    it('should return "high" severity for impact >= 0.2', () => {
      const builder = createBuilder();
      const clause = createValidClause({ impact: 0.25 });
      const result = builder.build(clause);

      expect(result.severity).toBe('high');
    });

    it('should return "medium" severity for impact 0.1-0.2', () => {
      const builder = createBuilder();
      const clause = createValidClause({ impact: 0.15 });
      const result = builder.build(clause);

      expect(result.severity).toBe('medium');
    });

    it('should return "low" severity for impact < 0.1', () => {
      const builder = createBuilder();
      const clause = createValidClause({ impact: 0.05 });
      const result = builder.build(clause);

      expect(result.severity).toBe('low');
    });

    it('should default to 0 impact when not a number', () => {
      const builder = createBuilder();
      const clause = createValidClause({ impact: 'invalid' });
      const result = builder.build(clause);

      expect(result.severity).toBe('low');
    });

    it('should default to 0 impact when missing', () => {
      const builder = createBuilder();
      const clause = createValidClause({ impact: undefined });
      const result = builder.build(clause);

      expect(result.severity).toBe('low');
    });
  });

  describe('build() - evidence structure', () => {
    it('should include current threshold in evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause({ thresholdValue: 0.65 });
      const result = builder.build(clause);

      const thresholdEvidence = result.evidence.find(
        (e) => e.label === 'Current threshold'
      );
      expect(thresholdEvidence).toBeDefined();
      expect(thresholdEvidence.value).toBe('0.65');
    });

    it('should include sole-blocker rate in evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: 0.35 });
      const result = builder.build(clause);

      const rateEvidence = result.evidence.find(
        (e) => e.label === 'Sole-blocker rate'
      );
      expect(rateEvidence).toBeDefined();
      expect(rateEvidence.value).toBe('35%');
    });

    it('should include sample count in evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 123 });
      const result = builder.build(clause);

      const countEvidence = result.evidence.find(
        (e) => e.label === 'Sample count'
      );
      expect(countEvidence).toBeDefined();
      expect(countEvidence.value).toBe('123');
    });

    it('should include P50 percentile in evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP50: 0.333 });
      const result = builder.build(clause);

      const p50Evidence = result.evidence.find(
        (e) => e.label === 'P50 (50% pass)'
      );
      expect(p50Evidence).toBeDefined();
      expect(p50Evidence.value).toBe('0.33');
    });

    it('should include P90 percentile in evidence when available', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP90: 0.666 });
      const result = builder.build(clause);

      const p90Evidence = result.evidence.find(
        (e) => e.label === 'P90 (90% pass)'
      );
      expect(p90Evidence).toBeDefined();
      expect(p90Evidence.value).toBe('0.67');
    });

    it('should not include P90 evidence when P90 is undefined', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP90: undefined });
      const result = builder.build(clause);

      const p90Evidence = result.evidence.find(
        (e) => e.label === 'P90 (90% pass)'
      );
      expect(p90Evidence).toBeUndefined();
    });
  });

  describe('build() - actions structure', () => {
    it('should build actions from threshold suggestions', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      const result = builder.build(clause);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toHaveProperty('label');
      expect(result.actions[0]).toHaveProperty('detail');
    });

    it('should format P50 action with correct pass rate', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP50: 0.42 });
      const result = builder.build(clause);

      const p50Action = result.actions.find((a) => a.detail.includes('P50'));
      expect(p50Action).toBeDefined();
      expect(p50Action.detail).toContain('50%');
    });

    it('should format P90 action with correct pass rate', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerP90: 0.58 });
      const result = builder.build(clause);

      const p90Action = result.actions.find((a) => a.detail.includes('P90'));
      expect(p90Action).toBeDefined();
      expect(p90Action.detail).toContain('90%');
    });

    it('should use "Lower" in action label for >= operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '>=' });
      const result = builder.build(clause);

      expect(result.actions[0].label).toContain('Lower');
    });

    it('should use "Raise" in action label for <= operator', () => {
      const builder = createBuilder();
      const clause = createValidClause({ operator: '<=' });
      const result = builder.build(clause);

      expect(result.actions[0].label).toContain('Raise');
    });
  });

  describe('build() - title format', () => {
    it('should include clauseLabel in title', () => {
      const builder = createBuilder();
      const clause = createValidClause({ clauseLabel: 'test label' });
      const result = builder.build(clause);

      expect(result.title).toContain('test label');
    });

    it('should use "this clause" when clauseLabel is missing', () => {
      const builder = createBuilder();
      const clause = createValidClause({ clauseLabel: undefined });
      const result = builder.build(clause);

      expect(result.title).toContain('this clause');
    });

    it('should include "Best First Edit:" prefix', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      const result = builder.build(clause);

      expect(result.title).toStartWith('Best First Edit:');
    });
  });

  describe('build() - why explanation', () => {
    it('should include the fail rate percentage', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: 0.35 });
      const result = builder.build(clause);

      expect(result.why).toContain('35%');
    });

    it('should include sample count', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 123 });
      const result = builder.build(clause);

      expect(result.why).toContain('123');
    });

    it('should mention "decisive blocker"', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      const result = builder.build(clause);

      expect(result.why).toContain('decisive blocker');
    });
  });

  describe('build() - edge cases', () => {
    it('should emit at exactly MIN_RATE boundary (inclusive)', () => {
      const builder = createBuilder();
      const clause = createValidClause({ lastMileFailRate: 0.1 });
      const result = builder.build(clause);

      expect(result).not.toBeNull();
    });

    it('should emit at exactly MIN_SAMPLES boundary (inclusive)', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 10 });
      const result = builder.build(clause);

      expect(result).not.toBeNull();
    });

    it('should handle zero values correctly (below threshold)', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        soleBlockerP50: 0.0,
        soleBlockerP90: 0.0,
      });
      const result = builder.build(clause);

      expect(result.thresholdSuggestions[0].suggestedThreshold).toBe(0);
    });

    it('should handle negative percentile values', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        soleBlockerP50: -0.5,
        soleBlockerP90: -0.1,
      });
      const result = builder.build(clause);

      expect(result.thresholdSuggestions[0].suggestedThreshold).toBe(-0.5);
    });

    it('should handle very large sample counts', () => {
      const builder = createBuilder();
      const clause = createValidClause({ soleBlockerSampleCount: 1000000 });
      const result = builder.build(clause);

      expect(result.confidence).toBe('high');
    });
  });

  describe('determinism', () => {
    it('should produce identical output for identical input', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result1 = builder.build(clause);
      const result2 = builder.build(clause);

      expect(result1).toEqual(result2);
    });

    it('should produce identical output with different builder instances', () => {
      const builder1 = createBuilder();
      const builder2 = createBuilder();
      const clause = createValidClause();

      const result1 = builder1.build(clause);
      const result2 = builder2.build(clause);

      expect(result1).toEqual(result2);
    });
  });
});
