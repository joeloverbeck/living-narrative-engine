/**
 * @file Unit tests for expression test utilities.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_SEXUAL_KEYS,
  DEFAULT_EMOTION_KEYS,
  ensurePrototypeKeys,
  collectExpressionStateKeys,
  buildStateMap,
} from '../../common/expressionTestUtils.js';

describe('expressionTestUtils', () => {
  describe('DEFAULT_SEXUAL_KEYS', () => {
    it('exports a non-empty array of sexual state keys', () => {
      expect(Array.isArray(DEFAULT_SEXUAL_KEYS)).toBe(true);
      expect(DEFAULT_SEXUAL_KEYS.length).toBeGreaterThan(0);
    });

    it('contains expected default sexual keys', () => {
      expect(DEFAULT_SEXUAL_KEYS).toContain('sex_excitation');
      expect(DEFAULT_SEXUAL_KEYS).toContain('sex_inhibition');
      expect(DEFAULT_SEXUAL_KEYS).toContain('baseline_libido');
    });

    it('contains only strings', () => {
      DEFAULT_SEXUAL_KEYS.forEach((key) => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });

  describe('DEFAULT_EMOTION_KEYS', () => {
    it('exports a non-empty array of emotion keys', () => {
      expect(Array.isArray(DEFAULT_EMOTION_KEYS)).toBe(true);
      expect(DEFAULT_EMOTION_KEYS.length).toBeGreaterThan(0);
    });

    it('contains expected default emotion keys', () => {
      expect(DEFAULT_EMOTION_KEYS).toContain('joy');
      expect(DEFAULT_EMOTION_KEYS).toContain('sadness');
      expect(DEFAULT_EMOTION_KEYS).toContain('anger');
      expect(DEFAULT_EMOTION_KEYS).toContain('fear');
      expect(DEFAULT_EMOTION_KEYS).toContain('disgust');
      expect(DEFAULT_EMOTION_KEYS).toContain('surprise');
    });

    it('contains only strings', () => {
      DEFAULT_EMOTION_KEYS.forEach((key) => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ensurePrototypeKeys', () => {
    const fallbackKeys = ['fallback1', 'fallback2'];

    describe('when collectedKeys is non-empty', () => {
      it('returns collectedKeys unchanged', () => {
        const collected = ['key1', 'key2', 'key3'];
        const result = ensurePrototypeKeys(collected, fallbackKeys);
        expect(result).toBe(collected);
        expect(result).toEqual(['key1', 'key2', 'key3']);
      });

      it('returns collectedKeys even with single element', () => {
        const collected = ['onlyKey'];
        const result = ensurePrototypeKeys(collected, fallbackKeys);
        expect(result).toBe(collected);
      });
    });

    describe('when collectedKeys is empty', () => {
      it('returns fallbackKeys for empty array', () => {
        const result = ensurePrototypeKeys([], fallbackKeys);
        expect(result).toBe(fallbackKeys);
      });
    });

    describe('when collectedKeys is null or undefined', () => {
      it('returns fallbackKeys for null', () => {
        const result = ensurePrototypeKeys(null, fallbackKeys);
        expect(result).toBe(fallbackKeys);
      });

      it('returns fallbackKeys for undefined', () => {
        const result = ensurePrototypeKeys(undefined, fallbackKeys);
        expect(result).toBe(fallbackKeys);
      });
    });

    describe('integration with DEFAULT_* constants', () => {
      it('works with DEFAULT_SEXUAL_KEYS as fallback', () => {
        const emptyCollected = [];
        const result = ensurePrototypeKeys(emptyCollected, DEFAULT_SEXUAL_KEYS);
        expect(result).toBe(DEFAULT_SEXUAL_KEYS);
        expect(result).toContain('sex_excitation');
      });

      it('works with DEFAULT_EMOTION_KEYS as fallback', () => {
        const emptyCollected = [];
        const result = ensurePrototypeKeys(emptyCollected, DEFAULT_EMOTION_KEYS);
        expect(result).toBe(DEFAULT_EMOTION_KEYS);
        expect(result).toContain('joy');
      });
    });
  });

  describe('collectExpressionStateKeys', () => {
    it('extracts emotion keys from var references', () => {
      const expressions = [
        { prerequisites: [{ logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } }] },
        { prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } }] },
      ];

      const { emotionKeys, sexualKeys } = collectExpressionStateKeys(expressions);

      expect(emotionKeys).toContain('anger');
      expect(emotionKeys).toContain('joy');
      expect(sexualKeys).toHaveLength(0);
    });

    it('extracts sexual keys from var references', () => {
      const expressions = [
        { prerequisites: [{ logic: { '>=': [{ var: 'sexualStates.lust' }, 0.4] } }] },
      ];

      const { emotionKeys, sexualKeys } = collectExpressionStateKeys(expressions);

      expect(sexualKeys).toContain('lust');
      expect(emotionKeys).toHaveLength(0);
    });

    it('returns empty arrays when no state references exist', () => {
      const expressions = [
        { prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } }] },
      ];

      const { emotionKeys, sexualKeys } = collectExpressionStateKeys(expressions);

      expect(emotionKeys).toHaveLength(0);
      expect(sexualKeys).toHaveLength(0);
    });

    it('deduplicates keys across expressions', () => {
      const expressions = [
        { prerequisites: [{ logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } }] },
        { prerequisites: [{ logic: { '>=': [{ var: 'emotions.anger' }, 0.7] } }] },
      ];

      const { emotionKeys } = collectExpressionStateKeys(expressions);

      expect(emotionKeys.filter((k) => k === 'anger')).toHaveLength(1);
    });
  });

  describe('buildStateMap', () => {
    it('creates a Map with all keys set to 0 by default', () => {
      const keys = ['key1', 'key2', 'key3'];
      const map = buildStateMap(keys);

      expect(map.size).toBe(3);
      expect(map.get('key1')).toBe(0);
      expect(map.get('key2')).toBe(0);
      expect(map.get('key3')).toBe(0);
    });

    it('applies overrides to specific keys', () => {
      const keys = ['joy', 'anger', 'fear'];
      const map = buildStateMap(keys, { joy: 0.5, anger: 0.3 });

      expect(map.get('joy')).toBe(0.5);
      expect(map.get('anger')).toBe(0.3);
      expect(map.get('fear')).toBe(0);
    });

    it('works with DEFAULT_SEXUAL_KEYS', () => {
      const map = buildStateMap(DEFAULT_SEXUAL_KEYS);

      expect(map.size).toBe(DEFAULT_SEXUAL_KEYS.length);
      DEFAULT_SEXUAL_KEYS.forEach((key) => {
        expect(map.get(key)).toBe(0);
      });
    });

    it('works with DEFAULT_EMOTION_KEYS', () => {
      const map = buildStateMap(DEFAULT_EMOTION_KEYS);

      expect(map.size).toBe(DEFAULT_EMOTION_KEYS.length);
      DEFAULT_EMOTION_KEYS.forEach((key) => {
        expect(map.get(key)).toBe(0);
      });
    });
  });
});
