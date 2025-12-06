import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import http from 'http';

import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('timeout middleware resilience integration', () => {
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not override existing commitment metadata when timeout cannot commit response', async () => {
    const app = express();

    app.post(
      '/precommitted',
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
      createTimeoutMiddleware(25, { logger, gracePeriod: 0 }),
      (_req, res) => {
        res.commitResponse('upstream-handler');

        setTimeout(() => {
          try {
            res.status(200).json({ completed: true });
          } catch (_error) {
            // If the timeout already finalized the response we ignore the error.
          }
        }, 80);
      }
    );

    const response = await request(app).post('/precommitted').send({});
    expect(response.status).toBe(200);

    const commitWarning = logger.warn.mock.calls.find(([message]) =>
      message.includes('Timeout cannot commit response')
    );
    expect(commitWarning).toBeDefined();
    expect(commitWarning?.[1]).toMatchObject({
      existingCommitment: 'upstream-handler',
    });
  });

  it('transitions request state before emitting the timeout response payload', async () => {
    const app = express();
    const transitionState = jest.fn();

    app.use((req, _res, next) => {
      req.transitionState = transitionState;
      next();
    });

    app.post(
      '/transition-tracked',
      createTimeoutMiddleware(30, { logger }),
      (_req, _res) => {
        // Intentionally left blank so the timeout middleware controls the response.
      }
    );

    const response = await request(app).post('/transition-tracked').send({});

    expect(response.status).toBe(503);
    expect(response.body.stage).toBe('request_timeout');
    expect(transitionState).toHaveBeenCalledWith('timeout', { timeoutMs: 30 });
  });

  it('logs connection closure after timeout when the client disconnects during the grace period', async () => {
    const app = express();

    app.use((req, _res, next) => {
      req.requestId = 'grace-close';
      next();
    });

    app.post(
      '/graceful-close',
      createTimeoutMiddleware(40, { logger, gracePeriod: 150 }),
      (_req, _res) => {
        // The handler does not send a response; the timeout middleware and grace period control flow.
      }
    );

    const server = await new Promise((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    const { port } = server.address();

    await new Promise((resolve) => {
      const req = http.request(
        {
          method: 'POST',
          port,
          path: '/graceful-close',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength('{}'),
          },
        },
        () => {
          // No response handler needed; the request will be destroyed below.
        }
      );

      req.on('error', () => {
        // Connection will be intentionally destroyed as part of the test.
      });

      req.end('{}');

      setTimeout(() => {
        req.destroy();
      }, 80);

      setTimeout(() => {
        server.close(resolve);
      }, 260);
    });

    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('Timeout fired after 40ms')
      )
    ).toBe(true);

    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Connection closed after timeout')
      )
    ).toBe(true);
  });

  it('accepts numeric and implicit-byte JSON limits without breaching the security ceiling', async () => {
    const numericConfig = createSizeLimitConfig({ jsonLimit: 2048 });
    expect(numericConfig.json.limit).toBe(2048);

    const implicitBytesConfig = createSizeLimitConfig({ jsonLimit: '4096' });
    expect(implicitBytesConfig.json.limit).toBe('4096');

    const invalidConfig = createSizeLimitConfig({ jsonLimit: 'not-a-size' });
    expect(invalidConfig.json.limit).toBe('not-a-size');

    const app = express();
    app.use(express.json(numericConfig.json));
    app.post('/numeric-limit', (req, res) => {
      res.status(200).json({ received: !!req.body });
    });

    const okResponse = await request(app)
      .post('/numeric-limit')
      .set('content-type', 'application/json')
      .send({ data: 'a'.repeat(64) });
    expect(okResponse.status).toBe(200);

    const largePayload = { data: 'b'.repeat(8 * 1024) };
    const overLimitResponse = await request(app)
      .post('/numeric-limit')
      .set('content-type', 'application/json')
      .send(largePayload);
    expect(overLimitResponse.status).toBe(413);
  });
});
