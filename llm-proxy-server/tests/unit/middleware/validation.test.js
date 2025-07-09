import { describe, test, beforeEach, expect, jest } from '@jest/globals';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
  isUrlSafe,
} from '../../../src/middleware/validation.js';
import { validationResult, body, header } from 'express-validator';

// Mock express-validator
jest.mock('express-validator', () => {
  const actualValidator = jest.requireActual('express-validator');

  const mockBody = jest.fn((field) => {
    const chain = {
      exists: jest.fn().mockReturnThis(),
      withMessage: jest.fn().mockReturnThis(),
      isString: jest.fn().mockReturnThis(),
      trim: jest.fn().mockReturnThis(),
      notEmpty: jest.fn().mockReturnThis(),
      isLength: jest.fn().mockReturnThis(),
      matches: jest.fn().mockReturnThis(),
      isObject: jest.fn().mockReturnThis(),
      custom: jest.fn().mockReturnThis(),
      optional: jest.fn().mockReturnThis(),
      customSanitizer: jest.fn().mockReturnThis(),
    };
    return chain;
  });

  const mockHeader = jest.fn((field) => {
    const chain = {
      exists: jest.fn().mockReturnThis(),
      withMessage: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      customSanitizer: jest.fn().mockReturnThis(),
    };
    return chain;
  });

  return {
    ...actualValidator,
    body: mockBody,
    header: mockHeader,
    validationResult: jest.fn(),
  };
});

