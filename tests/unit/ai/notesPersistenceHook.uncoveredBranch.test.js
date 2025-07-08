import { describe, it, expect, jest } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

/**
 * Covers branch where actor entity lacks an id when notes field is not an array.
 */
describe('persistNotes missing actor id branch', () => {
  it('dispatches error with UNKNOWN_ACTOR when actor has no id', () => {
    const actor = { components: {} };
    const dispatcher = { dispatch: jest.fn() };
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    persistNotes({ notes: 'oops' }, actor, logger, dispatcher);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          "NotesPersistenceHook: 'notes' field is not an array; skipping merge",
        details: { actorId: 'UNKNOWN_ACTOR' },
      })
    );
  });
});
