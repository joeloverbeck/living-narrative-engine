/**
 * @file Unit tests for SpeechPatternsSchemaValidator
 *
 * Tests comprehensive validation functions for speech patterns operations:
 * - Schema-based response validation with detailed error reporting
 * - Individual pattern validation
 * - Data sanitization and security measures
 * - Schema compliance validation using AjvSchemaValidator
 * - Content quality validation
 * - XSS prevention and input sanitization
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import SpeechPatternsSchemaValidator from '../../../../src/characterBuilder/validators/SpeechPatternsSchemaValidator.js';

describe('SpeechPatternsSchemaValidator', () => {
  let testBed;
  let validator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create mock schema validator
    mockSchemaValidator = testBed.createMock('AjvSchemaValidator', [
      'validate',
      'isSchemaLoaded',
    ]);

    // Default mock behavior
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);
    mockSchemaValidator.validate.mockReturnValue({
      isValid: true,
      errors: [],
    });

    validator = new SpeechPatternsSchemaValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should create validator with valid dependencies', () => {
      expect(validator).toBeInstanceOf(SpeechPatternsSchemaValidator);
    });

    it('should throw error for missing schema validator', () => {
      expect(() => {
        new SpeechPatternsSchemaValidator({
          schemaValidator: null,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error for missing logger', () => {
      expect(() => {
        new SpeechPatternsSchemaValidator({
          schemaValidator: mockSchemaValidator,
          logger: null,
        });
      }).toThrow();
    });

    it('should throw error for invalid schema validator', () => {
      const invalidValidator = {};

      expect(() => {
        new SpeechPatternsSchemaValidator({
          schemaValidator: invalidValidator,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error for invalid logger', () => {
      const invalidLogger = {};

      expect(() => {
        new SpeechPatternsSchemaValidator({
          schemaValidator: mockSchemaValidator,
          logger: invalidLogger,
        });
      }).toThrow();
    });
  });

  describe('validateResponse', () => {
    let validResponse;

    beforeEach(() => {
      validResponse = {
        characterName: 'Sarah Mitchell',
        speechPatterns: [
          {
            pattern:
              'Uses elaborate metaphors when explaining complex emotions',
            example:
              '"It\'s like... imagine your favorite song being played backwards on a broken record player."',
            circumstances: 'When trying to articulate deep emotional pain',
          },
          {
            pattern:
              'Switches to clipped, military-style speech under pressure',
            example: '"Copy that. Moving to position. ETA two minutes."',
            circumstances:
              'During high-stress situations requiring quick decisions',
          },
          {
            pattern: 'Tends to use technical jargon as emotional armor',
            example: '"I need to recalibrate my approach to this situation."',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };
    });

    it('should validate correct response successfully', async () => {
      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/speech-patterns-response.schema.json',
        validResponse
      );
    });

    it('should handle schema validation failure', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          {
            message: 'minItems',
            instancePath: '/speechPatterns',
          },
        ],
      });

      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Not enough speech patterns generated (minimum 3 required)'
      );
    });

    it('should fall back to basic validation when schema not loaded', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Schema')
      );
    });

    it('should handle validation exceptions', async () => {
      mockSchemaValidator.validate.mockImplementation(() => {
        throw new Error('Schema validation error');
      });

      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(
        'Validation error: Schema validation error'
      );
    });

    it('should validate basic response structure in fallback mode', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const invalidResponse = {
        characterName: '',
        speechPatterns: ['Only one pattern'], // Too few, wrong structure
      };

      const result = await validator.validateResponse(invalidResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate speech patterns array count', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const responseWithTooFewPatterns = {
        ...validResponse,
        speechPatterns: [
          {
            pattern: 'Only one pattern',
            example: '"This is too few"',
          },
        ],
      };

      const result = await validator.validateResponse(
        responseWithTooFewPatterns
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes('At least 3 speech patterns are required')
        )
      ).toBe(true);
    });

    it('should validate individual pattern structure', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const responseWithInvalidPattern = {
        ...validResponse,
        speechPatterns: [
          { pattern: 'Valid pattern', example: '"Valid example"' },
          { pattern: 'Valid pattern 2', example: '"Valid example 2"' },
          { pattern: '', example: '' }, // Invalid pattern
        ],
      };

      const result = await validator.validateResponse(
        responseWithInvalidPattern
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes('pattern description is required')
        )
      ).toBe(true);
    });

    it('should validate character name', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const responseWithInvalidName = {
        speechPatterns: [
          { pattern: 'Pattern 1', example: '"Example 1"' },
          { pattern: 'Pattern 2', example: '"Example 2"' },
          { pattern: 'Pattern 3', example: '"Example 3"' },
        ],
        characterName: '',
      };

      const result = await validator.validateResponse(responseWithInvalidName);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((err) => err.includes('Character name'))).toBe(
        true
      );
    });
  });

  describe('validatePattern', () => {
    it('should validate individual pattern successfully', async () => {
      const validPattern = {
        pattern: 'Uses elaborate metaphors when explaining complex emotions',
        example:
          '"It\'s like... imagine your favorite song being played backwards on a broken record player."',
        circumstances: 'When trying to articulate deep emotional pain',
      };

      const result = await validator.validatePattern(validPattern);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle pattern validation failure', async () => {
      // Mock the validation to return errors that contain pattern-related keywords
      mockSchemaValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: [
          'Pattern at speechPatterns[0] is too short',
          'Example validation failed for pattern',
        ],
      });

      const invalidPattern = {
        pattern: 'Bad', // This is too short
        example: '"Example"',
      };

      const result = await validator.validatePattern(invalidPattern);

      // Should return invalid because the errors contain pattern-related keywords
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should filter errors to pattern-specific ones', async () => {
      // Test that pattern validation filters errors correctly
      mockSchemaValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: [
          'Character name is required',
          'Pattern issue at speechPatterns[0] validation failed',
          'Example validation failed in speechPatterns[0]',
          'GeneratedAt field is missing',
        ],
      });

      const pattern = {
        pattern: 'Test pattern',
        example: '"Test example"',
      };

      const result = await validator.validatePattern(pattern);

      // Should be invalid because there are pattern-related errors after filtering
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0); // Should have pattern-related errors
      expect(
        result.errors.some((err) => err.includes('speechPatterns[0]'))
      ).toBe(true);
      // Should not include non-pattern-specific errors
      expect(result.errors).not.toContain('Character name is required');
      expect(result.errors).not.toContain('GeneratedAt field is missing');
    });
  });

  describe('sanitizeInput', () => {
    it('should return non-string input unchanged', () => {
      expect(validator.sanitizeInput(123)).toBe(123);
      expect(validator.sanitizeInput(null)).toBe(null);
      expect(validator.sanitizeInput(undefined)).toBe(undefined);
      expect(validator.sanitizeInput({})).toEqual({});
      expect(validator.sanitizeInput([])).toEqual([]);
    });

    it('should remove script tags and content', () => {
      const maliciousInput = 'Hello <script>alert("xss")</script> World';
      const sanitized = validator.sanitizeInput(maliciousInput);

      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove iframe tags and content', () => {
      const maliciousInput =
        'Content <iframe src="evil.com"></iframe> more content';
      const sanitized = validator.sanitizeInput(maliciousInput);

      expect(sanitized).toBe('Content more content');
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).not.toContain('evil.com');
    });

    it('should remove javascript: protocol', () => {
      const maliciousInput = 'Click <a href="javascript:alert(1)">here</a>';
      const sanitized = validator.sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const maliciousInput = 'Text <div onclick="badFunction()">content</div>';
      const sanitized = validator.sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('onclick=');
    });

    it('should remove data: URLs', () => {
      const maliciousInput =
        'Image <img src="data:text/html,<script>alert(1)</script>">';
      const sanitized = validator.sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('data:');
    });

    it('should remove vbscript: protocol', () => {
      const maliciousInput = 'Link <a href="vbscript:msgbox(1)">click</a>';
      const sanitized = validator.sanitizeInput(maliciousInput);

      expect(sanitized).not.toContain('vbscript:');
    });

    it('should clean up excessive whitespace', () => {
      const messyInput = 'Too     many   \n\n  spaces\t\tand   tabs';
      const sanitized = validator.sanitizeInput(messyInput);

      expect(sanitized).toBe('Too many spaces and tabs');
    });

    it('should handle complex nested attacks', () => {
      const complexAttack = '<script><script>alert(1)</script></script>';
      const sanitized = validator.sanitizeInput(complexAttack);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should preserve legitimate content', () => {
      const legitimateInput =
        'This is a normal text with emphasis and numbers 123.';
      const sanitized = validator.sanitizeInput(legitimateInput);

      expect(sanitized).toContain('normal text');
      expect(sanitized).toContain('emphasis');
      expect(sanitized).toContain('123');
    });
  });

  describe('validateAndSanitizeResponse', () => {
    let validResponse;

    beforeEach(() => {
      validResponse = {
        characterName: 'Sarah Mitchell',
        speechPatterns: [
          {
            pattern:
              'Uses elaborate metaphors when explaining complex emotions',
            example:
              '"It\'s like... imagine your favorite song being played backwards on a broken record player."',
            circumstances: 'When trying to articulate deep emotional pain',
          },
          {
            pattern:
              'Switches to clipped, military-style speech under pressure',
            example: '"Copy that. Moving to position. ETA two minutes."',
            circumstances:
              'During high-stress situations requiring quick decisions',
          },
          {
            pattern: 'Tends to use technical jargon as emotional armor',
            example: '"I need to recalibrate my approach to this situation."',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };
    });

    it('should validate and sanitize clean response', async () => {
      const result = await validator.validateAndSanitizeResponse(validResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedResponse).toBeDefined();
      expect(result.sanitizedResponse.characterName).toBe('Sarah Mitchell');
    });

    it('should sanitize malicious content in response', async () => {
      const maliciousResponse = {
        ...validResponse,
        characterName: 'Evil<script>alert("xss")</script>Character',
        speechPatterns: [
          {
            pattern: 'Dangerous<script>alert("pattern")</script>pattern',
            example: '"Safe example"',
            circumstances: null,
          },
          {
            pattern: 'Safe pattern',
            example: '"Malicious<iframe src="evil.com"></iframe>example"',
            circumstances: null,
          },
          {
            pattern: 'Another safe pattern',
            example: '"Safe example"',
            circumstances:
              'Safe<script>alert("circumstances")</script>circumstances',
          },
        ],
      };

      const result =
        await validator.validateAndSanitizeResponse(maliciousResponse);

      expect(result.sanitizedResponse.characterName).not.toContain('<script>');
      expect(result.sanitizedResponse.speechPatterns[0].pattern).not.toContain(
        '<script>'
      );
      expect(result.sanitizedResponse.speechPatterns[1].example).not.toContain(
        '<iframe>'
      );
      expect(
        result.sanitizedResponse.speechPatterns[2].circumstances
      ).not.toContain('<script>');
    });

    it('should handle validation failure with sanitization', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ message: 'Validation failed' }],
      });

      const result = await validator.validateAndSanitizeResponse(validResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Sanitized response should now be returned even on validation failure
      expect(result.sanitizedResponse).toBeDefined();
      expect(result.sanitizedResponse.characterName).toBe('Sarah Mitchell');
    });

    it('should handle processing errors gracefully', async () => {
      // Force an error by making sanitization throw
      const originalMethod = validator.sanitizeInput;
      validator.sanitizeInput = () => {
        throw new Error('Sanitization error');
      };

      // Use a response that will trigger sanitization
      const result = await validator.validateAndSanitizeResponse({
        characterName: 'Test Character', // This will trigger sanitizeInput
        speechPatterns: [],
      });

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) => err.includes('Processing error:'))
      ).toBe(true);
      expect(result.sanitizedResponse).toBeNull();

      // Restore original method
      validator.sanitizeInput = originalMethod;
    });
  });

  describe('getSchemaInfo', () => {
    it('should return schema information', () => {
      const info = validator.getSchemaInfo();

      expect(info.schemaId).toBe(
        'schema://living-narrative-engine/speech-patterns-response.schema.json'
      );
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBe(
        'Speech Patterns Response Validation Schema'
      );
      expect(info.minPatterns).toBe(3);
      expect(info.maxPatterns).toBe(30);
      expect(info.validationConfig).toBeDefined();
    });
  });

  describe('Content Quality Validation', () => {
    beforeEach(() => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);
    });

    it('should reject generic pattern descriptions', async () => {
      const responseWithGenericPattern = {
        characterName: 'Test Character',
        speechPatterns: [
          { pattern: 'says things loudly', example: '"Hello there!"' },
          { pattern: 'talks about stuff', example: '"I like things"' },
          { pattern: 'speaks with words', example: '"Words are good"' },
        ],
      };

      const result = await validator.validateResponse(
        responseWithGenericPattern
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes('should be more specific than generic terms')
        )
      ).toBe(true);
    });

    it('should require quoted speech in examples', async () => {
      const responseWithoutQuotes = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses metaphors effectively',
            example: 'Character speaks metaphorically',
          },
          {
            pattern: 'Speaks with authority',
            example: 'Commands with confidence',
          },
          {
            pattern: 'Shows emotional depth',
            example: 'Expresses feelings openly',
          },
        ],
      };

      const result = await validator.validateResponse(responseWithoutQuotes);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes('should contain quoted speech or dialogue')
        )
      ).toBe(true);
    });

    it('should reject placeholder text in examples', async () => {
      const responseWithPlaceholders = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses metaphors effectively',
            example: '"Character says something here"',
          },
          {
            pattern: 'Speaks with authority',
            example: '"They say important things"',
          },
          {
            pattern: 'Shows emotional depth',
            example: '"Example of dialogue"',
          },
        ],
      };

      const result = await validator.validateResponse(responseWithPlaceholders);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes(
            'should contain specific character dialogue, not placeholder text'
          )
        )
      ).toBe(true);
    });

    it('should validate circumstances format', async () => {
      const responseWithBadCircumstances = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses formal speech patterns',
            example: '"Indeed, that would be most appropriate."',
            circumstances: 'Usually does this thing',
          },
          {
            pattern: 'Becomes more casual with friends',
            example: '"Hey, what\'s up?"',
            circumstances: 'Sometimes with people',
          },
          {
            pattern: 'Shows respect to elders',
            example: '"Yes, sir. I understand completely."',
            circumstances: 'Always being respectful',
          },
        ],
      };

      const result = await validator.validateResponse(
        responseWithBadCircumstances
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes(
            'should start with appropriate temporal/conditional words'
          )
        )
      ).toBe(true);
    });

    it('should accept valid circumstances starting with proper words', async () => {
      const responseWithGoodCircumstances = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses formal speech patterns',
            example: '"Indeed, that would be most appropriate."',
            circumstances: 'When addressing authority figures',
          },
          {
            pattern: 'Becomes more casual with friends',
            example: '"Hey, what\'s up?"',
            circumstances: 'During relaxed social situations',
          },
          {
            pattern: 'Shows respect to elders',
            example: '"Yes, sir. I understand completely."',
            circumstances: 'In the presence of respected individuals',
          },
        ],
      };

      const result = await validator.validateResponse(
        responseWithGoodCircumstances
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Error Message Formatting', () => {
    it('should format AJV errors into user-friendly messages', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          {
            message: 'should have minimum items',
            instancePath: '/speechPatterns',
          },
          {
            message: 'should have minimum length',
            instancePath: '/speechPatterns/0/pattern',
          },
          {
            message: 'is a required property',
            instancePath: '/speechPatterns/0/example',
          },
        ],
      });

      const result = await validator.validateResponse({});

      expect(result.isValid).toBe(false);
      // Check that the errors array contains appropriate messages
      expect(
        result.errors.some(
          (err) => err.includes('minimum') || err.includes('Not enough')
        )
      ).toBe(true);
      expect(result.errors.some((err) => err.includes('too short'))).toBe(true);
      expect(result.errors.some((err) => err.includes('required'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null response', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);
      const result = await validator.validateResponse(null);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined response', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);
      const result = await validator.validateResponse(undefined);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty object response', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);
      const result = await validator.validateResponse({});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed speech patterns', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const malformedResponse = {
        characterName: 'Test',
        speechPatterns: 'not an array',
      };

      const result = await validator.validateResponse(malformedResponse);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes('Speech patterns must be an array')
        )
      ).toBe(true);
    });
  });
});
