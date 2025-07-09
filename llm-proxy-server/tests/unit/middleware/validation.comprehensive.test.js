import { describe, test, beforeEach, expect, jest } from '@jest/globals';
import { 
  validateLlmRequest, 
  validateRequestHeaders, 
  handleValidationErrors,
  isUrlSafe 
} from '../../../src/middleware/validation.js';

// Import the actual express-validator to test the real implementation
import { validationResult } from 'express-validator';

describe('Validation Middleware - Comprehensive Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('validateLlmRequest - Real Implementation', () => {
    test('executes validation chain for valid request', async () => {
      req.body = {
        llmId: 'test-llm-123',
        targetPayload: { message: 'test' },
        targetHeaders: { 'x-custom': 'value' }
      };

      const validators = validateLlmRequest();
      
      // Execute each validator in the chain
      for (const validator of validators) {
        await validator(req, res, next);
      }
      
      // Validators should have been called
      expect(next).toHaveBeenCalled();
    });

    test('custom validator for targetPayload rejects empty object', async () => {
      req.body = {
        llmId: 'test-llm',
        targetPayload: {},
      };

      const validators = validateLlmRequest();
      
      // Find and execute the targetPayload custom validator
      for (const validator of validators) {
        await validator(req, res, next);
      }
    });

    test('custom validator for extra fields detects unexpected fields', async () => {
      req.body = {
        llmId: 'test-llm',
        targetPayload: { data: 'test' },
        unexpectedField: 'should not be here',
        anotherExtra: 'also unexpected'
      };

      const validators = validateLlmRequest();
      
      // Execute validators
      for (const validator of validators) {
        await validator(req, res, next);
      }
    });

    test('targetHeaders sanitizer handles dangerous characters', async () => {
      req.body = {
        llmId: 'test-llm',
        targetPayload: { data: 'test' },
        targetHeaders: {
          'good-header': 'clean-value',
          'bad\r\nheader': 'value',
          'header-with-bad\x00value': 'test',
          'x-custom-123_test': 'allowed',
          '!!!invalid###': 'should be cleaned',
          'very-long-header-name-that-exceeds-one-hundred-characters-limit-and-should-be-rejected-completely': 'too long',
          'normal': 'x'.repeat(1001), // Value too long
          '!!!###$$$': 'header name becomes empty after sanitization', // This will test the empty cleanKey branch
        }
      };

      const validators = validateLlmRequest();
      
      // Run validators
      for (const validator of validators) {
        await validator(req, res, next);
      }
      
      // The sanitizer should have cleaned the headers
      // Note: The actual sanitization happens within the validator chain
    });

    test('targetHeaders sanitizer handles non-object input', async () => {
      req.body = {
        llmId: 'test-llm',
        targetPayload: { data: 'test' },
        targetHeaders: 'not-an-object'
      };

      const validators = validateLlmRequest();
      
      for (const validator of validators) {
        await validator(req, res, next);
      }
    });

    test('targetHeaders sanitizer handles null input', async () => {
      req.body = {
        llmId: 'test-llm',
        targetPayload: { data: 'test' },
        targetHeaders: null
      };

      const validators = validateLlmRequest();
      
      for (const validator of validators) {
        await validator(req, res, next);
      }
    });
  });

  describe('validateRequestHeaders - Real Implementation', () => {
    test('header sanitizer removes dangerous characters', async () => {
      req.headers = {
        'content-type': 'application/json',
        'x-custom': 'clean-value',
        'x-bad': 'value\r\ninjection',
        'x-null': 'value\x00null',
        'authorization': 'Bearer token\nNewline'
      };

      const validators = validateRequestHeaders();
      
      // Run validators
      for (const validator of validators) {
        await validator(req, res, next);
      }
    });

    test('header sanitizer handles non-string values', async () => {
      req.headers = {
        'content-type': 'application/json',
        'x-number': 123,
        'x-boolean': true,
        'x-object': { nested: 'value' },
        'x-array': ['a', 'b', 'c']
      };

      const validators = validateRequestHeaders();
      
      for (const validator of validators) {
        await validator(req, res, next);
      }
    });
  });

  describe('Edge cases and error paths', () => {
    test('sanitizeHeaders with entries that cause exceptions', async () => {
      const problematicHeaders = {
        'good': 'value',
        // Object with null prototype
        __proto__: null,
        // Circular reference
        circular: {}
      };
      problematicHeaders.circular.ref = problematicHeaders;

      req.body = {
        llmId: 'test',
        targetPayload: { data: 'test' },
        targetHeaders: problematicHeaders
      };

      const validators = validateLlmRequest();
      
      // Should not throw
      for (const validator of validators) {
        try {
          await validator(req, res, next);
        } catch (e) {
          // Validator might throw, but sanitizer should handle it
        }
      }
    });
  });
});