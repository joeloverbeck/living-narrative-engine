// tests/ai/notesService.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import NotesService, {
  normalizeNoteText,
} from '../../../src/ai/notesService.js';

describe('NotesService', () => {
  let notesService;
  let originalToISOString;

  beforeEach(() => {
    notesService = new NotesService();
    originalToISOString = Date.prototype.toISOString; // Stub date for consistent timestamps
  });

  afterEach(() => {
    Date.prototype.toISOString = originalToISOString;
    jest.restoreAllMocks();
  });

  test('should add a single valid note to an empty component', () => {
    const component = { notes: [] };
    const newNotes = [
      { text: 'First note', subject: 'Test Subject', subjectType: 'character' },
    ];
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS1');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component).toBe(component); // same reference returned
    expect(result.component.notes).toHaveLength(1);
    expect(result.component.notes[0]).toEqual({
      text: 'First note',
      subject: 'Test Subject',
      subjectType: 'character',
      timestamp: 'TS1',
    });
  });

  test('should add multiple unique notes', () => {
    const component = { notes: [] };
    const newNotes = [
      { text: 'Note A', subject: 'Subject A', subjectType: 'location' },
      { text: 'Note B', subject: 'Subject B', subjectType: 'event' },
    ];
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('TS_A')
      .mockReturnValueOnce('TS_B');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(2);
    expect(result.component.notes[0].text).toBe('Note A');
    expect(result.component.notes[0].subjectType).toBe('location');
    expect(result.component.notes[1].text).toBe('Note B');
    expect(result.component.notes[1].subjectType).toBe('event');
  });

  test('should not add notes that are duplicates of existing ones', () => {
    const component = {
      notes: [
        {
          text: 'Buy Milk',
          subject: 'Shopping',
          subjectType: 'other',
          timestamp: 'EXISTING_TS',
        },
      ],
    };
    const newNotes = [
      { text: 'buy milk', subject: 'shopping', subjectType: 'other' },
    ]; // Duplicate after normalization

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(false);
    expect(result.component).toBe(component); // reference should not change
    expect(result.component.notes).toHaveLength(1);
  });

  test('should assign default subjectType when not provided', () => {
    const component = { notes: [] };
    const newNotes = [
      { text: 'Note without subjectType', subject: 'Test Subject' },
    ];
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS1');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);
    expect(result.component.notes[0]).toEqual({
      text: 'Note without subjectType',
      subject: 'Test Subject',
      subjectType: 'other',
      timestamp: 'TS1',
    });
  });

  test('should not add notes that are duplicates within the new notes array', () => {
    const component = { notes: [] };
    const newNotes = [
      { text: 'Alpha', subject: 'Letter', subjectType: 'concept' },
      { text: 'Beta', subject: 'Letter', subjectType: 'concept' },
      { text: 'alpha', subject: 'letter', subjectType: 'concept' }, // Duplicate after normalization
    ];
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('TS_A')
      .mockReturnValueOnce('TS_B');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component).toBe(component); // same reference returned
    expect(result.component.notes).toHaveLength(2);
    expect(result.component.notes.map((n) => n.text)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  test('should return wasModified: false if no new unique notes are added', () => {
    const component = {
      notes: [
        { text: 'Existing Note', subject: 'Test', timestamp: 'EXISTING_TS' },
      ],
    };
    const newNotes = [{ text: 'Existing Note', subject: 'Test' }];

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(false);
    expect(result.component).toBe(component); // object reused
  });

  test('normalizeNoteText strips punctuation without affecting regular characters', () => {
    const input = {
      text: " Hello, world! It's great. ",
      subject: 'Greeting',
      subjectType: 'concept',
    };
    const normalized = normalizeNoteText(input);
    expect(normalized).toBe('concept:greeting: hello world its great');
  });

  test('normalizeNoteText uses default subjectType when not provided', () => {
    const input = { text: 'Test note', subject: 'Greeting' };
    const normalized = normalizeNoteText(input);
    expect(normalized).toBe('other:greeting:test note');
  });

  test('normalizeNoteText returns an empty fingerprint for non-object inputs', () => {
    expect(normalizeNoteText(null)).toBe('');
    expect(normalizeNoteText(undefined)).toBe('');
    expect(normalizeNoteText('not-a-note')).toBe('');
    expect(normalizeNoteText(42)).toBe('');
  });

  test('should throw a TypeError for a malformed component', () => {
    const malformedComponent = { not_notes: [] };
    const newNotes = [{ text: 'Some note', subject: 'Test' }];

    expect(() => notesService.addNotes(malformedComponent, newNotes)).toThrow(
      TypeError
    );
  });

  test('should ignore tags field if provided in input', () => {
    const component = { notes: [] };
    const newNotes = [
      {
        text: 'Note with tags',
        subject: 'Test Subject',
        subjectType: 'character',
        tags: ['tag1', 'tag2'], // Tags should be ignored
      },
    ];
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS1');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);
    expect(result.component.notes[0]).toEqual({
      text: 'Note with tags',
      subject: 'Test Subject',
      subjectType: 'character',
      timestamp: 'TS1',
    });
    // Verify tags are not included
    expect(result.component.notes[0].tags).toBeUndefined();
  });

  test('should return early when the new notes payload is not an array', () => {
    const component = {
      notes: [
        {
          text: 'Existing entry',
          subject: 'History',
          subjectType: 'other',
          timestamp: 'TS-existing',
        },
      ],
    };

    const result = notesService.addNotes(component, null);

    expect(result.wasModified).toBe(false);
    expect(result.addedNotes).toEqual([]);
    expect(component.notes).toEqual([
      {
        text: 'Existing entry',
        subject: 'History',
        subjectType: 'other',
        timestamp: 'TS-existing',
      },
    ]);
  });

  test('should skip notes whose text becomes empty after trimming', () => {
    const component = { notes: [] };
    const newNotes = [
      { text: '   ', subject: 'Whitespace only' },
      { text: '  Valid note  ', subject: 'Important', subjectType: 'event' },
    ];
    const fakeNow = { toISOString: jest.fn(() => 'TS-valid') };

    const result = notesService.addNotes(component, newNotes, fakeNow);

    expect(fakeNow.toISOString).toHaveBeenCalledTimes(2);
    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);
    expect(result.component.notes[0]).toMatchObject({
      text: 'Valid note',
      subject: 'Important',
      subjectType: 'event',
      timestamp: 'TS-valid',
    });
    expect(result.component.notes[0]).toHaveProperty('context', undefined);
  });

  test('should ignore malformed structured notes while preserving valid entries', () => {
    const component = { notes: [] };
    const newNotes = [
      { text: 'Missing subject' },
      { subject: 'Missing text' },
      {
        text: 'Recorded observation',
        subject: 'NPC',
        subjectType: 'character',
        context: 'Town square',
        timestamp: '2024-10-30T12:00:00Z',
      },
    ];

    const isoSpy = jest.spyOn(Date.prototype, 'toISOString');
    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);
    expect(result.component.notes[0]).toEqual({
      text: 'Recorded observation',
      subject: 'NPC',
      subjectType: 'character',
      context: 'Town square',
      timestamp: '2024-10-30T12:00:00Z',
    });
    expect(isoSpy).not.toHaveBeenCalled();
  });
});
