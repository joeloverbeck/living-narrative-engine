/**
 * @file Unit tests for noteFormatter.js - Structured Notes Format Only
 */

import { formatNotesForDisplay } from '../../../../src/turns/states/helpers/noteFormatter.js';

describe('formatNotesForDisplay', () => {
  describe('when notes is null or undefined', () => {
    it('returns null for null input', () => {
      expect(formatNotesForDisplay(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(formatNotesForDisplay(undefined)).toBeNull();
    });
  });

  describe('when notes is a single structured note object', () => {
    it('formats note with text and subject', () => {
      const note = { text: 'Simple note content', subject: 'Character' };
      expect(formatNotesForDisplay(note)).toBe(
        'Character: Simple note content'
      );
    });

    it('formats note with all structured fields', () => {
      const note = {
        text: 'Detailed observation',
        subject: 'Character',
        subjectType: 'person',
        context: 'during conversation',
        tags: ['personality', 'mood'],
        timestamp: '2023-01-01T00:00:00Z',
      };
      expect(formatNotesForDisplay(note)).toBe(
        '[person] Character: Detailed observation (during conversation) [personality, mood]'
      );
    });

    it('formats note with partial structured fields', () => {
      const note = {
        text: 'Basic observation',
        subject: 'Location',
        context: 'explored',
      };
      expect(formatNotesForDisplay(note)).toBe(
        'Location: Basic observation (explored)'
      );
    });

    it('returns null for note object without text', () => {
      const note = { subject: 'Character', timestamp: '2023-01-01T00:00:00Z' };
      expect(formatNotesForDisplay(note)).toBeNull();
    });

    it('returns null for note object with empty text', () => {
      const note = { text: '', subject: 'Character' };
      expect(formatNotesForDisplay(note)).toBeNull();
    });

    it('returns null for note object with whitespace-only text', () => {
      const note = { text: '   ', subject: 'Character' };
      expect(formatNotesForDisplay(note)).toBeNull();
    });

    it('formats note without subject but with text', () => {
      const note = { text: 'Simple note content' };
      expect(formatNotesForDisplay(note)).toBe('Simple note content');
    });

    it('filters out empty tags', () => {
      const note = {
        text: 'Test note',
        subject: 'Test',
        tags: ['valid', '', '  ', 'another', null, undefined],
      };
      expect(formatNotesForDisplay(note)).toBe(
        'Test: Test note [valid, another]'
      );
    });

    it('trims whitespace from subject and context', () => {
      const note = {
        text: 'Test note',
        subject: '  Character  ',
        context: '  during battle  ',
      };
      expect(formatNotesForDisplay(note)).toBe(
        'Character: Test note (during battle)'
      );
    });

    it('handles empty tags array', () => {
      const note = {
        text: 'Test note',
        subject: 'Character',
        tags: [],
      };
      expect(formatNotesForDisplay(note)).toBe('Character: Test note');
    });
  });

  describe('when notes is an array of structured notes', () => {
    it('formats array of structured note objects', () => {
      const notes = [
        { text: 'First observation', subject: 'Character' },
        {
          text: 'Second observation',
          subject: 'Location',
          context: 'explored',
        },
      ];
      expect(formatNotesForDisplay(notes)).toBe(
        'Character: First observation\nLocation: Second observation (explored)'
      );
    });

    it('formats array with complex structured notes', () => {
      const notes = [
        {
          text: 'Seems friendly',
          subject: 'John',
          subjectType: 'character',
          context: 'first meeting',
          tags: ['personality'],
        },
        {
          text: 'Dark and mysterious',
          subject: 'Cavern',
          subjectType: 'location',
          tags: ['atmosphere', 'danger'],
        },
      ];
      expect(formatNotesForDisplay(notes)).toBe(
        '[character] John: Seems friendly (first meeting) [personality]\n[location] Cavern: Dark and mysterious [atmosphere, danger]'
      );
    });

    it('filters out empty and invalid notes from array', () => {
      const notes = [
        { text: 'Valid note', subject: 'Character' },
        { text: '' }, // Empty text - should be filtered
        { text: 'Another valid note', subject: 'Location' },
        null, // Invalid - should be filtered
        undefined, // Invalid - should be filtered
        { invalidProperty: 'value' }, // No text - should be filtered
        { text: '   ' }, // Whitespace only - should be filtered
      ];
      expect(formatNotesForDisplay(notes)).toBe(
        'Character: Valid note\nLocation: Another valid note'
      );
    });

    it('returns null for array with no valid notes', () => {
      const notes = [
        { text: '' },
        null,
        undefined,
        { invalidProperty: 'value' },
        { text: '   ' },
      ];
      expect(formatNotesForDisplay(notes)).toBeNull();
    });

    it('returns null for empty array', () => {
      const notes = [];
      expect(formatNotesForDisplay(notes)).toBeNull();
    });
  });

  describe('when notes has invalid type', () => {
    it('returns null for string input (legacy format not supported)', () => {
      expect(formatNotesForDisplay('valid note')).toBeNull();
    });

    it('returns null for number input', () => {
      expect(formatNotesForDisplay(123)).toBeNull();
    });

    it('returns null for boolean input', () => {
      expect(formatNotesForDisplay(true)).toBeNull();
    });
  });
});
