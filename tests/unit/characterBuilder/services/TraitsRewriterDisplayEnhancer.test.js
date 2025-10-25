/**
 * @file Unit tests for TraitsRewriterDisplayEnhancer service
 * @description Tests display formatting and export functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsRewriterDisplayEnhancer } from '../../../../src/characterBuilder/services/TraitsRewriterDisplayEnhancer.js';
import {
  TraitsRewriterError,
  TRAITS_REWRITER_ERROR_CODES,
} from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';

describe('TraitsRewriterDisplayEnhancer', () => {
  let enhancer;
  let mockLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create enhancer instance
    enhancer = new TraitsRewriterDisplayEnhancer({
      logger: mockLogger,
    });
  });

  describe('Constructor Validation', () => {
    it('should validate required dependencies', () => {
      expect(() => {
        new TraitsRewriterDisplayEnhancer({});
      }).toThrow();
    });

    it('should initialize with minimal dependencies', () => {
      const instance = new TraitsRewriterDisplayEnhancer({
        logger: mockLogger,
      });
      expect(instance).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TraitsRewriterDisplayEnhancer: Initialized successfully'
      );
    });

    it('should validate logger has required methods', () => {
      const incompleteLogger = { debug: jest.fn() };
      expect(() => {
        new TraitsRewriterDisplayEnhancer({ logger: incompleteLogger });
      }).toThrow();
    });
  });

  describe('Display Enhancement', () => {
    const sampleTraits = {
      'core:personality': 'I am analytical and methodical.',
      'core:likes': 'I enjoy reading books.',
      'core:fears': 'I fear being abandoned.',
    };

    it('should format traits for HTML display', () => {
      const result = enhancer.enhanceForDisplay(sampleTraits, {
        characterName: 'Test Character',
      });

      expect(result).toHaveProperty('sections');
      expect(result.sections).toHaveLength(3);
      expect(result.characterName).toBe('Test Character');
      expect(result.totalSections).toBe(3);
      expect(result.enhanced).toBe(true);
    });

    it('should escape HTML content safely', () => {
      const traitsWithHtml = {
        'core:personality': 'I am <script>alert("XSS")</script> analytical',
      };

      const result = enhancer.enhanceForDisplay(traitsWithHtml);
      const section = result.sections[0];

      expect(section.content).not.toContain('<script>');
      expect(section.content).toContain('&lt;script&gt;');
    });

    it('should create proper section structure', () => {
      const result = enhancer.enhanceForDisplay(sampleTraits);
      const section = result.sections[0];

      expect(section).toHaveProperty('key');
      expect(section).toHaveProperty('label');
      expect(section).toHaveProperty('content');
      expect(section).toHaveProperty('cssClass');
      expect(section).toHaveProperty('titleClass');
      expect(section).toHaveProperty('contentClass');
      expect(section).toHaveProperty('index');
    });

    it('should handle missing traits gracefully', () => {
      const result = enhancer.enhanceForDisplay({});
      expect(result.sections).toEqual([]);
      expect(result.totalSections).toBe(0);
    });

    it('should handle null options gracefully', () => {
      const result = enhancer.enhanceForDisplay(sampleTraits);
      expect(result.characterName).toBe('Character');
      expect(result).toHaveProperty('generatedAt');
    });

    it('should preserve trait ordering', () => {
      const orderedTraits = {
        'core:fears': 'Fears content',
        'core:personality': 'Personality content',
        'core:likes': 'Likes content',
      };

      const result = enhancer.enhanceForDisplay(orderedTraits);

      // Should be reordered according to internal priority
      expect(result.sections[0].key).toBe('core:personality');
      expect(result.sections[1].key).toBe('core:likes');
      expect(result.sections[2].key).toBe('core:fears');
    });
  });

  describe('Export Formatting', () => {
    const sampleTraits = {
      'core:personality': 'I am analytical',
      'core:likes': 'I enjoy reading',
    };

    describe('Text Format', () => {
      it('should format traits for text export', () => {
        const result = enhancer.formatForExport(sampleTraits, 'text', {
          characterName: 'Test Character',
        });

        expect(result).toContain('Character: Test Character');
        expect(result).toContain('Personality:');
        expect(result).toContain('I am analytical');
        expect(result).toContain('Likes:');
        expect(result).toContain('I enjoy reading');
      });

      it('should include metadata in text export', () => {
        const result = enhancer.formatForExport(sampleTraits, 'text');

        expect(result).toContain('Generated:');
        expect(result).toContain('Rewritten Traits');
        expect(result).toContain('Total Traits: 2');
      });

      it('should use default character name when not provided', () => {
        const result = enhancer.formatForExport(sampleTraits, 'text');
        expect(result).toContain('Character: Character');
      });

      it('should include bullet formatting for array traits', () => {
        const traitsWithArray = {
          'core:goals': ['First goal', 'Second goal'],
        };

        const result = enhancer.formatForExport(traitsWithArray, 'text');

        expect(result).toContain('Goals:');
        expect(result).toContain('• First goal');
        expect(result).toMatch(/• Second goal\n\n/);
      });
    });

    describe('JSON Format', () => {
      it('should format traits for JSON export', () => {
        const result = enhancer.formatForExport(sampleTraits, 'json', {
          characterName: 'Test Character',
        });

        const parsed = JSON.parse(result);
        expect(parsed.characterName).toBe('Test Character');
        expect(parsed.rewrittenTraits).toEqual(sampleTraits);
        expect(parsed.exportFormat).toBe('json');
        expect(parsed.traitCount).toBe(2);
      });

      it('should include character name and metadata', () => {
        const result = enhancer.formatForExport(sampleTraits, 'json', {
          characterName: 'Test Character',
          includeMetadata: true,
          metadata: { version: '1.0' },
        });

        const parsed = JSON.parse(result);
        expect(parsed.characterName).toBe('Test Character');
        expect(parsed.metadata).toEqual({ version: '1.0' });
      });

      it('should handle export options correctly', () => {
        const result = enhancer.formatForExport(sampleTraits, 'json', {
          includeMetadata: false,
        });

        const parsed = JSON.parse(result);
        expect(parsed.metadata).toBeUndefined();
      });
    });

    describe('Format Validation', () => {
      it('should throw error for invalid format', () => {
        expect(() => {
          enhancer.formatForExport(sampleTraits, 'invalid');
        }).toThrow(TraitsRewriterError);

        try {
          enhancer.formatForExport(sampleTraits, 'invalid');
        } catch (error) {
          expect(error.context.errorCode).toBe(
            TRAITS_REWRITER_ERROR_CODES.INVALID_FORMAT
          );
        }
      });

      it('should accept case-insensitive format', () => {
        expect(() => {
          enhancer.formatForExport(sampleTraits, 'JSON');
        }).not.toThrow();

        expect(() => {
          enhancer.formatForExport(sampleTraits, 'Text');
        }).not.toThrow();
      });

      it('should validate traits presence', () => {
        expect(() => {
          enhancer.formatForExport(null, 'text');
        }).toThrow();
      });
    });
  });

  describe('Filename Generation', () => {
    it('should generate descriptive filenames', () => {
      const filename = enhancer.generateExportFilename('Test Character', 'txt');

      expect(filename).toContain('test-character');
      expect(filename).toContain('traits-rewriter');
      expect(filename).toContain('.txt');
    });

    it('should include timestamps in filenames', () => {
      const filename = enhancer.generateExportFilename('Character');

      // Check for date pattern (YYYY-MM-DD)
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
      // Check for time pattern (HH-MM-SS)
      expect(filename).toMatch(/\d{2}-\d{2}-\d{2}/);
    });

    it('should sanitize character names for filesystem', () => {
      const filename = enhancer.generateExportFilename('Test/Character<>:|?*');

      expect(filename).not.toContain('/');
      expect(filename).not.toContain('<');
      expect(filename).not.toContain('>');
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('|');
      expect(filename).not.toContain('?');
      expect(filename).not.toContain('*');
    });

    it('should handle special characters correctly', () => {
      const filename = enhancer.generateExportFilename('Test   Character!!!');

      expect(filename).toContain('test-character');
      expect(filename).not.toContain('   ');
      expect(filename).not.toContain('!!!');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(100);
      const filename = enhancer.generateExportFilename(longName);

      // Check that the character name portion is limited
      const namePart = filename.split('-traits-rewriter')[0];
      expect(namePart.length).toBeLessThanOrEqual(50);
    });

    it('should use correct extension for json format', () => {
      const filename = enhancer.generateExportFilename('Test', 'json');
      expect(filename).toContain('.json');
    });

    it('should default to txt extension', () => {
      const filename = enhancer.generateExportFilename('Test');
      expect(filename).toContain('.txt');
    });
  });

  describe('Section Creation', () => {
    it('should create organized display sections', () => {
      const traits = {
        'core:personality': 'Personality content',
        'core:likes': 'Likes content',
        'core:fears': 'Fears content',
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections).toHaveLength(3);
      expect(sections[0].label).toBe('Personality');
      expect(sections[1].label).toBe('Likes');
      expect(sections[2].label).toBe('Fears');
    });

    it('should convert trait keys to readable labels', () => {
      const traits = {
        'core:personality': 'Content',
        'core:unknown_trait': 'Content',
        customTrait: 'Content',
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].label).toBe('Personality');
      expect(sections[1].label).toBe('Unknown trait');
      expect(sections[2].label).toBe('Custom Trait');
    });

    it('should add proper CSS classes', () => {
      const traits = { 'core:personality': 'Content' };
      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].cssClass).toBe('trait-section');
      expect(sections[0].titleClass).toBe('trait-section-title');
      expect(sections[0].contentClass).toBe('trait-content');
    });

    it('should maintain section indexing', () => {
      const traits = {
        'core:personality': 'Content 1',
        'core:likes': 'Content 2',
        'core:fears': 'Content 3',
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].index).toBe(0);
      expect(sections[1].index).toBe(1);
      expect(sections[2].index).toBe(2);
    });

    it('should handle unordered keys', () => {
      const traits = {
        'custom:trait': 'Custom content',
        'core:personality': 'Personality content',
        'another:trait': 'Another content',
      };

      const sections = enhancer.createDisplaySections(traits);

      // Core personality should come first
      expect(sections[0].key).toBe('core:personality');
      // Custom traits should come after ordered ones
      expect(sections[1].key).toBe('custom:trait');
      expect(sections[2].key).toBe('another:trait');
    });

    it('should format array trait values as bullet lists', () => {
      const traits = {
        'core:goals': ['First goal', 'Second goal'],
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].content).toBe('• First goal\n• Second goal');
      expect(sections[0].isArray).toBe(true);
    });
  });

  describe('Content Safety', () => {
    it('should escape HTML content', () => {
      const traits = {
        'core:personality': '<script>alert("XSS")</script>',
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].content).not.toContain('<script>');
      expect(sections[0].content).toContain('&lt;script&gt;');
    });

    it('should prevent XSS attacks', () => {
      const maliciousTraits = {
        'core:personality': '<img src=x onerror="alert(1)">',
        'core:likes': 'Normal content & safe <b>bold</b>',
      };

      const sections = enhancer.createDisplaySections(maliciousTraits);

      expect(sections[0].content).toContain('onerror&#x3D;'); // Equals sign is escaped
      expect(sections[0].content).toContain('&lt;img');
      expect(sections[1].content).toContain('&amp;');
      expect(sections[1].content).toContain('&lt;b&gt;');
    });

    it('should sanitize display content', () => {
      const traits = {
        'core:personality': '  Content with spaces  ',
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].content).toBe('Content with spaces');
    });

    it('should convert non-string values safely', () => {
      const traits = {
        'core:personality': 12345,
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].content).toBe('12345');
    });

    it('should safely handle null and undefined trait values', () => {
      const traits = {
        'custom:nullTrait': null,
        'custom:undefinedTrait': undefined,
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections).toHaveLength(2);
      expect(
        sections.find(section => section.key === 'custom:nullTrait').content
      ).toBe('');
      expect(
        sections.find(section => section.key === 'custom:undefinedTrait').content
      ).toBe('');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return empty string for blank trait content', () => {
      const traits = {
        'custom:emptyTrait': '',
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].content).toBe('');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should truncate very long content', () => {
      const longContent = 'a'.repeat(6000);
      const traits = {
        'core:personality': longContent,
      };

      const sections = enhancer.createDisplaySections(traits);

      expect(sections[0].content.length).toBeLessThanOrEqual(5003); // 5000 + '...'
      expect(sections[0].content).toContain('...');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('HTML Display Creation', () => {
    it('should create proper HTML structure', () => {
      const traits = {
        'core:personality': 'Test content',
      };

      const html = enhancer.createHtmlDisplay(traits);

      expect(html).toContain('<div class="traits-rewriter-display">');
      expect(html).toContain('<div class="trait-section">');
      expect(html).toContain(
        '<h3 class="trait-section-title">Personality</h3>'
      );
      expect(html).toContain('<div class="trait-content">Test content</div>');
      expect(html).toContain('</div>');
    });

    it('should handle multiple traits', () => {
      const traits = {
        'core:personality': 'Personality content',
        'core:likes': 'Likes content',
      };

      const html = enhancer.createHtmlDisplay(traits);

      expect(html).toContain('Personality');
      expect(html).toContain('Likes');
      expect(html).toContain('Personality content');
      expect(html).toContain('Likes content');
    });

    it('should escape HTML in content', () => {
      const traits = {
        'core:personality': '<b>Bold</b> text',
      };

      const html = enhancer.createHtmlDisplay(traits);

      expect(html).not.toContain('<b>Bold</b>');
      expect(html).toContain('&lt;b&gt;Bold&lt;&#x2F;b&gt;'); // Forward slash is also escaped
    });

    it('should wrap errors when HTML rendering fails', () => {
      const failure = new Error('HTML failure');
      const spy = jest
        .spyOn(enhancer, 'createDisplaySections')
        .mockImplementation(() => {
          throw failure;
        });

      let thrownError;
      try {
        enhancer.createHtmlDisplay({ 'core:personality': 'value' });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(TraitsRewriterError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create HTML display',
        failure
      );
      expect(thrownError.context.errorCode).toBe(
        TRAITS_REWRITER_ERROR_CODES.CONTENT_SANITIZATION_FAILED
      );

      spy.mockRestore();
    });
  });

  describe('Trait Comparison', () => {
    it('should detect added traits', () => {
      const original = {
        'core:personality': 'Original personality',
      };
      const rewritten = {
        'core:personality': 'Original personality',
        'core:likes': 'New likes',
      };

      const result = enhancer.compareTraits(original, rewritten);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount).toBe(1);
      expect(result.changes[0].type).toBe('added');
      expect(result.changes[0].key).toBe('core:likes');
    });

    it('should detect removed traits', () => {
      const original = {
        'core:personality': 'Personality',
        'core:likes': 'Likes',
      };
      const rewritten = {
        'core:personality': 'Personality',
      };

      const result = enhancer.compareTraits(original, rewritten);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount).toBe(1);
      expect(result.changes[0].type).toBe('removed');
      expect(result.changes[0].key).toBe('core:likes');
    });

    it('should detect modified traits', () => {
      const original = {
        'core:personality': 'Original personality',
      };
      const rewritten = {
        'core:personality': 'Modified personality',
      };

      const result = enhancer.compareTraits(original, rewritten);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount).toBe(1);
      expect(result.changes[0].type).toBe('modified');
      expect(result.changes[0].oldValue).toBe('Original personality');
      expect(result.changes[0].newValue).toBe('Modified personality');
    });

    it('should handle no changes', () => {
      const traits = {
        'core:personality': 'Same personality',
      };

      const result = enhancer.compareTraits(traits, traits);

      expect(result.hasChanges).toBe(false);
      expect(result.changeCount).toBe(0);
      expect(result.changes).toEqual([]);
      expect(result.comparison).toBe('No changes detected');
    });

    it('should handle multiple changes', () => {
      const original = {
        'core:personality': 'Original',
        'core:likes': 'Original likes',
        'core:removed': 'Will be removed',
      };
      const rewritten = {
        'core:personality': 'Modified',
        'core:likes': 'Original likes',
        'core:added': 'New trait',
      };

      const result = enhancer.compareTraits(original, rewritten);

      expect(result.hasChanges).toBe(true);
      expect(result.changeCount).toBe(3);
      expect(result.comparison).toContain('3 changes');
    });
  });

  describe('Service Information', () => {
    it('should return service metadata', () => {
      const info = enhancer.getServiceInfo();

      expect(info.name).toBe('TraitsRewriterDisplayEnhancer');
      expect(info.version).toBe('1.0.0');
      expect(info.status).toBe('active');
      expect(info.implementationTask).toBe('TRAREW-007');
    });
  });

  describe('Error Handling', () => {
    it('should handle display enhancement errors', () => {
      // Force an error by mocking createDisplaySections to throw
      jest.spyOn(enhancer, 'createDisplaySections').mockImplementation(() => {
        throw new Error('Test error');
      });

      expect(() => {
        enhancer.enhanceForDisplay({ test: 'data' });
      }).toThrow(TraitsRewriterError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle export formatting errors', () => {
      // Pass invalid data that will cause an error
      expect(() => {
        enhancer.formatForExport(null, 'text');
      }).toThrow();
    });

    it('should wrap section creation errors with sanitization context', () => {
      const traits = {};
      Object.defineProperty(traits, 'core:personality', {
        enumerable: true,
        get() {
          throw new Error('boom');
        },
      });

      let thrownError;
      try {
        enhancer.createDisplaySections(traits);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(TraitsRewriterError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create display sections',
        expect.any(Error)
      );
      expect(thrownError.context.errorCode).toBe(
        TRAITS_REWRITER_ERROR_CODES.CONTENT_SANITIZATION_FAILED
      );
      expect(thrownError.context.traitCount).toBe(1);
    });

    it('should wrap export failures with detailed context', () => {
      const traits = { 'core:personality': 'value' };
      const failure = new Error('format failure');
      const spy = jest
        .spyOn(enhancer, 'createDisplaySections')
        .mockImplementation(() => {
          throw failure;
        });

      let thrownError;
      try {
        enhancer.formatForExport(traits, 'text');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(TraitsRewriterError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to format traits for text export',
        failure
      );
      expect(thrownError.context.errorCode).toBe(
        TRAITS_REWRITER_ERROR_CODES.EXPORT_FAILED
      );
      expect(thrownError.context.format).toBe('text');

      spy.mockRestore();
    });

    it('should wrap comparison failures with validation context', () => {
      const original = {};
      Object.defineProperty(original, 'core:personality', {
        enumerable: true,
        get() {
          throw new Error('comparison failure');
        },
      });

      const rewritten = { 'core:personality': 'value' };

      let thrownError;
      try {
        enhancer.compareTraits(original, rewritten);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(TraitsRewriterError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to compare traits',
        expect.any(Error)
      );
      expect(thrownError.context.errorCode).toBe(
        TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED
      );
      expect(thrownError.context.validationField).toBe('comparison');
    });

    it('should log warnings for truncated content', () => {
      const longContent = 'a'.repeat(6000);
      const traits = { 'core:personality': longContent };

      enhancer.createDisplaySections(traits);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Content truncated due to length limit',
        expect.objectContaining({ originalLength: 6000 })
      );
    });
  });
});
