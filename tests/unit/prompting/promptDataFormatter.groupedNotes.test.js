/**
 * @file Tests for PromptDataFormatter grouped notes functionality
 * @description Comprehensive tests for subject grouping and context formatting
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('PromptDataFormatter - Grouped Notes Functionality', () => {
  let formatter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    formatter = new PromptDataFormatter({ logger: mockLogger });
  });

  describe('formatNotes with grouping enabled', () => {
    test('should format grouped notes with subject types and context', () => {
      const notes = [
        {
          text: 'John seems nervous about the meeting',
          subject: 'John',
          subjectType: SUBJECT_TYPES.CHARACTER,
          context: 'tavern conversation',
          tags: ['emotion', 'politics'],
        },
        {
          text: 'The north gate has extra guards',
          subject: 'The North Gate',
          subjectType: SUBJECT_TYPES.LOCATION,
          context: 'morning patrol',
          tags: ['security'],
        },
        {
          text: 'John always carries a medallion',
          subject: 'John',
          subjectType: SUBJECT_TYPES.CHARACTER,
          context: 'observation',
          tags: ['mystery', 'artifact'],
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('## Characters');
      expect(result).toContain('### John');
      expect(result).toContain('## Locations');
      expect(result).toContain('### The North Gate');
      expect(result).toContain('- John seems nervous about the meeting (tavern conversation) [emotion, politics]');
      expect(result).toContain('- The north gate has extra guards (morning patrol) [security]');
      expect(result).toContain('- John always carries a medallion (observation) [mystery, artifact]');
    });

    test('should handle notes without context or tags gracefully', () => {
      const notes = [
        {
          text: 'Simple note without extras',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Note with context only',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
          context: 'overheard conversation',
        },
        {
          text: 'Note with tags only',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
          tags: ['important'],
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('- Simple note without extras');
      expect(result).toContain('- Note with context only (overheard conversation)');
      expect(result).toContain('- Note with tags only [important]');
    });

    test('should group multiple subjects under correct categories', () => {
      const notes = [
        {
          text: 'Event note',
          subject: 'Council Meeting',
          subjectType: SUBJECT_TYPES.EVENT,
        },
        {
          text: 'Character note',
          subject: 'Mayor',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Location note',
          subject: 'Town Square',
          subjectType: SUBJECT_TYPES.LOCATION,
        },
        {
          text: 'Another event note',
          subject: 'Festival',
          subjectType: SUBJECT_TYPES.EVENT,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Categories should appear in priority order
      const characterIndex = result.indexOf('## Characters');
      const locationIndex = result.indexOf('## Locations');
      const eventIndex = result.indexOf('## Events');

      expect(characterIndex).toBeLessThan(locationIndex);
      expect(locationIndex).toBeLessThan(eventIndex);

      // Check subjects are present
      expect(result).toContain('### Mayor');
      expect(result).toContain('### Town Square');
      expect(result).toContain('### Council Meeting');
      expect(result).toContain('### Festival');
    });

    test('should handle notes with missing or invalid subject types', () => {
      const notes = [
        {
          text: 'Note without subject type',
          subject: 'Unknown Subject',
        },
        {
          text: 'Note with invalid subject type',
          subject: 'Invalid Subject',
          subjectType: 'invalid_type',
        },
        {
          text: 'Valid note',
          subject: 'Valid Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Invalid/missing subject types should be categorized as "Other"
      expect(result).toContain('## Other');
      expect(result).toContain('## Characters');
      expect(result).toContain('### Unknown Subject');
      expect(result).toContain('### Invalid Subject');
      expect(result).toContain('### Valid Subject');
    });

    test('should handle notes without subjects gracefully', () => {
      const notes = [
        {
          text: 'Note without subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Another note without subject',
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Notes without subjects should be grouped under "General"
      expect(result).toContain('### General');
      expect(result).toContain('- Note without subject');
      expect(result).toContain('- Another note without subject');
    });

    test('should sort subjects alphabetically within categories', () => {
      const notes = [
        {
          text: 'Note about Zara',
          subject: 'Zara',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Note about Alice',
          subject: 'Alice',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Note about Bob',
          subject: 'Bob',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      const aliceIndex = result.indexOf('### Alice');
      const bobIndex = result.indexOf('### Bob');
      const zaraIndex = result.indexOf('### Zara');

      expect(aliceIndex).toBeLessThan(bobIndex);
      expect(bobIndex).toBeLessThan(zaraIndex);
    });

    test('should respect showContext and showTags options', () => {
      const notes = [
        {
          text: 'Test note',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
          context: 'test context',
          tags: ['test', 'tag'],
        },
      ];

      // Test with context disabled
      const resultNoContext = formatter.formatNotes(notes, {
        groupBySubject: true,
        showContext: false,
        showTags: true,
      });
      expect(resultNoContext).toContain('- Test note [test, tag]');
      expect(resultNoContext).not.toContain('(test context)');

      // Test with tags disabled
      const resultNoTags = formatter.formatNotes(notes, {
        groupBySubject: true,
        showContext: true,
        showTags: false,
      });
      expect(resultNoTags).toContain('- Test note (test context)');
      expect(resultNoTags).not.toContain('[test, tag]');

      // Test with both disabled
      const resultNoBoth = formatter.formatNotes(notes, {
        groupBySubject: true,
        showContext: false,
        showTags: false,
      });
      expect(resultNoBoth).toContain('- Test note');
      expect(resultNoBoth).not.toContain('(test context)');
      expect(resultNoBoth).not.toContain('[test, tag]');
    });
  });

  describe('formatNotes backward compatibility', () => {
    test('should use legacy format when groupBySubject is false', () => {
      const notes = [
        {
          text: 'First note',
          subject: 'Subject1',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Second note',
          subject: 'Subject2',
          subjectType: SUBJECT_TYPES.LOCATION,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: false });

      // Should be flat list without categories or subjects
      expect(result).toBe('- First note\n- Second note');
      expect(result).not.toContain('##');
      expect(result).not.toContain('###');
    });

    test('should default to legacy format when no options provided', () => {
      const notes = [
        {
          text: 'Test note',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
      ];

      const result = formatter.formatNotes(notes);

      // Should be grouped format by default now
      expect(result).toContain('## Characters');
      expect(result).toContain('### Test Subject');
      expect(result).toContain('- Test note');
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle empty notes array', () => {
      const result = formatter.formatNotes([], { groupBySubject: true });
      expect(result).toBe('');
    });

    test('should handle null/undefined notes array', () => {
      expect(formatter.formatNotes(null, { groupBySubject: true })).toBe('');
      expect(formatter.formatNotes(undefined, { groupBySubject: true })).toBe('');
    });

    test('should filter out invalid notes gracefully', () => {
      const notes = [
        {
          text: 'Valid note',
          subject: 'Valid Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        null,
        {
          text: '',
          subject: 'Empty Text',
        },
        {
          subject: 'No Text',
        },
        'not an object',
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('- Valid note');
      expect(result).toContain('### Valid Subject');
      // Should not contain invalid entries
      expect(result.split('\n')).toHaveLength(3); // Category + Subject + Note
    });

    test('should fallback to simple formatting on error', () => {
      // Mock an error in the grouping process
      const originalGroupNotesBySubject = formatter.groupNotesBySubject;
      formatter.groupNotesBySubject = jest.fn(() => {
        throw new Error('Test error');
      });

      const notes = [
        {
          text: 'Test note',
          subject: 'Test Subject',
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toBe('- Test note');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'formatGroupedNotes: Error during formatting, falling back to simple list',
        expect.any(Error)
      );

      // Restore original method
      formatter.groupNotesBySubject = originalGroupNotesBySubject;
    });

    test('should handle special characters in text, context, and tags', () => {
      const notes = [
        {
          text: 'Note with "quotes" and [brackets]',
          subject: 'Subject (with parentheses)',
          subjectType: SUBJECT_TYPES.CHARACTER,
          context: 'Context with "quotes"',
          tags: ['tag-with-dash', 'tag [with] brackets'],
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('- Note with "quotes" and [brackets]');
      expect(result).toContain('### Subject (with parentheses)');
      expect(result).toContain('(Context with "quotes")');
      expect(result).toContain('[tag-with-dash, tag [with] brackets]');
    });
  });

  describe('formatNotesSection with grouping options', () => {
    test('should pass options to formatNotes and wrap in XML', () => {
      const notes = [
        {
          text: 'Test note',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
      ];

      const result = formatter.formatNotesSection(notes, { groupBySubject: true });

      expect(result).toMatch(/^<notes>\n[\s\S]*\n<\/notes>$/);
      expect(result).toContain('## Characters');
      expect(result).toContain('### Test Subject');
    });

    test('should return empty string when no notes with grouping enabled', () => {
      const result = formatter.formatNotesSection([], { groupBySubject: true });
      expect(result).toBe('');
    });

    test('should use grouped format by default when no options provided', () => {
      const notes = [
        {
          text: 'Test note',
        },
      ];

      const result = formatter.formatNotesSection(notes);

      expect(result).toContain('<notes>\n## Other\n### General\n- Test note\n</notes>');
    });
  });
});