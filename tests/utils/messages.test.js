import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(),
}));

import { getEntityDisplayName } from '../../src/utils/entityUtils.js';
import {
  formatSpecifyItemMessage,
  formatNounPhraseNotFoundMessage,
  formatNothingOfKindMessage,
  TARGET_MESSAGES,
} from '../../src/utils/messages.js';

beforeEach(() => {
  jest.clearAllMocks();
});

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

    it('ignores blank domain details', () => {
      expect(formatSpecifyItemMessage('item', '   ')).toBe(
        'You need to specify which item.'
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

    it('handles undefined context gracefully', () => {
      expect(formatNounPhraseNotFoundMessage('orb', undefined)).toBe(
        'You don\'t have "orb" .'
      );
    });
  });

  describe('formatNothingOfKindMessage', () => {
    it('creates message with context', () => {
      expect(formatNothingOfKindMessage('in your inventory')).toBe(
        "You don't have anything like that in your inventory."
      );
    });

    it('handles missing context', () => {
      expect(formatNothingOfKindMessage()).toBe(
        "You don't have anything like that ."
      );
    });
  });

  describe('TARGET_MESSAGES helpers', () => {
    it('formats target not found message', () => {
      expect(TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT('door')).toBe(
        "Could not find 'door' nearby to target."
      );
    });

    it('builds ambiguous target list using getEntityDisplayName', () => {
      getEntityDisplayName.mockImplementation((entity) => `Name-${entity.id}`);
      const entities = [{ id: 'e1' }, { id: 'e2' }];
      const result = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(
        'use potion on',
        'potion',
        entities
      );
      expect(result).toBe(
        "Which 'potion' did you want to use potion on? (Name-e1, Name-e2)"
      );
      expect(getEntityDisplayName).toHaveBeenCalledTimes(2);
      expect(getEntityDisplayName).toHaveBeenNthCalledWith(
        1,
        entities[0],
        'e1'
      );
      expect(getEntityDisplayName).toHaveBeenNthCalledWith(
        2,
        entities[1],
        'e2'
      );
    });

    it('lists direction options or fallback', () => {
      expect(
        TARGET_MESSAGES.AMBIGUOUS_DIRECTION('west', [
          'West Gate',
          'Western Arch',
        ])
      ).toBe(
        "There are multiple ways to go 'west'. Which one did you mean: West Gate, Western Arch?"
      );

      expect(TARGET_MESSAGES.AMBIGUOUS_DIRECTION('north', [])).toBe(
        "There are multiple ways to go 'north'. Which one did you mean: unspecified options?"
      );
    });
  });
});
