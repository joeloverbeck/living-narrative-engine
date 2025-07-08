import { describe, test, expect, jest } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';

/** Additional branch coverage for NotesService.addNotes. */
describe('NotesService extra branch coverage', () => {
  test('returns early when newNotesText is null', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [] };

    const result = service.addNotes(comp, null);

    expect(result).toEqual({
      wasModified: false,
      component: comp,
      addedNotes: [],
    });
    expect(comp.notes).toHaveLength(0);
  });

  test('ignores blank or non-string entries but adds valid ones', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [] };
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS');

    const oddObject = { trim: () => 'ignored' };
    const result = service.addNotes(comp, ['  ', oddObject, ' Ok ']);

    expect(result.wasModified).toBe(true);
    expect(comp.notes).toEqual([{ text: 'Ok', timestamp: 'TS' }]);
  });
});
