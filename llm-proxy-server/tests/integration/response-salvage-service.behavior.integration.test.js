import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
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

function createOperationalLlmConfigService(llmModelConfig) {
  return {
    isOperational: jest.fn(() => true),
    getInitializationErrorDetails: jest.fn(() => null),
    getLlmById: jest.fn(() => llmModelConfig),
  };
}

function createApiKeyService() {
  return {
    isApiKeyRequired: jest.fn(() => false),
  };
}

function createSuccessfulRequestService(responsePayload) {
  return {
    forwardRequest: jest.fn(async () => ({
      success: true,
      statusCode: 202,
      data: responsePayload,
      contentTypeIfSuccess: 'application/json',
    })),
  };
}

describe('ResponseSalvageService integration behaviour', () => {
  const basePayload = {
    llmId: 'test-llm',
    targetPayload: {
      model: 'gpt-sandbox',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.1,
    },
    targetHeaders: {
      'x-test': 'value',
    },
  };

  const llmModelConfig = {
    configId: 'test-llm',
    displayName: 'Test Model',
    modelIdentifier: 'gpt-sandbox',
    endpointUrl: 'https://example.com',
    apiType: 'openai',
    defaultParameters: {},
    promptElements: [],
    promptAssemblyOrder: [],
  };

  const createTestApp = (logger, salvageService, llmRequestService) => {
    const llmConfigService = createOperationalLlmConfigService(llmModelConfig);
    const apiKeyService = createApiKeyService();
    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const salvageController = new SalvageRequestController(
      logger,
      salvageService
    );

    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    app.post('/api/llm-request', async (req, res, next) => {
      try {
        const shouldForceTimeout = req.headers['x-force-timeout'] === 'true';
        if (shouldForceTimeout) {
          res.commitResponse('timeout');
        }

        await controller.handleLlmRequest(req, res);

        if (shouldForceTimeout) {
          res.status(504).json({
            error: true,
            stage: 'proxy_timeout',
            message:
              'Client timeout occurred before response could be delivered. Retry with the provided X-Request-ID.',
          });
        }
      } catch (error) {
        next(error);
      }
    });

    app.use('/api/llm-request', createSalvageRoutes(salvageController));
    return { app, llmConfigService, apiKeyService };
  };

  test('salvages successful LLM responses when response guard is pre-committed', async () => {
    const logger = createLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 250,
    });
    const responsePayload = { ok: true, data: { reply: 'from-llm' } };
    const llmRequestService = createSuccessfulRequestService(responsePayload);
    const { app } = createTestApp(logger, salvageService, llmRequestService);

    const forcedTimeoutResponse = await request(app)
      .post('/api/llm-request')
      .set('x-force-timeout', 'true')
      .send(basePayload);

    expect(forcedTimeoutResponse.status).toBe(504);
    expect(llmRequestService.forwardRequest).toHaveBeenCalledWith(
      basePayload.llmId,
      expect.objectContaining({ configId: basePayload.llmId }),
      basePayload.targetPayload,
      basePayload.targetHeaders,
      null
    );

    const salvagedRequestId = forcedTimeoutResponse.headers['x-request-id'];
    expect(typeof salvagedRequestId).toBe('string');

    const salvageRetrieval = await request(app).get(
      `/api/llm-request/salvage/${salvagedRequestId}`
    );

    expect(salvageRetrieval.status).toBe(202);
    expect(salvageRetrieval.body).toMatchObject({
      ...responsePayload,
      _salvageMetadata: {
        originalRequestId: salvagedRequestId,
        llmId: basePayload.llmId,
        recovered: true,
      },
    });

    const signatureRecovery = salvageService.retrieveBySignature(
      basePayload.llmId,
      basePayload.targetPayload
    );
    expect(signatureRecovery).toEqual(
      expect.objectContaining({
        responseData: responsePayload,
        statusCode: 202,
        requestId: salvagedRequestId,
        fromCache: true,
      })
    );

    const stats = salvageService.getStats();
    expect(stats).toEqual(
      expect.objectContaining({
        salvaged: 1,
        totalCacheEntries: 2,
        activeTimers: 1,
      })
    );

    salvageService.cleanup();
  });

  test('expires salvaged responses on TTL and cleanup clears timers', async () => {
    jest.setTimeout(10_000);
    const logger = createLogger();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 40,
    });
    const responsePayload = { ok: true, data: { reply: 'ttl-test' } };
    const llmRequestService = createSuccessfulRequestService(responsePayload);
    const { app } = createTestApp(logger, salvageService, llmRequestService);

    const firstAttempt = await request(app)
      .post('/api/llm-request')
      .set('x-force-timeout', 'true')
      .send(basePayload);

    expect(firstAttempt.status).toBe(504);
    const requestId = firstAttempt.headers['x-request-id'];

    // Wait past TTL so the salvaged entry should expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const expiredLookup = await request(app).get(
      `/api/llm-request/salvage/${requestId}`
    );
    expect(expiredLookup.status).toBe(404);

    const signatureExpired = salvageService.retrieveBySignature(
      basePayload.llmId,
      basePayload.targetPayload
    );
    expect(signatureExpired).toBeNull();

    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });

    // Salvage another response and then clear to ensure timers are torn down
    salvageService.salvageResponse(
      'manual-request',
      basePayload.llmId,
      basePayload.targetPayload,
      { data: 'manual' },
      200,
      100
    );

    expect(salvageService.getStats()).toEqual(
      expect.objectContaining({
        salvaged: 1,
        totalCacheEntries: 2,
        activeTimers: 1,
      })
    );

    salvageService.clear();
    expect(salvageService.getStats()).toEqual({
      salvaged: 0,
      totalCacheEntries: 0,
      activeTimers: 0,
    });

    salvageService.cleanup();
    expect(logger.info).toHaveBeenCalledWith(
      'ResponseSalvageService: Cleanup complete'
    );
  });
});
