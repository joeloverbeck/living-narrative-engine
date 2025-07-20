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

  it('skips invalid structured notes while adding valid ones', () => {
    const service = new NotesService({ autoMigrate: false });
    const comp = { notes: [] };
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS');

    const invalidNote = { trim: () => 'x' };
    const blankNote = { text: ' ', subject: 'test' };
    const validNote = { text: 'note', subject: 'test_subject' };
    const result = service.addNotes(comp, [invalidNote, blankNote, validNote]);

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toEqual([
      {
        text: 'note',
        subject: 'test_subject',
        subjectType: 'other',
        context: undefined,
        tags: undefined,
        timestamp: 'TS',
      },
    ]);
    expect(comp.notes).toEqual([
      {
        text: 'note',
        subject: 'test_subject',
        subjectType: 'other',
        context: undefined,
        tags: undefined,
        timestamp: 'TS',
      },
    ]);
  });
});
