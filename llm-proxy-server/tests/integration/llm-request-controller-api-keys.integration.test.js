import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';

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
  return {
    isCacheEnabled: () => false,
    getApiKeyCacheTtl: () => 0,
    getProxyProjectRootPathForApiKeyFiles: () => overrides.proxyRootPath ?? '',
    getSalvageConfig: () => ({ defaultTtl: 50, maxEntries: 10 }),
    ...overrides,
  };
}

function createOperationalConfigService(modelConfig = baseModelConfig) {
  return {
    isOperational: jest.fn(() => true),
    getInitializationErrorDetails: jest.fn(() => null),
    getLlmById: jest.fn(() => modelConfig),
  };
}

function createController({
  logger,
  llmConfigService,
  apiKeyService,
  llmRequestService,
  salvageService,
}) {
  return new LlmRequestController(
    logger,
    llmConfigService,
    apiKeyService,
    llmRequestService,
    salvageService
  );
}

function setupExpress(controller, logger) {
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

  return app;
}

describe('LlmRequestController API key integration coverage', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns 400 when ApiKeyService reports configuration source errors', async () => {
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

    const llmRequestService = {
      forwardRequest: jest.fn(),
    };
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 25,
      maxEntries: 5,
    });
    const controller = createController({
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService,
    });
    const app = setupExpress(controller, logger);

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(400);
      expect(response.body.stage).toBe('api_key_config_sources_missing');
      expect(response.body.error).toBe(true);
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('returns 500 when environment variable source is missing', async () => {
    const logger = createLogger();
    const modelConfig = {
      ...baseModelConfig,
      apiKeyEnvVar: 'MISSING_LLM_KEY',
    };
    const llmConfigService = createOperationalConfigService(modelConfig);
    const fileReader = new NodeFileSystemReader();
    const appConfig = createAppConfig();
    const cacheService = new CacheService(logger, { enableAutoCleanup: false });
    const apiKeyService = new ApiKeyService(
      logger,
      fileReader,
      appConfig,
      cacheService
    );

    const llmRequestService = {
      forwardRequest: jest.fn(),
    };
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 25,
      maxEntries: 5,
    });
    const controller = createController({
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService,
      salvageService,
    });
    const app = setupExpress(controller, logger);

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send({
          ...basePayload,
          llmId: modelConfig.configId,
        });

      expect(response.status).toBe(500);
      expect(response.body.stage).toBe('api_key_env_var_not_set_or_empty');
      expect(response.body.error).toBe(true);
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      cacheService.cleanup();
      salvageService.cleanup();
    }
  });

  it('handles unexpected ApiKeyService state with internal error response', async () => {
    const logger = createLogger();
    const llmConfigService = createOperationalConfigService();
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 25,
      maxEntries: 5,
    });
    const weirdApiKeyService = {
      isApiKeyRequired: () => true,
      getApiKey: jest.fn(async () => ({
        apiKey: null,
        errorDetails: null,
        source: 'mystery',
      })),
    };
    const llmRequestService = {
      forwardRequest: jest.fn(),
    };
    const controller = createController({
      logger,
      llmConfigService,
      apiKeyService: weirdApiKeyService,
      llmRequestService,
      salvageService,
    });
    const app = setupExpress(controller, logger);

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send(basePayload);

      expect(response.status).toBe(500);
      expect(response.body.stage).toBe('internal_api_key_service_state_error');
      expect(response.body.error).toBe(true);
      expect(weirdApiKeyService.getApiKey).toHaveBeenCalled();
      expect(llmRequestService.forwardRequest).not.toHaveBeenCalled();
    } finally {
      salvageService.cleanup();
    }
  });

  it('logs when headers are already sent after an LLM service exception', async () => {
    const logger = createLogger();
    const envVarName = 'LLM_PROXY_TEST_KEY';
    process.env[envVarName] = 'secret-value';

    const modelConfig = {
      ...baseModelConfig,
      apiKeyEnvVar: envVarName,
    };
    const llmConfigService = createOperationalConfigService(modelConfig);
    const fileReader = new NodeFileSystemReader();
    const appConfig = createAppConfig();
    const cacheService = new CacheService(logger, { enableAutoCleanup: false });
    const apiKeyService = new ApiKeyService(
      logger,
      fileReader,
      appConfig,
      cacheService
    );

    const failingRequestService = {
      forwardRequest: jest.fn(async () => {
        throw new Error('provider failed');
      }),
    };
    const salvageService = new ResponseSalvageService(logger, {
      defaultTtl: 25,
      maxEntries: 5,
    });
    const controller = createController({
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService: failingRequestService,
      salvageService: null,
    });

    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));
    app.post('/api/llm-request', async (req, res, next) => {
      try {
        res.commitResponse('success');
        res.write('partial');
        await controller.handleLlmRequest(req, res);
      } catch (error) {
        next(error);
      } finally {
        if (!res.writableEnded) {
          res.end();
        }
      }
    });

    try {
      const response = await request(app)
        .post('/api/llm-request')
        .send({
          ...basePayload,
          llmId: modelConfig.configId,
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('partial');
      expect(failingRequestService.forwardRequest).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('headers already sent'),
        expect.objectContaining({ llmId: modelConfig.configId })
      );
    } finally {
      cacheService.cleanup();
    }
  });
});
