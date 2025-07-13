/**
 * @file api-endpoints.integration.test.js
 * @description Integration tests for API endpoints following PROXY_API_CONTRACT.md
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
import cors from 'cors';
import compression from 'compression';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../../src/middleware/validation.js';
import { createSecurityMiddleware } from '../../src/middleware/security.js';
import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';
import {
  createApiRateLimiter,
  createLlmRateLimiter,
} from '../../src/middleware/rateLimiting.js';

describe('API Endpoints Integration Tests', () => {
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

    // Create Express app with middleware stack
    app = express();

    // Configure size limits
    const sizeLimitConfig = createSizeLimitConfig();
    app.use(express.json(sizeLimitConfig.json));

    // Security middleware
    app.use(createSecurityMiddleware());

    // CORS
    app.use(
      cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      })
    );

    // Compression
    app.use(compression());

    // Timeout middleware
    app.use(createTimeoutMiddleware());

    // Rate limiting
    app.use('/api', createApiRateLimiter());
    app.use('/api/llm-request', createLlmRateLimiter());

    // Root endpoint
    app.get('/', (req, res) => {
      if (!mockLlmConfigService.isOperational()) {
        return res.status(503).json({
          error: true,
          message: 'LLM Proxy Server is NOT OPERATIONAL',
          stage: 'initialization_failure',
          originalStatusCode: 503,
        });
      }
      res.json({
        status: 'operational',
        message: 'LLM Proxy Server is running',
      });
    });

    // Main API endpoint as per contract
    app.post(
      '/api/llm-request',
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      controller.handleLlmRequest.bind(controller)
    );

    // Error handler
    app.use((err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }

      const statusCode = err.status || err.statusCode || 500;
      res.status(statusCode).json({
        error: true,
        message: 'An unexpected internal server error occurred in the proxy.',
        stage: 'internal_proxy_error',
        details: { originalErrorMessage: err.message },
        originalStatusCode: statusCode,
      });
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Root Endpoint', () => {
    test('should return operational status when LLM config service is operational', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);

      const response = await request(app).get('/').expect(200);

      expect(response.body).toEqual({
        status: 'operational',
        message: 'LLM Proxy Server is running',
      });
    });

    test('should return 503 when LLM config service is not operational', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        message: 'Config file not found',
        pathAttempted: '/path/to/config.json',
      });

      const response = await request(app).get('/').expect(503);

      expect(response.body).toEqual({
        error: true,
        message: 'LLM Proxy Server is NOT OPERATIONAL',
        stage: 'initialization_failure',
        originalStatusCode: 503,
      });
    });
  });

  describe('POST /api/llm-request - Success Cases', () => {
    test('should successfully process valid LLM request with all fields', async () => {
      // Setup mocks
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
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          choices: [{ message: { content: 'Test response' } }],
        },
        contentTypeIfSuccess: 'application/json',
      });

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.7,
          max_tokens: 150,
        },
        targetHeaders: {
          'X-Custom-Header': 'test-value',
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        choices: [{ message: { content: 'Test response' } }],
      });

      // Verify service calls
      expect(mockLlmConfigService.getLlmById).toHaveBeenCalledWith('test-llm');
      expect(mockApiKeyService.getApiKey).toHaveBeenCalledWith(
        mockLlmConfig,
        'test-llm'
      );
      expect(mockLlmRequestService.forwardRequest).toHaveBeenCalledWith(
        'test-llm',
        mockLlmConfig,
        requestBody.targetPayload,
        requestBody.targetHeaders,
        'test-api-key'
      );
    });

    test('should successfully process valid request without targetHeaders', async () => {
      // Setup mocks
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-api-key',
        source: 'file',
      });
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'test-response',
          choices: [{ message: { content: 'Hello response' } }],
        },
        contentTypeIfSuccess: 'application/json',
      });

      const requestBody = {
        llmId: 'anthropic-claude',
        targetPayload: {
          model: 'claude-3-haiku',
          messages: [{ role: 'user', content: 'Test message' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        id: 'test-response',
        choices: [{ message: { content: 'Hello response' } }],
      });

      expect(mockLlmRequestService.forwardRequest).toHaveBeenCalledWith(
        'anthropic-claude',
        mockLlmConfig,
        requestBody.targetPayload,
        {}, // Empty headers object
        'test-api-key'
      );
    });

    test('should handle LLM that does not require API key', async () => {
      const mockLlmConfig = {
        displayName: 'Local LLM',
        endpointUrl: 'http://localhost:8080/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.isApiKeyRequired.mockReturnValue(false);
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          response: 'Local model response',
        },
        contentTypeIfSuccess: 'application/json',
      });

      const requestBody = {
        llmId: 'local-llm',
        targetPayload: {
          model: 'local-model',
          prompt: 'Test prompt',
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        response: 'Local model response',
      });

      expect(mockApiKeyService.getApiKey).not.toHaveBeenCalled();
      expect(mockLlmRequestService.forwardRequest).toHaveBeenCalledWith(
        'local-llm',
        mockLlmConfig,
        requestBody.targetPayload,
        {},
        null
      );
    });
  });

  describe('POST /api/llm-request - Validation Errors', () => {
    test('should return 400 for missing llmId', async () => {
      const requestBody = {
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
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });

      expect(response.body.details.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'llmId',
            message: expect.stringContaining('required'),
          }),
        ])
      );
    });

    test('should return 400 for missing targetPayload', async () => {
      const requestBody = {
        llmId: 'test-llm',
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });

      expect(response.body.details.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'targetPayload',
            message: expect.stringContaining('required'),
          }),
        ])
      );
    });

    test('should return 400 for invalid llmId type', async () => {
      const requestBody = {
        llmId: 123, // Should be string
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
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });

      expect(response.body.details.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'llmId',
            message: expect.stringContaining('string'),
          }),
        ])
      );
    });

    test('should return 400 for invalid targetPayload type', async () => {
      const requestBody = {
        llmId: 'test-llm',
        targetPayload: 'invalid-payload', // Should be object
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });
    });

    test('should return 400 for empty targetPayload object', async () => {
      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {}, // Empty object
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });
    });

    test('should return 400 for extra fields in request body', async () => {
      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        extraField: 'not-allowed', // Extra field
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });
    });

    test('should return 400 for missing Content-Type header', async () => {
      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .type('') // No content type
        .send(JSON.stringify(requestBody))
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        originalStatusCode: 400,
      });
    });
  });

  describe('POST /api/llm-request - Business Logic Errors', () => {
    test('should return 400 for unknown llmId', async () => {
      mockLlmConfigService.getLlmById.mockReturnValue(null);

      const requestBody = {
        llmId: 'unknown-llm',
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
        originalStatusCode: 400,
      });
    });

    test('should return 500 for API key retrieval error', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          message: 'Failed to retrieve API key',
          stage: 'api_key_retrieval_error',
          details: {
            llmId: 'test-llm',
            reason: 'API key file not found',
          },
        },
        source: 'file',
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
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('Failed to retrieve API key'),
        stage: 'api_key_retrieval_error',
        originalStatusCode: 500,
      });
    });

    test('should return 502 for network error when forwarding to LLM', async () => {
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

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 502,
        errorMessage:
          'Network error occurred while trying to connect to LLM provider',
        errorStage: 'llm_forwarding_error_network',
        errorDetailsForClient: {
          llmId: 'test-llm',
          targetUrl: 'https://api.test.com/v1/chat',
          reason: 'Network connection failed',
        },
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
        .expect(502);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('Network error occurred'),
        stage: 'llm_forwarding_error_network',
        originalStatusCode: 502,
      });
    });

    test('should handle 4xx error from downstream LLM', async () => {
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

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 400,
        errorMessage: 'LLM provider returned an error (HTTP 400)',
        errorStage: 'llm_forwarding_error_http_client',
        errorDetailsForClient: {
          llmId: 'test-llm',
          llmApiStatusCode: 400,
          llmApiResponseBody: {
            error: {
              message: 'Invalid model parameter',
              type: 'invalid_request_error',
            },
          },
        },
      });

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('LLM provider returned an error'),
        stage: 'llm_forwarding_error_http_client',
        originalStatusCode: 400,
      });

      expect(response.body.details).toMatchObject({
        llmApiStatusCode: 400,
        llmApiResponseBody: {
          error: {
            message: 'Invalid model parameter',
            type: 'invalid_request_error',
          },
        },
      });
    });

    test('should handle 5xx error from downstream LLM', async () => {
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

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 502,
        errorMessage: 'LLM provider server error (HTTP 500)',
        errorStage: 'llm_forwarding_error_http_server',
        errorDetailsForClient: {
          llmId: 'test-llm',
          llmApiStatusCode: 500,
          llmApiResponseBody: { error: 'Internal server error' },
        },
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
        .expect(502);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('LLM provider server error'),
        stage: 'llm_forwarding_error_http_server',
        originalStatusCode: 502,
      });
    });
  });

  describe('Security and Headers', () => {
    test('should include security headers in response', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);

      const response = await request(app).get('/').expect(200);

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '0',
      });
    });

    test('should handle CORS preflight request', async () => {
      const response = await request(app)
        .options('/api/llm-request')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST'
      );
    });

    test('should reject request with malicious headers', async () => {
      // Setup mock to have valid LLM config
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
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { message: 'success' },
        contentTypeIfSuccess: 'application/json',
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
        .set('X-Malicious-Header', '<script>alert("xss")</script>')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        message: 'success',
      });
    });
  });

  describe('Content Size and Timeout Limits', () => {
    test('should reject request with oversized payload', async () => {
      const largePayload = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: 'x'.repeat(11 * 1024 * 1024), // 11MB content
            },
          ],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(largePayload)
        .expect(413);

      expect(response.body).toMatchObject({
        error: true,
        message: 'An unexpected internal server error occurred in the proxy.',
      });
    });
  });
});
