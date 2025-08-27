/**
 * @file Unit tests for thematicDirectionsPrompt functions
 * @see src/characterBuilder/prompts/thematicDirectionsPrompt.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  CHARACTER_BUILDER_LLM_PARAMS,
  THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
  EXAMPLE_CHARACTER_CONCEPTS,
  buildThematicDirectionsPrompt,
  validateThematicDirectionsResponse,
  createThematicDirectionsLlmConfig,
} from '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js';
import { BaseTestBed } from '../../../common/baseTestBed.js';

describe('ThematicDirectionsPrompt', () => {
  let testBed;

  beforeEach(() => {
    testBed = new BaseTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constants', () => {
    describe('CHARACTER_BUILDER_LLM_PARAMS', () => {
      it('should export correct LLM parameters', () => {
        expect(CHARACTER_BUILDER_LLM_PARAMS).toEqual({
          temperature: 0.7,
          max_tokens: 3000,
        });
      });

      it('should have numeric temperature and max_tokens', () => {
        expect(typeof CHARACTER_BUILDER_LLM_PARAMS.temperature).toBe('number');
        expect(typeof CHARACTER_BUILDER_LLM_PARAMS.max_tokens).toBe('number');
      });
    });

    describe('THEMATIC_DIRECTIONS_RESPONSE_SCHEMA', () => {
      it('should define valid JSON schema structure', () => {
        expect(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.type).toBe('object');
        expect(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.additionalProperties).toBe(
          false
        );
        expect(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.required).toEqual([
          'thematicDirections',
        ]);
      });

      it('should define thematicDirections array constraints', () => {
        const directionsProperty =
          THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections;
        expect(directionsProperty.type).toBe('array');
        expect(directionsProperty.minItems).toBe(3);
        expect(directionsProperty.maxItems).toBe(5);
      });

      it('should define item schema with required fields', () => {
        const itemSchema =
          THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections
            .items;
        expect(itemSchema.required).toEqual([
          'title',
          'description',
          'coreTension',
          'uniqueTwist',
          'narrativePotential',
        ]);
      });

      it('should define string length constraints for all fields', () => {
        const itemSchema =
          THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections
            .items;
        const properties = itemSchema.properties;

        expect(properties.title.minLength).toBe(5);
        expect(properties.title.maxLength).toBe(100);
        expect(properties.description.minLength).toBe(50);
        expect(properties.description.maxLength).toBe(500);
        expect(properties.coreTension.minLength).toBe(20);
        expect(properties.coreTension.maxLength).toBe(200);
        expect(properties.uniqueTwist.minLength).toBe(20);
        expect(properties.uniqueTwist.maxLength).toBe(1000);
        expect(properties.narrativePotential.minLength).toBe(30);
        expect(properties.narrativePotential.maxLength).toBeUndefined();
      });
    });

    describe('EXAMPLE_CHARACTER_CONCEPTS', () => {
      it('should export array of example character concepts', () => {
        expect(Array.isArray(EXAMPLE_CHARACTER_CONCEPTS)).toBe(true);
        expect(EXAMPLE_CHARACTER_CONCEPTS.length).toBeGreaterThan(0);
      });

      it('should contain string character concepts', () => {
        EXAMPLE_CHARACTER_CONCEPTS.forEach((concept) => {
          expect(typeof concept).toBe('string');
          expect(concept.trim().length).toBeGreaterThan(0);
        });
      });

      it('should include expected example concepts', () => {
        expect(EXAMPLE_CHARACTER_CONCEPTS).toContain(
          "a ditzy female adventurer who's good with a bow"
        );
        expect(EXAMPLE_CHARACTER_CONCEPTS).toContain(
          'a brooding vampire lord seeking redemption'
        );
      });
    });
  });

  describe('buildThematicDirectionsPrompt()', () => {
    it('should build valid prompt for normal character concept', () => {
      const concept = 'a brave knight seeking redemption';
      const result = buildThematicDirectionsPrompt(concept);

      expect(typeof result).toBe('string');
      expect(result).toContain(concept);
      expect(result).toContain('<role>');
      expect(result).toContain('<task_definition>');
      expect(result).toContain('<character_concept>');
      expect(result).toContain('<instructions>');
      expect(result).toContain('<response_format>');
    });

    it('should trim whitespace from character concept', () => {
      const concept = '  spaced concept  ';
      const result = buildThematicDirectionsPrompt(concept);

      expect(result).toContain('spaced concept');
      expect(result).not.toContain('  spaced concept  ');
    });

    it('should include all required prompt sections', () => {
      const concept = 'test concept';
      const result = buildThematicDirectionsPrompt(concept);

      expect(result).toContain('<role>');
      expect(result).toContain('<task_definition>');
      expect(result).toContain('<character_concept>');
      expect(result).toContain('<instructions>');
      expect(result).toContain('<constraints>');
      expect(result).toContain('<capabilities_and_remainders>');
      expect(result).toContain('<response_format>');
      expect(result).toContain('<content_policy>');
    });

    describe('Error handling', () => {
      it('should throw error for null character concept', () => {
        expect(() => buildThematicDirectionsPrompt(null)).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for undefined character concept', () => {
        expect(() => buildThematicDirectionsPrompt(undefined)).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for non-string character concept', () => {
        expect(() => buildThematicDirectionsPrompt(123)).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
        expect(() => buildThematicDirectionsPrompt({})).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
        expect(() => buildThematicDirectionsPrompt([])).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for empty string character concept', () => {
        expect(() => buildThematicDirectionsPrompt('')).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
      });

      it('should throw error for whitespace-only character concept', () => {
        expect(() => buildThematicDirectionsPrompt('   ')).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
        expect(() => buildThematicDirectionsPrompt('\t\n ')).toThrow(
          'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
        );
      });
    });
  });

  describe('validateThematicDirectionsResponse()', () => {
    let validResponse;

    beforeEach(() => {
      validResponse = {
        thematicDirections: [
          {
            title: 'Valid Title',
            description:
              'A detailed description that meets the minimum length requirement for validation.',
            coreTension: 'Core tension explanation',
            uniqueTwist: 'Unique twist explanation',
            narrativePotential: 'Narrative potential explanation text',
          },
          {
            title: 'Another Title',
            description:
              'Another detailed description that meets the minimum length requirement for validation.',
            coreTension: 'Another tension explanation',
            uniqueTwist: 'Another twist explanation',
            narrativePotential: 'Another narrative potential explanation text',
          },
          {
            title: 'Third Title',
            description:
              'Third detailed description that meets the minimum length requirement for validation.',
            coreTension: 'Third tension explanation',
            uniqueTwist: 'Third twist explanation',
            narrativePotential: 'Third narrative potential explanation text',
          },
        ],
      };
    });

    it('should return true for valid response', () => {
      expect(validateThematicDirectionsResponse(validResponse)).toBe(true);
    });

    describe('Basic structure validation', () => {
      it('should throw error for null or undefined response', () => {
        expect(() => validateThematicDirectionsResponse(null)).toThrow(
          'ThematicDirectionsPrompt: Response must be an object'
        );
        expect(() => validateThematicDirectionsResponse(undefined)).toThrow(
          'ThematicDirectionsPrompt: Response must be an object'
        );
      });

      it('should throw error for non-object response', () => {
        expect(() => validateThematicDirectionsResponse('string')).toThrow(
          'ThematicDirectionsPrompt: Response must be an object'
        );
        expect(() => validateThematicDirectionsResponse(123)).toThrow(
          'ThematicDirectionsPrompt: Response must be an object'
        );
        // Arrays are objects in JavaScript, so they will pass the object check
        // but fail the thematicDirections array check
        expect(() => validateThematicDirectionsResponse([])).toThrow(
          'ThematicDirectionsPrompt: Response must contain thematicDirections array'
        );
      });

      it('should throw error for missing thematicDirections property', () => {
        expect(() => validateThematicDirectionsResponse({})).toThrow(
          'ThematicDirectionsPrompt: Response must contain thematicDirections array'
        );
      });

      it('should throw error for non-array thematicDirections', () => {
        expect(() =>
          validateThematicDirectionsResponse({
            thematicDirections: 'not array',
          })
        ).toThrow(
          'ThematicDirectionsPrompt: Response must contain thematicDirections array'
        );
        expect(() =>
          validateThematicDirectionsResponse({ thematicDirections: {} })
        ).toThrow(
          'ThematicDirectionsPrompt: Response must contain thematicDirections array'
        );
      });
    });

    describe('Array length validation', () => {
      it('should throw error for too few thematic directions', () => {
        const invalidResponse = {
          thematicDirections: [validResponse.thematicDirections[0]],
        };
        expect(() =>
          validateThematicDirectionsResponse(invalidResponse)
        ).toThrow(
          'ThematicDirectionsPrompt: Must contain 3-5 thematic directions'
        );

        const invalidResponse2 = {
          thematicDirections: validResponse.thematicDirections.slice(0, 2),
        };
        expect(() =>
          validateThematicDirectionsResponse(invalidResponse2)
        ).toThrow(
          'ThematicDirectionsPrompt: Must contain 3-5 thematic directions'
        );
      });

      it('should throw error for too many thematic directions', () => {
        const invalidResponse = {
          thematicDirections: [
            ...validResponse.thematicDirections,
            validResponse.thematicDirections[0],
            validResponse.thematicDirections[1],
            validResponse.thematicDirections[2],
          ],
        };
        expect(() =>
          validateThematicDirectionsResponse(invalidResponse)
        ).toThrow(
          'ThematicDirectionsPrompt: Must contain 3-5 thematic directions'
        );
      });

      it('should accept 4 and 5 thematic directions', () => {
        const fourDirections = {
          thematicDirections: [
            ...validResponse.thematicDirections,
            validResponse.thematicDirections[0],
          ],
        };
        expect(validateThematicDirectionsResponse(fourDirections)).toBe(true);

        const fiveDirections = {
          thematicDirections: [
            ...validResponse.thematicDirections,
            validResponse.thematicDirections[0],
            validResponse.thematicDirections[1],
          ],
        };
        expect(validateThematicDirectionsResponse(fiveDirections)).toBe(true);
      });
    });

    describe('Direction object validation', () => {
      it('should throw error for non-object direction', () => {
        const invalidResponse = {
          thematicDirections: [
            'not an object',
            validResponse.thematicDirections[1],
            validResponse.thematicDirections[2],
          ],
        };
        expect(() =>
          validateThematicDirectionsResponse(invalidResponse)
        ).toThrow(
          'ThematicDirectionsPrompt: Direction at index 0 must be an object'
        );
      });

      it('should throw error for null direction', () => {
        const invalidResponse = {
          thematicDirections: [
            null,
            validResponse.thematicDirections[1],
            validResponse.thematicDirections[2],
          ],
        };
        expect(() =>
          validateThematicDirectionsResponse(invalidResponse)
        ).toThrow(
          'ThematicDirectionsPrompt: Direction at index 0 must be an object'
        );
      });
    });

    describe('Required fields validation', () => {
      const requiredFields = [
        'title',
        'description',
        'coreTension',
        'uniqueTwist',
        'narrativePotential',
      ];

      requiredFields.forEach((field) => {
        it(`should throw error for missing ${field} field`, () => {
          const invalidDirection = { ...validResponse.thematicDirections[0] };
          delete invalidDirection[field];
          const invalidResponse = {
            thematicDirections: [
              invalidDirection,
              validResponse.thematicDirections[1],
              validResponse.thematicDirections[2],
            ],
          };
          expect(() =>
            validateThematicDirectionsResponse(invalidResponse)
          ).toThrow(
            `ThematicDirectionsPrompt: Direction at index 0 missing required field '${field}'`
          );
        });

        it(`should throw error for non-string ${field} field`, () => {
          const invalidDirection = { ...validResponse.thematicDirections[0] };
          invalidDirection[field] = 123;
          const invalidResponse = {
            thematicDirections: [
              invalidDirection,
              validResponse.thematicDirections[1],
              validResponse.thematicDirections[2],
            ],
          };
          expect(() =>
            validateThematicDirectionsResponse(invalidResponse)
          ).toThrow(
            `ThematicDirectionsPrompt: Direction at index 0 missing required field '${field}'`
          );
        });

        it(`should throw error for empty ${field} field`, () => {
          const invalidDirection = { ...validResponse.thematicDirections[0] };
          invalidDirection[field] = '';
          const invalidResponse = {
            thematicDirections: [
              invalidDirection,
              validResponse.thematicDirections[1],
              validResponse.thematicDirections[2],
            ],
          };
          expect(() =>
            validateThematicDirectionsResponse(invalidResponse)
          ).toThrow(
            `ThematicDirectionsPrompt: Direction at index 0 missing required field '${field}'`
          );
        });

        it(`should throw error for whitespace-only ${field} field`, () => {
          const invalidDirection = { ...validResponse.thematicDirections[0] };
          invalidDirection[field] = '   ';
          const invalidResponse = {
            thematicDirections: [
              invalidDirection,
              validResponse.thematicDirections[1],
              validResponse.thematicDirections[2],
            ],
          };
          expect(() =>
            validateThematicDirectionsResponse(invalidResponse)
          ).toThrow(
            `ThematicDirectionsPrompt: Direction at index 0 missing required field '${field}'`
          );
        });
      });
    });

    describe('Field length validation', () => {
      const fieldConstraints = {
        title: { min: 5, max: 100 },
        description: { min: 50, max: 500 },
        coreTension: { min: 20, max: 200 },
        uniqueTwist: { min: 20, max: 1000 },
        narrativePotential: { min: 30 }, // No max constraint
      };

      Object.entries(fieldConstraints).forEach(([field, { min, max }]) => {
        it(`should throw error for ${field} field too short`, () => {
          const invalidDirection = { ...validResponse.thematicDirections[0] };
          invalidDirection[field] = 'x'.repeat(min - 1);
          const invalidResponse = {
            thematicDirections: [
              invalidDirection,
              validResponse.thematicDirections[1],
              validResponse.thematicDirections[2],
            ],
          };

          const expectedError = max
            ? `ThematicDirectionsPrompt: Direction at index 0 field '${field}' must be between ${min} and ${max} characters`
            : `ThematicDirectionsPrompt: Direction at index 0 field '${field}' must be at least ${min} characters`;

          expect(() =>
            validateThematicDirectionsResponse(invalidResponse)
          ).toThrow(expectedError);
        });

        if (max) {
          it(`should throw error for ${field} field too long`, () => {
            const invalidDirection = { ...validResponse.thematicDirections[0] };
            invalidDirection[field] = 'x'.repeat(max + 1);
            const invalidResponse = {
              thematicDirections: [
                invalidDirection,
                validResponse.thematicDirections[1],
                validResponse.thematicDirections[2],
              ],
            };
            expect(() =>
              validateThematicDirectionsResponse(invalidResponse)
            ).toThrow(
              `ThematicDirectionsPrompt: Direction at index 0 field '${field}' must be between ${min} and ${max} characters`
            );
          });
        } else {
          it(`should accept ${field} field at very long length`, () => {
            const validDirection = { ...validResponse.thematicDirections[0] };
            validDirection[field] = 'x'.repeat(1000); // Test with a very long string
            const testResponse = {
              thematicDirections: [
                validDirection,
                validResponse.thematicDirections[1],
                validResponse.thematicDirections[2],
              ],
            };
            expect(() =>
              validateThematicDirectionsResponse(testResponse)
            ).not.toThrow();
          });
        }

        it(`should accept ${field} field at minimum length`, () => {
          const validDirection = { ...validResponse.thematicDirections[0] };
          validDirection[field] = 'x'.repeat(min);
          const testResponse = {
            thematicDirections: [
              validDirection,
              validResponse.thematicDirections[1],
              validResponse.thematicDirections[2],
            ],
          };
          expect(validateThematicDirectionsResponse(testResponse)).toBe(true);
        });

        if (max) {
          it(`should accept ${field} field at maximum length`, () => {
            const validDirection = { ...validResponse.thematicDirections[0] };
            validDirection[field] = 'x'.repeat(max);
            const testResponse = {
              thematicDirections: [
                validDirection,
                validResponse.thematicDirections[1],
                validResponse.thematicDirections[2],
              ],
            };
            expect(validateThematicDirectionsResponse(testResponse)).toBe(true);
          });
        }
      });
    });

    it('should validate all directions in array', () => {
      const invalidResponse = {
        thematicDirections: [
          validResponse.thematicDirections[0],
          { ...validResponse.thematicDirections[1], title: 'x' }, // Too short
          validResponse.thematicDirections[2],
        ],
      };
      expect(() => validateThematicDirectionsResponse(invalidResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 1 field 'title' must be between 5 and 100 characters"
      );
    });
  });

  describe('createThematicDirectionsLlmConfig()', () => {
    let baseLlmConfig;

    beforeEach(() => {
      baseLlmConfig = {
        provider: 'openrouter',
        model: 'test-model',
        defaultParameters: {
          temperature: 0.5,
          max_tokens: 1000,
        },
      };
    });

    it('should create enhanced config with JSON schema', () => {
      const result = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(result).toEqual({
        provider: 'openrouter',
        model: 'test-model',
        jsonOutputStrategy: {
          method: 'openrouter_json_schema',
          jsonSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
        },
        defaultParameters: {
          temperature: 0.7, // Should be overridden by CHARACTER_BUILDER_LLM_PARAMS
          max_tokens: 3000, // Should be overridden by CHARACTER_BUILDER_LLM_PARAMS
        },
      });
    });

    it('should preserve non-overridden base config properties', () => {
      const extendedBaseConfig = {
        ...baseLlmConfig,
        apiKey: 'test-key',
        baseUrl: 'test-url',
        customProperty: 'custom-value',
      };

      const result = createThematicDirectionsLlmConfig(extendedBaseConfig);

      expect(result.apiKey).toBe('test-key');
      expect(result.baseUrl).toBe('test-url');
      expect(result.customProperty).toBe('custom-value');
    });

    it('should override base config parameters with CHARACTER_BUILDER_LLM_PARAMS', () => {
      const result = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(result.defaultParameters.temperature).toBe(
        CHARACTER_BUILDER_LLM_PARAMS.temperature
      );
      expect(result.defaultParameters.max_tokens).toBe(
        CHARACTER_BUILDER_LLM_PARAMS.max_tokens
      );
    });

    it('should merge parameters preserving non-conflicting ones', () => {
      const configWithExtraParams = {
        ...baseLlmConfig,
        defaultParameters: {
          ...baseLlmConfig.defaultParameters,
          top_p: 0.9,
          frequency_penalty: 0.1,
        },
      };

      const result = createThematicDirectionsLlmConfig(configWithExtraParams);

      expect(result.defaultParameters.top_p).toBe(0.9);
      expect(result.defaultParameters.frequency_penalty).toBe(0.1);
      expect(result.defaultParameters.temperature).toBe(
        CHARACTER_BUILDER_LLM_PARAMS.temperature
      );
      expect(result.defaultParameters.max_tokens).toBe(
        CHARACTER_BUILDER_LLM_PARAMS.max_tokens
      );
    });

    it('should add JSON schema configuration', () => {
      const result = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(result.jsonOutputStrategy).toEqual({
        method: 'openrouter_json_schema',
        jsonSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
      });
    });

    describe('Error handling', () => {
      it('should throw error for null base config', () => {
        expect(() => createThematicDirectionsLlmConfig(null)).toThrow(
          'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
        );
      });

      it('should throw error for undefined base config', () => {
        expect(() => createThematicDirectionsLlmConfig(undefined)).toThrow(
          'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
        );
      });

      it('should throw error for non-object base config', () => {
        expect(() => createThematicDirectionsLlmConfig('string')).toThrow(
          'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
        );
        expect(() => createThematicDirectionsLlmConfig(123)).toThrow(
          'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
        );
        expect(() => createThematicDirectionsLlmConfig(true)).toThrow(
          'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
        );
      });

      it('should handle arrays as base config (arrays are objects in JavaScript)', () => {
        // Arrays are objects in JavaScript, so this will not throw
        // It will spread the array properties (if any) into the result
        const result = createThematicDirectionsLlmConfig([]);
        expect(result.jsonOutputStrategy).toEqual({
          method: 'openrouter_json_schema',
          jsonSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
        });
        expect(result.defaultParameters).toEqual(CHARACTER_BUILDER_LLM_PARAMS);
      });
    });

    it('should handle empty base config object', () => {
      const result = createThematicDirectionsLlmConfig({});

      expect(result.jsonOutputStrategy).toEqual({
        method: 'openrouter_json_schema',
        jsonSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
      });
      expect(result.defaultParameters).toEqual(CHARACTER_BUILDER_LLM_PARAMS);
    });

    it('should handle base config without defaultParameters', () => {
      const configWithoutParams = {
        provider: 'openrouter',
        model: 'test-model',
      };

      const result = createThematicDirectionsLlmConfig(configWithoutParams);

      expect(result.defaultParameters).toEqual(CHARACTER_BUILDER_LLM_PARAMS);
    });
  });
});
