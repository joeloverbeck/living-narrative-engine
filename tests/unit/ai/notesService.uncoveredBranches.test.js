import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';

describe('notesService uncovered branches', () => {
  it('returns an empty string when normalizeNoteText receives a non-object input', () => {
    expect(normalizeNoteText('not-an-object')).toBe('');
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText(undefined)).toBe('');
  });

  it('normalizes unstructured notes by falling back to text content only', () => {
    const normalized = normalizeNoteText({ text: '  Mixed CASE !!!  ' });
    expect(normalized).toBe('mixed case ');
    expect(normalized.endsWith(' ')).toBe(true);
  });

  it('returns empty output when neither subject nor text are provided', () => {
    expect(normalizeNoteText({ text: '', subject: undefined })).toBe('');
  });

  it('throws a descriptive error when the notes component is missing or malformed', () => {
    const service = new NotesService();

    expect(() => service.addNotes(null, [])).toThrow(
      new TypeError(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      )
    );

    expect(() => service.addNotes({ notes: 'not-an-array' }, [])).toThrow(
      TypeError
    );
  });

  it('returns the original component untouched when newNotes is not an array', () => {
    const service = new NotesService();
    const notesComp = { notes: [] };

    const result = service.addNotes(notesComp, null);

    expect(result).toEqual({
      wasModified: false,
      component: notesComp,
      addedNotes: [],
    });
    expect(notesComp.notes).toHaveLength(0);
  });

  it('builds the existing note set, skips invalid inputs, and defaults values when adding', () => {
    const service = new NotesService();
    const existingNotes = [
      { text: 'Existing Insight', subject: 'quest', subjectType: 'quest' },
      null,
      { text: null, subject: 'quest' },
    ];
    const notesComp = { notes: [...existingNotes] };
    const now = new Date('2024-04-05T12:30:45.000Z');

    const newNotes = [
      { text: '   ', subject: 'quest' },
      { text: 'existing insight', subject: 'quest', subjectType: 'quest' },
      { text: 'Fresh Clue', subject: 'quest', context: 'dialogue' },
      {
        text: 'Custom Timestamp',
        subject: 'ally',
        subjectType: 'character',
        timestamp: '2023-01-02T03:04:05.000Z',
      },
      { text: 'Missing subject only' },
      'completely invalid',
    ];

    const result = service.addNotes(notesComp, newNotes, now);

    expect(result.wasModified).toBe(true);
    expect(result.component).toBe(notesComp);
    expect(result.addedNotes).toHaveLength(2);

    const [firstAdded, secondAdded] = result.addedNotes;
    expect(firstAdded).toEqual({
      text: 'Fresh Clue',
      subject: 'quest',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: 'dialogue',
      timestamp: now.toISOString(),
    });
    expect(secondAdded).toEqual({
      text: 'Custom Timestamp',
      subject: 'ally',
      subjectType: 'character',
      context: undefined,
      timestamp: '2023-01-02T03:04:05.000Z',
    });

    expect(notesComp.notes).toContainEqual(firstAdded);
    expect(notesComp.notes).toContainEqual(secondAdded);
    expect(notesComp.notes.length).toBe(
      existingNotes.length + result.addedNotes.length
    );
  });
});
