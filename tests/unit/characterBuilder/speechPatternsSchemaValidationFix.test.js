/**
 * @file Tests for schema validation fixes in SpeechPatternsGenerator
 * @description Verifies the fix for schema validation issues that were causing generation failures.
 * Updated to use new schema format: type/contexts[]/examples[] (v3.0.0)
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
            type: 'Confident Assertive Language',
            examples: [
              '"I know exactly what I\'m doing here."',
              '"Trust me, I\'ve handled situations like this before."',
            ],
          },
          {
            type: 'Vulnerability and Strength Balance',
            contexts: ['When facing emotional challenges'],
            examples: [
              "\"Maybe I'm scared, but that doesn't mean I'll back down.\"",
              '"I admit I\'m nervous, but I won\'t let fear control me."',
            ],
          },
          {
            type: 'Questions with Underlying Assumptions',
            examples: [
              '"You really think that\'s the best approach?"',
              '"Are we sure this is what we want to do?"',
            ],
          },
          {
            type: 'Self-Deprecating Humor as Defense',
            contexts: ['When deflecting criticism', 'During awkward moments'],
            examples: [
              '"Well, I guess I\'m the expert at making mistakes."',
              '"At least I\'m consistent in my incompetence."',
            ],
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
            type: 'Confident Assertive Language',
            examples: [
              '"I know exactly what I\'m doing here."',
              '"Trust me on this one."',
            ],
          },
          {
            type: 'Vulnerability and Strength Balance',
            contexts: ['When facing emotional challenges'],
            examples: [
              "\"Maybe I'm scared, but that doesn't mean I'll back down.\"",
              '"I\'m nervous but determined."',
            ],
          },
          {
            type: 'Questions with Underlying Assumptions',
            examples: [
              '"You really think that\'s the best approach?"',
              '"Is this really what we want?"',
            ],
          },
          {
            type: 'Self-Deprecating Humor as Defense',
            examples: [
              '"Well, I guess I\'m the expert at making mistakes."',
              '"Another brilliant move by me."',
            ],
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
            type: 'Direct Communication Style',
            examples: [
              '"I need this done by tomorrow."',
              '"Let\'s get straight to the point."',
            ],
          },
          {
            type: 'Rhetorical Questions',
            examples: [
              '"Don\'t you think we should consider other options?"',
              '"Isn\'t this exactly what we talked about?"',
            ],
          },
          {
            type: 'Expresses Uncertainty with Qualifiers',
            contexts: ['When unsure of decisions'],
            examples: [
              '"I think maybe we could try a different approach."',
              '"Perhaps we should consider alternatives?"',
            ],
          },
          {
            type: 'Apologetic Tendencies',
            contexts: ['When interrupting', 'After making mistakes'],
            examples: [
              '"Sorry, I didn\'t mean to interrupt."',
              '"My apologies, I should have checked first."',
            ],
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
        pattern.examples.forEach((example) => {
          expect(example).toMatch(/["']/); // Should contain quotes
        });
      });
    });

    it('should reject examples without quoted speech in enhanced validation', async () => {
      // Mock enhanced validation to fail for examples without quotes
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          'Pattern 1: examples should contain quoted speech or dialogue',
        ],
      });

      const invalidResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Direct Communication Style',
            examples: [
              'Uses direct statements without quotes',
              'Speaks plainly without quotation marks',
            ], // Invalid - no quotes
          },
          {
            type: 'Rhetorical Questions',
            examples: [
              'Asks questions indirectly',
              'Poses rhetorical inquiries',
            ], // Invalid - no quotes
          },
          {
            type: 'Expresses Uncertainty',
            examples: [
              'Shows hesitation in speech',
              'Demonstrates uncertainty',
            ], // Invalid - no quotes
          },
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
          'Pattern 1: type description should be more specific than generic terms',
        ],
      });

      const invalidResponse = JSON.stringify({
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Speech',
            examples: ['"Generic example"', '"Another example"'],
          }, // Too generic
          {
            type: 'Talking',
            examples: ['"Example one"', '"Example two"'],
          }, // Too generic
          {
            type: 'Communication',
            examples: ['"Third example"', '"Fourth example"'],
          }, // Too generic
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
            type: 'Direct Communication Style',
            examples: [
              '"I need this done by tomorrow."',
              '"Let\'s be clear about this."',
            ],
          },
          {
            type: 'Rhetorical Questions',
            examples: [
              '"Don\'t you think we should consider other options?"',
              '"Isn\'t this obvious?"',
            ],
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
            type: 'Direct Communication Style',
            examples: [
              '"I need this done by tomorrow."',
              '"Let\'s get to the point."',
            ],
          },
          {
            type: 'Rhetorical Questions',
            examples: [
              '"Don\'t you think we should consider other options?"',
              '"Isn\'t this exactly what we discussed?"',
            ],
          },
          {
            type: 'Expresses Uncertainty with Qualifiers',
            contexts: ['When making difficult decisions'],
            examples: [
              '"I think maybe we could try a different approach."',
              '"Perhaps we should reconsider?"',
            ],
          },
          {
            type: 'Apologetic Tendencies',
            examples: [
              '"Sorry, I didn\'t mean to interrupt."',
              '"My apologies for the confusion."',
            ],
          },
          {
            type: 'Confident Assertions',
            contexts: ['When certain about outcomes'],
            examples: [
              '"I\'m absolutely certain this will work."',
              '"Trust me, I know what I\'m doing."',
            ],
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
          {
            type: 'Test Pattern 1',
            examples: ['"Test example 1"', '"Test example 1b"'],
          },
          {
            type: 'Test Pattern 2',
            examples: ['"Test example 2"', '"Test example 2b"'],
          },
          {
            type: 'Test Pattern 3',
            examples: ['"Test example 3"', '"Test example 3b"'],
          },
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
