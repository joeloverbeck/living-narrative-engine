import { describe, it, expect, jest } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';

describe('NotesService uncovered branches', () => {
  it('returns early when newNotesText is null', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [{ text: 'old', timestamp: 'T0' }] };
    const result = service.addNotes(comp, null);
    expect(result).toEqual({
      wasModified: false,
      component: comp,
      addedNotes: [],
    });
    expect(comp.notes).toHaveLength(1);
  });

  it('skips non-string and blank notes while adding valid ones', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [] };
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS');

    const notString = { trim: () => 'x' };
    const result = service.addNotes(comp, [notString, ' ', 'note']);

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toEqual([{ text: 'note', timestamp: 'TS' }]);
    expect(comp.notes).toEqual([{ text: 'note', timestamp: 'TS' }]);
  });
});
