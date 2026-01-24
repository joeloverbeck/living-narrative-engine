/**
 * @file Unit tests for flattenNormalizedAxes and resolveAxisValueFlat utilities
 * @see src/expressionDiagnostics/utils/axisNormalizationUtils.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  flattenNormalizedAxes,
  resolveAxisValueFlat,
} from '../../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('flattenNormalizedAxes', () => {
  describe('basic functionality', () => {
    it('returns a Map instance', () => {
      const normalized = {
        moodAxes: {},
        sexualAxes: {},
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result).toBeInstanceOf(Map);
    });

    it('flattens mood axes into the Map', () => {
      const normalized = {
        moodAxes: { valence: 0.5, arousal: -0.3 },
        sexualAxes: {},
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('valence')).toBe(0.5);
      expect(result.get('arousal')).toBe(-0.3);
    });

    it('flattens sexual axes into the Map', () => {
      const normalized = {
        moodAxes: {},
        sexualAxes: { sexual_arousal: 0.7, sex_inhibition: 0.2 },
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('sexual_arousal')).toBe(0.7);
      expect(result.get('sex_inhibition')).toBe(0.2);
    });

    it('flattens trait axes into the Map', () => {
      const normalized = {
        moodAxes: {},
        sexualAxes: {},
        traitAxes: { inhibitory_control: 0.6, emotional_stability: 0.8 },
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('inhibitory_control')).toBe(0.6);
      expect(result.get('emotional_stability')).toBe(0.8);
    });
  });

  describe('priority order (traits > sexual > mood)', () => {
    it('trait axes override sexual axes for same key', () => {
      const normalized = {
        moodAxes: {},
        sexualAxes: { shared_key: 0.3 },
        traitAxes: { shared_key: 0.9 },
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('shared_key')).toBe(0.9);
    });

    it('sexual axes override mood axes for same key', () => {
      const normalized = {
        moodAxes: { shared_key: 0.1 },
        sexualAxes: { shared_key: 0.5 },
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('shared_key')).toBe(0.5);
    });

    it('trait axes override all for same key', () => {
      const normalized = {
        moodAxes: { shared_key: 0.1 },
        sexualAxes: { shared_key: 0.5 },
        traitAxes: { shared_key: 0.9 },
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('shared_key')).toBe(0.9);
    });
  });

  describe('SA alias handling', () => {
    it('adds SA alias when sexual_arousal is present', () => {
      const normalized = {
        moodAxes: {},
        sexualAxes: { sexual_arousal: 0.75 },
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('sexual_arousal')).toBe(0.75);
      expect(result.get('SA')).toBe(0.75);
    });

    it('does not add SA alias when sexual_arousal is absent', () => {
      const normalized = {
        moodAxes: { valence: 0.5 },
        sexualAxes: {},
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.has('SA')).toBe(false);
    });
  });

  describe('empty and missing axes handling', () => {
    it('handles empty axes objects', () => {
      const normalized = {
        moodAxes: {},
        sexualAxes: {},
        traitAxes: {},
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.size).toBe(0);
    });

    it('handles null axes gracefully', () => {
      const normalized = {
        moodAxes: null,
        sexualAxes: null,
        traitAxes: null,
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.size).toBe(0);
    });

    it('handles undefined axes gracefully', () => {
      const normalized = {
        moodAxes: undefined,
        sexualAxes: undefined,
        traitAxes: undefined,
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.size).toBe(0);
    });

    it('handles partial axes objects', () => {
      const normalized = {
        moodAxes: { valence: 0.5 },
        // sexualAxes and traitAxes are missing entirely
      };

      const result = flattenNormalizedAxes(normalized);

      expect(result.get('valence')).toBe(0.5);
      expect(result.size).toBe(1);
    });
  });
});

describe('resolveAxisValueFlat', () => {
  it('returns axis value from flat Map', () => {
    const flatMap = new Map([
      ['valence', 0.5],
      ['arousal', -0.3],
    ]);

    expect(resolveAxisValueFlat('valence', flatMap)).toBe(0.5);
    expect(resolveAxisValueFlat('arousal', flatMap)).toBe(-0.3);
  });

  it('returns 0 for missing axis', () => {
    const flatMap = new Map([['valence', 0.5]]);

    expect(resolveAxisValueFlat('nonexistent', flatMap)).toBe(0);
  });

  it('resolves SA alias to sexual_arousal', () => {
    const flatMap = new Map([['sexual_arousal', 0.75]]);

    expect(resolveAxisValueFlat('SA', flatMap)).toBe(0.75);
  });

  it('returns 0 when SA alias requested but sexual_arousal missing', () => {
    const flatMap = new Map([['valence', 0.5]]);

    expect(resolveAxisValueFlat('SA', flatMap)).toBe(0);
  });

  it('handles empty Map', () => {
    const flatMap = new Map();

    expect(resolveAxisValueFlat('valence', flatMap)).toBe(0);
  });
});
