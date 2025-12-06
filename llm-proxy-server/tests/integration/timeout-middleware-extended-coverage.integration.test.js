import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';
import { SECURITY_MAX_REQUEST_SIZE } from '../../src/config/constants.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('timeout middleware extended integration coverage', () => {
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = createTestLogger();
  });

  it('surfaces existing commitment metadata when a prior handler pre-commits before the timeout fires', async () => {
    const app = express();

    app.post(
      '/precommitted-known-source',
      (req, res, next) => {
        let committed = false;
        let commitmentSource = null;
        res.commitResponse = (source) => {
          if (committed) {
            return false;
          }

          committed = true;
          commitmentSource = source ?? null;
          return true;
        };
        res.isResponseCommitted = () => committed;
        res.getCommitmentSource = () => commitmentSource;
        next();
      },
      createTimeoutMiddleware(25, { logger, gracePeriod: 10 }),
      (_req, res) => {
        res.commitResponse('handler-precommit');

        setTimeout(() => {
          try {
            res.status(200).json({ completed: true });
          } catch (_error) {
            // The timeout middleware may have already finalized the response.
          }
        }, 80);
      }
    );

    const response = await request(app)
      .post('/precommitted-known-source')
      .send({});
    expect(response.status).toBe(200);

    const timeoutWarning = logger.warn.mock.calls.find(([message]) =>
      message.includes('Timeout cannot commit response')
    );

    expect(timeoutWarning).toBeDefined();
    expect(timeoutWarning?.[1]).toMatchObject({
      existingCommitment: 'handler-precommit',
    });
  });

  it('enters the configured grace period and warns when headers have already been sent', async () => {
    const app = express();

    app.post(
      '/headers-sent',
      createTimeoutMiddleware(20, { logger, gracePeriod: 40 }),
      (_req, res) => {
        setTimeout(() => {
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.write('partial-body');
        }, 10);

        setTimeout(() => {
          try {
            res.end('complete');
          } catch (_error) {
            // If the timeout middleware already closed the connection we ignore the error.
          }
        }, 90);
      }
    );

    const response = await request(app).post('/headers-sent').send('ignored');
    expect(response.status).toBe(200);

    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Entering grace period of 40ms')
      )
    ).toBe(true);

    const headerWarn = logger.warn.mock.calls.find(([message]) =>
      message.includes('Cannot send timeout response - headers already sent')
    );
    expect(headerWarn).toBeDefined();
  });

  it('parses kilobyte and gigabyte size strings when enforcing request size limits', async () => {
    const kbConfig = createSizeLimitConfig({ jsonLimit: '1536kb' });
    expect(kbConfig.json.limit).toBe('1536kb');

    const app = express();
    app.use(express.json(kbConfig.json));
    app.post('/kb-limit', (req, res) => {
      res.status(200).json({ received: !!req.body.data });
    });

    const withinLimitPayload = 'a'.repeat(512 * 1024);
    const withinLimitResponse = await request(app)
      .post('/kb-limit')
      .set('content-type', 'application/json')
      .send({ data: withinLimitPayload });
    expect(withinLimitResponse.status).toBe(200);

    const overLimitPayload = 'b'.repeat(2 * 1024 * 1024);
    const overLimitResponse = await request(app)
      .post('/kb-limit')
      .set('content-type', 'application/json')
      .send({ data: overLimitPayload });
    expect(overLimitResponse.status).toBe(413);

    const gbConfig = createSizeLimitConfig({ jsonLimit: '1.5gb' });
    expect(gbConfig.json.limit).toBe(SECURITY_MAX_REQUEST_SIZE);
  });
});
