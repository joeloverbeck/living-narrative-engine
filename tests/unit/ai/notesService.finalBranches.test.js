/**
 * @file Additional unit tests for NotesService to cover remaining edge branches.
 */

import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';

describe('NotesService additional branch coverage', () => {
  it('normalizeNoteText should return an empty string for non-object inputs', () => {
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText('not-an-object')).toBe('');
  });

  it('addNotes should throw when notesComp does not expose a notes array', () => {
    const service = new NotesService();
    expect(() => service.addNotes({}, [])).toThrow(TypeError);
    expect(() => service.addNotes({ notes: null }, [])).toThrow(TypeError);
  });

  it('addNotes should short-circuit when provided newNotes is not an array', () => {
    const service = new NotesService();
    const notesComp = { notes: [] };

    const result = service.addNotes(notesComp, undefined);

    expect(result).toEqual({
      wasModified: false,
      component: notesComp,
      addedNotes: [],
    });
  });

  it('addNotes should skip blank or duplicate structured notes while using defaults', () => {
    const service = new NotesService();
    const existingNote = {
      text: 'Existing Idea',
      subject: 'Memory',
      subjectType: 'custom',
      context: 'initial',
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    const notesComp = {
      notes: [existingNote, null, { text: 42 }],
    };

    const now = new Date('2024-02-02T10:00:00.000Z');

    const result = service.addNotes(
      notesComp,
      [
        { text: '   ', subject: 'Memory' },
        { text: 'Existing Idea', subject: 'Memory', subjectType: 'custom' },
        { text: 'Fresh insight', subject: 'Memory' },
        { invalid: true },
      ],
      now
    );

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(1);
    expect(result.addedNotes[0]).toMatchObject({
      text: 'Fresh insight',
      subject: 'Memory',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: now.toISOString(),
    });
    expect(result.addedNotes[0].context).toBeUndefined();

    expect(notesComp.notes).toContain(existingNote);
    expect(notesComp.notes).toContainEqual(result.addedNotes[0]);
    expect(notesComp.notes).toHaveLength(4);
  });
});
