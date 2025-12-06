/**
 * @file Tests for PromptDataFormatter grouped notes functionality
 * @description Comprehensive tests for subject grouping and context formatting
 * @version 2.0 - Updated for simplified 6-type taxonomy (LLMROLPROARCANA-002)
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('PromptDataFormatter - Grouped Notes Functionality (Simplified Taxonomy)', () => {
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
    test('should format grouped notes with simplified subject types and context', () => {
      const notes = [
        {
          text: 'John seems nervous about the meeting',
          subject: 'John',
          subjectType: SUBJECT_TYPES.ENTITY,
          context: 'tavern conversation',
        },
        {
          text: 'The north gate has extra guards',
          subject: 'The North Gate',
          subjectType: SUBJECT_TYPES.ENTITY,
          context: 'morning patrol',
        },
        {
          text: 'John always carries a medallion',
          subject: 'John',
          subjectType: SUBJECT_TYPES.ENTITY,
          context: 'observation',
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('## Entities');
      expect(result).toContain('### John');
      expect(result).toContain('### The North Gate');
      expect(result).toContain(
        '- John seems nervous about the meeting (tavern conversation)'
      );
      expect(result).toContain(
        '- The north gate has extra guards (morning patrol)'
      );
      expect(result).toContain(
        '- John always carries a medallion (observation)'
      );
    });

    test('should handle notes without context gracefully', () => {
      const notes = [
        {
          text: 'Simple note without extras',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
        {
          text: 'Note with context only',
          subject: 'Test Subject',
          subjectType: SUBJECT_TYPES.ENTITY,
          context: 'overheard conversation',
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('- Simple note without extras');
      expect(result).toContain(
        '- Note with context only (overheard conversation)'
      );
    });

    test('should group multiple subjects under correct simplified categories', () => {
      const notes = [
        {
          text: 'Past event note',
          subject: 'Council Meeting',
          subjectType: SUBJECT_TYPES.EVENT,
        },
        {
          text: 'Character note',
          subject: 'Mayor',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
        {
          text: 'Location note',
          subject: 'Town Square',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
        {
          text: 'Future plan note',
          subject: 'Festival Preparation',
          subjectType: SUBJECT_TYPES.PLAN,
        },
        {
          text: 'Knowledge note',
          subject: 'Guard Patterns',
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
        },
        {
          text: 'Mental state note',
          subject: 'Feeling Anxious',
          subjectType: SUBJECT_TYPES.STATE,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Categories should appear in priority order
      const entitiesIndex = result.indexOf('## Entities');
      const eventsIndex = result.indexOf('## Events');
      const plansIndex = result.indexOf('## Plans');
      const knowledgeIndex = result.indexOf('## Knowledge');
      const statesIndex = result.indexOf('## States');

      expect(entitiesIndex).toBeLessThan(eventsIndex);
      expect(eventsIndex).toBeLessThan(plansIndex);
      expect(plansIndex).toBeLessThan(knowledgeIndex);
      expect(knowledgeIndex).toBeLessThan(statesIndex);

      // Check subjects are present
      expect(result).toContain('### Mayor');
      expect(result).toContain('### Town Square');
      expect(result).toContain('### Council Meeting');
      expect(result).toContain('### Festival Preparation');
      expect(result).toContain('### Guard Patterns');
      expect(result).toContain('### Feeling Anxious');
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
          subjectType: SUBJECT_TYPES.ENTITY,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Notes without valid types should fall back to OTHER
      expect(result).toContain('## Other');
      expect(result).toContain('## Entities');
    });

    test('should handle notes without subject field', () => {
      const notes = [
        {
          text: 'Note without subject',
        },
        {
          text: 'Note with subject',
          subject: 'Test',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Notes without subject should be grouped under 'General'
      expect(result).toContain('### General');
      expect(result).toContain('### Test');
    });

    test('should sort subjects alphabetically within categories', () => {
      const notes = [
        {
          text: 'Note Z',
          subject: 'Zebra',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
        {
          text: 'Note A',
          subject: 'Apple',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
        {
          text: 'Note M',
          subject: 'Mango',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      const appleIndex = result.indexOf('### Apple');
      const mangoIndex = result.indexOf('### Mango');
      const zebraIndex = result.indexOf('### Zebra');

      expect(appleIndex).toBeLessThan(mangoIndex);
      expect(mangoIndex).toBeLessThan(zebraIndex);
    });
  });

  describe('formatNotes with context display options', () => {
    test('should hide context when showContext is false', () => {
      const notes = [
        {
          text: 'Test note',
          subject: 'Test',
          subjectType: SUBJECT_TYPES.ENTITY,
          context: 'test context',
        },
      ];

      const result = formatter.formatNotes(notes, {
        groupBySubject: true,
        showContext: false,
      });

      expect(result).toContain('- Test note');
      expect(result).not.toContain('(test context)');
    });

    test('should show context when showContext is true', () => {
      const notes = [
        {
          text: 'Test note',
          subject: 'Test',
          subjectType: SUBJECT_TYPES.ENTITY,
          context: 'test context',
        },
      ];

      const result = formatter.formatNotes(notes, {
        groupBySubject: true,
        showContext: true,
      });

      expect(result).toContain('- Test note (test context)');
    });
  });

  describe('legacy format support', () => {
    test('should support flat formatting when groupBySubject is false', () => {
      const notes = [
        { text: 'Note 1', subject: 'A', subjectType: SUBJECT_TYPES.ENTITY },
        { text: 'Note 2', subject: 'B', subjectType: SUBJECT_TYPES.EVENT },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: false });

      expect(result).toBe('- Note 1\n- Note 2');
      expect(result).not.toContain('##');
      expect(result).not.toContain('###');
    });
  });

  describe('error handling', () => {
    test('should handle empty notes array', () => {
      const result = formatter.formatNotes([]);
      expect(result).toBe('');
    });

    test('should handle null or undefined notes', () => {
      const nullResult = formatter.formatNotes(null);
      const undefinedResult = formatter.formatNotes(undefined);

      expect(nullResult).toBe('');
      expect(undefinedResult).toBe('');
    });

    test('should filter out invalid note objects', () => {
      const notes = [
        { text: 'Valid', subject: 'Test', subjectType: SUBJECT_TYPES.ENTITY },
        null,
        undefined,
        { subject: 'Missing text', subjectType: SUBJECT_TYPES.ENTITY },
        'string',
        123,
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      expect(result).toContain('- Valid');
      expect(
        result.split('\n').filter((line) => line.startsWith('-'))
      ).toHaveLength(1);
    });

    test('should fallback to simple formatting on error', () => {
      const notes = [
        { text: 'Note 1', subject: 'A', subjectType: SUBJECT_TYPES.ENTITY },
        { text: 'Note 2', subject: 'B', subjectType: SUBJECT_TYPES.EVENT },
      ];

      // Mock sortNotesForDisplay to throw error
      jest.spyOn(formatter, 'sortNotesForDisplay').mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // Should fall back to simple formatting
      expect(result).toContain('- Note 1');
      expect(result).toContain('- Note 2');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('integration with all 6 subject types', () => {
    test('should handle all subject types in a single notes array', () => {
      const notes = [
        {
          text: 'Person info',
          subject: 'John',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
        {
          text: 'Past event',
          subject: 'Battle',
          subjectType: SUBJECT_TYPES.EVENT,
        },
        {
          text: 'Future intention',
          subject: 'Quest',
          subjectType: SUBJECT_TYPES.PLAN,
        },
        {
          text: 'Theory about magic',
          subject: 'Magic Research',
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
        },
        {
          text: 'Feeling anxious',
          subject: 'My Mental State',
          subjectType: SUBJECT_TYPES.STATE,
        },
        {
          text: 'Miscellaneous',
          subject: 'Random',
          subjectType: SUBJECT_TYPES.OTHER,
        },
      ];

      const result = formatter.formatNotes(notes, { groupBySubject: true });

      // All categories should be present
      expect(result).toContain('## Entities');
      expect(result).toContain('## Events');
      expect(result).toContain('## Plans');
      expect(result).toContain('## Knowledge');
      expect(result).toContain('## States');
      expect(result).toContain('## Other');

      // Verify proper ordering
      const indices = {
        entities: result.indexOf('## Entities'),
        events: result.indexOf('## Events'),
        plans: result.indexOf('## Plans'),
        knowledge: result.indexOf('## Knowledge'),
        states: result.indexOf('## States'),
        other: result.indexOf('## Other'),
      };

      expect(indices.entities).toBeLessThan(indices.events);
      expect(indices.events).toBeLessThan(indices.plans);
      expect(indices.plans).toBeLessThan(indices.knowledge);
      expect(indices.knowledge).toBeLessThan(indices.states);
      expect(indices.states).toBeLessThan(indices.other);
    });
  });
});
