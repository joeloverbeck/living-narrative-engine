// tests/ai/notesService.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import NotesService from '../../src/ai/notesService.js';

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
    const newNotes = ['First note'];
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS1');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(1);
    expect(result.component.notes[0]).toEqual({
      text: 'First note',
      timestamp: 'TS1',
    });
  });

  test('should add multiple unique notes', () => {
    const component = { notes: [] };
    const newNotes = ['Note A', 'Note B'];
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('TS_A')
      .mockReturnValueOnce('TS_B');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(2);
    expect(result.component.notes[0].text).toBe('Note A');
    expect(result.component.notes[1].text).toBe('Note B');
  });

  test('should not add notes that are duplicates of existing ones', () => {
    const component = {
      notes: [{ text: 'Buy Milk', timestamp: 'EXISTING_TS' }],
    };
    const newNotes = ['buy milk']; // Duplicate after normalization

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(false);
    expect(result.component.notes).toHaveLength(1);
  });

  test('should not add notes that are duplicates within the new notes array', () => {
    const component = { notes: [] };
    const newNotes = ['Alpha', 'Beta', 'alpha']; // 'alpha' is a duplicate of 'Alpha'
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('TS_A')
      .mockReturnValueOnce('TS_B');

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(true);
    expect(result.component.notes).toHaveLength(2);
    expect(result.component.notes.map((n) => n.text)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  test('should return wasModified: false if no new unique notes are added', () => {
    const component = {
      notes: [{ text: 'Existing Note', timestamp: 'EXISTING_TS' }],
    };
    const newNotes = ['Existing Note'];

    const result = notesService.addNotes(component, newNotes);

    expect(result.wasModified).toBe(false);
  });

  test('should throw a TypeError for a malformed component', () => {
    const malformedComponent = { not_notes: [] };
    const newNotes = ['Some note'];

    expect(() => notesService.addNotes(malformedComponent, newNotes)).toThrow(
      TypeError
    );
  });
});
