import { describe, expect, it } from '@jest/globals';
import NotesService, { normalizeNoteText } from '../../../src/ai/notesService.js';
import {
  DEFAULT_SUBJECT_TYPE,
  SUBJECT_TYPES,
} from '../../../src/constants/subjectTypes.js';

/**
 * These tests exercise NotesService with realistic note payloads to ensure the
 * duplicate detection logic and timestamp/subject-type normalization behave the
 * same way they do when invoked through the persistence hook.
 */
describe('NotesService duplicate merging integration', () => {
  it('merges structured notes while skipping duplicates and invalid payloads', () => {
    const notesService = new NotesService();
    const now = new Date('2025-05-05T05:05:05.000Z');

    const notesComponent = {
      notes: [
        {
          text: 'Existing Insight',
          subject: 'Lorekeeper',
          subjectType: SUBJECT_TYPES.ENTITY,
          timestamp: '2024-04-04T04:04:04.000Z',
        },
        // Entries that should be ignored by the pre-build filter
        null,
        { text: 42, subject: 'Invalid Type' },
      ],
    };

    const newNotes = [
      // Duplicate via punctuation/casing differences and same subjectType
      {
        text: '   existing insight!!!   ',
        subject: 'Lorekeeper',
        subjectType: SUBJECT_TYPES.ENTITY,
        timestamp: '2021-01-01T00:00:00.000Z',
      },
      // NOT a duplicate - defaults to OTHER which is different from existing ENTITY type
      {
        text: 'Existing Insight',
        subject: 'Lorekeeper',
      },
      // Valid entry that should be trimmed and default the subject type
      {
        text: '   New Clue Discovered   ',
        subject: 'Investigation',
        context: 'Filed by Detective',
      },
      // Valid entry with explicit metadata that must be preserved
      {
        text: 'Check the archives',
        subject: 'Records Office',
        subjectType: SUBJECT_TYPES.ENTITY,
        timestamp: '2025-03-03T03:03:03.000Z',
      },
      // Blank text after trimming should be skipped
      {
        text: '   ',
        subject: 'Whitespace Only',
      },
      // Missing subject should be skipped silently
      {
        text: 'Missing subject field',
        subjectType: SUBJECT_TYPES.EVENT,
      },
      // Completely invalid payloads are ignored
      'not-an-object',
      undefined,
    ];

    const result = notesService.addNotes(notesComponent, newNotes, now);

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(3);
    expect(notesComponent.notes).toHaveLength(6);
    expect(notesComponent.notes.slice(-3)).toEqual(result.addedNotes);

    const [duplicateTextDifferentType, defaultedNote, preservedNote] = result.addedNotes;

    expect(duplicateTextDifferentType).toEqual({
      text: 'Existing Insight',
      subject: 'Lorekeeper',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: undefined,
      timestamp: now.toISOString(),
    });

    expect(defaultedNote).toEqual({
      text: 'New Clue Discovered',
      subject: 'Investigation',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: 'Filed by Detective',
      timestamp: now.toISOString(),
    });

    expect(preservedNote).toEqual({
      text: 'Check the archives',
      subject: 'Records Office',
      subjectType: SUBJECT_TYPES.ENTITY,
      context: undefined,
      timestamp: '2025-03-03T03:03:03.000Z',
    });

    // Validate that normalization includes subject and subject type to prevent cross-subject collisions
    const normalizedExisting = normalizeNoteText(notesComponent.notes[0]);
    const normalizedDuplicateTextDifferentType = normalizeNoteText(duplicateTextDifferentType);
    const normalizedDefaulted = normalizeNoteText(defaultedNote);
    const normalizedPreserved = normalizeNoteText(preservedNote);

    expect(normalizedExisting).toBe('entity:lorekeeper:existing insight');
    expect(normalizedDuplicateTextDifferentType).toBe('other:lorekeeper:existing insight');
    expect(normalizedDefaulted).toBe('other:investigation:new clue discovered');
    expect(normalizedPreserved).toBe('entity:records office:check the archives');
  });

  it('returns early without modification when provided notes collection is malformed', () => {
    const notesService = new NotesService();
    const malformedComponent = { notes: 'not-an-array' };

    expect(() => notesService.addNotes(malformedComponent, [])).toThrow(
      'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
    );

    const safeResult = notesService.addNotes({ notes: [] }, 'not-an-array');
    expect(safeResult.wasModified).toBe(false);
    expect(safeResult.addedNotes).toEqual([]);
  });

  it('returns an empty normalized string when given non-object values', () => {
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText('note')).toBe('');
    expect(normalizeNoteText(123)).toBe('');
  });
});
