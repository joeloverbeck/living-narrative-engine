/**
 * @file Unit tests for SpeechPatternsSchemaValidator
 *
 * Tests schema-based validation for speech patterns operations:
 * - Schema-based response validation
 * - Data sanitization and security measures
 * - Schema compliance validation using AjvSchemaValidator
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

    it('should support schema validator proxies that are not plain objects', () => {
      const functionBasedValidator = () => {};

      expect(
        () =>
          new SpeechPatternsSchemaValidator({
            schemaValidator: functionBasedValidator,
            logger: mockLogger,
          })
      ).not.toThrow();
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
              "It's like... imagine your favorite song being played backwards on a broken record player.",
            circumstances: 'When trying to articulate deep emotional pain',
          },
          {
            pattern:
              'Switches to clipped, military-style speech under pressure',
            example: 'Copy that. Moving to position. ETA two minutes.',
            circumstances:
              'During high-stress situations requiring quick decisions',
          },
          {
            pattern: 'Tends to use technical jargon as emotional armor',
            example: 'I need to recalibrate my approach to this situation.',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };
    });

    it('should validate correct response successfully when schema validates', async () => {
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

    it('should return valid when schema not loaded', async () => {
      mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

      const result = await validator.validateResponse(validResponse);

      // Should trust the structure when schema isn't available
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Schema validation unavailable');
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

    it('should handle invalid error payload formats gracefully', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: 'totally invalid',
      });

      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Invalid response format']);
    });

    it('should return user friendly message for unknown error shapes', async () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [{ instancePath: '/speechPatterns/0' }],
      });

      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Unknown validation error']);
    });

    it('should format various schema error types', async () => {
      const errors = [
        { keyword: 'minItems', instancePath: '/speechPatterns' },
        { keyword: 'maxItems', instancePath: '/speechPatterns' },
        { keyword: 'required', params: { missingProperty: 'characterName' } },
        { keyword: 'required', params: {} },
        {
          keyword: 'minLength',
          instancePath: '/characterName',
          message: 'too short',
        },
        {
          message: 'minLength',
        },
        { message: 'Some other error', instancePath: '/example' },
        'String error message',
      ];

      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors,
      });

      const result = await validator.validateResponse(validResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Not enough speech patterns generated (minimum 3 required)'
      );
      expect(result.errors).toContain(
        'Too many speech patterns generated (maximum 30 allowed)'
      );
      expect(result.errors).toContain('Missing required field: characterName');
      expect(result.errors).toContain('Missing required field: unknown');
      expect(
        result.errors.some(
          (e) => e.includes('characterName') && e.includes('too short')
        )
      ).toBe(true);
      expect(result.errors).toContain('field length invalid: minLength');
      expect(result.errors.some((e) => e.includes('/example'))).toBe(true);
      expect(result.errors).toContain('String error message');
    });
  });

  describe('validatePattern', () => {
    it('should validate individual pattern successfully', async () => {
      const validPattern = {
        pattern: 'Uses elaborate metaphors when explaining complex emotions',
        example:
          "It's like... imagine your favorite song being played backwards on a broken record player.",
        circumstances: 'When trying to articulate deep emotional pain',
      };

      const result = await validator.validatePattern(validPattern);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle pattern validation failure', async () => {
      mockSchemaValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: [
          'Pattern at speechPatterns[0] is too short',
          'Example validation failed for pattern',
        ],
      });

      const invalidPattern = {
        pattern: 'Bad',
        example: 'Example',
      };

      const result = await validator.validatePattern(invalidPattern);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should filter errors to pattern-specific ones', async () => {
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
        example: 'Test example',
      };

      const result = await validator.validatePattern(pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((err) => err.includes('speechPatterns[0]'))
      ).toBe(true);
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
              "It's like... imagine your favorite song being played backwards on a broken record player.",
            circumstances: 'When trying to articulate deep emotional pain',
          },
          {
            pattern:
              'Switches to clipped, military-style speech under pressure',
            example: 'Copy that. Moving to position. ETA two minutes.',
            circumstances:
              'During high-stress situations requiring quick decisions',
          },
          {
            pattern: 'Tends to use technical jargon as emotional armor',
            example: 'I need to recalibrate my approach to this situation.',
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
            example: 'Safe example',
            circumstances: null,
          },
          {
            pattern: 'Safe pattern',
            example: 'Malicious<iframe src="evil.com"></iframe>example',
            circumstances: null,
          },
          {
            pattern: 'Another safe pattern',
            example: 'Safe example',
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
      // Should return null when validation fails
      expect(result.sanitizedResponse).toBeNull();
    });

    it('should handle processing errors gracefully', async () => {
      // Force an error by making sanitization throw
      const originalMethod = validator.sanitizeInput;
      validator.sanitizeInput = () => {
        throw new Error('Sanitization error');
      };

      const result = await validator.validateAndSanitizeResponse({
        characterName: 'Test Character',
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

    it('should bypass response sanitization for non-object inputs', async () => {
      const rawResponse = 'unexpected string response';

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.validateAndSanitizeResponse(rawResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedResponse).toBe(rawResponse);
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/speech-patterns-response.schema.json',
        rawResponse
      );
    });

    it('should preserve non-array speech patterns values without mutation', async () => {
      const malformedResponse = {
        characterName: 'Valid Name',
        speechPatterns: 'not-an-array',
      };

      mockSchemaValidator.validate.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await validator.validateAndSanitizeResponse(malformedResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedResponse.speechPatterns).toBe('not-an-array');
      expect(result.sanitizedResponse.generatedAt).toBeUndefined();
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
    });
  });
});
