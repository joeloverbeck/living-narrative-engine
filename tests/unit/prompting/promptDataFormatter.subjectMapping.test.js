/**
 * @file Tests for PromptDataFormatter subject type mapping functionality
 * @description Tests for subject type display mapping and categorization logic
 * @version 2.0 - Updated for simplified 6-type taxonomy (LLMROLPROARCANA-002)
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('PromptDataFormatter - Subject Type Mapping (Simplified Taxonomy)', () => {
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
    test('should return correct display info for all 6 valid subject types', () => {
      const testCases = [
        {
          subjectType: SUBJECT_TYPES.ENTITY,
          expected: {
            displayCategory: 'Entities',
            displayName: 'People, Places & Things',
            priority: 1,
          },
        },
        {
          subjectType: SUBJECT_TYPES.EVENT,
          expected: {
            displayCategory: 'Events',
            displayName: 'Past Occurrences',
            priority: 2,
          },
        },
        {
          subjectType: SUBJECT_TYPES.PLAN,
          expected: {
            displayCategory: 'Plans',
            displayName: 'Future Intentions',
            priority: 3,
          },
        },
        {
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
          expected: {
            displayCategory: 'Knowledge',
            displayName: 'Information & Theories',
            priority: 4,
          },
        },
        {
          subjectType: SUBJECT_TYPES.STATE,
          expected: {
            displayCategory: 'States',
            displayName: 'Mental & Emotional',
            priority: 5,
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

    test('should fallback to OTHER for unknown subject types', () => {
      const unknownType = 'nonexistent_type';
      const result = formatter.getSubjectTypeDisplayInfo(unknownType);

      expect(result).toEqual({
        displayCategory: 'Other',
        displayName: 'Other',
        priority: 999,
      });
    });

    test('should handle null or undefined subject types', () => {
      const nullResult = formatter.getSubjectTypeDisplayInfo(null);
      const undefinedResult = formatter.getSubjectTypeDisplayInfo(undefined);

      expect(nullResult).toEqual({
        displayCategory: 'Other',
        displayName: 'Other',
        priority: 999,
      });
      expect(undefinedResult).toEqual({
        displayCategory: 'Other',
        displayName: 'Other',
        priority: 999,
      });
    });
  });

  describe('priority ordering', () => {
    test('should maintain correct priority order for all subject types', () => {
      const priorities = [
        { type: SUBJECT_TYPES.ENTITY, priority: 1 },
        { type: SUBJECT_TYPES.EVENT, priority: 2 },
        { type: SUBJECT_TYPES.PLAN, priority: 3 },
        { type: SUBJECT_TYPES.KNOWLEDGE, priority: 4 },
        { type: SUBJECT_TYPES.STATE, priority: 5 },
        { type: SUBJECT_TYPES.OTHER, priority: 999 },
      ];

      priorities.forEach(({ type, priority }) => {
        const info = formatter.getSubjectTypeDisplayInfo(type);
        expect(info.priority).toBe(priority);
      });
    });

    test('should sort entity before event before plan before knowledge before state', () => {
      const notes = [
        {
          text: 'Mental state',
          subject: 'Z Subject',
          subjectType: SUBJECT_TYPES.STATE,
        },
        {
          text: 'Theory',
          subject: 'Y Subject',
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
        },
        {
          text: 'Future plan',
          subject: 'X Subject',
          subjectType: SUBJECT_TYPES.PLAN,
        },
        {
          text: 'Past event',
          subject: 'W Subject',
          subjectType: SUBJECT_TYPES.EVENT,
        },
        {
          text: 'Person',
          subject: 'V Subject',
          subjectType: SUBJECT_TYPES.ENTITY,
        },
      ];

      const grouped = formatter.groupNotesBySubject(notes);
      const sorted = formatter.sortNotesForDisplay(grouped);

      // Should be ordered by priority: entity, event, plan, knowledge, state
      expect(sorted[0].displayCategory).toBe('Entities');
      expect(sorted[1].displayCategory).toBe('Events');
      expect(sorted[2].displayCategory).toBe('Plans');
      expect(sorted[3].displayCategory).toBe('Knowledge');
      expect(sorted[4].displayCategory).toBe('States');
    });
  });

  describe('display categories', () => {
    test('should use simplified display categories', () => {
      const displayCategories = Object.values(SUBJECT_TYPES).map((type) => {
        const info = formatter.getSubjectTypeDisplayInfo(type);
        return info.displayCategory;
      });

      expect(displayCategories).toEqual([
        'Entities',
        'Events',
        'Plans',
        'Knowledge',
        'States',
        'Other',
      ]);
    });

    test('should use descriptive display names', () => {
      const displayNames = Object.values(SUBJECT_TYPES).map((type) => {
        const info = formatter.getSubjectTypeDisplayInfo(type);
        return info.displayName;
      });

      expect(displayNames).toEqual([
        'People, Places & Things',
        'Past Occurrences',
        'Future Intentions',
        'Information & Theories',
        'Mental & Emotional',
        'Other',
      ]);
    });
  });
});
