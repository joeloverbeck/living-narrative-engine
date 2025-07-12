import { describe, test, beforeEach, expect, jest } from '@jest/globals';

describe('Server - Configuration Logging Coverage', () => {
  let consoleLoggerInstance;
  let appConfigServiceMock;
  let originalSetTimeout;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Store original setTimeout
    originalSetTimeout = global.setTimeout;

    // Mock console logger
    consoleLoggerInstance = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Default mock for AppConfigService
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

    // Mock Express app
    const app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((port, callback) => {
        if (callback) callback();
        return { close: jest.fn() };
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
      default: jest.fn(() => ({
        cleanup: jest.fn(),
        getAgent: jest.fn(),
        getFetchOptions: jest.fn(),
        getStats: jest.fn(),
      })),
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

    // Mock process to prevent actual signal handlers from being registered
    // and prevent actual process.exit calls during tests
    const originalProcessOn = process.on;
    const originalProcessExit = process.exit;
    process.on = jest.fn();
    process.exit = jest.fn();

    // Store originals for restoration
    process._originalOn = originalProcessOn;
    process._originalExit = originalProcessExit;

    // Mock setTimeout for graceful shutdown to prevent actual 10s timeout
    global.setTimeout = jest.fn((fn, delay) => {
      if (delay === 10000) {
        // Don't execute the 10-second timeout callback that calls process.exit(1)
        return { id: 'mocked-graceful-shutdown-timeout' };
      }
      // For other timeouts (like the ones used in tests), use original setTimeout
      return originalSetTimeout(fn, delay);
    });

    // Store original setTimeout for restoration
    process._originalSetTimeout = originalSetTimeout;
  });

  afterEach(() => {
    // Restore original setTimeout
    if (process._originalSetTimeout) {
      global.setTimeout = process._originalSetTimeout;
      delete process._originalSetTimeout;
    }

    // Restore original process methods if they were stored
    if (process._originalOn) {
      process.on = process._originalOn;
      delete process._originalOn;
    }
    if (process._originalExit) {
      process.exit = process._originalExit;
      delete process._originalExit;
    }
  });

  test('logs cache enabled configuration when cache is enabled', async () => {
    // Configure AppConfigService to return cache enabled
    appConfigServiceMock.isCacheEnabled.mockReturnValue(true);
    appConfigServiceMock.getCacheConfig.mockReturnValue({
      enabled: true,
      defaultTtl: 600000,
      maxSize: 2000,
      apiKeyCacheTtl: 900000,
    });

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify cache enabled log message
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server: Cache ENABLED - TTL: 600000ms, Max Size: 2000 entries, API Key TTL: 900000ms'
    );
  });

  test('logs cache disabled configuration when cache is disabled', async () => {
    // Configure AppConfigService to return cache disabled (default setup)
    appConfigServiceMock.isCacheEnabled.mockReturnValue(false);

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify cache disabled log message
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server: Cache DISABLED - API keys will be read from source on every request'
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

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify HTTP agent enabled log message
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server: HTTP Agent Pooling ENABLED - Keep-Alive: false, Max Sockets: 100, Timeout: 120000ms'
    );
  });

  test('logs HTTP agent disabled configuration when HTTP agent is disabled', async () => {
    // Configure AppConfigService to return HTTP agent disabled (default setup)
    appConfigServiceMock.isHttpAgentEnabled.mockReturnValue(false);

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

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

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

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
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

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

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

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

    // Import server to trigger startup
    await import('../../../src/core/server.js');

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify specific HTTP agent configuration values are logged
    expect(consoleLoggerInstance.info).toHaveBeenCalledWith(
      'LLM Proxy Server: HTTP Agent Pooling ENABLED - Keep-Alive: false, Max Sockets: 200, Timeout: 300000ms'
    );
  });
});
