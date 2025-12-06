import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';

describe('normalizeNoteText', () => {
  it('includes subject metadata and normalizes punctuation and spacing', () => {
    const normalized = normalizeNoteText({
      text: '  The Hero ARRIVED!!! ',
      subject: 'Arrival',
      subjectType: 'event',
    });

    expect(normalized).toBe('event:arrival: the hero arrived');
  });

  it('falls back gracefully when provided a non-object value', () => {
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText('not a note')).toBe('');
  });

  it('normalizes plain text when subject metadata is not present', () => {
    const normalized = normalizeNoteText({ text: '  Mixed CASE text!  ' });

    expect(normalized).toBe('mixed case text');
  });

  it('returns an empty string when both subject and text are absent', () => {
    expect(normalizeNoteText({ context: 'metadata only' })).toBe('');
  });
});

describe('NotesService.addNotes', () => {
  const baseComponent = () => ({
    notes: [
      {
        text: 'Existing fact',
        subject: 'Lore',
        subjectType: 'concept',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    ],
  });

  it('adds structured notes, skips duplicates, and fills in defaults', () => {
    const service = new NotesService();
    const notesComp = baseComponent();
    const now = new Date('2025-03-04T05:06:07.000Z');

    const result = service.addNotes(
      notesComp,
      [
        // Duplicate of existing note should be ignored after normalization
        { text: 'existing fact', subject: 'Lore', subjectType: 'concept' },
        {
          text: '  New Insight about allies.  ',
          subject: 'Alliance',
          // subjectType omitted to trigger DEFAULT_SUBJECT_TYPE logic
          context: 'learned from council meeting',
        },
      ],
      now
    );

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(1);
    const added = result.addedNotes[0];
    expect(added).toMatchObject({
      text: 'New Insight about allies.',
      subject: 'Alliance',
      subjectType: 'other',
      context: 'learned from council meeting',
    });
    expect(added.timestamp).toBe(now.toISOString());
    // The component should have been mutated in place with the new note appended.
    expect(notesComp.notes).toHaveLength(2);
    expect(notesComp.notes[1]).toEqual(added);
  });

  it('returns an unchanged payload when new notes are not provided as an array', () => {
    const service = new NotesService();
    const notesComp = baseComponent();

    const result = service.addNotes(notesComp, null);

    expect(result.wasModified).toBe(false);
    expect(result.addedNotes).toEqual([]);
    expect(result.component).toBe(notesComp);
    expect(notesComp.notes).toHaveLength(1);
  });

  it('throws a descriptive TypeError when the component does not expose a notes array', () => {
    const service = new NotesService();

    expect(() => service.addNotes({ notes: null }, [])).toThrow(
      new TypeError(
        'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
      )
    );
    expect(() => service.addNotes(null, [])).toThrow(TypeError);
  });

  it('skips notes that trim down to empty text or that are missing required fields', () => {
    const service = new NotesService();
    const notesComp = baseComponent();
    const now = new Date('2025-05-05T05:05:05.000Z');

    const result = service.addNotes(
      notesComp,
      [
        { text: '   ', subject: 'BlankEntry' },
        { text: 'Missing subject' },
        'not an object',
      ],
      now
    );

    expect(result.wasModified).toBe(false);
    expect(result.addedNotes).toEqual([]);
    expect(notesComp.notes).toHaveLength(1);
  });

  it('uses the provided timestamp and subject type when supplied', () => {
    const service = new NotesService();
    const notesComp = baseComponent();

    const explicitTimestamp = '2026-06-07T08:09:10.000Z';
    const result = service.addNotes(notesComp, [
      {
        text: 'Reinforcement ETA confirmed',
        subject: 'Logistics',
        subjectType: 'report',
        timestamp: explicitTimestamp,
        context: 'Filed by quartermaster',
      },
    ]);

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(1);
    expect(result.addedNotes[0]).toMatchObject({
      timestamp: explicitTimestamp,
      subjectType: 'report',
      context: 'Filed by quartermaster',
    });
    expect(notesComp.notes[1]).toEqual(result.addedNotes[0]);
  });
});
