import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';

describe('normalizeNoteText – completeness edge cases', () => {
  it('trims, lowercases, and collapses whitespace when no subject metadata is provided', () => {
    const normalized = normalizeNoteText({
      text: '  Mixed\nSpacing  And Punctuation!!!  ',
    });
    expect(normalized).toBe('mixed spacing and punctuation');
  });

  it('returns an empty string when provided with non-object input', () => {
    expect(normalizeNoteText(undefined)).toBe('');
    expect(normalizeNoteText(42)).toBe('');
  });
});

describe('NotesService.addNotes – duplicate and validation handling', () => {
  const createService = () => new NotesService();

  it('throws when the notes component is missing or malformed', () => {
    const service = createService();
    expect(() => service.addNotes(null, [])).toThrow(TypeError);
    expect(() => service.addNotes({ notes: 'not-an-array' }, [])).toThrow(
      TypeError
    );
  });

  it('skips invalid entries and duplicates while appending a normalized structured note', () => {
    const service = createService();
    const now = new Date('2024-12-31T23:59:59.000Z');
    const notesComp = {
      notes: [
        {
          text: 'Existing Fact',
          subject: 'Lore',
          subjectType: 'concept',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
        null,
        { text: 123, subject: 'Numbers', subjectType: 'concept' },
      ],
    };

    const result = service.addNotes(
      notesComp,
      [
        { text: ' Existing Fact ', subject: 'Lore', subjectType: 'concept' },
        { text: '   ', subject: 'EmptyThought', subjectType: 'concept' },
        null,
        5,
        {
          text: 'Fresh Idea!',
          subject: 'Alliance',
          context: 'council meeting',
        },
      ],
      now
    );

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(1);
    const [added] = result.addedNotes;

    expect(added).toEqual({
      text: 'Fresh Idea!',
      subject: 'Alliance',
      subjectType: DEFAULT_SUBJECT_TYPE,
      context: 'council meeting',
      timestamp: now.toISOString(),
    });

    expect(notesComp.notes).toHaveLength(4);
    expect(notesComp.notes[notesComp.notes.length - 1]).toBe(added);
  });
});
