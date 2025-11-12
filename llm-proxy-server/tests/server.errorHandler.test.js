import {
  LOG_LLM_ID_UNHANDLED_ERROR,
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
let sendProxyError;
let errorHandler;
let consoleLoggerInstance;
let httpAgentServiceInstance;
let testManager;

beforeEach(() => {
  jest.resetModules();
  httpAgentServiceInstance = null;

  // Set up test manager for proper resource cleanup
  // Note: useFakeTimers is false since we handle timers manually in this file
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
    address: jest.fn(() => ({ port: 3001 })),
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

  jest.doMock('cors', () => ({
    __esModule: true,
    default: jest.fn(() => 'cors-mw'),
  }));

  sendProxyError = jest.fn();
  jest.doMock('../src/utils/responseUtils.js', () => ({
    __esModule: true,
    sendProxyError,
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

  // Mock HttpAgentService to capture instances for cleanup
  const HttpAgentService = jest.fn().mockImplementation((_logger, _config) => {
    httpAgentServiceInstance = {
      cleanup: jest.fn(),
      getAgent: jest.fn(),
      destroyAll: jest.fn(),
      getStats: jest.fn().mockReturnValue({}),
    };
    return httpAgentServiceInstance;
  });
  jest.doMock('../src/services/httpAgentService.js', () => ({
    __esModule: true,
    default: HttpAgentService,
  }));

  // Mock LlmConfigService and other dependencies
  const llmConfigServiceInstance = {
    initialize: jest.fn(),
    isOperational: jest.fn(() => true),
    getInitializationErrorDetails: jest.fn(() => null),
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

  // Mock other services that might be instantiated
  jest.doMock('../src/services/apiKeyService.js', () => ({
    __esModule: true,
    ApiKeyService: jest.fn(() => ({})),
  }));

  jest.doMock('../src/services/llmRequestService.js', () => ({
    __esModule: true,
    LlmRequestService: jest.fn(() => ({})),
  }));

  // Mock proxyApiUtils with RetryManager
  jest.doMock('../src/utils/proxyApiUtils.js', () => ({
    __esModule: true,
    RetryManager: jest.fn(() => ({})),
  }));

  jest.doMock('../src/handlers/llmRequestController.js', () => ({
    __esModule: true,
    LlmRequestController: jest.fn(() => ({})),
  }));

  jest.doMock('../src/nodeFileSystemReader.js', () => ({
    __esModule: true,
    NodeFileSystemReader: jest.fn(() => ({})),
  }));

  // Mock appConfig
  const appConfigServiceMock = {
    getAllowedOriginsArray: jest.fn(() => []),
    getProxyPort: jest.fn(() => 3001),
    isProxyPortDefaulted: jest.fn(() => false),
    getProxyAllowedOrigin: jest.fn(() => ''),
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

  // Mock middleware modules
  jest.doMock('../src/middleware/security.js', () => ({
    __esModule: true,
    createSecurityMiddleware: jest.fn(() => 'security-mw'),
  }));

  jest.doMock('../src/middleware/rateLimiting.js', () => ({
    __esModule: true,
    createApiRateLimiter: jest.fn(() => 'api-rate-limiter'),
    createLlmRateLimiter: jest.fn(() => 'llm-rate-limiter'),
  }));

  jest.doMock('../src/middleware/validation.js', () => ({
    __esModule: true,
    validateLlmRequest: jest.fn(() => 'validate-llm-request'),
    validateRequestHeaders: jest.fn(() => 'validate-headers'),
    handleValidationErrors: jest.fn(() => 'handle-validation-errors'),
  }));

  jest.doMock('../src/middleware/timeout.js', () => ({
    __esModule: true,
    createTimeoutMiddleware: jest.fn(() => 'timeout-mw'),
    createSizeLimitConfig: jest.fn(() => ({ json: { limit: '1mb' } })),
  }));

  jest.doMock('compression', () => ({
    __esModule: true,
    default: jest.fn(() => 'compression-mw'),
  }));

  // Mock healthCheck middleware
  jest.doMock('../src/middleware/healthCheck.js', () => ({
    __esModule: true,
    createLivenessCheck: jest.fn(() => 'liveness-check-mw'),
    createReadinessCheck: jest.fn(() => 'readiness-check-mw'),
  }));

  // Mock MetricsService
  const MetricsService = jest.fn(() => ({
    isEnabled: jest.fn(() => false),
    getStats: jest.fn(() => ({
      totalMetrics: 0,
      customMetrics: 0,
      defaultMetrics: 0,
    })),
    getMetrics: jest.fn(),
    clear: jest.fn(),
  }));
  jest.doMock('../src/services/metricsService.js', () => ({
    __esModule: true,
    default: MetricsService,
  }));

  // Mock metrics middleware
  jest.doMock('../src/middleware/metrics.js', () => ({
    __esModule: true,
    createMetricsMiddleware: jest.fn(() => 'metrics-mw'),
    createLlmMetricsMiddleware: jest.fn(() => 'llm-metrics-mw'),
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
  // Clean up any HttpAgentService instances that might have been created
  if (
    httpAgentServiceInstance &&
    typeof httpAgentServiceInstance.cleanup === 'function'
  ) {
    httpAgentServiceInstance.cleanup();
  }

  // Clean up all resources managed by test manager
  if (testManager) {
    testManager.cleanup();
  }

  jest.restoreAllMocks();
});

let serverController;

const loadServer = async () => {
  // Create console logger instance
  consoleLoggerInstance = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const { createProxyServer } = await import('../src/core/server.js');
  serverController = createProxyServer({
    logger: consoleLoggerInstance,
    metricsEnabled: false,
    collectDefaultMetrics: false,
    rateLimitingEnabled: false,
  });
  await serverController.start();

  // Give async operations time to complete
  await new Promise((r) => setTimeout(r, 0));

  errorHandler = serverController.app.use.mock.calls.find(
    (c) => typeof c[0] === 'function' && c[0].length === 4
  )[0];
};

describe('global error handler', () => {
  test('delegates to next if headers already sent', async () => {
    await loadServer();
    const err = new Error('boom');
    const req = { originalUrl: '/foo', method: 'GET' };
    const res = { headersSent: true };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
      "Global Error Handler: Headers already sent for this request. Delegating to Express's default error handler.",
      {
        originalErrorMessage: err.message,
        requestOriginalUrl: req.originalUrl,
        requestMethod: req.method,
      }
    );
    expect(next).toHaveBeenCalledWith(err);
    expect(sendProxyError).not.toHaveBeenCalled();
  });

  test('sends proxy error with custom status code when present', async () => {
    await loadServer();
    const err = new Error('bad');
    err.status = 418;
    const req = { originalUrl: '/foo', method: 'POST' };
    const res = { headersSent: false };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      418,
      'internal_proxy_unhandled_error',
      'An unexpected internal server error occurred in the proxy.',
      { originalErrorMessage: err.message },
      LOG_LLM_ID_UNHANDLED_ERROR,
      consoleLoggerInstance
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('defaults to 500 when provided status code is invalid', async () => {
    await loadServer();
    const err = new Error('bad');
    err.status = 900; // outside valid range
    const req = { originalUrl: '/foo', method: 'POST' };
    const res = { headersSent: false };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      500,
      'internal_proxy_unhandled_error',
      'An unexpected internal server error occurred in the proxy.',
      { originalErrorMessage: err.message },
      LOG_LLM_ID_UNHANDLED_ERROR,
      consoleLoggerInstance
    );
    expect(next).not.toHaveBeenCalled();
  });
});
