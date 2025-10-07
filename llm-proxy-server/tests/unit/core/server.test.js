import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
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

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Store original global methods
    originalSetTimeout = global.setTimeout;
    originalProcess = {
      on: process.on,
      exit: process.exit,
    };

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
      },
    });

    app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((_port, _bindAddress, _cb) => {
        // Handle both 2-arg and 3-arg forms of listen
        // Note: callback is not used here - loadServer will handle it
        // Don't call the callback immediately - let loadServer handle it
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

    const llmConfigServiceInstance = {
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

    const ResponseSalvageService = jest.fn(() => ({
      salvageResponse: jest.fn(),
      getStats: jest.fn(),
    }));
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

    jest.doMock('../../../src/middleware/timeout.js', () => ({
      __esModule: true,
      createTimeoutMiddleware: jest.fn(() => 'timeout-mw'),
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
    const metricsServiceInstance = {
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

    // Mock health routes - create a mock router object to handle express.Router() call
    const mockHealthRouter = {
      get: jest.fn(),
      post: jest.fn(),
      use: jest.fn(),
    };
    jest.doMock('../../../src/routes/healthRoutes.js', () => ({
      __esModule: true,
      default: mockHealthRouter,
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

    // Clear module cache to prevent leaks between tests
    const serverModulePath = require.resolve('../../../src/core/server.js');
    if (require.cache[serverModulePath]) {
      delete require.cache[serverModulePath];
    }
  });

  const loadServer = async () => {
    await import('../../../src/core/server.js');
    await new Promise((r) => setTimeout(r, 0));
    const loggerCtor = (await import('../../../src/consoleLogger.js'))
      .ConsoleLogger;
    consoleLoggerInstance = loggerCtor.mock.results[0].value;

    // Wait for app.listen to be called and trigger its callback
    if (app.listen.mock.calls.length > 0) {
      const listenCallback = app.listen.mock.calls[0][2]; // Third argument is the callback
      if (listenCallback && typeof listenCallback === 'function') {
        // Execute the listen callback to trigger startup summary logs
        listenCallback();
      }
    }

    rootHandler = app.get.mock.calls.find((c) => c[0] === '/')[1];
    errorHandler = app.use.mock.calls.find(
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
      // Import the server module to trigger the signal handler registration
      await import('../../../src/core/server.js');

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
        'LLM Proxy Server: HTTP server closed'
      );
    });

    test('graceful shutdown handles SIGINT signal correctly', async () => {
      // Import the server module to trigger the signal handler registration
      await import('../../../src/core/server.js');

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

    test('graceful shutdown cleans up httpAgentService when cleanup method exists', async () => {
      // Import the server module
      await import('../../../src/core/server.js');

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

      // Re-import the server module
      delete require.cache[require.resolve('../../../src/core/server.js')];
      await import('../../../src/core/server.js');

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
      // Mock app.listen to return undefined
      const appUndefined = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn((port, callback) => {
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

      // Re-import the server module
      delete require.cache[require.resolve('../../../src/core/server.js')];
      await import('../../../src/core/server.js');

      // Get the SIGTERM handler
      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      // Execute the handler
      sigtermHandler();

      // In test environment, process.exit is not called
      expect(process.exit).not.toHaveBeenCalled();
    });

    test('graceful shutdown forces exit after timeout', async () => {
      // Mock a server that never calls the close callback
      const slowServerInstance = {
        close: jest.fn(() => {
          // Don't call the callback, simulating a hung server
        }),
      };

      const appSlow = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        listen: jest.fn((port, bindAddress, cb) => {
          // Handle both 2-arg and 3-arg forms of listen
          if (typeof bindAddress === 'function') {
            // 2-arg form: listen(port, callback)
            cb = bindAddress;
          }
          if (cb) cb();
          return slowServerInstance;
        }),
      };

      const expressMockSlow = jest.fn(() => appSlow);
      expressMockSlow.json = jest.fn(() => 'json-mw');
      expressMockSlow.Router = jest.fn(() => 'router-instance');
      jest.doMock('express', () => ({
        __esModule: true,
        default: expressMockSlow,
        json: expressMockSlow.json,
        Router: expressMockSlow.Router,
      }));

      // Mock setTimeout to trigger immediately for testing
      global.setTimeout = jest.fn((fn, delay) => {
        if (delay === 100) {
          // This is our force shutdown timeout in test environment - execute immediately
          fn();
        }
        return originalSetTimeout(fn, 0);
      });

      // Re-import the server module
      delete require.cache[require.resolve('../../../src/core/server.js')];
      await import('../../../src/core/server.js');

      // Get the SIGTERM handler
      const sigtermHandler = process.on.mock.calls.find(
        (call) => call[0] === 'SIGTERM'
      )[1];

      // Execute the handler
      sigtermHandler();

      // Wait for immediate timeout execution
      await new Promise((resolve) => originalSetTimeout(resolve, 0));

      expect(consoleLoggerInstance.error).toHaveBeenCalledWith(
        'LLM Proxy Server: Forced shutdown after timeout'
      );
      // In test environment, process.exit is not called
      expect(process.exit).not.toHaveBeenCalled();
    });
  });
});
