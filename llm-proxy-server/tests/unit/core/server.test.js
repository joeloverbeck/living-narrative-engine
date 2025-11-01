import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_METHOD_OPTIONS,
  HTTP_METHOD_POST,
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
  LOG_LLM_ID_UNHANDLED_ERROR,
} from '../../../src/config/constants.js';
import {
  TestServerManager,
  TestTimerManager,
} from '../../common/testServerUtils.js';

describe('Server - Comprehensive Tests', () => {
  let app;
  let expressMock;
  let sendProxyError;
  let initializationErrorDetails;
  let operational;
  let consoleLoggerInstance;
  let httpAgentServiceInstance;
  let serverInstance;
  let rootHandler;
  let errorHandler;
  let originalSetTimeout;
  let originalProcess;
  let appConfigServiceMock;
  let serverManager;
  let timerManager;
  let createTimeoutMiddlewareMock;
  let metricsServiceInstance;
  let corsMock;
  let llmConfigServiceInstance;
  let salvageServiceInstance;
  let originalNodeEnv;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Store original global methods
    originalSetTimeout = global.setTimeout;
    originalProcess = {
      on: process.on,
      exit: process.exit,
    };
    originalNodeEnv = process.env.NODE_ENV;

    // Initialize test utilities for better resource management
    serverManager = new TestServerManager();
    timerManager = new TestTimerManager();

    // Mock process methods
    process.on = jest.fn();
    process.exit = jest.fn();

    // Mock console logger
    consoleLoggerInstance = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Mock HTTP agent service with cleanup method
    httpAgentServiceInstance = {
      cleanup: jest.fn(),
      getAgent: jest.fn(),
      getFetchOptions: jest.fn(),
      getStats: jest.fn(),
    };

    // Create managed server instance using test utilities
    serverInstance = serverManager.createMockServer({
      port: 3003,
      additionalMethods: {
        close: jest.fn((callback) => {
          // Simulate successful server close
          if (callback && typeof callback === 'function') {
            originalSetTimeout(() => callback(), 0);
          }
        }),
        on: jest.fn(function (event, handler) {
          // Return this for method chaining
          return this;
        }),
      },
    });

    app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((_port, _bindAddress, _cb) => {
        // Handle both 2-arg and 3-arg forms of listen
        // Call the callback to simulate successful server start
        if (_cb && typeof _cb === 'function') {
          // Use setTimeout to simulate async behavior
          originalSetTimeout(() => _cb(), 0);
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
    jest.doMock('cors', () => ({
      __esModule: true,
      default: corsMock,
    }));

    jest.doMock('compression', () => ({
      __esModule: true,
      default: jest.fn(() => 'compression-mw'),
    }));

    sendProxyError = jest.fn();
    jest.doMock('../../../src/utils/responseUtils.js', () => ({
      __esModule: true,
      sendProxyError,
    }));

    initializationErrorDetails = null;
    operational = true;

    appConfigServiceMock = {
      getAllowedOriginsArray: jest.fn(() => []),
      getProxyPort: jest.fn(() => 3003),
      isProxyPortDefaulted: jest.fn(() => false),
      getProxyAllowedOrigin: jest.fn(() => ''),
      getProxyProjectRootPathForApiKeyFiles: jest.fn(() => ''),
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
        timeout: 60000,
        freeSocketTimeout: 30000,
        maxTotalSockets: 500,
        maxIdleTime: 60000,
      })),
      isDebugLoggingEnabled: jest.fn(() => false), // Debug logging disabled in tests
    };
    const getAppConfigService = jest.fn(() => appConfigServiceMock);
    jest.doMock('../../../src/config/appConfig.js', () => ({
      __esModule: true,
      getAppConfigService,
    }));

    llmConfigServiceInstance = {
      initialize: jest.fn(),
      isOperational: jest.fn(() => operational),
      getInitializationErrorDetails: jest.fn(() => initializationErrorDetails),
      getLlmConfigs: jest.fn(() => ({ llms: { a: {} } })),
      getResolvedConfigPath: jest.fn(() => '/path/llm.json'),
      hasFileBasedApiKeys: jest.fn(() => false),
    };
    const LlmConfigService = jest.fn(() => llmConfigServiceInstance);
    jest.doMock('../../../src/config/llmConfigService.js', () => ({
      __esModule: true,
      LlmConfigService,
    }));

    const CacheService = jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      invalidatePattern: jest.fn(),
      getStats: jest.fn(),
    }));
    jest.doMock('../../../src/services/cacheService.js', () => ({
      __esModule: true,
      default: CacheService,
    }));

    const HttpAgentService = jest.fn(() => httpAgentServiceInstance);
    jest.doMock('../../../src/services/httpAgentService.js', () => ({
      __esModule: true,
      default: HttpAgentService,
    }));

    const ApiKeyService = jest.fn();
    jest.doMock('../../../src/services/apiKeyService.js', () => ({
      __esModule: true,
      ApiKeyService,
    }));
    const LlmRequestService = jest.fn();
    jest.doMock('../../../src/services/llmRequestService.js', () => ({
      __esModule: true,
      LlmRequestService,
    }));

    const LlmRequestController = jest.fn(() => ({
      handleLlmRequest: jest.fn(),
    }));
    jest.doMock('../../../src/handlers/llmRequestController.js', () => ({
      __esModule: true,
      LlmRequestController,
    }));

    // Mock salvage services
    const SalvageRequestController = jest.fn(() => ({
      handleSalvageByRequestId: jest.fn(),
      handleSalvageStats: jest.fn(),
    }));
    jest.doMock('../../../src/handlers/salvageRequestController.js', () => ({
      __esModule: true,
      default: SalvageRequestController,
    }));

    salvageServiceInstance = {
      salvageResponse: jest.fn(),
      getStats: jest.fn(),
      cleanup: jest.fn(),
    };
    const ResponseSalvageService = jest.fn(() => salvageServiceInstance);
    jest.doMock('../../../src/services/responseSalvageService.js', () => ({
      __esModule: true,
      default: ResponseSalvageService,
    }));

    const ConsoleLogger = jest.fn(() => consoleLoggerInstance);
    jest.doMock('../../../src/consoleLogger.js', () => ({
      __esModule: true,
      ConsoleLogger,
    }));

    const NodeFileSystemReader = jest.fn();
    jest.doMock('../../../src/nodeFileSystemReader.js', () => ({
      __esModule: true,
      NodeFileSystemReader,
    }));

    // Mock middleware
    jest.doMock('../../../src/middleware/security.js', () => ({
      __esModule: true,
      createSecurityMiddleware: jest.fn(() => 'security-mw'),
    }));

    jest.doMock('../../../src/middleware/rateLimiting.js', () => ({
      __esModule: true,
      createApiRateLimiter: jest.fn(() => 'api-rate-limiter'),
      createLlmRateLimiter: jest.fn(() => 'llm-rate-limiter'),
    }));

    jest.doMock('../../../src/middleware/validation.js', () => ({
      __esModule: true,
      validateLlmRequest: jest.fn(() => 'validate-llm'),
      validateRequestHeaders: jest.fn(() => 'validate-headers'),
      handleValidationErrors: jest.fn(),
    }));

    createTimeoutMiddlewareMock = jest.fn((timeoutMs, options) => {
      const middleware = jest.fn((req, res, next) => {
        if (typeof next === 'function') {
          next();
        }
      });
      middleware.timeoutMs = timeoutMs;
      middleware.options = options;
      return middleware;
    });
    jest.doMock('../../../src/middleware/timeout.js', () => ({
      __esModule: true,
      createTimeoutMiddleware: createTimeoutMiddlewareMock,
      createSizeLimitConfig: jest.fn(() => ({
        json: { limit: '10mb' },
      })),
    }));

    // Mock health check middleware
    jest.doMock('../../../src/middleware/healthCheck.js', () => ({
      __esModule: true,
      createLivenessCheck: jest.fn(() => 'liveness-check-mw'),
      createReadinessCheck: jest.fn(() => 'readiness-check-mw'),
    }));

    // Mock metrics middleware
    jest.doMock('../../../src/middleware/metrics.js', () => ({
      __esModule: true,
      createMetricsMiddleware: jest.fn(() => 'metrics-mw'),
      createLlmMetricsMiddleware: jest.fn(() => 'llm-metrics-mw'),
    }));

    // Mock MetricsService
    metricsServiceInstance = {
      isEnabled: jest.fn(() => false),
      getMetrics: jest.fn(() => Promise.resolve('metrics-data')),
      getStats: jest.fn(() => ({
        totalMetrics: 0,
        customMetrics: 0,
        defaultMetrics: 0,
      })),
      clear: jest.fn(),
    };
    const MetricsService = jest.fn(() => metricsServiceInstance);
    jest.doMock('../../../src/services/metricsService.js', () => ({
      __esModule: true,
      default: MetricsService,
    }));

    // Note: LogStorageService and LogMaintenanceScheduler have been removed from the system

    // Mock RetryManager
    jest.doMock('../../../src/utils/proxyApiUtils.js', () => ({
      __esModule: true,
      RetryManager: jest.fn(),
    }));

    // Mock the problematic route modules that use import.meta.url
    jest.doMock('../../../src/routes/traceRoutes.js', () => ({
      __esModule: true,
      default: 'trace-routes-mock',
    }));

    // Note: debugRoutes.js has been removed from the system

    // Mock health routes - create a function that returns a mock router
    const mockHealthRouter = {
      get: jest.fn(),
      post: jest.fn(),
      use: jest.fn(),
    };
    const createHealthRoutes = jest.fn(() => mockHealthRouter);
    jest.doMock('../../../src/routes/healthRoutes.js', () => ({
      __esModule: true,
      default: createHealthRoutes,
    }));

    // Mock salvage routes
    const mockSalvageRoutes = jest.fn(() => mockRouter);
    jest.doMock('../../../src/routes/salvageRoutes.js', () => ({
      __esModule: true,
      default: mockSalvageRoutes,
      createSalvageRoutes: mockSalvageRoutes,
    }));

    // Mock request tracking middleware
    jest.doMock('../../../src/middleware/requestTracking.js', () => ({
      __esModule: true,
      createRequestTrackingMiddleware: jest.fn(() => 'request-tracking-mw'),
      createResponseGuard: jest.fn(),
    }));

    // Mock setTimeout for graceful shutdown to prevent actual 10s timeout
    global.setTimeout = jest.fn((fn, delay) => {
      if (delay === 10000) {
        // Don't execute the 10-second timeout callback that calls process.exit(1)
        return { id: 'mocked-graceful-shutdown-timeout' };
      }
      // For other timeouts (like the ones used in tests), use original setTimeout
      return originalSetTimeout(fn, delay);
    });
  });

  afterEach(() => {
    // Clean up test utilities
    if (serverManager) {
      serverManager.cleanup();
    }
    if (timerManager) {
      timerManager.cleanup();
    }

    // Restore original global methods
    global.setTimeout = originalSetTimeout;
    process.on = originalProcess.on;
    process.exit = originalProcess.exit;
    process.env.NODE_ENV = originalNodeEnv;

    // Clear module cache to prevent leaks between tests
    const serverModulePath = require.resolve('../../../src/core/server.js');
    if (require.cache[serverModulePath]) {
      delete require.cache[serverModulePath];
    }
  });

  let serverController;

  const loadServer = async () => {
    const { createProxyServer } = await import('../../../src/core/server.js');

    // Create server with mocked logger
    serverController = createProxyServer({
      logger: consoleLoggerInstance,
      metricsEnabled: false,
      collectDefaultMetrics: false,
      rateLimitingEnabled: false,
    });

    // Start the server (triggers app.listen and startup logs)
    await serverController.start();

    // Give async operations time to complete
    await new Promise((r) => setTimeout(r, 0));

    // Extract handlers from the mocked app
    rootHandler = serverController.app.get.mock.calls.find((c) => c[0] === '/')[1];
    errorHandler = serverController.app.use.mock.calls.find(
      (c) => typeof c[0] === 'function' && c[0].length === 4
    )[0];
  };

  describe('Core Server Functionality', () => {
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
        '../../../src/config/llmConfigService.js'
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

      // Verify startup logs were triggered during start()
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('LLM Proxy Server listening on port')
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

  describe('Configuration Logging', () => {
    test('logs cache enabled configuration when cache is enabled', async () => {
      // Configure AppConfigService to return cache enabled
      appConfigServiceMock.isCacheEnabled.mockReturnValue(true);
      appConfigServiceMock.getCacheConfig.mockReturnValue({
        enabled: true,
        defaultTtl: 600000,
        maxSize: 2000,
        apiKeyCacheTtl: 900000,
      });

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify cache enabled log message
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Cache ENABLED - TTL: 600000ms, Max Size: 2000 entries, API Key TTL: 900000ms'
      );
    });

    test('logs cache disabled configuration when cache is disabled', async () => {
      // Configure AppConfigService to return cache disabled (default setup)
      appConfigServiceMock.isCacheEnabled.mockReturnValue(false);

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify cache disabled log message
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Cache DISABLED - API keys will be read from source on every request'
      );
    });

    test('logs salvage configuration using AppConfigService values', async () => {
      appConfigServiceMock.getSalvageConfig.mockReturnValue({
        defaultTtl: 240000,
        maxEntries: 2048,
      });

      await loadServer();

      expect(appConfigServiceMock.getSalvageConfig).toHaveBeenCalled();
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Response Salvage ENABLED - TTL: 240000ms, Max Entries: 2048'
      );
    });

    test('logs HTTP agent enabled configuration when HTTP agent is enabled', async () => {
      // Configure AppConfigService to return HTTP agent enabled
      appConfigServiceMock.isHttpAgentEnabled.mockReturnValue(true);
      appConfigServiceMock.getHttpAgentConfig.mockReturnValue({
        enabled: true,
        keepAlive: false,
        maxSockets: 100,
        maxFreeSockets: 20,
        timeout: 120000,
        freeSocketTimeout: 60000,
        maxTotalSockets: 1000,
        maxIdleTime: 180000,
      });

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify HTTP agent enabled log message
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: HTTP Agent Pooling ENABLED - Keep-Alive: false, Max Sockets: 100, Timeout: 120000ms'
      );
    });

    test('logs HTTP agent disabled configuration when HTTP agent is disabled', async () => {
      // Configure AppConfigService to return HTTP agent disabled (default setup)
      appConfigServiceMock.isHttpAgentEnabled.mockReturnValue(false);

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify HTTP agent disabled log message
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: HTTP Agent Pooling DISABLED - New connections will be created for each request'
      );
    });

    test('logs both cache and HTTP agent enabled configurations', async () => {
      // Configure AppConfigService to return both enabled
      appConfigServiceMock.isCacheEnabled.mockReturnValue(true);
      appConfigServiceMock.getCacheConfig.mockReturnValue({
        enabled: true,
        defaultTtl: 300000,
        maxSize: 1000,
        apiKeyCacheTtl: 300000,
      });
      appConfigServiceMock.isHttpAgentEnabled.mockReturnValue(true);
      appConfigServiceMock.getHttpAgentConfig.mockReturnValue({
        enabled: true,
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000,
        maxTotalSockets: 500,
        maxIdleTime: 60000,
      });

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify both configuration log messages
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Cache ENABLED - TTL: 300000ms, Max Size: 1000 entries, API Key TTL: 300000ms'
      );
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: HTTP Agent Pooling ENABLED - Keep-Alive: true, Max Sockets: 50, Timeout: 60000ms'
      );
    });

    test('logs both cache and HTTP agent disabled configurations', async () => {
      // Both are disabled by default setup, just verify the logs
      await loadServer();

      // Verify both disabled configuration log messages
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Cache DISABLED - API keys will be read from source on every request'
      );
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: HTTP Agent Pooling DISABLED - New connections will be created for each request'
      );
    });

    test('logs configurations with different cache values', async () => {
      // Configure with different cache values to ensure proper value logging
      appConfigServiceMock.isCacheEnabled.mockReturnValue(true);
      appConfigServiceMock.getCacheConfig.mockReturnValue({
        enabled: true,
        defaultTtl: 1800000, // 30 minutes
        maxSize: 5000,
        apiKeyCacheTtl: 3600000, // 1 hour
      });

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify specific cache configuration values are logged
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Cache ENABLED - TTL: 1800000ms, Max Size: 5000 entries, API Key TTL: 3600000ms'
      );
    });

    test('logs configurations with different HTTP agent values', async () => {
      // Configure with different HTTP agent values
      appConfigServiceMock.isHttpAgentEnabled.mockReturnValue(true);
      appConfigServiceMock.getHttpAgentConfig.mockReturnValue({
        enabled: true,
        keepAlive: false,
        maxSockets: 200,
        maxFreeSockets: 50,
        timeout: 300000, // 5 minutes
        freeSocketTimeout: 120000,
        maxTotalSockets: 2000,
        maxIdleTime: 600000,
      });

      // Use loadServer to trigger startup and listen callback
      await loadServer();

      // Verify specific HTTP agent configuration values are logged
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: HTTP Agent Pooling ENABLED - Keep-Alive: false, Max Sockets: 200, Timeout: 300000ms'
      );
    });
  });

  describe('Graceful Shutdown', () => {
    test('graceful shutdown handles SIGTERM signal correctly', async () => {
      // Load server to trigger signal handler registration via start()
      await loadServer();

      // Get the SIGTERM handler that was registered
      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      expect(sigtermHandler).toBeDefined();

      // Execute the SIGTERM handler
      sigtermHandler();

      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Received SIGTERM, starting graceful shutdown...'
      );

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(serverInstance.close).toHaveBeenCalled();
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Graceful shutdown complete'
      );
    });

    test('graceful shutdown handles SIGINT signal correctly', async () => {
      // Load server to trigger signal handler registration via start()
      await loadServer();

      // Get the SIGINT handler that was registered
      const sigintHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGINT'
      )[1];

      expect(sigintHandler).toBeDefined();

      // Execute the SIGINT handler
      sigintHandler();

      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Received SIGINT, starting graceful shutdown...'
      );

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(serverInstance.close).toHaveBeenCalled();
    });

    test('graceful shutdown handles SIGHUP signal correctly', async () => {
      // Ensure test environment to prevent process.exit() calls
      process.env.NODE_ENV = 'test';

      // Load server to trigger signal handler registration via start()
      await loadServer();

      // Get the SIGHUP handler that was registered
      const sighupHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGHUP'
      )[1];

      expect(sighupHandler).toBeDefined();

      // Execute the SIGHUP handler
      sighupHandler();

      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Received SIGHUP, starting graceful shutdown...'
      );

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(serverInstance.close).toHaveBeenCalled();
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Graceful shutdown complete'
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    test('graceful shutdown cleans up httpAgentService when cleanup method exists', async () => {
      // Load server to trigger signal handler registration via start()
      await loadServer();

      // Get the SIGTERM handler
      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      // Execute the handler
      sigtermHandler();

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(httpAgentServiceInstance.cleanup).toHaveBeenCalled();
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: HTTP agent service cleaned up'
      );
    });

    test('graceful shutdown cleans up salvage service when cleanup method exists', async () => {
      await loadServer();

      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      sigtermHandler();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(salvageServiceInstance.cleanup).toHaveBeenCalled();
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Response salvage service cleaned up'
      );
    });

    test('graceful shutdown clears metrics service when clear method exists', async () => {
      await loadServer();

      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      sigtermHandler();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metricsServiceInstance.clear).toHaveBeenCalled();
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Metrics service cleaned up'
      );
    });

    test('graceful shutdown handles salvage service without cleanup method', async () => {
      delete salvageServiceInstance.cleanup;

      await loadServer();

      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      sigtermHandler();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleLoggerInstance.info).not.toHaveBeenCalledWith(
        'LLM Proxy Server: Response salvage service cleaned up'
      );
    });

    test('graceful shutdown handles metrics service without clear method', async () => {
      delete metricsServiceInstance.clear;

      await loadServer();

      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      sigtermHandler();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleLoggerInstance.info).not.toHaveBeenCalledWith(
        'LLM Proxy Server: Metrics service cleaned up'
      );
    });

    test('graceful shutdown handles missing httpAgentService cleanup method', async () => {
      // Create httpAgentService without cleanup method
      const httpAgentServiceWithoutCleanup = {
        getAgent: jest.fn(),
        getFetchOptions: jest.fn(),
        getStats: jest.fn(),
        // no cleanup method
      };

      // Re-mock HttpAgentService without cleanup
      jest.doMock('../../../src/services/httpAgentService.js', () => ({
        __esModule: true,
        default: jest.fn(() => httpAgentServiceWithoutCleanup),
      }));

      // Re-import and load server module with new mocks
      delete require.cache[require.resolve('../../../src/core/server.js')];
      const { createProxyServer } = await import('../../../src/core/server.js');
      const testController = createProxyServer({
        logger: consoleLoggerInstance,
        metricsEnabled: false,
        collectDefaultMetrics: false,
        rateLimitingEnabled: false,
      });
      await testController.start();

      // Get the SIGTERM handler
      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      // Execute the handler
      sigtermHandler();

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not crash and should complete gracefully
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Graceful shutdown complete'
      );
    });

    test('graceful shutdown handles when server is undefined', async () => {
      // Ensure test environment to prevent process.exit() calls
      process.env.NODE_ENV = 'test';

      // Mock app.listen to return undefined
      const appUndefined = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn((port, bindAddress, callback) => {
          // Handle both 2-arg and 3-arg forms
          if (typeof bindAddress === 'function') {
            callback = bindAddress;
          }
          if (callback) callback();
          return undefined; // Return undefined instead of server instance
        }),
      };

      const expressMockUndefined = jest.fn(() => appUndefined);
      expressMockUndefined.json = jest.fn(() => 'json-mw');
      expressMockUndefined.Router = jest.fn(() => ({
        get: jest.fn(),
        post: jest.fn(),
        use: jest.fn(),
      }));
      jest.doMock('express', () => ({
        __esModule: true,
        default: expressMockUndefined,
        Router: expressMockUndefined.Router,
      }));

      // Re-import and load server module with new mocks
      delete require.cache[require.resolve('../../../src/core/server.js')];
      const { createProxyServer } = await import('../../../src/core/server.js');
      const testController = createProxyServer({
        logger: consoleLoggerInstance,
        metricsEnabled: false,
        collectDefaultMetrics: false,
        rateLimitingEnabled: false,
      });
      await testController.start();

      // Get the SIGTERM handler
      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      // Execute the handler
      sigtermHandler();

      // In test environment, process.exit is not called
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('Additional coverage scenarios', () => {
    test('general timeout middleware respects LLM route exemptions', async () => {
      // This test needs rate limiting enabled to test the middleware after it
      const { createProxyServer } = await import('../../../src/core/server.js');
      serverController = createProxyServer({
        logger: consoleLoggerInstance,
        metricsEnabled: false,
        collectDefaultMetrics: false,
        rateLimitingEnabled: true, // Enable rate limiting for this test
      });
      await serverController.start();

      const generalTimeoutIndex = serverController.app.use.mock.calls.findIndex(
        (args) => args[0] === 'api-rate-limiter'
      );

      // Verify the rate limiter was found and the next middleware exists
      expect(generalTimeoutIndex).toBeGreaterThanOrEqual(0);
      expect(serverController.app.use.mock.calls[generalTimeoutIndex + 1]).toBeDefined();

      const generalTimeoutMiddleware =
        serverController.app.use.mock.calls[generalTimeoutIndex + 1][0];

      expect(typeof generalTimeoutMiddleware).toBe('function');

      const nextForLlm = jest.fn();
      createTimeoutMiddlewareMock.mockClear();
      generalTimeoutMiddleware(
        { path: '/api/llm-request' },
        {},
        nextForLlm
      );

      expect(nextForLlm).toHaveBeenCalledTimes(1);
      expect(createTimeoutMiddlewareMock).not.toHaveBeenCalled();

      const passthrough = jest.fn((req, res, next) => next());
      createTimeoutMiddlewareMock.mockClear();
      createTimeoutMiddlewareMock.mockReturnValueOnce(passthrough);

      const otherReq = { path: '/something-else' };
      const otherRes = {};
      const otherNext = jest.fn();
      generalTimeoutMiddleware(otherReq, otherRes, otherNext);

      expect(createTimeoutMiddlewareMock).toHaveBeenCalledWith(30000, {
        logger: consoleLoggerInstance,
      });
      expect(passthrough).toHaveBeenCalledWith(otherReq, otherRes, otherNext);
    });

    test('logs explicit CORS configuration when allowed origins are provided', async () => {
      appConfigServiceMock.getAllowedOriginsArray.mockReturnValue([
        'https://example.com',
      ]);

      await loadServer();

      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Configuring CORS for 1 origin(s)'
      );
      expect(consoleLoggerInstance.debug).toHaveBeenCalledWith(
        'CORS allowed origins:',
        { origins: ['https://example.com'] }
      );
      expect(corsMock).toHaveBeenCalledWith({
        origin: ['https://example.com'],
        methods: [HTTP_METHOD_POST, HTTP_METHOD_OPTIONS],
        allowedHeaders: [
          HTTP_HEADER_CONTENT_TYPE,
          'X-Title',
          'HTTP-Referer',
        ],
      });
    });

    test('warns when CORS origins missing in development mode', async () => {
      appConfigServiceMock.getNodeEnv = jest.fn(() => 'development');

      await loadServer();

      expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
        'LLM Proxy Server: CORS not configured in development mode (current environment: development). To enable browser access, set PROXY_ALLOWED_ORIGIN environment variable. Example: PROXY_ALLOWED_ORIGIN="http://localhost:8080,http://127.0.0.1:8080"'
      );
    });

    test('defaults to production warning when node env is non-string', async () => {
      appConfigServiceMock.getNodeEnv = jest.fn(() => ({ value: 'invalid' }));

      await loadServer();

      expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
        'LLM Proxy Server: PROXY_ALLOWED_ORIGIN environment variable not set or empty. CORS will not be configured. This may cause issues with browser-based clients.'
      );
      expect(
        consoleLoggerInstance.warn.mock.calls.some(([message]) =>
          message.includes('development mode')
        )
      ).toBe(false);
    });

    test('trims whitespace node env values before determining CORS warning', async () => {
      appConfigServiceMock.getNodeEnv = jest.fn(() => '   ');

      await loadServer();

      expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
        'LLM Proxy Server: PROXY_ALLOWED_ORIGIN environment variable not set or empty. CORS will not be configured. This may cause issues with browser-based clients.'
      );
    });

    test('metrics endpoint reports errors gracefully', async () => {
      await loadServer();
      metricsServiceInstance.getMetrics.mockRejectedValueOnce(
        new Error('metrics failure')
      );

      const metricsHandler = serverController.app.get.mock.calls.find(
        (call) => call[0] === '/metrics'
      )[1];

      const res = {
        set: jest.fn(),
        status: jest.fn(function (code) {
          this.statusCode = code;
          return this;
        }),
        send: jest.fn(),
      };

      await metricsHandler({}, res);

      expect(consoleLoggerInstance.error).toHaveBeenCalledWith(
        'Error serving metrics endpoint',
        expect.any(Error)
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error retrieving metrics');
    });

    test('root route handles unknown initialization failures', async () => {
      operational = false;
      initializationErrorDetails = null;

      await loadServer();

      const res = { status: jest.fn(() => res), send: jest.fn() };
      rootHandler({}, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        503,
        'initialization_failure_unknown',
        'LLM Proxy Server is NOT OPERATIONAL due to unknown configuration issues.',
        {},
        LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
        expect.anything()
      );
    });

    test('startup summary logs defaulted port and missing config path details', async () => {
      appConfigServiceMock.isProxyPortDefaulted.mockReturnValue(true);
      llmConfigServiceInstance.getResolvedConfigPath.mockReturnValue(null);
      llmConfigServiceInstance.getLlmConfigs.mockReturnValue({
        configs: { primary: {}, backup: {} },
      });

      await loadServer();

      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        '(Note: PROXY_PORT environment variable was not set or invalid, using default.)'
      );
      expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
        'LLM configurations path could not be determined.'
      );
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Successfully loaded 2 LLM configurations. Proxy is OPERATIONAL.'
      );
    });

    test('startup summary logs unknown initialization reason when details missing', async () => {
      operational = false;
      initializationErrorDetails = {};

      await loadServer();

      expect(consoleLoggerInstance.error).toHaveBeenCalledWith(
        'LLM Proxy Server: CRITICAL - Failed to initialize LLM configurations. Proxy is NOT OPERATIONAL.'
      );
      expect(consoleLoggerInstance.error).toHaveBeenCalledWith(
        '   Reason: Unknown initialization error.'
      );
    });

    test('startup summary reports API key configuration and metrics when enabled', async () => {
      appConfigServiceMock.getProxyAllowedOrigin.mockReturnValue(
        'http://localhost:4321'
      );
      appConfigServiceMock.getProxyProjectRootPathForApiKeyFiles.mockReturnValue(
        '/keys'
      );
      metricsServiceInstance.isEnabled.mockReturnValue(true);
      metricsServiceInstance.getStats.mockReturnValue({
        totalMetrics: 5,
        customMetrics: 2,
        defaultMetrics: 3,
      });

      await loadServer();

      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: CORS enabled for origin(s): http://localhost:4321'
      );
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        "LLM Proxy Server: API Key file root path set to: '/keys'."
      );
      expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
        'LLM Proxy Server: Metrics Collection ENABLED - Total metrics: 5, Custom metrics: 2, Default metrics: 3. Prometheus endpoint available at /metrics'
      );
    });

    test('startup summary warns when API key root missing but file-based keys configured', async () => {
      llmConfigServiceInstance.hasFileBasedApiKeys.mockReturnValue(true);
      appConfigServiceMock.getProxyProjectRootPathForApiKeyFiles.mockReturnValue(
        ''
      );

      await loadServer();

      expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
        'LLM Proxy Server: WARNING - PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is NOT SET. File-based API key retrieval WILL FAIL for configured LLMs that use apiKeyFileName.'
      );
    });

    test('beforeExit handler logs completion message', async () => {
      await loadServer();

      const beforeExitHandler = process.on.mock.calls.find(
        (call) => call[0] === 'beforeExit'
      )[1];

      await beforeExitHandler();

      expect(consoleLoggerInstance.debug).toHaveBeenCalledWith(
        'LLM Proxy Server: Graceful beforeExit handler completed'
      );
    });

    test('graceful shutdown exits process in production environments', async () => {
      process.env.NODE_ENV = 'production';

      await loadServer();

      process.exit.mockClear();

      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      sigtermHandler();

      await new Promise((resolve) => originalSetTimeout(resolve, 0));

      // In production, graceful shutdown should call process.exit(0) after successful cleanup
      expect(process.exit).toHaveBeenCalledWith(0);

      // Note: The production code does NOT implement a forced shutdown timeout
      // If this feature is needed, it should be added to src/core/server.js
    });

    test('graceful shutdown exits immediately when server is undefined in production', async () => {
      process.env.NODE_ENV = 'production';

      const appUndefined = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn((port, bindAddress, callback) => {
          // Handle both 2-arg and 3-arg forms
          if (typeof bindAddress === 'function') {
            callback = bindAddress;
          }
          if (callback) {
            callback();
          }
          return undefined;
        }),
      };

      const expressMockUndefined = jest.fn(() => appUndefined);
      expressMockUndefined.json = jest.fn(() => 'json-mw');
      expressMockUndefined.Router = jest.fn(() => ({
        get: jest.fn(),
        post: jest.fn(),
        use: jest.fn(),
      }));

      jest.doMock('express', () => ({
        __esModule: true,
        default: expressMockUndefined,
        Router: expressMockUndefined.Router,
      }));

      delete require.cache[require.resolve('../../../src/core/server.js')];
      const { createProxyServer } = await import('../../../src/core/server.js');
      const testController = createProxyServer({
        logger: consoleLoggerInstance,
        metricsEnabled: false,
        collectDefaultMetrics: false,
        rateLimitingEnabled: false,
      });
      await testController.start();

      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      process.exit.mockClear();
      sigtermHandler();

      // Wait for async operations to complete
      await new Promise((resolve) => originalSetTimeout(resolve, 0));

      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });
});
