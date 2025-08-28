/**
 * @file Unit tests for TraitsRewriterError class
 * @see ../../../../src/characterBuilder/errors/TraitsRewriterError.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  TraitsRewriterError,
  TRAITS_REWRITER_ERROR_CODES,
} from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';
import { CharacterBuilderError } from '../../../../src/characterBuilder/errors/characterBuilderError.js';

describe('TraitsRewriterError', () => {
  describe('Constructor', () => {
    it('should create error with message only', () => {
      const message = 'Test error message';
      const error = new TraitsRewriterError(message);

      expect(error.message).toBe(message);
      expect(error.name).toBe('TraitsRewriterError');
      expect(error.context).toEqual({});
      expect(error.cause).toBeNull();
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with message and context', () => {
      const message = 'Test error message';
      const context = { characterName: 'TestChar', stage: 'validation' };
      const error = new TraitsRewriterError(message, context);

      expect(error.message).toBe(message);
      expect(error.context).toEqual(context);
      expect(error.cause).toBeNull();
    });

    it('should create error with message, context, and cause', () => {
      const message = 'Test error message';
      const context = { characterName: 'TestChar' };
      const cause = new Error('Original error');
      const error = new TraitsRewriterError(message, context, cause);

      expect(error.message).toBe(message);
      expect(error.context).toEqual(context);
      expect(error.cause).toBe(cause);
    });

    it('should set name to TraitsRewriterError', () => {
      const error = new TraitsRewriterError('Test message');
      expect(error.name).toBe('TraitsRewriterError');
    });

    it('should maintain proper stack trace', () => {
      const error = new TraitsRewriterError('Test message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TraitsRewriterError');
    });

    it('should handle empty context gracefully', () => {
      const error = new TraitsRewriterError('Test message', {});
      expect(error.context).toEqual({});
    });

    it('should handle undefined context', () => {
      const error = new TraitsRewriterError('Test message', undefined);
      expect(error.context).toEqual({});
    });

    it('should handle null cause', () => {
      const error = new TraitsRewriterError('Test message', {}, null);
      expect(error.cause).toBeNull();
    });
  });

  describe('Error Codes', () => {
    it('should have all 7 existing error codes defined', () => {
      expect(TRAITS_REWRITER_ERROR_CODES).toBeDefined();
      expect(Object.keys(TRAITS_REWRITER_ERROR_CODES)).toHaveLength(7);
    });

    it('should have INVALID_CHARACTER_DEFINITION code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION).toBe(
        'INVALID_CHARACTER_DEFINITION'
      );
    });

    it('should have GENERATION_FAILED code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED).toBe('GENERATION_FAILED');
    });

    it('should have VALIDATION_FAILED code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    });

    it('should have MISSING_TRAITS code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.MISSING_TRAITS).toBe('MISSING_TRAITS');
    });

    it('should have EXPORT_FAILED code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.EXPORT_FAILED).toBe('EXPORT_FAILED');
    });

    it('should have INVALID_FORMAT code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.INVALID_FORMAT).toBe('INVALID_FORMAT');
    });

    it('should have CONTENT_SANITIZATION_FAILED code', () => {
      expect(TRAITS_REWRITER_ERROR_CODES.CONTENT_SANITIZATION_FAILED).toBe(
        'CONTENT_SANITIZATION_FAILED'
      );
    });

    it('should have unique error code values', () => {
      const codes = Object.values(TRAITS_REWRITER_ERROR_CODES);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('Static Factory Methods', () => {
    describe('forInvalidCharacterDefinition', () => {
      it('should create error with proper message and context', () => {
        const reason = 'Missing required fields';
        const context = { characterName: 'TestChar' };
        const error = TraitsRewriterError.forInvalidCharacterDefinition(reason, context);

        expect(error).toBeInstanceOf(TraitsRewriterError);
        expect(error.message).toBe(`Invalid character definition: ${reason}`);
        expect(error.context.errorCode).toBe(
          TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION
        );
        expect(error.context.stage).toBe('validation');
        expect(error.context.characterName).toBe('TestChar');
      });

      it('should work without additional context', () => {
        const reason = 'Missing required fields';
        const error = TraitsRewriterError.forInvalidCharacterDefinition(reason);

        expect(error.context.errorCode).toBe(
          TRAITS_REWRITER_ERROR_CODES.INVALID_CHARACTER_DEFINITION
        );
        expect(error.context.stage).toBe('validation');
      });
    });

    describe('forGenerationFailure', () => {
      it('should create error with proper message and context', () => {
        const reason = 'LLM request failed';
        const context = { attempt: 3 };
        const cause = new Error('Network error');
        const error = TraitsRewriterError.forGenerationFailure(reason, context, cause);

        expect(error.message).toBe(`Traits rewriter generation failed: ${reason}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED);
        expect(error.context.stage).toBe('generation');
        expect(error.context.attempt).toBe(3);
        expect(error.cause).toBe(cause);
      });

      it('should work without cause', () => {
        const reason = 'Generation timeout';
        const error = TraitsRewriterError.forGenerationFailure(reason);

        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED);
        expect(error.cause).toBeNull();
      });
    });

    describe('forValidationFailure', () => {
      it('should create error with proper message and context', () => {
        const field = 'traits';
        const reason = 'Invalid format';
        const context = { characterName: 'TestChar' };
        const error = TraitsRewriterError.forValidationFailure(field, reason, context);

        expect(error.message).toBe(`Validation failed for ${field}: ${reason}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED);
        expect(error.context.stage).toBe('validation');
        expect(error.context.validationField).toBe(field);
        expect(error.context.validationReason).toBe(reason);
        expect(error.context.characterName).toBe('TestChar');
      });
    });

    describe('forMissingTraits', () => {
      it('should create error with proper message and context', () => {
        const characterName = 'TestCharacter';
        const context = { attempt: 2 };
        const error = TraitsRewriterError.forMissingTraits(characterName, context);

        expect(error.message).toBe(`No extractable traits found for character: ${characterName}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.MISSING_TRAITS);
        expect(error.context.stage).toBe('trait_extraction');
        expect(error.context.attempt).toBe(2);
      });
    });

    describe('forLLMFailure', () => {
      it('should create error with proper message and context', () => {
        const reason = 'API rate limit exceeded';
        const context = { provider: 'openai' };
        const cause = new Error('429 Too Many Requests');
        const error = TraitsRewriterError.forLLMFailure(reason, context, cause);

        expect(error.message).toBe(`LLM request failed: ${reason}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED);
        expect(error.context.stage).toBe('llm_request');
        expect(error.context.provider).toBe('openai');
        expect(error.cause).toBe(cause);
      });
    });

    describe('forParsingFailure', () => {
      it('should create error with proper message and context', () => {
        const reason = 'Invalid JSON response';
        const context = { responseLength: 1024 };
        const cause = new SyntaxError('Unexpected token');
        const error = TraitsRewriterError.forParsingFailure(reason, context, cause);

        expect(error.message).toBe(`Response parsing failed: ${reason}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED);
        expect(error.context.stage).toBe('response_parsing');
        expect(error.context.responseLength).toBe(1024);
        expect(error.cause).toBe(cause);
      });
    });

    describe('forQualityFailure', () => {
      it('should create error with proper message and context', () => {
        const issues = 'Traits too generic, lacks specificity';
        const context = { qualityScore: 0.3 };
        const error = TraitsRewriterError.forQualityFailure(issues, context);

        expect(error.message).toBe(`Response quality issues: ${issues}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.VALIDATION_FAILED);
        expect(error.context.stage).toBe('quality_validation');
        expect(error.context.qualityScore).toBe(0.3);
      });
    });

    describe('forExportFailure', () => {
      it('should create error with proper message and context', () => {
        const reason = 'File write permission denied';
        const context = { filePath: '/tmp/traits.json' };
        const cause = new Error('EACCES');
        const error = TraitsRewriterError.forExportFailure(reason, context, cause);

        expect(error.message).toBe(`Export operation failed: ${reason}`);
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.EXPORT_FAILED);
        expect(error.context.stage).toBe('export');
        expect(error.context.filePath).toBe('/tmp/traits.json');
        expect(error.cause).toBe(cause);
      });
    });

    describe('forInvalidFormat', () => {
      it('should create error with proper message and context', () => {
        const format = 'xml';
        const supportedFormats = ['json', 'txt', 'csv'];
        const context = { requestedBy: 'user' };
        const error = TraitsRewriterError.forInvalidFormat(format, supportedFormats, context);

        expect(error.message).toBe(
          `Invalid format '${format}'. Supported formats: ${supportedFormats.join(', ')}`
        );
        expect(error.context.errorCode).toBe(TRAITS_REWRITER_ERROR_CODES.INVALID_FORMAT);
        expect(error.context.stage).toBe('format_validation');
        expect(error.context.requestedFormat).toBe(format);
        expect(error.context.supportedFormats).toEqual(supportedFormats);
        expect(error.context.requestedBy).toBe('user');
      });
    });

    describe('forSanitizationFailure', () => {
      it('should create error with proper message and context', () => {
        const reason = 'Content contains unsafe patterns';
        const context = { unsafePatterns: ['<script>', 'javascript:'] };
        const cause = new Error('Sanitization blocked');
        const error = TraitsRewriterError.forSanitizationFailure(reason, context, cause);

        expect(error.message).toBe(`Content sanitization failed: ${reason}`);
        expect(error.context.errorCode).toBe(
          TRAITS_REWRITER_ERROR_CODES.CONTENT_SANITIZATION_FAILED
        );
        expect(error.context.stage).toBe('content_sanitization');
        expect(error.context.unsafePatterns).toEqual(['<script>', 'javascript:']);
        expect(error.cause).toBe(cause);
      });
    });
  });

  describe('Inheritance Chain', () => {
    it('should be instanceof Error', () => {
      const error = new TraitsRewriterError('Test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instanceof CharacterBuilderError', () => {
      const error = new TraitsRewriterError('Test message');
      expect(error).toBeInstanceOf(CharacterBuilderError);
    });

    it('should be instanceof TraitsRewriterError', () => {
      const error = new TraitsRewriterError('Test message');
      expect(error).toBeInstanceOf(TraitsRewriterError);
    });

    it('should have correct prototype chain', () => {
      const error = new TraitsRewriterError('Test message');
      expect(Object.getPrototypeOf(error)).toBe(TraitsRewriterError.prototype);
      expect(Object.getPrototypeOf(TraitsRewriterError.prototype)).toBe(
        CharacterBuilderError.prototype
      );
      expect(Object.getPrototypeOf(CharacterBuilderError.prototype)).toBe(Error.prototype);
    });
  });

  describe('Context Handling', () => {
    it('should accept and store context object', () => {
      const context = {
        characterName: 'TestChar',
        stage: 'generation',
        attempt: 2,
        traitTypes: ['personality', 'physical'],
      };
      const error = new TraitsRewriterError('Test message', context);

      expect(error.context).toEqual(context);
      expect(error.context.characterName).toBe('TestChar');
      expect(error.context.stage).toBe('generation');
      expect(error.context.attempt).toBe(2);
      expect(error.context.traitTypes).toEqual(['personality', 'physical']);
    });

    it('should handle empty context', () => {
      const error = new TraitsRewriterError('Test message', {});
      expect(error.context).toEqual({});
    });

    it('should preserve context properties', () => {
      const context = {
        errorCode: 'CUSTOM_ERROR',
        customField: 'customValue',
        numericField: 42,
        booleanField: true,
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' },
      };
      const error = new TraitsRewriterError('Test message', context);

      expect(error.context).toEqual(context);
      expect(error.context.customField).toBe('customValue');
      expect(error.context.numericField).toBe(42);
      expect(error.context.booleanField).toBe(true);
      expect(error.context.arrayField).toEqual([1, 2, 3]);
      expect(error.context.objectField).toEqual({ nested: 'value' });
    });
  });

  describe('Inherited Methods', () => {
    it('should inherit toJSON method from CharacterBuilderError', () => {
      const context = { characterName: 'TestChar', stage: 'validation' };
      const cause = new Error('Original error');
      const error = new TraitsRewriterError('Test message', context, cause);

      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'TraitsRewriterError');
      expect(json).toHaveProperty('message', 'Test message');
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('cause', 'Original error');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });

    it('should handle toJSON with null cause', () => {
      const error = new TraitsRewriterError('Test message');
      const json = error.toJSON();

      expect(json.cause).toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain constructor signature compatibility', () => {
      // Test that the constructor can be called in ways existing services use it
      const error1 = new TraitsRewriterError('Message only');
      const error2 = new TraitsRewriterError('Message with context', { stage: 'test' });
      const error3 = new TraitsRewriterError('Full signature', { stage: 'test' }, new Error('cause'));

      expect(error1).toBeInstanceOf(TraitsRewriterError);
      expect(error2).toBeInstanceOf(TraitsRewriterError);
      expect(error3).toBeInstanceOf(TraitsRewriterError);
    });

    it('should support error codes used by existing services', () => {
      // Based on the search results, these patterns are used in existing services
      const error = new TraitsRewriterError('Test', {
        errorCode: TRAITS_REWRITER_ERROR_CODES.GENERATION_FAILED,
      });

      expect(error.context.errorCode).toBe('GENERATION_FAILED');
    });

    it('should support instanceof checks used by existing services', () => {
      const error = TraitsRewriterError.forGenerationFailure('Test failure');

      // This pattern is used in TraitsRewriterResponseProcessor.js and TraitsRewriterGenerator.js
      expect(error instanceof TraitsRewriterError).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new TraitsRewriterError(longMessage);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle complex nested context objects', () => {
      const complexContext = {
        level1: {
          level2: {
            level3: {
              deepValue: 'test',
              deepArray: [{ item: 1 }, { item: 2 }],
            },
          },
        },
      };
      const error = new TraitsRewriterError('Test message', complexContext);

      expect(error.context.level1.level2.level3.deepValue).toBe('test');
      expect(error.context.level1.level2.level3.deepArray).toHaveLength(2);
    });

    it('should handle circular references in context gracefully', () => {
      const circularContext = { name: 'test' };
      circularContext.self = circularContext;

      // Should not throw an error during construction
      expect(() => {
        new TraitsRewriterError('Test message', circularContext);
      }).not.toThrow();
    });

    it('should handle null and undefined values in context', () => {
      const contextWithNulls = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };
      const error = new TraitsRewriterError('Test message', contextWithNulls);

      expect(error.context.nullValue).toBeNull();
      expect(error.context.undefinedValue).toBeUndefined();
      expect(error.context.emptyString).toBe('');
      expect(error.context.zeroValue).toBe(0);
      expect(error.context.falseValue).toBe(false);
    });
  });
});