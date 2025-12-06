import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';

describe('normalizeNoteText edge cases', () => {
  it('returns an empty string when given a non-object value', () => {
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText(undefined)).toBe('');
    expect(normalizeNoteText('note')).toBe('');
  });

  it('normalizes text when the subject is missing', () => {
    const raw = '  Mixed CASE text!  ';
    expect(normalizeNoteText({ text: raw })).toBe('mixed case text');
  });

  it('returns an empty string when both subject and text are missing', () => {
    expect(normalizeNoteText({ some: 'value' })).toBe('');
  });

  it('falls back to an empty string when the text field is absent', () => {
    expect(normalizeNoteText({ subject: '', subjectType: 'character' })).toBe(
      ''
    );
  });
});

describe('NotesService branch coverage', () => {
  it('throws a TypeError when the component lacks a notes array', () => {
    const service = new NotesService();
    expect(() => service.addNotes({}, [])).toThrow(TypeError);
  });

  it('returns early without modification when newNotes is not an array', () => {
    const service = new NotesService();
    const component = { notes: [] };
    const result = service.addNotes(component, null);

    expect(result).toEqual({ wasModified: false, component, addedNotes: [] });
    expect(component.notes).toHaveLength(0);
  });

  it('skips invalid or empty entries and prefers provided timestamps', () => {
    const service = new NotesService();
    const component = {
      notes: [
        null,
        { text: 42 },
        {
          text: 'Existing',
          subject: 'Topic',
          subjectType: 'concept',
          timestamp: 'EXISTING',
        },
      ],
    };

    const result = service.addNotes(component, [
      { text: '   ', subject: 'Topic' },
      {
        text: 'Valid Note',
        subject: 'Topic',
        subjectType: 'concept',
        timestamp: 'CUSTOM',
        context: 'ctx',
      },
      { text: 'valid note!!! ', subject: 'topic', subjectType: 'concept' },
      'ignore-me',
    ]);

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toEqual([
      {
        text: 'Valid Note',
        subject: 'Topic',
        subjectType: 'concept',
        context: 'ctx',
        timestamp: 'CUSTOM',
      },
    ]);

    // Component keeps its original entries plus the single valid addition
    expect(component.notes).toHaveLength(4);
    expect(component.notes[component.notes.length - 1]).toEqual(
      result.addedNotes[0]
    );
  });
});
