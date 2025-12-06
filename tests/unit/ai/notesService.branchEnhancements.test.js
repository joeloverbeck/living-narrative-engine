import { describe, it, expect } from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';

describe('normalizeNoteText additional branches', () => {
  it('handles notes without subjects by normalizing plain text', () => {
    const normalized = normalizeNoteText({ text: '  Danger?? Approaches!  ' });
    expect(normalized).toBe('danger approaches');
  });

  it('returns an empty string when subject and usable text are missing', () => {
    const normalized = normalizeNoteText({ text: '   ' });
    expect(normalized).toBe('');
  });
});

describe('NotesService.addNotes additional scenarios', () => {
  const createComponent = () => ({
    notes: [
      {
        text: 'Existing Insight',
        subject: 'Alliance',
        subjectType: 'concept',
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ],
  });

  it('throws a descriptive error when the component structure is invalid', () => {
    const service = new NotesService();

    expect(() => service.addNotes(null, [])).toThrow(
      'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
    );
    expect(() => service.addNotes({ notes: 'not-an-array' }, [])).toThrow(
      TypeError
    );
  });

  it('skips duplicates and invalid note entries while adding valid notes', () => {
    const service = new NotesService();
    const notesComp = createComponent();
    const now = new Date('2025-02-03T04:05:06.000Z');

    const result = service.addNotes(
      notesComp,
      [
        // Duplicate of the existing entry - should be ignored
        {
          text: 'existing insight',
          subject: 'Alliance',
          subjectType: 'concept',
        },
        // Invalid formats that should be ignored without throwing
        'just a string',
        { text: 'Missing subject only' },
        // Valid structured note that should be persisted
        {
          text: '  New diplomatic channel established. ',
          subject: 'Diplomacy',
          subjectType: 'event',
          context: 'Report from embassy',
        },
      ],
      now
    );

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(1);

    const [added] = result.addedNotes;
    expect(added).toMatchObject({
      text: 'New diplomatic channel established.',
      subject: 'Diplomacy',
      subjectType: 'event',
      context: 'Report from embassy',
      timestamp: now.toISOString(),
    });

    // Ensure duplicate and invalid entries did not mutate the component
    expect(notesComp.notes).toHaveLength(2);
    expect(notesComp.notes[1]).toEqual(added);
  });

  it('ignores duplicates that appear within the batch of new notes', () => {
    const service = new NotesService();
    const notesComp = { notes: [] };
    const now = new Date('2025-05-06T07:08:09.000Z');

    const result = service.addNotes(
      notesComp,
      [
        {
          text: 'A new rumor surfaces',
          subject: 'Rumor',
          subjectType: 'story',
        },
        {
          text: '  a new rumor surfaces  ',
          subject: 'Rumor',
          subjectType: 'story',
        },
      ],
      now
    );

    expect(result.wasModified).toBe(true);
    expect(result.addedNotes).toHaveLength(1);
    expect(notesComp.notes).toHaveLength(1);
    expect(result.addedNotes[0].timestamp).toBe(now.toISOString());
  });

  it('ignores duplicates supplied in subsequent addNotes calls', () => {
    const service = new NotesService();
    const notesComp = { notes: [] };
    const now = new Date('2025-07-08T09:10:11.000Z');

    service.addNotes(
      notesComp,
      [
        {
          text: 'Shared intelligence',
          subject: 'Report',
          subjectType: 'intel',
        },
      ],
      now
    );

    const duplicateAttempt = service.addNotes(
      notesComp,
      [
        {
          text: 'shared intelligence',
          subject: 'Report',
          subjectType: 'intel',
        },
      ],
      now
    );

    expect(duplicateAttempt.wasModified).toBe(false);
    expect(duplicateAttempt.addedNotes).toHaveLength(0);
    expect(notesComp.notes).toHaveLength(1);
  });
});
