/**
 * @file Unit tests for cliche generation prompt functions
 * @see src/characterBuilder/prompts/clicheGenerationPrompt.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildClicheGenerationPrompt,
  buildEnhancedClicheGenerationPrompt,
  validateClicheGenerationResponse,
  validateClicheGenerationResponseEnhanced,
  createClicheGenerationLlmConfig,
  createEnhancedClicheGenerationLlmConfig,
  CLICHE_GENERATION_RESPONSE_SCHEMA,
  CHARACTER_BUILDER_LLM_PARAMS,
  DEFAULT_ENHANCEMENT_OPTIONS,
  PROMPT_VERSION_INFO,
} from '../../../../src/characterBuilder/prompts/clicheGenerationPrompt.js';

describe('clicheGenerationPrompt', () => {
  // Sample valid inputs
  const validCharacterConcept = 'A brave warrior seeking redemption';
  const validDirection = {
    title: 'The Reluctant Guardian',
    description:
      'A character who must protect something they never wanted to guard',
    coreTension: 'Duty versus personal freedom',
    uniqueTwist: 'The guardian is protecting their own forgotten past self',
    narrativePotential:
      "Explores themes of self-discovery and reconciliation with one's past",
  };

  // Sample valid LLM response
  const validLlmResponse = {
    categories: {
      names: ['John', 'Mary', 'Bob'],
      physicalDescriptions: ['tall and dark', 'blonde hair'],
      personalityTraits: ['brooding', 'cheerful'],
      skillsAbilities: ['swordsmanship', 'magic'],
      typicalLikes: ['justice', 'freedom'],
      typicalDislikes: ['evil', 'tyranny'],
      commonFears: ['death', 'failure'],
      genericGoals: ['save the world', 'find love'],
      backgroundElements: ['orphaned', 'royal bloodline'],
      overusedSecrets: ['secret power', 'hidden identity'],
      speechPatterns: ['ye olde english', 'catchphrases'],
    },
    tropesAndStereotypes: ['chosen one', 'reluctant hero'],
  };

  describe('CHARACTER_BUILDER_LLM_PARAMS', () => {
    it('should define correct LLM parameters', () => {
      expect(CHARACTER_BUILDER_LLM_PARAMS).toEqual({
        temperature: 0.8,
        max_tokens: 3000,
      });
    });
  });

  describe('CLICHE_GENERATION_RESPONSE_SCHEMA', () => {
    it('should have correct schema structure', () => {
      expect(CLICHE_GENERATION_RESPONSE_SCHEMA.type).toBe('object');
      expect(CLICHE_GENERATION_RESPONSE_SCHEMA.additionalProperties).toBe(
        false
      );
      expect(CLICHE_GENERATION_RESPONSE_SCHEMA.required).toContain(
        'categories'
      );
      expect(CLICHE_GENERATION_RESPONSE_SCHEMA.required).toContain(
        'tropesAndStereotypes'
      );
    });

    it('should define all required category properties', () => {
      const categories =
        CLICHE_GENERATION_RESPONSE_SCHEMA.properties.categories;
      const requiredCategories = [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns',
      ];

      expect(categories.required).toEqual(requiredCategories);

      // Verify each category is an array with string items
      for (const category of requiredCategories) {
        expect(categories.properties[category].type).toBe('array');
        expect(categories.properties[category].items.type).toBe('string');
        expect(categories.properties[category].maxItems).toBe(10);
      }
    });

    it('should define tropesAndStereotypes as array with max 15 items', () => {
      const tropes =
        CLICHE_GENERATION_RESPONSE_SCHEMA.properties.tropesAndStereotypes;
      expect(tropes.type).toBe('array');
      expect(tropes.items.type).toBe('string');
      expect(tropes.maxItems).toBe(15);
    });
  });

  describe('buildClicheGenerationPrompt', () => {
    it('should build prompt with valid inputs', () => {
      const prompt = buildClicheGenerationPrompt(
        validCharacterConcept,
        validDirection
      );

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain(validCharacterConcept);
      expect(prompt).toContain(validDirection.title);
      expect(prompt).toContain(validDirection.description);
      expect(prompt).toContain(validDirection.coreTension);
    });

    it('should include all required sections in prompt', () => {
      const prompt = buildClicheGenerationPrompt(
        validCharacterConcept,
        validDirection
      );

      expect(prompt).toContain('<role>');
      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain('<thematic_direction>');
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<constraints>');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('<content_policy>');
    });

    it('should trim whitespace from inputs', () => {
      const conceptWithSpaces = '  ' + validCharacterConcept + '  ';
      const directionWithSpaces = {
        title: '  ' + validDirection.title + '  ',
        description: '  ' + validDirection.description + '  ',
        coreTension: '  ' + validDirection.coreTension + '  ',
        uniqueTwist: '  ' + validDirection.uniqueTwist + '  ',
        narrativePotential: '  ' + validDirection.narrativePotential + '  ',
      };

      const prompt = buildClicheGenerationPrompt(
        conceptWithSpaces,
        directionWithSpaces
      );

      expect(prompt).toContain(validCharacterConcept);
      expect(prompt).toContain(validDirection.title);
      expect(prompt).toContain(validDirection.description);
      expect(prompt).toContain(validDirection.coreTension);
      expect(prompt).toContain(validDirection.uniqueTwist);
      expect(prompt).toContain(validDirection.narrativePotential);
    });

    it('should handle direction without optional fields', () => {
      const directionWithoutOptional = {
        title: 'The Reluctant Guardian',
        description:
          'A character who must protect something they never wanted to guard',
        coreTension: 'Duty versus personal freedom',
      };

      const prompt = buildClicheGenerationPrompt(
        validCharacterConcept,
        directionWithoutOptional
      );

      expect(prompt).toContain(directionWithoutOptional.title);
      expect(prompt).toContain(directionWithoutOptional.description);
      expect(prompt).toContain(directionWithoutOptional.coreTension);
      expect(prompt).not.toContain('Unique Twist:');
      expect(prompt).not.toContain('Narrative Potential:');
    });

    describe('input validation', () => {
      it('should throw error for empty characterConcept', () => {
        expect(() => {
          buildClicheGenerationPrompt('', validDirection);
        }).toThrow(
          'ClicheGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for whitespace-only characterConcept', () => {
        expect(() => {
          buildClicheGenerationPrompt('   ', validDirection);
        }).toThrow(
          'ClicheGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for non-string characterConcept', () => {
        expect(() => {
          buildClicheGenerationPrompt(123, validDirection);
        }).toThrow(
          'ClicheGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for null characterConcept', () => {
        expect(() => {
          buildClicheGenerationPrompt(null, validDirection);
        }).toThrow(
          'ClicheGenerationPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for non-object direction', () => {
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, null);
        }).toThrow('ClicheGenerationPrompt: direction must be a valid object');
      });

      it('should throw error for empty direction.title', () => {
        const invalidDirection = { ...validDirection, title: '' };
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.title must be a non-empty string'
        );
      });

      it('should throw error for missing direction.description', () => {
        const invalidDirection = { ...validDirection };
        delete invalidDirection.description;
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.description must be a non-empty string'
        );
      });

      it('should throw error for empty direction.coreTension', () => {
        const invalidDirection = { ...validDirection, coreTension: '   ' };
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.coreTension must be a non-empty string'
        );
      });

      it('should throw error for invalid direction.uniqueTwist', () => {
        const invalidDirection = { ...validDirection, uniqueTwist: '   ' };
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.uniqueTwist must be a non-empty string if provided'
        );
      });

      it('should throw error when direction.uniqueTwist is not a string', () => {
        const invalidDirection = { ...validDirection, uniqueTwist: 42 };
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.uniqueTwist must be a non-empty string if provided'
        );
      });

      it('should throw error for invalid direction.narrativePotential', () => {
        const invalidDirection = { ...validDirection, narrativePotential: '' };
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.narrativePotential must be a non-empty string if provided'
        );
      });

      it('should throw error when direction.narrativePotential is not a string', () => {
        const invalidDirection = { ...validDirection, narrativePotential: 100 };
        expect(() => {
          buildClicheGenerationPrompt(validCharacterConcept, invalidDirection);
        }).toThrow(
          'ClicheGenerationPrompt: direction.narrativePotential must be a non-empty string if provided'
        );
      });
    });
  });

  describe('validateClicheGenerationResponse', () => {
    it('should return true for valid response', () => {
      const result = validateClicheGenerationResponse(validLlmResponse);
      expect(result).toBe(true);
    });

    it('should validate response with empty arrays', () => {
      const responseWithEmptyArrays = {
        categories: {
          names: [],
          physicalDescriptions: [],
          personalityTraits: [],
          skillsAbilities: [],
          typicalLikes: [],
          typicalDislikes: [],
          commonFears: [],
          genericGoals: [],
          backgroundElements: [],
          overusedSecrets: [],
          speechPatterns: [],
        },
        tropesAndStereotypes: [],
      };

      const result = validateClicheGenerationResponse(responseWithEmptyArrays);
      expect(result).toBe(true);
    });

    describe('validation errors', () => {
      it('should throw error for null response', () => {
        expect(() => {
          validateClicheGenerationResponse(null);
        }).toThrow('ClicheGenerationPrompt: Response must be an object');
      });

      it('should throw error for non-object response', () => {
        expect(() => {
          validateClicheGenerationResponse('invalid');
        }).toThrow('ClicheGenerationPrompt: Response must be an object');
      });

      it('should throw error for missing categories', () => {
        const invalidResponse = { tropesAndStereotypes: [] };
        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          'ClicheGenerationPrompt: Response must contain categories object'
        );
      });

      it('should throw error for missing tropesAndStereotypes', () => {
        const invalidResponse = { categories: {} };
        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          'ClicheGenerationPrompt: Response must contain tropesAndStereotypes array'
        );
      });

      it('should throw error for non-array tropesAndStereotypes', () => {
        const invalidResponse = {
          categories: validLlmResponse.categories,
          tropesAndStereotypes: 'invalid',
        };
        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          'ClicheGenerationPrompt: Response must contain tropesAndStereotypes array'
        );
      });

      it('should throw error for missing required category', () => {
        const invalidCategories = { ...validLlmResponse.categories };
        delete invalidCategories.names;
        const invalidResponse = {
          categories: invalidCategories,
          tropesAndStereotypes: validLlmResponse.tropesAndStereotypes,
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow("ClicheGenerationPrompt: Missing required category 'names'");
      });

      it('should throw error for non-array category', () => {
        const invalidCategories = {
          ...validLlmResponse.categories,
          names: 'invalid',
        };
        const invalidResponse = {
          categories: invalidCategories,
          tropesAndStereotypes: validLlmResponse.tropesAndStereotypes,
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow("ClicheGenerationPrompt: Category 'names' must be an array");
      });

      it('should throw error for non-string category item', () => {
        const invalidCategories = {
          ...validLlmResponse.categories,
          names: ['valid', 123, 'also valid'],
        };
        const invalidResponse = {
          categories: invalidCategories,
          tropesAndStereotypes: validLlmResponse.tropesAndStereotypes,
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          "ClicheGenerationPrompt: Category 'names' item at index 1 must be a non-empty string"
        );
      });

      it('should throw error for empty string category item', () => {
        const invalidCategories = {
          ...validLlmResponse.categories,
          names: ['valid', '', 'also valid'],
        };
        const invalidResponse = {
          categories: invalidCategories,
          tropesAndStereotypes: validLlmResponse.tropesAndStereotypes,
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          "ClicheGenerationPrompt: Category 'names' item at index 1 must be a non-empty string"
        );
      });

      it('should throw error for category with too many items', () => {
        const invalidCategories = {
          ...validLlmResponse.categories,
          names: new Array(11).fill('name'), // 11 items, max is 10
        };
        const invalidResponse = {
          categories: invalidCategories,
          tropesAndStereotypes: validLlmResponse.tropesAndStereotypes,
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          "ClicheGenerationPrompt: Category 'names' cannot have more than 10 items"
        );
      });

      it('should throw error for tropesAndStereotypes with too many items', () => {
        const invalidResponse = {
          categories: validLlmResponse.categories,
          tropesAndStereotypes: new Array(16).fill('trope'), // 16 items, max is 15
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          'ClicheGenerationPrompt: tropesAndStereotypes cannot have more than 15 items'
        );
      });

      it('should throw error for non-string tropesAndStereotypes item', () => {
        const invalidResponse = {
          categories: validLlmResponse.categories,
          tropesAndStereotypes: ['valid', 123, 'also valid'],
        };

        expect(() => {
          validateClicheGenerationResponse(invalidResponse);
        }).toThrow(
          'ClicheGenerationPrompt: tropesAndStereotypes item at index 1 must be a non-empty string'
        );
      });
    });
  });

  describe('createClicheGenerationLlmConfig', () => {
    const baseLlmConfig = {
      configId: 'test-config',
      defaultParameters: {
        temperature: 0.5,
        max_tokens: 1000,
      },
    };

    it('should create enhanced config with JSON schema', () => {
      const enhancedConfig = createClicheGenerationLlmConfig(baseLlmConfig);

      expect(enhancedConfig).toEqual({
        ...baseLlmConfig,
        jsonOutputStrategy: {
          method: 'openrouter_json_schema',
          jsonSchema: CLICHE_GENERATION_RESPONSE_SCHEMA,
        },
        defaultParameters: {
          ...baseLlmConfig.defaultParameters,
          ...CHARACTER_BUILDER_LLM_PARAMS,
        },
      });
    });

    it('should override base parameters with character builder params', () => {
      const enhancedConfig = createClicheGenerationLlmConfig(baseLlmConfig);

      expect(enhancedConfig.defaultParameters.temperature).toBe(0.8); // CHARACTER_BUILDER_LLM_PARAMS value
      expect(enhancedConfig.defaultParameters.max_tokens).toBe(3000); // CHARACTER_BUILDER_LLM_PARAMS value
    });

    it('should throw error for null baseLlmConfig', () => {
      expect(() => {
        createClicheGenerationLlmConfig(null);
      }).toThrow(
        'ClicheGenerationPrompt: baseLlmConfig must be a valid object'
      );
    });

    it('should throw error for non-object baseLlmConfig', () => {
      expect(() => {
        createClicheGenerationLlmConfig('invalid');
      }).toThrow(
        'ClicheGenerationPrompt: baseLlmConfig must be a valid object'
      );
    });
  });

  describe('Enhancement Features', () => {
    describe('PROMPT_VERSION_INFO', () => {
      it('should have correct version information', () => {
        expect(PROMPT_VERSION_INFO).toHaveProperty('version');
        expect(PROMPT_VERSION_INFO).toHaveProperty('previousVersions');
        expect(PROMPT_VERSION_INFO).toHaveProperty('currentChanges');
        expect(PROMPT_VERSION_INFO.version).toBe('1.2.0');
        expect(Array.isArray(PROMPT_VERSION_INFO.currentChanges)).toBe(true);
      });
    });

    describe('DEFAULT_ENHANCEMENT_OPTIONS', () => {
      it('should have correct default values', () => {
        expect(DEFAULT_ENHANCEMENT_OPTIONS).toEqual({
          includeFewShotExamples: false,
          genre: null,
          minItemsPerCategory: 3,
          maxItemsPerCategory: 8,
          enableAdvancedValidation: true,
          includeQualityMetrics: true,
        });
      });
    });

    describe('buildEnhancedClicheGenerationPrompt', () => {
      it('should build standard prompt without enhancements by default', () => {
        const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
          validCharacterConcept,
          validDirection
        );
        const standardPrompt = buildClicheGenerationPrompt(
          validCharacterConcept,
          validDirection
        );

        expect(enhancedPrompt).toBe(standardPrompt);
      });

      it('should include few-shot examples when requested', () => {
        const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
          validCharacterConcept,
          validDirection,
          { includeFewShotExamples: true }
        );

        expect(enhancedPrompt).toContain('<examples>');
        expect(enhancedPrompt).toContain('<example>');
        expect(enhancedPrompt).toContain('Luke');
        expect(enhancedPrompt).toContain('Arthur');
      });

      it('should include genre context when specified', () => {
        const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
          validCharacterConcept,
          validDirection,
          { genre: 'fantasy' }
        );

        expect(enhancedPrompt).toContain('<genre_context>');
        expect(enhancedPrompt).toContain('fantasy-specific clichés');
        expect(enhancedPrompt).toContain('chosen ones');
      });

      it('should support all genre types', () => {
        const genres = [
          'fantasy',
          'scifi',
          'romance',
          'mystery',
          'horror',
          'contemporary',
        ];

        genres.forEach((genre) => {
          const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
            validCharacterConcept,
            validDirection,
            { genre }
          );
          expect(enhancedPrompt).toContain('<genre_context>');
        });
      });

      it('should adjust item count constraints', () => {
        const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
          validCharacterConcept,
          validDirection,
          { minItemsPerCategory: 5, maxItemsPerCategory: 10 }
        );

        expect(enhancedPrompt).toContain('Provide 5-10 items per category');
        expect(enhancedPrompt).not.toContain('Provide 3-8 items per category');
      });

      it('should combine multiple enhancements', () => {
        const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
          validCharacterConcept,
          validDirection,
          {
            includeFewShotExamples: true,
            genre: 'scifi',
            minItemsPerCategory: 4,
            maxItemsPerCategory: 6,
          }
        );

        expect(enhancedPrompt).toContain('<examples>');
        expect(enhancedPrompt).toContain('<genre_context>');
        expect(enhancedPrompt).toContain('sci-fi clichés');
        expect(enhancedPrompt).toContain('Provide 4-6 items per category');
      });

      it('should handle invalid genre gracefully', () => {
        const enhancedPrompt = buildEnhancedClicheGenerationPrompt(
          validCharacterConcept,
          validDirection,
          { genre: 'invalid' }
        );

        // Should not contain genre context for invalid genre
        expect(enhancedPrompt).not.toContain('<genre_context>');
      });
    });

    describe('validateClicheGenerationResponseEnhanced', () => {
      it('should validate correct response with statistics', () => {
        const result =
          validateClicheGenerationResponseEnhanced(validLlmResponse);

        expect(result.valid).toBe(true);
        expect(result).toHaveProperty('statistics');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('qualityMetrics');
        expect(result).toHaveProperty('recommendations');
      });

      it('should calculate correct statistics', () => {
        const result =
          validateClicheGenerationResponseEnhanced(validLlmResponse);

        expect(result.statistics).toHaveProperty('totalItems');
        expect(result.statistics).toHaveProperty('categoryCounts');
        expect(result.statistics).toHaveProperty('categoryLengths');
        expect(result.statistics).toHaveProperty('tropesCount');
        expect(result.statistics).toHaveProperty('averageItemsPerCategory');
        expect(result.statistics).toHaveProperty('completenessScore');

        expect(result.statistics.tropesCount).toBe(2);
        expect(result.statistics.completenessScore).toBe(1); // All categories present
      });

      it('should generate warnings for sparse categories', () => {
        const sparseResponse = {
          categories: {
            names: ['John'], // Only 1 item
            physicalDescriptions: ['tall', 'dark'], // 2 items
            personalityTraits: ['brooding', 'cheerful', 'brave'], // 3 items - ok
            skillsAbilities: ['swordsmanship', 'magic', 'archery'],
            typicalLikes: ['justice', 'freedom', 'honor'],
            typicalDislikes: ['evil', 'tyranny', 'dishonesty'],
            commonFears: ['death', 'failure', 'betrayal'],
            genericGoals: ['save world', 'find love', 'get revenge'],
            backgroundElements: ['orphaned', 'royal', 'trained'],
            overusedSecrets: ['secret power', 'hidden identity', 'prophecy'],
            speechPatterns: ['heroic', 'noble', 'inspiring'],
          },
          tropesAndStereotypes: ['chosen one', 'reluctant hero'],
        };

        const result = validateClicheGenerationResponseEnhanced(sparseResponse);

        expect(result.warnings).toContain(
          'Category "names" has only 1 items (recommended: 3+)'
        );
        expect(result.warnings).toContain(
          'Category "physicalDescriptions" has only 2 items (recommended: 3+)'
        );
      });

      it('should generate warnings for too many items', () => {
        const overpackedResponse = {
          ...validLlmResponse,
          categories: {
            ...validLlmResponse.categories,
            names: Array(10)
              .fill()
              .map((_, i) => `Name${i}`), // 10 items
          },
        };

        const result =
          validateClicheGenerationResponseEnhanced(overpackedResponse);

        expect(result.warnings).toContain(
          'Category "names" has 10 items (recommended: 3-8)'
        );
      });

      it('should generate warnings for few tropes', () => {
        const fewTropesResponse = {
          ...validLlmResponse,
          tropesAndStereotypes: ['chosen one'], // Only 1 trope
        };

        const result =
          validateClicheGenerationResponseEnhanced(fewTropesResponse);

        expect(result.warnings).toContain(
          'Only 1 tropes provided (recommended: 5+)'
        );
      });

      it('should not warn when trope count meets recommendation', () => {
        const ampleTropesResponse = {
          ...validLlmResponse,
          tropesAndStereotypes: [
            'trope 1',
            'trope 2',
            'trope 3',
            'trope 4',
            'trope 5',
          ],
        };

        const result =
          validateClicheGenerationResponseEnhanced(ampleTropesResponse);

        expect(result.warnings).not.toContain(
          expect.stringContaining('tropes provided (recommended: 5+)')
        );
      });

      it('should calculate quality metrics', () => {
        const result =
          validateClicheGenerationResponseEnhanced(validLlmResponse);

        expect(result.qualityMetrics).toHaveProperty('completeness');
        expect(result.qualityMetrics).toHaveProperty('itemDensity');
        expect(result.qualityMetrics).toHaveProperty('contentRichness');
        expect(result.qualityMetrics).toHaveProperty('overallScore');

        expect(result.qualityMetrics.completeness).toBe(1);
        expect(typeof result.qualityMetrics.overallScore).toBe('number');
        expect(result.qualityMetrics.overallScore).toBeGreaterThan(0);
      });

      it('should generate recommendations for weak responses', () => {
        const weakResponse = {
          categories: {
            names: [],
            physicalDescriptions: ['a'],
            personalityTraits: [],
            skillsAbilities: [],
            typicalLikes: [],
            typicalDislikes: [],
            commonFears: [],
            genericGoals: [],
            backgroundElements: [],
            overusedSecrets: [],
            speechPatterns: [],
          },
          tropesAndStereotypes: [],
        };

        const result =
          validateClicheGenerationResponseEnhanced(weakResponse);

        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations).toEqual(
          expect.arrayContaining([
            'Ensure all required categories are populated',
            'Consider generating more items per category for better coverage',
            'Review response quality - multiple issues detected',
          ])
        );
      });

      it('should skip density recommendation when coverage is sufficient', () => {
        const richItems = Array.from({ length: 5 }, (_, index) =>
          `Detailed entry ${index}`
        );

        const robustResponse = {
          categories: Object.fromEntries(
            Object.keys(validLlmResponse.categories).map((category) => [
              category,
              richItems,
            ])
          ),
          tropesAndStereotypes: [
            'trope 1',
            'trope 2',
            'trope 3',
            'trope 4',
            'trope 5',
          ],
        };

        const result =
          validateClicheGenerationResponseEnhanced(robustResponse);

        expect(result.recommendations).not.toContain(
          'Consider generating more items per category for better coverage'
        );
        expect(result.warnings).not.toContain(
          expect.stringContaining('items are quite short')
        );
      });

      it('should throw error for invalid response', () => {
        expect(() => {
          validateClicheGenerationResponseEnhanced({ invalid: 'response' });
        }).toThrow(
          'ClicheGenerationPrompt: Response must contain categories object'
        );
      });
    });

    describe('createEnhancedClicheGenerationLlmConfig', () => {
      const baseLlmConfig = {
        configId: 'test-config',
        defaultParameters: {
          temperature: 0.5,
          max_tokens: 1000,
        },
      };

      it('should create enhanced config with version info', () => {
        const enhancedConfig =
          createEnhancedClicheGenerationLlmConfig(baseLlmConfig);

        expect(enhancedConfig).toHaveProperty('enhancementOptions');
        expect(enhancedConfig).toHaveProperty('promptVersion');
        expect(enhancedConfig.promptVersion).toBe(PROMPT_VERSION_INFO.version);
        expect(enhancedConfig.enhancementOptions).toEqual(
          DEFAULT_ENHANCEMENT_OPTIONS
        );
      });

      it('should merge enhancement options', () => {
        const customOptions = {
          includeFewShotExamples: true,
          genre: 'fantasy',
        };

        const enhancedConfig = createEnhancedClicheGenerationLlmConfig(
          baseLlmConfig,
          customOptions
        );

        expect(enhancedConfig.enhancementOptions.includeFewShotExamples).toBe(
          true
        );
        expect(enhancedConfig.enhancementOptions.genre).toBe('fantasy');
        expect(enhancedConfig.enhancementOptions.minItemsPerCategory).toBe(3); // Default preserved
      });

      it('should inherit base config properties', () => {
        const enhancedConfig =
          createEnhancedClicheGenerationLlmConfig(baseLlmConfig);

        expect(enhancedConfig.configId).toBe('test-config');
        expect(enhancedConfig.jsonOutputStrategy).toBeDefined();
        expect(enhancedConfig.defaultParameters.temperature).toBe(0.8); // CHARACTER_BUILDER_LLM_PARAMS
      });
    });
  });
});
