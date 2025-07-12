import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
  TestServerManager,
  TestTimerManager,
} from '../../common/testServerUtils.js';

describe('Server - Graceful Shutdown Coverage', () => {
  let consoleLoggerInstance;
  let httpAgentServiceInstance;
  let serverInstance;
  let originalProcess;
  let serverManager;
  let timerManager;
  let originalSetTimeout;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Store original global methods
    originalProcess = {
      on: process.on,
      exit: process.exit,
    };
    originalSetTimeout = global.setTimeout;

    // Initialize test utilities for better resource management
    serverManager = new TestServerManager();
    timerManager = new TestTimerManager();
    // Note: Don't setup fake timers here as it interferes with this test's specific timer mocking

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

    // Mock Express app
    const app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return serverInstance;
      }),
    };

    const expressMock = jest.fn(() => app);
    expressMock.json = jest.fn(() => 'json-mw');
    jest.doMock('express', () => ({
      __esModule: true,
      default: expressMock,
    }));

    // Mock all other dependencies
    jest.doMock('cors', () => ({
      __esModule: true,
      default: jest.fn(() => 'cors-mw'),
    }));

    jest.doMock('compression', () => ({
      __esModule: true,
      default: jest.fn(() => 'compression-mw'),
    }));

    // Mock AppConfigService
    const appConfigServiceMock = {
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
    };
    jest.doMock('../../../src/config/appConfig.js', () => ({
      __esModule: true,
      getAppConfigService: jest.fn(() => appConfigServiceMock),
    }));

    // Mock ConsoleLogger
    const ConsoleLogger = jest.fn(() => consoleLoggerInstance);
    jest.doMock('../../../src/consoleLogger.js', () => ({
      __esModule: true,
      ConsoleLogger,
    }));

    // Mock NodeFileSystemReader
    jest.doMock('../../../src/nodeFileSystemReader.js', () => ({
      __esModule: true,
      NodeFileSystemReader: jest.fn(),
    }));

    // Mock LlmConfigService
    const llmConfigServiceInstance = {
      initialize: jest.fn(),
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmConfigs: jest.fn(() => ({ llms: { a: {} } })),
      getResolvedConfigPath: jest.fn(() => '/path/llm.json'),
      hasFileBasedApiKeys: jest.fn(() => false),
    };
    jest.doMock('../../../src/config/llmConfigService.js', () => ({
      __esModule: true,
      LlmConfigService: jest.fn(() => llmConfigServiceInstance),
    }));

    // Mock CacheService
    jest.doMock('../../../src/services/cacheService.js', () => ({
      __esModule: true,
      default: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        invalidatePattern: jest.fn(),
        getStats: jest.fn(),
      })),
    }));

    // Mock HttpAgentService
    jest.doMock('../../../src/services/httpAgentService.js', () => ({
      __esModule: true,
      default: jest.fn(() => httpAgentServiceInstance),
    }));

    // Mock ApiKeyService
    jest.doMock('../../../src/services/apiKeyService.js', () => ({
      __esModule: true,
      ApiKeyService: jest.fn(),
    }));

    // Mock LlmRequestService
    jest.doMock('../../../src/services/llmRequestService.js', () => ({
      __esModule: true,
      LlmRequestService: jest.fn(),
    }));

    // Mock LlmRequestController
    jest.doMock('../../../src/handlers/llmRequestController.js', () => ({
      __esModule: true,
      LlmRequestController: jest.fn(() => ({
        handleLlmRequest: jest.fn(),
      })),
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

    // Mock responseUtils
    jest.doMock('../../../src/utils/responseUtils.js', () => ({
      __esModule: true,
      sendProxyError: jest.fn(),
    }));
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
    process.on = originalProcess.on;
    process.exit = originalProcess.exit;
    global.setTimeout = originalSetTimeout;

    // Clear module cache to prevent leaks between tests
    const serverModulePath = require.resolve('../../../src/core/server.js');
    if (require.cache[serverModulePath]) {
      delete require.cache[serverModulePath];
    }
  });

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
    const app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return undefined; // Return undefined instead of server instance
      }),
    };

    const expressMockUndefined = jest.fn(() => app);
    expressMockUndefined.json = jest.fn(() => 'json-mw');
    jest.doMock('express', () => ({
      __esModule: true,
      default: expressMockUndefined,
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

    const app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return slowServerInstance;
      }),
    };

    const expressMockSlow = jest.fn(() => app);
    expressMockSlow.json = jest.fn(() => 'json-mw');
    jest.doMock('express', () => ({
      __esModule: true,
      default: expressMockSlow,
    }));

    // Mock setTimeout to trigger immediately for testing
    global.setTimeout = jest.fn((fn, delay) => {
      if (delay === 10000) {
        // This is our force shutdown timeout - execute immediately
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
