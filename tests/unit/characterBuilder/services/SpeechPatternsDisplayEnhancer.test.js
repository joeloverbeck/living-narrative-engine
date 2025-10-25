/**
 * @file Unit tests for SpeechPatternsDisplayEnhancer
 *
 * Tests display enhancement service responsibilities:
 * - Display formatting for speech pattern components
 * - HTML escaping and XSS prevention
 * - Export functionality (TXT, JSON formats)
 * - Pattern analysis (complexity, categorization)
 * - Statistics generation
 * - Edge cases with malformed data
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsDisplayEnhancer from '../../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import {
  createMockSpeechPatterns,
  createMockCharacterDefinition,
  EdgeCaseFixtures,
} from '../../../common/characterBuilder/speechPatternsTestHelpers.js';

describe('SpeechPatternsDisplayEnhancer', () => {
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

  describe('Constructor', () => {
    it('should create enhancer with valid dependencies', () => {
      expect(enhancer).toBeInstanceOf(SpeechPatternsDisplayEnhancer);
    });

    it('should throw error for missing logger', () => {
      expect(() => {
        new SpeechPatternsDisplayEnhancer({});
      }).toThrow();
    });

    it('should validate logger interface', () => {
      expect(() => {
        new SpeechPatternsDisplayEnhancer({
          logger: { info: jest.fn() }, // Missing required methods
        });
      }).toThrow();
    });
  });

  describe('Display Enhancement', () => {
    it('should enhance valid speech patterns for display', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.enhanceForDisplay(patterns);

      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('characterName', 'Test Character');
      expect(result).toHaveProperty('totalCount', 3);
      expect(result.patterns).toHaveLength(3);
      expect(result.patterns[0]).toHaveProperty('htmlSafePattern');
      expect(result.patterns[0]).toHaveProperty('htmlSafeExample');
    });

    it('should enhance all pattern components', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.enhanceForDisplay(patterns);

      const firstPattern = result.patterns[0];
      expect(firstPattern).toHaveProperty('id', 'pattern-1');
      expect(firstPattern).toHaveProperty('index', 1);
      expect(firstPattern).toHaveProperty('pattern');
      expect(firstPattern).toHaveProperty('example');
      expect(firstPattern).toHaveProperty('circumstances');
      expect(firstPattern).toHaveProperty('complexity');
      expect(firstPattern).toHaveProperty('categories');
      expect(firstPattern).toHaveProperty('patternLength');
      expect(firstPattern).toHaveProperty('exampleLength');
    });

    it('should handle patterns without circumstances', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Test pattern',
            example: 'Test example',
            // No circumstances field
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(patterns);
      expect(result.patterns[0].htmlSafeCircumstances).toBeNull();
      expect(result.patterns[0].hasCircumstances).toBe(false);
    });

    it('should throw error for invalid patterns structure', () => {
      expect(() => {
        enhancer.enhanceForDisplay({ invalid: 'structure' });
      }).toThrow('Invalid patterns structure');
    });

    it('should throw error for empty patterns array', () => {
      const emptyPatterns = {
        speechPatterns: [],
        characterName: 'Test',
      };

      expect(() => {
        enhancer.enhanceForDisplay(emptyPatterns);
      }).toThrow('No speech patterns to process');
    });

    it('should throw error for missing required fields', () => {
      const invalidPatterns = {
        speechPatterns: [
          {
            // Missing pattern and example fields
            description: 'Invalid',
          },
        ],
        characterName: 'Test',
      };

      expect(() => {
        enhancer.enhanceForDisplay(invalidPatterns);
      }).toThrow("Pattern 1 missing required 'pattern' field");
    });

    it('should analyze pattern complexity', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.enhanceForDisplay(patterns);

      expect(result.patterns[0].complexity).toHaveProperty('score');
      expect(result.patterns[0].complexity).toHaveProperty('level');
      expect(result.patterns[0].complexity).toHaveProperty('textLength');
      expect(result.patterns[0].complexity).toHaveProperty('wordCount');
    });

    it('should categorize patterns', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Speaks with anger and rage',
            example: 'I am furious about this situation!',
            circumstances: 'When very angry',
          },
          {
            pattern: 'Whispers quietly when sad',
            example: 'I feel so melancholy...',
            circumstances: 'When depressed',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(patterns);
      expect(result.patterns[0].categories).toContain('anger');
      expect(result.patterns[1].categories).toContain('sadness');
      expect(result.patterns[1].categories).toContain('quiet');
    });

    it('should detect nuanced emotional and situational categories', () => {
      const complexPatterns = {
        speechPatterns: [
          {
            pattern:
              'A terrified yet relaxed and comfortable speaker who feels stressed under pressure but keeps a casual, informal tone while whisper quiet thoughts before a loud shout full of sarcasm.',
            example:
              'When feeling relaxed but still stressed, they might whisper softly before a sarcastic and loud outburst during informal chats.',
            circumstances:
              'Typically happens when the character is comfortable yet tense in professional settings.',
          },
        ],
        characterName: 'Nuanced Character',
        generatedAt: new Date().toISOString(),
      };

      const [{ categories }] = enhancer.enhanceForDisplay(complexPatterns).patterns;

      expect(categories).toEqual(
        expect.arrayContaining([
          'fear',
          'comfortable',
          'stressed',
          'casual',
          'formal',
          'quiet',
          'loud',
          'sarcastic',
        ])
      );
    });
  });

  describe('HTML Escaping and XSS Prevention', () => {
    it('should escape HTML in pattern text', () => {
      const maliciousPatterns = {
        speechPatterns: [
          {
            pattern: '<script>alert("XSS")</script>',
            example: 'Normal example',
            circumstances: 'Test',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(maliciousPatterns);
      expect(result.patterns[0].htmlSafePattern).not.toContain('<script>');
      expect(result.patterns[0].htmlSafePattern).toContain('&lt;script&gt;');
    });

    it('should escape HTML in examples', () => {
      const maliciousPatterns = {
        speechPatterns: [
          {
            pattern: 'Test pattern',
            example: '<img src=x onerror=alert(1)>',
            circumstances: 'Test',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(maliciousPatterns);
      expect(result.patterns[0].htmlSafeExample).not.toContain('<img');
      // The escaping converts the entire string, so onerror= is preserved in the escaped form
      expect(result.patterns[0].htmlSafeExample).toContain('&lt;img');
    });

    it('should escape HTML in circumstances', () => {
      const maliciousPatterns = {
        speechPatterns: [
          {
            pattern: 'Test pattern',
            example: 'Test example',
            circumstances: '<a href="javascript:alert(1)">Click</a>',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(maliciousPatterns);
      // The escaping converts quotes but preserves the text content
      expect(result.patterns[0].htmlSafeCircumstances).toContain('&lt;a');
      expect(result.patterns[0].htmlSafeCircumstances).toContain('&quot;');
    });

    it('should handle special characters safely', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Test & < > " \' characters',
            example: 'He said "Hello" & waved',
            circumstances: 'Special chars < > test',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(patterns);
      expect(result.patterns[0].htmlSafePattern).toContain('&amp;');
      expect(result.patterns[0].htmlSafePattern).toContain('&lt;');
      expect(result.patterns[0].htmlSafePattern).toContain('&gt;');
      expect(result.patterns[0].htmlSafePattern).toContain('&quot;');
      expect(result.patterns[0].htmlSafeExample).toContain('&quot;');
    });

    it('should preserve safe unicode characters', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Unicode test: 你好 🎭 مرحبا',
            example: 'Emoji test 😊',
            circumstances: '日本語 テスト',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(patterns);
      expect(result.patterns[0].htmlSafePattern).toContain('你好');
      expect(result.patterns[0].htmlSafePattern).toContain('🎭');
      expect(result.patterns[0].htmlSafePattern).toContain('مرحبا');
      expect(result.patterns[0].htmlSafeExample).toContain('😊');
    });
  });

  describe('Text Export Functionality', () => {
    it('should format patterns for text export', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatForExport(patterns);

      expect(result).toContain('SPEECH PATTERNS FOR TEST CHARACTER');
      expect(result).toContain('01. PATTERN:');
      expect(result).toContain('02. PATTERN:');
      expect(result).toContain('EXAMPLE:');
      expect(result).toContain('CONTEXT:');
    });

    it('should include all pattern fields in text export', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatForExport(patterns);

      expect(result).toContain(
        'Uses enthusiastic and repetitive expressions when excited'
      );
      expect(result).toContain("Oh wow, that's amazing!");
      expect(result).toContain('When feeling happy and excited');
    });

    it('should handle patterns without circumstances in text export', () => {
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

      const result = enhancer.formatForExport(patterns);
      expect(result).toContain('PATTERN: Test pattern');
      expect(result).toContain('EXAMPLE: Test example');
      expect(result).not.toContain('CONTEXT:    EXAMPLE:'); // Should not have empty context line
    });

    it('should include export metadata', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatForExport(patterns);

      expect(result).toContain('Generated:');
      expect(result).toContain('Total Patterns: 3');
      expect(result).toContain('Export Generated:');
      expect(result).toContain('USAGE NOTES:');
    });

    it('should include character definition when requested', () => {
      const patterns = createMockSpeechPatterns();
      const characterDef = createMockCharacterDefinition();
      const options = {
        includeCharacterData: true,
        characterDefinition: characterDef,
      };

      const result = enhancer.formatForExport(patterns, options);
      expect(result).toContain('CHARACTER DEFINITION:');
      expect(result).toContain('"name": "Test Character"');
    });
  });

  describe('JSON Export Functionality', () => {
    it('should format patterns for JSON export', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsJson(patterns);

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('speechPatterns');
      expect(parsed.speechPatterns).toHaveLength(3);
    });

    it('should include metadata in JSON export', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsJson(patterns);

      const parsed = JSON.parse(result);
      expect(parsed.metadata).toHaveProperty('characterName', 'Test Character');
      expect(parsed.metadata).toHaveProperty('exportedAt');
      expect(parsed.metadata).toHaveProperty('totalPatterns', 3);
      expect(parsed.metadata).toHaveProperty('version', '2.0.0');
    });

    it('should preserve all pattern fields in JSON', () => {
      const patterns = createMockSpeechPatterns();
      const result = enhancer.formatAsJson(patterns);

      const parsed = JSON.parse(result);
      const firstPattern = parsed.speechPatterns[0];

      expect(firstPattern).toHaveProperty('id', 1);
      expect(firstPattern).toHaveProperty('pattern');
      expect(firstPattern).toHaveProperty('example');
      expect(firstPattern).toHaveProperty('circumstances');
      expect(firstPattern).toHaveProperty('metadata');
      expect(firstPattern.metadata).toHaveProperty('categories');
      expect(firstPattern.metadata).toHaveProperty('complexity');
    });

    it('should include character definition in JSON when requested', () => {
      const patterns = createMockSpeechPatterns();
      const characterDef = createMockCharacterDefinition();
      const options = {
        includeCharacterData: true,
        characterDefinition: characterDef,
      };

      const result = enhancer.formatAsJson(patterns, options);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('characterDefinition');
      expect(parsed.characterDefinition).toHaveProperty(
        'name',
        'Test Character'
      );
    });
  });

  describe('Filename Generation', () => {
    it('should generate filename with timestamp', () => {
      const filename = enhancer.generateExportFilename('Test Character');

      expect(filename).toMatch(
        /^speech_patterns_test_character_\d{4}-\d{2}-\d{2}\.txt$/
      );
    });

    it('should use correct extension', () => {
      const txtFilename = enhancer.generateExportFilename('Test', {
        extension: 'txt',
      });
      const jsonFilename = enhancer.generateExportFilename('Test', {
        extension: 'json',
      });

      expect(txtFilename).toEndWith('.txt');
      expect(jsonFilename).toEndWith('.json');
    });

    it('should sanitize character name', () => {
      const filename = enhancer.generateExportFilename(
        'Test@#$%Character!!!',
        {}
      );

      expect(filename).toMatch(/^speech_patterns_testcharacter_/);
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
      expect(filename).not.toContain('!');
    });

    it('should handle empty or invalid character names', () => {
      const filename1 = enhancer.generateExportFilename('');
      const filename2 = enhancer.generateExportFilename(null);
      const filename3 = enhancer.generateExportFilename(undefined);

      expect(filename1).toMatch(/^speech_patterns_character_/);
      expect(filename2).toMatch(/^speech_patterns_character_/);
      expect(filename3).toMatch(/^speech_patterns_character_/);
    });

    it('should limit filename length', () => {
      const veryLongName = 'x'.repeat(100);
      const filename = enhancer.generateExportFilename(veryLongName);

      // Should truncate to reasonable length
      expect(filename.length).toBeLessThan(100);
      expect(filename).toMatch(/^speech_patterns_x+_/);
    });
  });

  describe('Statistics Generation', () => {
    it('should generate pattern statistics', () => {
      const patterns = createMockSpeechPatterns();
      const stats = enhancer.generateStatistics(patterns);

      expect(stats).toHaveProperty('totalPatterns', 3);
      expect(stats).toHaveProperty('averagePatternLength');
      expect(stats).toHaveProperty('averageExampleLength');
      expect(stats).toHaveProperty('patternsWithCircumstances', 3);
      expect(stats).toHaveProperty('complexityDistribution');
      expect(stats).toHaveProperty('categoryDistribution');
    });

    it('should calculate complexity distribution', () => {
      const patterns = createMockSpeechPatterns();
      const stats = enhancer.generateStatistics(patterns);

      expect(stats.complexityDistribution).toHaveProperty('low');
      expect(stats.complexityDistribution).toHaveProperty('medium');
      expect(stats.complexityDistribution).toHaveProperty('high');

      const total =
        stats.complexityDistribution.low +
        stats.complexityDistribution.medium +
        stats.complexityDistribution.high;
      expect(total).toBe(3);
    });

    it('should calculate category distribution', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'Angry speech pattern',
            example: 'I am furious!',
            circumstances: 'When angry',
          },
          {
            pattern: 'Happy cheerful pattern',
            example: 'I am so joyful!',
            circumstances: 'When happy',
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const stats = enhancer.generateStatistics(patterns);
      expect(stats.categoryDistribution).toHaveProperty('anger', 1);
      expect(stats.categoryDistribution).toHaveProperty('happiness', 1);
    });
  });

  describe('Export Options Validation', () => {
    it('should validate export options', () => {
      const options = {
        includeCharacterData: 'true', // Will be converted to boolean
        format: 'json',
        extension: 'json',
      };

      const validated = enhancer.validateExportOptions(options);
      expect(validated.includeCharacterData).toBe(true);
      expect(validated.format).toBe('json');
      expect(validated.extension).toBe('json');
    });

    it('should default to txt format for invalid format', () => {
      const options = {
        format: 'invalid',
      };

      const validated = enhancer.validateExportOptions(options);
      expect(validated.format).toBe('txt');
      expect(validated.extension).toBe('txt');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should provide defaults for missing options', () => {
      const validated = enhancer.validateExportOptions({});
      expect(validated.includeCharacterData).toBe(false);
      expect(validated.format).toBe('txt');
      expect(validated.extension).toBe('txt');
      expect(validated.timestamp).toBeDefined();
    });
  });

  describe('Supported Export Formats', () => {
    it('should return list of supported formats', () => {
      const formats = enhancer.getSupportedExportFormats();

      expect(formats).toBeInstanceOf(Array);
      expect(formats.length).toBeGreaterThan(0);

      const txtFormat = formats.find((f) => f.id === 'txt');
      expect(txtFormat).toBeDefined();
      expect(txtFormat).toHaveProperty('name', 'Plain Text');
      expect(txtFormat).toHaveProperty('extension', 'txt');
      expect(txtFormat).toHaveProperty('mimeType', 'text/plain');

      const jsonFormat = formats.find((f) => f.id === 'json');
      expect(jsonFormat).toBeDefined();
      expect(jsonFormat).toHaveProperty('name', 'JSON Data');
      expect(jsonFormat).toHaveProperty('extension', 'json');
      expect(jsonFormat).toHaveProperty('mimeType', 'application/json');
    });
  });

  describe('Error Handling', () => {
    it('should handle null patterns gracefully', () => {
      expect(() => {
        enhancer.enhanceForDisplay(null);
      }).toThrow('Speech patterns data');
    });

    it('should handle undefined patterns gracefully', () => {
      expect(() => {
        enhancer.enhanceForDisplay(undefined);
      }).toThrow('Speech patterns data');
    });

    it('should handle patterns with wrong field types', () => {
      const invalidPatterns = {
        speechPatterns: [
          {
            pattern: 123, // Should be string
            example: true, // Should be string
          },
        ],
        characterName: 'Test',
      };

      expect(() => {
        enhancer.enhanceForDisplay(invalidPatterns);
      }).toThrow("Pattern 1 missing required 'pattern' field");
    });

    it('should handle circular references in JSON export', () => {
      const patterns = createMockSpeechPatterns();
      patterns.self = patterns; // Create circular reference

      // Should not throw, but should handle gracefully
      expect(() => {
        enhancer.formatAsJson(patterns);
      }).not.toThrow();
    });

    it('should log errors appropriately', () => {
      const invalidPatterns = {
        speechPatterns: null,
        characterName: 'Test',
      };

      expect(() => {
        enhancer.enhanceForDisplay(invalidPatterns);
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large pattern arrays efficiently', () => {
      const largePatterns = {
        speechPatterns: Array(100)
          .fill(null)
          .map((_, i) => ({
            pattern: `Pattern ${i}`,
            example: `Example ${i}`,
            circumstances: `Circumstance ${i}`,
          })),
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const startTime = performance.now();
      const result = enhancer.enhanceForDisplay(largePatterns);
      const endTime = performance.now();

      expect(result.patterns).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle very long text fields', () => {
      const patterns = {
        speechPatterns: [
          {
            pattern: 'x'.repeat(10000),
            example: 'y'.repeat(5000),
            circumstances: 'z'.repeat(3000),
          },
        ],
        characterName: 'Test',
        generatedAt: new Date().toISOString(),
      };

      const result = enhancer.enhanceForDisplay(patterns);
      expect(result.patterns[0].patternLength).toBe(10000);
      expect(result.patterns[0].exampleLength).toBe(5000);
    });
  });
});
