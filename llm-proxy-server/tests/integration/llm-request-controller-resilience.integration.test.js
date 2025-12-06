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

import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';

const localModelConfig = {
  configId: 'local-llm',
  displayName: 'Local Test LLM',
  modelIdentifier: 'test-local',
  endpointUrl: 'http://localhost:11434',
  apiType: 'ollama',
  defaultParameters: {},
  promptElements: [],
  promptAssemblyOrder: [],
};

const basePayload = {
  llmId: localModelConfig.configId,
  targetPayload: { prompt: 'ping' },
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

function createAppConfig(overrides = {}) {
  const proxyRootPath = overrides.proxyRootPath ?? '';
  const cacheEnabled = overrides.cacheEnabled ?? false;
  const cacheTtl = overrides.cacheTtl ?? 0;
  return {
    isCacheEnabled: () => cacheEnabled,
    getApiKeyCacheTtl: () => cacheTtl,
    getProxyProjectRootPathForApiKeyFiles: () => proxyRootPath,
    getSalvageConfig: () => ({ defaultTtl: 50, maxEntries: 10 }),
  };
}

function createOperationalConfigService(config = localModelConfig) {
  return {
    isOperational: jest.fn(() => true),
    getInitializationErrorDetails: jest.fn(() => null),
    getLlmById: jest.fn(() => config),
  };
}

describe('LlmRequestController integration resilience scenarios', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('enforces required dependencies during construction', () => {
    const logger = createLogger();
    const llmConfigService = createOperationalConfigService();
    const dummyService = {};

    expect(
      () =>
        new LlmRequestController(
          undefined,
          llmConfigService,
          dummyService,
          dummyService
        )
    ).toThrow('LlmRequestController: logger is required.');

    expect(
      () =>
        new LlmRequestController(logger, undefined, dummyService, dummyService)
    ).toThrow('LlmRequestController: llmConfigService is required.');

    expect(
      () =>
        new LlmRequestController(
          logger,
          llmConfigService,
          undefined,
          dummyService
        )
    ).toThrow('LlmRequestController: apiKeyService is required.');

    expect(
      () =>
        new LlmRequestController(
          logger,
          llmConfigService,
          dummyService,
          undefined
        )
    ).toThrow('LlmRequestController: llmRequestService is required.');
  });

  it('falls back to default identifiers when request tracking context is missing', async () => {
    const logger = createLogger();
    const llmConfigService = createOperationalConfigService();
    const fileReader = new NodeFileSystemReader();
    const appConfig = createAppConfig();
    const cacheService = new CacheService(logger, { enableAutoCleanup: false });
    const apiKeyService = new ApiKeyService(
      logger,
      fileReader,
      appConfig,
      cacheService
    );
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 200,
      maxEntries: 5,
    });

    const llmRequestService = {
      forwardRequest: jest.fn(async () => ({
        success: true,
        data: { ok: true, provider: 'local' },
        statusCode: 201,
      })),
    };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );

    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    app.post('/api/llm-request', async (req, res, next) => {
      try {
        delete req.requestId;
        await controller.handleLlmRequest(req, res);
      } catch (error) {
        next(error);
      }
    });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(201);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({ ok: true, provider: 'local' });
      expect(llmRequestService.forwardRequest).toHaveBeenCalledTimes(1);
      expect(salvageService.getStats().salvaged).toBe(0);
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('salvages successful responses when downstream delivery is blocked without commitment helpers', async () => {
    const logger = createLogger();
    const llmConfigService = createOperationalConfigService();
    const fileReader = new NodeFileSystemReader();
    const appConfig = createAppConfig();
    const cacheService = new CacheService(logger, { enableAutoCleanup: false });
    const apiKeyService = new ApiKeyService(
      logger,
      fileReader,
      appConfig,
      cacheService
    );
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 200,
      maxEntries: 5,
    });

    const llmRequestService = {
      forwardRequest: jest.fn(async () => ({
        success: true,
        data: { message: 'streamed' },
        statusCode: 202,
        contentTypeIfSuccess: 'application/json',
      })),
    };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );

    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    const salvageSpy = jest.spyOn(salvageService, 'salvageResponse');

    app.post('/api/llm-request', async (req, res, next) => {
      try {
        res.write('preface');
        delete res.isResponseCommitted;
        await controller.handleLlmRequest(req, res);
        if (!res.writableEnded) {
          res.end();
        }
      } catch (error) {
        next(error);
      }
    });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('preface');
      expect(llmRequestService.forwardRequest).toHaveBeenCalledTimes(1);
      const stats = salvageService.getStats();
      expect(stats.salvaged).toBe(1);
      expect(salvageSpy).toHaveBeenCalledTimes(1);
      const salvagedRequestId = salvageSpy.mock.calls[0][0];
      const salvagedEntry =
        salvageService.retrieveByRequestId(salvagedRequestId);
      expect(salvagedEntry).not.toBeNull();
      expect(salvagedEntry?.statusCode).toBe(202);
      expect(salvagedEntry?.responseData).toEqual({ message: 'streamed' });
    } finally {
      salvageSpy.mockRestore();
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('uses default error metadata when the request service omits details', async () => {
    const logger = createLogger();
    const llmConfigService = createOperationalConfigService();
    const fileReader = new NodeFileSystemReader();
    const appConfig = createAppConfig();
    const cacheService = new CacheService(logger, { enableAutoCleanup: false });
    const apiKeyService = new ApiKeyService(
      logger,
      fileReader,
      appConfig,
      cacheService
    );
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 200,
      maxEntries: 5,
    });

    const llmRequestService = {
      forwardRequest: jest.fn(async () => ({
        success: false,
        statusCode: 502,
      })),
    };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );

    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    app.post('/api/llm-request', async (req, res, next) => {
      try {
        await controller.handleLlmRequest(req, res);
      } catch (error) {
        next(error);
      }
    });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(502);
      expect(response.body.stage).toBe('llm_service_unknown_error_stage');
      expect(response.body.message).toBe(
        'An unspecified error occurred in the LLM request service.'
      );
      expect(response.body.details).toEqual({
        llmId: basePayload.llmId,
        reason: 'LlmRequestService did not provide error details.',
      });
      expect(llmRequestService.forwardRequest).toHaveBeenCalledTimes(1);
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });
});
