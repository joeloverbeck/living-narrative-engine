/**
 * @file Tests for PromptDataFormatter subject type mapping functionality
 * @description Tests for subject type display mapping and categorization logic
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('PromptDataFormatter - Subject Type Mapping', () => {
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

  describe('getSubjectTypeDisplayInfo', () => {
    test('should return correct display info for all valid subject types', () => {
      const testCases = [
        {
          subjectType: SUBJECT_TYPES.CHARACTER,
          expected: {
            displayCategory: 'Characters',
            displayName: 'Characters',
            priority: 1,
          },
        },
        {
          subjectType: SUBJECT_TYPES.LOCATION,
          expected: {
            displayCategory: 'Locations',
            displayName: 'Locations',
            priority: 2,
          },
        },
        {
          subjectType: SUBJECT_TYPES.EVENT,
          expected: {
            displayCategory: 'Events',
            displayName: 'Events',
            priority: 3,
          },
        },
        {
          subjectType: SUBJECT_TYPES.ITEM,
          expected: {
            displayCategory: 'Items & Objects',
            displayName: 'Items & Objects',
            priority: 4,
          },
        },
        {
          subjectType: SUBJECT_TYPES.CREATURE,
          expected: {
            displayCategory: 'Creatures',
            displayName: 'Creatures',
            priority: 5,
          },
        },
        {
          subjectType: SUBJECT_TYPES.ORGANIZATION,
          expected: {
            displayCategory: 'Organizations',
            displayName: 'Organizations',
            priority: 6,
          },
        },
        {
          subjectType: SUBJECT_TYPES.QUEST,
          expected: {
            displayCategory: 'Quests & Tasks',
            displayName: 'Quests & Tasks',
            priority: 7,
          },
        },
        {
          subjectType: SUBJECT_TYPES.RELATIONSHIP,
          expected: {
            displayCategory: 'Relationships',
            displayName: 'Relationships',
            priority: 8,
          },
        },
        {
          subjectType: SUBJECT_TYPES.CONCEPT,
          expected: {
            displayCategory: 'Concepts & Ideas',
            displayName: 'Concepts & Ideas',
            priority: 9,
          },
        },
        {
          subjectType: SUBJECT_TYPES.SKILL,
          expected: {
            displayCategory: 'Skills & Abilities',
            displayName: 'Skills & Abilities',
            priority: 10,
          },
        },
        {
          subjectType: SUBJECT_TYPES.EMOTION,
          expected: {
            displayCategory: 'Emotions & Feelings',
            displayName: 'Emotions & Feelings',
            priority: 11,
          },
        },
        {
          subjectType: SUBJECT_TYPES.OTHER,
          expected: {
            displayCategory: 'Other',
            displayName: 'Other',
            priority: 999,
          },
        },
      ];

      testCases.forEach(({ subjectType, expected }) => {
        const result = formatter.getSubjectTypeDisplayInfo(subjectType);
        expect(result).toEqual(expected);
      });
    });

    test('should return "Other" category for invalid subject types', () => {
      const invalidTypes = ['invalid', 'unknown', '', null, undefined];

      invalidTypes.forEach((invalidType) => {
        const result = formatter.getSubjectTypeDisplayInfo(invalidType);
        expect(result).toEqual({
          displayCategory: 'Other',
          displayName: 'Other',
          priority: 999,
        });
      });
    });
  });

  describe('groupNotesBySubject', () => {
    test('should group notes by subject correctly', () => {
      const notes = [
        {
          text: 'First note about John',
          subject: 'John',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Second note about John',
          subject: 'John',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Note about the tavern',
          subject: 'The Tavern',
          subjectType: SUBJECT_TYPES.LOCATION,
        },
      ];

      const result = formatter.groupNotesBySubject(notes);

      expect(result.size).toBe(2);
      
      const johnGroup = result.get('John');
      expect(johnGroup).toEqual({
        subjectType: SUBJECT_TYPES.CHARACTER,
        displayCategory: 'Characters',
        priority: 1,
        notes: [
          {
            text: 'First note about John',
            subject: 'John',
            subjectType: SUBJECT_TYPES.CHARACTER,
          },
          {
            text: 'Second note about John',
            subject: 'John',
            subjectType: SUBJECT_TYPES.CHARACTER,
          },
        ],
      });

      const tavernGroup = result.get('The Tavern');
      expect(tavernGroup).toEqual({
        subjectType: SUBJECT_TYPES.LOCATION,
        displayCategory: 'Locations',
        priority: 2,
        notes: [
          {
            text: 'Note about the tavern',
            subject: 'The Tavern',
            subjectType: SUBJECT_TYPES.LOCATION,
          },
        ],
      });
    });

    test('should handle notes without subjects by grouping under "General"', () => {
      const notes = [
        {
          text: 'Note without subject',
          subjectType: SUBJECT_TYPES.CHARACTER,
        },
        {
          text: 'Another note without subject',
        },
      ];

      const result = formatter.groupNotesBySubject(notes);

      expect(result.size).toBe(1);
      const generalGroup = result.get('General');
      expect(generalGroup).toEqual({
        subjectType: SUBJECT_TYPES.OTHER, // fallback when no subjectType
        displayCategory: 'Other',
        priority: 999,
        notes: [
          {
            text: 'Note without subject',
            subjectType: SUBJECT_TYPES.CHARACTER,
          },
          {
            text: 'Another note without subject',
          },
        ],
      });
    });

    test('should handle notes without subject types by using OTHER', () => {
      const notes = [
        {
          text: 'Note without subject type',
          subject: 'Test Subject',
        },
        {
          text: 'Note with invalid subject type',
          subject: 'Test Subject',
          subjectType: 'invalid_type',
        },
      ];

      const result = formatter.groupNotesBySubject(notes);

      expect(result.size).toBe(1);
      const testGroup = result.get('Test Subject');
      expect(testGroup.subjectType).toBe(SUBJECT_TYPES.OTHER);
      expect(testGroup.displayCategory).toBe('Other');
      expect(testGroup.priority).toBe(999);
    });

    test('should handle empty notes array', () => {
      const result = formatter.groupNotesBySubject([]);
      expect(result.size).toBe(0);
    });
  });

  describe('sortNotesForDisplay', () => {
    test('should sort categories by priority and subjects alphabetically', () => {
      const groupedNotes = new Map([
        [
          'Zara',
          {
            subjectType: SUBJECT_TYPES.CHARACTER,
            displayCategory: 'Characters',
            priority: 1,
            notes: [{ text: 'Note about Zara' }],
          },
        ],
        [
          'Town Square',
          {
            subjectType: SUBJECT_TYPES.LOCATION,
            displayCategory: 'Locations',
            priority: 2,
            notes: [{ text: 'Note about Town Square' }],
          },
        ],
        [
          'Alice',
          {
            subjectType: SUBJECT_TYPES.CHARACTER,
            displayCategory: 'Characters',
            priority: 1,
            notes: [{ text: 'Note about Alice' }],
          },
        ],
        [
          'Festival',
          {
            subjectType: SUBJECT_TYPES.EVENT,
            displayCategory: 'Events',
            priority: 3,
            notes: [{ text: 'Note about Festival' }],
          },
        ],
      ]);

      const result = formatter.sortNotesForDisplay(groupedNotes);

      expect(result).toHaveLength(3); // 3 categories

      // Categories should be sorted by priority
      expect(result[0].displayCategory).toBe('Characters');
      expect(result[1].displayCategory).toBe('Locations');
      expect(result[2].displayCategory).toBe('Events');

      // Subjects within Characters should be sorted alphabetically
      const charactersCategory = result[0];
      expect(charactersCategory.subjects).toHaveLength(2);
      expect(charactersCategory.subjects[0].subject).toBe('Alice');
      expect(charactersCategory.subjects[1].subject).toBe('Zara');
    });

    test('should handle single category with multiple subjects', () => {
      const groupedNotes = new Map([
        [
          'Charlie',
          {
            displayCategory: 'Characters',
            priority: 1,
            notes: [{ text: 'Note about Charlie' }],
          },
        ],
        [
          'Alice',
          {
            displayCategory: 'Characters',
            priority: 1,
            notes: [{ text: 'Note about Alice' }],
          },
        ],
        [
          'Bob',
          {
            displayCategory: 'Characters',
            priority: 1,
            notes: [{ text: 'Note about Bob' }],
          },
        ],
      ]);

      const result = formatter.sortNotesForDisplay(groupedNotes);

      expect(result).toHaveLength(1);
      expect(result[0].displayCategory).toBe('Characters');
      expect(result[0].subjects).toHaveLength(3);

      const subjects = result[0].subjects.map((s) => s.subject);
      expect(subjects).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    test('should handle empty grouped notes', () => {
      const result = formatter.sortNotesForDisplay(new Map());
      expect(result).toEqual([]);
    });
  });

  describe('formatNoteWithContext', () => {
    test('should format note with context and tags when enabled', () => {
      const note = {
        text: 'Test note',
        context: 'test context',
        tags: ['tag1', 'tag2'],
      };

      const options = {
        showContext: true,
        showTags: true,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note (test context) [tag1, tag2]');
    });

    test('should format note with only context when tags disabled', () => {
      const note = {
        text: 'Test note',
        context: 'test context',
        tags: ['tag1', 'tag2'],
      };

      const options = {
        showContext: true,
        showTags: false,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note (test context)');
    });

    test('should format note with only tags when context disabled', () => {
      const note = {
        text: 'Test note',
        context: 'test context',
        tags: ['tag1', 'tag2'],
      };

      const options = {
        showContext: false,
        showTags: true,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note [tag1, tag2]');
    });

    test('should format note with text only when both context and tags disabled', () => {
      const note = {
        text: 'Test note',
        context: 'test context',
        tags: ['tag1', 'tag2'],
      };

      const options = {
        showContext: false,
        showTags: false,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note');
    });

    test('should handle note without context gracefully', () => {
      const note = {
        text: 'Test note',
        tags: ['tag1'],
      };

      const options = {
        showContext: true,
        showTags: true,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note [tag1]');
    });

    test('should handle note without tags gracefully', () => {
      const note = {
        text: 'Test note',
        context: 'test context',
      };

      const options = {
        showContext: true,
        showTags: true,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note (test context)');
    });

    test('should handle note with empty tags array', () => {
      const note = {
        text: 'Test note',
        context: 'test context',
        tags: [],
      };

      const options = {
        showContext: true,
        showTags: true,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note (test context)');
    });

    test('should handle single tag correctly', () => {
      const note = {
        text: 'Test note',
        tags: ['single-tag'],
      };

      const options = {
        showContext: false,
        showTags: true,
      };

      const result = formatter.formatNoteWithContext(note, options);
      expect(result).toBe('- Test note [single-tag]');
    });
  });

  describe('integration - complete grouping workflow', () => {
    test('should demonstrate complete workflow from notes to formatted output', () => {
      const notes = [
        {
          text: 'Mayor Thompson avoids meetings',
          subject: 'Mayor Thompson',
          subjectType: SUBJECT_TYPES.CHARACTER,
          context: 'city hall observation',
          tags: ['politics', 'behavior'],
        },
        {
          text: 'Strange symbols on gate stones',
          subject: 'The North Gate',
          subjectType: SUBJECT_TYPES.LOCATION,
          context: 'evening inspection',
          tags: ['mystery', 'magic'],
        },
        {
          text: 'Caravan three days overdue',
          subject: 'The Missing Shipment',
          subjectType: SUBJECT_TYPES.EVENT,
          context: 'marketplace rumors',
          tags: ['commerce', 'concern'],
        },
      ];

      // Step 1: Group notes
      const grouped = formatter.groupNotesBySubject(notes);
      expect(grouped.size).toBe(3);

      // Step 2: Sort for display
      const sorted = formatter.sortNotesForDisplay(grouped);
      expect(sorted).toHaveLength(3);
      
      // Characters should come first (priority 1)
      expect(sorted[0].displayCategory).toBe('Characters');
      expect(sorted[1].displayCategory).toBe('Locations');
      expect(sorted[2].displayCategory).toBe('Events');

      // Step 3: Format individual notes
      const formattedNote = formatter.formatNoteWithContext(notes[0], {
        showContext: true,
        showTags: true,
      });
      expect(formattedNote).toBe(
        '- Mayor Thompson avoids meetings (city hall observation) [politics, behavior]'
      );
    });
  });
});