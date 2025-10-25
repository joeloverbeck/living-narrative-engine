/**
 * @file Unit tests for TraitsRewriterResponseProcessor
 * @see ../../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { TraitsRewriterResponseProcessor } from '../../../../src/characterBuilder/services/TraitsRewriterResponseProcessor.js';
import {
  TraitsRewriterError,
  TRAITS_REWRITER_ERROR_CODES,
} from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';

describe('TraitsRewriterResponseProcessor', () => {
  let testBed;
  let processor;
  let mockLogger;
  let mockLlmJsonService;
  let mockSchemaValidator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockLlmJsonService = testBed.createMock('LlmJsonService', [
      'clean',
      'parseAndRepair',
    ]);
    mockSchemaValidator = testBed.createMock('ISchemaValidator', [
      'validateAgainstSchema',
    ]);

    processor = new TraitsRewriterResponseProcessor({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor Validation', () => {
    it('should validate all required dependencies', () => {
      expect(processor).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TraitsRewriterResponseProcessor initialized successfully'
      );
    });

    it('should throw error for missing logger dependency', () => {
      expect(() => {
        new TraitsRewriterResponseProcessor({
          llmJsonService: mockLlmJsonService,
        });
      }).toThrow();
    });

    it('should throw error for missing llmJsonService dependency', () => {
      expect(() => {
        new TraitsRewriterResponseProcessor({
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should work without optional schemaValidator', () => {
      const processorWithoutValidator = new TraitsRewriterResponseProcessor({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
      });
      expect(processorWithoutValidator).toBeDefined();
    });
  });

  describe('processResponse', () => {
    const validResponse = {
      characterName: 'Test Character',
      rewrittenTraits: {
        'core:personality': 'I am analytical and methodical in my approach.',
        'core:likes': 'I enjoy reading books and solving complex puzzles.',
      },
      generatedAt: '2024-01-15T10:30:00Z',
    };

    const mockCharacterData = {
      'core:name': { text: 'Test Character' },
      'core:personality': { text: 'Analytical and methodical person.' },
      'core:likes': { text: 'Enjoys reading and puzzles.' },
    };

    beforeEach(() => {
      mockLlmJsonService.parseAndRepair.mockResolvedValue(validResponse);
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
        errors: [],
      });
    });

    it('should process valid response successfully', async () => {
      const result = await processor.processResponse(
        JSON.stringify(validResponse),
        mockCharacterData
      );

      expect(result).toEqual({
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am analytical and methodical in my approach.',
          'core:likes': 'I enjoy reading books and solving complex puzzles.',
        },
        generatedAt: '2024-01-15T10:30:00Z',
      });

      expect(mockLlmJsonService.parseAndRepair).toHaveBeenCalledWith(
        JSON.stringify(validResponse),
        { logger: mockLogger }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully processed traits rewriter response',
        expect.objectContaining({
          characterName: 'Test Character',
          traitsCount: 2,
        })
      );
    });

    it('should throw error for invalid rawResponse parameter', async () => {
      await expect(
        processor.processResponse('', mockCharacterData)
      ).rejects.toThrow();

      await expect(
        processor.processResponse(null, mockCharacterData)
      ).rejects.toThrow();
    });

    it('should throw error for missing originalCharacterData', async () => {
      await expect(
        processor.processResponse(JSON.stringify(validResponse), null)
      ).rejects.toThrow(TraitsRewriterError);

      await expect(
        processor.processResponse(JSON.stringify(validResponse), undefined)
      ).rejects.toThrow(TraitsRewriterError);
    });

    it('should handle JSON parsing failures', async () => {
      const malformedJson = '{"characterName": "Test", "rewritten';
      mockLlmJsonService.parseAndRepair.mockRejectedValue(
        new Error('Invalid JSON')
      );

      await expect(
        processor.processResponse(malformedJson, mockCharacterData)
      ).rejects.toThrow(TraitsRewriterError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse LLM response as JSON',
        expect.objectContaining({
          error: 'Invalid JSON',
          rawResponseLength: malformedJson.length,
        })
      );
    });

    it('should handle schema validation failures', async () => {
      const invalidResponse = { name: 'Test' }; // Wrong structure
      mockLlmJsonService.parseAndRepair.mockResolvedValue(invalidResponse);
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: false,
        errors: ['Missing required field: characterName'],
      });

      await expect(
        processor.processResponse(
          JSON.stringify(invalidResponse),
          mockCharacterData
        )
      ).rejects.toThrow(TraitsRewriterError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Response failed schema validation',
        expect.objectContaining({
          errors: ['Missing required field: characterName'],
        })
      );
    });

    it('should wrap unexpected schema validator errors', async () => {
      const validResponseJson = JSON.stringify(validResponse);
      const validatorFailure = new Error('validator blew up');
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw validatorFailure;
      });

      await expect(
        processor.processResponse(validResponseJson, mockCharacterData)
      ).rejects.toBeInstanceOf(TraitsRewriterError);

      const errorCall = mockLogger.error.mock.calls.find(
        ([message]) => message === 'Schema validation process failed'
      );

      expect(errorCall?.[1]).toEqual(
        expect.objectContaining({
          error: 'validator blew up',
          characterName: 'Test Character',
        })
      );
    });

    it('should skip schema validation when validator not available', async () => {
      const processorWithoutValidator = new TraitsRewriterResponseProcessor({
        logger: mockLogger,
        llmJsonService: mockLlmJsonService,
      });

      const result = await processorWithoutValidator.processResponse(
        JSON.stringify(validResponse),
        mockCharacterData
      );

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Schema validator not available, skipping validation'
      );
    });

    it('should handle missing traits error', async () => {
      const responseWithoutTraits = {
        characterName: 'Test Character',
        rewrittenTraits: {},
      };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        responseWithoutTraits
      );

      await expect(
        processor.processResponse(
          JSON.stringify(responseWithoutTraits),
          mockCharacterData
        )
      ).rejects.toThrow(TraitsRewriterError);
    });

    it('should handle partial responses with warnings', async () => {
      const partialResponse = {
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am analytical.',
          // Missing 'core:likes'
        },
      };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(partialResponse);

      const result = await processor.processResponse(
        JSON.stringify(partialResponse),
        mockCharacterData
      );

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Some traits are missing from response',
        expect.objectContaining({
          missingTraits: ['core:likes'],
          characterName: 'Test Character',
        })
      );
    });

    it('should warn for empty trait content without failing quality threshold', async () => {
      const responseWithEmptyTrait = {
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': '   ',
          'core:likes': 'Detailed likes description',
        },
      };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(responseWithEmptyTrait);

      const result = await processor.processResponse(
        JSON.stringify(responseWithEmptyTrait),
        mockCharacterData
      );

      expect(result.rewrittenTraits['core:personality']).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Some traits are empty in response',
        expect.objectContaining({
          emptyTraits: ['core:personality'],
          characterName: 'Test Character',
        })
      );
    });

    it('should throw quality failure when most traits are missing or empty', async () => {
      const poorQualityResponse = {
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': '',
        },
      };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(poorQualityResponse);

      try {
        await processor.processResponse(
          JSON.stringify(poorQualityResponse),
          mockCharacterData
        );
        throw new Error('Expected quality failure error');
      } catch (error) {
        expect(error).toBeInstanceOf(TraitsRewriterError);
        expect(error.context).toEqual(
          expect.objectContaining({
            errorCode: TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED,
          })
        );
        expect(error.context.missingTraits).toEqual([
          'core:likes',
          'core:personality',
        ]);
        expect(error.context.emptyTraits).toEqual([]);
      }
    });

    it('should sanitize HTML content in traits', async () => {
      const responseWithHtml = {
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality':
            '<script>alert("xss")</script>I am analytical & methodical.',
        },
      };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(responseWithHtml);

      const result = await processor.processResponse(
        JSON.stringify(responseWithHtml),
        mockCharacterData
      );

      expect(result.rewrittenTraits['core:personality']).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;I am analytical &amp; methodical.'
      );
    });

    it('should preserve non-string trait values during sanitization', async () => {
      const responseWithArrayTrait = {
        characterName: 'Test Character',
        rewrittenTraits: {
          'core:personality': 'I am analytical.',
          'core:likes': 'I enjoy solving puzzles.',
          'core:goals': ['Win every tournament'],
        },
      };
      mockLlmJsonService.parseAndRepair.mockResolvedValue(responseWithArrayTrait);

      const result = await processor.processResponse(
        JSON.stringify(responseWithArrayTrait),
        mockCharacterData
      );

      expect(result.rewrittenTraits['core:goals']).toEqual([
        'Win every tournament',
      ]);
    });

    it('should extract character name from different formats', async () => {
      const characterDataWithName = {
        'core:name': { name: 'Character Name' }, // Different format
        'core:personality': { text: 'Test personality' },
      };

      const result = await processor.processResponse(
        JSON.stringify(validResponse),
        characterDataWithName
      );

      expect(result).toBeDefined();
    });

    it('should handle unexpected processing errors', async () => {
      mockLlmJsonService.parseAndRepair.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(
        processor.processResponse(
          JSON.stringify(validResponse),
          mockCharacterData
        )
      ).rejects.toThrow(TraitsRewriterError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse LLM response as JSON',
        expect.objectContaining({
          error: 'Unexpected error',
        })
      );
    });

    it('should wrap unexpected errors from downstream logging', async () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logging failure');
      });

      try {
        await processor.processResponse(
          JSON.stringify(validResponse),
          mockCharacterData
        );
        throw new Error('Expected generation failure error');
      } catch (error) {
        expect(error).toBeInstanceOf(TraitsRewriterError);
        expect(error.context).toEqual(
          expect.objectContaining({
            errorCode: TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
          })
        );
      }

      const unexpectedErrorLog = mockLogger.error.mock.calls.find(
        ([message]) =>
          message === 'Unexpected error during traits rewriter processing'
      );

      expect(unexpectedErrorLog?.[1]).toEqual(
        expect.objectContaining({
          error: 'Logging failure',
          context: expect.objectContaining({
            stage: 'processResponse',
          }),
        })
      );
    });
  });

  describe('validateStructure', () => {
    it('should validate valid traits structure', () => {
      const validTraits = {
        'core:personality': 'I am confident and outgoing.',
        'core:likes': 'I enjoy outdoor activities.',
      };

      const result = processor.validateStructure(validTraits);

      expect(result).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('should reject null or undefined traits', () => {
      let result = processor.validateStructure(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Traits must be a valid object');

      result = processor.validateStructure(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Traits must be a valid object');
    });

    it('should reject non-string trait values', () => {
      const invalidTraits = {
        'core:personality': 123,
        'core:likes': null,
      };

      const result = processor.validateStructure(invalidTraits);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Trait core:personality must be a string'
      );
      expect(result.errors).toContain('Trait core:likes must be a string');
    });

    it('should reject empty trait values', () => {
      const emptyTraits = {
        'core:personality': '',
        'core:likes': '   ', // Only whitespace
      };

      const result = processor.validateStructure(emptyTraits);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Trait core:personality cannot be empty');
      expect(result.errors).toContain('Trait core:likes cannot be empty');
    });
  });

  describe('cleanResponse', () => {
    it('should delegate to llmJsonService.clean', () => {
      const rawResponse = '```json\n{"test": "data"}\n```';
      const cleanedResponse = '{"test": "data"}';

      mockLlmJsonService.clean.mockReturnValue(cleanedResponse);

      const result = processor.cleanResponse(rawResponse);

      expect(result).toBe(cleanedResponse);
      expect(mockLlmJsonService.clean).toHaveBeenCalledWith(rawResponse);
    });

    it('should throw error for invalid input', () => {
      expect(() => {
        processor.cleanResponse('');
      }).toThrow();

      expect(() => {
        processor.cleanResponse(null);
      }).toThrow();
    });
  });

  describe('getServiceInfo', () => {
    it('should return service metadata', () => {
      const info = processor.getServiceInfo();

      expect(info).toEqual({
        name: 'TraitsRewriterResponseProcessor',
        version: '1.0.0',
        status: 'active',
        features: [
          'JSON parsing with repair',
          'Schema validation',
          'Content sanitization',
          'Error recovery',
          'Trait completeness verification',
        ],
      });
    });
  });

  describe('Error Handling', () => {
    it('should preserve TraitsRewriterError context', async () => {
      const originalError = TraitsRewriterError.forParsingFailure(
        'Original parsing error',
        { originalContext: 'test' }
      );

      mockLlmJsonService.parseAndRepair.mockRejectedValue(originalError);

      try {
        await processor.processResponse('{"invalid": json}', {
          'core:name': { text: 'Test' },
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TraitsRewriterError);
        expect(error.context).toMatchObject({
          characterName: 'Test',
          rawResponseLength: expect.any(Number),
        });
      }
    });

    it('should wrap non-TraitsRewriterError exceptions', async () => {
      const genericError = new Error('Generic processing error');
      mockLlmJsonService.parseAndRepair.mockRejectedValue(genericError);

      try {
        await processor.processResponse('{"test": "data"}', {
          'core:name': { text: 'Test' },
        });
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TraitsRewriterError);
        expect(error.message).toContain(
          'Could not parse LLM response as valid JSON'
        );
        expect(error.context.characterName).toBe('Test');
      }
    });
  });

  describe('HTML Sanitization', () => {
    it('should escape all HTML entities', () => {
      const testData = {
        characterName: 'Test',
        rewrittenTraits: {
          'core:test':
            '<script>alert("xss")</script> & "quotes" \' apostrophe / slash',
        },
      };

      mockLlmJsonService.parseAndRepair.mockResolvedValue(testData);
      mockSchemaValidator.validateAgainstSchema.mockReturnValue({
        isValid: true,
      });

      return processor
        .processResponse(JSON.stringify(testData), {
          'core:name': { text: 'Test' },
          'core:test': { text: 'original' },
        })
        .then((result) => {
          const sanitized = result.rewrittenTraits['core:test'];
          expect(sanitized).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt; &amp; &quot;quotes&quot; &#x27; apostrophe &#x2F; slash'
          );
        });
    });
  });
});
