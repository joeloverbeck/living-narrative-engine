/**
 * @file Unit tests for mood and affect constants
 * @see src/constants/moodAffectConstants.js
 */

import {
  MOOD_AXES,
  AFFECT_TRAITS,
  MOOD_AXIS_RANGE,
  AFFECT_TRAIT_RANGE,
  DEFAULT_MOOD_AXIS_VALUE,
  DEFAULT_AFFECT_TRAIT_VALUE,
  DEFAULT_AFFECT_TRAITS,
  MOOD_AXES_SET,
  AFFECT_TRAITS_SET,
  isMoodAxis,
  isAffectTrait,
} from '../../../src/constants/moodAffectConstants.js';

describe('moodAffectConstants', () => {
  describe('MOOD_AXES', () => {
    it('contains exactly 14 mood axes', () => {
      expect(MOOD_AXES).toHaveLength(14);
    });

    it('contains all expected mood axes in the correct order', () => {
      expect(MOOD_AXES).toEqual([
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'temporal_orientation',
        'self_evaluation',
        'affiliation',
        'inhibitory_control',
        'uncertainty',
        'contamination_salience',
        'rumination',
        'evaluation_pressure',
      ]);
    });

    it('has temporal_orientation at index 6 (after future_expectancy)', () => {
      expect(MOOD_AXES.indexOf('future_expectancy')).toBe(5);
      expect(MOOD_AXES.indexOf('temporal_orientation')).toBe(6);
    });

    it('is frozen and immutable', () => {
      expect(Object.isFrozen(MOOD_AXES)).toBe(true);
    });

    it('prevents modification attempts', () => {
      expect(() => {
        MOOD_AXES.push('invalid_axis');
      }).toThrow();
    });
  });

  describe('AFFECT_TRAITS', () => {
    it('contains exactly 7 affect traits', () => {
      expect(AFFECT_TRAITS).toHaveLength(7);
    });

    it('contains all expected affect traits in the correct order', () => {
      expect(AFFECT_TRAITS).toEqual([
        'affective_empathy',
        'cognitive_empathy',
        'harm_aversion',
        'self_control',
        'disgust_sensitivity',
        'ruminative_tendency',
        'evaluation_sensitivity',
      ]);
    });

    it('is frozen and immutable', () => {
      expect(Object.isFrozen(AFFECT_TRAITS)).toBe(true);
    });

    it('prevents modification attempts', () => {
      expect(() => {
        AFFECT_TRAITS.push('invalid_trait');
      }).toThrow();
    });
  });

  describe('MOOD_AXIS_RANGE', () => {
    it('defines range from -100 to 100', () => {
      expect(MOOD_AXIS_RANGE).toEqual({ min: -100, max: 100 });
    });

    it('is frozen and immutable', () => {
      expect(Object.isFrozen(MOOD_AXIS_RANGE)).toBe(true);
    });
  });

  describe('AFFECT_TRAIT_RANGE', () => {
    it('defines range from 0 to 100', () => {
      expect(AFFECT_TRAIT_RANGE).toEqual({ min: 0, max: 100 });
    });

    it('is frozen and immutable', () => {
      expect(Object.isFrozen(AFFECT_TRAIT_RANGE)).toBe(true);
    });
  });

  describe('DEFAULT_MOOD_AXIS_VALUE', () => {
    it('defaults to 0', () => {
      expect(DEFAULT_MOOD_AXIS_VALUE).toBe(0);
    });
  });

  describe('DEFAULT_AFFECT_TRAIT_VALUE', () => {
    it('defaults to 50', () => {
      expect(DEFAULT_AFFECT_TRAIT_VALUE).toBe(50);
    });
  });

  describe('DEFAULT_AFFECT_TRAITS', () => {
    it('contains all 7 affect traits with default values', () => {
      expect(DEFAULT_AFFECT_TRAITS).toEqual({
        affective_empathy: 50,
        cognitive_empathy: 50,
        harm_aversion: 50,
        self_control: 50,
        disgust_sensitivity: 50,
        ruminative_tendency: 50,
        evaluation_sensitivity: 50,
      });
    });

    it('has matching keys with AFFECT_TRAITS array', () => {
      const defaultTraitKeys = Object.keys(DEFAULT_AFFECT_TRAITS).sort();
      const affectTraitsArray = [...AFFECT_TRAITS].sort();
      expect(defaultTraitKeys).toEqual(affectTraitsArray);
    });

    it('is frozen and immutable', () => {
      expect(Object.isFrozen(DEFAULT_AFFECT_TRAITS)).toBe(true);
    });
  });

  describe('MOOD_AXES_SET', () => {
    it('is a Set instance', () => {
      expect(MOOD_AXES_SET).toBeInstanceOf(Set);
    });

    it('contains all mood axes', () => {
      expect(MOOD_AXES_SET.size).toBe(14);
      for (const axis of MOOD_AXES) {
        expect(MOOD_AXES_SET.has(axis)).toBe(true);
      }
    });

    it('contains temporal_orientation', () => {
      expect(MOOD_AXES_SET.has('temporal_orientation')).toBe(true);
    });

    it('does not contain non-mood-axis values', () => {
      expect(MOOD_AXES_SET.has('invalid_axis')).toBe(false);
      expect(MOOD_AXES_SET.has('')).toBe(false);
      expect(MOOD_AXES_SET.has('affective_empathy')).toBe(false);
    });
  });

  describe('AFFECT_TRAITS_SET', () => {
    it('is a Set instance', () => {
      expect(AFFECT_TRAITS_SET).toBeInstanceOf(Set);
    });

    it('contains all affect traits', () => {
      expect(AFFECT_TRAITS_SET.size).toBe(7);
      for (const trait of AFFECT_TRAITS) {
        expect(AFFECT_TRAITS_SET.has(trait)).toBe(true);
      }
    });

    it('does not contain non-affect-trait values', () => {
      expect(AFFECT_TRAITS_SET.has('invalid_trait')).toBe(false);
      expect(AFFECT_TRAITS_SET.has('')).toBe(false);
      expect(AFFECT_TRAITS_SET.has('valence')).toBe(false);
    });
  });

  describe('isMoodAxis', () => {
    it('returns true for valid mood axes', () => {
      expect(isMoodAxis('valence')).toBe(true);
      expect(isMoodAxis('arousal')).toBe(true);
      expect(isMoodAxis('agency_control')).toBe(true);
      expect(isMoodAxis('threat')).toBe(true);
      expect(isMoodAxis('engagement')).toBe(true);
      expect(isMoodAxis('future_expectancy')).toBe(true);
      expect(isMoodAxis('temporal_orientation')).toBe(true);
      expect(isMoodAxis('self_evaluation')).toBe(true);
      expect(isMoodAxis('affiliation')).toBe(true);
      expect(isMoodAxis('inhibitory_control')).toBe(true);
      expect(isMoodAxis('uncertainty')).toBe(true);
      expect(isMoodAxis('contamination_salience')).toBe(true);
      expect(isMoodAxis('rumination')).toBe(true);
      expect(isMoodAxis('evaluation_pressure')).toBe(true);
    });

    it('returns false for invalid mood axes', () => {
      expect(isMoodAxis('invalid_axis')).toBe(false);
      expect(isMoodAxis('')).toBe(false);
      expect(isMoodAxis('VALENCE')).toBe(false);
      expect(isMoodAxis('affective_empathy')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
      expect(isMoodAxis(null)).toBe(false);
      expect(isMoodAxis(undefined)).toBe(false);
      expect(isMoodAxis(123)).toBe(false);
      expect(isMoodAxis({})).toBe(false);
    });
  });

  describe('isAffectTrait', () => {
    it('returns true for valid affect traits', () => {
      expect(isAffectTrait('affective_empathy')).toBe(true);
      expect(isAffectTrait('cognitive_empathy')).toBe(true);
      expect(isAffectTrait('harm_aversion')).toBe(true);
      expect(isAffectTrait('self_control')).toBe(true);
      expect(isAffectTrait('disgust_sensitivity')).toBe(true);
      expect(isAffectTrait('ruminative_tendency')).toBe(true);
      expect(isAffectTrait('evaluation_sensitivity')).toBe(true);
    });

    it('returns false for invalid affect traits', () => {
      expect(isAffectTrait('invalid_trait')).toBe(false);
      expect(isAffectTrait('')).toBe(false);
      expect(isAffectTrait('AFFECTIVE_EMPATHY')).toBe(false);
      expect(isAffectTrait('valence')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
      expect(isAffectTrait(null)).toBe(false);
      expect(isAffectTrait(undefined)).toBe(false);
      expect(isAffectTrait(123)).toBe(false);
      expect(isAffectTrait({})).toBe(false);
    });
  });

  describe('cross-constant consistency', () => {
    it('MOOD_AXES and MOOD_AXES_SET contain the same values', () => {
      expect(MOOD_AXES_SET.size).toBe(MOOD_AXES.length);
      for (const axis of MOOD_AXES) {
        expect(MOOD_AXES_SET.has(axis)).toBe(true);
      }
    });

    it('AFFECT_TRAITS and AFFECT_TRAITS_SET contain the same values', () => {
      expect(AFFECT_TRAITS_SET.size).toBe(AFFECT_TRAITS.length);
      for (const trait of AFFECT_TRAITS) {
        expect(AFFECT_TRAITS_SET.has(trait)).toBe(true);
      }
    });

    it('DEFAULT_AFFECT_TRAITS uses DEFAULT_AFFECT_TRAIT_VALUE for all traits', () => {
      for (const value of Object.values(DEFAULT_AFFECT_TRAITS)) {
        expect(value).toBe(DEFAULT_AFFECT_TRAIT_VALUE);
      }
    });

    it('ranges have valid min < max', () => {
      expect(MOOD_AXIS_RANGE.min).toBeLessThan(MOOD_AXIS_RANGE.max);
      expect(AFFECT_TRAIT_RANGE.min).toBeLessThan(AFFECT_TRAIT_RANGE.max);
    });

    it('DEFAULT_MOOD_AXIS_VALUE is within MOOD_AXIS_RANGE', () => {
      expect(DEFAULT_MOOD_AXIS_VALUE).toBeGreaterThanOrEqual(
        MOOD_AXIS_RANGE.min
      );
      expect(DEFAULT_MOOD_AXIS_VALUE).toBeLessThanOrEqual(MOOD_AXIS_RANGE.max);
    });

    it('DEFAULT_AFFECT_TRAIT_VALUE is within AFFECT_TRAIT_RANGE', () => {
      expect(DEFAULT_AFFECT_TRAIT_VALUE).toBeGreaterThanOrEqual(
        AFFECT_TRAIT_RANGE.min
      );
      expect(DEFAULT_AFFECT_TRAIT_VALUE).toBeLessThanOrEqual(
        AFFECT_TRAIT_RANGE.max
      );
    });
  });
});