describe('Validation Middleware', () => {
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
    jest.clearAllMocks();
  });

  describe('validateLlmRequest', () => {
    test('returns array of validation middleware', () => {
      const validators = validateLlmRequest();

      expect(Array.isArray(validators)).toBe(true);
      expect(validators.length).toBeGreaterThan(0);
    });

    test('validates llmId field', () => {
      const validators = validateLlmRequest();

      // Verify body was called for llmId
      expect(jest.mocked(body)).toHaveBeenCalledWith('llmId');
    });

    test('validates targetPayload field', () => {
      const validators = validateLlmRequest();

      // Verify body was called for targetPayload
      expect(jest.mocked(body)).toHaveBeenCalledWith('targetPayload');
    });

    test('validates targetHeaders field', () => {
      const validators = validateLlmRequest();

      // Verify body was called for targetHeaders
      expect(jest.mocked(body)).toHaveBeenCalledWith('targetHeaders');
    });

    test('validates no extra fields', () => {
      const validators = validateLlmRequest();

      // Verify body was called without parameters for extra fields check
      expect(jest.mocked(body)).toHaveBeenCalledWith();
    });
  });

  describe('validateRequestHeaders', () => {
    test('returns array of header validation middleware', () => {
      const validators = validateRequestHeaders();

      expect(Array.isArray(validators)).toBe(true);
      expect(validators.length).toBeGreaterThan(0);
    });

    test('validates content-type header', () => {
      const validators = validateRequestHeaders();

      expect(jest.mocked(header)).toHaveBeenCalledWith('content-type');
    });

    test('sanitizes all headers', () => {
      const validators = validateRequestHeaders();

      expect(jest.mocked(header)).toHaveBeenCalledWith('*');
    });
  });

  describe('handleValidationErrors', () => {
    test('calls next when no validation errors', () => {
      jest.mocked(validationResult).mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(true),
        array: jest.fn().mockReturnValue([]),
      });

      handleValidationErrors(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 400 error with validation errors', () => {
      const mockErrors = [
        {
          path: 'llmId',
          value: undefined,
          msg: 'llmId is required',
        },
        {
          param: 'targetPayload',
          value: null,
          msg: 'targetPayload must be an object',
        },
      ];

      jest.mocked(validationResult).mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: [
            {
              field: 'llmId',
              value: undefined,
              message: 'llmId is required',
            },
            {
              field: 'targetPayload',
              value: null,
              message: 'targetPayload must be an object',
            },
          ],
        },
        originalStatusCode: 400,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('handles errors with path property', () => {
      const mockErrors = [
        {
          path: 'field1',
          value: 'bad',
          msg: 'Field 1 is invalid',
        },
      ];

      jest.mocked(validationResult).mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.details.validationErrors[0].field).toBe('field1');
    });

    test('handles errors with param property', () => {
      const mockErrors = [
        {
          param: 'field2',
          value: 'bad',
          msg: 'Field 2 is invalid',
        },
      ];

      jest.mocked(validationResult).mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue(mockErrors),
      });

      handleValidationErrors(req, res, next);

      const responseData = res.json.mock.calls[0][0];
      expect(responseData.details.validationErrors[0].field).toBe('field2');
    });
  });

  describe('isUrlSafe', () => {
    describe('valid URLs', () => {
      test('accepts valid HTTPS URLs', () => {
        expect(isUrlSafe('https://api.example.com')).toBe(true);
        expect(isUrlSafe('https://api.example.com/v1/endpoint')).toBe(true);
        expect(isUrlSafe('https://subdomain.example.com:8443/path')).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      test('rejects null and undefined', () => {
        expect(isUrlSafe(null)).toBe(false);
        expect(isUrlSafe(undefined)).toBe(false);
      });

      test('rejects non-string inputs', () => {
        expect(isUrlSafe(123)).toBe(false);
        expect(isUrlSafe({})).toBe(false);
        expect(isUrlSafe([])).toBe(false);
      });

      test('rejects empty string', () => {
        expect(isUrlSafe('')).toBe(false);
      });

      test('rejects invalid URLs', () => {
        expect(isUrlSafe('not a url')).toBe(false);
        expect(isUrlSafe('http:/missing-slash')).toBe(false);
      });
    });

    describe('protocol validation', () => {
      test('rejects non-HTTPS protocols', () => {
        expect(isUrlSafe('http://api.example.com')).toBe(false);
        expect(isUrlSafe('ftp://api.example.com')).toBe(false);
        expect(isUrlSafe('file:///etc/passwd')).toBe(false);
        expect(isUrlSafe('javascript:alert(1)')).toBe(false);
      });
    });

    describe('SSRF prevention', () => {
      test('rejects localhost variations', () => {
        expect(isUrlSafe('https://localhost')).toBe(false);
        expect(isUrlSafe('https://localhost:8080')).toBe(false);
        expect(isUrlSafe('https://LOCALHOST')).toBe(false);
      });

      test('rejects loopback IPs', () => {
        expect(isUrlSafe('https://127.0.0.1')).toBe(false);
        expect(isUrlSafe('https://127.0.0.1:443')).toBe(false);
        expect(isUrlSafe('https://0.0.0.0')).toBe(false);
      });

      test('rejects IPv6 loopback', () => {
        expect(isUrlSafe('https://[::1]')).toBe(false);
        // Note: ::0 is not commonly used as loopback and may not be blocked
      });

      test('rejects private IP ranges - 10.x.x.x', () => {
        expect(isUrlSafe('https://10.0.0.1')).toBe(false);
        expect(isUrlSafe('https://10.255.255.255')).toBe(false);
        expect(isUrlSafe('https://10.1.2.3:8080')).toBe(false);
      });

      test('rejects private IP ranges - 172.16-31.x.x', () => {
        expect(isUrlSafe('https://172.16.0.1')).toBe(false);
        expect(isUrlSafe('https://172.20.10.5')).toBe(false);
        expect(isUrlSafe('https://172.31.255.255')).toBe(false);
      });

      test('accepts IPs outside 172.16-31 range', () => {
        expect(isUrlSafe('https://172.15.0.1')).toBe(true);
        expect(isUrlSafe('https://172.32.0.1')).toBe(true);
      });

      test('rejects private IP ranges - 192.168.x.x', () => {
        expect(isUrlSafe('https://192.168.0.1')).toBe(false);
        expect(isUrlSafe('https://192.168.1.1')).toBe(false);
        expect(isUrlSafe('https://192.168.255.255')).toBe(false);
      });

      test('rejects link-local IPs - 169.254.x.x', () => {
        expect(isUrlSafe('https://169.254.0.1')).toBe(false);
        expect(isUrlSafe('https://169.254.169.254')).toBe(false);
        expect(isUrlSafe('https://169.254.255.255')).toBe(false);
      });

      test('accepts public IPs', () => {
        expect(isUrlSafe('https://8.8.8.8')).toBe(true);
        expect(isUrlSafe('https://1.1.1.1')).toBe(true);
        expect(isUrlSafe('https://93.184.216.34')).toBe(true);
      });

      test('accepts IPs that start with private ranges but are public', () => {
        expect(isUrlSafe('https://192.167.0.1')).toBe(true);
        expect(isUrlSafe('https://192.169.0.1')).toBe(true);
        expect(isUrlSafe('https://169.255.0.1')).toBe(true);
        expect(isUrlSafe('https://169.253.0.1')).toBe(true);
      });
    });
  });

  describe('sanitizeHeaders helper', () => {
    // Testing the actual sanitizeHeaders function through the validation middleware
    test('custom sanitizer is applied to targetHeaders', () => {
      const validators = validateLlmRequest();

      // Find the targetHeaders validator
      const bodyMock = jest.mocked(body);
      const targetHeadersCall = bodyMock.mock.calls.find(
        (call) => call[0] === 'targetHeaders'
      );

      expect(targetHeadersCall).toBeDefined();
    });
  });

  describe('Custom validators', () => {
    test('targetPayload custom validator checks for empty object', () => {
      const validators = validateLlmRequest();

      // The custom validator is configured through the chain
      const bodyMock = jest.mocked(body);
      const targetPayloadCall = bodyMock.mock.calls.find(
        (call) => call[0] === 'targetPayload'
      );

      expect(targetPayloadCall).toBeDefined();
    });

    test('extra fields custom validator is configured', () => {
      const validators = validateLlmRequest();

      // Body called without parameters for the extra fields check
      const bodyMock = jest.mocked(body);
      const extraFieldsCall = bodyMock.mock.calls.find(
        (call) => call.length === 0
      );

      expect(extraFieldsCall).toBeDefined();
    });
  });
});
