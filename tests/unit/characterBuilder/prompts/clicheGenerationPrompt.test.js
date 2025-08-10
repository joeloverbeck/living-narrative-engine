/**
 * @file Unit tests for cliche generation prompt functions
 * @see src/characterBuilder/prompts/clicheGenerationPrompt.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildClicheGenerationPrompt,
  validateClicheGenerationResponse,
  createClicheGenerationLlmConfig,
  CLICHE_GENERATION_RESPONSE_SCHEMA,
  CHARACTER_BUILDER_LLM_PARAMS,
} from '../../../../src/characterBuilder/prompts/clicheGenerationPrompt.js';

describe('clicheGenerationPrompt', () => {
  // Sample valid inputs
  const validCharacterConcept = 'A brave warrior seeking redemption';
  const validDirection = {
    title: 'The Reluctant Guardian',
    description:
      'A character who must protect something they never wanted to guard',
    coreTension: 'Duty versus personal freedom',
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
      };

      const prompt = buildClicheGenerationPrompt(
        conceptWithSpaces,
        directionWithSpaces
      );

      expect(prompt).toContain(validCharacterConcept);
      expect(prompt).toContain(validDirection.title);
      expect(prompt).toContain(validDirection.description);
      expect(prompt).toContain(validDirection.coreTension);
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
});
