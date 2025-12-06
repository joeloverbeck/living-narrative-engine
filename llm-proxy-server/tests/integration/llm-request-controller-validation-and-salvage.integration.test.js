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
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';

const baseModelConfig = {
  configId: 'cloud-llm',
  displayName: 'Cloud Test LLM',
  modelIdentifier: 'test-model',
  endpointUrl: 'https://example.com/llm',
  apiType: 'openai',
  defaultParameters: {},
  promptElements: [],
  promptAssemblyOrder: [],
};

const basePayload = {
  llmId: baseModelConfig.configId,
  targetPayload: { prompt: 'hello' },
  targetHeaders: { 'x-test': 'yes' },
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

function setupApp({ controller, logger, beforeHandle, afterHandle }) {
  const app = express();
  app.use(express.json());
  app.use(createRequestTrackingMiddleware({ logger }));

  app.post('/api/llm-request', async (req, res, next) => {
    try {
      if (beforeHandle) {
        await beforeHandle(req, res);
      }
      await controller.handleLlmRequest(req, res);
      if (afterHandle) {
        await afterHandle(req, res);
      }
    } catch (error) {
      next(error);
    }
  });

  return app;
}

describe('LlmRequestController integration: validation and salvage coverage', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns initialization failure details when proxy is not operational', async () => {
    const logger = createLogger();
    const llmConfigService = {
      isOperational: jest.fn(() => false),
      getInitializationErrorDetails: jest.fn(() => ({
        message: 'Configuration incomplete',
        stage: 'init_failed_config',
        details: { missing: 'llm-configs.json' },
      })),
      getLlmById: jest.fn(),
    };
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
      defaultTtl: 25,
      maxEntries: 5,
    });
    const llmRequestService = { forwardRequest: jest.fn() };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const app = setupApp({ controller, logger });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(503);
      expect(response.body.error).toBe(true);
      expect(response.body.stage).toBe('init_failed_config');
      expect(llmConfigService.getInitializationErrorDetails).toHaveBeenCalled();
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('rejects requests missing llmId before hitting downstream services', async () => {
    const logger = createLogger();
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => baseModelConfig),
    };
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
      defaultTtl: 25,
      maxEntries: 5,
    });
    const llmRequestService = { forwardRequest: jest.fn() };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const app = setupApp({ controller, logger });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send({ targetPayload: { prompt: 'no id yet' } });

      expect(response.status).toBe(400);
      expect(response.body.stage).toBe('request_validation_llmid_missing');
      expect(response.body.error).toBe(true);
      expect(llmConfigService.getLlmById).not.toHaveBeenCalled();
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('rejects requests missing target payload details', async () => {
    const logger = createLogger();
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => baseModelConfig),
    };
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
      defaultTtl: 25,
      maxEntries: 5,
    });
    const llmRequestService = { forwardRequest: jest.fn() };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const app = setupApp({ controller, logger });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send({ llmId: baseModelConfig.configId });

      expect(response.status).toBe(400);
      expect(response.body.stage).toBe('request_validation_payload_missing');
      expect(response.body.error).toBe(true);
      expect(llmConfigService.getLlmById).not.toHaveBeenCalled();
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('reports configuration lookup failures when llmId is unknown', async () => {
    const logger = createLogger();
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => null),
    };
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
      defaultTtl: 25,
      maxEntries: 5,
    });
    const llmRequestService = { forwardRequest: jest.fn() };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const app = setupApp({ controller, logger });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(400);
      expect(response.body.stage).toBe('llm_config_lookup_failed');
      expect(response.body.details.requestedLlmId).toBe(basePayload.llmId);
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('salvages successful responses when headers were already committed', async () => {
    const logger = createLogger();
    const localModelConfig = {
      ...baseModelConfig,
      apiType: 'ollama',
    };
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => localModelConfig),
    };
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
        data: { ok: true },
        statusCode: 201,
        contentTypeIfSuccess: 'application/json',
      })),
    };
    const salvageSpy = jest.spyOn(salvageService, 'salvageResponse');

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );

    const app = setupApp({
      controller,
      logger,
      beforeHandle: async (req, res) => {
        res.write('preface');
      },
      afterHandle: async (req, res) => {
        if (!res.writableEnded) {
          res.end();
        }
      },
    });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send({
          ...basePayload,
          llmId: localModelConfig.configId,
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('preface');
      expect(llmRequestService.forwardRequest).toHaveBeenCalledWith(
        localModelConfig.configId,
        localModelConfig,
        expect.any(Object),
        expect.any(Object),
        null
      );
      expect(salvageSpy).toHaveBeenCalledTimes(1);
      const salvagedRequestId = salvageSpy.mock.calls[0][0];
      const salvagedEntry =
        salvageService.retrieveByRequestId(salvagedRequestId);
      expect(salvagedEntry).not.toBeNull();
      expect(salvagedEntry?.statusCode).toBe(201);
    } finally {
      salvageSpy.mockRestore();
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('propagates downstream failure responses from LlmRequestService', async () => {
    const logger = createLogger();
    const envVarName = 'LLM_PROXY_TEST_KEY';
    process.env[envVarName] = 'super-secret';

    const modelConfig = {
      ...baseModelConfig,
      apiKeyEnvVar: envVarName,
    };
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => modelConfig),
    };
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
      defaultTtl: 25,
      maxEntries: 5,
    });
    const llmRequestService = {
      forwardRequest: jest.fn(async () => ({
        success: false,
        statusCode: 502,
        errorStage: 'llm_upstream_failure',
        errorMessage: 'Upstream gateway failure',
        errorDetailsForClient: {
          llmId: modelConfig.configId,
          reason: 'upstream',
        },
      })),
    };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const app = setupApp({ controller, logger });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(502);
      expect(response.body.stage).toBe('llm_upstream_failure');
      expect(response.body.details.llmId).toBe(modelConfig.configId);
      expect(llmRequestService.forwardRequest).toHaveBeenCalledWith(
        modelConfig.configId,
        modelConfig,
        expect.any(Object),
        expect.any(Object),
        'super-secret'
      );
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('sends standardized error response when LlmRequestService throws unexpectedly', async () => {
    const logger = createLogger();
    const envVarName = 'LLM_PROXY_TEST_KEY';
    process.env[envVarName] = 'another-secret';

    const modelConfig = {
      ...baseModelConfig,
      apiKeyEnvVar: envVarName,
    };
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => modelConfig),
    };
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
      defaultTtl: 25,
      maxEntries: 5,
    });
    const llmRequestService = {
      forwardRequest: jest.fn(async () => {
        throw new Error('provider exploded');
      }),
    };

    const controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService
    );
    const app = setupApp({ controller, logger });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(500);
      expect(response.body.stage).toBe('internal_llm_service_exception');
      expect(response.body.details.originalErrorMessage).toBe(
        'provider exploded'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL - LlmRequestService threw an unexpected exception'
        ),
        expect.objectContaining({
          details: expect.objectContaining({ llmId: modelConfig.configId }),
        })
      );
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });
});
