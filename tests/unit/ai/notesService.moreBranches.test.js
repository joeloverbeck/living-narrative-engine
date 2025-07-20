import { describe, test, expect, jest } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';

/**
 * Additional tests to improve branch coverage for NotesService.addNotes.
 */

describe('NotesService.addNotes more branches', () => {
  test('skips entries that are not valid structured notes but adds valid ones', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [] };
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS');

    const invalidObject = { trim: () => 'should-ignore' };
    const validNote = { text: 'ok', subject: 'test_subject' };
    const result = service.addNotes(comp, [invalidObject, validNote]);

    expect(result.wasModified).toBe(true);
    expect(comp.notes).toEqual([{ text: 'ok', subject: 'test_subject', context: undefined, tags: undefined, timestamp: 'TS' }]);
  });

  test('existing notes with non-string text are ignored when checking duplicates', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = {
      notes: [{ text: 42 }], // non-string should be ignored during duplicate check
    };
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('T');

    const validNote = { text: 'hello', subject: 'test_subject' };
    const result = service.addNotes(comp, [validNote]);

    expect(result.wasModified).toBe(true);
    expect(comp.notes).toHaveLength(2);
    expect(comp.notes[1]).toEqual({ text: 'hello', subject: 'test_subject', context: undefined, tags: undefined, timestamp: 'T' });
  });
});
