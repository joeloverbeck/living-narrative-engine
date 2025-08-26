/**
 * @file Unit tests for the character definition validation fix
 * @description Tests that the reported issues are fixed: core:name validation and empty speech patterns
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EnhancedSpeechPatternsValidator } from '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';
import { createTestBed } from '../../../common/testBed.js';

describe('Character Definition Validation Fix', () => {
  let validator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    const testBed = createTestBed();
    
    // Mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      validateAndSanitizeResponse: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedResponse: {},
      }),
    };

    mockLogger = testBed.mockLogger;

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

  describe('Fix for User Reported Issues', () => {
    it('should validate character with core:name component (fix for "Character name is required" error)', async () => {
      // This reproduces the exact issue reported by the user
      const characterDefinition = {
        components: {
          'core:name': {
            text: 'Amaia Castillo'  // This should be properly recognized
          },
          'core:personality': {
            traits: ['passionate', 'creative', 'independent'],
            description: 'A fiery artist with strong convictions'
          },
          'core:profile': {
            age: 27,
            occupation: 'Artist',
            background: 'Grew up in Barcelona, moved to New York for art career'
          }
        }
      };

      const result = await validator.validateInput(characterDefinition, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      // Should NOT have the false "Character name is required and must be a string" error
      expect(result.errors).not.toContain('Character name is required and must be a string');
      
      // Should be valid because it has proper core:name component
      expect(result.isValid).toBe(true);
      
      // Should successfully validate the structural layer
      expect(result.context.layers.structural.isValid).toBe(true);
      
      // Should have extracted the character name properly
      expect(result.errors).toHaveLength(0);
    });

    it('should allow empty patterns array in core:speech_patterns (fix for "Speech patterns must be an array" error)', async () => {
      // This reproduces the second reported issue
      const characterDefinition = {
        components: {
          'core:name': {
            text: 'Test Character'
          },
          'core:personality': {
            traits: ['curious'],
            description: 'A test character'
          },
          'core:speech_patterns': {
            patterns: [], // Empty array should be VALID for character INPUT (not response)
            metadata: {
              generated: false,
              lastUpdated: null
            }
          }
        }
      };

      const result = await validator.validateInput(characterDefinition);

      // Should NOT have the false "Speech patterns must be an array" error
      // because we're validating CHARACTER INPUT, not speech patterns RESPONSE
      expect(result.errors).not.toContain('Speech patterns must be an array');
      
      // Should be valid - empty patterns array is fine for character input
      expect(result.isValid).toBe(true);
      
      // Structural validation should pass
      expect(result.context.layers.structural.isValid).toBe(true);
      
      expect(result.errors).toHaveLength(0);
    });

    it('should validate user example character (amaia_castillo format) successfully', async () => {
      // Based on the user's example that was failing
      const amaiaCharacter = {
        id: 'amaia_castillo',
        entityType: 'character',
        components: {
          'core:name': {
            text: 'Amaia Castillo',
            pronunciation: 'ah-MAH-ee-ah kas-TEE-yoh'
          },
          'core:personality': {
            traits: ['passionate', 'artistic', 'impulsive', 'loyal'],
            description: 'Amaia is a passionate artist who feels everything deeply.',
            temperament: 'sanguine-choleric',
            motivations: ['creative expression', 'authentic connections', 'freedom']
          },
          'core:profile': {
            age: 28,
            occupation: 'Freelance illustrator and muralist',
            background: 'Born in Barcelona, moved to New York five years ago.',
            appearance: {
              height: '5\'6"',
              hair: 'long, dark brown with copper highlights',
              eyes: 'hazel'
            }
          },
          'core:likes': [
            'vibrant colors',
            'late-night painting sessions',
            'flamenco music'
          ],
          'core:dislikes': [
            'corporate art',
            'superficial relationships',
            'cold weather'
          ],
          'core:fears': [
            'losing her creative spark',
            'selling out her artistic vision'
          ],
          'core:goals': {
            shortTerm: ['finish mural commission', 'save for studio space'],
            longTerm: ['establish herself as recognized artist', 'find lasting love']
          },
          'core:speech_patterns': {
            patterns: [], // This was causing the validation error - should be OK now
            metadata: {
              generated: false,
              language: 'English',
              accent: 'slight Spanish',
              lastUpdated: null
            }
          }
        }
      };

      const result = await validator.validateInput(amaiaCharacter, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      // This comprehensive character should now validate successfully
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have good quality score due to comprehensive data
      expect(result.quality).toBeDefined();
      expect(result.quality.overallScore).toBeGreaterThan(0.5);
      
      // Structural validation should pass
      expect(result.context.layers.structural.isValid).toBe(true);
    });
  });

  describe('Character Name Extraction', () => {
    const nameExtractionTests = [
      {
        description: 'text field format',
        nameComponent: { text: 'Isabella Rodriguez' },
        expected: true
      },
      {
        description: 'name field format',
        nameComponent: { name: 'Elena Vasquez' },
        expected: true
      },
      {
        description: 'value field format',
        nameComponent: { value: 'Carmen Delgado' },
        expected: true
      },
      {
        description: 'nested personal structure',
        nameComponent: {
          personal: {
            firstName: 'Sofia',
            lastName: 'Martinez'
          },
          text: 'Sofia Martinez'
        },
        expected: true
      }
    ];

    nameExtractionTests.forEach(({ description, nameComponent, expected }) => {
      it(`should extract character name from ${description}`, async () => {
        const characterDefinition = {
          components: {
            'core:name': nameComponent,
            'core:personality': {
              description: 'Test character for name extraction'
            }
          }
        };

        const result = await validator.validateInput(characterDefinition);

        expect(result.isValid).toBe(expected);
        expect(result.errors).not.toContain('Character name is required and must be a string');
        expect(result.context.layers.structural.isValid).toBe(expected);
      });
    });
  });

  describe('Legacy Format Support', () => {
    it('should validate legacy format without components wrapper', async () => {
      const legacyCharacter = {
        'core:name': {
          text: 'Maria Santos'
        },
        'core:personality': {
          traits: ['analytical', 'methodical'],
          description: 'A careful researcher who values precision'
        },
        'core:profile': {
          age: 34,
          occupation: 'Research Scientist'
        }
      };

      const result = await validator.validateInput(legacyCharacter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.context.layers.structural.isValid).toBe(true);
    });
  });

  describe('Error Cases That Should Still Fail Appropriately', () => {
    it('should reject empty character definition', async () => {
      const result = await validator.validateInput({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No character components found. Expected components like core:name, core:personality, etc.');
    });

    it('should handle malformed core:name but provide helpful error', async () => {
      const malformedCharacter = {
        components: {
          'core:name': {
            // Missing the expected name fields
            pronunciation: 'test'
          },
          'core:personality': {
            description: 'Test personality'
          }
        }
      };

      const result = await validator.validateInput(malformedCharacter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character name component exists but does not contain a valid name. Expected text, name, or value field.');
    });

    it('should reject non-object input', async () => {
      const result = await validator.validateInput('not an object');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character definition must be a JSON object');
    });
  });
});