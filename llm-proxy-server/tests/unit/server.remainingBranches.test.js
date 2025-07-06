import {
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
  LOG_LLM_ID_UNHANDLED_ERROR,
} from '../../src/config/constants.js';
import { describe, test, beforeEach, expect, jest } from '@jest/globals';

let app;
let expressMock;
let sendProxyError;
let initializationErrorDetails;
let operational;
let consoleLoggerInstance;
let rootHandler;
let errorHandler;

beforeEach(() => {
  jest.resetModules();

  app = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn((p, cb) => cb && cb()),
  };

  expressMock = jest.fn(() => app);
  expressMock.json = jest.fn(() => 'json-mw');
  jest.doMock('express', () => ({
    __esModule: true,
    default: expressMock,
    json: expressMock.json,
  }));

  jest.doMock('cors', () => ({
    __esModule: true,
    default: jest.fn(() => 'cors-mw'),
  }));

  sendProxyError = jest.fn();
  jest.doMock('../../src/utils/responseUtils.js', () => ({
    __esModule: true,
    sendProxyError,
  }));

  initializationErrorDetails = null;
  operational = true;

  const appConfigServiceMock = {
    getAllowedOriginsArray: jest.fn(() => []),
    getProxyPort: jest.fn(() => 3003),
    isProxyPortDefaulted: jest.fn(() => false),
    getProxyAllowedOrigin: jest.fn(() => ''),
    getProxyProjectRootPathForApiKeyFiles: jest.fn(() => ''),
  };
  const getAppConfigService = jest.fn(() => appConfigServiceMock);
  jest.doMock('../../src/config/appConfig.js', () => ({
    __esModule: true,
    getAppConfigService,
  }));

  const llmConfigServiceInstance = {
    initialize: jest.fn(),
    isOperational: jest.fn(() => operational),
    getInitializationErrorDetails: jest.fn(() => initializationErrorDetails),
    getLlmConfigs: jest.fn(() => ({ llms: { a: {} } })),
    getResolvedConfigPath: jest.fn(() => '/path/llm.json'),
    hasFileBasedApiKeys: jest.fn(() => false),
  };
  const LlmConfigService = jest.fn(() => llmConfigServiceInstance);
  jest.doMock('../../src/config/llmConfigService.js', () => ({
    __esModule: true,
    LlmConfigService,
  }));

  const ApiKeyService = jest.fn();
  jest.doMock('../../src/services/apiKeyService.js', () => ({
    __esModule: true,
    ApiKeyService,
  }));
  const LlmRequestService = jest.fn();
  jest.doMock('../../src/services/llmRequestService.js', () => ({
    __esModule: true,
    LlmRequestService,
  }));

  const LlmRequestController = jest.fn(() => ({ handleLlmRequest: jest.fn() }));
  jest.doMock('../../src/handlers/llmRequestController.js', () => ({
    __esModule: true,
    LlmRequestController,
  }));

  const ConsoleLogger = jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }));
  jest.doMock('../../src/consoleLogger.js', () => ({
    __esModule: true,
    ConsoleLogger,
  }));

  const NodeFileSystemReader = jest.fn();
  jest.doMock('../../src/nodeFileSystemReader.js', () => ({
    __esModule: true,
    NodeFileSystemReader,
  }));
});

const loadServer = async () => {
  await import('../../src/core/server.js');
  await new Promise((r) => setTimeout(r, 0));
  const loggerCtor = (await import('../../src/consoleLogger.js')).ConsoleLogger;
  consoleLoggerInstance = loggerCtor.mock.results[0].value;
  rootHandler = app.get.mock.calls.find((c) => c[0] === '/')[1];
  errorHandler = app.use.mock.calls.find(
    (c) => typeof c[0] === 'function' && c[0].length === 4
  )[0];
};

describe('server remaining branch coverage', () => {
  test('root route defaults stage when missing', async () => {
    operational = false;
    initializationErrorDetails = { message: 'boom', pathAttempted: 'x' };
    await loadServer();

    const req = {};
    const res = { status: jest.fn(() => res), send: jest.fn() };
    rootHandler(req, res);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      503,
      'initialization_failure',
      expect.stringContaining('LLM Proxy Server is NOT OPERATIONAL'),
      initializationErrorDetails,
      LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
      expect.anything()
    );
  });

  test('startup summary logs zero configs when none present', async () => {
    const llmConfigServiceModule = await import(
      '../../src/config/llmConfigService.js'
    );
    llmConfigServiceModule.LlmConfigService.mockImplementation(() => ({
      initialize: jest.fn(),
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmConfigs: jest.fn(() => ({})),
      getResolvedConfigPath: jest.fn(() => '/path/llm.json'),
      hasFileBasedApiKeys: jest.fn(() => false),
    }));

    await loadServer();

    const listenCallback = app.listen.mock.calls[0][1];
    expect(listenCallback).toBeDefined();

    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server listening on port ' + 3003
    );
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server: Successfully loaded 0 LLM configurations. Proxy is OPERATIONAL.'
    );
  });

  test('error handler uses statusCode when status missing', async () => {
    await loadServer();
    const err = new Error('bad');
    err.statusCode = 401;
    const req = { originalUrl: '/x', method: 'GET' };
    const res = { headersSent: false };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      401,
      'internal_proxy_unhandled_error',
      'An unexpected internal server error occurred in the proxy.',
      { originalErrorMessage: err.message },
      LOG_LLM_ID_UNHANDLED_ERROR,
      consoleLoggerInstance
    );
    expect(next).not.toHaveBeenCalled();
  });
});
