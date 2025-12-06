/**
 * @file response-salvage-service-signature.integration.test.js
 * @description Integration tests covering signature-based recovery paths of ResponseSalvageService
 */

import { describe, it, afterEach, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';
import { SalvageRequestController } from '../../src/handlers/salvageRequestController.js';
import { createSalvageRoutes } from '../../src/routes/salvageRoutes.js';

/**
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Builds an express app that exposes helper endpoints for exercising signature-based salvage flows.
 * @param {{ defaultTtl?: number }} [options]
 */
function buildApp(options = {}) {
  const logger = createLogger();
  const salvageService = new ResponseSalvageService(logger, options);
  const salvageController = new SalvageRequestController(
    logger,
    salvageService
  );

  const app = express();
  app.use(express.json());

  // Standard salvage routes for request-id recovery and stats.
  app.use('/api/llm-request', createSalvageRoutes(salvageController));

  // Helper endpoint to seed the salvage cache without bypassing controller logic.
  app.post('/api/llm-request/simulate-salvage', (req, res) => {
    const {
      requestId,
      llmId,
      targetPayload,
      responseData,
      statusCode = 200,
      ttl,
    } = req.body;
    salvageService.salvageResponse(
      requestId,
      llmId,
      targetPayload,
      responseData,
      statusCode,
      ttl
    );
    return res.status(202).json({ requestId });
  });

  // Endpoint that models duplicate detection by looking up responses via signature.
  app.post('/api/llm-request/duplicate-check', (req, res) => {
    const { llmId, targetPayload } = req.body;
    const recovered = salvageService.retrieveBySignature(llmId, targetPayload);
    if (!recovered) {
      return res.status(404).json({ error: true, stage: 'salvage_not_found' });
    }
    return res.status(200).json(recovered);
  });

  app.delete('/api/llm-request/salvage-cleanup', (_req, res) => {
    salvageService.cleanup();
    return res.status(204).send();
  });

  return { app, salvageService, logger };
}

describe('ResponseSalvageService signature integration', () => {
  let salvageService;

  afterEach(() => {
    if (salvageService) {
      salvageService.cleanup();
      salvageService = null;
    }
  });

  it('retrieves salvaged responses via signature and preserves request metadata', async () => {
    const { app, salvageService: serviceInstance } = buildApp();
    salvageService = serviceInstance;

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are concise.' },
        { role: 'user', content: 'Summarize integration testing.' },
      ],
      temperature: 0.3,
    };

    const responseBody = { content: 'Here is your summary.' };
    const requestId = 'sig-integration-1';
    const llmId = 'openai:gpt-4o-mini';

    await request(app)
      .post('/api/llm-request/simulate-salvage')
      .send({
        requestId,
        llmId,
        targetPayload: payload,
        responseData: responseBody,
        statusCode: 200,
      })
      .expect(202);

    const duplicateCheck = await request(app)
      .post('/api/llm-request/duplicate-check')
      .send({ llmId, targetPayload: payload })
      .expect(200);

    expect(duplicateCheck.body.responseData).toEqual(responseBody);
    expect(duplicateCheck.body.fromCache).toBe(true);
    expect(duplicateCheck.body.requestId).toBe(requestId);
    expect(duplicateCheck.body.llmId).toBe(llmId);

    const stats = await request(app)
      .get('/api/llm-request/salvage-stats')
      .expect(200);
    expect(stats.body.stats.salvaged).toBe(1);
    expect(stats.body.stats.totalCacheEntries).toBe(2);
  });

  it('expires signature lookups once TTL elapses and prunes cache entries', async () => {
    const { app, salvageService: serviceInstance } = buildApp({
      defaultTtl: 50,
    });
    salvageService = serviceInstance;

    const payload = {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.1,
    };

    await request(app)
      .post('/api/llm-request/simulate-salvage')
      .send({
        requestId: 'sig-expire',
        llmId: 'test:expire',
        targetPayload: payload,
        responseData: { content: 'Short lived' },
        statusCode: 200,
      })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 70));

    const duplicateCheck = await request(app)
      .post('/api/llm-request/duplicate-check')
      .send({ llmId: 'test:expire', targetPayload: payload })
      .expect(404);
    expect(duplicateCheck.body.stage).toBe('salvage_not_found');

    const stats = await request(app)
      .get('/api/llm-request/salvage-stats')
      .expect(200);
    expect(stats.body.stats.salvaged).toBe(0);
    expect(stats.body.stats.totalCacheEntries).toBe(0);
  });

  it('cleanup clears cached responses and active timers', async () => {
    const { app, salvageService: serviceInstance } = buildApp();
    salvageService = serviceInstance;

    await request(app)
      .post('/api/llm-request/simulate-salvage')
      .send({
        requestId: 'cleanup-1',
        llmId: 'provider:model-a',
        targetPayload: { model: 'model-a', messages: [] },
        responseData: { content: 'First' },
        statusCode: 200,
      })
      .expect(202);

    await request(app)
      .post('/api/llm-request/simulate-salvage')
      .send({
        requestId: 'cleanup-2',
        llmId: 'provider:model-b',
        targetPayload: { model: 'model-b', messages: [] },
        responseData: { content: 'Second' },
        statusCode: 200,
      })
      .expect(202);

    const preCleanupStats = await request(app)
      .get('/api/llm-request/salvage-stats')
      .expect(200);
    expect(preCleanupStats.body.stats.salvaged).toBe(2);
    expect(preCleanupStats.body.stats.activeTimers).toBe(2);

    await request(app).delete('/api/llm-request/salvage-cleanup').expect(204);

    const postCleanupStats = await request(app)
      .get('/api/llm-request/salvage-stats')
      .expect(200);
    expect(postCleanupStats.body.stats.salvaged).toBe(0);
    expect(postCleanupStats.body.stats.totalCacheEntries).toBe(0);
    expect(postCleanupStats.body.stats.activeTimers).toBe(0);

    await request(app).get('/api/llm-request/salvage/cleanup-1').expect(404);
  });
});
