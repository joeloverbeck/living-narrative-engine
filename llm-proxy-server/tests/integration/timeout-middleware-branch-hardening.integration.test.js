import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';
import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import {
  SECURITY_DEFAULT_REQUEST_SIZE,
  SECURITY_MAX_REQUEST_SIZE,
} from '../../src/config/constants.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('timeout middleware branch hardening integration coverage', () => {
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = createTestLogger();
  });

  it('falls back to unknown commitment metadata when guard lacks getCommitmentSource', async () => {
    const app = express();

    app.post(
      '/commitment-fallback',
      (req, res, next) => {
        let committed = false;

        res.commitResponse = () => {
          if (committed) {
            return false;
          }

          committed = true;
          return true;
        };

        res.isResponseCommitted = () => committed;
        // Provide a placeholder getter that mimics absent metadata.
        res.getCommitmentSource = () => undefined;
        next();
      },
      createTimeoutMiddleware(30, { logger, gracePeriod: 10 }),
      (_req, res) => {
        res.commitResponse('pre-committed');

        setTimeout(() => {
          try {
            res.status(200).json({ completed: true });
          } catch (_error) {
            // Response may already be closed by timeout handler; swallow late write errors.
          }
        }, 80);
      }
    );

    const response = await request(app).post('/commitment-fallback').send({});

    expect(response.status).toBe(200);
    expect(
      logger.warn.mock.calls.some((call) =>
        call[0].includes('Timeout fired after')
      )
    ).toBe(true);

    const fallbackWarning = logger.warn.mock.calls.find((call) =>
      call[0].includes('Timeout cannot commit response')
    );

    expect(fallbackWarning).toBeDefined();
    expect(fallbackWarning?.[1]).toMatchObject({
      existingCommitment: undefined,
    });
  });

  it('records diagnostics when response helpers execute after timeout completion', async () => {
    const app = express();
    app.use(createRequestTrackingMiddleware({ logger }));

    app.post(
      '/late-json',
      createTimeoutMiddleware(25, { logger }),
      (_req, res) => {
        setTimeout(() => {
          try {
            res.json({ delivered: true });
          } catch (_error) {
            // Expected when attempting to write after timeout response was sent.
          }
        }, 70);
      }
    );

    const response = await request(app).post('/late-json').send({});

    expect(response.status).toBe(503);
    expect(
      logger.warn.mock.calls.some((call) =>
        call[0].includes('Timeout response sent')
      )
    ).toBe(true);

    const lateResponseDebug = logger.debug.mock.calls.find((call) =>
      call[0].includes("Response method 'json' called after timeout")
    );

    expect(lateResponseDebug).toBeDefined();
  });
});

describe('size limit configuration boundary integration coverage', () => {
  it('uses default security limit when no explicit jsonLimit is provided', async () => {
    const config = createSizeLimitConfig();
    expect(config.json.limit).toBe(SECURITY_DEFAULT_REQUEST_SIZE);

    const app = express();
    app.use(express.json(config.json));
    app.post('/default-limit', (req, res) => {
      res.status(200).json({ length: JSON.stringify(req.body).length });
    });

    const smallPayload = 'a'.repeat(512 * 1024); // 0.5MB
    const okResponse = await request(app)
      .post('/default-limit')
      .set('Content-Type', 'application/json')
      .send({ data: smallPayload });
    expect(okResponse.status).toBe(200);

    const largePayload = 'b'.repeat(2 * 1024 * 1024); // 2MB
    const blockedResponse = await request(app)
      .post('/default-limit')
      .set('Content-Type', 'application/json')
      .send({ data: largePayload });
    expect(blockedResponse.status).toBe(413);
  });

  it('clamps oversized string limits to the hardened security ceiling', async () => {
    const config = createSizeLimitConfig({ jsonLimit: '12mb' });
    expect(config.json.limit).toBe(SECURITY_MAX_REQUEST_SIZE);

    const app = express();
    app.use(express.json(config.json));
    app.post('/string-clamp', (req, res) => {
      res.status(200).json({ length: JSON.stringify(req.body).length });
    });

    const acceptablePayload = 'c'.repeat(9 * 1024 * 1024);
    const accepted = await request(app)
      .post('/string-clamp')
      .set('Content-Type', 'application/json')
      .send({ data: acceptablePayload });
    expect(accepted.status).toBe(200);

    const excessivePayload = 'd'.repeat(11 * 1024 * 1024);
    const rejected = await request(app)
      .post('/string-clamp')
      .set('Content-Type', 'application/json')
      .send({ data: excessivePayload });
    expect(rejected.status).toBe(413);
  });
});
