import { describe, expect, it } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';

const createNotesComponent = () => ({
  notes: [
    {
      text: 'Anchor fact',
      subject: 'History',
      subjectType: 'chronicle',
      timestamp: '2024-01-02T03:04:05.000Z',
    },
  ],
});

describe('NotesService additional coverage', () => {
  describe('normalizeNoteText', () => {
    it('handles entries without subjects by normalizing raw text only', () => {
      const normalized = normalizeNoteText({
        text: '  Loose memory about allies.  ',
      });

      expect(normalized).toBe('loose memory about allies');
    });

    it('falls back to an empty string when no text value is present', () => {
      expect(normalizeNoteText({ text: '', subject: undefined })).toBe('');
      expect(normalizeNoteText({})).toBe('');
    });
  });

  describe('addNotes', () => {
    it('throws a descriptive error when the component lacks a notes array', () => {
      const service = new NotesService();

      expect(() => service.addNotes({}, [])).toThrow(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      );
      expect(() => service.addNotes({ notes: 'not-an-array' }, [])).toThrow(
        TypeError
      );
      expect(() => service.addNotes(null, [])).toThrow(TypeError);
    });

    it('skips structured notes that trim to an empty string and ignores unsupported entries', () => {
      const service = new NotesService();
      const component = createNotesComponent();
      const now = new Date('2025-06-07T08:09:10.000Z');

      const payload = [
        { text: '   ', subject: 'Placeholder' },
        { text: 'Has text but no subject' },
        'totally invalid',
        null,
      ];

      const result = service.addNotes(component, payload, now);

      expect(result.wasModified).toBe(false);
      expect(result.addedNotes).toEqual([]);
      expect(component.notes).toHaveLength(1);
    });
  });
});
