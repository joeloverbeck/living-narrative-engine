import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../src/utils/entityUtils.js', () => ({
  getEntityDisplayName: jest.fn(),
}));

import { getEntityDisplayName } from '../../src/utils/entityUtils.js';
import { TARGET_MESSAGES } from '../../src/utils/messages.js';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('messages utility formatters', () => {
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
