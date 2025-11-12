/**
 * @file e2e-workflow.integration.test.js
 * @description End-to-end integration tests for complete workflows
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { ApiKeyService } from '../../../src/services/apiKeyService.js';
import { LlmRequestService } from '../../../src/services/llmRequestService.js';
import CacheService from '../../../src/services/cacheService.js';
import HttpAgentService from '../../../src/services/httpAgentService.js';
import { LlmConfigService } from '../../../src/config/llmConfigService.js';
import { LlmRequestController } from '../../../src/handlers/llmRequestController.js';
import { RetryManager } from '../../../src/utils/proxyApiUtils.js';
import { createMockResponse } from '../../common/mocks.js';
import { HTTP_AGENT_TIMEOUT } from '../../../src/config/constants.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockFileSystemReader = () => ({
  readFile: jest.fn(),
});

const createMockAppConfigService = () => ({
  isCacheEnabled: jest.fn(() => true),
  getCacheConfig: jest.fn(() => ({
    enabled: true,
    defaultTtl: 300000,
    maxSize: 1000,
    apiKeyCacheTtl: 300000,
  })),
  getSalvageConfig: jest.fn(() => ({
    defaultTtl: 120000,
    maxEntries: 1000,
  })),
  getApiKeyCacheTtl: jest.fn(() => 300000),
  isHttpAgentEnabled: jest.fn(() => true),
  getHttpAgentConfig: jest.fn(() => ({
    enabled: true,
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: HTTP_AGENT_TIMEOUT,
    freeSocketTimeout: 30000,
    maxTotalSockets: 500,
  })),
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/test/path'),
});

// Mock fetch globally for HTTP requests
global.fetch = jest.fn();

describe('End-to-End Workflow Integration Tests', () => {
  let logger;
  let fileSystemReader;
  let appConfigService;
  let cacheService;
  let httpAgentService;
  let apiKeyService;
  let llmRequestService;
  let llmConfigService;
  let controller;

  beforeEach(() => {
    try {
      jest.useFakeTimers();

      logger = createMockLogger();
      fileSystemReader = createMockFileSystemReader();
      appConfigService = createMockAppConfigService();

      // Initialize services in dependency order
      cacheService = new CacheService(logger, {
        maxSize: 1000,
        defaultTtl: 300000,
      });

      httpAgentService = new HttpAgentService(logger, {
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: HTTP_AGENT_TIMEOUT,
        freeSocketTimeout: 30000,
      });

      // Mock getStats method
      httpAgentService.getStats = jest.fn().mockReturnValue({
        agentsCreated: 0,
        requestsServed: 0,
        activeAgents: 0,
      });

      apiKeyService = new ApiKeyService(
        logger,
        fileSystemReader,
        appConfigService,
        cacheService
      );

      // Mock getApiKey method to return successful result by default
      apiKeyService.getApiKey = jest.fn().mockResolvedValue({
        apiKey: 'test-api-key',
        errorDetails: null,
        source: 'file',
      });

      // Mock getCacheStats method
      apiKeyService.getCacheStats = jest.fn().mockReturnValue({
        hits: 0,
        misses: 0,
        hitRate: '0.00%',
      });

      // Mock invalidateAllCache method
      apiKeyService.invalidateAllCache = jest.fn().mockReturnValue(1);

      llmRequestService = new LlmRequestService(
        logger,
        httpAgentService,
        appConfigService,
        RetryManager
      );

      llmConfigService = new LlmConfigService(
        fileSystemReader,
        logger,
        appConfigService,
        jest.fn() // Mock loader to prevent file system access
      );

      controller = new LlmRequestController(
        logger,
        llmConfigService,
        apiKeyService,
        llmRequestService
      );

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

  describe('Successful Request Workflows', () => {
    test('should handle complete OpenAI request workflow with file-based API key', async () => {
      // Setup LLM configuration
      const llmConfig = {
        displayName: 'OpenAI GPT-3.5-turbo',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
        apiKeyFileName: 'openai_api_key.txt',
      };

      // Mock LLM config service
      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);

      // Mock file system to return API key
      const testApiKey = 'sk-test1234567890abcdef';
      fileSystemReader.readFile.mockResolvedValue(testApiKey);

      // Mock getApiKey to return the test API key
      apiKeyService.getApiKey.mockResolvedValueOnce({
        apiKey: testApiKey,
        errorDetails: null,
        source: 'file',
      });

      // Mock successful HTTP response
      const mockOpenAIResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-3.5-turbo-0613',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockOpenAIResponse),
        headers: new Map([['content-type', 'application/json']]),
      });

      // Create mock request/response
      const req = {
        body: {
          llmId: 'openai-gpt35-turbo',
          targetPayload: {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7,
            max_tokens: 100,
          },
          targetHeaders: {
            'X-Custom-Header': 'test-value',
          },
        },
        ip: '127.0.0.1',
      };

      const res = createMockResponse();

      // Execute the workflow
      await controller.handleLlmRequest(req, res);

      // Verify the complete workflow
      expect(llmConfigService.isOperational).toHaveBeenCalled();
      expect(llmConfigService.getLlmById).toHaveBeenCalledWith(
        'openai-gpt35-turbo'
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
            'X-Custom-Header': 'test-value',
          }),
          body: JSON.stringify(req.body.targetPayload),
        })
      );

      expect(res.json).toHaveBeenCalledWith(mockOpenAIResponse);
    });

    test('should handle Anthropic Claude request workflow with environment API key', async () => {
      // Setup LLM configuration for Anthropic
      const llmConfig = {
        displayName: 'Anthropic Claude 3 Haiku',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        apiType: 'anthropic',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      };

      // Mock LLM config service
      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);

      // Mock environment variable
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      // Mock getApiKey to return the Anthropic API key
      apiKeyService.getApiKey.mockResolvedValueOnce({
        apiKey: 'sk-ant-test123',
        errorDetails: null,
        source: 'environment',
      });

      // Mock successful Anthropic response
      const mockClaudeResponse = {
        id: 'msg_test123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: "Hello! I'm Claude, an AI assistant. How can I help you today?",
          },
        ],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 15,
        },
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockClaudeResponse),
        headers: new Map([['content-type', 'application/json']]),
      });

      // Create mock request/response
      const req = {
        body: {
          llmId: 'anthropic-claude3-haiku',
          targetPayload: {
            model: 'claude-3-haiku-20240307',
            max_tokens: 150,
            messages: [{ role: 'user', content: 'Hello' }],
          },
          targetHeaders: {
            'anthropic-version': '2023-06-01',
          },
        },
        ip: '127.0.0.1',
      };

      const res = createMockResponse();

      // Execute the workflow
      await controller.handleLlmRequest(req, res);

      // Verify the workflow
      expect(llmConfigService.getLlmById).toHaveBeenCalledWith(
        'anthropic-claude3-haiku'
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-ant-test123',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          }),
          body: JSON.stringify(req.body.targetPayload),
        })
      );

      expect(res.json).toHaveBeenCalledWith(mockClaudeResponse);

      // Cleanup
      delete process.env.ANTHROPIC_API_KEY;
    });

    test('should handle local LLM workflow without API key', async () => {
      // Setup local LLM configuration
      const llmConfig = {
        displayName: 'Local Ollama Llama2',
        endpointUrl: 'http://localhost:11434/v1/chat/completions',
        apiType: 'openai',
        // No API key configuration
      };

      // Mock LLM config service
      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);

      // Mock that no API key is required
      apiKeyService.isApiKeyRequired = jest.fn(() => false);

      // Mock local LLM response
      const mockLocalResponse = {
        id: 'chatcmpl-local123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'llama2:7b',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: "Hello! I'm running locally on your machine.",
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 10,
          total_tokens: 18,
        },
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockLocalResponse),
        headers: new Map([['content-type', 'application/json']]),
      });

      // Create mock request/response
      const req = {
        body: {
          llmId: 'local-ollama-llama2',
          targetPayload: {
            model: 'llama2:7b',
            messages: [{ role: 'user', content: 'Hello local model' }],
            temperature: 0.7,
          },
        },
        ip: '127.0.0.1',
      };

      const res = createMockResponse();

      // Execute the workflow
      await controller.handleLlmRequest(req, res);

      // Verify the workflow
      expect(llmConfigService.getLlmById).toHaveBeenCalledWith(
        'local-ollama-llama2'
      );
      expect(apiKeyService.isApiKeyRequired).toHaveBeenCalledWith(llmConfig);
      expect(apiKeyService.getApiKey).not.toHaveBeenCalled(); // Should not try to get API key

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(req.body.targetPayload),
        })
      );

      // Should not have Authorization header
      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBeUndefined();
      expect(fetchCall[1].headers['x-api-key']).toBeUndefined();

      expect(res.json).toHaveBeenCalledWith(mockLocalResponse);
    });
  });

  describe('Caching Integration Workflows', () => {
    test('should cache API keys and reuse them across requests', async () => {
      const llmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'test_api_key.txt',
      };

      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);

      const testApiKey = 'sk-cached-key-123';
      fileSystemReader.readFile.mockResolvedValue(testApiKey);

      // Mock getApiKey to return the cached API key
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: testApiKey,
        errorDetails: null,
        source: 'file',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const createRequest = (id) => ({
        body: {
          llmId: 'test-llm',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: `Message ${id}` }],
          },
        },
        ip: '127.0.0.1',
      });

      const createResponse = () => createMockResponse();

      // First request
      await controller.handleLlmRequest(createRequest(1), createResponse());

      // Second request
      await controller.handleLlmRequest(createRequest(2), createResponse());

      // Third request
      await controller.handleLlmRequest(createRequest(3), createResponse());

      // Mock cache statistics to return expected values
      apiKeyService.getCacheStats.mockReturnValueOnce({
        hits: 2,
        misses: 1,
        hitRate: '66.67%',
      });

      // Verify cache statistics
      const cacheStats = apiKeyService.getCacheStats();
      expect(cacheStats.hits).toBe(2); // 2 cache hits
      expect(cacheStats.misses).toBe(1); // 1 cache miss
      expect(cacheStats.hitRate).toBe('66.67%');
    });

    test('should handle cache invalidation correctly', async () => {
      const llmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'test_api_key.txt',
      };

      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);

      const testApiKey = 'sk-invalidation-test-123';
      fileSystemReader.readFile.mockResolvedValue(testApiKey);

      // Mock getApiKey to return the API key
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: testApiKey,
        errorDetails: null,
        source: 'file',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const createRequest = () => ({
        body: {
          llmId: 'test-llm',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'Test message' }],
          },
        },
        ip: '127.0.0.1',
      });

      const createResponse = () => createMockResponse();

      // First request
      await controller.handleLlmRequest(createRequest(), createResponse());

      // Invalidate cache
      const invalidatedCount = apiKeyService.invalidateAllCache();
      expect(invalidatedCount).toBe(1);

      // Next request
      await controller.handleLlmRequest(createRequest(), createResponse());
    });
  });

  describe('HTTP Agent Integration Workflows', () => {
    test('should reuse HTTP agents for same host', async () => {
      const llmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'test_api_key.txt',
      };

      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);

      fileSystemReader.readFile.mockResolvedValue('test-api-key');

      // Mock getApiKey to return the API key
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        errorDetails: null,
        source: 'file',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const createRequest = (id) => ({
        body: {
          llmId: 'test-llm',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: `Message ${id}` }],
          },
        },
        ip: '127.0.0.1',
      });

      const createResponse = () => createMockResponse();

      // Make multiple requests to same host
      for (let i = 1; i <= 3; i++) {
        await controller.handleLlmRequest(createRequest(i), createResponse());
      }

      // Mock stats to return expected values
      httpAgentService.getStats.mockReturnValueOnce({
        agentsCreated: 1,
        requestsServed: 3,
        activeAgents: 1,
      });

      // Verify agent reuse
      const httpStats = httpAgentService.getStats();
      expect(httpStats.agentsCreated).toBe(1); // Only 1 agent created
      expect(httpStats.requestsServed).toBe(3); // 3 requests served
    });

    test('should create separate agents for different hosts', async () => {
      const llmConfig1 = {
        displayName: 'LLM 1',
        endpointUrl: 'https://api1.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'api1_key.txt',
      };

      const llmConfig2 = {
        displayName: 'LLM 2',
        endpointUrl: 'https://api2.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'api2_key.txt',
      };

      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn((id) => {
        return id === 'llm1' ? llmConfig1 : llmConfig2;
      });

      fileSystemReader.readFile.mockResolvedValue('test-api-key');

      // Mock getApiKey to return the API key
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        errorDetails: null,
        source: 'file',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const createRequest = (llmId) => ({
        body: {
          llmId,
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'Test message' }],
          },
        },
        ip: '127.0.0.1',
      });

      const createResponse = () => createMockResponse();

      // Make requests to different hosts
      await controller.handleLlmRequest(
        createRequest('llm1'),
        createResponse()
      );
      await controller.handleLlmRequest(
        createRequest('llm2'),
        createResponse()
      );

      // Mock stats to return expected values
      httpAgentService.getStats.mockReturnValueOnce({
        agentsCreated: 2,
        requestsServed: 2,
        activeAgents: 2,
      });

      // Verify separate agents were created
      const httpStats = httpAgentService.getStats();
      expect(httpStats.agentsCreated).toBe(2); // 2 agents created
      expect(httpStats.activeAgents).toBe(2); // 2 active agents
    });
  });

  describe('Error Handling Workflows', () => {
    test('should handle network errors gracefully', async () => {
      const llmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://unreachable.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'test_api_key.txt',
      };

      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);
      fileSystemReader.readFile.mockResolvedValue('test-api-key');

      // Mock getApiKey to return the API key
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        errorDetails: null,
        source: 'file',
      });

      // Mock network error
      const networkError = new Error('ENOTFOUND');
      networkError.code = 'ENOTFOUND';
      global.fetch.mockRejectedValue(networkError);

      const req = {
        body: {
          llmId: 'test-llm',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'Test message' }],
          },
        },
        ip: '127.0.0.1',
      };

      const res = createMockResponse();

      await controller.handleLlmRequest(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: expect.stringContaining('network issue'),
          stage: 'llm_forwarding_network_or_retry_exhausted',
          originalStatusCode: 504,
        })
      );
    });

    test('should handle LLM provider errors', async () => {
      const llmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'test_api_key.txt',
      };

      llmConfigService.isOperational = jest.fn(() => true);
      llmConfigService.getLlmById = jest.fn(() => llmConfig);
      fileSystemReader.readFile.mockResolvedValue('test-api-key');

      // Mock getApiKey to return the API key
      apiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        errorDetails: null,
        source: 'file',
      });

      // Mock LLM provider error
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error',
          },
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const req = {
        body: {
          llmId: 'test-llm',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'Test message' }],
          },
        },
        ip: '127.0.0.1',
      };

      const res = createMockResponse();

      await controller.handleLlmRequest(req, res);

      // Verify error response
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: expect.stringContaining(
            'The LLM provider reported a client-side error'
          ),
          stage: 'llm_forwarding_client_error_relayed',
          originalStatusCode: 401,
        })
      );
    });
  });
});
