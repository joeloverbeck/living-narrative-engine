/**
 * @file response-salvage-service-expiration.integration.test.js
 * @description Additional integration coverage for ResponseSalvageService focusing on
 *              timer replacement and retrieval-driven expiration semantics.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';
import { SalvageRequestController } from '../../src/handlers/salvageRequestController.js';
import { createSalvageRoutes } from '../../src/routes/salvageRoutes.js';

const basePayload = {
  model: 'gpt-sandbox',
  messages: [
    {
      role: 'user',
      content: 'ping',
    },
  ],
  temperature: 0.25,
};

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

function createApp(logger, salvageService) {
  const controller = new SalvageRequestController(logger, salvageService);
  const app = express();
  app.use(express.json());
  app.use('/api/llm-request', createSalvageRoutes(controller));
  return app;
}

describe('ResponseSalvageService expiration integration flows', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('re-salvaging a request extends its TTL and preserves the latest payload', async () => {
    jest.setTimeout(10_000);

    const logger = createLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 500,
    });
    const app = createApp(logger, salvageService);

    const requestId = 'repeat-request';
    const llmId = 'integration-llm';

    salvageService.salvageResponse(
      requestId,
      llmId,
      basePayload,
      { data: 'first-response' },
      202,
      50
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    salvageService.salvageResponse(
      requestId,
      llmId,
      basePayload,
      { data: 'second-response', trace: true },
      200,
      200
    );

    await new Promise((resolve) => setTimeout(resolve, 80));

    const recovery = await request(app).get(
      `/api/llm-request/salvage/${requestId}`
    );

    expect(recovery.status).toBe(200);
    expect(recovery.body).toMatchObject({
      data: 'second-response',
      trace: true,
      _salvageMetadata: {
        originalRequestId: requestId,
        llmId,
        recovered: true,
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      `ResponseSalvageService: Salvaged response for request ${requestId}`,
      expect.objectContaining({ statusCode: 200 })
    );

    const stats = salvageService.getStats();
    expect(stats).toEqual({
      salvaged: 1,
      totalCacheEntries: 2,
      activeTimers: 1,
    });

    salvageService.clear();
  });

  test('retrieval after TTL expiry clears stale cache entries via request and signature lookups', async () => {
    jest.setTimeout(10_000);

    const logger = createLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 200,
    });
    const app = createApp(logger, salvageService);

    const llmId = 'integration-llm';
    const requestId = 'stale-request';

    salvageService.salvageResponse(
      requestId,
      llmId,
      basePayload,
      { data: 'stale' },
      202,
      120
    );

    const originalNow = Date.now();
    const futureNow = originalNow + 250;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => futureNow);

    const staleRecovery = await request(app).get(
      `/api/llm-request/salvage/${requestId}`
    );

    nowSpy.mockRestore();

    expect(staleRecovery.status).toBe(404);
    expect(staleRecovery.body).toMatchObject({
      stage: 'salvage_not_found',
      details: expect.objectContaining({ requestId }),
    });

    expect(logger.debug).toHaveBeenCalledWith(
      `ResponseSalvageService: Expired salvaged response for request ${requestId}`,
      { requestId }
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'SalvageRequestController: No salvaged response found',
      expect.objectContaining({ requestId })
    );

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    const signatureRequestId = 'signature-request';

    salvageService.salvageResponse(
      signatureRequestId,
      llmId,
      basePayload,
      { data: 'signature-payload' },
      206,
      150
    );

    const futureSignatureNow = Date.now() + 260;
    const signatureSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => futureSignatureNow);

    const signatureLookup = salvageService.retrieveBySignature(
      llmId,
      basePayload
    );

    signatureSpy.mockRestore();

    expect(signatureLookup).toBeNull();

    expect(logger.debug).toHaveBeenCalledWith(
      `ResponseSalvageService: Expired salvaged response for request ${signatureRequestId}`,
      { requestId: signatureRequestId }
    );

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 170));

    salvageService.clear();
  });
});
