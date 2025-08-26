/**
 * @file Tests for schema validation fixes in SpeechPatternsGenerator
 * @description Verifies the fix for schema validation issues that were causing generation failures
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SpeechPatternsResponseProcessor } from '../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js';

describe('SpeechPatternsResponseProcessor - Schema Validation Fix', () => {
  let processor;
  let mockLogger;
  let mockLlmJsonService;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmJsonService = {
      clean: jest.fn().mockImplementation((input) => input),
      parseAndRepair: jest
        .fn()
        .mockImplementation((input) => JSON.parse(input)),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({ isValid: true }),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

    processor = new SpeechPatternsResponseProcessor({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      schemaValidator: mockSchemaValidator,
    });
  });

  describe('Schema Loading Issues', () => {
    it('should handle missing schema gracefully with fallback validation', async () => {
      // Simulate schema not being loaded
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const validResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses confident assertive language',
            example: '"I know exactly what I\'m doing here."',
          },
          {
            pattern: 'Shifts between vulnerability and strength',
            example:
              "\"Maybe I'm scared, but that doesn't mean I'll back down.\"",
          },
          {
            pattern: 'Questions with underlying assumptions',
            example: '"You really think that\'s the best approach?"',
          },
          {
            pattern: 'Self-deprecating humor as defense',
            example: '"Well, I guess I\'m the expert at making mistakes."',
          },
        ],
      });

      const result = await processor.processResponse(validResponse, {
        characterName: 'Test Character',
      });

      expect(result).toBeDefined();
      expect(result.characterName).toBe('Test Character');
      expect(result.speechPatterns).toHaveLength(4);

      // Should log warning about schema fallback
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not loaded, validation will be limited')
      );
    });

    it('should use full schema validation when schema is loaded', async () => {
      // Schema is loaded (default mock behavior)
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

      const validResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses confident assertive language',
            example: '"I know exactly what I\'m doing here."',
          },
          {
            pattern: 'Shifts between vulnerability and strength',
            example:
              "\"Maybe I'm scared, but that doesn't mean I'll back down.\"",
          },
          {
            pattern: 'Questions with underlying assumptions',
            example: '"You really think that\'s the best approach?"',
          },
          {
            pattern: 'Self-deprecating humor as defense',
            example: '"Well, I guess I\'m the expert at making mistakes."',
          },
        ],
      });

      const result = await processor.processResponse(validResponse, {
        characterName: 'Test Character',
      });

      expect(result).toBeDefined();
      expect(result.characterName).toBe('Test Character');
      expect(result.speechPatterns).toHaveLength(4);

      // Should NOT log warning about schema fallback
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('not loaded, validation will be limited')
      );
    });
  });

  describe('Enhanced Validation Issues', () => {
    it('should accept examples with quoted speech', async () => {
      // Mock enhanced validation to pass for examples with quotes
      const validResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Direct communication style',
            example: '"I need this done by tomorrow."',
          },
          {
            pattern: 'Uses rhetorical questions',
            example: '"Don\'t you think we should consider other options?"',
          },
          {
            pattern: 'Expresses uncertainty with qualifiers',
            example: '"I think maybe we could try a different approach."',
          },
          {
            pattern: 'Apologetic tendencies',
            example: '"Sorry, I didn\'t mean to interrupt."',
          },
        ],
      });

      const result = await processor.processResponse(validResponse, {
        characterName: 'Test Character',
      });

      expect(result).toBeDefined();
      expect(result.speechPatterns).toHaveLength(4);

      // All examples should have quoted speech
      result.speechPatterns.forEach((pattern) => {
        expect(pattern.example).toMatch(/["']/); // Should contain quotes
      });
    });

    it('should reject examples without quoted speech in enhanced validation', async () => {
      // Mock enhanced validation to fail for examples without quotes
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Pattern 1: example should contain quoted speech or dialogue'],
      });

      const invalidResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Direct communication style',
            example: 'Uses direct statements without quotes',
          }, // Invalid - no quotes
          {
            pattern: 'Uses rhetorical questions',
            example: 'Asks questions indirectly',
          }, // Invalid - no quotes
          {
            pattern: 'Expresses uncertainty',
            example: 'Shows hesitation in speech',
          }, // Invalid - no quotes
        ],
      });

      await expect(
        processor.processResponse(invalidResponse, {
          characterName: 'Test Character',
        })
      ).rejects.toThrow(/Enhanced validation failed/);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Enhanced schema validation error',
        expect.any(Error)
      );
    });

    it('should require specific pattern descriptions not generic terms', async () => {
      // Mock validation to fail for generic pattern descriptions
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          'Pattern 1: pattern description should be more specific than generic terms',
        ],
      });

      const invalidResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          { pattern: 'Speech pattern', example: '"Generic example"' }, // Too generic
          { pattern: 'Talking style', example: '"Another example"' }, // Too generic
          { pattern: 'Communication', example: '"Third example"' }, // Too generic
        ],
      });

      await expect(
        processor.processResponse(invalidResponse, {
          characterName: 'Test Character',
        })
      ).rejects.toThrow(/Enhanced validation failed/);
    });
  });

  describe('Minimum Pattern Requirements', () => {
    it('should reject responses with insufficient patterns', async () => {
      const insufficientResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Direct communication style',
            example: '"I need this done by tomorrow."',
          },
          {
            pattern: 'Uses rhetorical questions',
            example: '"Don\'t you think we should consider other options?"',
          },
        ], // Only 2 patterns, need at least 3
      });

      await expect(
        processor.processResponse(insufficientResponse, {
          characterName: 'Test Character',
        })
      ).rejects.toThrow(/At least 3 speech patterns are required/);
    });

    it('should accept responses with sufficient patterns', async () => {
      const sufficientResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Direct communication style',
            example: '"I need this done by tomorrow."',
          },
          {
            pattern: 'Uses rhetorical questions',
            example: '"Don\'t you think we should consider other options?"',
          },
          {
            pattern: 'Expresses uncertainty with qualifiers',
            example: '"I think maybe we could try a different approach."',
          },
          {
            pattern: 'Apologetic tendencies',
            example: '"Sorry, I didn\'t mean to interrupt."',
          },
          {
            pattern: 'Confident assertions',
            example: '"I\'m absolutely certain this will work."',
          },
        ],
      });

      const result = await processor.processResponse(sufficientResponse, {
        characterName: 'Test Character',
      });

      expect(result).toBeDefined();
      expect(result.speechPatterns).toHaveLength(5);
    });
  });

  describe('JSON Parsing Error Handling', () => {
    it('should handle malformed JSON responses gracefully', async () => {
      const malformedResponse = '{"characterName": "Test", "speechPatterns": ['; // Incomplete JSON

      await expect(
        processor.processResponse(malformedResponse, {
          characterName: 'Test Character',
        })
      ).rejects.toThrow();

      // Should log the parsing error
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should clean and repair JSON before parsing', async () => {
      // Mock JSON service to fix malformed JSON
      mockLlmJsonService.clean.mockReturnValue('{"fixed": "json"}');
      mockLlmJsonService.parseAndRepair.mockReturnValue({
        characterName: 'Test Character',
        speechPatterns: [
          { pattern: 'Test pattern 1', example: '"Test example 1"' },
          { pattern: 'Test pattern 2', example: '"Test example 2"' },
          { pattern: 'Test pattern 3', example: '"Test example 3"' },
        ],
      });

      const messyResponse =
        ' { "characterName" : "Test Character" , speechPatterns : [ } '; // Messy JSON

      const result = await processor.processResponse(messyResponse, {
        characterName: 'Test Character',
      });

      expect(mockLlmJsonService.clean).toHaveBeenCalledWith(messyResponse);
      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.characterName).toBe('Test Character');
    });
  });
});
