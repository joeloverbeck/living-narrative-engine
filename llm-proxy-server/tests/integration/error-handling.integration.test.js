/**
 * @file error-handling.integration.test.js
 * @description Integration tests for comprehensive error handling scenarios
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../../src/middleware/validation.js';
import { createTimeoutMiddleware } from '../../src/middleware/timeout.js';
import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import { sendProxyError } from '../../src/utils/responseUtils.js';

describe('Error Handling Integration Tests', () => {
  let app;
  let mockLogger;
  let mockLlmConfigService;
  let mockApiKeyService;
  let mockLlmRequestService;
  let controller;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock services
    mockLlmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(),
    };

    mockApiKeyService = {
      getApiKey: jest.fn(),
      isApiKeyRequired: jest.fn(() => true),
    };

    mockLlmRequestService = {
      forwardRequest: jest.fn(),
    };

    // Create controller
    controller = new LlmRequestController(
      mockLogger,
      mockLlmConfigService,
      mockApiKeyService,
      mockLlmRequestService
    );

    // Create Express app with error handling
    app = express();
    app.use(createRequestTrackingMiddleware({ logger: mockLogger }));
    app.use(express.json({ limit: '10mb' }));
    app.use(createTimeoutMiddleware());

    // Add routes
    app.post(
      '/api/llm-request',
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      controller.handleLlmRequest.bind(controller)
    );

    // Custom error handler for testing
    app.use((err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }

      const statusCode = err.status || err.statusCode || 500;
      const stage = err.stage || 'internal_proxy_error';

      sendProxyError(
        res,
        statusCode,
        stage,
        err.message ||
          'An unexpected internal server error occurred in the proxy.',
        err.details || { originalErrorMessage: err.message },
        err.llmId || 'UNHANDLED_ERROR',
        mockLogger
      );
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Service Not Operational Errors', () => {
    test('should handle proxy not operational with initialization details', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        message: 'Configuration file not found',
        pathAttempted: '/config/llm-configs.json',
        code: 'ENOENT',
      });

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(503);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Configuration file not found',
        stage: 'initialization_failure_unknown',
        details: {},
        originalStatusCode: 503,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('LLM Proxy Server: Sending error to client'),
        expect.any(Object)
      );
    });

    test('should handle proxy not operational without initialization details', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue(null);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(503);

      expect(response.body).toMatchObject({
        error: true,
        message:
          'Proxy server is not operational due to unknown configuration issues.',
        stage: 'initialization_failure_unknown',
        originalStatusCode: 503,
      });
    });
  });

  describe('LLM Configuration Errors', () => {
    test('should handle missing LLM configuration', async () => {
      mockLlmConfigService.getLlmById.mockReturnValue(null);

      const requestBody = {
        llmId: 'nonexistent-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('LLM configuration not found'),
        stage: 'llm_config_lookup_failed',
        details: {
          requestedLlmId: 'nonexistent-llm',
        },
        originalStatusCode: 400,
      });
    });

    test('should handle LLM configuration with missing required fields', async () => {
      const incompleteLlmConfig = {
        displayName: 'Incomplete LLM',
        // Missing endpointUrl and apiType
      };

      mockLlmConfigService.getLlmById.mockReturnValue(incompleteLlmConfig);

      const requestBody = {
        llmId: 'incomplete-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('Cannot read properties'),
        stage: 'internal_proxy_error',
        originalStatusCode: 500,
      });
    });
  });

  describe('API Key Retrieval Errors', () => {
    test('should handle file-based API key not found', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'missing_key.txt',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);

      const fileError = new Error('ENOENT: no such file or directory');
      fileError.code = 'ENOENT';
      mockApiKeyService.getApiKey.mockRejectedValue(fileError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: 'ENOENT: no such file or directory',
        stage: 'internal_proxy_error',
        details: {
          originalErrorMessage: 'ENOENT: no such file or directory',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle environment variable API key not set', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyEnvVar: 'MISSING_API_KEY',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);

      const envError = new Error(
        'Environment variable MISSING_API_KEY is not set'
      );
      mockApiKeyService.getApiKey.mockRejectedValue(envError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Environment variable MISSING_API_KEY is not set',
        stage: 'internal_proxy_error',
        details: {
          originalErrorMessage:
            'Environment variable MISSING_API_KEY is not set',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle corrupted API key file', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'corrupted_key.txt',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);

      const corruptionError = new Error(
        'API key file contains invalid characters'
      );
      mockApiKeyService.getApiKey.mockRejectedValue(corruptionError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: 'API key file contains invalid characters',
        stage: 'internal_proxy_error',
        originalStatusCode: 500,
      });
    });
  });

  describe('Network and Connection Errors', () => {
    test('should handle DNS resolution failure', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://nonexistent.domain.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      const dnsError = new Error(
        'getaddrinfo ENOTFOUND nonexistent.domain.com'
      );
      dnsError.code = 'ENOTFOUND';
      dnsError.hostname = 'nonexistent.domain.com';
      mockLlmRequestService.forwardRequest.mockRejectedValue(dnsError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          llmId: 'test-llm',
          originalErrorMessage: 'getaddrinfo ENOTFOUND nonexistent.domain.com',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle connection timeout', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://slow.api.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      mockLlmRequestService.forwardRequest.mockRejectedValue(timeoutError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          llmId: 'test-llm',
          originalErrorMessage: 'timeout of 30000ms exceeded',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle connection refused', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'http://localhost:9999/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      const connRefusedError = new Error('connect ECONNREFUSED 127.0.0.1:9999');
      connRefusedError.code = 'ECONNREFUSED';
      connRefusedError.address = '127.0.0.1';
      connRefusedError.port = 9999;
      mockLlmRequestService.forwardRequest.mockRejectedValue(connRefusedError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          llmId: 'test-llm',
          originalErrorMessage: 'connect ECONNREFUSED 127.0.0.1:9999',
        },
        originalStatusCode: 500,
      });
    });
  });

  describe('Downstream LLM Provider Errors', () => {
    test('should handle 401 Unauthorized from LLM provider', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'invalid-api-key',
        source: 'environment',
      });

      const authError = new Error('Request failed with status code 401');
      authError.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: {
          error: {
            message: 'Invalid API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        },
        headers: { 'content-type': 'application/json' },
      };
      mockLlmRequestService.forwardRequest.mockRejectedValue(authError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          llmId: 'test-llm',
          originalErrorMessage: 'Request failed with status code 401',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle 429 Rate Limit from LLM provider', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      const rateLimitError = new Error('Request failed with status code 429');
      rateLimitError.response = {
        status: 429,
        statusText: 'Too Many Requests',
        data: {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
          },
        },
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0',
        },
      };
      mockLlmRequestService.forwardRequest.mockRejectedValue(rateLimitError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          llmId: 'test-llm',
          originalErrorMessage: 'Request failed with status code 429',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle 500 Internal Server Error from LLM provider', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      const serverError = new Error('Request failed with status code 500');
      serverError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: {
          error: 'Internal server error',
        },
      };
      mockLlmRequestService.forwardRequest.mockRejectedValue(serverError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          llmId: 'test-llm',
          originalErrorMessage: 'Request failed with status code 500',
        },
        originalStatusCode: 500,
      });
    });

    test('should handle malformed response from LLM provider', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      const parseError = new Error('Unexpected token < in JSON at position 0');
      parseError.response = {
        status: 200,
        data: '<html><body>Unexpected HTML response</body></html>',
        headers: { 'content-type': 'text/html' },
      };
      mockLlmRequestService.forwardRequest.mockRejectedValue(parseError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        originalStatusCode: 500,
      });
    });
  });

  describe('Internal Proxy Errors', () => {
    test('should handle unexpected internal errors gracefully', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'environment',
      });

      // Simulate an unexpected error in the service
      const unexpectedError = new Error('Unexpected internal error');
      mockLlmRequestService.forwardRequest.mockRejectedValue(unexpectedError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('critical internal error'),
        stage: 'internal_llm_service_exception',
        details: {
          originalErrorMessage: 'Unexpected internal error',
        },
        originalStatusCode: 500,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL - LlmRequestService threw an unexpected exception'
        ),
        expect.objectContaining({
          details: expect.objectContaining({
            originalErrorMessage: 'Unexpected internal error',
          }),
        })
      );
    });

    test('should handle controller method throwing synchronous error', async () => {
      // Replace controller method to throw synchronous error
      controller.handleLlmRequest = jest.fn(() => {
        throw new Error('Synchronous controller error');
      });

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'LLM configuration not found for the provided llmId.',
        stage: 'llm_config_lookup_failed',
        originalStatusCode: 400,
      });
    });
  });

  describe('Error Response Format Validation', () => {
    test('should always include required fields in error response', async () => {
      mockLlmConfigService.getLlmById.mockReturnValue(null);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      // Verify all required fields are present
      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('originalStatusCode');

      // Verify message is a string
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message.length).toBeGreaterThan(0);

      // Verify originalStatusCode matches HTTP status
      expect(response.body.originalStatusCode).toBe(response.status);

      // Verify stage is from allowed enum values if present
      const allowedStages = [
        'request_validation',
        'llm_config_lookup_failed',
        'api_key_retrieval_error',
        'llm_endpoint_resolution_error',
        'llm_forwarding_error_network',
        'llm_forwarding_error_http_client',
        'llm_forwarding_error_http_server',
        'internal_llm_service_exception',
        'initialization_failure_unknown',
      ];

      const stageIsValid =
        !response.body.stage || allowedStages.includes(response.body.stage);
      expect(stageIsValid).toBe(true);
    });

    test('should provide appropriate details object when available', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);

      const specificError = new Error('Specific API key error');
      specificError.code = 'EACCES';
      specificError.path = '/secure/api_key.txt';
      mockApiKeyService.getApiKey.mockRejectedValue(specificError);

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(500);

      expect(response.body.details).toMatchObject({
        originalErrorMessage: 'Specific API key error',
      });
    });
  });
});
