/**
 * @file Tests for PromptDataFormatter
 * @description Comprehensive tests for conditional section rendering functionality
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';

describe('PromptDataFormatter - Conditional Section Rendering', () => {
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

  describe('formatThoughtsSection', () => {
    test('returns empty string when thoughts array is empty', () => {
      const result = formatter.formatThoughtsSection([]);
      expect(result).toBe('');
    });

    test('returns empty string when thoughts array is null/undefined', () => {
      expect(formatter.formatThoughtsSection(null)).toBe('');
      expect(formatter.formatThoughtsSection(undefined)).toBe('');
    });

    test('returns complete XML section when thoughts exist', () => {
      const thoughts = [
        { text: 'First thought', timestamp: '2024-01-01' },
        { text: 'Second thought', timestamp: '2024-01-02' },
      ];

      const result = formatter.formatThoughtsSection(thoughts);

      expect(result).toBe(
        '<thoughts>\n- First thought\n- Second thought\n</thoughts>'
      );
    });

    test('filters out invalid thoughts but returns section if valid ones exist', () => {
      const thoughts = [
        { text: 'Valid thought', timestamp: '2024-01-01' },
        null,
        { text: '', timestamp: '2024-01-02' }, // Empty text
        { text: 'Another valid thought', timestamp: '2024-01-03' },
      ];

      const result = formatter.formatThoughtsSection(thoughts);

      expect(result).toBe(
        '<thoughts>\n- Valid thought\n- Another valid thought\n</thoughts>'
      );
    });

    test('returns empty string when all thoughts are invalid', () => {
      const thoughts = [
        null,
        { text: '', timestamp: '2024-01-01' },
        { timestamp: '2024-01-02' }, // Missing text
      ];

      const result = formatter.formatThoughtsSection(thoughts);

      expect(result).toBe('');
    });
  });

  describe('formatNotesSection', () => {
    test('returns empty string when notes array is empty', () => {
      const result = formatter.formatNotesSection([]);
      expect(result).toBe('');
    });

    test('returns complete XML section when notes exist', () => {
      const notes = [
        { text: 'Important note', timestamp: '2024-01-01' },
        { text: 'Another note', timestamp: '2024-01-02' },
      ];

      const result = formatter.formatNotesSection(notes);

      expect(result).toBe(
        '<notes>\n- Important note\n- Another note\n</notes>'
      );
    });
  });

  describe('formatGoalsSection', () => {
    test('returns empty string when goals array is empty', () => {
      const result = formatter.formatGoalsSection([]);
      expect(result).toBe('');
    });

    test('returns complete XML section when goals exist', () => {
      const goals = [
        { text: 'Complete the quest', timestamp: '2024-01-01' },
        { text: 'Find the treasure', timestamp: '2024-01-02' },
      ];

      const result = formatter.formatGoalsSection(goals);

      expect(result).toBe(
        '<goals>\n- Complete the quest\n- Find the treasure\n</goals>'
      );
    });
  });

  describe('formatPromptData - Conditional Sections Integration', () => {
    test('includes both content and section fields for backwards compatibility', () => {
      const promptData = {
        thoughtsArray: [{ text: 'Test thought', timestamp: '2024-01-01' }],
        notesArray: [],
        goalsArray: [{ text: 'Test goal', timestamp: '2024-01-01' }],
      };

      const result = formatter.formatPromptData(promptData);

      // Backwards compatibility - content fields
      expect(result.thoughtsContent).toBe('- Test thought');
      expect(result.notesContent).toBe('');
      expect(result.goalsContent).toBe('- Test goal');

      // New section fields
      expect(result.thoughtsSection).toBe(
        '<thoughts>\n- Test thought\n</thoughts>'
      );
      expect(result.notesSection).toBe('');
      expect(result.goalsSection).toBe('<goals>\n- Test goal\n</goals>');
    });

    test('handles all empty sections correctly', () => {
      const promptData = {
        thoughtsArray: [],
        notesArray: [],
        goalsArray: [],
      };

      const result = formatter.formatPromptData(promptData);

      // All content fields should be empty
      expect(result.thoughtsContent).toBe('');
      expect(result.notesContent).toBe('');
      expect(result.goalsContent).toBe('');

      // All section fields should be empty (no XML tags)
      expect(result.thoughtsSection).toBe('');
      expect(result.notesSection).toBe('');
      expect(result.goalsSection).toBe('');
    });

    test('handles mixed empty and non-empty sections', () => {
      const promptData = {
        thoughtsArray: [{ text: 'I have a thought', timestamp: '2024-01-01' }],
        notesArray: [], // Empty
        goalsArray: [{ text: 'Achieve something', timestamp: '2024-01-01' }],
      };

      const result = formatter.formatPromptData(promptData);

      // Should have thoughts and goals sections, but no notes section
      expect(result.thoughtsSection).toBe(
        '<thoughts>\n- I have a thought\n</thoughts>'
      );
      expect(result.notesSection).toBe('');
      expect(result.goalsSection).toBe(
        '<goals>\n- Achieve something\n</goals>'
      );
    });

    test('preserves all other fields unchanged', () => {
      const promptData = {
        taskDefinitionContent: 'Test task',
        characterPersonaContent: 'Test persona',
        availableActionsInfoContent: 'Test actions',
        thoughtsArray: [],
        notesArray: [],
        goalsArray: [],
      };

      const result = formatter.formatPromptData(promptData);

      // Other fields should be preserved
      expect(result.taskDefinitionContent).toBe('Test task');
      expect(result.characterPersonaContent).toBe('Test persona');
      expect(result.availableActionsInfoContent).toBe('Test actions');
    });
  });

  describe('Token Efficiency Validation', () => {
    test('empty sections generate no tokens (empty strings)', () => {
      const formatter = new PromptDataFormatter({ logger: mockLogger });

      // Empty sections should return empty strings, not XML tags
      expect(formatter.formatThoughtsSection([])).toBe('');
      expect(formatter.formatNotesSection([])).toBe('');
      expect(formatter.formatGoalsSection([])).toBe('');

      // This saves approximately 6-8 tokens per empty section
      // <thoughts></thoughts> = ~4 tokens
      // newlines = ~2 tokens
      // Total saved per section: ~6 tokens
    });

    test('non-empty sections generate properly formatted XML', () => {
      const thoughts = [{ text: 'Test', timestamp: '2024-01-01' }];

      const result = formatter.formatThoughtsSection(thoughts);

      // Should have proper XML structure when content exists
      expect(result).toMatch(/^<thoughts>\n.*\n<\/thoughts>$/);
      expect(result).toContain('- Test');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid prompt data gracefully', () => {
      const result = formatter.formatPromptData(null);
      expect(result).toEqual({});
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptDataFormatter: Invalid prompt data provided'
      );
    });

    test('handles missing arrays with default empty arrays', () => {
      const promptData = {}; // No arrays provided

      const result = formatter.formatPromptData(promptData);

      // Should not crash and should provide empty sections
      expect(result.thoughtsSection).toBe('');
      expect(result.notesSection).toBe('');
      expect(result.goalsSection).toBe('');
    });
  });
});
