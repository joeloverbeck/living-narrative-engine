/**
 * @file security-validation-logger-fallbacks.integration.test.js
 * @description Integration tests that cover logger fallback paths and
 *              additional security validation branches that were previously
 *              missed by the main suite.
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createCSPNonceMiddleware,
  createSecurityValidationMiddleware,
} from '../../src/middleware/securityValidation.js';

describe('Security validation middleware logging fallbacks - integration', () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  test('blocks unsafe requests even when logger methods are missing', async () => {
    const partialLogger = { info: jest.fn() };

    app.use(
      createSecurityValidationMiddleware({
        logger: partialLogger,
        minSecurityScore: 95,
      })
    );

    app.get('/danger', (req, res) => {
      res.json({ reached: true });
    });

    const response = await request(app)
      .get('/danger')
      .set('Host', 'proxy.example.test')
      .set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'unsafe-eval'"
      )
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set('Strict-Transport-Security', 'max-age=10800; includeSubDomains')
      .set('X-Forwarded-Host', 'evil.com<script>')
      .set('X-Forwarded-For', '198.51.100.2')
      .set('X-Real-IP', 'bad$ip')
      .set('Origin', 'null')
      .set('User-Agent', 'danger-tester')
      .set('X-Injection', '<script>alert(1)</script>')
      .expect(400);

    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'SECURITY_VALIDATION_FAILED',
        correlationId: expect.any(String),
        details: expect.objectContaining({
          securityScore: expect.any(Number),
          minRequired: 95,
        }),
      })
    );
    expect(response.body.error.details.securityScore).toBeLessThan(95);
  });

  test('allows secure traffic while gracefully skipping debug logging', async () => {
    const loggerWithoutDebug = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    app.use(
      createSecurityValidationMiddleware({
        logger: loggerWithoutDebug,
        minSecurityScore: 80,
      })
    );

    app.get('/status', (req, res) => {
      res.json({
        correlationId: req.correlationId,
        headerCorrelationId: res.get('X-Correlation-ID'),
        validation: req.securityValidation,
      });
    });

    const response = await request(app)
      .get('/status')
      .set('Host', 'proxy.example.test')
      .set('Content-Security-Policy', "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .set('X-Forwarded-For', '198.51.100.2')
      .set('Origin', 'https://client.example.test')
      .set('Referer', '')
      .set('User-Agent', 'branch-coverage-agent')
      .expect(200);

    expect(response.body.correlationId).toMatch(/^[0-9a-f\-]{36}$/);
    expect(response.body.correlationId).toBe(response.body.headerCorrelationId);
    expect(response.body.validation.isValid).toBe(true);
    expect(response.body.validation.securityScore).toBeGreaterThanOrEqual(80);
    expect(loggerWithoutDebug.warn).not.toHaveBeenCalled();
    expect(loggerWithoutDebug.error).not.toHaveBeenCalled();
  });

  test('emits validation error logs when warn function is available', async () => {
    const capturingLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    app.use(
      createSecurityValidationMiddleware({
        logger: capturingLogger,
        blockSuspicious: false,
        minSecurityScore: 90,
      })
    );

    app.get('/warn', (req, res) => {
      res.json({ validation: req.securityValidation });
    });

    const response = await request(app)
      .get('/warn')
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
      .set('X-Forwarded-For', '198.51.100.2')
      .set('Origin', 'https://client.example.test')
      .set('User-Agent', 'warn-branch-coverage')
      .expect(200);

    expect(response.body.validation.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'INVALID_CSP' })])
    );
    expect(capturingLogger.warn).toHaveBeenCalledWith(
      'Security validation errors detected',
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ type: 'INVALID_CSP' }),
        ]),
      })
    );
  });

  test('records suspicious patterns without emitting error logs', async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    app.use(
      createSecurityValidationMiddleware({
        logger,
        blockSuspicious: false,
        minSecurityScore: 80,
      })
    );

    app.get('/suspicious-only', (req, res) => {
      res.json({ validation: req.securityValidation });
    });

    const response = await request(app)
      .get('/suspicious-only')
      .set('Host', 'proxy.example.test')
      .set('Content-Security-Policy', "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .set('X-Forwarded-For', '198.51.100.2')
      .set('Origin', 'https://client.example.test')
      .set('X-Injection', '<script>alert(1)</script>')
      .set('User-Agent', 'suspicious-only-branch')
      .expect(200);

    expect(response.body.validation.errors).toHaveLength(0);
    expect(response.body.validation.suspiciousPatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ header: 'x-injection' }),
      ])
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Suspicious security patterns detected',
      expect.objectContaining({
        suspiciousPatterns: expect.arrayContaining([
          expect.objectContaining({ header: 'x-injection' }),
        ]),
        errors: [],
      })
    );
  });

  test('uses default configuration when options are omitted', async () => {
    app.use(createCSPNonceMiddleware());
    app.use(createSecurityValidationMiddleware());

    app.get('/defaults', (req, res) => {
      res.json({
        correlationId: req.correlationId,
        validation: req.securityValidation,
        nonce: req.cspNonce,
        nonceHeader: res.get('X-CSP-Nonce'),
      });
    });

    const response = await request(app)
      .get('/defaults')
      .set('Host', 'proxy.example.test')
      .set('Content-Security-Policy', "default-src 'self'; script-src 'self'")
      .set('X-Content-Type-Options', 'nosniff')
      .set('X-Frame-Options', 'DENY')
      .set('X-XSS-Protection', '1; mode=block')
      .set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .set('X-Forwarded-For', '203.0.113.5')
      .set('Origin', 'https://client.example.test')
      .set('User-Agent', 'defaults-branch-cover')
      .expect(200);

    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.body.validation.isValid).toBe(true);
    expect(response.body.validation.securityScore).toBeGreaterThanOrEqual(70);
    expect(response.body.nonce).toMatch(/^[0-9a-f]{16}$/);
    expect(response.body.nonceHeader).toBe(response.body.nonce);
  });
});
