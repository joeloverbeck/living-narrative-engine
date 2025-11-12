import {
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
  HTTP_AGENT_TIMEOUT,
} from '../src/config/constants.js';
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
let metricsServiceInstance;

beforeEach(() => {
  jest.resetModules();

  // Set up test manager for proper resource cleanup
  // Note: useFakeTimers is false to avoid issues with loadServer's setTimeout
  testManager = createTestManager({
    mockProcessSignals: true,
    useFakeTimers: false,
    backupEnvironment: false,
  });

  // Create server instance mock first
  const serverInstance = {
    close: jest.fn((callback) => {
      if (callback && typeof callback === 'function') {
        setTimeout(() => callback(), 0);
      }
    }),
    on: jest.fn(function (event, handler) {
      return this;
    }),
    address: jest.fn(() => ({ port: port || 3001 })),
  };

  app = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn((_port, _bindAddress, _cb) => {
      // Call the callback to simulate successful server start
      if (_cb && typeof _cb === 'function') {
        setTimeout(() => _cb(), 0);
      }
      return serverInstance;
    }),
  };

  // Create a mock router for express.Router()
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  };

  expressMock = jest.fn(() => app);
  expressMock.json = jest.fn(() => 'json-mw');
  expressMock.Router = jest.fn(() => mockRouter);
  jest.doMock('express', () => ({
    __esModule: true,
    default: expressMock,
    json: expressMock.json,
    Router: expressMock.Router,
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
    getSalvageConfig: jest.fn(() => ({
      defaultTtl: 120000,
      maxEntries: 1000,
    })),
    isHttpAgentEnabled: jest.fn(() => false),
    getHttpAgentConfig: jest.fn(() => ({
      enabled: false,
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: HTTP_AGENT_TIMEOUT,
      freeSocketTimeout: 30000,
      maxTotalSockets: 500,
    })),
    isDebugLoggingEnabled: jest.fn(() => false), // Debug logging disabled in tests
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

  metricsServiceInstance = {
    isEnabled: jest.fn(() => true),
    getMetrics: jest.fn().mockResolvedValue('test-metrics'),
    recordHttpRequest: jest.fn(),
    recordLlmRequest: jest.fn(),
    recordCacheOperation: jest.fn(),
    recordError: jest.fn(),
    getStats: jest.fn(() => ({
      totalMetrics: 0,
      customMetrics: 0,
      defaultMetrics: 0,
    })),
    clear: jest.fn(),
  };
  const MetricsService = jest.fn(() => metricsServiceInstance);
  jest.doMock('../src/services/metricsService.js', () => ({
    __esModule: true,
    default: MetricsService,
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

  // Mock the problematic route modules that use import.meta.url
  jest.doMock('../src/routes/traceRoutes.js', () => ({
    __esModule: true,
    default: 'trace-routes-mock',
  }));

  // Note: debugRoutes.js has been removed from the system

  const mockHealthRouter = {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn(),
  };
  const createHealthRoutes = jest.fn(() => mockHealthRouter);
  jest.doMock('../src/routes/healthRoutes.js', () => ({
    __esModule: true,
    default: createHealthRoutes,
  }));
});

afterEach(() => {
  // Clean up all resources managed by test manager
  if (testManager) {
    testManager.cleanup();
  }
});

let serverController;
let mockLogger;

const loadServer = async () => {
  // Create mock logger instance
  mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const { createProxyServer } = await import('../src/core/server.js');
  serverController = createProxyServer({
    logger: mockLogger,
    metricsEnabled: false,
    collectDefaultMetrics: false,
    rateLimitingEnabled: false,
  });
  await serverController.start();
  await new Promise((r) => setTimeout(r, 0));
};

const getRootHandler = () => serverController.app.get.mock.calls.find((c) => c[0] === '/')[1];

describe('server initialization', () => {
  test('sets up CORS and JSON parsing when allowed origins provided', async () => {
    allowedOriginsArray.push('http://a.com');
    await loadServer();

    expect(corsMock).toHaveBeenCalledWith({
      origin: allowedOriginsArray,
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Title', 'HTTP-Referer'],
    });
    expect(serverController.app.use).toHaveBeenCalledWith('cors-mw');
    expect(serverController.app.use).toHaveBeenCalledWith('json-mw');
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

  test(
    'root route returns generic 503 when not operational and no error details',
    async () => {
      operational = false;
      initializationErrorDetails = null;
      await loadServer();

      const req = {};
      const res = { status: jest.fn(() => res), send: jest.fn() };
      const handler = getRootHandler();

      sendProxyError.mockClear();
      handler(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        503,
        'initialization_failure_unknown',
        'LLM Proxy Server is NOT OPERATIONAL due to unknown configuration issues.',
        {},
        LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
        expect.anything()
      );
    }
  );

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
    expect(app.listen).toHaveBeenCalledWith(
      port,
      '0.0.0.0',
      expect.any(Function)
    );
  });

  test('metrics endpoint responds with Prometheus formatted payload', async () => {
    await loadServer();
    const metricsCall = app.get.mock.calls.find((c) => c[0] === '/metrics');
    expect(metricsCall).toBeDefined();
    const handler = metricsCall[1];

    const res = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await handler({}, res);

    expect(metricsServiceInstance.getMetrics).toHaveBeenCalledTimes(1);
    expect(res.set).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4; charset=utf-8'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('test-metrics');
  });
});
