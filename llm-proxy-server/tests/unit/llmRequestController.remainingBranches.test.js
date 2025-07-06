import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import { LOG_LLM_ID_PROXY_NOT_OPERATIONAL } from '../../src/config/constants.js';
import { sendProxyError } from '../../src/utils/responseUtils.js';

jest.mock('../../src/utils/responseUtils.js', () => ({
  sendProxyError: jest.fn(),
}));

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Builds a controller with provided service mocks.
 * @param {object} overrides - dependency overrides
 * @returns {LlmRequestController} Instance of controller.
 */
const makeController = (overrides = {}) => {
  const logger = overrides.logger ?? createLogger();
  const llmConfigService = overrides.llmConfigService ?? {
    isOperational: jest.fn(() => true),
    getInitializationErrorDetails: jest.fn(() => null),
    getLlmById: jest.fn(() => ({
      displayName: 'LLM',
      apiType: 'openai',
      endpointUrl: 'http://x',
      modelIdentifier: 'model',
      defaultParameters: {},
    })),
  };
  const apiKeyService = overrides.apiKeyService ?? {
    isApiKeyRequired: jest.fn(() => false),
    getApiKey: jest.fn(),
  };
  const llmRequestService = overrides.llmRequestService ?? {
    forwardRequest: jest.fn(() => ({
      success: true,
      data: { ok: true },
      statusCode: 200,
    })),
  };
  return new LlmRequestController(
    logger,
    llmConfigService,
    apiKeyService,
    llmRequestService
  );
};

describe('LlmRequestController remaining branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses default initialization error values when none are provided', async () => {
    const logger = createLogger();
    const llmConfigService = {
      isOperational: jest.fn(() => false),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(),
    };
    const controller = makeController({ logger, llmConfigService });
    const req = { ip: '8.8.8.8', body: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
    };

    await controller.handleLlmRequest(req, res);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      503,
      'initialization_failure_unknown',
      'Proxy server is not operational due to unknown configuration issues.',
      {},
      LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
      logger
    );
  });

  test('logs config details when api key metadata is present', async () => {
    const logger = createLogger();
    const llmModelConfig = {
      displayName: 'LLM',
      apiType: 'openai',
      endpointUrl: 'http://x',
      modelIdentifier: 'model',
      apiKeyEnvVar: 'VAR',
      apiKeyFileName: 'file.txt',
      defaultParameters: {},
    };
    const llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(() => llmModelConfig),
    };
    const controller = makeController({ logger, llmConfigService });
    const req = {
      ip: '1.1.1.1',
      body: { llmId: 'id', targetPayload: {}, targetHeaders: {} },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
    };

    await controller.handleLlmRequest(req, res);

    const logCall = logger.debug.mock.calls.find((c) =>
      c[0].includes('Config details')
    );
    expect(logCall[1]).toEqual(
      expect.objectContaining({
        apiKeyEnvVar: 'Present',
        apiKeyFileName: 'Present',
      })
    );
  });
});
