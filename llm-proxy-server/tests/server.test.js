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
let corsMock;
let sendProxyError;
let allowedOriginsArray;
let port;
let operational;
let initializationErrorDetails;
let handleLlmRequest;
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

  corsMock = jest.fn(() => 'cors-mw');
  jest.doMock('cors', () => ({ __esModule: true, default: corsMock }));

  sendProxyError = jest.fn();
  jest.doMock('../src/utils/responseUtils.js', () => ({
    __esModule: true,
    sendProxyError,
  }));

  allowedOriginsArray = [];
  port = 3001;
  const appConfigServiceMock = {
    getAllowedOriginsArray: jest.fn(() => allowedOriginsArray),
    getProxyPort: jest.fn(() => port),
    isProxyPortDefaulted: jest.fn(() => false),
    getProxyAllowedOrigin: jest.fn(() => allowedOriginsArray.join(',')),
    getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/keys'),
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
    getResolvedConfigPath: jest.fn(() => '/path/llm.json'),
    hasFileBasedApiKeys: jest.fn(() => false),
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

  handleLlmRequest = jest.fn();
  const LlmRequestController = jest.fn(() => ({ handleLlmRequest }));
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
};

const getRootHandler = () => app.get.mock.calls.find((c) => c[0] === '/')[1];

describe('server initialization', () => {
  test('sets up CORS and JSON parsing when allowed origins provided', async () => {
    allowedOriginsArray.push('http://a.com');
    await loadServer();

    expect(corsMock).toHaveBeenCalledWith({
      origin: allowedOriginsArray,
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Title', 'HTTP-Referer'],
    });
    expect(app.use).toHaveBeenCalledWith('cors-mw');
    expect(app.use).toHaveBeenCalledWith('json-mw');
  });

  test('root route returns 200 when operational', async () => {
    await loadServer();
    const req = {};
    const res = { status: jest.fn(() => res), send: jest.fn() };
    const handler = getRootHandler();
    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      'LLM Proxy Server is running and operational! Use /health or /health/ready for detailed health checks.'
    );
  });

  test('root route returns 503 when not operational', async () => {
    operational = false;
    initializationErrorDetails = {
      stage: 'init_stage',
      message: 'fail',
      pathAttempted: 'x',
    };
    await loadServer();

    const req = {};
    const res = { status: jest.fn(() => res), send: jest.fn() };
    const handler = getRootHandler();
    handler(req, res);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      503,
      'init_stage',
      expect.stringContaining('LLM Proxy Server is NOT OPERATIONAL'),
      initializationErrorDetails,
      LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
      expect.anything()
    );
  });

  test('llm request route wired to controller', async () => {
    await loadServer();
    // The route now has multiple middleware, so we check for the path and at least one function
    const postCall = app.post.mock.calls.find(
      (c) => c[0] === '/api/llm-request'
    );
    expect(postCall).toBeDefined();
    expect(postCall[0]).toBe('/api/llm-request');
    // The last argument should be the controller handler
    const handler = postCall[postCall.length - 1];
    const req = {};
    const res = {};
    handler(req, res);
    expect(handleLlmRequest).toHaveBeenCalledWith(req, res);
  });

  test('initializes and listens on configured port', async () => {
    await loadServer();
    expect(app.listen).toHaveBeenCalledWith(port, expect.any(Function));
  });
});
