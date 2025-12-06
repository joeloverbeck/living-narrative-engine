import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';

describe('notesService additional uncovered paths', () => {
  describe('normalizeNoteText edge cases', () => {
    it('returns empty string for non-object inputs', () => {
      expect(normalizeNoteText(undefined)).toBe('');
      expect(normalizeNoteText('plain string')).toBe('');
    });

    it('normalizes notes without a subject using raw text', () => {
      const normalized = normalizeNoteText({ text: '  Just SOME Text!!  ' });
      expect(normalized).toBe('just some text');
    });

    it('falls back to empty text when subjectless note has no text field', () => {
      expect(normalizeNoteText({})).toBe('');
    });
  });

  describe('addNotes branch coverage', () => {
    it('throws when the notes component is malformed', () => {
      const service = new NotesService();
      expect(() => service.addNotes(null, [])).toThrow(TypeError);
      expect(() => service.addNotes({ notes: 'not-an-array' }, [])).toThrow(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      );
    });

    it('returns early without modification when new notes are not iterable', () => {
      const service = new NotesService();
      const component = { notes: [] };

      const result = service.addNotes(component, undefined);

      expect(result).toEqual({
        wasModified: false,
        component,
        addedNotes: [],
      });
      expect(component.notes).toEqual([]);
    });

    it('filters existing notes, skips duplicates and whitespace-only entries before adding', () => {
      const service = new NotesService();
      const now = new Date('2025-01-02T03:04:05.000Z');
      const notesComp = {
        notes: [
          null,
          {
            text: 'Existing Fact',
            subject: 'Lore',
            subjectType: 'concept',
            timestamp: '2024-12-01T00:00:00.000Z',
          },
          {
            text: 42,
            subject: 'Trivia',
            timestamp: '2024-12-02T00:00:00.000Z',
          },
        ],
      };

      const result = service.addNotes(
        notesComp,
        [
          null,
          { text: '   ', subject: 'Ignored' },
          { text: ' existing FACT ', subject: 'Lore', subjectType: 'concept' },
          {
            text: 'Fresh Insight ',
            subject: 'Lore',
            context: 'council chamber',
          },
        ],
        now
      );

      expect(result.wasModified).toBe(true);
      expect(result.addedNotes).toHaveLength(1);

      const [addedNote] = result.addedNotes;
      expect(addedNote).toEqual({
        text: 'Fresh Insight',
        subject: 'Lore',
        subjectType: DEFAULT_SUBJECT_TYPE,
        context: 'council chamber',
        timestamp: now.toISOString(),
      });

      expect(notesComp.notes).toHaveLength(4);
      expect(notesComp.notes[3]).toEqual(addedNote);
    });
  });
});
