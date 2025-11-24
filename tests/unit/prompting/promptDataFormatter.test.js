/**
 * @file Tests for PromptDataFormatter
 * @description Comprehensive tests for conditional section rendering functionality
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';

const makeNotesGuidance = (name = 'your character', hasExistingNotes = false) =>
  `NOTES WRITING GUIDANCE: The notes must be concise, but written in ${name}'s own voice. Focus each note on critical facts while preserving ${name}'s perspective. Avoid generic or neutral phrasing.${
    hasExistingNotes ? ' Keep any new notes distinct from the existing entries listed below.' : ''
  }`;

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
        `<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):
- First thought
- Second thought

-----
Generate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.
</thoughts>`
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
        `<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):
- Valid thought
- Another valid thought

-----
Generate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.
</thoughts>`
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

  describe('formatThoughtsVoiceGuidance', () => {
    test('returns basic guidance when thoughts array is empty', () => {
      const result = formatter.formatThoughtsVoiceGuidance([]);
      expect(result).toBe(
        "INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );
    });

    test('returns basic guidance when thoughts array is null/undefined', () => {
      expect(formatter.formatThoughtsVoiceGuidance(null)).toBe(
        "INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );
      expect(formatter.formatThoughtsVoiceGuidance(undefined)).toBe(
        "INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );
    });

    test('returns enhanced anti-repetition guidance when thoughts exist', () => {
      const thoughts = [{ text: 'First thought', timestamp: '2024-01-01' }];

      const result = formatter.formatThoughtsVoiceGuidance(thoughts);

      expect(result).toBe(
        "INNER VOICE GUIDANCE: Your thoughts must be fresh and unique - do not repeat or barely rephrase the previous thoughts shown above. Build upon your existing mental state with new insights, reactions, or perspectives that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );
    });

    test('returns same enhanced guidance regardless of number of thoughts', () => {
      const singleThought = [{ text: 'One thought', timestamp: '2024-01-01' }];
      const multipleThoughts = [
        { text: 'First thought', timestamp: '2024-01-01' },
        { text: 'Second thought', timestamp: '2024-01-02' },
        { text: 'Third thought', timestamp: '2024-01-03' },
      ];

      const result1 = formatter.formatThoughtsVoiceGuidance(singleThought);
      const result2 = formatter.formatThoughtsVoiceGuidance(multipleThoughts);

      const expectedGuidance =
        "INNER VOICE GUIDANCE: Your thoughts must be fresh and unique - do not repeat or barely rephrase the previous thoughts shown above. Build upon your existing mental state with new insights, reactions, or perspectives that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects.";

      expect(result1).toBe(expectedGuidance);
      expect(result2).toBe(expectedGuidance);
    });
  });

  describe('formatThoughtsVoiceGuidance - Enhanced Functionality', () => {
    test('basic guidance contains key authenticity phrases', () => {
      const result = formatter.formatThoughtsVoiceGuidance([]);

      expect(result).toContain('INNER VOICE GUIDANCE');
      expect(result).toContain('authentically reflect');
      expect(result).toContain('unique mental voice');
      expect(result).toContain('personality patterns');
      expect(result).toContain('internal speech style');
    });

    test('enhanced guidance contains key anti-repetition phrases', () => {
      const thoughts = [{ text: 'Test thought', timestamp: '2024-01-01' }];
      const result = formatter.formatThoughtsVoiceGuidance(thoughts);

      expect(result).toContain('INNER VOICE GUIDANCE');
      expect(result).toContain('fresh and unique');
      expect(result).toContain('do not repeat');
      expect(result).toContain('barely rephrase');
      expect(result).toContain('previous thoughts shown above');
      expect(result).toContain('Build upon your existing mental state');
      expect(result).toContain('new insights, reactions, or perspectives');
    });

    test('different behavior for empty vs populated thoughts arrays', () => {
      const emptyResult = formatter.formatThoughtsVoiceGuidance([]);
      const populatedResult = formatter.formatThoughtsVoiceGuidance([
        { text: 'Test', timestamp: '2024-01-01' },
      ]);

      expect(emptyResult).not.toBe(populatedResult);
      expect(emptyResult).toContain('Generate thoughts');
      expect(populatedResult).toContain('do not repeat');
    });
  });

  describe('formatThoughtsSection - Enhanced Functionality', () => {
    test('enhanced section contains anti-repetition instructions', () => {
      const thoughts = [{ text: 'Test thought', timestamp: '2024-01-01' }];
      const result = formatter.formatThoughtsSection(thoughts);

      expect(result).toContain(
        'Recent thoughts (avoid repeating or barely rephrasing these):'
      );
      expect(result).toContain(
        'Generate a fresh, unique thought that builds upon your mental state.'
      );
      expect(result).toContain(
        "Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action"
      );
      expect(result).toContain('- Test thought');
    });

    test('enhanced section maintains proper XML structure', () => {
      const thoughts = [{ text: 'Test', timestamp: '2024-01-01' }];
      const result = formatter.formatThoughtsSection(thoughts);

      expect(result).toMatch(/^<thoughts>.*<\/thoughts>$/s);
      expect(result.split('\n')).toHaveLength(7); // Expected number of lines in new format
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

      expect(result).toContain(
        '<notes>\n## Other\n### General\n- Important note\n- Another note\n</notes>'
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
        `<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):
- Test thought

-----
Generate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.
</thoughts>`
      );
      expect(result.notesVoiceGuidance).toBe(makeNotesGuidance());
      expect(result.notesSection).toBe('');
      expect(result.goalsSection).toBe('<goals>\n- Test goal\n</goals>');
    });

    test('includes thoughtsVoiceGuidance field based on thoughts array', () => {
      // Test with thoughts present
      const promptDataWithThoughts = {
        thoughtsArray: [{ text: 'Test thought', timestamp: '2024-01-01' }],
      };

      const resultWithThoughts = formatter.formatPromptData(
        promptDataWithThoughts
      );
      expect(resultWithThoughts.thoughtsVoiceGuidance).toBe(
        "INNER VOICE GUIDANCE: Your thoughts must be fresh and unique - do not repeat or barely rephrase the previous thoughts shown above. Build upon your existing mental state with new insights, reactions, or perspectives that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );

      // Test with empty thoughts array
      const promptDataEmpty = {
        thoughtsArray: [],
      };

      const resultEmpty = formatter.formatPromptData(promptDataEmpty);
      expect(resultEmpty.thoughtsVoiceGuidance).toBe(
        "INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );

      // Test with no thoughts array
      const promptDataMissing = {};

      const resultMissing = formatter.formatPromptData(promptDataMissing);
      expect(resultMissing.thoughtsVoiceGuidance).toBe(
        "INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );
    });

    test('formatNotes maintains backward compatibility with default options', () => {
      const notesArray = [
        { text: 'First note', timestamp: '2024-01-01' },
        { text: 'Second note', timestamp: '2024-01-02' },
      ];

      // Test without options (should default to grouped format)
      const resultDefault = formatter.formatNotes(notesArray);
      expect(resultDefault).toContain(
        '## Other\n### General\n- First note\n- Second note'
      );

      // Test with explicit legacy options
      const resultLegacy = formatter.formatNotes(notesArray, {
        groupBySubject: false,
      });
      expect(resultLegacy).toBe('- First note\n- Second note');

      // Test with empty options (should default to grouped format)
      const resultEmpty = formatter.formatNotes(notesArray, {});
      expect(resultEmpty).toContain(
        '## Other\n### General\n- First note\n- Second note'
      );
    });

    test('formatNotesSection accepts options parameter', () => {
      const notesArray = [{ text: 'Test note', timestamp: '2024-01-01' }];

      // Test without options (now defaults to grouped format)
      const resultDefault = formatter.formatNotesSection(notesArray);
      expect(resultDefault).toContain(
        '<notes>\n## Other\n### General\n- Test note\n</notes>'
      );

      // Test with options passed through
      const resultWithOptions = formatter.formatNotesSection(notesArray, {});
      expect(resultWithOptions).toContain(
        '<notes>\n## Other\n### General\n- Test note\n</notes>'
      );
    });

    test('notesVoiceGuidance personalizes output with character name and existing notes', () => {
      const promptData = {
        characterName: 'Amaia Castillo',
        notesArray: [
          {
            text: 'Existing strategic note',
            subject: 'Opportunity',
            subjectType: 'plan',
          },
        ],
      };

      const result = formatter.formatPromptData(promptData);

      expect(result.notesVoiceGuidance).toBe(
        makeNotesGuidance('Amaia Castillo', true)
      );
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
      expect(result.thoughtsVoiceGuidance).toBe(
        "INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects."
      );
      expect(result.notesVoiceGuidance).toBe(makeNotesGuidance());
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
        `<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):
- I have a thought

-----
Generate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.
</thoughts>`
      );
      expect(result.notesSection).toBe('');
      expect(result.goalsSection).toBe(
        '<goals>\n- Achieve something\n</goals>'
      );
      expect(result.notesVoiceGuidance).toBe(makeNotesGuidance());
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
      expect(result).toMatch(/^<thoughts>.*<\/thoughts>$/s);
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
