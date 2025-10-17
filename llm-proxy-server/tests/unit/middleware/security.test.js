/**
 * @file Unit tests for enhanced security middleware
 * @description Tests for CSP nonces, enhanced headers, and security configuration validation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  createSecurityMiddleware,
  createCSPNonceMiddleware,
  createSecurityConfigValidator,
} from '../../../src/middleware/security.js';

const helmetConfigHistory = [];
var mockDefaultHelmetImplementation;

// Mock helmet module
jest.mock('helmet', () => {
  mockDefaultHelmetImplementation = (config) => {
    helmetConfigHistory.push(config);
    return (req, res, next) => {
      // Mock helmet middleware behavior
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    };
  };

  return jest.fn(mockDefaultHelmetImplementation);
});

describe('Enhanced Security Middleware', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      originalUrl: '/test',
      method: 'GET',
    };

    mockResponse = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
      getHeader: jest.fn(),
      on: jest.fn(),
      locals: {},
    };

    mockNext = jest.fn();

    helmetConfigHistory.length = 0;
    const helmetMock = require('helmet');
    helmetMock.mockClear();
    helmetMock.mockImplementation(mockDefaultHelmetImplementation);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSecurityMiddleware', () => {
    it('should apply enhanced security headers with default options', () => {
      const middleware = createSecurityMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      // Check that nonce was generated
      expect(mockRequest.cspNonce).toBeDefined();
      expect(typeof mockRequest.cspNonce).toBe('string');
      expect(mockRequest.cspNonce.length).toBe(16);

      // Check that nonce is attached to response locals
      expect(mockResponse.locals.cspNonce).toBe(mockRequest.cspNonce);

      // Check that enhanced security headers are set
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        expect.stringContaining('accelerometer=()')
      );
      // Note: Clear-Site-Data header intentionally removed to prevent CORS credential conflicts
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Expect-CT',
        'max-age=86400, enforce'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');

      // Check that CSP nonce header is set
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-CSP-Nonce',
        mockRequest.cspNonce
      );

      // Check that security timestamp is set
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Security-Applied',
        expect.any(String)
      );

      // Check that server headers are removed
      expect(mockResponse.removeHeader).toHaveBeenCalledWith('Server');
      expect(mockResponse.removeHeader).toHaveBeenCalledWith('X-Powered-By');

      expect(mockNext).toHaveBeenCalled();
    });

    it('should disable nonce generation when enableNonce is false', () => {
      const middleware = createSecurityMiddleware({ enableNonce: false });

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.cspNonce).toBeNull();
      expect(mockResponse.locals.cspNonce).toBeNull();
      expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
        'X-CSP-Nonce',
        expect.any(String)
      );
    });

    it('should use strict CSP when strictCSP is true', () => {
      const middleware = createSecurityMiddleware({
        enableNonce: false,
        strictCSP: true,
      });

      middleware(mockRequest, mockResponse, mockNext);

      // With strict CSP and no nonce, unsafe-inline should not be added
      expect(mockNext).toHaveBeenCalled();
    });

    it('should add unsafe-inline to styles when not using strict CSP and no nonce', () => {
      const middleware = createSecurityMiddleware({
        enableNonce: false,
        strictCSP: false,
      });

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle helmet errors gracefully', () => {
      // Mock helmet to throw an error
      const helmetModule = require('helmet');
      helmetModule.mockImplementationOnce(() => (req, res, next) => {
        next(new Error('Helmet configuration error'));
      });

      const middleware = createSecurityMiddleware();
      const mockError = new Error('Helmet configuration error');

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });

    it('should append nonce directives to CSP sources when enabled', () => {
      const middleware = createSecurityMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      const config = helmetConfigHistory.at(-1);
      expect(config).toBeDefined();
      const { scriptSrc, styleSrc } = config.contentSecurityPolicy.directives;

      expect(scriptSrc.some((value) => value.startsWith("'nonce-"))).toBe(true);
      expect(styleSrc.some((value) => value.startsWith("'nonce-"))).toBe(true);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(styleSrc).not.toContain("'unsafe-inline'");
    });

    it('should add unsafe-inline style fallback only when nonce disabled and CSP relaxed', () => {
      const middleware = createSecurityMiddleware({
        enableNonce: false,
        strictCSP: false,
      });

      middleware(mockRequest, mockResponse, mockNext);

      const config = helmetConfigHistory.at(-1);
      expect(config).toBeDefined();
      const { scriptSrc, styleSrc } = config.contentSecurityPolicy.directives;

      expect(styleSrc).toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('should not add unsafe-inline when strict CSP is enforced without nonce', () => {
      const middleware = createSecurityMiddleware({
        enableNonce: false,
        strictCSP: true,
      });

      middleware(mockRequest, mockResponse, mockNext);

      const config = helmetConfigHistory.at(-1);
      expect(config).toBeDefined();
      const { scriptSrc, styleSrc } = config.contentSecurityPolicy.directives;

      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(styleSrc).not.toContain("'unsafe-inline'");
    });

    it('should generate unique nonces for each request', () => {
      const middleware = createSecurityMiddleware();

      const req1 = { ...mockRequest };
      const res1 = {
        ...mockResponse,
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
        locals: {},
      };
      const req2 = { ...mockRequest };
      const res2 = {
        ...mockResponse,
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
        locals: {},
      };

      middleware(req1, res1, mockNext);
      middleware(req2, res2, mockNext);

      expect(req1.cspNonce).not.toBe(req2.cspNonce);
      expect(req1.cspNonce).toBeDefined();
      expect(req2.cspNonce).toBeDefined();
    });

    it('should set comprehensive Permissions-Policy header', () => {
      const middleware = createSecurityMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      const permissionsPolicyCall = mockResponse.setHeader.mock.calls.find(
        (call) => call[0] === 'Permissions-Policy'
      );

      expect(permissionsPolicyCall).toBeDefined();
      const permissionsPolicy = permissionsPolicyCall[1];

      // Check that key permissions are disabled
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
      expect(permissionsPolicy).toContain('payment=()');
      expect(permissionsPolicy).toContain('usb=()');
    });

    it('should set security timestamp in ISO format', () => {
      const beforeTime = new Date();
      const middleware = createSecurityMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      const afterTime = new Date();

      const timestampCall = mockResponse.setHeader.mock.calls.find(
        (call) => call[0] === 'X-Security-Applied'
      );

      expect(timestampCall).toBeDefined();
      const timestamp = new Date(timestampCall[1]);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('createCSPNonceMiddleware', () => {
    it('should generate nonce with default length', () => {
      const middleware = createCSPNonceMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.cspNonce).toBeDefined();
      expect(mockRequest.cspNonce.length).toBe(16);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-CSP-Nonce',
        mockRequest.cspNonce
      );
    });

    it('should generate nonce with custom length', () => {
      const customLength = 24;
      const middleware = createCSPNonceMiddleware({
        nonceLength: customLength,
      });

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.cspNonce.length).toBe(customLength);
    });

    it('should attach nonce to response locals', () => {
      const middleware = createCSPNonceMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.locals.cspNonce).toBe(mockRequest.cspNonce);
    });

    it('should generate cryptographically secure nonces', () => {
      const middleware = createCSPNonceMiddleware();
      const nonces = new Set();

      // Generate multiple nonces to check for uniqueness
      for (let i = 0; i < 100; i++) {
        const req = { ...mockRequest };
        const res = { ...mockResponse, setHeader: jest.fn(), locals: {} };

        middleware(req, res, mockNext);
        nonces.add(req.cspNonce);
      }

      // All nonces should be unique
      expect(nonces.size).toBe(100);

      // Nonces should only contain valid characters
      nonces.forEach((nonce) => {
        expect(nonce).toMatch(/^[a-fA-F0-9]+$/);
      });
    });

    it('should handle edge case nonce lengths', () => {
      const testCases = [1, 8, 32, 64];

      testCases.forEach((length) => {
        const middleware = createCSPNonceMiddleware({ nonceLength: length });
        const req = { ...mockRequest };
        const res = { ...mockResponse, setHeader: jest.fn(), locals: {} };

        middleware(req, res, mockNext);

        expect(req.cspNonce.length).toBe(length);
      });
    });
  });

  describe('createSecurityConfigValidator', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
      };
    });

    it('should validate presence of required security headers', () => {
      const middleware = createSecurityConfigValidator({ logger: mockLogger });

      // Mock response with all required headers
      mockResponse.getHeader = jest.fn((headerName) => {
        const headers = {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Strict-Transport-Security': 'max-age=31536000',
          'Content-Security-Policy': "default-src 'self'",
        };
        return headers[headerName];
      });

      middleware(mockRequest, mockResponse, mockNext);

      // Simulate response finish event
      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should warn about missing security headers', () => {
      const middleware = createSecurityConfigValidator({ logger: mockLogger });

      // Mock response with missing headers
      mockResponse.getHeader = jest.fn(() => undefined);

      middleware(mockRequest, mockResponse, mockNext);

      // Simulate response finish event
      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing required security headers',
        expect.objectContaining({
          missingHeaders: expect.arrayContaining([
            'X-Content-Type-Options',
            'X-Frame-Options',
            'Strict-Transport-Security',
            'Content-Security-Policy',
          ]),
        })
      );
    });

    it('should include correlation ID in warning logs', () => {
      const correlationId = 'test-correlation-id';
      mockRequest.correlationId = correlationId;

      const middleware = createSecurityConfigValidator({ logger: mockLogger });
      mockResponse.getHeader = jest.fn(() => undefined);

      middleware(mockRequest, mockResponse, mockNext);

      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing required security headers',
        expect.objectContaining({
          correlationId,
        })
      );
    });

    it('should handle partial header coverage', () => {
      const middleware = createSecurityConfigValidator({ logger: mockLogger });

      // Mock response with some headers present
      mockResponse.getHeader = jest.fn((headerName) => {
        const headers = {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          // Missing HSTS and CSP
        };
        return headers[headerName];
      });

      middleware(mockRequest, mockResponse, mockNext);

      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing required security headers',
        expect.objectContaining({
          missingHeaders: [
            'Strict-Transport-Security',
            'Content-Security-Policy',
          ],
        })
      );
    });

    it('should use console as default logger', () => {
      const originalWarn = console.warn;
      console.warn = jest.fn();

      try {
        const middleware = createSecurityConfigValidator(); // No logger provided
        mockResponse.getHeader = jest.fn(() => undefined);

        middleware(mockRequest, mockResponse, mockNext);

        const finishHandler = mockResponse.on.mock.calls.find(
          (call) => call[0] === 'finish'
        )[1];
        finishHandler();

        expect(console.warn).toHaveBeenCalled();
      } finally {
        console.warn = originalWarn;
      }
    });

    it('should handle response finish event listener errors gracefully', () => {
      const middleware = createSecurityConfigValidator({ logger: mockLogger });

      // Mock getHeader to throw an error
      mockResponse.getHeader = jest.fn(() => {
        throw new Error('Header access error');
      });

      expect(() => {
        middleware(mockRequest, mockResponse, mockNext);

        const finishHandler = mockResponse.on.mock.calls.find(
          (call) => call[0] === 'finish'
        )[1];
        finishHandler();
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should log descriptive metadata when header inspection throws', () => {
      const middleware = createSecurityConfigValidator({ logger: mockLogger });

      const failure = new Error('Header retrieval failure');
      mockResponse.getHeader = jest.fn(() => {
        throw failure;
      });

      middleware(mockRequest, mockResponse, mockNext);

      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking security headers',
        expect.objectContaining({
          error: failure.message,
          url: mockRequest.originalUrl,
          method: mockRequest.method,
        })
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Integration tests', () => {
    it('should work together with security validation middleware', () => {
      const securityMiddleware = createSecurityMiddleware();
      const validatorMiddleware = createSecurityConfigValidator();

      // Apply security middleware first
      securityMiddleware(mockRequest, mockResponse, () => {
        // Then apply validator
        validatorMiddleware(mockRequest, mockResponse, mockNext);
      });

      expect(mockRequest.cspNonce).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should maintain nonce consistency across middleware', () => {
      const securityMiddleware = createSecurityMiddleware();
      const nonceMiddleware = createCSPNonceMiddleware();

      securityMiddleware(mockRequest, mockResponse, () => {
        const originalNonce = mockRequest.cspNonce;

        // Reset for second middleware
        const req2 = { ...mockRequest };
        const res2 = { ...mockResponse, setHeader: jest.fn(), locals: {} };

        nonceMiddleware(req2, res2, mockNext);

        // Nonces should be different (each middleware generates its own)
        expect(req2.cspNonce).not.toBe(originalNonce);
      });
    });

    it('should handle concurrent requests safely', async () => {
      const middleware = createSecurityMiddleware();
      const requests = [];

      // Create multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        const req = { ...mockRequest };
        const res = {
          ...mockResponse,
          setHeader: jest.fn(),
          removeHeader: jest.fn(),
          locals: {},
        };

        requests.push({ req, res });
      }

      // Process all requests
      const promises = requests.map(({ req, res }) => {
        return new Promise((resolve) => {
          middleware(req, res, resolve);
        });
      });

      await Promise.all(promises);

      // All requests should have unique nonces
      const nonces = requests.map(({ req }) => req.cspNonce);
      const uniqueNonces = new Set(nonces);

      expect(uniqueNonces.size).toBe(requests.length);
    });
  });

  describe('Performance considerations', () => {
    it('should complete middleware execution quickly', () => {
      const middleware = createSecurityMiddleware();

      const startTime = performance.now();
      middleware(mockRequest, mockResponse, mockNext);
      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(50); // 50ms threshold
    });

    it('should handle high frequency requests efficiently', () => {
      const middleware = createSecurityMiddleware();
      const requestCount = 1000;

      const startTime = performance.now();

      for (let i = 0; i < requestCount; i++) {
        const req = { ...mockRequest };
        const res = {
          ...mockResponse,
          setHeader: jest.fn(),
          removeHeader: jest.fn(),
          locals: {},
        };

        middleware(req, res, mockNext);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / requestCount;

      // Average time per request should be minimal
      expect(avgTime).toBeLessThan(1); // 1ms per request
    });
  });
});
