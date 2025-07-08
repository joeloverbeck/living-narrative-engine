import { describe, test, expect, jest } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';

/** Additional tests for NotesService to increase branch coverage. */

describe('NotesService additional coverage', () => {
  test('throws when notes property is not an array', () => {
    const service = new NotesService({ autoMigrate: false });
    const badComp = { notes: 'not-an-array' };
    expect(() => service.addNotes(badComp, ['x'])).toThrow(TypeError);
  });

  test('returns early when newNotesText is undefined', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [] };
    const result = service.addNotes(comp, undefined);
    expect(result).toEqual({
      wasModified: false,
      component: comp,
      addedNotes: [],
    });
    expect(comp.notes).toHaveLength(0);
  });

  test('handles mixture of duplicates and punctuation differences', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [{ text: 'hello there', timestamp: 'T1' }] };
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('T2')
      .mockReturnValueOnce('T3')
      .mockReturnValueOnce('T4');

    const result = service.addNotes(comp, [
      'Hello there!',
      'Bye.',
      'hello   there',
    ]);

    expect(result.wasModified).toBe(true);
    // 'Hello there!' is considered a duplicate of the existing entry after
    // normalization, so only 'Bye.' is added.
    expect(comp.notes).toHaveLength(2);
    expect(comp.notes[1]).toEqual({ text: 'Bye.', timestamp: 'T3' });
    expect(result.addedNotes).toEqual([{ text: 'Bye.', timestamp: 'T3' }]);
  });
});
