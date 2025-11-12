/**
 * @file performance-optimizations.integration.test.js
 * @description Integration tests for cache and connection pooling performance optimizations
 */

import { jest } from '@jest/globals';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import * as proxyApiUtils from '../../src/utils/proxyApiUtils.js';
import { HTTP_AGENT_TIMEOUT } from '../../src/config/constants.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Mock the RetryManager class
jest.mock('../../src/utils/proxyApiUtils.js', () => ({
  RetryManager: jest.fn(),
}));

describe('Performance Optimizations Integration Tests', () => {
  let apiKeyService;
  let llmRequestService;
  let cacheService;
  let httpAgentService;
  let mockLogger;
  let mockFileSystemReader;
  let mockAppConfigService;

  beforeEach(() => {
    try {
      // Use fake timers to prevent real intervals
      jest.useFakeTimers();

      mockLogger = createMockLogger();

      // Setup RetryManager mock
      proxyApiUtils.RetryManager.mockImplementation(() => ({
        executeWithRetry: jest.fn(),
      }));

      // Create mock services
      mockFileSystemReader = {
        readFile: jest.fn(),
      };

      mockAppConfigService = {
        isCacheEnabled: jest.fn().mockReturnValue(true),
        getCacheConfig: jest.fn().mockReturnValue({
          enabled: true,
          defaultTtl: 300000,
          maxSize: 1000,
          apiKeyCacheTtl: 300000,
        }),
        getSalvageConfig: jest.fn().mockReturnValue({
          defaultTtl: 120000,
          maxEntries: 1000,
        }),
        getApiKeyCacheTtl: jest.fn().mockReturnValue(300000),
        isHttpAgentEnabled: jest.fn().mockReturnValue(true),
        getHttpAgentConfig: jest.fn().mockReturnValue({
          enabled: true,
          keepAlive: true,
          maxSockets: 50,
          maxFreeSockets: 10,
          timeout: HTTP_AGENT_TIMEOUT,
          freeSocketTimeout: 30000,
          maxTotalSockets: 500,
        }),
        getProxyProjectRootPathForApiKeyFiles: jest
          .fn()
          .mockReturnValue('/test/path'),
      };

      // Initialize services
      cacheService = new CacheService(mockLogger, {
        maxSize: 1000,
        defaultTtl: 300000,
      });

      httpAgentService = new HttpAgentService(mockLogger, {
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: HTTP_AGENT_TIMEOUT,
        freeSocketTimeout: 30000,
      });

      apiKeyService = new ApiKeyService(
        mockLogger,
        mockFileSystemReader,
        mockAppConfigService,
        cacheService
      );

      llmRequestService = new LlmRequestService(
        mockLogger,
        httpAgentService,
        mockAppConfigService,
        proxyApiUtils.RetryManager
      );

      // Reset mocks
      jest.clearAllMocks();
    } catch (error) {
      // Ensure timers are cleaned up if setup fails
      jest.clearAllTimers();
      jest.useRealTimers();
      throw error;
    }
  });

  afterEach(() => {
    try {
      // Clean up the httpAgentService to clear intervals
      if (httpAgentService && httpAgentService.cleanup) {
        httpAgentService.cleanup();
      }
      jest.restoreAllMocks();
    } finally {
      // Always clean up timers regardless of other cleanup failures
      try {
        jest.clearAllTimers();
        jest.useRealTimers();
      } catch (timerError) {
        // Log timer cleanup failures but don't re-throw
        console.warn('Timer cleanup failed:', timerError.message);
      }
    }
  });

  describe('API Key Caching Integration', () => {
    it('should cache API keys on first read and serve from cache on subsequent reads', async () => {
      // Setup
      const testApiKey = 'test-api-key-12345';
      mockFileSystemReader.readFile.mockResolvedValue(testApiKey);

      const llmModelConfig = {
        apiType: 'openai',
        apiKeyFileName: 'api_key.txt',
      };

      // First call - should read from file
      const result1 = await apiKeyService.getApiKey(llmModelConfig, 'test-llm');

      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(1);
      expect(result1.apiKey).toBe(testApiKey);
      expect(result1.source).toBe("file 'api_key.txt'");

      // Second call - should read from cache
      const result2 = await apiKeyService.getApiKey(llmModelConfig, 'test-llm');

      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2.apiKey).toBe(testApiKey);
      expect(result2.source).toBe("file 'api_key.txt'");

      // Verify cache hit in logs
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'ApiKeyService._readApiKeyFromFile: Retrieved API key from cache'
        )
      );
    });

    it('should not use cache when caching is disabled', async () => {
      // Disable caching
      mockAppConfigService.isCacheEnabled.mockReturnValue(false);

      const testApiKey = 'test-api-key-12345';
      mockFileSystemReader.readFile.mockResolvedValue(testApiKey);

      const llmModelConfig = {
        apiType: 'openai',
        apiKeyFileName: 'api_key.txt',
      };

      // First call
      await apiKeyService.getApiKey(llmModelConfig, 'test-llm');
      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(1);

      // Second call - should read from file again
      await apiKeyService.getApiKey(llmModelConfig, 'test-llm');
      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', async () => {
      const testApiKey = 'test-api-key-12345';
      mockFileSystemReader.readFile.mockResolvedValue(testApiKey);

      const llmModelConfig = {
        apiType: 'openai',
        apiKeyFileName: 'api_key.txt',
      };

      // Generate some cache activity
      await apiKeyService.getApiKey(llmModelConfig, 'test-llm'); // Cache miss
      await apiKeyService.getApiKey(llmModelConfig, 'test-llm'); // Cache hit

      const stats = apiKeyService.getCacheStats();

      expect(stats).toMatchObject({
        hits: 1,
        misses: 1,
        size: 1,
        hitRate: '50.00%',
      });
    });
  });

  describe('HTTP Connection Pooling Integration', () => {
    it('should reuse HTTP agents for same host', async () => {
      const llmModelConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.example.com/v1/chat',
        apiType: 'openai',
        defaultParameters: {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
        },
      };

      // Mock successful response
      // Get the mock instance and set up the response
      const retryManagerInstance = new proxyApiUtils.RetryManager();
      retryManagerInstance.executeWithRetry.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      // Make multiple requests to same host
      await llmRequestService.forwardRequest(
        'test-llm',
        llmModelConfig,
        { messages: [{ role: 'user', content: 'Test 1' }] },
        {},
        'test-api-key'
      );

      await llmRequestService.forwardRequest(
        'test-llm',
        llmModelConfig,
        { messages: [{ role: 'user', content: 'Test 2' }] },
        {},
        'test-api-key'
      );

      // Verify agent was reused
      const stats = httpAgentService.getStats();
      expect(stats.agentsCreated).toBe(1);
      expect(stats.requestsServed).toBe(2);

      // Verify agent was passed to RetryManager
      expect(proxyApiUtils.RetryManager).toHaveBeenCalledWith(
        llmModelConfig.endpointUrl,
        expect.objectContaining({
          agent: expect.any(Object),
        }),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should create separate agents for different hosts', async () => {
      const llmConfig1 = {
        displayName: 'LLM 1',
        endpointUrl: 'https://api1.example.com/v1/chat',
        apiType: 'openai',
        defaultParameters: {},
      };

      const llmConfig2 = {
        displayName: 'LLM 2',
        endpointUrl: 'https://api2.example.com/v1/chat',
        apiType: 'openai',
        defaultParameters: {},
      };

      // Get the mock instance and set up the response
      const retryManagerInstance = new proxyApiUtils.RetryManager();
      retryManagerInstance.executeWithRetry.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      // Make requests to different hosts
      await llmRequestService.forwardRequest(
        'llm1',
        llmConfig1,
        { messages: [] },
        {},
        'api-key-1'
      );

      await llmRequestService.forwardRequest(
        'llm2',
        llmConfig2,
        { messages: [] },
        {},
        'api-key-2'
      );

      // Verify separate agents were created
      const stats = httpAgentService.getStats();
      expect(stats.agentsCreated).toBe(2);
      expect(stats.activeAgents).toBe(2);
    });

    it('should not use HTTP agent when pooling is disabled', async () => {
      // Disable HTTP agent pooling
      mockAppConfigService.isHttpAgentEnabled.mockReturnValue(false);

      const llmModelConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.example.com/v1/chat',
        apiType: 'openai',
        defaultParameters: {},
      };

      // Get the mock instance and set up the response
      const retryManagerInstance = new proxyApiUtils.RetryManager();
      retryManagerInstance.executeWithRetry.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      await llmRequestService.forwardRequest(
        'test-llm',
        llmModelConfig,
        { messages: [] },
        {},
        'test-api-key'
      );

      // Verify no agent was passed to RetryManager
      expect(proxyApiUtils.RetryManager).toHaveBeenCalledWith(
        llmModelConfig.endpointUrl,
        expect.not.objectContaining({
          agent: expect.any(Object),
        }),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
    });
  });

  describe('Combined Performance Optimizations', () => {
    it('should use both caching and connection pooling together effectively', async () => {
      // Setup
      const testApiKey = 'test-api-key-12345';
      mockFileSystemReader.readFile.mockResolvedValue(testApiKey);

      const llmModelConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.example.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'api_key.txt',
        defaultParameters: {},
      };

      // Get the mock instance and set up the response
      const retryManagerInstance = new proxyApiUtils.RetryManager();
      retryManagerInstance.executeWithRetry.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      });

      // Simulate multiple requests
      for (let i = 0; i < 5; i++) {
        // Get API key (should use cache after first call)
        const apiKeyResult = await apiKeyService.getApiKey(
          llmModelConfig,
          'test-llm'
        );

        // Forward request (should reuse HTTP agent)
        await llmRequestService.forwardRequest(
          'test-llm',
          llmModelConfig,
          { messages: [{ role: 'user', content: `Test ${i}` }] },
          {},
          apiKeyResult.apiKey
        );
      }

      // Verify caching worked
      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(1); // Only 1 file read

      // Verify connection pooling worked
      const httpStats = httpAgentService.getStats();
      expect(httpStats.agentsCreated).toBe(1); // Only 1 agent created
      expect(httpStats.requestsServed).toBe(5); // 5 requests served

      // Verify cache statistics
      const cacheStats = apiKeyService.getCacheStats();
      expect(cacheStats.hits).toBe(4); // 4 cache hits
      expect(cacheStats.misses).toBe(1); // 1 cache miss
      expect(cacheStats.hitRate).toBe('80.00%');
    });

    it('should handle cache invalidation correctly', async () => {
      const testApiKey = 'test-api-key-12345';
      mockFileSystemReader.readFile.mockResolvedValue(testApiKey);

      const llmModelConfig = {
        apiType: 'openai',
        apiKeyFileName: 'api_key.txt',
      };

      // First call - cache miss
      await apiKeyService.getApiKey(llmModelConfig, 'test-llm');
      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(1);

      // Invalidate cache
      const invalidatedCount = apiKeyService.invalidateAllCache();
      expect(invalidatedCount).toBe(1);

      // Next call - should read from file again
      await apiKeyService.getApiKey(llmModelConfig, 'test-llm');
      expect(mockFileSystemReader.readFile).toHaveBeenCalledTimes(2);
    });
  });
});
