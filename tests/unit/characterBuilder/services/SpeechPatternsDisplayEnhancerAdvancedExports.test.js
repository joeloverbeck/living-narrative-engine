/**
 * @file Unit tests for SpeechPatternsDisplayEnhancer Advanced Export Features
 *
 * Tests advanced export functionality:
 * - Markdown format export
 * - CSV format export
 * - Template system
 * - Enhanced text and JSON exports
 * - Statistics generation
 * - Category grouping
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsDisplayEnhancer from '../../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import {
  createMockSpeechPatterns,
  createMockCharacterDefinition,
} from '../../../common/characterBuilder/speechPatternsTestHelpers.js';

describe('SpeechPatternsDisplayEnhancer - Advanced Exports', () => {
  let testBed;
  let enhancer;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    enhancer = new SpeechPatternsDisplayEnhancer({
      logger: mockLogger,
    });
  });

  describe('Enhanced Export Formats', () => {
    it('should list all supported export formats', () => {
      const formats = enhancer.getSupportedExportFormats();

      expect(formats).toHaveLength(4);
      expect(formats.map((f) => f.id)).toEqual([
        'txt',
        'json',
        'markdown',
        'csv',
      ]);
      expect(formats[0]).toHaveProperty('name', 'Plain Text');
      expect(formats[1]).toHaveProperty('name', 'JSON Data');
      expect(formats[2]).toHaveProperty('name', 'Markdown');
      expect(formats[3]).toHaveProperty('name', 'CSV');
    });

    it('should validate each format has required properties', () => {
      const formats = enhancer.getSupportedExportFormats();

      formats.forEach((format) => {
        expect(format).toHaveProperty('id');
        expect(format).toHaveProperty('name');
        expect(format).toHaveProperty('extension');
        expect(format).toHaveProperty('mimeType');
        expect(format).toHaveProperty('description');
      });
    });
  });

  describe('Enhanced Text Export', () => {
    it('should include statistics in enhanced text export', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatForExport(patterns, {
        includeStatistics: true,
      });

      expect(result).toContain('PATTERN STATISTICS:');
      expect(result).toContain('Total Patterns:');
      expect(result).toContain('Average Pattern Length:');
      expect(result).toContain('Average Example Length:');
      expect(result).toContain('Complexity Distribution:');
      expect(result).toContain('Category Distribution:');
    });

    it('should group patterns by category', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatForExport(patterns);

      expect(result).toContain('SPEECH PATTERNS BY CATEGORY:');
    });

    it('should exclude statistics when requested', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatForExport(patterns, {
        includeStatistics: false,
      });

      expect(result).not.toContain('PATTERN STATISTICS:');
    });
  });

  describe('Enhanced JSON Export', () => {
    it('should include statistics in JSON export', () => {
      const patterns = createMockSpeechPatterns();
      const jsonString = enhancer.formatAsJson(patterns);
      const result = JSON.parse(jsonString);

      expect(result).toHaveProperty('statistics');
      expect(result.statistics).toHaveProperty('averagePatternLength');
      expect(result.statistics).toHaveProperty('averageExampleLength');
      expect(result.statistics).toHaveProperty('complexityDistribution');
      expect(result.statistics).toHaveProperty('categoryDistribution');
    });

    it('should include enhanced metadata', () => {
      const patterns = createMockSpeechPatterns();
      const jsonString = enhancer.formatAsJson(patterns);
      const result = JSON.parse(jsonString);

      expect(result.metadata).toHaveProperty('version', '2.0.0');
      expect(result.metadata).toHaveProperty('schemaVersion', '1.0.0');
      expect(result.metadata).toHaveProperty('characterName');
      expect(result.metadata).toHaveProperty('generatedAt');
      expect(result.metadata).toHaveProperty('exportedAt');
      expect(result.metadata).toHaveProperty('totalPatterns');
    });

    it('should include pattern metadata', () => {
      const patterns = createMockSpeechPatterns();
      const jsonString = enhancer.formatAsJson(patterns);
      const result = JSON.parse(jsonString);

      expect(result.speechPatterns[0]).toHaveProperty('metadata');
      expect(result.speechPatterns[0].metadata).toHaveProperty('categories');
      expect(result.speechPatterns[0].metadata).toHaveProperty('complexity');
    });
  });

  describe('Markdown Export', () => {
    it('should export patterns as Markdown', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsMarkdown(patterns);

      expect(result).toContain('# Speech Patterns for Test Character');
      expect(result).toContain('## Table of Contents');
      expect(result).toContain('## Pattern Statistics');
      expect(result).toContain('## Speech Patterns by Category');
      expect(result).toContain('## Complete Pattern List');
    });

    it('should format statistics as Markdown tables', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsMarkdown(patterns);

      expect(result).toContain('| Metric | Value |');
      expect(result).toContain('| Total Patterns |');
      expect(result).toContain('| Average Pattern Length |');
      expect(result).toContain('| Level | Count | Percentage |');
    });

    it('should format patterns as Markdown sections', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsMarkdown(patterns);

      expect(result).toContain('#### Pattern');
      expect(result).toContain('**Pattern:**');
      expect(result).toContain('**Example:**');
      expect(result).toContain('**Context:**');
    });

    it('should create a complete pattern list table', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsMarkdown(patterns);

      expect(result).toContain('| # | Pattern | Example | Circumstances |');
      expect(result).toContain('|---|---------|---------|---------------|');
    });

    it('should escape Markdown table special characters', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Pattern with | pipe',
            example: 'Example with | pipe',
            circumstances: 'Context with | pipe',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.formatAsMarkdown(patterns);
      // Check that pipes in the content are properly escaped in table cells
      expect(result).toContain('\\|');
    });

    it('should include character definition when requested', () => {
      const patterns = createMockSpeechPatterns();
      const characterDef = createMockCharacterDefinition();
      const result = enhancer.formatAsMarkdown(patterns, {
        includeCharacterData: true,
        characterDefinition: characterDef,
      });

      expect(result).toContain('## Character Definition');
      expect(result).toContain('```json');
    });
  });

  describe('CSV Export', () => {
    it('should export patterns as CSV', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsCsv(patterns);

      expect(result).toContain('ID,Pattern,Example,Circumstances');
      expect(result).toContain('Categories');
      expect(result).toContain('Complexity');
      expect(result).toContain('Pattern Length');
      expect(result).toContain('Example Length');
    });

    it('should properly escape CSV cells with special characters', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Pattern with, comma',
            example: 'Example with "quotes"',
            circumstances: 'Context with\nnewline',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.formatAsCsv(patterns);
      expect(result).toContain('"Pattern with, comma"');
      expect(result).toContain('"Example with ""quotes"""');
      expect(result).toContain('"Context with\nnewline"');
    });

    it('should include metadata rows when requested', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsCsv(patterns, {
        includeMetadata: true,
      });

      expect(result).toContain('Character Name,Test Character');
      expect(result).toContain('Generated At,');
      expect(result).toContain('Export Date,');
    });

    it('should exclude metadata when requested', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsCsv(patterns, {
        includeMetadata: false,
      });

      const firstLine = result.split('\n')[0];
      expect(firstLine).toContain('ID,Pattern,Example');
    });

    it('should handle patterns without circumstances', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Test pattern',
            example: 'Test example',
            // No circumstances
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.formatAsCsv(patterns);
      const lines = result.split('\n');
      const dataLine = lines.find((line) => line.startsWith('1,'));
      expect(dataLine).toBeDefined();
      expect(dataLine).toMatch(/,,/); // Empty circumstances field
    });
  });

  describe('Template System', () => {
    it('should list available templates', () => {
      const templates = enhancer.getAvailableTemplates();

      expect(templates).toHaveLength(4);
      expect(templates.map((t) => t.id)).toEqual([
        'default',
        'detailed',
        'summary',
        'characterSheet',
      ]);
    });

    it('should apply default template', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.applyTemplate(patterns, 'default');

      expect(result).toContain('SPEECH PATTERNS FOR');
      expect(result).toContain('PATTERN:');
      expect(result).toContain('EXAMPLE:');
    });

    it('should apply detailed template', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.applyTemplate(patterns, 'detailed');

      expect(result).toContain('COMPREHENSIVE SPEECH PATTERN ANALYSIS');
      expect(result).toContain('EXECUTIVE SUMMARY');
      expect(result).toContain('PATTERN STATISTICS:');
      expect(result).toContain('SPEECH PATTERNS BY CATEGORY:');
    });

    it('should apply summary template', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.applyTemplate(patterns, 'summary');

      expect(result).toContain('SPEECH PATTERN SUMMARY:');
      expect(result).toContain('KEY PATTERNS');
      expect(result).toContain('Total Patterns:');
      expect(result).toContain('Complexity:');
    });

    it('should apply character sheet template', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.applyTemplate(patterns, 'characterSheet');

      expect(result).toContain('CHARACTER SPEECH PROFILE');
      expect(result).toContain('SPEECH CHARACTERISTICS');
      expect(result).toContain('SIGNATURE PATTERNS');
      expect(result).toContain('Character:');
      expect(result).toContain('Generated:');
    });

    it('should limit patterns in summary template', () => {
      const patterns = {
        speechPatterns: Array(20)
          .fill(null)
          .map((_, i) => ({
            pattern: `Pattern ${i + 1}`,
            example: `Example ${i + 1}`,
            circumstances: `Context ${i + 1}`,
          })),
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.applyTemplate(patterns, 'summary', {
        maxPatterns: 5,
      });

      expect(result).toContain('KEY PATTERNS (Top 5)');
      expect(result).toContain('... and 15 more patterns');
    });

    it('should fall back to default for unknown template', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.applyTemplate(patterns, 'unknownTemplate');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown template')
      );
      expect(result).toContain('SPEECH PATTERNS FOR');
    });

    it('should include character data in detailed template', () => {
      const patterns = createMockSpeechPatterns();
      const characterDef = createMockCharacterDefinition();
      const result = enhancer.applyTemplate(patterns, 'detailed', {
        includeCharacterData: true,
        characterDefinition: characterDef,
      });

      expect(result).toContain('CHARACTER DEFINITION:');
    });
  });

  describe('Statistics Generation', () => {
    it('should generate comprehensive statistics', () => {
      const patterns = createMockSpeechPatterns();
      const stats = enhancer.generateStatistics(patterns);

      expect(stats).toHaveProperty('totalPatterns', 3);
      expect(stats).toHaveProperty('averagePatternLength');
      expect(stats).toHaveProperty('averageExampleLength');
      expect(stats).toHaveProperty('patternsWithCircumstances');
      expect(stats).toHaveProperty('complexityDistribution');
      expect(stats).toHaveProperty('categoryDistribution');
      expect(stats).toHaveProperty('totalTextLength');
    });

    it('should calculate correct complexity distribution', () => {
      const patterns = createMockSpeechPatterns();
      const stats = enhancer.generateStatistics(patterns);

      expect(stats.complexityDistribution).toHaveProperty('low');
      expect(stats.complexityDistribution).toHaveProperty('medium');
      expect(stats.complexityDistribution).toHaveProperty('high');

      const totalComplexity =
        stats.complexityDistribution.low +
        stats.complexityDistribution.medium +
        stats.complexityDistribution.high;
      expect(totalComplexity).toBe(3);
    });

    it('should calculate category distribution', () => {
      const patterns = createMockSpeechPatterns();
      const stats = enhancer.generateStatistics(patterns);

      expect(stats.categoryDistribution).toBeDefined();
      expect(typeof stats.categoryDistribution).toBe('object');
    });

    it('should surface errors when statistics generation fails', () => {
      const malformedPatterns = {
        characterName: 'Glitched Character',
      };

      expect(() => enhancer.generateStatistics(malformedPatterns)).toThrow(
        /Statistics generation failed: .*length/i
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate pattern statistics',
        expect.any(Error)
      );
    });
  });

  describe('Export Filename Generation', () => {
    it('should generate filename with different extensions', () => {
      const characterName = 'Test Character';

      const txtFilename = enhancer.generateExportFilename(characterName, {
        extension: 'txt',
      });
      expect(txtFilename).toMatch(/\.txt$/);

      const jsonFilename = enhancer.generateExportFilename(characterName, {
        extension: 'json',
      });
      expect(jsonFilename).toMatch(/\.json$/);

      const mdFilename = enhancer.generateExportFilename(characterName, {
        extension: 'md',
      });
      expect(mdFilename).toMatch(/\.md$/);

      const csvFilename = enhancer.generateExportFilename(characterName, {
        extension: 'csv',
      });
      expect(csvFilename).toMatch(/\.csv$/);
    });
  });

  describe('Error Handling', () => {
    it('should wrap validation failures when formatting for export', () => {
      const invalidPatterns = {
        speechPatterns: [],
        characterName: 'Invalid Character',
      };

      expect(() => enhancer.formatForExport(invalidPatterns)).toThrow(
        'Export formatting failed: No speech patterns to process'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to format speech patterns for export',
        expect.any(Error)
      );
    });

    it('should wrap JSON formatting errors with helpful context', () => {
      const patterns = createMockSpeechPatterns();
      const circularDefinition = {};
      circularDefinition.self = circularDefinition;

      expect(() =>
        enhancer.formatAsJson(patterns, {
          includeCharacterData: true,
          characterDefinition: circularDefinition,
        })
      ).toThrow(/JSON formatting failed: .*circular structure/i);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to format patterns as JSON',
        expect.any(Error)
      );
    });

    it('should wrap template application errors with context', () => {
      const invalidPatterns = {
        speechPatterns: [],
        characterName: 'Empty',
      };

      expect(() => enhancer.applyTemplate(invalidPatterns, 'default')).toThrow(
        'Template application failed: No speech patterns to process'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to apply template default',
        expect.any(Error)
      );
    });

    it('should fall back to a timestamped filename when generation fails', () => {
      const originalToISOString = Date.prototype.toISOString;
      Date.prototype.toISOString = jest.fn(() => {
        throw new Error('ISO failure');
      });

      try {
        const filename = enhancer.generateExportFilename('Hero Name');
        expect(filename).toMatch(/^speech_patterns_export_\d+\.txt$/);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to generate export filename',
          expect.any(Error)
        );
      } finally {
        Date.prototype.toISOString = originalToISOString;
      }
    });

    it('should handle invalid patterns in Markdown export', () => {
      expect(() => {
        enhancer.formatAsMarkdown(null);
      }).toThrow('Speech patterns data');
    });

    it('should handle invalid patterns in CSV export', () => {
      expect(() => {
        enhancer.formatAsCsv(null);
      }).toThrow('Speech patterns data');
    });

    it('should handle invalid template name', () => {
      const patterns = createMockSpeechPatterns();
      expect(() => {
        enhancer.applyTemplate(patterns, '');
      }).toThrow();
    });

    it('should handle missing pattern fields in CSV', () => {
      const patterns = {
        speechPatterns: [
          {
            // Missing required fields
            pattern: 'Only pattern field',
          },
        ],
        characterName: 'Test',
      };

      expect(() => {
        enhancer.formatAsCsv(patterns);
      }).toThrow();
    });

    it('should handle missing pattern fields in Markdown', () => {
      const patterns = {
        speechPatterns: [
          {
            // Missing required fields
            pattern: 'Only pattern field',
          },
        ],
        characterName: 'Test',
      };

      expect(() => {
        enhancer.formatAsMarkdown(patterns);
      }).toThrow();
    });
  });
});
