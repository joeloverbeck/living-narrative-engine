import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';
import {
  SECURITY_MAX_REQUEST_SIZE,
  SECURITY_MAX_REQUEST_SIZE_BYTES,
} from '../../src/config/constants.js';

describe('timeout middleware extended integration coverage', () => {
  it('logs commitment diagnostics even when custom guards block timeout responses', async () => {
    jest.useRealTimers();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const app = express();

    app.post(
      '/guarded-timeout',
      (req, res, next) => {
        res.commitResponse = () => false;
        res.getCommitmentSource = () => 'external-handler';
        next();
      },
      createTimeoutMiddleware(30, { logger }),
      (_req, res) => {
        setTimeout(() => {
          res.status(200).json({ outcome: 'handler completed' });
        }, 80);
      }
    );

    const response = await request(app).post('/guarded-timeout').send({});

    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe('handler completed');

    const warnCall = logger.warn.mock.calls.find((call) =>
      call[0].includes('Timeout cannot commit response')
    );
    expect(warnCall).toBeDefined();
    expect(warnCall?.[1]).toMatchObject({
      existingCommitment: 'external-handler',
    });
  });

  it('still releases blocked requests without logging when no logger is configured', async () => {
    jest.useRealTimers();

    const app = express();
    const commitResponseMock = jest.fn(() => false);

    app.post(
      '/guarded-timeout-no-logger',
      (req, res, next) => {
        res.commitResponse = commitResponseMock;
        next();
      },
      createTimeoutMiddleware(25),
      (_req, res) => {
        setTimeout(() => {
          res.status(200).json({ outcome: 'handler completed without logger' });
        }, 60);
      }
    );

    const response = await request(app)
      .post('/guarded-timeout-no-logger')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe('handler completed without logger');
    expect(commitResponseMock).toHaveBeenCalledWith('timeout');
  });
});

describe('size limit configuration extended integration coverage', () => {
  it('clamps oversized numeric limits to the security ceiling', async () => {
    const oversizedLimit = SECURITY_MAX_REQUEST_SIZE_BYTES * 2;
    const config = createSizeLimitConfig({ jsonLimit: oversizedLimit });

    expect(config.json.limit).toBe(SECURITY_MAX_REQUEST_SIZE);

    const app = express();
    app.use(express.json(config.json));
    app.post('/numeric-clamp', (_req, res) => {
      res.status(200).json({ accepted: true });
    });

    const smallPayload = 'x'.repeat(1024 * 1024);
    const okResponse = await request(app)
      .post('/numeric-clamp')
      .set('Content-Type', 'application/json')
      .send({ data: smallPayload });
    expect(okResponse.status).toBe(200);

    const excessivePayload = 'y'.repeat(11 * 1024 * 1024);
    const blockedResponse = await request(app)
      .post('/numeric-clamp')
      .set('Content-Type', 'application/json')
      .send({ data: excessivePayload });
    expect(blockedResponse.status).toBe(413);
  });
});
