import { describe, it, expect } from '@jest/globals';
import {
  formatSpecifyItemMessage,
  formatNounPhraseNotFoundMessage,
  formatNothingOfKindMessage,
} from '../../src/utils/messages.js';

describe('messages utility formatters', () => {
  describe('formatSpecifyItemMessage', () => {
    it('returns basic message when only itemType provided', () => {
      expect(formatSpecifyItemMessage('item')).toBe(
        'You need to specify which item.'
      );
    });

    it('includes domain details when provided', () => {
      expect(formatSpecifyItemMessage('item', 'from your inventory')).toBe(
        'You need to specify which item from your inventory.'
      );
    });

    it('trims domain details', () => {
      expect(formatSpecifyItemMessage('equipped item', '  here ')).toBe(
        'You need to specify which equipped item here.'
      );
    });
  });

  describe('formatNounPhraseNotFoundMessage', () => {
    it('uses default verb and context', () => {
      expect(
        formatNounPhraseNotFoundMessage('potion', 'in your inventory')
      ).toBe('You don\'t have "potion" in your inventory.');
    });

    it('overrides verb for here context', () => {
      expect(formatNounPhraseNotFoundMessage('potion', 'here')).toBe(
        'You don\'t see "potion" here.'
      );
    });

    it('respects custom verb option', () => {
      expect(
        formatNounPhraseNotFoundMessage('potion', 'equipped', {
          verb: 'carry',
        })
      ).toBe('You don\'t carry "potion" equipped.');
    });

    it('adds any prefix when requested and still overrides verb for here', () => {
      expect(
        formatNounPhraseNotFoundMessage('potion', 'here', {
          useAny: true,
        })
      ).toBe('You don\'t see any "potion" here.');
    });
  });

  describe('formatNothingOfKindMessage', () => {
    it('creates message with context', () => {
      expect(formatNothingOfKindMessage('in your inventory')).toBe(
        "You don't have anything like that in your inventory."
      );
    });
  });
});
