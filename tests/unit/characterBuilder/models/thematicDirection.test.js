/**
 * @file Unit tests for ThematicDirection model
 */

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { 
  createThematicDirection,
  createThematicDirectionsFromLLMResponse,
  validateThematicDirection,
  ThematicDirectionValidationError 
} from '../../../../src/characterBuilder/models/thematicDirection.js';

describe('ThematicDirection Model', () => {
  describe('createThematicDirection', () => {
    test('should create thematic direction with valid data', () => {
      const directionData = {
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
        description: 'A classic heroic arc where the character grows through trials',
        coreTension: 'The conflict between personal desires and duty to others',
        uniqueTwist: 'The hero\'s greatest weakness becomes their greatest strength',
        narrativePotential: 'Epic adventures with moral complexity and character growth',
        llmMetadata: {
          modelId: 'openrouter-claude-sonnet-4',
          promptTokens: 150,
          responseTokens: 300,
          processingTime: 2500,
        },
      };

      const result = createThematicDirection(directionData);

      expect(result).toMatchObject({
        id: expect.any(String),
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
        description: 'A classic heroic arc where the character grows through trials',
        coreTension: 'The conflict between personal desires and duty to others',
        uniqueTwist: 'The hero\'s greatest weakness becomes their greatest strength',
        narrativePotential: 'Epic adventures with moral complexity and character growth',
        llmMetadata: {
          modelId: 'openrouter-claude-sonnet-4',
          promptTokens: 150,
          responseTokens: 300,
          processingTime: 2500,
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify ID is a valid UUID format
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // Verify timestamps are ISO strings
      expect(() => new Date(result.createdAt)).not.toThrow();
      expect(() => new Date(result.updatedAt)).not.toThrow();
    });

    test('should create direction with minimal LLM metadata', () => {
      const directionData = {
        conceptId: 'concept-123',
        title: 'Simple Direction',
        description: 'A simple thematic direction',
        coreTension: 'Simple tension',
        uniqueTwist: 'Simple twist',
        narrativePotential: 'Simple potential',
        llmMetadata: {
          modelId: 'test-model',
        },
      };

      const result = createThematicDirection(directionData);

      expect(result.llmMetadata).toMatchObject({
        modelId: 'test-model',
        promptTokens: 0,
        responseTokens: 0,
        processingTime: 0,
      });
    });

    test('should throw error if conceptId is missing', () => {
      const directionData = {
        title: 'Test Direction',
        description: 'A test direction',
        coreTension: 'Test tension',
        uniqueTwist: 'Test twist',
        narrativePotential: 'Test potential',
      };

      expect(() => createThematicDirection(directionData)).toThrow(ThematicDirectionValidationError);
      expect(() => createThematicDirection(directionData)).toThrow('conceptId is required');
    });

    test('should throw error if required fields are missing', () => {
      const requiredFields = ['title', 'description', 'coreTension', 'uniqueTwist', 'narrativePotential'];
      
      requiredFields.forEach(field => {
        const directionData = {
          conceptId: 'concept-123',
          title: 'Test Title',
          description: 'Test description',
          coreTension: 'Test tension',
          uniqueTwist: 'Test twist',
          narrativePotential: 'Test potential',
        };
        
        delete directionData[field];

        expect(() => createThematicDirection(directionData)).toThrow(ThematicDirectionValidationError);
        expect(() => createThematicDirection(directionData)).toThrow(`${field} is required`);
      });
    });

    test('should throw error if fields exceed maximum length', () => {
      const directionData = {
        conceptId: 'concept-123',
        title: 'a'.repeat(101), // Exceeds max length
        description: 'Valid description',
        coreTension: 'Valid tension',
        uniqueTwist: 'Valid twist',
        narrativePotential: 'Valid potential',
      };

      expect(() => createThematicDirection(directionData)).toThrow(ThematicDirectionValidationError);
      expect(() => createThematicDirection(directionData)).toThrow('title exceeds maximum length');
    });

    test('should sanitize input data', () => {
      const directionData = {
        conceptId: '  concept-123  ',
        title: '  The Hero\'s Journey  ',
        description: '  A classic heroic arc  ',
        coreTension: '  Conflict between desires  ',
        uniqueTwist: '  Weakness becomes strength  ',
        narrativePotential: '  Epic adventures  ',
      };

      const result = createThematicDirection(directionData);

      expect(result.conceptId).toBe('concept-123');
      expect(result.title).toBe('The Hero\'s Journey');
      expect(result.description).toBe('A classic heroic arc');
      expect(result.coreTension).toBe('Conflict between desires');
      expect(result.uniqueTwist).toBe('Weakness becomes strength');
      expect(result.narrativePotential).toBe('Epic adventures');
    });

    test('should generate unique IDs for different directions', () => {
      const directionData1 = {
        conceptId: 'concept-123',
        title: 'Direction One',
        description: 'First direction',
        coreTension: 'First tension',
        uniqueTwist: 'First twist',
        narrativePotential: 'First potential',
      };

      const directionData2 = {
        conceptId: 'concept-123',
        title: 'Direction Two',
        description: 'Second direction',
        coreTension: 'Second tension',
        uniqueTwist: 'Second twist',
        narrativePotential: 'Second potential',
      };

      const result1 = createThematicDirection(directionData1);
      const result2 = createThematicDirection(directionData2);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('createThematicDirectionsFromLLMResponse', () => {
    test('should create multiple directions from LLM response', () => {
      const conceptId = 'concept-123';
      const llmResponse = [
        {
          title: 'The Reluctant Hero',
          description: 'A character who must overcome their reluctance to face destiny',
          coreTension: 'Desire for normalcy vs. call to adventure',
          uniqueTwist: 'Their reluctance is actually hidden strength',
          narrativePotential: 'Growth through adversity and self-discovery',
        },
        {
          title: 'The Hidden Strategist',
          description: 'A character whose true intelligence is masked by their demeanor',
          coreTension: 'Appearance vs. reality',
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

      const result = createThematicDirectionsFromLLMResponse(conceptId, llmResponse, llmMetadata);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        conceptId,
        title: 'The Reluctant Hero',
        description: 'A character who must overcome their reluctance to face destiny',
        llmMetadata,
      });
      expect(result[1]).toMatchObject({
        id: expect.any(String),
        conceptId,
        title: 'The Hidden Strategist',
        description: 'A character whose true intelligence is masked by their demeanor',
        llmMetadata,
      });

      // Verify each direction has unique ID
      expect(result[0].id).not.toBe(result[1].id);
    });

    test('should handle empty LLM response', () => {
      const conceptId = 'concept-123';
      const llmResponse = [];
      const llmMetadata = { modelId: 'test-model' };

      const result = createThematicDirectionsFromLLMResponse(conceptId, llmResponse, llmMetadata);

      expect(result).toHaveLength(0);
    });

    test('should throw error if conceptId is invalid', () => {
      const llmResponse = [
        {
          title: 'Test Direction',
          description: 'Test description',
          coreTension: 'Test tension',
          uniqueTwist: 'Test twist',
          narrativePotential: 'Test potential',
        },
      ];
      const llmMetadata = { modelId: 'test-model' };

      expect(() => createThematicDirectionsFromLLMResponse('', llmResponse, llmMetadata)).toThrow();
      expect(() => createThematicDirectionsFromLLMResponse(null, llmResponse, llmMetadata)).toThrow();
    });

    test('should throw error if llmResponse is not an array', () => {
      const conceptId = 'concept-123';
      const llmMetadata = { modelId: 'test-model' };

      expect(() => createThematicDirectionsFromLLMResponse(conceptId, null, llmMetadata)).toThrow();
      expect(() => createThematicDirectionsFromLLMResponse(conceptId, 'not-array', llmMetadata)).toThrow();
    });
  });

  describe('validateThematicDirection', () => {
    test('should return true for valid thematic direction', () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateThematicDirection(direction)).toBe(true);
    });

    test('should return false for direction missing required fields', () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
        // Missing description and other required fields
      };

      expect(validateThematicDirection(direction)).toBe(false);
    });

    test('should return false for direction with invalid ID format', () => {
      const direction = {
        id: 'invalid-id',
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
        description: 'A classic heroic arc',
        coreTension: 'Conflict between desires',
        uniqueTwist: 'Weakness becomes strength',
        narrativePotential: 'Epic adventures',
        llmMetadata: { modelId: 'test-model' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateThematicDirection(direction)).toBe(false);
    });

    test('should return false for null or undefined direction', () => {
      expect(validateThematicDirection(null)).toBe(false);
      expect(validateThematicDirection(undefined)).toBe(false);
    });

    test('should return false for direction with invalid LLM metadata', () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'The Hero\'s Journey',
        description: 'A classic heroic arc',
        coreTension: 'Conflict between desires',
        uniqueTwist: 'Weakness becomes strength',
        narrativePotential: 'Epic adventures',
        llmMetadata: null, // Invalid metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateThematicDirection(direction)).toBe(false);
    });

    test('should return false for direction with field length violations', () => {
      const direction = {
        id: '12345678-1234-1234-1234-123456789abc',
        conceptId: 'concept-123',
        title: 'a'.repeat(101), // Exceeds max length
        description: 'A classic heroic arc',
        coreTension: 'Conflict between desires',
        uniqueTwist: 'Weakness becomes strength',
        narrativePotential: 'Epic adventures',
        llmMetadata: { modelId: 'test-model' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validateThematicDirection(direction)).toBe(false);
    });
  });

  describe('ThematicDirectionValidationError', () => {
    test('should create error with message', () => {
      const error = new ThematicDirectionValidationError('Test validation error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ThematicDirectionValidationError);
      expect(error.message).toBe('Test validation error');
      expect(error.name).toBe('ThematicDirectionValidationError');
    });

    test('should create error with cause', () => {
      const cause = new Error('Root cause');
      const error = new ThematicDirectionValidationError('Test validation error', cause);

      expect(error.message).toBe('Test validation error');
      expect(error.cause).toBe(cause);
    });
  });

  describe('edge cases', () => {
    test('should handle unicode characters in text fields', () => {
      const directionData = {
        conceptId: 'concept-123',
        title: 'The Héro\'s Jöurney 🧙‍♂️',
        description: 'A classic heroic arc with émojis ⚔️',
        coreTension: 'Conflict between desires 💭',
        uniqueTwist: 'Weakness becomes strength 💪',
        narrativePotential: 'Epic adventures 🗡️',
      };

      const result = createThematicDirection(directionData);

      expect(result.title).toBe('The Héro\'s Jöurney 🧙‍♂️');
      expect(result.description).toBe('A classic heroic arc with émojis ⚔️');
      expect(result.coreTension).toBe('Conflict between desires 💭');
      expect(result.uniqueTwist).toBe('Weakness becomes strength 💪');
      expect(result.narrativePotential).toBe('Epic adventures 🗡️');
    });

    test('should handle LLM metadata with missing optional fields', () => {
      const directionData = {
        conceptId: 'concept-123',
        title: 'Test Direction',
        description: 'Test description',
        coreTension: 'Test tension',
        uniqueTwist: 'Test twist',
        narrativePotential: 'Test potential',
        llmMetadata: {
          modelId: 'test-model',
          // Missing promptTokens, responseTokens, processingTime
        },
      };

      const result = createThematicDirection(directionData);

      expect(result.llmMetadata).toMatchObject({
        modelId: 'test-model',
        promptTokens: 0,
        responseTokens: 0,
        processingTime: 0,
      });
    });

    test('should handle directions with HTML-like content safely', () => {
      const directionData = {
        conceptId: 'concept-123',
        title: 'The <strong>Hero</strong>\'s Journey',
        description: 'A classic <em>heroic</em> arc',
        coreTension: 'Conflict <span>between</span> desires',
        uniqueTwist: 'Weakness <br> becomes strength',
        narrativePotential: 'Epic <script>alert("test")</script> adventures',
      };

      const result = createThematicDirection(directionData);

      // Should preserve the content as-is (sanitization should happen at display time)
      expect(result.title).toBe('The <strong>Hero</strong>\'s Journey');
      expect(result.description).toBe('A classic <em>heroic</em> arc');
      expect(result.coreTension).toBe('Conflict <span>between</span> desires');
      expect(result.uniqueTwist).toBe('Weakness <br> becomes strength');
      expect(result.narrativePotential).toBe('Epic <script>alert("test")</script> adventures');
    });
  });
});