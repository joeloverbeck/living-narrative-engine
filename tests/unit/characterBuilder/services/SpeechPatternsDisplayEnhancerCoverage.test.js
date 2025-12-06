/**
 * @file Additional edge case coverage tests for SpeechPatternsDisplayEnhancer
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsDisplayEnhancer from '../../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import { createMockSpeechPatternsArray } from '../../../common/characterBuilder/speechPatternsTestHelpers.js';

describe('SpeechPatternsDisplayEnhancer - Coverage Edge Cases', () => {
  let enhancer;
  let mockLogger;

  beforeEach(() => {
    const testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    enhancer = new SpeechPatternsDisplayEnhancer({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createMinimalPatterns = (overrides = {}) => ({
    speechPatterns: [
      {
        pattern: 'Simple speech pattern',
        example: 'A calm example line',
        circumstances: 'When relaxed',
      },
    ],
    ...overrides,
  });

  it('uses safe defaults for display metadata when character data missing', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));

    const result = enhancer.enhanceForDisplay({
      speechPatterns: createMockSpeechPatternsArray(),
    });

    expect(result.characterName).toBe('Character');
    expect(result.generatedAt).toBe('2024-01-02T03:04:05.000Z');
    expect(result.totalCount).toBe(3);
    expect(result.displayOptions).toEqual({});
  });

  it('sanitizes non-string circumstances gracefully', () => {
    const result = enhancer.enhanceForDisplay({
      speechPatterns: [
        {
          pattern: 'Handles unexpected values',
          example: 'Still works',
          circumstances: {
            trim: () => ({ unexpected: true }),
          },
        },
      ],
    });

    expect(result.patterns[0].circumstances).toEqual({ unexpected: true });
    expect(result.patterns[0].htmlSafeCircumstances).toBe('');
  });

  it('groups uncategorised patterns as general in text exports', () => {
    const exportText = enhancer.formatForExport(
      {
        speechPatterns: [
          {
            pattern: 'Speaks plainly with no keywords',
            example: 'Hello friend',
          },
        ],
      },
      {}
    );

    expect(exportText).toContain('SPEECH PATTERNS FOR CHARACTER');
    expect(exportText).toContain('General Patterns (1)');
  });

  it('populates metadata defaults in JSON export', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-12-24T10:11:12.000Z'));

    const patterns = {
      speechPatterns: createMockSpeechPatternsArray(),
      characterName: '',
      generatedAt: '',
    };

    const parsed = JSON.parse(enhancer.formatAsJson(patterns));

    expect(parsed.metadata.characterName).toBe('Character');
    expect(parsed.metadata.generatedAt).toBe('2023-12-24T10:11:12.000Z');
    expect(parsed.metadata.exportedAt).toBe('2023-12-24T10:11:12.000Z');
  });

  it('renders markdown using defaults and escapes table cells', () => {
    const markdown = enhancer.formatAsMarkdown({
      speechPatterns: [
        {
          pattern: 'Pipe | Value',
          example: 'First line\nSecond line',
          circumstances: '',
        },
      ],
    });

    expect(markdown).toContain('# Speech Patterns for Character');
    expect(markdown).not.toContain('**Context:**');
    expect(markdown).toContain('Pipe \\| Value');
    expect(markdown).toContain('First line Second line');
    expect(markdown).toContain('| 1 |');
    expect(markdown).toContain('| Any |');
  });

  it('generates CSV without metadata when disabled and escapes values', () => {
    const csv = enhancer.formatAsCsv(
      {
        speechPatterns: [
          {
            pattern: 'Comma, value',
            example: 'Quotes "needed"',
            circumstances: '',
          },
        ],
      },
      { includeMetadata: false }
    );

    const rows = csv.split('\n');
    expect(rows[0]).toBe(
      'ID,Pattern,Example,Circumstances,Categories,Complexity,Pattern Length,Example Length'
    );
    expect(rows[1]).toContain('"Comma, value"');
    expect(rows[1]).toContain('"Quotes ""needed"""');
    expect(csv).not.toContain('Export Date');
    expect(csv).not.toContain('Character Name');
  });

  it('preserves provided export option timestamp', () => {
    const validated = enhancer.validateExportOptions({
      timestamp: '2024-04-05',
    });
    expect(validated.timestamp).toBe('2024-04-05');
  });

  it('detailed template falls back to default character metadata', () => {
    const output = enhancer.applyTemplate(
      createMinimalPatterns({ characterName: '' }),
      'detailed'
    );

    expect(output).toContain('Character: Character');
    expect(output).toContain('for the character "Character"');
  });

  it('summary template respects maxPatterns and uses fallback name', () => {
    const patterns = {
      speechPatterns: Array.from({ length: 6 }, (_, index) => ({
        pattern: `Pattern ${index + 1}`,
        example: `Example ${index + 1}`,
      })),
      characterName: '',
    };

    const output = enhancer.applyTemplate(patterns, 'summary', {
      maxPatterns: 2,
    });

    expect(output).toContain('SPEECH PATTERN SUMMARY: CHARACTER');
    expect(output).toContain('KEY PATTERNS (Top 2)');
    expect(output).toContain('... and 4 more patterns');
  });

  it('character sheet template wraps long content and selects signature patterns', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T08:30:00.000Z'));

    const patterns = {
      speechPatterns: Array.from({ length: 6 }, (_, index) => ({
        pattern:
          'Pattern with a sentence that is intentionally crafted to exceed the sixty four character width used in the renderer ' +
          index,
        example:
          'Example with description long enough to wrap across multiple lines for readability ' +
          index,
      })),
      characterName: '',
      generatedAt: '',
    };

    const output = enhancer.applyTemplate(patterns, 'characterSheet');

    expect(output).toContain('CHARACTER SPEECH PROFILE');
    expect(output).toContain('Character: Character');
    expect(output).toContain('Generated:');

    expect(output).toContain(
      '║ Pattern with a sentence that is intentionally crafted to exceed    ║'
    );
    expect(output).toContain(
      '║ the sixty four character width used in the renderer 0              ║'
    );
    expect((output.match(/→/g) || []).length).toBe(5);
  });
});
