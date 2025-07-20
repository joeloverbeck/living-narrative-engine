/**
 * @file Tests for noteFormatter helper function
 * @see src/turns/states/helpers/noteFormatter.js
 */

import { describe, it, expect } from '@jest/globals';
import { formatNotesForDisplay } from '../../../../../src/turns/states/helpers/noteFormatter.js';

describe('formatNotesForDisplay', () => {
  describe('null and undefined handling', () => {
    it('should return null for null input', () => {
      expect(formatNotesForDisplay(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(formatNotesForDisplay(undefined)).toBeNull();
    });
  });

  describe('string notes', () => {
    it('should return trimmed string for non-empty string', () => {
      expect(formatNotesForDisplay('  Some note  ')).toBe('Some note');
    });

    it('should return null for empty string', () => {
      expect(formatNotesForDisplay('')).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      expect(formatNotesForDisplay('   ')).toBeNull();
    });
  });

  describe('array notes', () => {
    it('should format array of string notes', () => {
      const notes = ['Note 1', 'Note 2', 'Note 3'];
      const result = formatNotesForDisplay(notes);
      expect(result).toBe('Note 1\nNote 2\nNote 3');
    });

    it('should format array of object notes with all fields', () => {
      const notes = [{
        text: 'Young man observed',
        subject: 'Iker Aguirre',
        subjectType: 'character',
        context: 'The Gilded Bean terrace',
        tags: ['potential', 'young']
      }];
      const result = formatNotesForDisplay(notes);
      expect(result).toBe('[character] Iker Aguirre: Young man observed (The Gilded Bean terrace) [potential, young]');
    });

    it('should format array of object notes with minimal fields', () => {
      const notes = [{
        text: 'Basic observation',
        subject: 'Test Subject',
        subjectType: 'other'
      }];
      const result = formatNotesForDisplay(notes);
      expect(result).toBe('[other] Test Subject: Basic observation');
    });

    it('should return null for empty array', () => {
      const notes = [];
      const result = formatNotesForDisplay(notes);
      expect(result).toBeNull();
    });

    it('should filter out invalid notes from array', () => {
      const notes = [
        { text: 'Valid note', subject: 'Subject' },
        { text: '', subject: 'Empty text' },
        null,
        undefined,
        '',
        { subject: 'No text field' },
        'String note'
      ];
      const result = formatNotesForDisplay(notes);
      expect(result).toBe('Subject: Valid note\nString note');
    });

    it('should handle mixed string and object notes', () => {
      const notes = [
        'Simple string note',
        {
          text: 'Object note',
          subject: 'Test',
          context: 'Testing'
        }
      ];
      const result = formatNotesForDisplay(notes);
      expect(result).toBe('Simple string note\nTest: Object note (Testing)');
    });
  });

  describe('single object note', () => {
    it('should format single object note', () => {
      const note = {
        text: 'Single observation',
        subject: 'Entity',
        tags: ['tag1', 'tag2']
      };
      const result = formatNotesForDisplay(note);
      expect(result).toBe('Entity: Single observation [tag1, tag2]');
    });

    it('should format single object note with subjectType', () => {
      const note = {
        text: 'Single observation',
        subject: 'Entity',
        subjectType: 'location',
        tags: ['tag1', 'tag2']
      };
      const result = formatNotesForDisplay(note);
      expect(result).toBe('[location] Entity: Single observation [tag1, tag2]');
    });

    it('should return null for object without text', () => {
      const note = {
        subject: 'Entity',
        tags: ['tag1']
      };
      const result = formatNotesForDisplay(note);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle notes with only whitespace tags', () => {
      const notes = [{
        text: 'Note',
        subject: 'Subject',
        tags: ['  ', '', 'valid', '   ']
      }];
      const result = formatNotesForDisplay(notes);
      expect(result).toBe('Subject: Note [valid]');
    });

    it('should handle boolean or number inputs gracefully', () => {
      expect(formatNotesForDisplay(true)).toBeNull();
      expect(formatNotesForDisplay(false)).toBeNull();
      expect(formatNotesForDisplay(123)).toBeNull();
    });
  });
});