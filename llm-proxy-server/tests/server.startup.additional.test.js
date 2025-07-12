import { LOG_LLM_ID_PROXY_NOT_OPERATIONAL } from '../src/config/constants.js';
import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { createTestManager } from './common/testServerUtils.js';

let app;
let expressMock;
let sendProxyError;
let allowedOriginsArray;
let port;
let operational;
let initializationErrorDetails;
let consoleLoggerInstance;
let testManager;

beforeEach(() => {
  jest.resetModules();

  // Set up test manager for proper resource cleanup
  // Note: useFakeTimers is false to avoid issues with loadServer's setTimeout
  testManager = createTestManager({
    mockProcessSignals: true,
    useFakeTimers: false,
    backupEnvironment: false,
  });

  app = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn((p, cb) => cb && cb()),
  };

  // Use test manager to create properly managed server instance
  testManager.createMockServer(app, { port });

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
  jest.doMock('../src/utils/responseUtils.js', () => ({
    __esModule: true,
    sendProxyError,
  }));

  allowedOriginsArray = [];
  port = 3002;
  const appConfigServiceMock = {
    getAllowedOriginsArray: jest.fn(() => allowedOriginsArray),
    getProxyPort: jest.fn(() => port),
    isProxyPortDefaulted: jest.fn(() => true),
    getProxyAllowedOrigin: jest.fn(() => ''),
    getProxyProjectRootPathForApiKeyFiles: jest.fn(() => ''),
    isCacheEnabled: jest.fn(() => false),
    getCacheConfig: jest.fn(() => ({
      enabled: false,
      defaultTtl: 300000,
      maxSize: 1000,
      apiKeyCacheTtl: 300000,
    })),
    isHttpAgentEnabled: jest.fn(() => false),
    getHttpAgentConfig: jest.fn(() => ({
      enabled: false,
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
      freeSocketTimeout: 30000,
      maxTotalSockets: 500,
    })),
  };
  const getAppConfigService = jest.fn(() => appConfigServiceMock);
  jest.doMock('../src/config/appConfig.js', () => ({
    __esModule: true,
    getAppConfigService,
  }));

  operational = true;
  initializationErrorDetails = null;
  const llmConfigServiceInstance = {
    initialize: jest.fn(),
    isOperational: jest.fn(() => operational),
    getInitializationErrorDetails: jest.fn(() => initializationErrorDetails),
    getLlmConfigs: jest.fn(() => ({ llms: { a: {} } })),
    getResolvedConfigPath: jest.fn(() => undefined),
    hasFileBasedApiKeys: jest.fn(() => true),
  };
  const LlmConfigService = jest.fn(() => llmConfigServiceInstance);
  jest.doMock('../src/config/llmConfigService.js', () => ({
    __esModule: true,
    LlmConfigService,
  }));

  const CacheService = jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn(),
    getStats: jest.fn(),
  }));
  jest.doMock('../src/services/cacheService.js', () => ({
    __esModule: true,
    default: CacheService,
  }));

  const HttpAgentService = jest.fn(() => ({
    getAgent: jest.fn(),
    getFetchOptions: jest.fn(),
    getStats: jest.fn(),
  }));
  jest.doMock('../src/services/httpAgentService.js', () => ({
    __esModule: true,
    default: HttpAgentService,
  }));

  const ApiKeyService = jest.fn();
  jest.doMock('../src/services/apiKeyService.js', () => ({
    __esModule: true,
    ApiKeyService,
  }));
  const LlmRequestService = jest.fn();
  jest.doMock('../src/services/llmRequestService.js', () => ({
    __esModule: true,
    LlmRequestService,
  }));

  const LlmRequestController = jest.fn(() => ({ handleLlmRequest: jest.fn() }));
  jest.doMock('../src/handlers/llmRequestController.js', () => ({
    __esModule: true,
    LlmRequestController,
  }));

  const ConsoleLogger = jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }));
  jest.doMock('../src/consoleLogger.js', () => ({
    __esModule: true,
    ConsoleLogger,
  }));

  const NodeFileSystemReader = jest.fn();
  jest.doMock('../src/nodeFileSystemReader.js', () => ({
    __esModule: true,
    NodeFileSystemReader,
  }));
});

afterEach(() => {
  // Clean up all resources managed by test manager
  if (testManager) {
    testManager.cleanup();
  }
});

const loadServer = async () => {
  await import('../src/core/server.js');
  await new Promise((r) => setTimeout(r, 0));
  const loggerCtor = (await import('../src/consoleLogger.js')).ConsoleLogger;
  consoleLoggerInstance = loggerCtor.mock.results[0].value;
};

const getRootHandler = () => app.get.mock.calls.find((c) => c[0] === '/')[1];

describe('server additional branches', () => {
  test('root route uses unknown failure message when no details', async () => {
    operational = false;
    await loadServer();
    const req = {};
    const res = { status: jest.fn(() => res), send: jest.fn() };
    const handler = getRootHandler();
    handler(req, res);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      503,
      'initialization_failure_unknown',
      'LLM Proxy Server is NOT OPERATIONAL due to unknown configuration issues.',
      {},
      LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
      consoleLoggerInstance
    );
  });

  test('startup summary logs info when config failed and api key path missing', async () => {
    operational = false;
    initializationErrorDetails = { message: 'boom' };
    await loadServer();

    const listenCallback = app.listen.mock.calls[0][1];
    expect(listenCallback).toBeDefined();

    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server listening on port ' + port
    );
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      `(Note: PROXY_PORT environment variable was not set or invalid, using default.)`
    );
    expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
      'LLM configurations path could not be determined.'
    );
    expect(consoleLoggerInstance.error).toHaveBeenCalledWith(
      'LLM Proxy Server: CRITICAL - Failed to initialize LLM configurations. Proxy is NOT OPERATIONAL.'
    );
    expect(consoleLoggerInstance.error).toHaveBeenCalledWith(
      '   Reason: ' + initializationErrorDetails.message
    );
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is not set (this may be fine if no LLMs use file-based API keys or if config failed to load).'
    );
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      '--- End of Startup Summary ---'
    );
  });

  test('startup summary warns when api key path missing but configs loaded', async () => {
    operational = true;
    await loadServer();

    expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
      'LLM Proxy Server: WARNING - PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is NOT SET. File-based API key retrieval WILL FAIL for configured LLMs that use apiKeyFileName.'
    );
  });

  test('logs and exits when initialization throws', async () => {
    // Note: process.exit is already mocked by testManager, so we don't need a separate spy
    const initError = new Error('init failure');
    const loggerCtor = (await import('../src/consoleLogger.js')).ConsoleLogger;
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../src/config/llmConfigService.js', () => {
        return {
          __esModule: true,
          LlmConfigService: jest.fn(() => ({
            initialize: jest.fn(() => Promise.reject(initError)),
            isOperational: jest.fn(() => false),
            getInitializationErrorDetails: jest.fn(() => ({})),
            getLlmConfigs: jest.fn(() => null),
            getResolvedConfigPath: jest.fn(() => undefined),
            hasFileBasedApiKeys: jest.fn(() => false),
          })),
        };
      });
      await import('../src/core/server.js');
    });
    await new Promise((r) => setTimeout(r, 0));
    const logger = loggerCtor.mock.results[0].value;
    expect(logger.error).toHaveBeenCalledWith(
      'LLM Proxy Server: A critical error occurred during asynchronous server startup sequence PRIOR to app.listen.',
      initError
    );
    expect(logger.error).toHaveBeenCalledWith(
      'LLM Proxy Server: CRITICAL - Proxy will NOT be operational due to a severe error during startup initialization steps.'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
