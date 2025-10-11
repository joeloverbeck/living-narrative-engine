/**
 * @file security-validation.integration.test.js
 * @description Integration tests covering the enhanced security validation middleware
 *              including correlation IDs, suspicious request handling, and header analysis.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  SecurityValidationUtils,
  createCSPNonceMiddleware,
  createSecurityValidationMiddleware,
} from '../../src/middleware/securityValidation.js';

describe('Security validation middleware - integration coverage', () => {
  let app;
  let logger;

  beforeEach(() => {
    app = express();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('allows secure traffic while attaching correlation metadata', async () => {
    app.use(
      createSecurityValidationMiddleware({
        logger,
        minSecurityScore: 80,
      })
    );

    app.get('/secure', (req, res) => {
      res.json({
        correlationId: req.correlationId,
        headerCorrelationId: res.get('X-Correlation-ID'),
        validation: req.securityValidation,
      });
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message });
    });

    const response = await request(app)
      .get('/secure')
      .set('Host', 'proxy.example.test')
      .set('Content-Security-Policy', "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .set('User-Agent', 'integration-test');

    expect(response.status).toBe(200);

    expect(response.body.correlationId).toMatch(/^[0-9a-f\-]{36}$/);
    expect(response.body.correlationId).toBe(response.body.headerCorrelationId);
    expect(response.body.validation.isValid).toBe(true);
    expect(response.body.validation.securityScore).toBeGreaterThanOrEqual(80);

    expect(logger.debug).toHaveBeenCalledWith(
      'Security validation passed',
      expect.objectContaining({
        correlationId: response.body.correlationId,
        securityScore: expect.any(Number),
        warningCount: expect.any(Number),
      })
    );
  });

  test('blocks suspicious requests and logs diagnostics', async () => {
    app.use(
      createSecurityValidationMiddleware({
        logger,
        minSecurityScore: 70,
      })
    );

    app.get('/suspicious', (req, res) => {
      res.json({ allowed: true });
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message });
    });

    const response = await request(app)
      .get('/suspicious')
      .set('Host', 'proxy.example.test')
      .set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'unsafe-inline'"
      )
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .set('X-Forwarded-Host', 'evil.com<script>')
      .set('User-Agent', 'suspicious-tester')
      .expect(400);

    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'SECURITY_VALIDATION_FAILED',
        correlationId: expect.any(String),
        details: expect.objectContaining({
          securityScore: expect.any(Number),
          minRequired: 70,
          issueCount: expect.any(Number),
        }),
      })
    );

    const capturedCorrelation = response.body.error.correlationId;

    expect(logger.warn).toHaveBeenCalledWith(
      'Security validation errors detected',
      expect.objectContaining({
        correlationId: capturedCorrelation,
        errors: expect.arrayContaining([
          expect.objectContaining({ type: 'INVALID_CSP' }),
        ]),
      })
    );

    expect(
      logger.error.mock.calls.filter(
        ([message]) => message === 'Suspicious security patterns detected'
      ).length
    ).toBeGreaterThanOrEqual(1);

    expect(
      logger.error.mock.calls.some(
        ([message, context]) =>
          message === 'Request blocked due to low security score' &&
          context.correlationId === capturedCorrelation
      )
    ).toBe(true);
  });

  test('respects provided correlation IDs and surfaces analysis insights', async () => {
    app.use(
      createSecurityValidationMiddleware({
        logger,
        blockSuspicious: false,
        minSecurityScore: 95,
      })
    );

    app.get('/analysis', (req, res) => {
      const analysis = SecurityValidationUtils.analyzeSecurityHeaders(
        req.headers
      );

      res.json({
        correlationId: req.correlationId,
        validation: req.securityValidation,
        analysis,
      });
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message });
    });

    const response = await request(app)
      .get('/analysis')
      .set('X-Correlation-ID', 'custom-id_12345')
      .set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'unsafe-inline'"
      )
      .set(
        'Strict-Transport-Security',
        'max-age=10800; includeSubDomains; preload'
      )
      .set('X-Content-Type-Options', 'nosniff')
      .set('Referer', 'invalid-url')
      .set('User-Agent', '')
      .expect(200);

    expect(response.body.correlationId).toBe('custom-id_12345');
    expect(response.body.validation.correlationId).toBe('custom-id_12345');
    expect(response.body.validation.isValid).toBe(false);
    expect(response.body.validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'MISSING_SECURITY_HEADER' }),
        expect.objectContaining({ type: 'EMPTY_USER_AGENT' }),
        expect.objectContaining({ type: 'INVALID_URL_HEADER' }),
      ])
    );

    expect(response.body.analysis.securityLevel).toBe('good');
    expect(response.body.analysis.score).toBeLessThan(80);
    expect(response.body.analysis.details.csp).toEqual(
      expect.objectContaining({ present: true, valid: false })
    );
    expect(response.body.analysis.details.hsts).toEqual(
      expect.objectContaining({ present: true })
    );
    expect(response.body.analysis.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ header: 'x-frame-options' }),
        expect.objectContaining({ header: 'x-xss-protection' }),
        expect.objectContaining({ header: 'referrer-policy' }),
      ])
    );
  });

  test('captures extensive header anomalies without blocking downstream handlers', async () => {
    app.use((req, res, next) => {
      for (let index = 0; index < 105; index += 1) {
        req.headers[`x-extra-${index}`] = 'value';
      }
      req.headers[`x-${'a'.repeat(140)}`] = 'value';
      req.headers['x-oversized-value'] = 'b'.repeat(9000);
      req.headers['content-security-policy'] = '';
      req.headers['x-correlation-id'] = 'bad id with spaces';
      req.headers['x-forwarded-for'] = '203.0.113.5, invalid-entry';
      req.headers['x-template'] = '${process.env.SECRET}';
      req.headers['user-agent'] = 'Z'.repeat(600);
      next();
    });

    app.use(
      createSecurityValidationMiddleware({
        logger,
        blockSuspicious: false,
        minSecurityScore: 90,
      })
    );

    app.get('/diagnostics', (req, res) => {
      const cspLengthCheck = SecurityValidationUtils.validateCSPHeader(
        'a'.repeat(9001)
      );
      const unknownDirective = SecurityValidationUtils.validateCSPHeader(
        'unknown-directive test'
      );
      const perfectAnalysis = SecurityValidationUtils.analyzeSecurityHeaders({
        'strict-transport-security':
          'max-age=63072000; includeSubDomains; preload',
        'content-security-policy': "default-src 'self'; script-src 'self'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'same-origin',
      });
      const moderateAnalysis = SecurityValidationUtils.analyzeSecurityHeaders({
        'strict-transport-security': 'max-age=10800',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin',
      });
      const fairAnalysis = SecurityValidationUtils.analyzeSecurityHeaders({
        'strict-transport-security': 'max-age=10800',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      const missingAnalysis = SecurityValidationUtils.analyzeSecurityHeaders(
        {}
      );

      res.json({
        correlationId: req.correlationId,
        validation: req.securityValidation,
        extraChecks: {
          cspLengthCheck,
          unknownDirective,
          perfectAnalysis,
          moderateAnalysis,
          fairAnalysis,
          missingAnalysis,
        },
      });
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message });
    });

    const response = await request(app).get('/diagnostics').expect(200);

    expect(response.body.correlationId).not.toBe('bad id with spaces');
    expect(response.body.validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'EXCESSIVE_HEADERS' }),
        expect.objectContaining({ type: 'HEADER_NAME_TOO_LONG' }),
        expect.objectContaining({ type: 'HEADER_VALUE_TOO_LONG' }),
        expect.objectContaining({ type: 'INVALID_CSP' }),
      ])
    );
    expect(response.body.validation.suspiciousPatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ header: 'x-template' }),
      ])
    );
    expect(response.body.validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SUSPICIOUS_IP_HEADER' }),
        expect.objectContaining({ type: 'MISSING_SECURITY_HEADER' }),
      ])
    );
    expect(response.body.validation.securityScore).toBeLessThan(50);
    expect(response.body.validation.isValid).toBe(false);

    expect(response.body.extraChecks.cspLengthCheck).toEqual(
      expect.objectContaining({ reason: 'CSP header value too long' })
    );
    expect(response.body.extraChecks.unknownDirective).toEqual(
      expect.objectContaining({
        reason: 'Unknown CSP directive: unknown-directive',
      })
    );
    expect(response.body.extraChecks.perfectAnalysis.securityLevel).toBe(
      'excellent'
    );
    expect(response.body.extraChecks.moderateAnalysis.securityLevel).toBe(
      'good'
    );
    expect(response.body.extraChecks.fairAnalysis.securityLevel).toBe('fair');
    expect(response.body.extraChecks.missingAnalysis.securityLevel).toBe(
      'poor'
    );
  });

  test('shares nonce metadata between CSP middleware and security validation', async () => {
    app.use(createCSPNonceMiddleware({ nonceLength: 24 }));
    app.use(
      createSecurityValidationMiddleware({
        logger,
        minSecurityScore: 75,
      })
    );

    app.get('/nonce', (req, res) => {
      res.json({
        nonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
        headerNonce: res.get('X-CSP-Nonce'),
        correlationId: req.correlationId,
        validationScore: req.securityValidation.securityScore,
      });
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message });
    });

    const response = await request(app)
      .get('/nonce')
      .set('Host', 'proxy.example.test')
      .set('Content-Security-Policy', "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .set('User-Agent', 'integration-nonce-test')
      .expect(200);

    expect(response.body.nonce).toMatch(/^[0-9a-f]{24}$/);
    expect(response.body.localsNonce).toBe(response.body.nonce);
    expect(response.body.headerNonce).toBe(response.body.nonce);
    expect(response.body.validationScore).toBeGreaterThanOrEqual(75);
    expect(response.body.correlationId).toMatch(/^[0-9a-f\-]{36}$/);
  });
});
