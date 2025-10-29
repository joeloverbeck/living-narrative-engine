/**
 * @file Unit tests for noteTooltipFormatter.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { formatNotesAsRichHtml } from '../../../../src/domUI/helpers/noteTooltipFormatter.js';

describe('noteTooltipFormatter', () => {
  let originalDocument;
  let jsdom;
  let mockDocument;

  beforeEach(() => {
    // Store the original document
    originalDocument = global.document;

    // Create a new JSDOM instance
    jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    mockDocument = jsdom.window.document;

    // Set up global document
    global.document = mockDocument;
  });

  afterEach(() => {
    // Restore the original document
    global.document = originalDocument;

    // Clean up JSDOM
    if (jsdom) {
      jsdom.window.close();
    }
  });

  describe('formatNotesAsRichHtml', () => {
    describe('with empty/null input', () => {
      it('should return empty string for null input', () => {
        const result = formatNotesAsRichHtml(null);
        expect(result).toBe('');
      });

      it('should return empty string for undefined input', () => {
        const result = formatNotesAsRichHtml(undefined);
        expect(result).toBe('');
      });

      it('should return empty string for empty array input', () => {
        const result = formatNotesAsRichHtml([]);
        expect(result).toBe('');
      });
    });

    describe('with single note object', () => {
      it('should format a simple note object', () => {
        const note = {
          text: 'Character seems nervous',
          subject: 'Alice',
          subjectType: 'character',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('notes-container--single');
        expect(result).toContain('note-header');
        expect(result).toContain('note-subject-type');
        expect(result).toContain('data-type="character"');
        expect(result).toContain('note-subject">Alice');
        expect(result).toContain('Character seems nervous');
        expect(result).toContain('👤'); // Character icon
      });

      it('should handle note with all fields (without tags)', () => {
        const note = {
          text: 'Strange sounds from the walls',
          subject: 'Old Library',
          subjectType: 'location',
          context: 'During midnight exploration',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('note-subject-type');
        expect(result).toContain('data-type="location"');
        expect(result).toContain('Old Library');
        expect(result).toContain('Strange sounds from the walls');
        expect(result).toContain('During midnight exploration');
        expect(result).toContain('📍'); // Location icon
      });

      it('should handle subject type without a subject', () => {
        const note = {
          text: 'Subject type only',
          subjectType: 'event',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('note-subject-type');
        expect(result).toContain('data-type="event"');
        expect(result).toContain('Subject type only');
        expect(result).not.toContain('note-subject">');
      });

      it('should handle note with missing optional fields', () => {
        const note = {
          text: 'Important observation',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('Important observation');
        expect(result).not.toContain('note-header');
        expect(result).not.toContain('note-meta');
      });

      it('should trim whitespace from subject and subject type values', () => {
        const note = {
          text: 'Trimmed values',
          subject: '  Alice  ',
          subjectType: '  LOCATION  ',
          context: '  Whispered rumors  ',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('data-type="location"');
        expect(result).toContain('Alice');
        expect(result).toContain('Whispered rumors');
        expect(result).not.toContain('  Alice  ');
        expect(result).not.toContain('  LOCATION  ');
        expect(result).not.toContain('  Whispered rumors  ');
      });

      it('should treat whitespace-only optional fields as absent', () => {
        const note = {
          text: 'Whitespace trimming',
          subject: '   ',
          subjectType: '   ',
          context: '   ',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('Whitespace trimming');
        expect(result).not.toContain('note-header');
        expect(result).not.toContain('note-meta');
      });

      it('should escape HTML entities in note fields', () => {
        const note = {
          text: 'Alert: <script>alert("xss")</script>',
          subject: 'Evil <img src=x onerror=alert(1)>',
          subjectType: 'test<script>',
          context: 'During <iframe> test',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('&lt;script&gt;');
        expect(result).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(result).toContain('test&lt;script&gt;');
        expect(result).toContain('&lt;iframe&gt;');
      });

      it('should handle note object with empty text', () => {
        const note = {
          text: '',
          subject: 'Alice',
          subjectType: 'character',
        };

        const result = formatNotesAsRichHtml(note);
        expect(result).toBe('');
      });

      it('should handle note object with only whitespace text', () => {
        const note = {
          text: '   \t\n   ',
          subject: 'Alice',
          subjectType: 'character',
        };

        const result = formatNotesAsRichHtml(note);
        expect(result).toBe('');
      });

      it('should ignore non-object values when formatting a single entry', () => {
        // @ts-expect-error - deliberately passing an incorrect type to test runtime handling
        const result = formatNotesAsRichHtml('string value');
        expect(result).toBe('');
      });
    });

    describe('with array of notes', () => {
      it('should format multiple structured notes', () => {
        const notes = [
          {
            text: 'Character seems nervous about the meeting',
            subject: 'Alice',
            subjectType: 'character',
            context: 'During garden conversation',
          },
          {
            text: 'Dusty and abandoned, perfect for secrets',
            subject: 'Old Library',
            subjectType: 'location',
          },
        ];

        const result = formatNotesAsRichHtml(notes);

        expect(result).toContain('notes-container--multiple');
        expect(result).toContain('notes-header');
        expect(result).toContain('2 Notes');
        expect(result).toContain('notes-list');
        expect(result).toContain('note-divider');

        expect(result).toContain('Alice');
        expect(result).toContain('Character seems nervous about the meeting');
        expect(result).toContain('Old Library');
        expect(result).toContain('Dusty and abandoned');

        expect(result).toContain('data-index="0"');
        expect(result).toContain('data-index="1"');
        expect(result.match(/note-divider/g)?.length).toBe(1);
      });

      it('should handle array with single note', () => {
        const notes = [
          {
            text: 'Single note in array',
            subject: 'Test',
            subjectType: 'character',
          },
        ];

        const result = formatNotesAsRichHtml(notes);

        expect(result).toContain('notes-container--single');
        expect(result).not.toContain('notes-header');
        expect(result).not.toContain('note-divider');
        expect(result).toContain('Single note in array');
      });

      it('should handle multiple structured notes in array', () => {
        const notes = [
          {
            text: 'Structured note',
            subject: 'Alice',
            subjectType: 'character',
          },
          {
            text: 'Another structured note',
            subject: 'Library',
            subjectType: 'location',
          },
        ];

        const result = formatNotesAsRichHtml(notes);

        expect(result).toContain('notes-container--multiple');
        expect(result).toContain('2 Notes');
        expect(result).toContain('Structured note');
        expect(result).toContain('Another structured note');
        expect(result).not.toContain('note-item--simple');
      });

      it('should filter out invalid notes from array', () => {
        const notes = [
          {
            text: 'Valid note',
            subject: 'Alice',
            subjectType: 'character',
          },
          {
            text: '',
            subject: 'Bob',
            subjectType: 'character',
          },
          null,
          {
            text: 'Another valid note',
            subject: 'Library',
          },
          undefined,
          {
            subject: 'Missing text',
          },
        ];

        const result = formatNotesAsRichHtml(notes);

        expect(result).toContain('notes-container--multiple');
        expect(result).toContain('2 Notes');
        expect(result).toContain('Valid note');
        expect(result).toContain('Another valid note');
        expect(result).not.toContain('Bob');
        expect(result).not.toContain('Missing text');
      });

      it('should return empty string if all notes in array are invalid', () => {
        const notes = [
          { text: '', subject: 'Alice' },
          null,
          undefined,
          { subject: 'Missing text' },
          { text: '   ' },
        ];

        const result = formatNotesAsRichHtml(notes);
        expect(result).toBe('');
      });
    });

    describe('subject type icons and styling', () => {
      it('should include appropriate icons for different subject types', () => {
        const subjectTypes = [
          { type: 'character', icon: '👤' },
          { type: 'location', icon: '📍' },
          { type: 'event', icon: '📅' },
          { type: 'item', icon: '📦' },
          { type: 'emotion', icon: '💭' },
          { type: 'observation', icon: '👁️' },
          { type: 'discovery', icon: '🔍' },
          { type: 'mystery', icon: '🔮' },
          { type: 'investigation', icon: '🕵️' },
        ];

        subjectTypes.forEach(({ type, icon }) => {
          const note = {
            text: 'Test note',
            subject: 'Test Subject',
            subjectType: type,
          };

          const result = formatNotesAsRichHtml(note);

          expect(result).toContain(`data-type="${type}"`);
          expect(result).toContain(icon);
        });
      });

      it('should handle unknown subject types gracefully', () => {
        const note = {
          text: 'Test note',
          subject: 'Test Subject',
          subjectType: 'unknown-type',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('data-type="unknown-type"');
        expect(result).toContain('unknown-type');
        // Should not contain any icon HTML for unknown types
      });

      it('should handle case insensitive subject types', () => {
        const note = {
          text: 'Test note',
          subject: 'Test Subject',
          subjectType: 'CHARACTER',
        };

        const result = formatNotesAsRichHtml(note);

        expect(result).toContain('data-type="character"');
        expect(result).toContain('👤');
      });
    });
  });
});
