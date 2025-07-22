/**
 * @file Unit tests for ThematicDirection model
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import {
  createThematicDirection,
  createThematicDirectionsFromLLMResponse,
  validateThematicDirection,
  serializeThematicDirection,
  deserializeThematicDirection,
  validateThematicDirections,
} from '../../../../src/characterBuilder/models/thematicDirection.js';

describe('ThematicDirection Model', () => {
  let mockSchemaValidator;

  beforeEach(() => {
    // Create a mock schema validator
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    };
  });

  describe('createThematicDirection', () => {
    test('should create thematic direction with valid data', () => {
      const conceptId = 'concept-123';
      const directionData = {
        title: "The Hero's Journey",
        description:
          'A classic heroic arc where the character grows through trials',
        coreTension: 'The conflict between personal desires and duty to others',
        uniqueTwist:
          "The hero's greatest weakness becomes their greatest strength",
        narrativePotential:
          'Epic adventures with moral complexity and character growth',
      };
      const options = {
        llmMetadata: {
          modelId: 'openrouter-claude-sonnet-4',
          promptTokens: 150,
          responseTokens: 300,
          processingTime: 2500,
        },
      };

      const result = createThematicDirection(conceptId, directionData, options);

      expect(result).toMatchObject({
        id: expect.any(String),
        conceptId: 'concept-123',
        title: "The Hero's Journey",
        description:
          'A classic heroic arc where the character grows through trials',
        coreTension: 'The conflict between personal desires and duty to others',
        uniqueTwist:
          "The hero's greatest weakness becomes their greatest strength",
        narrativePotential:
          'Epic adventures with moral complexity and character growth',
        llmMetadata: {
          modelId: 'openrouter-claude-sonnet-4',
          promptTokens: 150,
          responseTokens: 300,
          processingTime: 2500,
        },
        createdAt: expect.any(Date),
      });

      // Verify ID is a valid UUID format
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('should create direction with minimal LLM metadata', () => {
      const conceptId = 'concept-123';
      const directionData = {
        title: 'Simple Direction',
        description: 'A simple thematic direction that is long enough',
        coreTension: 'Simple tension that meets minimum length',
        uniqueTwist: 'Simple twist that meets minimum length',
        narrativePotential: 'Simple potential that meets minimum length',
      };

      const result = createThematicDirection(conceptId, directionData);

      expect(result.llmMetadata).toEqual({});
    });

    test('should throw error if conceptId is missing', () => {
      const directionData = {
        title: 'Test Direction',
        description: 'A test direction with sufficient length for validation',
        coreTension: 'Test tension with sufficient length',
        uniqueTwist: 'Test twist with sufficient length',
        narrativePotential: 'Test potential with sufficient length',
      };

      expect(() => createThematicDirection('', directionData)).toThrow(
        'conceptId must be a non-empty string'
      );
      expect(() => createThematicDirection(null, directionData)).toThrow(
        'conceptId must be a non-empty string'
      );
    });

    test('should throw error if required fields are missing', () => {
      const requiredFields = [
        'title',
        'description',
        'coreTension',
        'uniqueTwist',
        'narrativePotential',
      ];
      const conceptId = 'concept-123';

      requiredFields.forEach((field) => {
        const directionData = {
          title: 'Test Title That Is Long Enough',
          description:
            'Test description that meets the minimum length requirement',
          coreTension: 'Test tension that meets the minimum length',
          uniqueTwist: 'Test twist that meets the minimum length',
          narrativePotential: 'Test potential that meets the minimum length',
        };

        delete directionData[field];

        expect(() => createThematicDirection(conceptId, directionData)).toThrow(
          `${field} must be a non-empty string`
        );
      });
    });

    test('should throw error if fields do not meet length constraints', () => {
      const conceptId = 'concept-123';

      // Test title too short
      expect(() =>
        createThematicDirection(conceptId, {
          title: 'a',
          description:
            'Test description that meets the minimum length requirement',
          coreTension: 'Test tension that meets the minimum length',
          uniqueTwist: 'Test twist that meets the minimum length',
          narrativePotential: 'Test potential that meets the minimum length',
        })
      ).toThrow('title must be between 5 and 200 characters');

      // Test description too short
      expect(() =>
        createThematicDirection(conceptId, {
          title: 'Valid Title',
          description: 'Too short',
          coreTension: 'Test tension that meets the minimum length',
          uniqueTwist: 'Test twist that meets the minimum length',
          narrativePotential: 'Test potential that meets the minimum length',
        })
      ).toThrow('description must be between 20 and 2000 characters');
    });

    test('should sanitize input data', () => {
      const conceptId = '  concept-123  ';
      const directionData = {
        title: "  The Hero's Journey  ",
        description: '  A classic heroic arc with sufficient length  ',
        coreTension: '  Conflict between desires and minimum length  ',
        uniqueTwist: '  Weakness becomes strength with padding  ',
        narrativePotential: '  Epic adventures with sufficient length  ',
      };

      const result = createThematicDirection(conceptId, directionData);

      expect(result.conceptId).toBe('concept-123');
      expect(result.title).toBe("The Hero's Journey");
      expect(result.description).toBe(
        'A classic heroic arc with sufficient length'
      );
      expect(result.coreTension).toBe(
        'Conflict between desires and minimum length'
      );
      expect(result.uniqueTwist).toBe('Weakness becomes strength with padding');
      expect(result.narrativePotential).toBe(
        'Epic adventures with sufficient length'
      );
    });

    test('should generate unique IDs for different directions', () => {
      const conceptId = 'concept-123';
      const directionData1 = {
        title: 'Direction One Title',
        description: 'First direction with sufficient description length',
        coreTension: 'First tension with sufficient length',
        uniqueTwist: 'First twist with sufficient length',
        narrativePotential: 'First potential with sufficient length',
      };

      const directionData2 = {
        title: 'Direction Two Title',
        description: 'Second direction with sufficient description length',
        coreTension: 'Second tension with sufficient length',
        uniqueTwist: 'Second twist with sufficient length',
        narrativePotential: 'Second potential with sufficient length',
      };

      const result1 = createThematicDirection(conceptId, directionData1);
      const result2 = createThematicDirection(conceptId, directionData2);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('createThematicDirectionsFromLLMResponse', () => {
    test('should create multiple directions from LLM response', () => {
      const conceptId = 'concept-123';
      const llmResponse = [
        {
          title: 'The Reluctant Hero',
          description:
            'A character who must overcome their reluctance to face destiny',
          coreTension: 'Desire for normalcy vs. call to adventure',
          uniqueTwist: 'Their reluctance is actually hidden strength',
          narrativePotential: 'Growth through adversity and self-discovery',
        },
        {
          title: 'The Hidden Strategist',
          description:
            'A character whose true intelligence is masked by their demeanor',
          coreTension: 'Appearance vs. reality in social dynamics',
          uniqueTwist: 'Uses misdirection as a tactical advantage',
          narrativePotential: 'Stories of perception and revelation',
        },
      ];

      const llmMetadata = {
        modelId: 'character-builder-claude',
        promptTokens: 150,
        responseTokens: 300,
        processingTime: 2500,
      };

      const result = createThematicDirectionsFromLLMResponse(
        conceptId,
        llmResponse,
        llmMetadata
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        conceptId,
        title: 'The Reluctant Hero',
        description:
          'A character who must overcome their reluctance to face destiny',
        llmMetadata,
      });
      expect(result[1]).toMatchObject({
        id: expect.any(String),
        conceptId,
        title: 'The Hidden Strategist',
        description:
          'A character whose true intelligence is masked by their demeanor',
        llmMetadata,
      });

      // Verify each direction has unique ID
      expect(result[0].id).not.toBe(result[1].id);
    });

    test('should handle empty LLM response', () => {
      const conceptId = 'concept-123';
      const llmResponse = [];
      const llmMetadata = { modelId: 'test-model' };

      expect(() =>
        createThematicDirectionsFromLLMResponse(
          conceptId,
          llmResponse,
          llmMetadata
        )
      ).toThrow('directionsData cannot be empty');
    });

    test('should throw error if conceptId is invalid', () => {
      const llmResponse = [
        {
          title: 'Test Direction',
          description: 'Test description with sufficient length',
          coreTension: 'Test tension with sufficient length',
          uniqueTwist: 'Test twist with sufficient length',
          narrativePotential: 'Test potential with sufficient length',
        },
      ];
      const llmMetadata = { modelId: 'test-model' };

      expect(() =>
        createThematicDirectionsFromLLMResponse('', llmResponse, llmMetadata)
      ).toThrow();
      expect(() =>
        createThematicDirectionsFromLLMResponse(null, llmResponse, llmMetadata)
      ).toThrow();
    });

    test('should throw error if llmResponse is not an array', () => {
      const conceptId = 'concept-123';
      const llmMetadata = { modelId: 'test-model' };

      expect(() =>
        createThematicDirectionsFromLLMResponse(conceptId, null, llmMetadata)
      ).toThrow('directionsData must be an array');
      expect(() =>
        createThematicDirectionsFromLLMResponse(
          conceptId,
          'not-array',
          llmMetadata
        )
      ).toThrow('directionsData must be an array');
    });
  });

  describe('validateThematicDirection', () => {
    test('should return true for valid thematic direction', async () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: "The Hero's Journey",
        description: 'A classic heroic arc',
        coreTension: 'Conflict between desires',
        uniqueTwist: 'Weakness becomes strength',
        narrativePotential: 'Epic adventures',
        llmMetadata: {
          modelId: 'openrouter-claude-sonnet-4',
          promptTokens: 150,
          responseTokens: 300,
          processingTime: 2500,
        },
        createdAt: new Date(),
      };

      const result = await validateThematicDirection(
        direction,
        mockSchemaValidator
      );

      expect(result).toBe(true);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'thematic-direction.schema.json',
        expect.objectContaining({
          id: direction.id,
          conceptId: direction.conceptId,
          title: direction.title,
          createdAt: expect.any(String), // Date converted to ISO string
        })
      );
    });

    test('should throw error for invalid direction', async () => {
      const direction = {
        id: 'invalid-id',
        // Missing required fields
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          { instancePath: '/title', message: 'must be string' },
          { instancePath: '/description', message: 'must be string' },
        ],
      });

      await expect(
        validateThematicDirection(direction, mockSchemaValidator)
      ).rejects.toThrow(
        'ThematicDirection validation failed: /title: must be string, /description: must be string'
      );
    });

    test('should throw error for null or undefined direction', async () => {
      await expect(
        validateThematicDirection(null, mockSchemaValidator)
      ).rejects.toThrow('direction must be a valid object');
      await expect(
        validateThematicDirection(undefined, mockSchemaValidator)
      ).rejects.toThrow('direction must be a valid object');
    });

    test('should throw error if schemaValidator is missing', async () => {
      const direction = { id: 'test' };

      await expect(validateThematicDirection(direction, null)).rejects.toThrow(
        'Missing required dependency: ISchemaValidator'
      );
    });
  });

  describe('serializeThematicDirection', () => {
    test('should serialize direction with Date objects', () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'Test Direction',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      const result = serializeThematicDirection(direction);

      expect(result).toEqual({
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'Test Direction',
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });

    test('should handle direction already serialized', () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'Test Direction',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      const result = serializeThematicDirection(direction);

      expect(result).toEqual(direction);
    });

    test('should throw error for invalid input', () => {
      expect(() => serializeThematicDirection(null)).toThrow(
        'direction must be a valid object'
      );
      expect(() => serializeThematicDirection(undefined)).toThrow(
        'direction must be a valid object'
      );
    });
  });

  describe('deserializeThematicDirection', () => {
    test('should deserialize direction with ISO date strings', () => {
      const data = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'Test Direction',
        createdAt: '2023-01-01T00:00:00.000Z',
      };

      const result = deserializeThematicDirection(data);

      expect(result).toEqual({
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'Test Direction',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
      });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test('should handle direction already deserialized', () => {
      const data = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'Test Direction',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      };

      const result = deserializeThematicDirection(data);

      expect(result).toEqual(data);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test('should throw error for invalid input', () => {
      expect(() => deserializeThematicDirection(null)).toThrow(
        'data must be a valid object'
      );
      expect(() => deserializeThematicDirection(undefined)).toThrow(
        'data must be a valid object'
      );
    });
  });

  describe('validateThematicDirections', () => {
    test('should validate array of directions', async () => {
      const directions = [
        {
          id: '12345678-1234-1234-1234-123456789abc',
          conceptId: 'concept-123',
          title: 'Direction One',
          createdAt: new Date(),
        },
        {
          id: '87654321-4321-4321-4321-123456789abc',
          conceptId: 'concept-123',
          title: 'Direction Two',
          createdAt: new Date(),
        },
      ];

      const result = await validateThematicDirections(
        directions,
        mockSchemaValidator
      );

      expect(result).toBe(true);
      expect(mockSchemaValidator.validate).toHaveBeenCalledTimes(2);
    });

    test('should throw error if any direction is invalid', async () => {
      const directions = [
        {
          id: '12345678-1234-1234-1234-123456789abc',
          conceptId: 'concept-123',
          title: 'Valid Direction',
        },
        {
          id: 'invalid-id',
          // Invalid direction
        },
      ];

      mockSchemaValidator.validate
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({
          isValid: false,
          errors: [{ instancePath: '/title', message: 'must be string' }],
        });

      await expect(
        validateThematicDirections(directions, mockSchemaValidator)
      ).rejects.toThrow('ThematicDirection validation failed at index 1');
    });

    test('should throw error if input is not an array', async () => {
      await expect(
        validateThematicDirections(null, mockSchemaValidator)
      ).rejects.toThrow('directions must be an array');
      await expect(
        validateThematicDirections('not-array', mockSchemaValidator)
      ).rejects.toThrow('directions must be an array');
    });
  });

  describe('edge cases', () => {
    test('should handle unicode characters in text fields', () => {
      const conceptId = 'concept-123';
      const directionData = {
        title: "The Héro's Jöurney 🧙‍♂️",
        description:
          'A classic heroic arc with émojis ⚔️ and sufficient length',
        coreTension: 'Conflict between desires 💭 with sufficient length',
        uniqueTwist: 'Weakness becomes strength 💪 with sufficient length',
        narrativePotential:
          'Epic adventures 🗡️ with sufficient length for validation',
      };

      const result = createThematicDirection(conceptId, directionData);

      expect(result.title).toBe("The Héro's Jöurney 🧙‍♂️");
      expect(result.description).toBe(
        'A classic heroic arc with émojis ⚔️ and sufficient length'
      );
      expect(result.coreTension).toBe(
        'Conflict between desires 💭 with sufficient length'
      );
      expect(result.uniqueTwist).toBe(
        'Weakness becomes strength 💪 with sufficient length'
      );
      expect(result.narrativePotential).toBe(
        'Epic adventures 🗡️ with sufficient length for validation'
      );
    });

    test('should handle HTML-like content safely', () => {
      const conceptId = 'concept-123';
      const directionData = {
        title: "The <strong>Hero</strong>'s Journey",
        description:
          'A classic <em>heroic</em> arc with sufficient length for validation',
        coreTension:
          'Conflict <span>between</span> desires with sufficient length',
        uniqueTwist: 'Weakness <br> becomes strength with sufficient length',
        narrativePotential:
          'Epic <script>alert("test")</script> adventures with length',
      };

      const result = createThematicDirection(conceptId, directionData);

      // Should preserve the content as-is (sanitization should happen at display time)
      expect(result.title).toBe("The <strong>Hero</strong>'s Journey");
      expect(result.description).toBe(
        'A classic <em>heroic</em> arc with sufficient length for validation'
      );
      expect(result.coreTension).toBe(
        'Conflict <span>between</span> desires with sufficient length'
      );
      expect(result.uniqueTwist).toBe(
        'Weakness <br> becomes strength with sufficient length'
      );
      expect(result.narrativePotential).toBe(
        'Epic <script>alert("test")</script> adventures with length'
      );
    });
  });
});
