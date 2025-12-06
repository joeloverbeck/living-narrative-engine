import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';

const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('timeout middleware integration coverage for overlooked branches', () => {
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
  });

  it('reports unknown commitment metadata when tracker hooks are removed mid-flight', async () => {
    const app = express();

    app.post(
      '/commitment-unknown',
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
        res.getCommitmentSource = () => {
          delete res.getCommitmentSource;
          return 'handler-start';
        };
        next();
      },
      createTimeoutMiddleware(25, { logger }),
      (_req, res) => {
        res.commitResponse('handler-start');
        setTimeout(() => {
          try {
            res.status(200).json({ recovered: true });
          } catch (_error) {
            // Ignore late writes once the timeout middleware has already committed a response.
          }
        }, 80);
      }
    );

    const response = await request(app).post('/commitment-unknown').send({});

    expect(response.status).toBe(200);
    const timeoutWarning = logger.warn.mock.calls.find((call) =>
      call[0].includes('Timeout cannot commit response')
    );
    expect(timeoutWarning).toBeDefined();
    expect(timeoutWarning?.[1]).toMatchObject({
      existingCommitment: 'unknown',
    });
  });

  it('enforces fractional kilobyte limits without rounding up the configured ceiling', async () => {
    const app = express();
    const sizeConfig = createSizeLimitConfig({
      jsonLimit: '1.75kb',
      enforceMaxLimit: false,
    });

    app.use(express.json(sizeConfig.json));
    app.post('/fractional-limit', (req, res) => {
      res.status(200).json({ length: req.body?.payload?.length ?? 0 });
    });

    const smallPayload = 'a'.repeat(1500);
    const withinLimit = await request(app)
      .post('/fractional-limit')
      .set('Content-Type', 'application/json')
      .send({ payload: smallPayload });
    expect(withinLimit.status).toBe(200);

    const largePayload = 'b'.repeat(1900);
    const blocked = await request(app)
      .post('/fractional-limit')
      .set('Content-Type', 'application/json')
      .send({ payload: largePayload });
    expect(blocked.status).toBe(413);
  });
});
