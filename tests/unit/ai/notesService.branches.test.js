import { describe, test, expect, jest, afterEach } from '@jest/globals';
import NotesService from '../../../src/ai/notesService.js';

/**
 * Additional branch coverage for NotesService.addNotes.
 */

describe('NotesService.addNotes additional branches', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns early when newNotesText is not an array', () => {
    const service = new NotesService();
    const component = { notes: [] };

    const result = service.addNotes(component, 'not-an-array');

    expect(result).toEqual({ wasModified: false, component, addedNotes: [] });
    expect(component.notes).toHaveLength(0);
  });

  test('ignores blank note entries', () => {
    const service = new NotesService();
    const component = { notes: [] };
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('TS');

    const result = service.addNotes(component, ['  ', ' Valid Note ', '']);

    expect(result.wasModified).toBe(true);
    expect(component.notes).toEqual([{ text: 'Valid Note', timestamp: 'TS' }]);
  });
});
