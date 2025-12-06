/**
 * @file timeout-middleware.integration.test.js
 * @description Integration tests ensuring the timeout middleware and size limit
 * configuration interact correctly with real Express request lifecycle tools.
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
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
import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';

jest.setTimeout(15000);

describe('Timeout middleware end-to-end behaviour', () => {
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildAppWithMiddlewares = (routeBuilder) => {
    const app = express();
    app.use(createRequestTrackingMiddleware({ logger }));
    routeBuilder(app);
    return app;
  };

  test('honours previously committed success responses when timeout fires', async () => {
    const app = buildAppWithMiddlewares((instance) => {
      instance.post(
        '/precommitted',
        createTimeoutMiddleware(30, { logger }),
        (req, res) => {
          res.commitResponse('success');

          setTimeout(() => {
            res.status(200).json({ message: 'completed without timeout' });
          }, 60);
        }
      );
    });

    const response = await request(app).post('/precommitted').send({});

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('completed without timeout');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Timeout cannot commit response'),
      expect.objectContaining({ existingCommitment: 'success' })
    );
  });

  test('records timeout state transitions and emits connection close diagnostics', async () => {
    const transitionsLog = [];
    const app = buildAppWithMiddlewares((instance) => {
      instance.use((req, res, next) => {
        res.on('finish', () => {
          transitionsLog.push(req.stateTransitions.map((entry) => entry.to));
        });
        next();
      });

      instance.post(
        '/timeout-state-transitions',
        createTimeoutMiddleware(25, { logger, gracePeriod: 15 }),
        (_req, _res) => {}
      );
    });

    const response = await request(app)
      .post('/timeout-state-transitions')
      .send({});

    expect(response.status).toBe(503);
    expect(transitionsLog).toHaveLength(1);
    const recordedStates = transitionsLog[0];
    expect(recordedStates).toEqual(
      expect.arrayContaining(['responding', 'timeout'])
    );
    expect(
      logger.warn.mock.calls.some((call) =>
        call[0].includes('Timeout response sent')
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some((call) =>
        call[0].includes('Connection closed after timeout')
      )
    ).toBe(true);
  });

  test('waits for grace period before emitting timeout response', async () => {
    const app = buildAppWithMiddlewares((instance) => {
      instance.post(
        '/graceful-timeout',
        createTimeoutMiddleware(30, { logger, gracePeriod: 40 }),
        (_req, _res) => {
          // Intentionally left empty to force timeout pathway
        }
      );
    });

    const start = Date.now();
    const response = await request(app).post('/graceful-timeout').send({});
    const elapsed = Date.now() - start;

    expect(response.status).toBe(503);
    expect(response.body.stage).toBe('request_timeout');
    expect(elapsed).toBeGreaterThanOrEqual(60);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Entering grace period'),
      expect.any(Object)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Timeout response sent'),
      expect.any(Object)
    );
  });

  test('logs when headers already sent prevent timeout body emission', async () => {
    const app = buildAppWithMiddlewares((instance) => {
      instance.post(
        '/partial-stream',
        createTimeoutMiddleware(20, { logger }),
        (_req, res) => {
          res.status(200);
          res.set('Content-Type', 'text/plain');
          res.write('partial');

          setTimeout(() => {
            res.end();
          }, 80);
        }
      );
    });

    const response = await request(app).post('/partial-stream').send('ignored');

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Cannot send timeout response - headers already sent'
      ),
      expect.any(Object)
    );
  });

  test('operates with default options when no logger or tracking middleware is provided', async () => {
    const app = express();
    app.post('/bare-timeout', createTimeoutMiddleware(25), (_req, _res) => {});

    const response = await request(app).post('/bare-timeout').send({});

    expect(response.status).toBe(503);
    expect(response.body.stage).toBe('request_timeout');
    expect(response.body.details.timeoutMs).toBe(25);
  });
});

describe('createSizeLimitConfig integration with Express', () => {
  const createPayload = (sizeInBytes, character = 'x') =>
    character.repeat(sizeInBytes);

  test('enforces tightened limits and returns 413 for oversized payloads', async () => {
    const config = createSizeLimitConfig({ jsonLimit: '2mb' });
    const app = express();
    app.use(express.json(config.json));
    app.post('/limited', (_req, res) => {
      res.status(200).json({ accepted: true });
    });

    const largePayload = createPayload(3 * 1024 * 1024); // 3MB payload exceeds 2MB limit

    const response = await request(app)
      .post('/limited')
      .set('Content-Type', 'application/json')
      .send({ data: largePayload });

    expect(response.status).toBe(413);
  });

  test('allows larger payloads when maximum enforcement is disabled', async () => {
    const config = createSizeLimitConfig({
      jsonLimit: '2mb',
      enforceMaxLimit: false,
    });
    const app = express();
    app.use(express.json(config.json));
    app.post('/permissive', (req, res) => {
      res.status(200).json({ length: req.body.data.length });
    });

    const acceptablePayload = createPayload(1.5 * 1024 * 1024, 'y');

    const response = await request(app)
      .post('/permissive')
      .set('Content-Type', 'application/json')
      .send({ data: acceptablePayload });

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(acceptablePayload.length);
  });

  test('caps configured limits at the security maximum when enforcement is enabled', async () => {
    const config = createSizeLimitConfig({ jsonLimit: '50mb' });
    const app = express();
    app.use(express.json(config.json));
    app.post('/capped', (req, res) => {
      res.status(200).json({ received: req.body.data.length });
    });

    // 1MB payload should be accepted when limit is clamped to 10MB
    const acceptablePayload = createPayload(1 * 1024 * 1024, 'a');
    const okResponse = await request(app)
      .post('/capped')
      .set('Content-Type', 'application/json')
      .send({ data: acceptablePayload });

    expect(okResponse.status).toBe(200);
    expect(okResponse.body.received).toBe(acceptablePayload.length);

    // Payload above 10MB should be rejected because the limit is capped
    const tooLargePayload = createPayload(11 * 1024 * 1024, 'b');
    const cappedResponse = await request(app)
      .post('/capped')
      .set('Content-Type', 'application/json')
      .send({ data: tooLargePayload });

    expect(cappedResponse.status).toBe(413);
  });

  test('supports numeric payload limits for precise byte control', async () => {
    const config = createSizeLimitConfig({
      jsonLimit: 5120,
      enforceMaxLimit: false,
    });
    const app = express();
    app.use(express.json(config.json));
    app.post('/numeric-limit', (_req, res) => {
      res.status(200).json({ accepted: true });
    });

    const slightlyTooLarge = createPayload(6000, 'z');
    const response = await request(app)
      .post('/numeric-limit')
      .set('Content-Type', 'application/json')
      .send({ data: slightlyTooLarge });

    expect(response.status).toBe(413);
  });

  test('rejects payloads exceeding the hard ceiling even when enforcement is disabled', async () => {
    const config = createSizeLimitConfig({
      jsonLimit: '50mb',
      enforceMaxLimit: false,
    });
    const app = express();
    app.use(express.json(config.json));
    app.post('/absolute-limit', (_req, res) => {
      res.status(200).json({ accepted: true });
    });

    const excessivePayload = createPayload(11 * 1024 * 1024, 'c');
    const response = await request(app)
      .post('/absolute-limit')
      .set('Content-Type', 'application/json')
      .send({ data: excessivePayload });

    expect(response.status).toBe(413);
  });

  test('clamps fractional gigabyte inputs to the security maximum boundary', () => {
    const config = createSizeLimitConfig({ jsonLimit: '0.75gb' });

    expect(config.json.limit).toBe(SECURITY_MAX_REQUEST_SIZE);

    const smallBuffer = Buffer.alloc(1024);
    expect(() =>
      config.json.verify(
        { path: '/fractional', method: 'POST' },
        { headersSent: false },
        smallBuffer
      )
    ).not.toThrow();
  });

  test('guards oversized payloads even when jsonLimit string is malformed', () => {
    const config = createSizeLimitConfig({
      jsonLimit: 'definitely-not-a-size',
    });

    const oversizeBuffer = Buffer.alloc(SECURITY_MAX_REQUEST_SIZE_BYTES + 1);
    expect(() =>
      config.json.verify(
        { path: '/malformed', method: 'POST' },
        { headersSent: false },
        oversizeBuffer
      )
    ).toThrow(
      expect.objectContaining({ status: 413, code: 'LIMIT_FILE_SIZE' })
    );
  });
});
