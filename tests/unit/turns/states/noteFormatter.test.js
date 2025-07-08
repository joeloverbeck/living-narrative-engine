/**
 * @file Unit tests for noteFormatter.js
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

  describe('when notes is a string', () => {
    it('returns trimmed string for valid string input', () => {
      expect(formatNotesForDisplay('  valid note  ')).toBe('valid note');
    });

    it('returns null for empty string', () => {
      expect(formatNotesForDisplay('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(formatNotesForDisplay('   ')).toBeNull();
    });
  });

  describe('when notes is a simple note object', () => {
    it('formats simple note with text only', () => {
      const note = { text: 'Simple note content' };
      expect(formatNotesForDisplay(note)).toBe('Simple note content');
    });

    it('formats simple note with text and timestamp', () => {
      const note = { 
        text: 'Simple note content', 
        timestamp: '2023-01-01T00:00:00Z' 
      };
      expect(formatNotesForDisplay(note)).toBe('Simple note content');
    });

    it('returns null for note object without text', () => {
      const note = { timestamp: '2023-01-01T00:00:00Z' };
      expect(formatNotesForDisplay(note)).toBeNull();
    });

    it('returns null for note object with empty text', () => {
      const note = { text: '' };
      expect(formatNotesForDisplay(note)).toBeNull();
    });

    it('returns null for note object with whitespace-only text', () => {
      const note = { text: '   ' };
      expect(formatNotesForDisplay(note)).toBeNull();
    });
  });

  describe('when notes is a structured note object', () => {
    it('formats structured note with subject', () => {
      const note = {
        text: 'Character seems suspicious',
        subject: 'Merchant',
        timestamp: '2023-01-01T00:00:00Z'
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious');
    });

    it('formats structured note with subject and context', () => {
      const note = {
        text: 'Character seems suspicious',
        subject: 'Merchant',
        context: 'during conversation',
        timestamp: '2023-01-01T00:00:00Z'
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious (during conversation)');
    });

    it('formats structured note with subject, context, and tags', () => {
      const note = {
        text: 'Character seems suspicious',
        subject: 'Merchant',
        context: 'during conversation',
        tags: ['behavior', 'suspicious'],
        timestamp: '2023-01-01T00:00:00Z'
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious (during conversation) [behavior, suspicious]');
    });

    it('formats structured note with tags only', () => {
      const note = {
        text: 'Character seems suspicious',
        subject: 'Merchant',
        tags: ['behavior', 'suspicious']
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious [behavior, suspicious]');
    });

    it('handles empty arrays in tags', () => {
      const note = {
        text: 'Character seems suspicious',
        subject: 'Merchant',
        tags: []
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious');
    });

    it('filters out empty strings from tags', () => {
      const note = {
        text: 'Character seems suspicious',
        subject: 'Merchant',
        tags: ['behavior', '', 'suspicious', '   ']
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious [behavior, suspicious]');
    });

    it('handles whitespace in subject and context', () => {
      const note = {
        text: '  Character seems suspicious  ',
        subject: '  Merchant  ',
        context: '  during conversation  '
      };
      expect(formatNotesForDisplay(note)).toBe('Merchant: Character seems suspicious (during conversation)');
    });
  });

  describe('when notes is an array', () => {
    it('formats array of string notes', () => {
      const notes = ['First note', 'Second note'];
      expect(formatNotesForDisplay(notes)).toBe('First note\nSecond note');
    });

    it('formats array of simple note objects', () => {
      const notes = [
        { text: 'First note' },
        { text: 'Second note' }
      ];
      expect(formatNotesForDisplay(notes)).toBe('First note\nSecond note');
    });

    it('formats array of structured note objects', () => {
      const notes = [
        { text: 'First observation', subject: 'Character' },
        { text: 'Second observation', subject: 'Location', context: 'explored' }
      ];
      expect(formatNotesForDisplay(notes)).toBe('Character: First observation\nLocation: Second observation (explored)');
    });

    it('formats mixed array of strings and objects', () => {
      const notes = [
        'String note',
        { text: 'Object note', subject: 'Subject' },
        { text: 'Another note' }
      ];
      expect(formatNotesForDisplay(notes)).toBe('String note\nSubject: Object note\nAnother note');
    });

    it('filters out empty and invalid notes from array', () => {
      const notes = [
        'Valid note',
        '',
        { text: '' },
        { text: 'Another valid note' },
        null,
        undefined,
        { invalidProperty: 'value' }
      ];
      expect(formatNotesForDisplay(notes)).toBe('Valid note\nAnother valid note');
    });

    it('returns null for empty array', () => {
      expect(formatNotesForDisplay([])).toBeNull();
    });

    it('returns null for array with only invalid notes', () => {
      const notes = ['', '   ', { text: '' }, null, undefined];
      expect(formatNotesForDisplay(notes)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles non-object, non-string, non-array input', () => {
      expect(formatNotesForDisplay(123)).toBeNull();
      expect(formatNotesForDisplay(true)).toBeNull();
      expect(formatNotesForDisplay(Symbol('test'))).toBeNull();
    });

    it('handles object with non-string text property', () => {
      const note = { text: 123 };
      expect(formatNotesForDisplay(note)).toBeNull();
    });

    it('handles object with non-string subject property', () => {
      const note = { text: 'Valid text', subject: 123 };
      expect(formatNotesForDisplay(note)).toBe('Valid text');
    });

    it('handles object with non-string context property', () => {
      const note = { text: 'Valid text', subject: 'Subject', context: 123 };
      expect(formatNotesForDisplay(note)).toBe('Subject: Valid text');
    });

    it('handles object with non-array tags property', () => {
      const note = { text: 'Valid text', subject: 'Subject', tags: 'not-array' };
      expect(formatNotesForDisplay(note)).toBe('Subject: Valid text');
    });
  });
});