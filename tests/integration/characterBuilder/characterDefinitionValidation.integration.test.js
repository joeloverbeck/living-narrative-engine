/**
 * @file Integration tests for character definition validation pipeline
 * @description Tests complete validation flow from character input through enhanced validation
 * This tests the specific issues reported: core:name validation and empty speech patterns array
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { EnhancedSpeechPatternsValidator } from '../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';
import { createTestBed } from '../../common/testBed.js';

describe('Character Definition Validation Integration', () => {
  let testBed;
  let controller;
  let enhancedValidator;

  beforeEach(() => {
    testBed = createTestBed();
    
    const schemaValidator = testBed.createMock('schemaValidator', [
      'validate',
      'isSchemaLoaded',
      'validateAndSanitizeResponse',
    ]);

    const logger = testBed.createMockLogger();

    // Create enhanced validator
    enhancedValidator = new EnhancedSpeechPatternsValidator({
      schemaValidator,
      logger,
    });

    // Create controller with dependencies
    const dependencies = {
      logger,
      eventBus: testBed.createMock('eventBus', ['dispatch']),
      container: testBed.createMock('container', ['resolve']),
      schemaValidator,
      speechPatternsGenerator: testBed.createMock('speechPatternsGenerator', [
        'generateSpeechPatterns',
        'getServiceInfo',
      ]),
    };

    // Mock DOM elements
    testBed.mockDOMElements({
      'character-definition': { value: '', addEventListener: jest.fn() },
      'character-input-error': { style: { display: 'none' }, innerHTML: '' },
      'generate-btn': { disabled: false, addEventListener: jest.fn() },
      'export-btn': { disabled: true, addEventListener: jest.fn() },
      'clear-all-btn': { disabled: true, addEventListener: jest.fn() },
      'back-btn': { addEventListener: jest.fn() },
      'loading-state': { style: { display: 'none' } },
      'results-state': { style: { display: 'none' } },
      'error-state': { style: { display: 'none' } },
      'speech-patterns-container': { innerHTML: '' },
      'loading-indicator': { style: { display: 'none' } },
      'loading-message': { textContent: '' },
      'empty-state': { style: { display: 'block' } },
      'pattern-count': { textContent: '0 patterns generated' },
    });

    controller = new SpeechPatternsGeneratorController(dependencies);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('User Reported Issues - Fixed', () => {
    it('should validate character with core:name component (no false "Character name is required" error)', async () => {
      // This reproduces the exact user-reported issue
      const characterDefinition = {
        components: {
          'core:name': {
            text: 'Amaia Castillo'
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

      // Test enhanced validator (this was failing before fix)
      const result = await enhancedValidator.validateInput(characterDefinition, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      // Should NOT have "Character name is required" error
      expect(result.errors).not.toContain('Character name is required and must be a string');
      expect(result.isValid).toBe(true);
      
      // Should extract name correctly
      expect(result.context.layers.structural.isValid).toBe(true);
    });

    it('should allow empty patterns array in core:speech_patterns (no false "Speech patterns must be an array" error)', async () => {
      // This reproduces the second user-reported issue
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
            patterns: [], // Empty array should be valid for CHARACTER INPUT
            metadata: {
              generated: false,
              lastUpdated: null
            }
          }
        }
      };

      const result = await enhancedValidator.validateInput(characterDefinition);

      // Should NOT have "Speech patterns must be an array" error
      // because this is character INPUT validation, not response validation
      expect(result.errors).not.toContain('Speech patterns must be an array');
      expect(result.isValid).toBe(true);
      
      // Empty patterns array should not cause validation to fail
      expect(result.context.layers.structural.isValid).toBe(true);
    });

    it('should validate realistic character from user example (amaia_castillo.character.json format)', async () => {
      // Based on the user's private file example
      const realisticCharacter = {
        id: 'amaia_castillo',
        entityType: 'character',
        components: {
          'core:name': {
            text: 'Amaia Castillo',
            pronunciation: 'ah-MAH-ee-ah kas-TEE-yoh'
          },
          'core:personality': {
            traits: ['passionate', 'artistic', 'impulsive', 'loyal'],
            description: 'Amaia is a passionate artist who feels everything deeply. She\'s impulsive and follows her heart, sometimes to her detriment, but her loyalty to those she cares about is unwavering.',
            temperament: 'sanguine-choleric',
            motivations: ['creative expression', 'authentic connections', 'freedom']
          },
          'core:profile': {
            age: 28,
            occupation: 'Freelance illustrator and muralist',
            background: 'Born in Barcelona to a Spanish father and Basque mother, Amaia grew up surrounded by art and culture. She moved to New York five years ago to pursue her artistic career.',
            appearance: {
              height: '5\'6"',
              build: 'slender',
              hair: 'long, dark brown with copper highlights',
              eyes: 'hazel',
              style: 'bohemian chic with paint-stained fingers'
            }
          },
          'core:likes': [
            'vibrant colors',
            'late-night painting sessions',
            'flamenco music',
            'small coffee shops',
            'authentic conversations'
          ],
          'core:dislikes': [
            'corporate art',
            'superficial relationships', 
            'cold weather',
            'being rushed',
            'art critics who don\'t create'
          ],
          'core:fears': [
            'losing her creative spark',
            'selling out her artistic vision',
            'being misunderstood',
            'abandonment by those she loves'
          ],
          'core:goals': {
            shortTerm: ['finish mural commission', 'save for studio space'],
            longTerm: ['establish herself as recognized artist', 'find lasting love', 'connect with Basque heritage']
          },
          'core:speech_patterns': {
            patterns: [], // Empty - this was causing the validation error
            metadata: {
              generated: false,
              language: 'English',
              accent: 'slight Spanish',
              lastUpdated: null
            }
          }
        }
      };

      const result = await enhancedValidator.validateInput(realisticCharacter, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      // This comprehensive character should validate successfully
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have good quality score
      expect(result.quality.overallScore).toBeGreaterThan(0.7);
      
      // Should extract name correctly
      expect(result.context.layers.structural.isValid).toBe(true);
    });
  });

  describe('Character Name Extraction Variants', () => {
    const nameExtractionTestCases = [
      {
        name: 'text field format',
        nameComponent: { text: 'Isabella Rodriguez' },
        expected: 'Isabella Rodriguez'
      },
      {
        name: 'name field format',
        nameComponent: { name: 'Elena Vasquez' },
        expected: 'Elena Vasquez'
      },
      {
        name: 'value field format',
        nameComponent: { value: 'Carmen Delgado' },
        expected: 'Carmen Delgado'
      },
      {
        name: 'nested personal structure',
        nameComponent: {
          personal: {
            firstName: 'Sofia',
            lastName: 'Martinez'
          },
          text: 'Sofia Martinez'
        },
        expected: 'Sofia Martinez'
      }
    ];

    nameExtractionTestCases.forEach(({ name, nameComponent, expected }) => {
      it(`should extract character name from ${name}`, async () => {
        const characterDefinition = {
          components: {
            'core:name': nameComponent,
            'core:personality': {
              description: 'Test character for name extraction'
            }
          }
        };

        const result = await enhancedValidator.validateInput(characterDefinition);

        expect(result.isValid).toBe(true);
        expect(result.errors).not.toContain('Character name is required and must be a string');
        // The enhanced validator should successfully extract the name
        expect(result.context.layers.structural.isValid).toBe(true);
      });
    });
  });

  describe('Legacy Format Support', () => {
    it('should validate legacy format (no components wrapper)', async () => {
      const legacyCharacterDefinition = {
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

      const result = await enhancedValidator.validateInput(legacyCharacterDefinition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.context.layers.structural.isValid).toBe(true);
    });
  });

  describe('Error Cases That Should Still Fail', () => {
    it('should reject empty character definition', async () => {
      const emptyCharacter = {};
      
      const result = await enhancedValidator.validateInput(emptyCharacter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No character components found. Expected components like core:name, core:personality, etc.');
    });

    it('should warn about malformed core:name but not block validation', async () => {
      const malformedCharacter = {
        components: {
          'core:name': {
            // Missing text/name/value fields - should warn but not block
            pronunciation: 'test'
          },
          'core:personality': {
            description: 'Test personality'
          }
        }
      };

      const result = await enhancedValidator.validateInput(malformedCharacter);

      // Should have warnings about name format but not block validation
      expect(result.errors).toContain('Character name component exists but does not contain a valid name. Expected text, name, or value field.');
      expect(result.isValid).toBe(false); // This specific case should fail
    });

    it('should reject completely invalid JSON structure', async () => {
      const invalidData = "not an object";
      
      const result = await enhancedValidator.validateInput(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character definition must be a JSON object');
    });
  });
});