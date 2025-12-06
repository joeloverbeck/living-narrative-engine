/**
 * @file security-middleware-relaxed-csp.integration.test.js
 * @description Integration tests that exercise relaxed CSP flows and configuration validation
 * edge cases in the enhanced security middleware stack.
 */

import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createSecurityMiddleware,
  createSecurityConfigValidator,
} from '../../src/middleware/security.js';

const extractDirective = (headerValue, directiveName) => {
  return headerValue
    .split(';')
    .map((segment) => segment.trim())
    .find((segment) =>
      segment.toLowerCase().startsWith(`${directiveName.toLowerCase()} `)
    );
};

describe('Security middleware relaxed CSP integration', () => {
  it('disables nonces and permits unsafe-inline styles when explicitly configured', async () => {
    const app = express();

    let observedRequestNonce = 'placeholder';
    let observedResponseNonce = 'placeholder';

    app.use(
      createSecurityMiddleware({
        enableNonce: false,
        strictCSP: false,
      })
    );

    app.get('/relaxed', (req, res) => {
      observedRequestNonce = req.cspNonce;
      observedResponseNonce = res.locals.cspNonce;
      res.status(204).end();
    });

    const response = await request(app).get('/relaxed');

    expect(response.status).toBe(204);
    expect(observedRequestNonce).toBeNull();
    expect(observedResponseNonce).toBeNull();

    const cspHeader = response.headers['content-security-policy'];
    expect(cspHeader).toBeDefined();

    const styleSrc = extractDirective(cspHeader, 'style-src');
    expect(styleSrc).toMatch(/'self'/);
    expect(styleSrc).toMatch(/'unsafe-inline'/);
    expect(styleSrc).not.toMatch(/'nonce-/);
  });
});

describe('Security configuration validator integration', () => {
  it('warns when required security headers are absent', async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const app = express();
    app.use(createSecurityConfigValidator({ logger }));
    app.get('/no-security', (_req, res) => {
      res.status(204).end();
    });

    const response = await request(app).get('/no-security');
    expect(response.status).toBe(204);

    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.warn).toHaveBeenCalledWith(
      'Missing required security headers',
      expect.objectContaining({
        missingHeaders: expect.arrayContaining([
          'Content-Security-Policy',
          'Strict-Transport-Security',
        ]),
        url: '/no-security',
        method: 'GET',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('captures and logs errors thrown during header inspection after response completion', async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const app = express();
    app.use(createSecurityConfigValidator({ logger }));
    app.get('/header-error', (_req, res) => {
      const originalGetHeader = res.getHeader.bind(res);
      res.getHeader = (name) => {
        if (name === 'X-Frame-Options') {
          throw new Error('inspection failure');
        }
        return originalGetHeader(name);
      };

      res.status(204).end();
    });

    const response = await request(app).get('/header-error');
    expect(response.status).toBe(204);

    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      'Error checking security headers',
      expect.objectContaining({
        error: 'inspection failure',
        url: '/header-error',
        method: 'GET',
      })
    );
  });
});
