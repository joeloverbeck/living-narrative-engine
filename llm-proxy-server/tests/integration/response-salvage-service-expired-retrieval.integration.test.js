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

describe('ResponseSalvageService integration: expired retrieval safeguards', () => {
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
    salvageService = new ResponseSalvageService(logger, { defaultTtl: 200 });

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

    app.post('/api/llm-request/check-signature', (req, res) => {
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

  it('keeps salvaged payloads beyond the first TTL when a replacement salvage occurs', async () => {
    const payload = {
      model: 'gpt-recover',
      messages: [{ role: 'user', content: 'extend me' }],
      temperature: 0.1,
    };

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'extend-test',
        llmId: 'llm-extend',
        payload,
        responseData: { reply: 'initial copy' },
        statusCode: 202,
        ttl: 40,
      })
      .expect(202);

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'extend-test',
        llmId: 'llm-extend',
        payload,
        responseData: { reply: 'extended copy' },
        statusCode: 202,
        ttl: 400,
      })
      .expect(202);

    await jest.advanceTimersByTimeAsync(80);

    const midWindow = await request(app).get(
      '/api/llm-request/salvage/extend-test'
    );

    expect(midWindow.status).toBe(202);
    expect(midWindow.body.reply).toBe('extended copy');
    expect(midWindow.body._salvageMetadata.recovered).toBe(true);

    expect(salvageService.getStats()).toEqual({
      salvaged: 1,
      totalCacheEntries: 2,
      activeTimers: 1,
    });

    await jest.advanceTimersByTimeAsync(400);

    const afterExpiry = await request(app).get(
      '/api/llm-request/salvage/extend-test'
    );
    expect(afterExpiry.status).toBe(404);
    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });
  });

  it('purges stale cache entries during request-id recovery when TTL has already elapsed', async () => {
    const payload = {
      model: 'gpt-expire',
      messages: [{ role: 'system', content: 'expire immediately' }],
      temperature: 0,
    };

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'stale-request',
        llmId: 'llm-expire',
        payload,
        responseData: { reply: 'stale copy' },
        statusCode: 200,
        ttl: -5,
      })
      .expect(202);

    const expiredLookup = await request(app).get(
      '/api/llm-request/salvage/stale-request'
    );

    expect(expiredLookup.status).toBe(404);
    expect(expiredLookup.body.stage).toBe('salvage_not_found');

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });
  });

  it('removes expired signature matches on access to prevent stale duplicate recovery', async () => {
    const payload = {
      model: 'gpt-signature',
      messages: [{ role: 'user', content: 'stale duplicate' }],
      temperature: 0.3,
    };

    await request(app)
      .post('/api/llm-request/store-salvage')
      .send({
        requestId: 'signature-stale',
        llmId: 'llm-signature',
        payload,
        responseData: { value: 'stale result' },
        statusCode: 201,
        ttl: -10,
      })
      .expect(202);

    const signatureCheck = await request(app)
      .post('/api/llm-request/check-signature')
      .send({ llmId: 'llm-signature', payload });

    expect(signatureCheck.status).toBe(404);
    expect(signatureCheck.body).toEqual({ recovered: false });

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });
  });
});
