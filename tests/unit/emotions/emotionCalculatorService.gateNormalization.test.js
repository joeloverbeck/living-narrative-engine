/**
 * @file Unit tests for affect trait normalization in gate evaluation.
 * @description Proves that affect traits are normalized from [0..100] to [0..1]
 * and that gates correctly use these normalized values.
 * @see src/expressionDiagnostics/utils/axisNormalizationUtils.js
 * @see src/emotions/emotionCalculatorService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { normalizeAffectTraits } from '../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('EmotionCalculatorService - Gate Normalization', () => {
  describe('normalizeAffectTraits function', () => {
    describe('boundary normalization [0..100] → [0..1]', () => {
      it('normalizes raw 0 to 0.0', () => {
        const normalized = normalizeAffectTraits({ self_control: 0 });
        expect(normalized.self_control).toBe(0);
      });

      it('normalizes raw 50 to 0.5', () => {
        const normalized = normalizeAffectTraits({ self_control: 50 });
        expect(normalized.self_control).toBe(0.5);
      });

      it('normalizes raw 100 to 1.0', () => {
        const normalized = normalizeAffectTraits({ self_control: 100 });
        expect(normalized.self_control).toBe(1.0);
      });

      it('normalizes all four affect traits correctly', () => {
        const normalized = normalizeAffectTraits({
          affective_empathy: 0,
          cognitive_empathy: 25,
          harm_aversion: 75,
          self_control: 100,
        });

        expect(normalized.affective_empathy).toBe(0);
        expect(normalized.cognitive_empathy).toBe(0.25);
        expect(normalized.harm_aversion).toBe(0.75);
        expect(normalized.self_control).toBe(1.0);
      });

      it('normalizes intermediate values precisely', () => {
        const testCases = [
          { raw: 10, expected: 0.1 },
          { raw: 15, expected: 0.15 },
          { raw: 24, expected: 0.24 },
          { raw: 25, expected: 0.25 },
          { raw: 30, expected: 0.3 },
          { raw: 72, expected: 0.72 },
        ];

        for (const { raw, expected } of testCases) {
          const normalized = normalizeAffectTraits({ self_control: raw });
          expect(normalized.self_control).toBeCloseTo(expected, 6);
        }
      });
    });

    describe('clamping behavior', () => {
      it('clamps values below 0 to 0', () => {
        const normalized = normalizeAffectTraits({ self_control: -10 });
        expect(normalized.self_control).toBe(0);
      });

      it('clamps values above 100 to 1', () => {
        const normalized = normalizeAffectTraits({ self_control: 150 });
        expect(normalized.self_control).toBe(1);
      });

      it('clamps extreme negative values', () => {
        const normalized = normalizeAffectTraits({ self_control: -1000 });
        expect(normalized.self_control).toBe(0);
      });

      it('clamps extreme positive values', () => {
        const normalized = normalizeAffectTraits({ self_control: 1000 });
        expect(normalized.self_control).toBe(1);
      });
    });

    describe('default value handling', () => {
      it('defaults missing traits to 0.5 (from raw 50)', () => {
        const normalized = normalizeAffectTraits({});

        expect(normalized.affective_empathy).toBe(0.5);
        expect(normalized.cognitive_empathy).toBe(0.5);
        expect(normalized.harm_aversion).toBe(0.5);
        expect(normalized.self_control).toBe(0.5);
      });

      it('fills in missing traits with defaults', () => {
        const normalized = normalizeAffectTraits({ affective_empathy: 80 });

        expect(normalized.affective_empathy).toBe(0.8);
        expect(normalized.cognitive_empathy).toBe(0.5);
        expect(normalized.harm_aversion).toBe(0.5);
        expect(normalized.self_control).toBe(0.5);
      });

      it('handles null input by using all defaults', () => {
        const normalized = normalizeAffectTraits(null);

        expect(normalized.affective_empathy).toBe(0.5);
        expect(normalized.cognitive_empathy).toBe(0.5);
        expect(normalized.harm_aversion).toBe(0.5);
        expect(normalized.self_control).toBe(0.5);
      });

      it('handles undefined input by using all defaults', () => {
        const normalized = normalizeAffectTraits(undefined);

        expect(normalized.affective_empathy).toBe(0.5);
        expect(normalized.cognitive_empathy).toBe(0.5);
        expect(normalized.harm_aversion).toBe(0.5);
        expect(normalized.self_control).toBe(0.5);
      });
    });
  });

  describe('Gate evaluation with normalized values', () => {
    let service;
    let mockLogger;
    let mockDataRegistry;

    const mockPrototypes = {
      test_emotion_25: {
        weights: { engagement: 1.0 },
        gates: ['self_control >= 0.25'],
      },
      test_emotion_50: {
        weights: { engagement: 1.0 },
        gates: ['affective_empathy >= 0.50'],
      },
      test_emotion_ceiling: {
        weights: { engagement: 1.0 },
        gates: ['harm_aversion <= 0.30'],
      },
    };

    const highEngagementMood = {
      valence: 0,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 80,
      future_expectancy: 0,
      self_evaluation: 0,
      affiliation: 0,
    };

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      mockDataRegistry = {
        get: jest.fn((category, id) => {
          if (category === 'lookups' && id === 'core:emotion_prototypes') {
            return { entries: mockPrototypes };
          }
          return null;
        }),
      };

      service = new EmotionCalculatorService({
        logger: mockLogger,
        dataRegistry: mockDataRegistry,
      });
    });

    describe('floor gates (>= threshold)', () => {
      it('gate "self_control >= 0.25" passes when raw trait is 25', () => {
        const traits = { self_control: 25 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        expect(emotions.get('test_emotion_25')).toBeGreaterThan(0);
      });

      it('gate "self_control >= 0.25" fails when raw trait is 24', () => {
        const traits = { self_control: 24 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        expect(emotions.get('test_emotion_25')).toBe(0);
      });

      it('gate "affective_empathy >= 0.50" passes when raw trait is 50', () => {
        const traits = { affective_empathy: 50 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        expect(emotions.get('test_emotion_50')).toBeGreaterThan(0);
      });

      it('gate "affective_empathy >= 0.50" fails when raw trait is 49', () => {
        const traits = { affective_empathy: 49 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        expect(emotions.get('test_emotion_50')).toBe(0);
      });
    });

    describe('ceiling gates (<= threshold)', () => {
      it('gate "harm_aversion <= 0.30" passes when raw trait is 30', () => {
        const traits = { harm_aversion: 30 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        expect(emotions.get('test_emotion_ceiling')).toBeGreaterThan(0);
      });

      it('gate "harm_aversion <= 0.30" fails when raw trait is 31', () => {
        const traits = { harm_aversion: 31 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        expect(emotions.get('test_emotion_ceiling')).toBe(0);
      });
    });

    describe('extreme boundary values', () => {
      it('raw trait 0 produces normalized 0.0 for gate evaluation', () => {
        const traits = { self_control: 0 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        // 0.0 < 0.25, so gate fails
        expect(emotions.get('test_emotion_25')).toBe(0);
      });

      it('raw trait 100 produces normalized 1.0 for gate evaluation', () => {
        const traits = { self_control: 100 };
        const emotions = service.calculateEmotions(
          highEngagementMood,
          null,
          null,
          traits
        );

        // 1.0 >= 0.25, so gate passes
        expect(emotions.get('test_emotion_25')).toBeGreaterThan(0);
      });
    });
  });
});
