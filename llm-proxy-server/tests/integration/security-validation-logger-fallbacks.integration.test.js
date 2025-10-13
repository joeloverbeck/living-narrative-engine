import { describe, beforeEach, afterEach, expect, test, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createCSPNonceMiddleware,
  createSecurityValidationMiddleware,
} from '../../src/middleware/securityValidation.js';

/**
 * Integration suite extending coverage for the security validation middleware
 * by exercising logger fallbacks and default configuration paths that are not
 * covered in the primary security validation integration tests.
 */
describe('security validation middleware logger fallbacks - integration', () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('blocks malicious requests even when logger methods are missing', async () => {
    const degradedLogger = {
      debug: jest.fn(),
      // Intentionally provide non-function values to exercise safety guards
      warn: 'not-a-function',
      error: null,
    };

    app.use(
      createSecurityValidationMiddleware({
        logger: degradedLogger,
        minSecurityScore: 85,
      })
    );

    app.get('/degraded', (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .get('/degraded')
      .set('Host', 'proxy.example.test<attack>')
      .set("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-eval'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set('X-Template', 'eval(alert(1))')
      .set('X-Forwarded-For', '203.0.113.5')
      .set('Referer', 'null')
      .expect(400);

    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'SECURITY_VALIDATION_FAILED',
        details: expect.objectContaining({
          securityScore: expect.any(Number),
          minRequired: 85,
        }),
      })
    );

    // Even without warn/error functions, the middleware should still attach
    // validation metadata describing the unsafe CSP directive.
    expect(response.body.error.details.issueCount).toBeGreaterThan(0);
    expect(response.body.error.details.securityScore).toBeLessThan(85);
    expect(degradedLogger.debug).not.toHaveBeenCalledWith(
      'Security validation passed',
      expect.any(Object)
    );
  });

  test('uses default console logger and nonce length when no options are provided', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    app.use(createCSPNonceMiddleware());
    app.use(createSecurityValidationMiddleware());

    app.get('/defaults', (req, res) => {
      res.json({
        nonce: res.get('X-CSP-Nonce'),
        correlationId: req.correlationId,
        validation: req.securityValidation,
      });
    });

    const response = await request(app)
      .get('/defaults')
      .set('Host', 'proxy.example.test')
      .set("Content-Security-Policy", "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
      .set('X-Forwarded-For', '203.0.113.5')
      .set('Referer', 'null')
      .set('User-Agent', 'integration-default')
      .expect(200);

    expect(response.body.nonce).toHaveLength(16);
    expect(response.body.correlationId).toMatch(/^[0-9a-f\-]{36}$/);
    expect(response.body.validation.isValid).toBe(true);
    expect(response.body.validation.securityScore).toBeGreaterThanOrEqual(70);

    expect(debugSpy).toHaveBeenCalledWith(
      'Security validation passed',
      expect.objectContaining({
        correlationId: response.body.correlationId,
        securityScore: expect.any(Number),
      })
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('skips debug logging when logger.debug is unavailable but still allows valid traffic', async () => {
    const partialLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    app.use(
      createSecurityValidationMiddleware({
        logger: partialLogger,
        blockSuspicious: false,
        minSecurityScore: 60,
      })
    );

    app.get('/partial', (req, res) => {
      res.json({
        correlationId: req.correlationId,
        validation: req.securityValidation,
      });
    });

    const response = await request(app)
      .get('/partial')
      .set('Host', 'proxy.example.test')
      .set("Content-Security-Policy", "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
      .set('Origin', 'https://example.com')
      .set('Referer', 'https://example.com/page')
      .set('X-Template', 'eval(window.alert(1))')
      .set('X-Forwarded-For', '203.0.113.5')
      .set('User-Agent', 'integration-partial')
      .expect(200);

    expect(response.body.validation.isValid).toBe(true);
    expect(response.body.validation.securityScore).toBeGreaterThanOrEqual(60);
    expect(partialLogger.warn).not.toHaveBeenCalled();
    expect(partialLogger.error).toHaveBeenCalledWith(
      'Suspicious security patterns detected',
      expect.objectContaining({
        suspiciousPatterns: expect.arrayContaining([
          expect.objectContaining({ header: 'x-template' }),
        ]),
        errors: [],
      })
    );
  });
});
