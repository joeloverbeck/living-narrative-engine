import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { SalvageRequestController } from '../../src/handlers/salvageRequestController.js';
import { createSalvageRoutes } from '../../src/routes/salvageRoutes.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';

function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('ResponseSalvageService integration: timer and signature resilience', () => {
  /** @type {express.Express} */
  let app;
  /** @type {ResponseSalvageService} */
  let salvageService;
  let logger;
  let baseTime;

  beforeEach(() => {
    jest.useFakeTimers();
    baseTime = Date.now();
    jest.setSystemTime(baseTime);

    logger = createLogger();
    salvageService = new ResponseSalvageService(logger, { defaultTtl: 100 });

    const controller = new SalvageRequestController(logger, salvageService);

    app = express();
    app.use(express.json());

    app.use('/api/llm-request', createSalvageRoutes(controller));

    app.post('/api/llm-request/store-salvage', (req, res) => {
      const { requestId, llmId, payload, responseData, statusCode, ttl } =
        req.body;

      salvageService.salvageResponse(
        requestId,
        llmId,
        payload,
        responseData,
        statusCode,
        ttl
      );

      res.status(202).json({ stored: true });
    });

    app.post('/api/llm-request/check-duplicate', (req, res) => {
      const { llmId, payload } = req.body;
      const recovered = salvageService.retrieveBySignature(llmId, payload);

      if (recovered) {
        return res.status(200).json(recovered);
      }

      return res.status(404).json({ recovered: false });
    });
  });

  afterEach(async () => {
    if (salvageService) {
      salvageService.cleanup();
    }

    await jest.runOnlyPendingTimersAsync();
    jest.useRealTimers();
  });

  it('throws a descriptive error when constructed without a logger dependency', () => {
    expect(() => new ResponseSalvageService(undefined, {})).toThrow(
      'ResponseSalvageService: logger is required'
    );
  });

  it('replaces existing expiration timers when re-salvaging the same request', async () => {
    const payload = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'keep me for longer' }],
      temperature: 0.4,
    };

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'timer-test',
        llmId: 'llm-timer',
        payload,
        responseData: { reply: 'initial copy' },
        statusCode: 202,
      })
      .expect(202);

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'timer-test',
        llmId: 'llm-timer',
        payload,
        responseData: { reply: 'extended copy' },
        statusCode: 202,
        ttl: 200,
      })
      .expect(202);

    expect(salvageService.getStats()).toEqual({
      salvaged: 1,
      totalCacheEntries: 2,
      activeTimers: 1,
    });

    await jest.advanceTimersByTimeAsync(120);

    const recovery = await request(app).get(
      '/api/llm-request/salvage/timer-test'
    );

    expect(recovery.status).toBe(202);
    expect(recovery.body.reply).toBe('extended copy');
    expect(recovery.body._salvageMetadata).toMatchObject({
      originalRequestId: 'timer-test',
      llmId: 'llm-timer',
      recovered: true,
    });
  });

  it('expires salvaged responses and clears stats when TTL elapses', async () => {
    const payload = {
      model: 'gpt-4o',
      messages: [{ role: 'system', content: 'short lived' }],
      temperature: 0,
    };

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'expire-me',
        llmId: 'llm-expire',
        payload,
        responseData: { reply: 'temporary' },
        statusCode: 201,
        ttl: 40,
      })
      .expect(202);

    jest.setSystemTime(baseTime + 60);

    const afterExpiration = await request(app).get(
      '/api/llm-request/salvage/expire-me'
    );

    expect(afterExpiration.status).toBe(404);
    expect(afterExpiration.body.stage).toBe('salvage_not_found');

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });
  });

  it('retrieves duplicates by signature and expires them after the TTL window', async () => {
    const payload = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'first attempt' },
        { role: 'assistant', content: 'reply soon' },
      ],
      temperature: 0.2,
    };

    const initialMiss = await request(app)
      .post('/api/llm-request/check-duplicate')
      .send({ llmId: 'llm-duplicate', payload });

    expect(initialMiss.status).toBe(404);
    expect(initialMiss.body).toEqual({ recovered: false });

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'duplicate-1',
        llmId: 'llm-duplicate',
        payload,
        responseData: { answer: 'cached result' },
        statusCode: 200,
        ttl: 150,
      })
      .expect(202);

    const duplicateLookup = await request(app)
      .post('/api/llm-request/check-duplicate')
      .send({ llmId: 'llm-duplicate', payload });

    expect(duplicateLookup.status).toBe(200);
    expect(duplicateLookup.body).toMatchObject({
      responseData: { answer: 'cached result' },
      requestId: 'duplicate-1',
      llmId: 'llm-duplicate',
      fromCache: true,
    });

    jest.setSystemTime(baseTime + 200);

    const expiredDuplicate = await request(app)
      .post('/api/llm-request/check-duplicate')
      .send({ llmId: 'llm-duplicate', payload });

    expect(expiredDuplicate.status).toBe(404);
    expect(expiredDuplicate.body).toEqual({ recovered: false });

    expect(salvageService.retrieveByRequestId('duplicate-1')).toBeNull();
  });
});
