/**
 * @file Unit tests for thematicDirectionsPrompt
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  CHARACTER_BUILDER_LLM_PARAMS,
  THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
  buildThematicDirectionsPrompt,
  validateThematicDirectionsResponse,
  createThematicDirectionsLlmConfig,
  EXAMPLE_CHARACTER_CONCEPTS,
} from '../../../../src/characterBuilder/prompts/thematicDirectionsPrompt.js';

describe('thematicDirectionsPrompt', () => {
  describe('Constants', () => {
    it('should export CHARACTER_BUILDER_LLM_PARAMS with correct values', () => {
      expect(CHARACTER_BUILDER_LLM_PARAMS).toBeDefined();
      expect(CHARACTER_BUILDER_LLM_PARAMS.temperature).toBe(0.7);
      expect(CHARACTER_BUILDER_LLM_PARAMS.max_tokens).toBe(2000);
    });

    it('should export THEMATIC_DIRECTIONS_RESPONSE_SCHEMA with correct structure', () => {
      expect(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA).toBeDefined();
      expect(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.type).toBe('object');
      expect(THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties).toHaveProperty(
        'thematicDirections'
      );
      expect(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections.items
          .properties
      ).toHaveProperty('title');
      expect(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections.items
          .properties
      ).toHaveProperty('description');
      expect(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections.items
          .properties
      ).toHaveProperty('coreTension');
      expect(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections.items
          .properties
      ).toHaveProperty('uniqueTwist');
      expect(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA.properties.thematicDirections.items
          .properties
      ).toHaveProperty('narrativePotential');
    });

    it('should export EXAMPLE_CHARACTER_CONCEPTS array', () => {
      expect(EXAMPLE_CHARACTER_CONCEPTS).toBeDefined();
      expect(Array.isArray(EXAMPLE_CHARACTER_CONCEPTS)).toBe(true);
      expect(EXAMPLE_CHARACTER_CONCEPTS.length).toBeGreaterThan(0);
      expect(typeof EXAMPLE_CHARACTER_CONCEPTS[0]).toBe('string');
    });
  });

  describe('buildThematicDirectionsPrompt', () => {
    it('should build prompt with valid character concept', () => {
      const concept = 'A brave knight seeking redemption';
      const prompt = buildThematicDirectionsPrompt(concept);

      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain(concept);
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('thematicDirections');
    });

    it('should trim whitespace from character concept', () => {
      const concept = '  A brave knight seeking redemption  ';
      const prompt = buildThematicDirectionsPrompt(concept);

      expect(prompt).toContain('A brave knight seeking redemption');
      expect(prompt).not.toContain('  A brave knight seeking redemption  ');
    });

    it('should throw error if characterConcept is null', () => {
      expect(() => buildThematicDirectionsPrompt(null)).toThrow(
        'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
      );
    });

    it('should throw error if characterConcept is undefined', () => {
      expect(() => buildThematicDirectionsPrompt(undefined)).toThrow(
        'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
      );
    });

    it('should throw error if characterConcept is not a string', () => {
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

    it('should throw error if characterConcept is empty string', () => {
      expect(() => buildThematicDirectionsPrompt('')).toThrow(
        'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
      );
    });

    it('should throw error if characterConcept is only whitespace', () => {
      expect(() => buildThematicDirectionsPrompt('   ')).toThrow(
        'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
      );
      expect(() => buildThematicDirectionsPrompt('\t\n')).toThrow(
        'ThematicDirectionsPrompt: characterConcept must be a non-empty string'
      );
    });
  });

  describe('validateThematicDirectionsResponse', () => {
    let validResponse;

    beforeEach(() => {
      validResponse = {
        thematicDirections: [
          {
            title: 'The Reluctant Hero',
            description:
              'A character who must overcome their deep-seated fears and self-doubt to embrace their destiny as a protector.',
            coreTension: 'Fear of failure versus duty to protect',
            uniqueTwist: 'Their greatest fear becomes their greatest strength',
            narrativePotential:
              'Stories of growth, self-discovery, and the transformation of weakness into power',
          },
          {
            title: 'The Broken Idealist',
            description:
              'Once a beacon of hope and justice, now struggling with the harsh realities that shattered their worldview.',
            coreTension: 'Cynicism versus lingering idealism',
            uniqueTwist: 'Their brokenness makes them more human and relatable',
            narrativePotential:
              'Redemption arcs, moral complexity, and the reconstruction of hope from despair',
          },
          {
            title: 'The Accidental Villain',
            description:
              'A well-intentioned individual whose actions inadvertently cause harm, forcing them to confront unintended consequences.',
            coreTension: 'Good intentions versus harmful outcomes',
            uniqueTwist: 'They become their own worst enemy without realizing it',
            narrativePotential:
              'Exploration of moral ambiguity, the road to hell paved with good intentions',
          },
        ],
      };
    });

    it('should validate a properly structured response', () => {
      expect(validateThematicDirectionsResponse(validResponse)).toBe(true);
    });

    it('should validate response with 5 thematic directions', () => {
      validResponse.thematicDirections.push(
        {
          title: 'The Time-Lost Wanderer',
          description:
            'A character displaced from their own time, struggling to adapt to a world that has moved on without them.',
          coreTension: 'Past identity versus present reality',
          uniqueTwist: 'Their outdated knowledge becomes unexpectedly valuable',
          narrativePotential:
            'Fish out of water stories, cultural clash, and finding belonging across time',
        },
        {
          title: 'The Memory Thief',
          description:
            'Someone who can absorb the memories of others but loses pieces of themselves with each theft.',
          coreTension: 'Gaining knowledge versus losing identity',
          uniqueTwist: 'They remember everyone else life but forget their own',
          narrativePotential:
            'Identity crisis, moral dilemmas about privacy, and the nature of self',
        }
      );
      expect(validateThematicDirectionsResponse(validResponse)).toBe(true);
    });

    it('should throw error if response is null', () => {
      expect(() => validateThematicDirectionsResponse(null)).toThrow(
        'ThematicDirectionsPrompt: Response must be an object'
      );
    });

    it('should throw error if response is undefined', () => {
      expect(() => validateThematicDirectionsResponse(undefined)).toThrow(
        'ThematicDirectionsPrompt: Response must be an object'
      );
    });

    it('should throw error if response is not an object', () => {
      expect(() => validateThematicDirectionsResponse('string')).toThrow(
        'ThematicDirectionsPrompt: Response must be an object'
      );
      expect(() => validateThematicDirectionsResponse(123)).toThrow(
        'ThematicDirectionsPrompt: Response must be an object'
      );
      // Arrays are objects in JavaScript, so this will throw a different error
      expect(() => validateThematicDirectionsResponse([])).toThrow(
        'ThematicDirectionsPrompt: Response must contain thematicDirections array'
      );
    });

    it('should throw error if thematicDirections is missing', () => {
      expect(() => validateThematicDirectionsResponse({})).toThrow(
        'ThematicDirectionsPrompt: Response must contain thematicDirections array'
      );
    });

    it('should throw error if thematicDirections is not an array', () => {
      expect(() =>
        validateThematicDirectionsResponse({
          thematicDirections: 'not an array',
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

    it('should throw error if thematicDirections has less than 3 items', () => {
      validResponse.thematicDirections = validResponse.thematicDirections.slice(
        0,
        2
      );
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        'ThematicDirectionsPrompt: Must contain 3-5 thematic directions'
      );
    });

    it('should throw error if thematicDirections has more than 5 items', () => {
      validResponse.thematicDirections.push(
        ...validResponse.thematicDirections,
        ...validResponse.thematicDirections
      );
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        'ThematicDirectionsPrompt: Must contain 3-5 thematic directions'
      );
    });

    it('should throw error if direction is not an object', () => {
      validResponse.thematicDirections[0] = 'not an object';
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        'ThematicDirectionsPrompt: Direction at index 0 must be an object'
      );
    });

    it('should throw error if direction is null', () => {
      validResponse.thematicDirections[1] = null;
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        'ThematicDirectionsPrompt: Direction at index 1 must be an object'
      );
    });

    it('should throw error if required field is missing', () => {
      delete validResponse.thematicDirections[0].title;
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 0 missing required field 'title'"
      );
    });

    it('should throw error if required field is empty string', () => {
      validResponse.thematicDirections[1].coreTension = '';
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 1 missing required field 'coreTension'"
      );
    });

    it('should throw error if required field is only whitespace', () => {
      validResponse.thematicDirections[2].uniqueTwist = '   ';
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 2 missing required field 'uniqueTwist'"
      );
    });

    it('should throw error if required field is not a string', () => {
      validResponse.thematicDirections[0].description = 123;
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 0 missing required field 'description'"
      );
    });

    it('should throw error if title is too short', () => {
      validResponse.thematicDirections[0].title = 'Hi';
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 0 field 'title' must be between 5 and 100 characters"
      );
    });

    it('should throw error if title is too long', () => {
      validResponse.thematicDirections[0].title = 'A'.repeat(101);
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 0 field 'title' must be between 5 and 100 characters"
      );
    });

    it('should throw error if description is too short', () => {
      validResponse.thematicDirections[1].description = 'Too short';
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 1 field 'description' must be between 50 and 500 characters"
      );
    });

    it('should throw error if description is too long', () => {
      validResponse.thematicDirections[1].description = 'A'.repeat(501);
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 1 field 'description' must be between 50 and 500 characters"
      );
    });

    it('should throw error if coreTension is too short', () => {
      validResponse.thematicDirections[2].coreTension = 'Short';
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 2 field 'coreTension' must be between 20 and 200 characters"
      );
    });

    it('should throw error if narrativePotential is too long', () => {
      validResponse.thematicDirections[0].narrativePotential = 'A'.repeat(301);
      expect(() => validateThematicDirectionsResponse(validResponse)).toThrow(
        "ThematicDirectionsPrompt: Direction at index 0 field 'narrativePotential' must be between 30 and 300 characters"
      );
    });
  });

  describe('createThematicDirectionsLlmConfig', () => {
    let baseLlmConfig;

    beforeEach(() => {
      baseLlmConfig = {
        configId: 'test-config',
        modelIdentifier: 'test-model',
        apiType: 'openrouter',
        defaultParameters: {
          temperature: 0.5,
          max_tokens: 1000,
        },
      };
    });

    it('should create enhanced config with JSON schema', () => {
      const enhancedConfig = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(enhancedConfig).toBeDefined();
      expect(enhancedConfig.configId).toBe('test-config');
      expect(enhancedConfig.jsonOutputStrategy).toBeDefined();
      expect(enhancedConfig.jsonOutputStrategy.method).toBe(
        'openrouter_json_schema'
      );
      expect(enhancedConfig.jsonOutputStrategy.jsonSchema).toBe(
        THEMATIC_DIRECTIONS_RESPONSE_SCHEMA
      );
    });

    it('should merge default parameters', () => {
      const enhancedConfig = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(enhancedConfig.defaultParameters.temperature).toBe(0.7);
      expect(enhancedConfig.defaultParameters.max_tokens).toBe(2000);
    });

    it('should preserve other config properties', () => {
      baseLlmConfig.customProperty = 'custom-value';
      const enhancedConfig = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(enhancedConfig.customProperty).toBe('custom-value');
    });

    it('should throw error if baseLlmConfig is null', () => {
      expect(() => createThematicDirectionsLlmConfig(null)).toThrow(
        'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
      );
    });

    it('should throw error if baseLlmConfig is undefined', () => {
      expect(() => createThematicDirectionsLlmConfig(undefined)).toThrow(
        'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
      );
    });

    it('should throw error if baseLlmConfig is not an object', () => {
      expect(() => createThematicDirectionsLlmConfig('string')).toThrow(
        'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
      );
      expect(() => createThematicDirectionsLlmConfig(123)).toThrow(
        'ThematicDirectionsPrompt: baseLlmConfig must be a valid object'
      );
      // Arrays are objects in JavaScript, so we need to check the actual behavior
      const result = createThematicDirectionsLlmConfig([]);
      expect(result).toBeDefined();
      expect(result.jsonOutputStrategy).toBeDefined();
    });

    it('should handle baseLlmConfig without defaultParameters', () => {
      delete baseLlmConfig.defaultParameters;
      const enhancedConfig = createThematicDirectionsLlmConfig(baseLlmConfig);

      expect(enhancedConfig.defaultParameters).toBeDefined();
      expect(enhancedConfig.defaultParameters.temperature).toBe(0.7);
      expect(enhancedConfig.defaultParameters.max_tokens).toBe(2000);
    });
  });
});