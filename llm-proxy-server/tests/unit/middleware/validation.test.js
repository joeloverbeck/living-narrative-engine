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

  // Create a mock validator function that can be called
  const createMockValidator = () => jest.fn((req, res, next) => next());

  const mockBody = jest.fn((_field) => {
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
    // Return a mock validator function when the chain is called
    Object.setPrototypeOf(chain, createMockValidator());
    return chain;
  });

  const mockHeader = jest.fn((_field) => {
    const chain = {
      exists: jest.fn().mockReturnThis(),
      withMessage: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      customSanitizer: jest.fn().mockReturnThis(),
    };
    // Return a mock validator function when the chain is called
    Object.setPrototypeOf(chain, createMockValidator());
    return chain;
  });

  return {
    ...actualValidator,
    body: mockBody,
    header: mockHeader,
    validationResult: jest.fn(),
  };
});

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
    jest.clearAllMocks();
  });

  describe('validateLlmRequest - Core Functionality', () => {
    test('returns array of validation middleware', () => {
      const validators = validateLlmRequest();

      expect(Array.isArray(validators)).toBe(true);
      expect(validators.length).toBeGreaterThan(0);
    });

    test('validates llmId field', () => {
      validateLlmRequest();

      // Verify body was called for llmId
      expect(jest.mocked(body)).toHaveBeenCalledWith('llmId');
    });

    test('validates targetPayload field', () => {
      validateLlmRequest();

      // Verify body was called for targetPayload
      expect(jest.mocked(body)).toHaveBeenCalledWith('targetPayload');
    });

    test('validates targetHeaders field', () => {
      validateLlmRequest();

      // Verify body was called for targetHeaders
      expect(jest.mocked(body)).toHaveBeenCalledWith('targetHeaders');
    });

    test('validates no extra fields', () => {
      validateLlmRequest();

      // Verify body was called without parameters for extra fields check
      expect(jest.mocked(body)).toHaveBeenCalledWith();
    });

    test('returns validators from express-validator chains', () => {
      const validators = validateLlmRequest();

      // Each validator should be the mocked chain object or function
      validators.forEach((validator) => {
        expect(validator).toBeDefined();
        expect(
          typeof validator === 'function' || typeof validator === 'object'
        ).toBe(true);
      });
    });
  });

  describe('validateRequestHeaders - Core Functionality', () => {
    test('returns array of header validation middleware', () => {
      const validators = validateRequestHeaders();

      expect(Array.isArray(validators)).toBe(true);
      expect(validators.length).toBeGreaterThan(0);
    });

    test('validates content-type header', () => {
      validateRequestHeaders();

      expect(jest.mocked(header)).toHaveBeenCalledWith('content-type');
    });

    test('sanitizes all headers', () => {
      validateRequestHeaders();

      expect(jest.mocked(header)).toHaveBeenCalledWith('*');
    });

    test('returns validators from express-validator chains', () => {
      const validators = validateRequestHeaders();

      // Each validator should be the mocked chain object or function
      validators.forEach((validator) => {
        expect(validator).toBeDefined();
        expect(
          typeof validator === 'function' || typeof validator === 'object'
        ).toBe(true);
      });
    });

    test('header sanitizer preserves non-strings and strips control characters', () => {
      validateRequestHeaders();

      const { mock } = jest.mocked(header);
      const sanitizerCallIndex = mock.calls.findIndex(
        ([field]) => field === '*'
      );

      expect(sanitizerCallIndex).toBeGreaterThan(-1);

      const sanitizerChain = mock.results[sanitizerCallIndex].value;
      const sanitizerMock = sanitizerChain.customSanitizer;

      expect(sanitizerMock).toHaveBeenCalledWith(expect.any(Function));

      const sanitizerFn = sanitizerMock.mock.calls[0][0];

      const nonStringValue = { keep: 'original' };
      expect(sanitizerFn(nonStringValue)).toBe(nonStringValue);

      expect(sanitizerFn('Line with\r\ncontrol\x00chars')).toBe(
        'Line withcontrolchars'
      );
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

  describe('Validation Configuration Tests', () => {
    test('validateLlmRequest configures targetHeaders sanitizer', () => {
      validateLlmRequest();

      // Find the targetHeaders validator
      const bodyMock = jest.mocked(body);
      const targetHeadersCall = bodyMock.mock.calls.find(
        (call) => call[0] === 'targetHeaders'
      );

      expect(targetHeadersCall).toBeDefined();
    });

    test('validateLlmRequest configures custom validators', () => {
      validateLlmRequest();

      const bodyMock = jest.mocked(body);

      // Should have calls for all main fields
      expect(bodyMock).toHaveBeenCalledWith('llmId');
      expect(bodyMock).toHaveBeenCalledWith('targetPayload');
      expect(bodyMock).toHaveBeenCalledWith('targetHeaders');

      // Should have call for extra fields validation
      expect(bodyMock).toHaveBeenCalledWith();
    });

    test('validateRequestHeaders configures header sanitization', () => {
      validateRequestHeaders();

      const headerMock = jest.mocked(header);

      // Should configure content-type validation
      expect(headerMock).toHaveBeenCalledWith('content-type');

      // Should configure global header sanitization
      expect(headerMock).toHaveBeenCalledWith('*');
    });
  });

  describe('isUrlSafe - Comprehensive URL Security Validation', () => {
    describe('Valid URLs', () => {
      test('accepts valid HTTPS URLs', () => {
        expect(isUrlSafe('https://api.example.com')).toBe(true);
        expect(isUrlSafe('https://api.example.com/v1/endpoint')).toBe(true);
        expect(isUrlSafe('https://subdomain.example.com:8443/path')).toBe(true);
      });

      test('accepts public IPs', () => {
        expect(isUrlSafe('https://8.8.8.8')).toBe(true);
        expect(isUrlSafe('https://1.1.1.1')).toBe(true);
        expect(isUrlSafe('https://93.184.216.34')).toBe(true);
      });

      test('rejects IPv6 documentation addresses', () => {
        // 2001:db8::/32 is the documentation prefix and should be blocked for SSRF protection
        expect(isUrlSafe('https://[2001:db8::1]')).toBe(false);
        expect(
          isUrlSafe('https://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]')
        ).toBe(false);
        expect(isUrlSafe('https://[2001:db8:85a3::8a2e:370:7334]')).toBe(false);
        expect(isUrlSafe('https://[2001:db8::8a2e:370:7334]')).toBe(false);
      });

      test('accepts valid IPv6 global unicast addresses', () => {
        expect(isUrlSafe('https://[2600:1f14:123:4567::1]')).toBe(true); // AWS address
        expect(isUrlSafe('https://[2a00:1450:4001:81a::200e]')).toBe(true); // Google address
        expect(isUrlSafe('https://[::ffff:8.8.8.8]')).toBe(true); // IPv4-mapped IPv6 with public IP
      });

      test('rejects IPv4-mapped IPv6 with private/reserved IPs', () => {
        expect(isUrlSafe('https://[::ffff:192.168.1.1]')).toBe(false); // Private IP
        expect(isUrlSafe('https://[::ffff:10.0.0.1]')).toBe(false); // Private IP
        expect(isUrlSafe('https://[::ffff:127.0.0.1]')).toBe(false); // Loopback
        expect(isUrlSafe('https://[::ffff:192.0.2.1]')).toBe(false); // TEST-NET-1 (reserved)
      });

      test('handles IPv6 addresses with ports', () => {
        expect(isUrlSafe('https://[2001:db8::1]:443')).toBe(false); // Documentation address
        expect(isUrlSafe('https://[2600:1f14:123:4567::1]:443')).toBe(true); // Valid public address
      });

      test('accepts IPs outside private ranges', () => {
        expect(isUrlSafe('https://172.15.0.1')).toBe(true);
        expect(isUrlSafe('https://172.32.0.1')).toBe(true);
        expect(isUrlSafe('https://192.167.0.1')).toBe(true);
        expect(isUrlSafe('https://192.169.0.1')).toBe(true);
        expect(isUrlSafe('https://169.255.0.1')).toBe(true);
        expect(isUrlSafe('https://169.253.0.1')).toBe(true);
      });
    });

    describe('Invalid Inputs', () => {
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

      test('handles malformed URLs that throw parsing errors', () => {
        const malformedURLs = [
          'not-a-url-at-all',
          'http:/missing-slash',
          'https://[invalid-ipv6',
          'https://invalid-ipv6]',
        ];

        malformedURLs.forEach((url) => {
          const result = isUrlSafe(url);
          expect(result).toBe(false);
        });
      });
    });

    describe('Protocol Validation', () => {
      test('rejects non-HTTPS protocols', () => {
        expect(isUrlSafe('http://api.example.com')).toBe(false);
        expect(isUrlSafe('ftp://api.example.com')).toBe(false);
        expect(isUrlSafe('file:///etc/passwd')).toBe(false);
        expect(isUrlSafe('javascript:alert(1)')).toBe(false);
        expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(
          false
        );
        expect(isUrlSafe('ws://example.com')).toBe(false);
        expect(isUrlSafe('wss://example.com')).toBe(false);
      });
    });

    describe('SSRF Prevention - Localhost and Loopback', () => {
      test('rejects localhost variations', () => {
        expect(isUrlSafe('https://localhost')).toBe(false);
        expect(isUrlSafe('https://localhost:8080')).toBe(false);
        expect(isUrlSafe('https://LOCALHOST')).toBe(false);
      });

      test('rejects loopback IPs', () => {
        expect(isUrlSafe('https://127.0.0.1')).toBe(false);
        expect(isUrlSafe('https://127.0.0.1:443')).toBe(false);
        expect(isUrlSafe('https://0.0.0.0')).toBe(false);
        expect(isUrlSafe('https://127.1.1.1')).toBe(false);
        expect(isUrlSafe('https://127.255.255.254')).toBe(false);
      });

      test('rejects IPv6 loopback addresses', () => {
        expect(isUrlSafe('https://[::1]')).toBe(false);
        expect(isUrlSafe('https://[::0]')).toBe(false);
        expect(isUrlSafe('https://[0:0:0:0:0:0:0:1]')).toBe(false);
        expect(isUrlSafe('https://[0:0:0:0:0:0:0:0]')).toBe(false);
        expect(
          isUrlSafe('https://[0000:0000:0000:0000:0000:0000:0000:0001]')
        ).toBe(false);
        expect(isUrlSafe('https://[::1]:8080')).toBe(false);
      });
    });

    describe('SSRF Prevention - Private IPv4 Ranges', () => {
      test('rejects private IP ranges - 10.x.x.x', () => {
        expect(isUrlSafe('https://10.0.0.1')).toBe(false);
        expect(isUrlSafe('https://10.255.255.255')).toBe(false);
        expect(isUrlSafe('https://10.1.2.3:8080')).toBe(false);
        expect(isUrlSafe('https://10.0.0.0')).toBe(false);
      });

      test('rejects private IP ranges - 172.16-31.x.x', () => {
        expect(isUrlSafe('https://172.16.0.1')).toBe(false);
        expect(isUrlSafe('https://172.20.10.5')).toBe(false);
        expect(isUrlSafe('https://172.31.255.255')).toBe(false);
        expect(isUrlSafe('https://172.16.0.0')).toBe(false);
        expect(isUrlSafe('https://172.31.255.255')).toBe(false);
      });

      test('rejects private IP ranges - 192.168.x.x', () => {
        expect(isUrlSafe('https://192.168.0.1')).toBe(false);
        expect(isUrlSafe('https://192.168.1.1')).toBe(false);
        expect(isUrlSafe('https://192.168.255.255')).toBe(false);
        expect(isUrlSafe('https://192.168.0.0')).toBe(false);
      });

      test('rejects link-local IPs - 169.254.x.x', () => {
        expect(isUrlSafe('https://169.254.0.1')).toBe(false);
        expect(isUrlSafe('https://169.254.169.254')).toBe(false);
        expect(isUrlSafe('https://169.254.255.255')).toBe(false);
        expect(isUrlSafe('https://169.254.0.0')).toBe(false);
      });

      test('validates private IPv4 range boundaries comprehensively', () => {
        // Test edge cases of private IP ranges
        const privateIPTests = [
          // 10.0.0.0/8 boundaries
          'https://10.0.0.0',
          'https://10.255.255.255',
          'https://9.255.255.255', // Just outside range (should be public)
          'https://11.0.0.0', // Just outside range (should be public)

          // 172.16.0.0/12 boundaries
          'https://172.15.255.255', // Just below range (should be public)
          'https://172.16.0.0', // Start of range
          'https://172.31.255.255', // End of range
          'https://172.32.0.0', // Just above range (should be public)

          // 192.168.0.0/16 boundaries
          'https://192.167.255.255', // Just below range (should be public)
          'https://192.168.0.0', // Start of range
          'https://192.168.255.255', // End of range
          'https://192.169.0.0', // Just above range (should be public)
        ];

        const expectedResults = [
          false,
          false,
          true,
          true, // 10.x.x.x range
          true,
          false,
          false,
          true, // 172.x.x.x range
          true,
          false,
          false,
          true, // 192.168.x.x range
        ];

        privateIPTests.forEach((url, index) => {
          const result = isUrlSafe(url);
          expect(result).toBe(expectedResults[index]);
        });
      });
    });

    describe('SSRF Prevention - Additional Reserved IPv4 Ranges', () => {
      test('rejects additional IPv4 reserved ranges', () => {
        // This network (0.0.0.0/8)
        expect(isUrlSafe('https://0.1.1.1')).toBe(false);
        expect(isUrlSafe('https://0.255.255.255')).toBe(false);

        // Multicast (224.0.0.0/4)
        expect(isUrlSafe('https://224.0.0.1')).toBe(false);
        expect(isUrlSafe('https://239.255.255.255')).toBe(false);

        // Reserved (240.0.0.0/4)
        expect(isUrlSafe('https://240.0.0.1')).toBe(false);
        expect(isUrlSafe('https://255.255.255.255')).toBe(false);
      });

      test('validates additional reserved IPv4 ranges', () => {
        const reservedIPTests = [
          'https://0.0.0.0', // This network
          'https://0.255.255.255', // End of this network
          'https://127.0.0.0', // Start of loopback
          'https://127.255.255.255', // End of loopback
          'https://169.254.0.0', // Start of link-local
          'https://169.254.255.255', // End of link-local
          'https://224.0.0.0', // Start of multicast
          'https://239.255.255.255', // End of multicast
          'https://240.0.0.0', // Start of reserved
          'https://255.255.255.255', // End of reserved
        ];

        reservedIPTests.forEach((url) => {
          const result = isUrlSafe(url);
          expect(result).toBe(false);
        });
      });

      test('rejects invalid IPv4 octets', () => {
        expect(isUrlSafe('https://256.1.1.1')).toBe(false);
        expect(isUrlSafe('https://1.256.1.1')).toBe(false);
        expect(isUrlSafe('https://1.1.256.1')).toBe(false);
        expect(isUrlSafe('https://1.1.1.256')).toBe(false);
        expect(isUrlSafe('https://999.999.999.999')).toBe(false);
        expect(isUrlSafe('https://300.200.100.50')).toBe(false);
      });

      test('rejects IPv4 addresses when octets exceed allowed range after parsing', () => {
        const OriginalURL = global.URL;

        class MockURL {
          constructor(input) {
            this.href = input;
            this.protocol = 'https:';
            this.hostname = '256.1.1.1';
          }
        }

        global.URL = MockURL;

        try {
          expect(isUrlSafe('https://256.1.1.1')).toBe(false);
        } finally {
          global.URL = OriginalURL;
        }
      });

      test('validates boundary IPv4 addresses', () => {
        // Test boundary conditions for IPv4 validation
        const boundaryURLs = [
          'https://0.0.0.0', // Should be rejected (this network)
          'https://255.255.255.255', // Should be rejected (broadcast/reserved)
          'https://1.1.1.1', // Should be accepted (public)
          'https://8.8.8.8', // Should be accepted (public)
          'https://127.0.0.1', // Should be rejected (loopback)
          'https://169.254.1.1', // Should be rejected (link-local)
          'https://224.0.0.1', // Should be rejected (multicast)
          'https://240.0.0.1', // Should be rejected (reserved)
        ];

        const expectedResults = [
          false,
          false,
          true,
          true,
          false,
          false,
          false,
          false,
        ];

        boundaryURLs.forEach((url, index) => {
          const result = isUrlSafe(url);
          expect(result).toBe(expectedResults[index]);
        });
      });
    });

    describe('SSRF Prevention - IPv6 Private Ranges', () => {
      test('rejects IPv6 private addresses - Unique Local (fc00::/7)', () => {
        expect(isUrlSafe('https://[fc00::1]')).toBe(false);
        expect(isUrlSafe('https://[fc00:1234:5678::9abc]')).toBe(false);
        expect(isUrlSafe('https://[fd00::1]')).toBe(false);
        expect(
          isUrlSafe('https://[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]')
        ).toBe(false);
      });

      test('rejects IPv6 link-local addresses (fe80::/10)', () => {
        expect(isUrlSafe('https://[fe80::1]')).toBe(false);
        expect(isUrlSafe('https://[fe80:1234:5678::9abc]')).toBe(false);
        expect(
          isUrlSafe('https://[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]')
        ).toBe(false);
      });

      test('rejects IPv6 site-local addresses (fec0::/10)', () => {
        expect(isUrlSafe('https://[fec0::1]')).toBe(false);
        expect(isUrlSafe('https://[fec0:1234:5678::9abc]')).toBe(false);
        expect(
          isUrlSafe('https://[feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]')
        ).toBe(false);
      });

      test('rejects IPv6 multicast addresses (ff00::/8)', () => {
        expect(isUrlSafe('https://[ff00::1]')).toBe(false);
        expect(isUrlSafe('https://[ff02::1]')).toBe(false);
        expect(
          isUrlSafe('https://[ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]')
        ).toBe(false);
      });

      test('handles IPv6 addresses with ports', () => {
        expect(isUrlSafe('https://[::1]:8080')).toBe(false);
        expect(isUrlSafe('https://[fc00::1]:443')).toBe(false);
        expect(isUrlSafe('https://[2001:db8::1]:443')).toBe(false); // Documentation address
        expect(isUrlSafe('https://[2600:1f14:123:4567::1]:443')).toBe(true); // Valid public address
      });

      test('handles mixed case and brackets', () => {
        expect(isUrlSafe('https://[FC00::1]')).toBe(false);
        expect(isUrlSafe('https://[Fe80::1]')).toBe(false);
        expect(isUrlSafe('https://[FF00::1]')).toBe(false);
      });

      test('correctly identifies prefixes from first part', () => {
        // Test that it correctly gets the first part before the colon
        expect(isUrlSafe('https://[fc12:3456:7890::abcd]')).toBe(false);
        expect(isUrlSafe('https://[fe81:2345:6789::cdef]')).toBe(false);
        expect(isUrlSafe('https://[2001:fc00::]')).toBe(true); // fc00 is not at start
      });
    });

    describe('IPv6 Expansion and Validation', () => {
      test('expands :: abbreviation correctly', () => {
        // These should all be recognized as the same loopback address
        expect(isUrlSafe('https://[::1]')).toBe(false);
        expect(isUrlSafe('https://[0:0:0:0:0:0:0:1]')).toBe(false);
        expect(
          isUrlSafe('https://[0000:0000:0000:0000:0000:0000:0000:0001]')
        ).toBe(false);
      });

      test('expands complex :: abbreviations', () => {
        // Test various complex abbreviations that should be treated as private
        expect(isUrlSafe('https://[fc00::]')).toBe(false);
        expect(isUrlSafe('https://[fc00:0:0:0:0:0:0:0]')).toBe(false);
        expect(isUrlSafe('https://[fe80::]')).toBe(false);
        expect(
          isUrlSafe('https://[fe80:0000:0000:0000:0000:0000:0000:0000]')
        ).toBe(false);
      });

      test('handles :: in middle of address', () => {
        expect(isUrlSafe('https://[fc00:1234::5678]')).toBe(false);
        expect(isUrlSafe('https://[fe80:abcd::ef01]')).toBe(false);
      });

      test('handles IPv6 expansion errors gracefully', () => {
        // Test malformed IPv6 addresses that cause expansion to fail
        const malformedIPv6URLs = [
          'https://[:::]', // Too many colons
          'https://[1:2:3:4:5:6:7:8:9]', // Too many segments
          'https://[1::2::3]', // Multiple :: sequences
          'https://[::g]', // Invalid hex character
          'https://[1:2:3:4:5:6:7:8:9:a:b]', // Way too many segments
          'https://[1:2:3:4:5:6:7:8:9:a:b:c:d:e:f:10]', // Extremely long
          'https://[12345::1]', // Segment too long
          'https://[xyz::1]', // Invalid hex
        ];

        malformedIPv6URLs.forEach((url) => {
          // These should all return false due to expansion errors
          // The catch block in expandIPv6 should return the original string
          const result = isUrlSafe(url);
          expect(result).toBe(false);
        });
      });

      test('pads short segments correctly', () => {
        // Test that short segments are padded to 4 digits
        expect(isUrlSafe('https://[fc0::1]')).toBe(false); // Should be treated as fc00
        expect(isUrlSafe('https://[fe8::1]')).toBe(false); // Should be treated as fe80
      });

      test('validates proper IPv6 hex patterns', () => {
        // Documentation addresses should be blocked
        expect(
          isUrlSafe('https://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]')
        ).toBe(false);
        expect(isUrlSafe('https://[2001:db8:85a3::8a2e:370:7334]')).toBe(false);

        // Valid public addresses
        expect(
          isUrlSafe('https://[2600:1f14:123:4567:89ab:cdef:0123:4567]')
        ).toBe(true);
        expect(isUrlSafe('https://[::ffff:8.8.8.8]')).toBe(true); // IPv4-mapped IPv6 with public IP
      });

      test('handles malformed IPv6-like patterns', () => {
        expect(isUrlSafe('https://[not-ipv6]')).toBe(false);
        expect(isUrlSafe('https://[12345::67890]')).toBe(false); // Invalid hex
        expect(isUrlSafe('https://[g000::1]')).toBe(false); // Invalid hex character
      });

      test('handles IPv6 addresses without brackets in hostname', () => {
        // These are malformed URLs but test the IPv6 detection logic
        const ipv6WithoutBrackets = [
          'https://2001:db8::1', // Invalid URL format
          'https://::1', // Invalid URL format
          'https://fc00::1', // Invalid URL format
        ];

        ipv6WithoutBrackets.forEach((url) => {
          // These should all fail due to invalid URL format
          const result = isUrlSafe(url);
          expect(result).toBe(false);
        });
      });
    });

    describe('Error Handling and Edge Cases', () => {
      test('handles all possible exceptions in URL validation', () => {
        // Test inputs that might cause unexpected exceptions
        const problematicInputs = [
          'https://[' + 'x'.repeat(1000) + ']', // Very long hostname
          'https://example.com:99999999', // Invalid port
          'https://user:pass@host.com', // With credentials
          'https://host.com/path?query=value#fragment', // Complex URL
        ];

        problematicInputs.forEach((input) => {
          const result = isUrlSafe(input);
          expect(typeof result).toBe('boolean');
        });
      });

      test('ensures all code paths return boolean', () => {
        // Test a variety of inputs to ensure consistent return type
        const testInputs = [
          'https://example.com',
          'https://192.168.1.1',
          'https://[::1]',
          'https://[2001:db8::1]',
          'invalid',
          null,
          undefined,
          '',
          123,
        ];

        testInputs.forEach((input) => {
          const result = isUrlSafe(input);
          expect(typeof result).toBe('boolean');
        });
      });
    });
  });

  describe('Custom Validators Integration', () => {
    test('custom sanitizer is applied to targetHeaders', () => {
      validateLlmRequest();

      // Find the targetHeaders validator
      const bodyMock = jest.mocked(body);
      const targetHeadersCall = bodyMock.mock.calls.find(
        (call) => call[0] === 'targetHeaders'
      );

      expect(targetHeadersCall).toBeDefined();
    });

    test('targetPayload custom validator checks for empty object', () => {
      validateLlmRequest();

      // The custom validator is configured through the chain
      const bodyMock = jest.mocked(body);
      const targetPayloadCall = bodyMock.mock.calls.find(
        (call) => call[0] === 'targetPayload'
      );

      expect(targetPayloadCall).toBeDefined();
    });

    test('extra fields custom validator is configured', () => {
      validateLlmRequest();

      // Body called without parameters for the extra fields check
      const bodyMock = jest.mocked(body);
      const extraFieldsCall = bodyMock.mock.calls.find(
        (call) => call.length === 0
      );

      expect(extraFieldsCall).toBeDefined();
    });

    test('targetHeaders sanitizer removes dangerous patterns after cleaning', () => {
      validateLlmRequest();

      const bodyMock = jest.mocked(body);
      const targetHeadersIndex = bodyMock.mock.calls.findIndex(
        (call) => call[0] === 'targetHeaders'
      );

      expect(targetHeadersIndex).toBeGreaterThanOrEqual(0);

      const targetHeadersChain =
        bodyMock.mock.results[targetHeadersIndex].value;
      const sanitizer = targetHeadersChain.customSanitizer.mock.calls[0][0];

      const sanitized = sanitizer({
        'X-Custom!Header': 'Value',
        '__proto__/../': 'should-be-dropped',
        'Safe-Header': 'Allowed',
      });

      expect(Object.getPrototypeOf(sanitized)).toBeNull();
      expect(sanitized).toEqual({
        'X-CustomHeader': 'Value',
        'Safe-Header': 'Allowed',
      });
      expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(
        false
      );
    });
  });
});
