/**
 * @file Unit tests for statusEffectUtils
 * @see src/domUI/damage-simulator/statusEffectUtils.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  EFFECT_COMPONENTS,
  EFFECT_EMOJIS,
  EFFECT_CSS_CLASSES,
  capitalize,
  getActiveEffects,
  formatEffectTooltip,
  generateEffectIconsHTML,
} from '../../../../src/domUI/damage-simulator/statusEffectUtils.js';

describe('statusEffectUtils', () => {
  describe('constants', () => {
    it('defines EFFECT_COMPONENTS mappings', () => {
      expect(EFFECT_COMPONENTS).toEqual({
        bleeding: 'anatomy:bleeding',
        burning: 'anatomy:burning',
        poisoned: 'anatomy:poisoned',
        fractured: 'anatomy:fractured',
        dismembered: 'anatomy:dismembered',
      });
    });

    it('defines EFFECT_EMOJIS mappings', () => {
      expect(EFFECT_EMOJIS).toEqual({
        bleeding: '🩸',
        burning: '🔥',
        poisoned: '☠️',
        fractured: '🦴',
        dismembered: '✂️',
      });
    });

    it('defines EFFECT_CSS_CLASSES mappings', () => {
      expect(EFFECT_CSS_CLASSES).toEqual({
        container: 'ds-part-effects',
        base: 'ds-effect',
        bleeding: 'ds-effect-bleeding',
        burning: 'ds-effect-burning',
        poisoned: 'ds-effect-poisoned',
        fractured: 'ds-effect-fractured',
        dismembered: 'ds-effect-dismembered',
      });
    });

    it('freezes constants', () => {
      expect(Object.isFrozen(EFFECT_COMPONENTS)).toBe(true);
      expect(Object.isFrozen(EFFECT_EMOJIS)).toBe(true);
      expect(Object.isFrozen(EFFECT_CSS_CLASSES)).toBe(true);
    });
  });

  describe('capitalize', () => {
    it('capitalizes the first letter', () => {
      expect(capitalize('bleeding')).toBe('Bleeding');
    });

    it('returns empty string for empty input', () => {
      expect(capitalize('')).toBe('');
    });

    it('handles single characters', () => {
      expect(capitalize('a')).toBe('A');
    });
  });

  describe('getActiveEffects', () => {
    it('returns empty array for invalid components', () => {
      expect(getActiveEffects(null)).toEqual([]);
      expect(getActiveEffects(undefined)).toEqual([]);
      expect(getActiveEffects('not-an-object')).toEqual([]);
    });

    it('returns empty array when no effects exist', () => {
      expect(getActiveEffects({ 'anatomy:part': {} })).toEqual([]);
    });

    it('extracts a single effect', () => {
      const components = {
        'anatomy:bleeding': { severity: 'minor', remainingTurns: 2 },
        'anatomy:part': {},
      };
      expect(getActiveEffects(components)).toEqual([
        { type: 'bleeding', data: components['anatomy:bleeding'] },
      ]);
    });

    it('extracts multiple effects', () => {
      const components = {
        'anatomy:bleeding': { severity: 'major', remainingTurns: 3 },
        'anatomy:poisoned': { remainingTurns: 5 },
        'anatomy:part': {},
      };
      expect(getActiveEffects(components)).toEqual([
        { type: 'bleeding', data: components['anatomy:bleeding'] },
        { type: 'poisoned', data: components['anatomy:poisoned'] },
      ]);
    });

    it('extracts dismembered effect', () => {
      const components = {
        'anatomy:dismembered': { sourceDamageType: 'slashing' },
        'anatomy:part': {},
      };
      expect(getActiveEffects(components)).toEqual([
        { type: 'dismembered', data: components['anatomy:dismembered'] },
      ]);
    });

    it('ignores non-effect components', () => {
      const components = {
        'anatomy:part': {},
      };
      expect(getActiveEffects(components)).toEqual([]);
    });
  });

  describe('formatEffectTooltip', () => {
    it('formats bleeding with severity and turns', () => {
      expect(
        formatEffectTooltip('bleeding', {
          severity: 'minor',
          remainingTurns: 2,
        })
      ).toBe('Bleeding (minor, 2 turns)');
    });

    it('formats bleeding with default severity', () => {
      expect(formatEffectTooltip('bleeding', {})).toBe('Bleeding (unknown)');
    });

    it('formats burning with turns and stacks', () => {
      expect(
        formatEffectTooltip('burning', {
          remainingTurns: 2,
          stackedCount: 3,
        })
      ).toBe('Burning (2 turns, x3)');
    });

    it('omits burning stacks when single stack', () => {
      expect(
        formatEffectTooltip('burning', {
          remainingTurns: 1,
          stackedCount: 1,
        })
      ).toBe('Burning (1 turns)');
    });

    it('formats burning with name only when no details', () => {
      expect(formatEffectTooltip('burning', {})).toBe('Burning');
    });

    it('formats poisoned with turns', () => {
      expect(
        formatEffectTooltip('poisoned', {
          remainingTurns: 4,
        })
      ).toBe('Poisoned (4 turns)');
    });

    it('formats poisoned with name only when no turns', () => {
      expect(formatEffectTooltip('poisoned', {})).toBe('Poisoned');
    });

    it('formats fractured with name only', () => {
      expect(formatEffectTooltip('fractured', {})).toBe('Fractured');
    });

    it('formats dismembered with name only', () => {
      expect(formatEffectTooltip('dismembered', {})).toBe('Dismembered');
    });

    it('formats dismembered ignoring extra data', () => {
      expect(
        formatEffectTooltip('dismembered', { sourceDamageType: 'slashing' })
      ).toBe('Dismembered');
    });

    it('falls back to display name for unknown effects', () => {
      expect(formatEffectTooltip('stunned', {})).toBe('Stunned');
    });
  });

  describe('generateEffectIconsHTML', () => {
    const escapeHtml = (value) =>
      String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    it('returns empty string for missing effects', () => {
      expect(generateEffectIconsHTML(null, escapeHtml)).toBe('');
      expect(generateEffectIconsHTML([], escapeHtml)).toBe('');
    });

    it('generates HTML for a single effect', () => {
      const html = generateEffectIconsHTML(
        [
          {
            type: 'bleeding',
            data: { severity: 'minor', remainingTurns: 2 },
          },
        ],
        escapeHtml
      );

      expect(html).toBe(
        '<div class="ds-part-effects">' +
          '<span class="ds-effect ds-effect-bleeding" title="Bleeding (minor, 2 turns)">🩸</span>' +
          '</div>'
      );
    });

    it('generates HTML for multiple effects', () => {
      const html = generateEffectIconsHTML(
        [
          {
            type: 'burning',
            data: { remainingTurns: 1, stackedCount: 2 },
          },
          {
            type: 'fractured',
            data: {},
          },
        ],
        escapeHtml
      );

      expect(html).toContain('<div class="ds-part-effects">');
      expect(html).toContain('ds-effect ds-effect-burning');
      expect(html).toContain('Burning (1 turns, x2)');
      expect(html).toContain('ds-effect ds-effect-fractured');
      expect(html).toContain('Fractured');
    });

    it('generates HTML for dismembered effect', () => {
      const html = generateEffectIconsHTML(
        [
          {
            type: 'dismembered',
            data: { sourceDamageType: 'slashing' },
          },
        ],
        escapeHtml
      );

      expect(html).toBe(
        '<div class="ds-part-effects">' +
          '<span class="ds-effect ds-effect-dismembered" title="Dismembered">✂️</span>' +
          '</div>'
      );
    });

    it('escapes tooltip content', () => {
      const html = generateEffectIconsHTML(
        [
          {
            type: 'bleeding',
            data: { severity: '<script>', remainingTurns: 1 },
          },
        ],
        escapeHtml
      );

      expect(html).toContain('Bleeding (&lt;script&gt;, 1 turns)');
      expect(html).not.toContain('<script>');
    });

    it('falls back when escapeHtml is not provided', () => {
      const html = generateEffectIconsHTML(
        [
          {
            type: 'stunned',
            data: {},
          },
        ],
        null
      );

      expect(html).toBe(
        '<div class="ds-part-effects">' +
          '<span class="ds-effect" title="Stunned"></span>' +
          '</div>'
      );
    });
  });
});
