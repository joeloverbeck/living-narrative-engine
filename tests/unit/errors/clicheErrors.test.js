/**
 * @file Unit tests for cliché error classes
 *
 * Tests the hierarchical error system for cliché operations including:
 * - Base ClicheError functionality
 * - Specialized error class behaviors
 * - Error serialization and JSON conversion
 * - Error code and context handling
 * - Stack trace preservation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ClicheError,
  ClicheGenerationError,
  ClicheValidationError,
  ClicheStorageError,
  ClicheLLMError,
  ClicheDataIntegrityError,
  ClichePrerequisiteError,
  ClicheErrors,
  CLICHE_ERROR_CODES,
} from '../../../src/errors/clicheErrors.js';

describe('ClicheError Classes', () => {
  describe('ClicheError (Base Class)', () => {
    it('should create basic error with message', () => {
      const error = new ClicheError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ClicheError);
      expect(error.name).toBe('ClicheError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('CLICHE_ERROR');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
    });

    it('should create error with custom details', () => {
      const details = {
        code: 'CUSTOM_CODE',
        operation: 'test_operation',
        context: { key: 'value' },
      };

      const error = new ClicheError('Test error', details);

      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.operation).toBe('test_operation');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.details).toEqual(details);
    });

    it('should preserve stack trace', () => {
      const error = new ClicheError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ClicheError');
      expect(error.stack).toContain('Test error');
    });

    it('should serialize to JSON correctly', () => {
      const details = {
        code: 'TEST_CODE',
        operation: 'test',
        context: { data: 'test' },
      };

      const error = new ClicheError('Test message', details);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ClicheError',
        message: 'Test message',
        code: 'TEST_CODE',
        operation: 'test',
        context: { data: 'test' },
        details: details,
        timestamp: error.timestamp,
        stack: error.stack,
      });
    });

    it('should handle undefined details gracefully', () => {
      const error = new ClicheError('Test error');

      expect(error.details).toEqual({});
      expect(error.operation).toBeUndefined();
      expect(error.context).toEqual({}); // BaseError always initializes context to {} when undefined
    });
  });

  describe('ClicheGenerationError', () => {
    it('should create generation error with proper inheritance', () => {
      const error = new ClicheGenerationError('Generation failed');

      expect(error).toBeInstanceOf(ClicheError);
      expect(error).toBeInstanceOf(ClicheGenerationError);
      expect(error.name).toBe('ClicheGenerationError');
      expect(error.code).toBe('CLICHE_GENERATION_ERROR');
      expect(error.attempt).toBe(1);
    });

    it('should handle generation-specific details', () => {
      const details = {
        directionId: 'dir-123',
        conceptId: 'concept-456',
        attempt: 3,
        statusCode: 429,
      };

      const error = new ClicheGenerationError('Rate limited', details);

      expect(error.directionId).toBe('dir-123');
      expect(error.conceptId).toBe('concept-456');
      expect(error.attempt).toBe(3);
      expect(error.statusCode).toBe(429);
    });

    it('should default attempt to 1 if not provided', () => {
      const error = new ClicheGenerationError('Failed');

      expect(error.attempt).toBe(1);
    });
  });

  describe('ClicheValidationError', () => {
    it('should create validation error with error list', () => {
      const validationErrors = [
        'Field is required',
        'Invalid format',
        'Value out of range',
      ];

      const error = new ClicheValidationError(
        'Validation failed',
        validationErrors
      );

      expect(error).toBeInstanceOf(ClicheError);
      expect(error.name).toBe('ClicheValidationError');
      expect(error.code).toBe('CLICHE_VALIDATION_ERROR');
      expect(error.validationErrors).toEqual(validationErrors);
    });

    it('should handle additional details', () => {
      const validationErrors = ['Invalid data'];
      const details = {
        invalidData: { field: 'value' },
        validator: 'testValidator',
      };

      const error = new ClicheValidationError(
        'Failed',
        validationErrors,
        details
      );

      expect(error.invalidData).toEqual({ field: 'value' });
      expect(error.validator).toBe('testValidator');
      expect(error.details.validationErrors).toEqual(validationErrors);
    });

    it('should provide validation summary for single error', () => {
      const error = new ClicheValidationError('Main error', [
        'Single validation error',
      ]);

      expect(error.getValidationSummary()).toBe('Single validation error');
    });

    it('should provide validation summary for multiple errors', () => {
      const errors = ['First error', 'Second error', 'Third error'];
      const error = new ClicheValidationError('Main error', errors);

      const summary = error.getValidationSummary();
      expect(summary).toContain('Main error');
      expect(summary).toContain('• First error');
      expect(summary).toContain('• Second error');
      expect(summary).toContain('• Third error');
    });

    it('should return main message when no validation errors', () => {
      const error = new ClicheValidationError('Main message', []);

      expect(error.getValidationSummary()).toBe('Main message');
    });
  });

  describe('ClicheStorageError', () => {
    it('should create storage error with operation info', () => {
      const error = new ClicheStorageError('Save failed', 'save');

      expect(error).toBeInstanceOf(ClicheError);
      expect(error.name).toBe('ClicheStorageError');
      expect(error.code).toBe('CLICHE_STORAGE_ERROR');
      expect(error.storageOperation).toBe('save');
      expect(error.operation).toBe('save');
    });

    it('should handle storage-specific details', () => {
      const details = {
        storageType: 'database',
        data: { id: '123', content: 'test' },
      };

      const error = new ClicheStorageError(
        'DB connection failed',
        'load',
        details
      );

      expect(error.storageType).toBe('database');
      expect(error.failedData).toEqual({ id: '123', content: 'test' });
    });
  });

  describe('ClicheLLMError', () => {
    it('should create LLM error with status code', () => {
      const error = new ClicheLLMError('Service unavailable', 503);

      expect(error).toBeInstanceOf(ClicheError);
      expect(error.name).toBe('ClicheLLMError');
      expect(error.code).toBe('CLICHE_LLM_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.isRetryable).toBe(true); // Default
    });

    it('should handle LLM-specific details', () => {
      const details = {
        provider: 'OpenAI',
        endpoint: '/chat/completions',
        isRetryable: false,
      };

      const error = new ClicheLLMError('API key invalid', 401, details);

      expect(error.provider).toBe('OpenAI');
      expect(error.endpoint).toBe('/chat/completions');
      expect(error.isRetryable).toBe(false);
    });

    it('should identify temporary failures correctly', () => {
      const serverError = new ClicheLLMError('Internal error', 500);
      expect(serverError.isTemporaryFailure()).toBe(true);

      const rateLimitError = new ClicheLLMError('Rate limited', 429);
      expect(rateLimitError.isTemporaryFailure()).toBe(true);

      const timeoutError = new ClicheLLMError('Request timeout', 408);
      expect(timeoutError.isTemporaryFailure()).toBe(true);

      const unavailableError = new ClicheLLMError('Service unavailable');
      expect(unavailableError.isTemporaryFailure()).toBe(true);

      const authError = new ClicheLLMError('Unauthorized', 401);
      expect(authError.isTemporaryFailure()).toBe(false);

      const notFoundError = new ClicheLLMError('Not found', 404);
      expect(notFoundError.isTemporaryFailure()).toBe(false);
    });

    it('should handle timeout messages', () => {
      const timeoutError = new ClicheLLMError('Connection timeout occurred');
      expect(timeoutError.isTemporaryFailure()).toBe(true);
    });
  });

  describe('ClicheDataIntegrityError', () => {
    it('should create data integrity error', () => {
      const error = new ClicheDataIntegrityError('Data corrupted', 'cliches');

      expect(error).toBeInstanceOf(ClicheError);
      expect(error.name).toBe('ClicheDataIntegrityError');
      expect(error.code).toBe('CLICHE_DATA_INTEGRITY_ERROR');
      expect(error.dataType).toBe('cliches');
    });

    it('should handle integrity-specific details', () => {
      const details = {
        expectedData: { format: 'json' },
        actualData: 'invalid string',
        source: 'database',
      };

      const error = new ClicheDataIntegrityError(
        'Format mismatch',
        'direction',
        details
      );

      expect(error.expectedData).toEqual({ format: 'json' });
      expect(error.actualData).toBe('invalid string');
      expect(error.source).toBe('database');
    });
  });

  describe('ClichePrerequisiteError', () => {
    it('should create prerequisite error', () => {
      const missingPrereqs = ['direction', 'concept'];
      const error = new ClichePrerequisiteError(
        'Prerequisites missing',
        missingPrereqs
      );

      expect(error).toBeInstanceOf(ClicheError);
      expect(error.name).toBe('ClichePrerequisiteError');
      expect(error.code).toBe('CLICHE_PREREQUISITE_ERROR');
      expect(error.missingPrerequisites).toEqual(missingPrereqs);
    });

    it('should handle operation context', () => {
      const details = { operation: 'generate_cliches' };
      const error = new ClichePrerequisiteError(
        'Missing data',
        ['concept'],
        details
      );

      expect(error.details.operation).toBe('generate_cliches');
      expect(error.details.missingPrerequisites).toEqual(['concept']);
    });
  });

  describe('ClicheErrors Export', () => {
    it('should export all error classes', () => {
      expect(ClicheErrors.ClicheError).toBe(ClicheError);
      expect(ClicheErrors.ClicheGenerationError).toBe(ClicheGenerationError);
      expect(ClicheErrors.ClicheValidationError).toBe(ClicheValidationError);
      expect(ClicheErrors.ClicheStorageError).toBe(ClicheStorageError);
      expect(ClicheErrors.ClicheLLMError).toBe(ClicheLLMError);
      expect(ClicheErrors.ClicheDataIntegrityError).toBe(
        ClicheDataIntegrityError
      );
      expect(ClicheErrors.ClichePrerequisiteError).toBe(
        ClichePrerequisiteError
      );
    });
  });

  describe('CLICHE_ERROR_CODES Export', () => {
    it('should export all error codes', () => {
      expect(CLICHE_ERROR_CODES.GENERIC).toBe('CLICHE_ERROR');
      expect(CLICHE_ERROR_CODES.GENERATION).toBe('CLICHE_GENERATION_ERROR');
      expect(CLICHE_ERROR_CODES.VALIDATION).toBe('CLICHE_VALIDATION_ERROR');
      expect(CLICHE_ERROR_CODES.STORAGE).toBe('CLICHE_STORAGE_ERROR');
      expect(CLICHE_ERROR_CODES.LLM_SERVICE).toBe('CLICHE_LLM_ERROR');
      expect(CLICHE_ERROR_CODES.DATA_INTEGRITY).toBe(
        'CLICHE_DATA_INTEGRITY_ERROR'
      );
      expect(CLICHE_ERROR_CODES.PREREQUISITE).toBe('CLICHE_PREREQUISITE_ERROR');
    });
  });

  describe('Error instanceof checks', () => {
    it('should maintain proper inheritance chain', () => {
      const genError = new ClicheGenerationError('Generation failed');
      const valError = new ClicheValidationError('Validation failed');
      const storageError = new ClicheStorageError('Storage failed');

      // All should be instances of base classes
      expect(genError instanceof Error).toBe(true);
      expect(genError instanceof ClicheError).toBe(true);
      expect(genError instanceof ClicheGenerationError).toBe(true);

      expect(valError instanceof Error).toBe(true);
      expect(valError instanceof ClicheError).toBe(true);
      expect(valError instanceof ClicheValidationError).toBe(true);

      expect(storageError instanceof Error).toBe(true);
      expect(storageError instanceof ClicheError).toBe(true);
      expect(storageError instanceof ClicheStorageError).toBe(true);

      // Should not be instances of sibling classes
      expect(genError instanceof ClicheValidationError).toBe(false);
      expect(valError instanceof ClicheStorageError).toBe(false);
      expect(storageError instanceof ClicheGenerationError).toBe(false);
    });
  });

  describe('Error message handling', () => {
    it('should throw error for empty messages', () => {
      expect(() => new ClicheError('')).toThrow(
        "BaseError constructor: Invalid message ''. Expected non-blank string."
      );
    });

    it('should throw error for undefined messages', () => {
      expect(() => new ClicheError(undefined)).toThrow(
        "BaseError constructor: Invalid message 'undefined'. Expected non-blank string."
      );
    });

    it('should preserve original message formatting', () => {
      const message = 'Line 1\nLine 2\n  Indented line';
      const error = new ClicheError(message);
      expect(error.message).toBe(message);
    });
  });

  describe('Timestamp validation', () => {
    it('should generate valid ISO timestamps', () => {
      const error = new ClicheError('Test');
      const timestamp = new Date(error.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(error.timestamp);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });

    it('should generate sequential timestamps that are close in time', () => {
      const error1 = new ClicheError('Test 1');
      const error2 = new ClicheError('Test 2');

      const time1 = new Date(error1.timestamp);
      const time2 = new Date(error2.timestamp);

      // Both timestamps should be valid dates
      expect(time1).toBeInstanceOf(Date);
      expect(time2).toBeInstanceOf(Date);
      expect(isNaN(time1.getTime())).toBe(false);
      expect(isNaN(time2.getTime())).toBe(false);

      // Second timestamp should be same or later than first (within reasonable bounds)
      expect(time2.getTime()).toBeGreaterThanOrEqual(time1.getTime());

      // Timestamps should be recent (within last 1000ms)
      const now = Date.now();
      expect(now - time1.getTime()).toBeLessThan(1000);
      expect(now - time2.getTime()).toBeLessThan(1000);
    });
  });
});
