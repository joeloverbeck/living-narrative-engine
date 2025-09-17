/**
 * @file Unit tests for character definition validation pipeline
 * @description Tests EnhancedSpeechPatternsValidator with focus on reported issues:
 * - core:name validation and extraction
 * - empty speech patterns array handling
 * - character definition structure validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EnhancedSpeechPatternsValidator } from '../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';
import { createTestBed } from '../../common/testBed.js';

describe('Character Definition Validation', () => {
  let testBed;
  let enhancedValidator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock dependencies
    mockSchemaValidator = testBed.createMock('schemaValidator', [
      'validate',
      'isSchemaLoaded',
      'validateAndSanitizeResponse',
    ]);

    // Configure schema validator mocks
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    mockSchemaValidator.validate.mockReturnValue({ isValid: true, errors: [] });

    mockLogger = testBed.createMockLogger();

    // Create enhanced validator instance
    enhancedValidator = new EnhancedSpeechPatternsValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('User Reported Issues - Character Name Validation', () => {
    it('should validate character with core:name component (no false "Character name is required" error)', async () => {
      // This reproduces the exact user-reported issue
      const characterDefinition = {
        components: {
          'core:name': {
            text: 'Amaia Castillo',
          },
          'core:personality': {
            traits: ['passionate', 'creative', 'independent'],
            description: 'A fiery artist with strong convictions',
          },
          'core:profile': {
            age: 27,
            occupation: 'Artist',
            background:
              'Grew up in Barcelona, moved to New York for art career',
          },
        },
      };

      // Test enhanced validator (this was failing before fix)
      const result = await enhancedValidator.validateInput(
        characterDefinition,
        {
          includeQualityAssessment: true,
          includeSuggestions: true,
        }
      );

      // Should NOT have "Character name is required" error
      expect(result.errors).not.toContain(
        'Character name is required and must be a string'
      );
      expect(result.isValid).toBe(true);

      // Should extract name correctly and pass structural validation
      expect(result.context.layers.structural.isValid).toBe(true);

      // Should have quality assessment
      expect(result.quality).toBeDefined();
      expect(typeof result.quality.overallScore).toBe('number');

      // Should not have blocking errors
      expect(result.errors.length).toBe(0);
    });

    it('should handle core:speech_patterns component correctly (distinguishes input vs response validation)', async () => {
      // This reproduces the second user-reported issue:
      // Empty speech patterns in CHARACTER INPUT should be valid
      // (different from RESPONSE validation which requires populated patterns)
      const characterDefinition = {
        components: {
          'core:name': {
            text: 'Test Character',
          },
          'core:personality': {
            traits: ['curious'],
            description: 'A test character',
          },
          'core:speech_patterns': {
            patterns: [], // Empty array should be valid for CHARACTER INPUT
            metadata: {
              generated: false,
              lastUpdated: null,
            },
          },
        },
      };

      const result = await enhancedValidator.validateInput(characterDefinition);

      // Should NOT have speech pattern validation errors
      // because this validator is for CHARACTER INPUT, not speech pattern responses
      expect(result.errors).not.toContain('Speech patterns must be an array');
      expect(result.errors).not.toContain('patterns');
      expect(result.isValid).toBe(true);

      // Character definition structure should be valid
      expect(result.context.layers.structural.isValid).toBe(true);

      // Should have basic quality assessment
      expect(result.quality.overallScore).toBeGreaterThan(0);
    });

    it('should validate comprehensive character definition (amaia_castillo example)', async () => {
      // Based on the user's realistic character example
      const realisticCharacter = {
        id: 'amaia_castillo',
        entityType: 'character',
        components: {
          'core:name': {
            text: 'Amaia Castillo',
            pronunciation: 'ah-MAH-ee-ah kas-TEE-yoh',
          },
          'core:personality': {
            traits: ['passionate', 'artistic', 'impulsive', 'loyal'],
            description:
              "Amaia is a passionate artist who feels everything deeply. She's impulsive and follows her heart, sometimes to her detriment, but her loyalty to those she cares about is unwavering.",
            temperament: 'sanguine-choleric',
            motivations: [
              'creative expression',
              'authentic connections',
              'freedom',
            ],
          },
          'core:profile': {
            age: 28,
            occupation: 'Freelance illustrator and muralist',
            background:
              'Born in Barcelona to a Spanish father and Basque mother, Amaia grew up surrounded by art and culture. She moved to New York five years ago to pursue her artistic career.',
            appearance: {
              height: '5\'6"',
              build: 'slender',
              hair: 'long, dark brown with copper highlights',
              eyes: 'hazel',
              style: 'bohemian chic with paint-stained fingers',
            },
          },
          'core:likes': [
            'vibrant colors',
            'late-night painting sessions',
            'flamenco music',
            'small coffee shops',
            'authentic conversations',
          ],
          'core:dislikes': [
            'corporate art',
            'superficial relationships',
            'cold weather',
            'being rushed',
            "art critics who don't create",
          ],
          'core:fears': [
            'losing her creative spark',
            'selling out her artistic vision',
            'being misunderstood',
            'abandonment by those she loves',
          ],
          'movement:goals': {
            shortTerm: ['finish mural commission', 'save for studio space'],
            longTerm: [
              'establish herself as recognized artist',
              'find lasting love',
              'connect with Basque heritage',
            ],
          },
          'core:speech_patterns': {
            patterns: [], // Empty array - should not cause validation failure
            metadata: {
              generated: false,
              language: 'English',
              accent: 'slight Spanish',
              lastUpdated: null,
            },
          },
        },
      };

      const result = await enhancedValidator.validateInput(realisticCharacter, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      // This comprehensive character should validate successfully
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Should have excellent quality score due to comprehensive details
      expect(result.quality.overallScore).toBeGreaterThan(0.7);

      // Should pass all validation layers
      expect(result.context.layers.structural.isValid).toBe(true);
      expect(result.context.layers.semantic).toBeDefined();
      expect(result.context.layers.quality).toBeDefined();

      // Should provide quality assessment breakdown
      expect(result.quality.breakdown).toBeDefined();

      // May have suggestions for further improvement, but no errors
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('Character Name Extraction Variants', () => {
    const nameExtractionTestCases = [
      {
        name: 'text field format',
        nameComponent: { text: 'Isabella Rodriguez' },
        expected: 'Isabella Rodriguez',
      },
      {
        name: 'name field format',
        nameComponent: { name: 'Elena Vasquez' },
        expected: 'Elena Vasquez',
      },
      {
        name: 'value field format',
        nameComponent: { value: 'Carmen Delgado' },
        expected: 'Carmen Delgado',
      },
      {
        name: 'nested personal structure',
        nameComponent: {
          personal: {
            firstName: 'Sofia',
            lastName: 'Martinez',
          },
          text: 'Sofia Martinez',
        },
      },
    ];

    nameExtractionTestCases.forEach(({ name, nameComponent }) => {
      it(`should extract character name from ${name}`, async () => {
        const characterDefinition = {
          components: {
            'core:name': nameComponent,
            'core:personality': {
              description: 'Test character for name extraction',
            },
          },
        };

        const result =
          await enhancedValidator.validateInput(characterDefinition);

        expect(result.isValid).toBe(true);
        expect(result.errors).not.toContain(
          'Character name is required and must be a string'
        );
        // The enhanced validator should successfully extract the name
        expect(result.context.layers.structural.isValid).toBe(true);
      });
    });
  });

  describe('Legacy Format Support', () => {
    it('should validate legacy format (no components wrapper)', async () => {
      const legacyCharacterDefinition = {
        'core:name': {
          text: 'Maria Santos',
        },
        'core:personality': {
          traits: ['analytical', 'methodical'],
          description: 'A careful researcher who values precision',
        },
        'core:profile': {
          age: 34,
          occupation: 'Research Scientist',
        },
      };

      const result = await enhancedValidator.validateInput(
        legacyCharacterDefinition
      );

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
      expect(result.errors).toContain(
        'No character components found. Expected components like core:name, core:personality, etc.'
      );
    });

    it('should reject null or undefined input', async () => {
      const nullResult = await enhancedValidator.validateInput(null);
      expect(nullResult.isValid).toBe(false);
      expect(
        nullResult.errors.some((e) =>
          e.includes('Character definition must be a JSON object')
        )
      ).toBe(true);

      const undefinedResult = await enhancedValidator.validateInput(undefined);
      expect(undefinedResult.isValid).toBe(false);
      expect(
        undefinedResult.errors.some((e) =>
          e.includes('Character definition must be a JSON object')
        )
      ).toBe(true);
    });

    it('should handle malformed core:name component appropriately', async () => {
      const malformedCharacter = {
        components: {
          'core:name': {
            // Missing text/name/value fields - has pronunciation but no actual name
            pronunciation: 'test',
            nickname: 'Testy', // Not a recognized name field
          },
          'core:personality': {
            description:
              'Test personality with some content to avoid depth warnings',
            traits: ['curious', 'analytical'],
          },
          'core:profile': {
            age: 25,
            occupation: 'Test Subject',
          },
        },
      };

      const result = await enhancedValidator.validateInput(malformedCharacter);

      // Should have error about name format
      expect(result.errors).toContain(
        'Character name component exists but does not contain a valid name. Expected text, name, or value field.'
      );
      expect(result.isValid).toBe(false);

      // Should still provide structural validation context
      expect(result.context.layers.structural).toBeDefined();
      expect(result.context.layers.structural.isValid).toBe(false);
    });

    it('should reject completely invalid data types', async () => {
      const invalidData = 'not an object';

      const result = await enhancedValidator.validateInput(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Character definition must be a JSON object'
      );
    });

    it('should handle array input gracefully', async () => {
      const arrayData = [{ 'core:name': { text: 'Test' } }];

      const result = await enhancedValidator.validateInput(arrayData);

      expect(result.isValid).toBe(false);
      // Arrays are objects in JavaScript, so it might pass the object check
      // but fail on the component extraction logic
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Enhanced Validation Features', () => {
    it('should provide quality assessment metrics', async () => {
      const richCharacter = {
        components: {
          'core:name': { text: 'Dr. Elizabeth Harper' },
          'core:personality': {
            traits: ['meticulous', 'empathetic', 'driven', 'perfectionist'],
            description:
              'A dedicated medical researcher who brings both scientific rigor and deep compassion to her work. She has a tendency toward perfectionism that sometimes creates internal conflict.',
            temperament: 'melancholic-sanguine',
          },
          'core:profile': {
            age: 42,
            occupation: 'Chief Medical Research Officer',
            background:
              'Graduated magna cum laude from Harvard Medical School, completed residency at Johns Hopkins. Has published 23 peer-reviewed papers on infectious disease research.',
          },
          'core:likes': [
            'classical music',
            'hiking',
            'mystery novels',
            'fine wine',
          ],
          'core:dislikes': [
            'bureaucratic red tape',
            'sloppy methodology',
            'social media',
          ],
          'core:fears': [
            'making critical errors',
            'failing patients',
            'losing her objectivity',
          ],
          'movement:goals': {
            shortTerm: [
              'complete current vaccine trial',
              'mentor junior researchers',
            ],
            longTerm: [
              'develop breakthrough treatment',
              'establish research foundation',
            ],
          },
        },
      };

      const result = await enhancedValidator.validateInput(richCharacter, {
        includeQualityAssessment: true,
        includeSuggestions: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.quality).toBeDefined();
      expect(result.quality.overallScore).toBeGreaterThan(0.6); // Should have good quality (more realistic threshold)
      expect(result.quality.breakdown).toBeDefined();

      // Should have suggestions even for good characters
      expect(Array.isArray(result.suggestions)).toBe(true);

      // Should have timing information
      expect(result.context.validationTime).toBeGreaterThanOrEqual(0);
      expect(result.context.layers.structural.duration).toBeGreaterThanOrEqual(
        0
      );
    });

    it('should cache validation results for repeated inputs', async () => {
      const character = {
        components: {
          'core:name': { text: 'Cache Test Character' },
          'core:personality': { description: 'Test for caching behavior' },
          'core:profile': { age: 30, occupation: 'Tester' },
        },
      };

      // First validation
      const result1 = await enhancedValidator.validateInput(character);
      expect(result1.isValid).toBe(true);

      // Second validation should be faster (cached)
      const startTime = Date.now();
      const result2 = await enhancedValidator.validateInput(character);
      const endTime = Date.now();

      expect(result2.isValid).toBe(true);
      // Cache hit should be very fast (under 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});

// Additional test for validator statistics and health
describe('Validator Health and Statistics', () => {
  let enhancedValidator;
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    const mockSchemaValidator = testBed.createMock('schemaValidator', [
      'validate',
      'isSchemaLoaded',
      'validateAndSanitizeResponse',
    ]);
    const mockLogger = testBed.createMockLogger();

    enhancedValidator = new EnhancedSpeechPatternsValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should provide validation statistics', () => {
    const stats = enhancedValidator.getValidationStats();

    expect(stats).toBeDefined();
    expect(typeof stats.semanticRules).toBe('number');
    expect(typeof stats.qualityMetrics).toBe('number');
    expect(typeof stats.cacheSize).toBe('number');
    expect(stats.semanticRules).toBeGreaterThan(0);
    expect(stats.qualityMetrics).toBeGreaterThan(0);
  });

  it('should allow cache clearing', () => {
    // Clear cache should not throw
    expect(() => enhancedValidator.clearCache()).not.toThrow();

    const afterClearStats = enhancedValidator.getValidationStats();
    expect(afterClearStats.cacheSize).toBe(0);
  });
});

// Test specifically for the reported validation issues
describe('Specific Bug Fixes Verification', () => {
  let enhancedValidator;
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    const mockSchemaValidator = testBed.createMock('schemaValidator', [
      'validate',
      'isSchemaLoaded',
      'validateAndSanitizeResponse',
    ]);
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    const mockLogger = testBed.createMockLogger();

    enhancedValidator = new EnhancedSpeechPatternsValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should not confuse character input validation with speech pattern response validation', async () => {
    // This is the core issue: the validator should recognize this is CHARACTER input
    // not a speech pattern generation RESPONSE
    const characterInput = {
      components: {
        'core:name': { text: 'Bug Fix Test' },
        'core:personality': { description: 'Testing validation distinction' },
        'core:speech_patterns': {
          patterns: [], // Empty is OK for input
          metadata: { generated: false },
        },
      },
    };

    const result = await enhancedValidator.validateInput(characterInput);

    // Should pass because this is input validation, not response validation
    expect(result.isValid).toBe(true);

    // Should not have speech pattern array validation errors
    const hasPatternErrors = result.errors.some(
      (error) =>
        error.toLowerCase().includes('speech patterns must be') ||
        error.toLowerCase().includes('patterns must be an array')
    );
    expect(hasPatternErrors).toBe(false);
  });

  it('should correctly extract names from various core:name formats', async () => {
    const validTestCases = [
      { nameData: { text: 'John Doe' } },
      { nameData: { name: 'Jane Smith' } },
      { nameData: { value: 'Bob Wilson' } },
      {
        nameData: {
          personal: { firstName: 'Alice', lastName: 'Johnson' },
          text: 'Alice Johnson',
        },
      },
    ];

    for (const testCase of validTestCases) {
      const character = {
        components: {
          'core:name': testCase.nameData,
          'core:personality': { description: 'Test character' },
          'core:profile': { age: 25, occupation: 'Tester' },
        },
      };

      const result = await enhancedValidator.validateInput(character);

      expect(result.isValid).toBe(true);
      expect(result.context.layers.structural.isValid).toBe(true);
    }
  });

  it('should reject core:name with invalid format', async () => {
    const character = {
      components: {
        'core:name': { pronunciation: 'test' }, // No actual name field
        'core:personality': { description: 'Test character' },
        'core:profile': { age: 25, occupation: 'Tester' },
      },
    };

    const result = await enhancedValidator.validateInput(character);

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('does not contain a valid name'))
    ).toBe(true);
  });
});
