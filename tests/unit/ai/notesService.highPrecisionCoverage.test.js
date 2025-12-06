import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';

/**
 * Additional focused coverage for src/ai/notesService.js.
 * These scenarios target normalization fallbacks and the edge conditions inside
 * NotesService.addNotes that were previously only partially exercised.
 */
describe('NotesService normalization and mutation edge cases', () => {
  describe('normalizeNoteText', () => {
    it('returns an empty string for anything that is not a structured note object', () => {
      expect(normalizeNoteText(null)).toBe('');
      expect(normalizeNoteText(undefined)).toBe('');
      expect(normalizeNoteText('plain string')).toBe('');
      expect(normalizeNoteText(42)).toBe('');
    });

    it('falls back to raw text when no subject is provided and collapses whitespace/punctuation', () => {
      const normalized = normalizeNoteText({
        text: '  Lots   of   Noise!!! ',
      });

      expect(normalized).toBe('lots of noise');
    });

    it('includes default subjectType when subject metadata is present but type is omitted', () => {
      const normalized = normalizeNoteText({
        text: ' Strategic Overview ',
        subject: 'Battle Plan',
      });

      expect(normalized).toBe(
        `${DEFAULT_SUBJECT_TYPE}:battle plan: strategic overview`
      );
    });

    it('returns an empty string when subject metadata is missing and text is blank', () => {
      expect(
        normalizeNoteText({
          text: '',
        })
      ).toBe('');

      expect(
        normalizeNoteText({
          text: null,
        })
      ).toBe('');
    });
  });

  describe('NotesService.addNotes', () => {
    it('throws a descriptive error when the notes component structure is invalid', () => {
      const service = new NotesService();

      expect(() => service.addNotes({}, [])).toThrow(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      );
      expect(() => service.addNotes({ notes: null }, [])).toThrow(TypeError);
    });

    it('returns early without modification when newNotes is not an array', () => {
      const service = new NotesService();
      const component = { notes: [] };

      const result = service.addNotes(component, undefined);

      expect(result).toEqual({
        wasModified: false,
        component,
        addedNotes: [],
      });
    });

    it('skips malformed or duplicate entries while preserving sanitized additions', () => {
      const service = new NotesService();
      const existingNote = {
        text: 'Existing Fact',
        subject: 'Lore',
        subjectType: 'concept',
        context: 'seed',
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      const component = { notes: [existingNote, null, { text: 123 }] };
      const now = new Date('2025-02-03T04:05:06.000Z');

      const result = service.addNotes(
        component,
        [
          null, // ignored - not an object
          { text: 'Missing subject', subject: '' }, // subject must be truthy
          { text: '   ', subject: 'WhitespaceOnly' }, // becomes empty after trim
          { text: 'existing fact!!!', subject: 'Lore', subjectType: 'concept' }, // duplicate after normalization
          {
            text: ' Fresh perspective??? ',
            subject: 'Alliance',
            subjectType: 'relationship',
            context: 'debrief',
            timestamp: '2025-02-01T00:00:00.000Z',
          },
          {
            text: 'New observation   about allies',
            subject: 'Alliance',
            context: 'summary notes',
          },
        ],
        now
      );

      expect(result.wasModified).toBe(true);
      expect(result.addedNotes).toHaveLength(2);

      const [withProvidedTimestamp, withDefaults] = result.addedNotes;

      expect(withProvidedTimestamp).toEqual({
        text: 'Fresh perspective???',
        subject: 'Alliance',
        subjectType: 'relationship',
        context: 'debrief',
        timestamp: '2025-02-01T00:00:00.000Z',
      });

      expect(withDefaults).toEqual({
        text: 'New observation   about allies',
        subject: 'Alliance',
        subjectType: DEFAULT_SUBJECT_TYPE,
        context: 'summary notes',
        timestamp: now.toISOString(),
      });

      // Notes array is mutated in place and contains the surviving entries.
      expect(component.notes).toHaveLength(5);
      expect(component.notes[0]).toBe(existingNote);
      expect(component.notes[1]).toBeNull();
      expect(component.notes[2]).toEqual({ text: 123 });
      expect(component.notes[3]).toEqual(withProvidedTimestamp);
      expect(component.notes[4]).toEqual(withDefaults);

      // Normalization should treat both valid additions as unique even when
      // punctuation or spacing differ compared to existing notes.
      const normalizedSet = new Set(
        component.notes
          .filter((note) => note && typeof note.text === 'string')
          .map((note) => normalizeNoteText(note))
      );
      expect(normalizedSet.size).toBe(3);
      expect(normalizedSet).toContain('concept:lore:existing fact');
      expect(normalizedSet).toContain(
        'relationship:alliance:fresh perspective'
      );
      expect(normalizedSet).toContain(
        `${DEFAULT_SUBJECT_TYPE}:alliance:new observation about allies`
      );
    });
  });
});
