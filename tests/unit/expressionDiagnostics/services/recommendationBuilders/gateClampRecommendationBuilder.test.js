/**
 * @file Unit tests for GateClampRecommendationBuilder
 * Tests the extraction of gate clamp recommendation logic from RecommendationEngine.
 */

import { describe, it, expect } from '@jest/globals';
import GateClampRecommendationBuilder, {
  GATE_CLAMP_MIN_RATE,
  GATE_CLAMP_MIN_KEEP,
  GATE_CLAMP_MIN_DELTA,
} from '../../../../../src/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.js';

describe('GateClampRecommendationBuilder', () => {
  /**
   * Create a builder instance for testing.
   * @returns {GateClampRecommendationBuilder}
   */
  const createBuilder = () => new GateClampRecommendationBuilder();

  /**
   * Create base clause with valid gate clamp facts.
   * @param {object} [overrides] - Override specific properties
   * @returns {object} Clause with gateClampRegimePermissive data
   */
  const createValidClause = (overrides = {}) => ({
    clauseId: 'var:emotions.joy:>=:0.6',
    clauseLabel: 'emotions.joy >= 0.6',
    impact: 0.5,
    gateClampRegimePermissive: {
      moodRegimeCount: 200,
      gatePassInRegimeCount: 140,
      gateFailInRegimeCount: 60,
      gateClampRateInRegime: 0.3, // Above MIN_RATE (0.2)
      allGatesImplied: false,
      gatePredicates: [
        {
          axis: 'valence',
          operator: '>=',
          thresholdRaw: 20,
          impliedByRegime: false,
          regimeBounds: { min: -100, max: 100 },
        },
      ],
      axisEvidence: [
        {
          axis: 'valence',
          operator: '>=',
          thresholdRaw: 20,
          fractionBelow: { count: 60, denominator: 200, rate: 0.3 },
          fractionAbove: { count: 100, denominator: 200, rate: 0.5 },
        },
      ],
      candidates: [
        {
          id: 'hard:valence:>=:20',
          kind: 'hard',
          axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
          keepRatio: 0.7, // Above MIN_KEEP (0.5)
          keepCount: 140,
          keepDenominator: 200,
          predClampRate: 0.1, // delta = 0.3 - 0.1 = 0.2 > MIN_DELTA (0.1)
          predSampleCount: 140,
          predPassRate: 0.9,
        },
      ],
      ...overrides,
    },
  });

  describe('exported constants', () => {
    it('should export GATE_CLAMP_MIN_RATE as 0.2', () => {
      expect(GATE_CLAMP_MIN_RATE).toBe(0.2);
    });

    it('should export GATE_CLAMP_MIN_KEEP as 0.5', () => {
      expect(GATE_CLAMP_MIN_KEEP).toBe(0.5);
    });

    it('should export GATE_CLAMP_MIN_DELTA as 0.1', () => {
      expect(GATE_CLAMP_MIN_DELTA).toBe(0.1);
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

    it('should return null when gateClampRegimePermissive is missing', () => {
      const builder = createBuilder();
      const clause = { clauseId: 'test' };
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when gateClampRateInRegime is not a number', () => {
      const builder = createBuilder();
      const clause = createValidClause({ gateClampRateInRegime: 'invalid' });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when gateClampRateInRegime is below MIN_RATE', () => {
      const builder = createBuilder();
      const clause = createValidClause({ gateClampRateInRegime: 0.15 }); // Below 0.2
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when allGatesImplied is true', () => {
      const builder = createBuilder();
      const clause = createValidClause({ allGatesImplied: true });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when candidates array is empty', () => {
      const builder = createBuilder();
      const clause = createValidClause({ candidates: [] });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when candidates is not an array', () => {
      const builder = createBuilder();
      const clause = createValidClause({ candidates: null });
      expect(builder.build(clause)).toBeNull();
    });
  });

  describe('build() - candidate filtering', () => {
    it('should return null when candidate keepRatio is below MIN_KEEP', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.4, // Below 0.5
            predClampRate: 0.1,
          },
        ],
        gatePredicates: [
          {
            axis: 'valence',
            regimeBounds: { min: -100, max: 100 },
          },
        ],
      });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when candidate delta is below MIN_DELTA', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        gateClampRateInRegime: 0.3,
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.6,
            predClampRate: 0.25, // delta = 0.3 - 0.25 = 0.05 < 0.1
          },
        ],
        gatePredicates: [
          {
            axis: 'valence',
            regimeBounds: { min: -100, max: 100 },
          },
        ],
      });
      expect(builder.build(clause)).toBeNull();
    });

    it('should return null when candidate does not tighten regime', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        gatePredicates: [
          {
            axis: 'valence',
            operator: '>=',
            thresholdRaw: 20,
            regimeBounds: { min: 30, max: 100 }, // Already tighter than threshold
          },
        ],
        candidates: [
          {
            id: 'hard:valence:>=:20',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.7,
            predClampRate: 0.1,
          },
        ],
      });
      expect(builder.build(clause)).toBeNull();
    });
  });

  describe('build() - successful recommendation', () => {
    it('should build recommendation with correct structure', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      expect(result).not.toBeNull();
      expect(result.id).toBe(
        'gate_clamp_regime_permissive:var:emotions.joy:>=:0.6:hard:valence:>=:20'
      );
      expect(result.type).toBe('gate_clamp_regime_permissive');
      expect(result.title).toBe('Mood regime allows gate-clamped states');
      expect(result.predictedEffect).toBe(
        'Reduce gate clamp frequency while preserving regime coverage.'
      );
      expect(result.relatedClauseIds).toEqual(['var:emotions.joy:>=:0.6']);
    });

    it('should set confidence based on mood sample count', () => {
      const builder = createBuilder();

      // Low sample count (< 200) = low confidence
      const lowClause = createValidClause({ moodRegimeCount: 100 });
      const lowResult = builder.build(lowClause);
      expect(lowResult.confidence).toBe('low');

      // Medium sample count (200-500) = medium confidence
      const medClause = createValidClause({ moodRegimeCount: 300 });
      const medResult = builder.build(medClause);
      expect(medResult.confidence).toBe('medium');

      // High sample count (>= 500) = high confidence
      const highClause = createValidClause({ moodRegimeCount: 600 });
      const highResult = builder.build(highClause);
      expect(highResult.confidence).toBe('high');
    });

    it('should set severity based on impact', () => {
      const builder = createBuilder();

      // High impact (>= 0.2)
      const highClause = createValidClause();
      highClause.impact = 0.3;
      const highResult = builder.build(highClause);
      expect(highResult.severity).toBe('high');

      // Medium impact (>= 0.1 but < 0.2)
      const medClause = createValidClause();
      medClause.impact = 0.15;
      const medResult = builder.build(medClause);
      expect(medResult.severity).toBe('medium');

      // Low impact (< 0.1)
      const lowClause = createValidClause();
      lowClause.impact = 0.05;
      const lowResult = builder.build(lowClause);
      expect(lowResult.severity).toBe('low');
    });

    it('should include gate clamp rate in why explanation', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      expect(result.why).toContain('Gate clamp rate is 30.0%.');
    });

    it('should include keep ratio in why explanation', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      expect(result.why).toContain('70.0% of regime samples');
    });

    it('should add low confidence note when moodRegimeCount is low', () => {
      const builder = createBuilder();
      const clause = createValidClause({ moodRegimeCount: 80 });

      const result = builder.build(clause);

      expect(result.why).toContain('Low confidence due to limited mood samples');
      expect(result.why).toContain('N=80');
    });
  });

  describe('build() - evidence', () => {
    it('should include gate clamp rate evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      const gateClampEvidence = result.evidence.find(
        (e) => e.label === 'Gate clamp rate (mood regime)'
      );
      expect(gateClampEvidence).toBeDefined();
      expect(gateClampEvidence.numerator).toBe(60);
      expect(gateClampEvidence.denominator).toBe(200);
      expect(gateClampEvidence.value).toBe(0.3);
    });

    it('should include keep ratio evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      const keepEvidence = result.evidence.find(
        (e) => e.label === 'Keep ratio for proposed constraint'
      );
      expect(keepEvidence).toBeDefined();
      expect(keepEvidence.value).toBe(0.7);
    });

    it('should include predicted clamp rate evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      const predEvidence = result.evidence.find(
        (e) => e.label === 'Predicted gate clamp rate (post-constraint)'
      );
      expect(predEvidence).toBeDefined();
      expect(predEvidence.value).toBe(0.1);
    });

    it('should include axis evidence when present', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      const axisBelow = result.evidence.find((e) =>
        e.label.includes('Axis below gate')
      );
      expect(axisBelow).toBeDefined();
      expect(axisBelow.numerator).toBe(60);

      const axisAbove = result.evidence.find((e) =>
        e.label.includes('Axis above gate')
      );
      expect(axisAbove).toBeDefined();
      expect(axisAbove.numerator).toBe(100);
    });

    it('should include population metadata in evidence', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      for (const evidence of result.evidence) {
        expect(evidence.population).toBeDefined();
        // buildPopulation returns { name, count }
        expect(evidence.population.name).toBe('mood-regime');
        expect(typeof evidence.population.count).toBe('number');
      }
    });
  });

  describe('build() - actions', () => {
    it('should include tighten regime action', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      expect(result.actions).toContain(
        'Tighten mood-regime axis constraints that allow gate-clamped states.'
      );
    });

    it('should include axis hints in actions', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      const axisAction = result.actions.find((a) =>
        a.includes('Add regime bounds')
      );
      expect(axisAction).toBeDefined();
      expect(axisAction).toContain('valence >= 20');
    });

    it('should include fallback action', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      expect(result.actions).toContain(
        'If the regime cannot be tightened safely, revisit gate thresholds instead.'
      );
    });

    it('should deduplicate actions', () => {
      const builder = createBuilder();
      const clause = createValidClause();

      const result = builder.build(clause);

      const uniqueActions = new Set(result.actions);
      expect(result.actions.length).toBe(uniqueActions.size);
    });
  });

  describe('candidate selection', () => {
    it('should select candidate with lowest predClampRate', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'candidate-high',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.15,
            predSampleCount: 140,
          },
          {
            id: 'candidate-low',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.05,
            predSampleCount: 140,
          },
        ],
      });

      const result = builder.build(clause);

      expect(result.id).toContain('candidate-low');
    });

    it('should break ties by highest keepRatio', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'candidate-lower-keep',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.6,
            keepCount: 120,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 120,
          },
          {
            id: 'candidate-higher-keep',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.8,
            keepCount: 160,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 160,
          },
        ],
      });

      const result = builder.build(clause);

      expect(result.id).toContain('candidate-higher-keep');
    });

    it('should break remaining ties by id', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'candidate-b',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 140,
          },
          {
            id: 'candidate-a',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 140,
          },
        ],
      });

      const result = builder.build(clause);

      expect(result.id).toContain('candidate-a');
    });
  });

  describe('constraint tightening detection', () => {
    it('should recognize >= operator as tightening when threshold > min', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        gatePredicates: [
          {
            axis: 'valence',
            regimeBounds: { min: 10, max: 100 },
          },
        ],
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }], // 20 > 10
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 140,
          },
        ],
      });

      const result = builder.build(clause);
      expect(result).not.toBeNull();
    });

    it('should recognize <= operator as tightening when threshold < max', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        gatePredicates: [
          {
            axis: 'valence',
            regimeBounds: { min: -100, max: 50 },
          },
        ],
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence', operator: '<=', thresholdRaw: 30 }], // 30 < 50
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 140,
          },
        ],
      });

      const result = builder.build(clause);
      expect(result).not.toBeNull();
    });

    it('should tighten when axis has no existing bounds', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        gatePredicates: [], // No predicates = no bounds
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.7,
            keepCount: 140,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 140,
          },
        ],
      });

      const result = builder.build(clause);
      expect(result).not.toBeNull();
    });

    it('should reject candidate with invalid axis constraint', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'test',
            axes: [{ axis: null, operator: '>=', thresholdRaw: 20 }], // Invalid axis
            keepRatio: 0.7,
            predClampRate: 0.1,
          },
        ],
      });

      const result = builder.build(clause);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle missing clauseId gracefully', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      delete clause.clauseId;

      const result = builder.build(clause);

      expect(result.id).toContain('unknown');
      expect(result.relatedClauseIds).toEqual([]);
    });

    it('should handle missing impact gracefully', () => {
      const builder = createBuilder();
      const clause = createValidClause();
      delete clause.impact;

      const result = builder.build(clause);

      expect(result.severity).toBeDefined();
    });

    it('should handle candidate with missing axis properties', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence' }], // Missing operator and thresholdRaw
            keepRatio: 0.7,
            predClampRate: 0.1,
          },
        ],
      });

      const result = builder.build(clause);
      expect(result).toBeNull();
    });

    it('should handle gateClampRateInRegime exactly at MIN_RATE', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        gateClampRateInRegime: 0.2, // Exactly at threshold
      });

      const result = builder.build(clause);
      expect(result).not.toBeNull();
    });

    it('should handle keepRatio exactly at MIN_KEEP', () => {
      const builder = createBuilder();
      const clause = createValidClause({
        candidates: [
          {
            id: 'test',
            axes: [{ axis: 'valence', operator: '>=', thresholdRaw: 20 }],
            keepRatio: 0.5, // Exactly at threshold
            keepCount: 100,
            keepDenominator: 200,
            predClampRate: 0.1,
            predSampleCount: 100,
          },
        ],
      });

      const result = builder.build(clause);
      expect(result).not.toBeNull();
    });
  });
});
