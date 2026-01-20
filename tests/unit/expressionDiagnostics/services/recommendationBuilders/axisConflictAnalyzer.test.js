/**
 * @file Unit tests for AxisConflictAnalyzer
 * Tests the extraction of axis sign conflict analysis logic from RecommendationEngine.
 */

import { describe, it, expect } from '@jest/globals';
import AxisConflictAnalyzer from '../../../../../src/expressionDiagnostics/services/recommendationBuilders/AxisConflictAnalyzer.js';

describe('AxisConflictAnalyzer', () => {
  /**
   * Create an analyzer instance for testing.
   * @param {object} [options] - Constructor options
   * @returns {AxisConflictAnalyzer}
   */
  const createAnalyzer = (options = {}) => new AxisConflictAnalyzer(options);

  /**
   * Create a valid axis conflict for testing.
   * @param {object} [overrides] - Override specific properties
   * @returns {object} Axis conflict object
   */
  const createValidConflict = (overrides = {}) => ({
    conflictType: 'sign_mismatch',
    axis: 'valence',
    weight: -0.3,
    constraintMin: 20,
    constraintMax: 100,
    lostRawSum: 15.5,
    lostIntensity: 0.25,
    sources: [
      {
        varPath: 'emotions.joy',
        operator: '>=',
        threshold: 0.6,
      },
    ],
    ...overrides,
  });

  /**
   * Create a mock EmotionSimilarityService for testing.
   * @returns {object} Mock service
   */
  const createMockEmotionSimilarityService = () => ({
    findEmotionsWithCompatibleAxisSign: jest.fn().mockReturnValue([
      { emotionName: 'contentment', axisWeight: 0.4 },
      { emotionName: 'serenity', axisWeight: 0.35 },
    ]),
  });

  describe('constructor', () => {
    it('should create instance without emotionSimilarityService', () => {
      const analyzer = createAnalyzer();
      expect(analyzer).toBeInstanceOf(AxisConflictAnalyzer);
    });

    it('should create instance with emotionSimilarityService', () => {
      const mockService = createMockEmotionSimilarityService();
      const analyzer = createAnalyzer({ emotionSimilarityService: mockService });
      expect(analyzer).toBeInstanceOf(AxisConflictAnalyzer);
    });

    it('should accept empty options object', () => {
      const analyzer = createAnalyzer({});
      expect(analyzer).toBeInstanceOf(AxisConflictAnalyzer);
    });
  });

  describe('normalize()', () => {
    it('should filter out conflicts without conflictType', () => {
      const analyzer = createAnalyzer();
      const conflicts = [
        createValidConflict(),
        { axis: 'arousal', weight: 0.2 }, // Missing conflictType
        createValidConflict({ axis: 'arousal', conflictType: 'weight_opposition' }),
      ];

      const result = analyzer.normalize(conflicts);

      expect(result).toHaveLength(2);
      expect(result[0].axis).toBe('valence');
      expect(result[1].axis).toBe('arousal');
    });

    it('should return empty array for null input', () => {
      const analyzer = createAnalyzer();
      expect(analyzer.normalize(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const analyzer = createAnalyzer();
      expect(analyzer.normalize(undefined)).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      const analyzer = createAnalyzer();
      expect(analyzer.normalize('invalid')).toEqual([]);
      expect(analyzer.normalize(123)).toEqual([]);
      expect(analyzer.normalize({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      const analyzer = createAnalyzer();
      expect(analyzer.normalize([])).toEqual([]);
    });

    it('should filter out conflicts with null conflictType', () => {
      const analyzer = createAnalyzer();
      const conflicts = [
        createValidConflict({ conflictType: null }),
        createValidConflict({ axis: 'arousal' }),
      ];

      const result = analyzer.normalize(conflicts);

      expect(result).toHaveLength(1);
      expect(result[0].axis).toBe('arousal');
    });

    it('should filter out conflicts with empty string conflictType', () => {
      const analyzer = createAnalyzer();
      const conflicts = [
        createValidConflict({ conflictType: '' }),
        createValidConflict({ axis: 'arousal' }),
      ];

      const result = analyzer.normalize(conflicts);

      // Empty string is falsy, so should be filtered
      expect(result).toHaveLength(1);
    });
  });

  describe('analyze()', () => {
    it('should return expected structure', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('structuredActions');
      expect(result).toHaveProperty('evidence');
      expect(Array.isArray(result.actions)).toBe(true);
      expect(typeof result.structuredActions).toBe('object');
      expect(Array.isArray(result.evidence)).toBe(true);
    });

    it('should produce evidence with conflict details', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.evidence).toHaveLength(1);
      const evidence = result.evidence[0];
      expect(evidence.label).toContain('Axis conflict');
      expect(evidence.label).toContain('sign_mismatch');
      expect(evidence.label).toContain('valence');
      expect(evidence.axis).toBe('valence');
      expect(evidence.weight).toBe(-0.3);
      expect(evidence.lostIntensity).toBe(0.25);
    });

    it('should limit evidence to 3 conflicts', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [
        createValidConflict({ axis: 'valence' }),
        createValidConflict({ axis: 'arousal' }),
        createValidConflict({ axis: 'dominance' }),
        createValidConflict({ axis: 'novelty' }),
      ];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'test',
        moodSampleCount: 500,
      });

      expect(result.evidence).toHaveLength(3);
    });

    it('should include population metadata in evidence', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.evidence[0].population).toBeDefined();
      expect(result.evidence[0].population.name).toBe('mood-regime');
      expect(result.evidence[0].population.count).toBe(500);
    });

    it('should handle empty axisConflicts', () => {
      const analyzer = createAnalyzer();

      const result = analyzer.analyze({
        axisConflicts: [],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.evidence).toEqual([]);
      // Options are still produced even with empty conflicts (binary choice framing)
      expect(result.structuredActions.options).toHaveLength(2);
    });

    it('should handle null axisConflicts', () => {
      const analyzer = createAnalyzer();

      const result = analyzer.analyze({
        axisConflicts: null,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.evidence).toEqual([]);
    });

    it('should handle undefined prototypeId', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: undefined,
        moodSampleCount: 500,
      });

      // Should still produce output, using 'the emotion' as fallback
      expect(result.structuredActions).toBeDefined();
    });
  });

  describe('analyze() - binary choice framing', () => {
    it('should include Option A (regime relaxation) in actions', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const optionA = result.actions.find((a) =>
        a.includes('OPTION A: Keep emotion, adjust regime')
      );
      expect(optionA).toBeDefined();
    });

    it('should include Option B (change emotion) in actions', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const optionB = result.actions.find((a) =>
        a.includes('OPTION B: Keep regime, change emotion')
      );
      expect(optionB).toBeDefined();
    });

    it('should include trade-off information for Option A', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const tradeoff = result.actions.find((a) =>
        a.includes('wider range of mood states')
      );
      expect(tradeoff).toBeDefined();
    });

    it('should include trade-off information for Option B', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const tradeoff = result.actions.find((a) =>
        a.includes('different emotional signature')
      );
      expect(tradeoff).toBeDefined();
    });

    it('should include structured options', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.structuredActions.options).toHaveLength(2);
      expect(result.structuredActions.options[0].id).toBe('relax_regime');
      expect(result.structuredActions.options[1].id).toBe('change_emotion');
    });

    it('should include constraint details in Option A', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const removeAction = result.actions.find((a) =>
        a.includes('Remove or relax:')
      );
      expect(removeAction).toBeDefined();
      expect(removeAction).toContain('emotions.joy');
      expect(removeAction).toContain('>=');
    });
  });

  describe('analyze() - emotion alternatives (with EmotionSimilarityService)', () => {
    it('should suggest alternative emotions when service is available', () => {
      const mockService = createMockEmotionSimilarityService();
      const analyzer = createAnalyzer({ emotionSimilarityService: mockService });
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(mockService.findEmotionsWithCompatibleAxisSign).toHaveBeenCalled();
      const considerAction = result.actions.find((a) =>
        a.includes('Consider:')
      );
      expect(considerAction).toBeDefined();
    });

    it('should include alternatives in structured actions', () => {
      const mockService = createMockEmotionSimilarityService();
      const analyzer = createAnalyzer({ emotionSimilarityService: mockService });
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const optionB = result.structuredActions.options[1];
      expect(optionB.alternatives).toBeDefined();
      expect(optionB.alternatives.length).toBeGreaterThan(0);
    });

    it('should filter out current emotion from suggestions', () => {
      const mockService = {
        findEmotionsWithCompatibleAxisSign: jest.fn().mockReturnValue([
          { emotionName: 'joy', axisWeight: 0.5 }, // Same as prototypeId
          { emotionName: 'contentment', axisWeight: 0.4 },
        ]),
      };
      const analyzer = createAnalyzer({ emotionSimilarityService: mockService });
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const joyAction = result.actions.find(
        (a) => a.includes('Consider: joy')
      );
      expect(joyAction).toBeUndefined();
    });

    it('should work without emotionSimilarityService', () => {
      const analyzer = createAnalyzer(); // No service
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      // Should still produce Option B, just without specific alternatives
      const optionB = result.structuredActions.options[1];
      expect(optionB).toBeDefined();
      expect(optionB.alternatives).toEqual([]);
    });

    it('should always include fallback action in Option B', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const fallback = result.actions.find((a) =>
        a.includes('Or: Adjust')
      );
      expect(fallback).toBeDefined();
      expect(fallback).toContain('weight toward 0');
    });
  });

  describe('analyze() - conflict summary', () => {
    it('should include CONFLICT label in actions', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const conflictAction = result.actions.find((a) =>
        a.startsWith('CONFLICT:')
      );
      expect(conflictAction).toBeDefined();
    });

    it('should include conflict summary in structuredActions', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.structuredActions.conflictSummary).toBeDefined();
      expect(result.structuredActions.conflictSummary.length).toBeGreaterThan(0);
    });

    it('should describe suppressor behavior for negative weights', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ weight: -0.3 })];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.structuredActions.conflictSummary).toContain('suppressor');
    });

    it('should describe weight opposition for positive weights', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [
        createValidConflict({
          weight: 0.3,
          sources: [{ varPath: 'emotions.joy', operator: '<=', threshold: 0.3 }],
        }),
      ];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.structuredActions.conflictSummary).toContain('opposes');
    });
  });

  describe('getSeverity()', () => {
    it('should return high severity for large lostIntensity relative to threshold', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ lostIntensity: 0.4 })];
      const clause = { thresholdValue: 0.6 };

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.1,
      });

      // score = 0.4 / 0.6 = 0.67 > 0.3 => high
      expect(result).toBe('high');
    });

    it('should return medium severity for moderate lostIntensity', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ lostIntensity: 0.12 })];
      const clause = { thresholdValue: 0.6 };

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.1,
      });

      // score = 0.12 / 0.6 = 0.2, 0.15 <= 0.2 < 0.3 => medium
      expect(result).toBe('medium');
    });

    it('should return low severity for small lostIntensity', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ lostIntensity: 0.05 })];
      const clause = { thresholdValue: 0.6 };

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.1,
      });

      // score = 0.05 / 0.6 = 0.083 < 0.15 => low
      expect(result).toBe('low');
    });

    it('should fall back to impact-based severity when threshold is missing', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ lostIntensity: 0.4 })];
      const clause = {}; // No thresholdValue

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.25, // High impact
      });

      // Falls back to getSeverity(impact) => high (>= 0.2)
      expect(result).toBe('high');
    });

    it('should fall back to impact-based severity when threshold is zero', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ lostIntensity: 0.4 })];
      const clause = { thresholdValue: 0 };

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.05, // Low impact
      });

      expect(result).toBe('low');
    });

    it('should fall back when lostIntensity is not a number', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ lostIntensity: 'invalid' })];
      const clause = { thresholdValue: 0.6 };

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.15, // Medium impact
      });

      expect(result).toBe('medium');
    });

    it('should use maximum lostIntensity from multiple conflicts', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [
        createValidConflict({ lostIntensity: 0.1 }),
        createValidConflict({ axis: 'arousal', lostIntensity: 0.3 }),
        createValidConflict({ axis: 'dominance', lostIntensity: 0.15 }),
      ];
      const clause = { thresholdValue: 0.6 };

      const result = analyzer.getSeverity({
        axisConflicts,
        clause,
        impact: 0.05,
      });

      // max = 0.3, score = 0.3 / 0.6 = 0.5 > 0.3 => high
      expect(result).toBe('high');
    });
  });

  describe('axis name formatting', () => {
    it('should format snake_case to Title Case in evidence', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [
        createValidConflict({
          axis: 'positive_valence',
          sources: [{ varPath: 'mood.positive_valence', operator: '>=', threshold: 0.5 }],
        }),
      ];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      // Check that formatted axis name appears in actions
      const formatted = result.actions.find((a) =>
        a.includes('Positive Valence')
      );
      expect(formatted).toBeDefined();
    });

    it('should handle single-word axis names', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ axis: 'valence' })];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const formatted = result.actions.find((a) => a.includes('Valence'));
      expect(formatted).toBeDefined();
    });

    it('should handle empty axis name gracefully', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ axis: '' })];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      // Should not crash, still produce output
      expect(result.structuredActions).toBeDefined();
    });

    it('should handle null axis name gracefully', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict({ axis: null })];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.evidence).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle conflict with missing weight', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict();
      delete conflict.weight;

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const evidence = result.evidence[0];
      expect(evidence.weight).toBeNull();
      expect(evidence.label).toContain('n/a');
    });

    it('should handle conflict with missing constraintMin/Max', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict();
      delete conflict.constraintMin;
      delete conflict.constraintMax;

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const evidence = result.evidence[0];
      expect(evidence.label).toContain('regime n/a');
    });

    it('should handle conflict with missing lostRawSum', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict();
      delete conflict.lostRawSum;

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      const evidence = result.evidence[0];
      expect(evidence.numerator).toBeNull();
    });

    it('should handle conflict with missing sources', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict({ sources: null });

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result.evidence[0].sources).toEqual([]);
    });

    it('should handle conflict with empty sources array', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict({ sources: [] });

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      // Should still produce output, just with generic fallback
      expect(result.structuredActions.options[0].actions).toBeDefined();
    });

    it('should handle zero moodSampleCount', () => {
      const analyzer = createAnalyzer();
      const axisConflicts = [createValidConflict()];

      const result = analyzer.analyze({
        axisConflicts,
        prototypeId: 'joy',
        moodSampleCount: 0,
      });

      expect(result.evidence[0].population.count).toBe(0);
    });

    it('should handle missing operator in source', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict({
        sources: [{ varPath: 'emotions.joy', threshold: 0.6 }], // Missing operator
      });

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      // Should still produce output
      expect(result).toBeDefined();
    });

    it('should handle missing varPath in source', () => {
      const analyzer = createAnalyzer();
      const conflict = createValidConflict({
        sources: [{ operator: '>=', threshold: 0.6 }], // Missing varPath
      });

      const result = analyzer.analyze({
        axisConflicts: [conflict],
        prototypeId: 'joy',
        moodSampleCount: 500,
      });

      expect(result).toBeDefined();
    });
  });
});
