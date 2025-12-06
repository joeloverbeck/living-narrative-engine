/**
 * @file Unit tests for security validation middleware
 * @description Comprehensive test coverage for security headers validation, correlation IDs, and security event logging
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
  createSecurityValidationMiddleware,
  createCSPNonceMiddleware,
  SecurityValidationUtils,
} from '../../../src/middleware/securityValidation.js';

describe('Security Validation Middleware', () => {
  let mockLogger;
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockRequest = {
      headers: {},
      originalUrl: '/test',
      method: 'GET',
      ip: '192.0.2.1',
    };

    mockResponse = {
      setHeader: jest.fn(),
      status: jest.fn(() => mockResponse),
      json: jest.fn(),
      locals: {},
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSecurityValidationMiddleware', () => {
    describe('Correlation ID generation', () => {
      it('should generate new correlation ID when none exists', () => {
        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });

        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.correlationId).toBeDefined();
        expect(typeof mockRequest.correlationId).toBe('string');
        expect(mockRequest.correlationId.length).toBeGreaterThan(0);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'X-Correlation-ID',
          mockRequest.correlationId
        );
        expect(mockNext).toHaveBeenCalled();
      });

      it('should use existing valid correlation ID from headers', () => {
        const existingId = 'test-correlation-12345';
        mockRequest.headers['x-correlation-id'] = existingId;

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.correlationId).toBe(existingId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'X-Correlation-ID',
          existingId
        );
      });

      it('should generate new ID for invalid correlation ID', () => {
        mockRequest.headers['x-correlation-id'] =
          'invalid-id-with-special-chars!@#';

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.correlationId).not.toBe(
          'invalid-id-with-special-chars!@#'
        );
        expect(mockRequest.correlationId).toMatch(/^[a-fA-F0-9\-]{36}$/); // UUID format
      });

      it('should handle x-request-id header as alternative', () => {
        const existingId = 'req-12345678';
        mockRequest.headers['x-request-id'] = existingId;

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.correlationId).toBe(existingId);
      });
    });

    describe('Security headers validation', () => {
      it('should pass validation for clean headers', () => {
        mockRequest.headers = {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Test Browser)',
          accept: 'application/json',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.isValid).toBe(true);
        expect(mockRequest.securityValidation.securityScore).toBeGreaterThan(
          70
        );
        expect(mockNext).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Security validation passed',
          expect.objectContaining({
            correlationId: expect.any(String),
            securityScore: expect.any(Number),
          })
        );
      });

      it('should accept valid CSP headers without logging errors', () => {
        mockRequest.headers = {
          'content-security-policy': "default-src 'self'",
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.errors).toEqual(
          expect.not.arrayContaining([
            expect.objectContaining({ type: 'INVALID_CSP' }),
          ])
        );
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          'Security validation errors detected',
          expect.anything()
        );
      });

      it('should detect suspicious patterns in headers', () => {
        mockRequest.headers = {
          'x-custom-header': '<script>alert("xss")</script>',
          'user-agent': 'eval(malicious_code)',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(
          mockRequest.securityValidation.suspiciousPatterns.length
        ).toBeGreaterThan(0);
        expect(mockRequest.securityValidation.securityScore).toBeLessThan(100);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Suspicious security patterns detected',
          expect.objectContaining({
            suspiciousPatterns: expect.any(Array),
          })
        );
      });

      it('should flag headers with names that exceed the maximum length', () => {
        const longHeaderName = `x-${'h'.repeat(
          SecurityValidationUtils.SECURITY_CONFIG.MAX_HEADER_NAME_LENGTH + 1
        )}`;
        mockRequest.headers = {
          [longHeaderName]: 'value',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'HEADER_NAME_TOO_LONG',
              header: longHeaderName,
            }),
          ])
        );
      });

      it('should detect excessive headers', () => {
        // Create 101 headers to exceed the limit
        const excessiveHeaders = {};
        for (let i = 0; i < 101; i++) {
          excessiveHeaders[`header-${i}`] = `value-${i}`;
        }
        mockRequest.headers = excessiveHeaders;

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.isValid).toBe(false);
        expect(mockRequest.securityValidation.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'EXCESSIVE_HEADERS',
            }),
          ])
        );
      });

      it('should validate CSP headers correctly', () => {
        mockRequest.headers = {
          'content-security-policy':
            "default-src 'self'; script-src 'unsafe-eval'",
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'INVALID_CSP',
              reason: 'Unsafe CSP directive detected',
            }),
          ])
        );
      });

      it('should detect host header injection attempts', () => {
        mockRequest.headers = {
          host: 'evil.com"><script>alert("xss")</script>',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'HOST_HEADER_INJECTION',
            }),
          ])
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Security validation errors detected',
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({ type: 'HOST_HEADER_INJECTION' }),
            ]),
          })
        );
      });

      it('should treat standard host headers as safe', () => {
        mockRequest.headers = {
          host: 'api.example.com',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.errors).toEqual(
          expect.not.arrayContaining([
            expect.objectContaining({ type: 'HOST_HEADER_INJECTION' }),
          ])
        );
      });

      it('should check x-forwarded-host header for injection attempts', () => {
        mockRequest.headers = {
          'x-forwarded-host': "legit-site.com'><script>1</script>",
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'HOST_HEADER_INJECTION' }),
          ])
        );
      });

      it('should validate IP headers', () => {
        mockRequest.headers = {
          'x-forwarded-for': 'invalid-ip-address!@#',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'SUSPICIOUS_IP_HEADER',
            }),
          ])
        );
      });

      it('should accept valid forwarded IP headers', () => {
        mockRequest.headers = {
          'x-forwarded-for': '203.0.113.1, 2001:db8::1',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.not.arrayContaining([
            expect.objectContaining({ type: 'SUSPICIOUS_IP_HEADER' }),
          ])
        );
      });

      it('should check for missing security headers', () => {
        mockRequest.headers = {
          'content-type': 'application/json',
          // Missing security headers
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings.length).toBeGreaterThan(
          0
        );
        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'MISSING_SECURITY_HEADER',
            }),
          ])
        );
      });

      it('should not warn when required security headers are present', () => {
        mockRequest.headers = {
          'strict-transport-security': 'max-age=63072000; includeSubDomains',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'x-xss-protection': '1; mode=block',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.not.arrayContaining([
            expect.objectContaining({ type: 'MISSING_SECURITY_HEADER' }),
          ])
        );
      });

      it('should warn when the user agent header is empty', () => {
        mockRequest.headers = {
          'user-agent': '',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'EMPTY_USER_AGENT' }),
          ])
        );
      });

      it('should warn when the user agent header exceeds the safe length', () => {
        mockRequest.headers = {
          'user-agent': 'a'.repeat(513),
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: 'EXCESSIVE_USER_AGENT_LENGTH' }),
          ])
        );
      });

      it('should warn when referer header contains an invalid URL', () => {
        mockRequest.headers = {
          referer: 'not a valid url',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'INVALID_URL_HEADER',
              header: 'referer',
            }),
          ])
        );
      });

      it('should allow referer headers with valid URLs', () => {
        mockRequest.headers = {
          referer: 'https://example.org/path',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.not.arrayContaining([
            expect.objectContaining({ type: 'INVALID_URL_HEADER' }),
          ])
        );
      });

      it('should ignore referer headers explicitly set to null string', () => {
        mockRequest.headers = {
          referer: 'null',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
        });
        middleware(mockRequest, mockResponse, mockNext);

        expect(mockRequest.securityValidation.warnings).toEqual(
          expect.not.arrayContaining([
            expect.objectContaining({ type: 'INVALID_URL_HEADER' }),
          ])
        );
      });
    });

    describe('Security blocking behavior', () => {
      it('should block requests with low security score when blocking is enabled', () => {
        mockRequest.headers = {
          'x-evil': '<script>eval(malicious)</script>',
          'x-bad': 'javascript:alert("xss")',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
          blockSuspicious: true,
          minSecurityScore: 50,
        });

        middleware(mockRequest, mockResponse, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Request failed security validation',
              code: 'SECURITY_VALIDATION_FAILED',
            }),
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should allow requests with low security score when blocking is disabled', () => {
        mockRequest.headers = {
          'x-suspicious': '<script>alert("test")</script>',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
          blockSuspicious: false,
          minSecurityScore: 90,
        });

        middleware(mockRequest, mockResponse, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('Configuration options', () => {
      it('should use custom logger', () => {
        const customLogger = {
          debug: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        mockRequest.headers = {
          'x-test': '<script>alert("test")</script>',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: customLogger,
        });

        middleware(mockRequest, mockResponse, mockNext);

        expect(customLogger.error).toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should respect custom minimum security score', () => {
        mockRequest.headers = {
          'x-test': 'normal-value',
        };

        const middleware = createSecurityValidationMiddleware({
          logger: mockLogger,
          blockSuspicious: true,
          minSecurityScore: 95, // Very high threshold
        });

        middleware(mockRequest, mockResponse, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
      });

      it('should fall back to console logger when options are omitted', () => {
        const debugSpy = jest
          .spyOn(console, 'debug')
          .mockImplementation(() => {});
        const warnSpy = jest
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockRequest.headers = {
          'content-security-policy':
            "default-src 'self'; script-src 'unsafe-eval'",
          'x-test-header': '<script>alert(1)</script>',
        };

        const middleware = createSecurityValidationMiddleware();
        middleware(mockRequest, mockResponse, mockNext);

        expect(debugSpy).not.toHaveBeenCalled();
        expect(
          warnSpy.mock.calls.length + errorSpy.mock.calls.length
        ).toBeGreaterThan(0);
        expect(errorSpy).toHaveBeenCalled();

        debugSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      });
    });
  });

  describe('createCSPNonceMiddleware', () => {
    it('should generate and attach nonce to request and response', () => {
      const middleware = createCSPNonceMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.cspNonce).toBeDefined();
      expect(typeof mockRequest.cspNonce).toBe('string');
      expect(mockRequest.cspNonce.length).toBe(16);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-CSP-Nonce',
        mockRequest.cspNonce
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should respect custom nonce length', () => {
      const customLength = 24;
      const middleware = createCSPNonceMiddleware({
        nonceLength: customLength,
      });

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.cspNonce.length).toBe(customLength);
    });

    it('should attach nonce to response locals', () => {
      mockResponse.locals = {};
      const middleware = createCSPNonceMiddleware();

      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.locals.cspNonce).toBe(mockRequest.cspNonce);
    });
  });

  describe('SecurityValidationUtils', () => {
    describe('validateCSPHeader', () => {
      it('should validate correct CSP headers', () => {
        const validCSP = "default-src 'self'; script-src 'self' 'nonce-abc123'";
        const result = SecurityValidationUtils.validateCSPHeader(validCSP);

        expect(result.isValid).toBe(true);
        expect(result.directiveCount).toBeGreaterThan(0);
      });

      it('should reject CSP with unsafe directives', () => {
        const unsafeCSP = "default-src 'self'; script-src 'unsafe-eval'";
        const result = SecurityValidationUtils.validateCSPHeader(unsafeCSP);

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Unsafe CSP directive detected');
        expect(result.unsafeValue).toBe('unsafe-eval');
      });

      it('should identify unsafe inline scripts in CSP headers', () => {
        const unsafeInlineCSP =
          "default-src 'self'; script-src 'unsafe-inline'";
        const result =
          SecurityValidationUtils.validateCSPHeader(unsafeInlineCSP);

        expect(result.isValid).toBe(false);
        expect(result.unsafeValue).toBe('unsafe-inline');
      });

      it('should reject CSP with unknown directives', () => {
        const invalidCSP = "default-src 'self'; unknown-directive 'self'";
        const result = SecurityValidationUtils.validateCSPHeader(invalidCSP);

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Unknown CSP directive');
        expect(result.directive).toBe('unknown-directive');
      });

      it('should handle empty or invalid CSP values', () => {
        expect(SecurityValidationUtils.validateCSPHeader('').isValid).toBe(
          false
        );
        expect(SecurityValidationUtils.validateCSPHeader(null).isValid).toBe(
          false
        );
        expect(
          SecurityValidationUtils.validateCSPHeader(undefined).isValid
        ).toBe(false);
      });

      it('should reject overly long CSP headers', () => {
        const longCSP = 'default-src ' + "'self' ".repeat(2000);
        const result = SecurityValidationUtils.validateCSPHeader(longCSP);

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('too long');
      });
    });

    describe('generateCorrelationId', () => {
      it('should generate UUID format correlation ID', () => {
        const req = { headers: {} };
        const id = SecurityValidationUtils.generateCorrelationId(req);

        expect(id).toMatch(/^[a-fA-F0-9\-]{36}$/);
      });

      it('should reuse valid existing correlation ID', () => {
        const existingId = 'valid-correlation-id-123';
        const req = { headers: { 'x-correlation-id': existingId } };
        const id = SecurityValidationUtils.generateCorrelationId(req);

        expect(id).toBe(existingId);
      });

      it('should reject invalid correlation IDs', () => {
        const invalidId = 'invalid!@#$%';
        const req = { headers: { 'x-correlation-id': invalidId } };
        const id = SecurityValidationUtils.generateCorrelationId(req);

        expect(id).not.toBe(invalidId);
        expect(id).toMatch(/^[a-fA-F0-9\-]{36}$/);
      });
    });

    describe('analyzeSecurityHeaders', () => {
      it('should analyze complete security headers', () => {
        const headers = {
          'strict-transport-security':
            'max-age=31536000; includeSubDomains; preload',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'x-xss-protection': '1; mode=block',
          'referrer-policy': 'strict-origin-when-cross-origin',
        };

        const analysis =
          SecurityValidationUtils.analyzeSecurityHeaders(headers);

        expect(analysis.score).toBeGreaterThan(80);
        expect(analysis.securityLevel).toBe('excellent');
        expect(analysis.details.hsts.present).toBe(true);
        expect(analysis.details.csp.present).toBe(true);
        expect(analysis.recommendations.length).toBe(0);
      });

      it('should provide recommendations for missing headers', () => {
        const headers = {
          'content-type': 'application/json',
          // Missing security headers
        };

        const analysis =
          SecurityValidationUtils.analyzeSecurityHeaders(headers);

        expect(analysis.score).toBeLessThan(30);
        expect(analysis.securityLevel).toBe('poor');
        expect(analysis.recommendations.length).toBeGreaterThan(0);
        expect(analysis.recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              header: 'Strict-Transport-Security',
              impact: 'high',
            }),
          ])
        );
      });

      it('should calculate security scores correctly', () => {
        const partialHeaders = {
          'strict-transport-security': 'max-age=31536000',
          'x-content-type-options': 'nosniff',
        };

        const analysis =
          SecurityValidationUtils.analyzeSecurityHeaders(partialHeaders);

        expect(analysis.score).toBeGreaterThan(0);
        expect(analysis.score).toBeLessThan(analysis.maxScore);
        expect(analysis.securityLevel).toMatch(/^(poor|fair|good)$/);
      });

      it('should classify responses with moderate coverage as "good" security level', () => {
        const headers = {
          'strict-transport-security': 'max-age=63072000',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
        };

        const analysis =
          SecurityValidationUtils.analyzeSecurityHeaders(headers);

        expect(analysis.score).toBeGreaterThanOrEqual(60);
        expect(analysis.score).toBeLessThan(80);
        expect(analysis.securityLevel).toBe('good');
      });

      it('should classify responses with partial coverage as "fair" security level', () => {
        const headers = {
          'strict-transport-security': 'max-age=31536000',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
        };

        const analysis =
          SecurityValidationUtils.analyzeSecurityHeaders(headers);

        expect(analysis.score).toBeGreaterThanOrEqual(40);
        expect(analysis.score).toBeLessThan(60);
        expect(analysis.securityLevel).toBe('fair');
      });

      it('should report invalid CSP directives in header analysis', () => {
        const headers = {
          'content-security-policy':
            "default-src 'self'; script-src 'unsafe-inline'",
        };

        const analysis =
          SecurityValidationUtils.analyzeSecurityHeaders(headers);

        expect(analysis.details.csp.present).toBe(true);
        expect(analysis.details.csp.valid).toBe(false);
        expect(analysis.details.csp.directives).toBe(0);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle malformed header objects', () => {
      const middleware = createSecurityValidationMiddleware({
        logger: mockLogger,
      });

      // Test with headers that might cause issues
      mockRequest.headers = {
        'normal-header': 'value',
        '': 'empty-name',
        'null-value': null,
        'undefined-value': undefined,
        'object-value': { nested: 'object' },
      };

      expect(() => {
        middleware(mockRequest, mockResponse, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing response methods gracefully', () => {
      const incompleteResponse = {
        setHeader: jest.fn(),
        // Missing status and json methods
      };

      const middleware = createSecurityValidationMiddleware({
        logger: mockLogger,
        blockSuspicious: false,
      });

      expect(() => {
        middleware(mockRequest, incompleteResponse, mockNext);
      }).not.toThrow();
    });

    it('should handle missing logger methods', () => {
      const incompleteLogger = {
        debug: jest.fn(),
        // Missing other log methods
      };

      mockRequest.headers = {
        'x-test': '<script>alert("test")</script>',
      };

      const middleware = createSecurityValidationMiddleware({
        logger: incompleteLogger,
      });

      expect(() => {
        middleware(mockRequest, mockResponse, mockNext);
      }).not.toThrow();
    });

    it('should skip warning logs when warn method is missing and errors occur', () => {
      const loggerWithoutWarn = {
        error: jest.fn(),
      };

      mockRequest.headers = {
        'content-security-policy':
          "default-src 'self'; script-src 'unsafe-eval'",
      };

      const middleware = createSecurityValidationMiddleware({
        logger: loggerWithoutWarn,
      });

      middleware(mockRequest, mockResponse, mockNext);

      expect(loggerWithoutWarn.error).not.toHaveBeenCalledWith(
        'Security validation errors detected',
        expect.anything()
      );
    });

    it('should skip debug logging when logger does not expose debug method', () => {
      const noDebugLogger = {
        warn: jest.fn(),
        error: jest.fn(),
      };

      const middleware = createSecurityValidationMiddleware({
        logger: noDebugLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);

      expect(noDebugLogger.warn).not.toHaveBeenCalled();
      expect(noDebugLogger.error).not.toHaveBeenCalled();
    });

    it('should handle very large header values', () => {
      const largeValue = 'x'.repeat(10000);
      mockRequest.headers = {
        'x-large-header': largeValue,
      };

      const middleware = createSecurityValidationMiddleware({
        logger: mockLogger,
      });

      const startTime = Date.now();
      middleware(mockRequest, mockResponse, mockNext);
      const endTime = Date.now();

      // Should complete quickly even with large headers
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockRequest.securityValidation.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'HEADER_VALUE_TOO_LONG',
          }),
        ])
      );
    });
  });
});
