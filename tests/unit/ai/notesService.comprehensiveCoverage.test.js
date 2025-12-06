import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import {
  DEFAULT_SUBJECT_TYPE,
  SUBJECT_TYPES,
} from '../../../src/constants/subjectTypes.js';

describe('normalizeNoteText', () => {
  it('returns an empty string for non-object inputs', () => {
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText(undefined)).toBe('');
    expect(normalizeNoteText('not an object')).toBe('');
  });

  it('normalizes structured notes including subject metadata', () => {
    const normalized = normalizeNoteText({
      subject: 'Ada Lovelace',
      subjectType: SUBJECT_TYPES.ENTITY,
      text: '  Calculates Analytical Engine output!  ',
    });

    expect(normalized).toBe(
      'entity:ada lovelace: calculates analytical engine output'
    );
  });

  it('falls back to the default subject type when none is provided', () => {
    const normalized = normalizeNoteText({
      subject: 'Orbital Mechanics',
      text: 'Refining the approach trajectory.',
    });

    expect(normalized).toBe(
      `${DEFAULT_SUBJECT_TYPE}:orbital mechanics:refining the approach trajectory`
    );
  });

  it('returns an empty string when both subject and text are missing', () => {
    expect(normalizeNoteText({})).toBe('');
  });

  it('collapses whitespace and strips punctuation for plain text notes', () => {
    const normalized = normalizeNoteText({
      text: '  Multiple!!!\nLines -- merged.  ',
    });

    expect(normalized).toBe('multiple lines merged');
  });
});

describe('NotesService.addNotes', () => {
  const service = new NotesService();

  it('throws when the notes component does not expose a notes array', () => {
    expect(() => service.addNotes({}, [])).toThrow(
      'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
    );
    expect(() => service.addNotes(null, [])).toThrow(TypeError);
  });

  it('returns early without modifications when newNotes is not an array', () => {
    const notesComp = { notes: [] };

    const result = service.addNotes(notesComp, null);

    expect(result).toEqual({
      wasModified: false,
      component: notesComp,
      addedNotes: [],
    });
    expect(notesComp.notes).toHaveLength(0);
  });

  it('skips invalid inputs, trims text, detects duplicates, and applies defaults', () => {
    const now = new Date('2024-02-02T02:02:02.000Z');
    const notesComp = {
      notes: [
        {
          text: 'Existing Insight',
          subject: 'Alpha',
          subjectType: SUBJECT_TYPES.CHARACTER,
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        {
          text: 42,
          subject: 'Numeric Artifact',
          subjectType: SUBJECT_TYPES.CONCEPT,
          timestamp: '2024-01-02T00:00:00.000Z',
        },
      ],
    };

    const newNotes = [
      {
        text: ' Existing insight!!! ',
        subject: 'Alpha',
        subjectType: SUBJECT_TYPES.CHARACTER,
      },
      {
        text: '   Fresh idea.   ',
        subject: 'Beta',
        context: 'briefing room',
      },
      { text: '   ', subject: 'Gamma' },
      'invalid entry',
      { text: 'Missing subject only' },
    ];

    const result = service.addNotes(notesComp, newNotes, now);

    expect(result.wasModified).toBe(true);
    expect(result.component).toBe(notesComp);
    expect(result.addedNotes).toHaveLength(1);

    const [addedNote] = result.addedNotes;
    expect(addedNote).toEqual({
      text: 'Fresh idea.',
      subject: 'Beta',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: 'briefing room',
      timestamp: now.toISOString(),
    });

    expect(notesComp.notes).toHaveLength(3);
    expect(notesComp.notes[2]).toBe(addedNote);
  });

  it('preserves provided timestamps on new entries', () => {
    const notesComp = {
      notes: [
        {
          text: 'Mission log',
          subject: 'Delta Station',
          subjectType: SUBJECT_TYPES.ENTITY,
          timestamp: '2024-02-01T00:00:00.000Z',
        },
      ],
    };

    const explicitTimestamp = '2024-03-03T10:15:30.000Z';
    const result = service.addNotes(notesComp, [
      {
        text: 'Incoming supply convoy confirmed.',
        subject: 'Delta Station',
        subjectType: SUBJECT_TYPES.ENTITY,
        timestamp: explicitTimestamp,
      },
    ]);

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toEqual([
      {
        text: 'Incoming supply convoy confirmed.',
        subject: 'Delta Station',
        subjectType: SUBJECT_TYPES.ENTITY,
        context: undefined,
        timestamp: explicitTimestamp,
      },
    ]);
  });
});
