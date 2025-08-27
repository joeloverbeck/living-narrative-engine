/**
 * @file Unit tests for EnhancedSpeechPatternsValidator
 * @description Tests multi-layer validation, semantic rules, quality assessment, and suggestions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EnhancedSpeechPatternsValidator } from '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';

describe('EnhancedSpeechPatternsValidator', () => {
  let validator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    // Mock schema validator with all required methods for parent class
    mockSchemaValidator = {
      validate: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      validateAndSanitizeResponse: jest.fn(),
    };

    // Mock logger with all required methods for parent class
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set up default successful mock returns that match parent class expectations
    mockSchemaValidator.validateAndSanitizeResponse.mockResolvedValue({
      isValid: true,
      errors: [],
      sanitizedResponse: {},
    });

    mockSchemaValidator.validate.mockReturnValue({
      isValid: true,
      errors: [],
    });

    validator = new EnhancedSpeechPatternsValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    if (validator) {
      validator.clearCache();
    }
    jest.clearAllMocks();
  });

  describe('Construction and Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(validator).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EnhancedSpeechPatternsValidator initialized',
        expect.any(Object)
      );
    });

    it('should initialize semantic rules and quality metrics', () => {
      const stats = validator.getValidationStats();
      expect(stats.semanticRules).toBeGreaterThan(0);
      expect(stats.qualityMetrics).toBeGreaterThan(0);
      expect(stats.cacheSize).toBe(0);
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => {
        new EnhancedSpeechPatternsValidator({
          schemaValidator: null, // Missing required dependency
          logger: mockLogger,
        });
      }).toThrow('Schema validator is required');
    });
  });

  describe('Multi-Layer Validation', () => {
    it('should perform comprehensive validation with all layers', async () => {
      const testCharacter = {
        components: {
          'core:name': { text: 'Alice' },
          'core:personality': {
            traits: ['curious', 'analytical'],
            description:
              'A thoughtful researcher who approaches problems methodically',
          },
          'core:profile': {
            age: 28,
            occupation: 'Scientist',
            background:
              'Grew up in a small town, studied at university, now works in research lab',
          },
        },
      };

      // Mock successful schema validation with complete structure
      mockSchemaValidator.validateAndSanitizeResponse.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedResponse: testCharacter,
      });

      const result = await validator.validateInput(testCharacter, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      expect(result).toMatchObject({
        isValid: expect.any(Boolean),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        suggestions: expect.any(Array),
        quality: expect.any(Object),
        context: expect.objectContaining({
          validationTime: expect.any(Number),
          layers: expect.objectContaining({
            structural: expect.any(Object),
            semantic: expect.any(Object),
            quality: expect.any(Object),
          }),
        }),
      });

      expect(result.context.layers.structural).toHaveProperty('duration');
      expect(result.context.layers.semantic).toHaveProperty('duration');
      expect(result.context.layers.quality).toHaveProperty('duration');
    });

    it('should handle invalid input gracefully', async () => {
      // Clear any existing cache and mocks
      validator.clearCache();
      mockSchemaValidator.validate.mockReset();

      // Ensure schema is "loaded" so validation proceeds normally
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      // Mock the actual validation method to return an error for null input
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Invalid input provided'],
      });

      // Test with null input (which could come from failed JSON parsing)
      const result = await validator.validateInput(null, {});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still have validation layers even with null input
      expect(result.context.layers).toBeDefined();
    });

    it('should continue validation even if schema validation fails', async () => {
      const testCharacter = {
        components: {
          // Missing core:name or invalid structure to trigger structural validation failure
          invalid_component: { text: 'Bob' }, // No proper namespaced component
        },
      };

      const result = await validator.validateInput(testCharacter);

      // With no valid character components, structural validation should fail
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes('No character components found')
        )
      ).toBe(true);
      // Should still have semantic and quality layers
      expect(result.context.layers).toHaveProperty('semantic');
      expect(result.context.layers).toHaveProperty('quality');
    });
  });

  describe('Semantic Validation Rules', () => {
    describe('Character Name Consistency', () => {
      it('should pass when character name is consistent', async () => {
        const character = {
          components: {
            'core:name': { text: 'Sarah' },
            'core:profile': { description: 'Sarah is a talented musician' },
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: character,
          });

        const result = await validator.validateInput(character);

        // Should not have warnings about name inconsistency
        const nameWarnings = result.warnings.filter(
          (w) =>
            w.toLowerCase().includes('name') &&
            w.toLowerCase().includes('inconsistency')
        );
        expect(nameWarnings).toHaveLength(0);
      });

      it('should warn about potential name inconsistencies', async () => {
        const character = {
          components: {
            'core:name': { text: 'Alice' },
            'core:profile': { description: 'Bob is a great friend' }, // Different name
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse.mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: character,
        });

        const result = await validator.validateInput(character);

        const nameWarnings = result.warnings.filter(
          (w) =>
            w.toLowerCase().includes('name') &&
            w.toLowerCase().includes('inconsistency')
        );
        expect(nameWarnings.length).toBeGreaterThan(0);
      });
    });

    describe('Component Completeness', () => {
      it('should suggest missing essential components', async () => {
        const incompleteCharacter = {
          components: {
            'core:name': { text: 'Charlie' },
            // Missing core:personality and core:profile
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: incompleteCharacter,
          });

        const result = await validator.validateInput(incompleteCharacter);

        const missingSuggestions = result.warnings.filter((w) =>
          w.includes('Missing essential components')
        );
        expect(missingSuggestions.length).toBeGreaterThan(0);

        const personalitySuggestions = result.suggestions.filter((s) =>
          s.includes('core:personality')
        );
        expect(personalitySuggestions.length).toBeGreaterThan(0);
      });

      it('should suggest recommended components for enhancement', async () => {
        const basicCharacter = {
          components: {
            'core:name': { text: 'Diana' },
            'core:personality': { traits: ['kind'] },
            'core:profile': { age: 25 },
            // Missing recommended components like likes, dislikes, fears, goals
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: basicCharacter,
          });

        const result = await validator.validateInput(basicCharacter);

        const enhancementSuggestions = result.suggestions.filter((s) =>
          s.includes('Consider adding')
        );
        expect(enhancementSuggestions.length).toBeGreaterThan(0);
      });
    });

    describe('Content Depth Assessment', () => {
      it('should warn about brief character definitions', async () => {
        const briefCharacter = {
          components: {
            'core:name': { text: 'Eve' },
            'core:personality': { traits: ['nice'] }, // Very brief
            'core:profile': { age: 30 }, // Minimal detail
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: briefCharacter,
          });

        const result = await validator.validateInput(briefCharacter);

        const depthWarnings = result.warnings.filter(
          (w) => w.includes('brief') || w.includes('more detail')
        );
        expect(depthWarnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Quality Assessment', () => {
    describe('Character Completeness Metric', () => {
      it('should score high for complete character definitions', async () => {
        const completeCharacter = {
          components: {
            'core:name': { text: 'Frank' },
            'core:personality': { traits: ['determined', 'creative'] },
            'core:profile': { age: 35, occupation: 'Artist' },
            'core:likes': ['painting', 'nature'],
            'core:dislikes': ['criticism', 'rushed work'],
            'core:fears': ['failure', 'obscurity'],
            'core:goals': ['create meaningful art', 'inspire others'],
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: completeCharacter,
          });

        const result = await validator.validateInput(completeCharacter);

        expect(result.quality.overallScore).toBeGreaterThan(0.3);
        expect(result.quality.breakdown).toHaveProperty(
          'character_completeness'
        );
        expect(
          result.quality.breakdown.character_completeness.score
        ).toBeGreaterThan(0.6);
      });

      it('should score low for minimal character definitions', async () => {
        const minimalCharacter = {
          components: {
            'core:name': { text: 'Grace' },
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: minimalCharacter,
          });

        const result = await validator.validateInput(minimalCharacter);

        expect(result.quality.overallScore).toBeLessThan(0.5);
        expect(
          result.quality.breakdown.character_completeness.score
        ).toBeLessThan(0.3);
      });
    });

    describe('Personality Depth Metric', () => {
      it('should assess personality depth based on content richness', async () => {
        const richPersonality = {
          components: {
            'core:name': { text: 'Henry' },
            'core:personality': {
              traits: ['analytical', 'introverted', 'perfectionistic'],
              description:
                'Henry is a methodical thinker who prefers to work alone. He has high standards for himself and others, often spending hours perfecting his work. Despite his quiet nature, he has a dry sense of humor that emerges around close friends. He struggles with spontaneity but excels at long-term planning and detailed analysis.',
            },
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: richPersonality,
          });

        const result = await validator.validateInput(richPersonality);

        expect(
          result.quality.breakdown.personality_depth.score
        ).toBeGreaterThan(0.7);
      });

      it('should score low for shallow personality descriptions', async () => {
        const shallowPersonality = {
          components: {
            'core:name': { text: 'Iris' },
            'core:personality': { traits: ['nice'] },
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: shallowPersonality,
          });

        const result = await validator.validateInput(shallowPersonality);

        expect(result.quality.breakdown.personality_depth.score).toBeLessThan(
          0.3
        );
      });
    });

    describe('Background Richness Metric', () => {
      it('should assess background richness based on key information', async () => {
        const richBackground = {
          components: {
            'core:name': { text: 'Jack' },
            'core:profile': {
              age: 42,
              occupation: 'Marine biologist',
              location: 'Monterey, California',
              history:
                'Jack grew up in a coastal town where his fascination with marine life began. He studied at UC Santa Barbara, specializing in coral reef ecosystems. After completing his PhD, he worked for several research institutions before settling at the Monterey Bay Aquarium Research Institute.',
              background:
                'His childhood was spent exploring tide pools and snorkeling in kelp forests, experiences that shaped his career path and environmental consciousness.',
            },
          },
        };

        mockSchemaValidator.validateAndSanitizeResponse = jest
          .fn()
          .mockResolvedValue({
            isValid: true,
            errors: [],
            sanitizedResponse: richBackground,
          });

        const result = await validator.validateInput(richBackground);

        expect(
          result.quality.breakdown.background_richness.score
        ).toBeGreaterThan(0.7);
        expect(
          result.quality.breakdown.background_richness.details.hasAge
        ).toBe(true);
        expect(
          result.quality.breakdown.background_richness.details.hasOccupation
        ).toBe(true);
        expect(
          result.quality.breakdown.background_richness.details.hasLocation
        ).toBe(true);
        expect(
          result.quality.breakdown.background_richness.details.hasHistory
        ).toBe(true);
      });
    });
  });

  describe('Intelligent Suggestions', () => {
    it('should generate contextual suggestions based on validation results', async () => {
      const character = {
        components: {
          'core:name': { text: 'Kate' },
          'core:personality': { traits: ['ambitious'] },
          // Missing profile, goals, etc.
        },
      };

      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: character,
        });

      const result = await validator.validateInput(character);

      expect(result.suggestions.length).toBeGreaterThan(0);

      // Should suggest adding missing components
      const componentSuggestions = result.suggestions.filter(
        (s) => s.includes('Missing') || s.includes('Add')
      );
      expect(componentSuggestions.length).toBeGreaterThan(0);
    });

    it('should limit suggestions to avoid overwhelming users', async () => {
      const minimalCharacter = {
        components: {
          'core:name': { text: 'Leo' },
        },
      };

      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: minimalCharacter,
        });

      const result = await validator.validateInput(minimalCharacter);

      // Should limit suggestions to reasonable number (8 max)
      expect(result.suggestions.length).toBeLessThanOrEqual(8);
    });

    it('should provide quality-based suggestions for low scores', async () => {
      const lowQualityCharacter = {
        components: {
          'core:name': { text: 'Maya' },
          'core:personality': { traits: ['ok'] },
        },
      };

      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: lowQualityCharacter,
        });

      const result = await validator.validateInput(lowQualityCharacter);

      // The quality score should definitely be low for this minimal character
      expect(result.quality.overallScore).toBeLessThan(0.5);

      const qualitySuggestions = result.suggestions.filter(
        (s) =>
          s.includes('detailed') ||
          s.includes('improve') ||
          s.includes('depth') ||
          s.includes('more')
      );
      expect(qualitySuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Caching System', () => {
    it('should cache validation results', async () => {
      const character = {
        components: {
          'core:name': { text: 'Nina' },
        },
      };

      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: character,
        });

      // First validation
      const result1 = await validator.validateInput(character);

      // Second validation should use cache (same input)
      const result2 = await validator.validateInput(character);

      // Results should be identical due to caching
      expect(result1.context.cacheKey).toBe(result2.context.cacheKey);
      expect(result1.quality.overallScore).toBe(result2.quality.overallScore);
    });

    it('should respect cache size limits', async () => {
      const stats = validator.getValidationStats();
      const maxSize = stats.cacheMaxSize;

      // Fill cache beyond max size
      for (let i = 0; i <= maxSize + 5; i++) {
        const character = {
          components: {
            'core:name': { text: `Character${i}` },
          },
        };

        // The mock is already set up in beforeEach, just call the method
        await validator.validateInput(character);
      }

      const finalStats = validator.getValidationStats();
      expect(finalStats.cacheSize).toBeLessThanOrEqual(maxSize);
    });

    it('should clear cache when requested', async () => {
      const character = {
        components: {
          'core:name': { text: 'Oscar' },
        },
      };

      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: character,
        });

      await validator.validateInput(character);

      let stats = validator.getValidationStats();
      expect(stats.cacheSize).toBeGreaterThan(0);

      validator.clearCache();

      stats = validator.getValidationStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle schema validator errors gracefully', async () => {
      // Test with invalid character data that would cause structural validation errors
      const character = {
        components: {
          'core:name': {}, // Empty name component - should cause structural error
        },
      };

      const result = await validator.validateInput(character);

      // Should handle the error gracefully but mark as invalid due to structural issues
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes(
            'Character name component exists but does not contain a valid name'
          )
        )
      ).toBe(true);
      // Should still have completed validation with layers
      expect(result.context.layers).toHaveProperty('structural');
      expect(result.context.layers).toHaveProperty('semantic');
      expect(result.context.layers).toHaveProperty('quality');
    });

    it('should continue processing even if individual rules fail', async () => {
      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: {
            components: {
              'core:name': { text: 'Quinn' },
            },
          },
        });

      // The validator should handle internal rule failures gracefully
      const result = await validator.validateInput({
        components: {
          'core:name': { text: 'Quinn' },
        },
      });

      expect(result).toBeDefined();
      expect(result.context.layers.semantic).toBeDefined();
      expect(result.context.layers.quality).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete validation within reasonable time', async () => {
      const largeCharacter = {
        components: {
          'core:name': { text: 'Rachel' },
          'core:personality': {
            traits: Array(50).fill('trait'),
            description: 'Very long description '.repeat(100),
          },
          'core:profile': {
            background: 'Extensive background '.repeat(100),
          },
        },
      };

      mockSchemaValidator.validateAndSanitizeResponse = jest
        .fn()
        .mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedResponse: largeCharacter,
        });

      const startTime = Date.now();
      const result = await validator.validateInput(largeCharacter);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.context.validationTime).toBeLessThan(5000);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive validation statistics', () => {
      const stats = validator.getValidationStats();

      expect(stats).toMatchObject({
        semanticRules: expect.any(Number),
        qualityMetrics: expect.any(Number),
        cacheSize: expect.any(Number),
        cacheMaxSize: expect.any(Number),
        cacheTTL: expect.any(Number),
      });

      expect(stats.semanticRules).toBeGreaterThan(0);
      expect(stats.qualityMetrics).toBeGreaterThan(0);
    });
  });
});
