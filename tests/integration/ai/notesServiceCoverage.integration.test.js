import { describe, expect, test } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import {
  DEFAULT_SUBJECT_TYPE,
  SUBJECT_TYPES,
} from '../../../src/constants/subjectTypes.js';

describe('NotesService integration coverage', () => {
  describe('normalizeNoteText', () => {
    test('returns empty string when provided value is not an object', () => {
      expect(normalizeNoteText(null)).toBe('');
      expect(normalizeNoteText('note')).toBe('');
      expect(normalizeNoteText(42)).toBe('');
    });

    test('normalizes structured notes by applying defaults and sanitizing text', () => {
      const normalized = normalizeNoteText({
        subject: 'Heroic Figure',
        text: '  Hello, WORLD!!  ',
      });

      expect(normalized).toBe('other:heroic figure: hello world');
    });

    test('normalizes unstructured notes using only the text content', () => {
      const normalized = normalizeNoteText({
        text: '  Multiple\n   spaces here  ',
      });

      expect(normalized).toBe('multiple spaces here');
    });

    test('returns an empty string when note text is missing', () => {
      expect(normalizeNoteText({})).toBe('');
      expect(normalizeNoteText({ text: '' })).toBe('');
    });
  });

  describe('addNotes', () => {
    test('throws a descriptive error when the notes component is malformed', () => {
      const service = new NotesService();

      expect(() => service.addNotes({}, [])).toThrow(TypeError);
      expect(() => service.addNotes({ notes: 'invalid' }, [])).toThrow(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      );
    });

    test('returns early without modification when new notes are not provided as an array', () => {
      const service = new NotesService();
      const component = { notes: [] };

      const result = service.addNotes(component, null);

      expect(result.wasModified).toBe(false);
      expect(result.addedNotes).toEqual([]);
      expect(component.notes).toHaveLength(0);
    });

    test('adds unique structured notes while skipping duplicates and invalid entries', () => {
      const service = new NotesService();
      const now = new Date('2025-01-01T12:34:56Z');
      const existingTimestamp = '2024-05-05T10:00:00.000Z';
      const explicitTimestamp = '2025-02-02T08:00:00.000Z';

      const component = {
        notes: [
          {
            text: 'Existing Insight',
            subject: 'Lorekeeper',
            subjectType: SUBJECT_TYPES.CHARACTER,
            timestamp: existingTimestamp,
          },
        ],
      };

      const result = service.addNotes(
        component,
        [
          // Duplicate entries in different formats
          {
            text: 'Existing Insight',
            subject: 'Lorekeeper',
            subjectType: SUBJECT_TYPES.CHARACTER,
            timestamp: '2020-01-01T00:00:00.000Z',
          },
          {
            text: '  existing insight!!  ',
            subject: 'Lorekeeper',
            subjectType: SUBJECT_TYPES.CHARACTER,
          },
          // Valid entry without explicit subject type or timestamp
          {
            text: '  Fresh Perspective  ',
            subject: 'Archivist',
          },
          // Valid entry with explicit metadata that should be preserved
          {
            text: 'Time Anchored',
            subject: 'Chronomancer',
            subjectType: SUBJECT_TYPES.KNOWLEDGE,
            context: 'Temporal anomaly investigation',
            timestamp: explicitTimestamp,
          },
          // Invalid entries that should be ignored
          {
            text: '   ',
            subject: 'EmptyText',
          },
          {
            text: 'Missing subject field',
            subjectType: SUBJECT_TYPES.EVENT,
          },
          'not-an-object',
          null,
        ],
        now
      );

      expect(result.wasModified).toBe(true);
      expect(result.addedNotes).toHaveLength(2);
      expect(component.notes).toHaveLength(3);

      const [defaultedNote, preservedNote] = result.addedNotes;

      expect(defaultedNote).toEqual({
        text: 'Fresh Perspective',
        subject: 'Archivist',
        subjectType: DEFAULT_SUBJECT_TYPE,
        context: undefined,
        timestamp: now.toISOString(),
      });

      expect(preservedNote).toEqual({
        text: 'Time Anchored',
        subject: 'Chronomancer',
        subjectType: SUBJECT_TYPES.KNOWLEDGE,
        context: 'Temporal anomaly investigation',
        timestamp: explicitTimestamp,
      });

      // Verify the added notes are the same instances stored on the component
      expect(component.notes[1]).toBe(defaultedNote);
      expect(component.notes[2]).toBe(preservedNote);
    });
  });
});
