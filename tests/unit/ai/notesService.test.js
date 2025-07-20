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

  test('should throw a TypeError for a malformed component', () => {
    const malformedComponent = { not_notes: [] };
    const newNotes = [{ text: 'Some note', subject: 'Test' }];

    expect(() => notesService.addNotes(malformedComponent, newNotes)).toThrow(
      TypeError
    );
  });
});
