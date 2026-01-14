/**
 * @file Unit tests for diagnostics axis normalization utilities.
 */

import { describe, expect, it } from '@jest/globals';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
} from '../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('axisNormalizationUtils', () => {
  describe('normalizeMoodAxes', () => {
    it('always divides by 100 to match runtime normalization', () => {
      const normalized = normalizeMoodAxes({
        valence: -100,
        arousal: -1,
        threat: 0,
        engagement: 1,
        agency_control: 100,
      });

      expect(normalized).toEqual({
        valence: -1,
        arousal: -0.01,
        threat: 0,
        engagement: 0.01,
        agency_control: 1,
      });
    });
  });

  describe('normalizeSexualAxes', () => {
    it('divides raw sexual axes by 100 and clamps to [0, 1]', () => {
      const normalized = normalizeSexualAxes(
        {
          sex_excitation: 80,
          sex_inhibition: 20,
          baseline_libido: 10,
        },
        null
      );

      expect(normalized.sexual_arousal).toBeCloseTo(0.7, 6);
      expect(normalized).toEqual({
        sexual_arousal: normalized.sexual_arousal,
        sex_inhibition: 0.2,
        sexual_inhibition: 0.2,
        sex_excitation: 0.8,
        baseline_libido: 0.1,
      });
    });

    it('treats small raw axis values as unnormalized (matches runtime)', () => {
      const normalized = normalizeSexualAxes(
        {
          sex_excitation: 1,
          sex_inhibition: 0,
          baseline_libido: 0,
        },
        null
      );

      expect(normalized.sexual_arousal).toBeCloseTo(0.01, 6);
      expect(normalized.sex_excitation).toBeCloseTo(0.01, 6);
      expect(normalized.sex_inhibition).toBeCloseTo(0, 6);
      expect(normalized.baseline_libido).toBeCloseTo(0, 6);
    });
  });

  describe('normalizeAffectTraits', () => {
    it('normalizes traits by dividing by 100 and fills defaults', () => {
      const normalized = normalizeAffectTraits({
        affective_empathy: 1,
      });

      expect(normalized.affective_empathy).toBeCloseTo(0.01, 6);
      expect(normalized.cognitive_empathy).toBeCloseTo(0.5, 6);
      expect(normalized.harm_aversion).toBeCloseTo(0.5, 6);
    });
  });
});
