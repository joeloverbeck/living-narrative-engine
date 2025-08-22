import { describe, test, expect, jest } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';

/** Additional tests for NotesService to increase branch coverage. */

describe('NotesService additional coverage', () => {
  test('throws when notes property is not an array', () => {
    const service = new NotesService({ autoMigrate: false });
    const badComp = { notes: 'not-an-array' };
    const validNote = { text: 'x', subject: 'test' };
    expect(() => service.addNotes(badComp, [validNote])).toThrow(TypeError);
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
    const comp = {
      notes: [{ text: 'hello there', subject: 'test', timestamp: 'T1' }],
    };
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('T2')
      .mockReturnValueOnce('T3')
      .mockReturnValueOnce('T4');

    const result = service.addNotes(comp, [
      { text: 'Hello there!', subject: 'test' },
      { text: 'Bye.', subject: 'other' },
      { text: 'hello   there', subject: 'test' },
    ]);

    expect(result.wasModified).toBe(true);
    // Both 'Hello there!' and 'hello   there' are considered duplicates of the existing entry after
    // normalization (because they have the same subject:text combo), so only 'Bye.' is added.
    expect(comp.notes).toHaveLength(2);
    expect(comp.notes[1]).toEqual({
      text: 'Bye.',
      subject: 'other',
      subjectType: 'other',
      context: undefined,
      timestamp: 'T3',
    });
    expect(result.addedNotes).toEqual([
      {
        text: 'Bye.',
        subject: 'other',
        subjectType: 'other',
        context: undefined,
        timestamp: 'T3',
      },
    ]);
  });
});
