/**
 * @file Tests for PromptDataFormatter simplified perception log enhancement
 * @description Tests the simplified perception log formatting (no XML tags) introduced in LLM prompt enhancement spec
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';

describe('PromptDataFormatter - Simplified Perception Log Enhancement', () => {
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

  describe('formatPerceptionLog - Simplified Format', () => {
    test('should format perception entries without XML tags', () => {
      const perceptionLogArray = [
        {
          content: 'John says: "Hello there!"',
          type: 'speech_local',
        },
        {
          content: 'Mary leaves to go to the kitchen.',
          type: 'character_exit',
        },
        {
          content: 'A loud crash echoes from upstairs.',
          type: 'sound',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      // Should not contain XML tags
      expect(result).not.toContain('<entry');
      expect(result).not.toContain('type=');
      expect(result).not.toContain('</entry>');

      // Should contain just the content, line by line
      expect(result).toBe(
        'John says: "Hello there!"\nMary leaves to go to the kitchen.\nA loud crash echoes from upstairs.'
      );
    });

    test('should preserve chronological order of events', () => {
      const perceptionLogArray = [
        {
          content: 'First event occurred.',
          type: 'event',
        },
        {
          content: 'Second event happened.',
          type: 'event',
        },
        {
          content: 'Third event took place.',
          type: 'event',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      expect(result).toBe(
        'First event occurred.\nSecond event happened.\nThird event took place.'
      );
    });

    test('should filter out empty entries', () => {
      const perceptionLogArray = [
        {
          content: 'Valid entry',
          type: 'speech_local',
        },
        {
          content: '',
          type: 'empty',
        },
        {
          content: '   ',
          type: 'whitespace_only',
        },
        {
          content: 'Another valid entry',
          type: 'action',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      // Should exclude empty and whitespace-only entries
      expect(result).toBe('Valid entry\nAnother valid entry');
    });

    test('should handle missing content field gracefully', () => {
      const perceptionLogArray = [
        {
          content: 'Valid entry',
          type: 'speech_local',
        },
        {
          type: 'missing_content',
        },
        {
          content: 'Another valid entry',
          type: 'action',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      // Should filter out entries with missing content
      expect(result).toBe('Valid entry\nAnother valid entry');
    });

    test('should return empty string for empty array', () => {
      const result = formatter.formatPerceptionLog([]);

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptDataFormatter: No perception log entries to format'
      );
    });

    test('should return empty string for null/undefined input', () => {
      expect(formatter.formatPerceptionLog(null)).toBe('');
      expect(formatter.formatPerceptionLog(undefined)).toBe('');
    });

    test('should filter out invalid entries', () => {
      const perceptionLogArray = [
        {
          content: 'Valid entry',
          type: 'speech_local',
        },
        null,
        undefined,
        'not an object',
        {
          content: 'Another valid entry',
          type: 'action',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      expect(result).toBe('Valid entry\nAnother valid entry');
    });

    test('should log successful formatting with simplified format message', () => {
      const perceptionLogArray = [
        {
          content: 'Test entry',
          type: 'test',
        },
      ];

      formatter.formatPerceptionLog(perceptionLogArray);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptDataFormatter: Formatted 1 perception log entries with simplified format'
      );
    });

    test('should handle different types of perception events consistently', () => {
      const perceptionLogArray = [
        {
          content: 'Alice says: "Good morning!"',
          type: 'speech_local',
        },
        {
          content: 'Bob arrives from the garden.',
          type: 'character_enter',
        },
        {
          content: 'Carol leaves to go to the library.',
          type: 'character_exit',
        },
        {
          content: 'A bird chirps in the distance.',
          type: 'sound',
        },
        {
          content: 'The sun begins to set.',
          type: 'environment',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      const expectedResult = [
        'Alice says: "Good morning!"',
        'Bob arrives from the garden.',
        'Carol leaves to go to the library.',
        'A bird chirps in the distance.',
        'The sun begins to set.',
      ].join('\n');

      expect(result).toBe(expectedResult);
    });

    test('should handle single perception entry', () => {
      const perceptionLogArray = [
        {
          content: 'A single event occurs.',
          type: 'event',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      expect(result).toBe('A single event occurs.');
    });

    test('should preserve exact content without modification', () => {
      const perceptionLogArray = [
        {
          content: 'Content with "quotes" and special chars: !@#$%^&*()',
          type: 'speech_local',
        },
        {
          content: 'Multi-word content with    extra    spaces',
          type: 'action',
        },
      ];

      const result = formatter.formatPerceptionLog(perceptionLogArray);

      expect(result).toBe(
        'Content with "quotes" and special chars: !@#$%^&*()\nMulti-word content with    extra    spaces'
      );
    });
  });
});
