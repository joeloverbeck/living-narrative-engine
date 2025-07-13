/**
 * @file api-contract.integration.test.js
 * @description Integration tests that verify PROXY_API_CONTRACT.md compliance
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

describe('API Contract Integration Tests', () => {
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

    // Create simple Express app
    app = express();
    app.use(express.json());

    // Add the main endpoint
    app.post('/api/llm-request', async (req, res) => {
      await controller.handleLlmRequest(req, res);
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Request Format Compliance (Section 1.2)', () => {
    test('should accept valid request with all required fields', async () => {
      // Setup successful response
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
      });

      const requestBody = {
        llmId: 'openrouter-claude3-haiku-json-schema',
        targetPayload: {
          model: 'anthropic/claude-3-haiku-20240307',
          messages: [
            {
              role: 'user',
              content: 'Generate a description for a fantasy character.',
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'character_description',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
        },
        targetHeaders: {
          'HTTP-Referer': 'https://yourgame.com',
          'X-Title': 'My Awesome Text Adventure',
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        choices: [{ message: { content: 'Test response' } }],
      });

      // Verify correct service calls
      expect(mockLlmConfigService.getLlmById).toHaveBeenCalledWith(
        'openrouter-claude3-haiku-json-schema'
      );
      expect(mockApiKeyService.getApiKey).toHaveBeenCalledWith(
        mockLlmConfig,
        'openrouter-claude3-haiku-json-schema'
      );
      expect(mockLlmRequestService.forwardRequest).toHaveBeenCalledWith(
        'openrouter-claude3-haiku-json-schema',
        mockLlmConfig,
        requestBody.targetPayload,
        requestBody.targetHeaders,
        'test-api-key'
      );
    });

    test('should accept valid request with only required fields', async () => {
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
          id: 'test-response',
          choices: [{ message: { content: 'Hello response' } }],
        },
      });

      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        // No targetHeaders - should default to empty object
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
        'test-llm',
        mockLlmConfig,
        requestBody.targetPayload,
        {}, // Empty headers
        'test-api-key'
      );
    });

    test('should reject request missing required llmId field', async () => {
      const requestBody = {
        // Missing llmId
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
        message: expect.stringContaining('llmId is required'),
        stage: expect.stringMatching(/request_validation/),
        originalStatusCode: 400,
      });
    });

    test('should reject request missing required targetPayload field', async () => {
      const requestBody = {
        llmId: 'test-llm',
        // Missing targetPayload
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('targetPayload'),
        stage: expect.stringMatching(/request_validation/),
        originalStatusCode: 400,
      });
    });
  });

  describe('Error Response Format Compliance (Section 2.1)', () => {
    test('should return proper error format for llm_config_lookup_error', async () => {
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

      // Verify response follows contract schema
      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('originalStatusCode', 400);
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message.length).toBeGreaterThan(0);

      // Verify stage is from allowed enum
      expect(response.body.stage).toMatch(/llm_config_lookup/);

      // Verify details object provides useful information
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toMatchObject({
        requestedLlmId: 'nonexistent-llm',
      });
    });

    test('should return proper error format for api_key_retrieval_error', async () => {
      const mockLlmConfig = {
        displayName: 'Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        errorDetails: {
          stage: 'api_key_retrieval_error',
          message:
            'Failed to retrieve API key for the requested LLM configuration.',
          details: {
            llmId: 'test-llm',
            originalErrorMessage: 'API key file not found',
          },
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
        .expect(500);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('API key'),
        stage: expect.stringMatching(/api_key_retrieval/),
        originalStatusCode: 500,
      });

      expect(response.body.details).toMatchObject({
        llmId: 'test-llm',
      });
    });

    test('should return proper error format for llm_forwarding_error_network', async () => {
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
        errorStage: 'llm_forwarding_error_network',
        errorMessage: 'Network error while attempting to reach LLM provider.',
        errorDetailsForClient: {
          llmId: 'test-llm',
          targetUrl: 'https://api.test.com/v1/chat',
          originalProxiedErrorMessage: 'ECONNREFUSED',
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
        message: expect.stringContaining('Network error'),
        stage: expect.stringMatching(/llm_forwarding_error_network/),
        originalStatusCode: 502,
      });

      expect(response.body.details).toMatchObject({
        llmId: 'test-llm',
        targetUrl: 'https://api.test.com/v1/chat',
      });
    });

    test('should return proper error format for llm_forwarding_error_http_client', async () => {
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
        errorStage: 'llm_forwarding_error_http_client',
        errorMessage:
          'LLM provider returned an error indicating a problem with the request.',
        errorDetailsForClient: {
          llmId: 'openai-gpt-4o',
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
        llmId: 'openai-gpt-4o',
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
        llmId: 'openai-gpt-4o',
        llmApiStatusCode: 400,
        llmApiResponseBody: {
          error: {
            message: 'Invalid model parameter',
            type: 'invalid_request_error',
          },
        },
      });
    });

    test('should return proper error format for llm_forwarding_error_http_server', async () => {
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
        errorStage: 'llm_forwarding_error_http_server',
        errorMessage: 'LLM provider server error (5xx status code).',
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

    test('should return proper error format for initialization_failure', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        message: 'Configuration file not found',
        stage: 'initialization_failure',
        details: {
          pathAttempted: '/config/llm-configs.json',
          code: 'ENOENT',
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
        .expect(503);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('Configuration file not found'),
        stage: expect.stringMatching(/initialization/),
        originalStatusCode: 503,
      });

      expect(response.body.details).toMatchObject({
        pathAttempted: '/config/llm-configs.json',
        code: 'ENOENT',
      });
    });
  });

  describe('Stage Enum Compliance (Section 2.1)', () => {
    const allowedStages = [
      'request_validation',
      'llm_config_lookup_failed',
      'api_key_retrieval_error',
      'llm_endpoint_resolution_error',
      'llm_forwarding_error_network',
      'llm_forwarding_error_http_client',
      'llm_forwarding_error_http_server',
      'internal_proxy_error',
      'initialization_failure',
    ];

    test('should only return allowed stage enum values', async () => {
      // Test various error scenarios to ensure stage compliance
      const testCases = [
        {
          name: 'Missing llmId',
          setup: () => {},
          request: { targetPayload: { model: 'test' } },
          expectedStatus: 400,
        },
        {
          name: 'Unknown llmId',
          setup: () => mockLlmConfigService.getLlmById.mockReturnValue(null),
          request: { llmId: 'unknown', targetPayload: { model: 'test' } },
          expectedStatus: 400,
        },
        {
          name: 'Service not operational',
          setup: () => {
            mockLlmConfigService.isOperational.mockReturnValue(false);
            mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
              message: 'Test error',
              stage: 'initialization_failure',
            });
          },
          request: { llmId: 'test', targetPayload: { model: 'test' } },
          expectedStatus: 503,
        },
      ];

      for (const testCase of testCases) {
        testCase.setup();

        const response = await request(app)
          .post('/api/llm-request')
          .send(testCase.request)
          .expect(testCase.expectedStatus);

        // Verify stage is in allowed list if present
        const hasStage = !!response.body.stage;
        const stageIsAllowed =
          !hasStage ||
          allowedStages.some(
            (allowed) =>
              response.body.stage.includes(allowed) ||
              allowed.includes(response.body.stage)
          );

        // Stage should be allowed if it exists
        expect(stageIsAllowed).toBe(true);

        jest.clearAllMocks();
        // Reset mocks to default state for next test
        mockLlmConfigService.isOperational.mockReturnValue(true);
        mockLlmConfigService.getInitializationErrorDetails.mockReturnValue(
          null
        );
      }
    });
  });

  describe('Response Headers and Security', () => {
    test('should return JSON content type for all responses', async () => {
      mockLlmConfigService.getLlmById.mockReturnValue(null);

      const response = await request(app)
        .post('/api/llm-request')
        .send({ llmId: 'test', targetPayload: {} })
        .expect(400);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should handle large request payloads within limits', async () => {
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
          choices: [{ message: { content: 'Response' } }],
        },
      });

      const largeContent = 'This is a long prompt. '.repeat(1000); // ~23KB
      const requestBody = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: largeContent }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        choices: [{ message: { content: 'Response' } }],
      });
    });
  });

  describe('Error Response Completeness', () => {
    test('should always include all required error fields', async () => {
      mockLlmConfigService.getLlmById.mockReturnValue(null);

      const response = await request(app)
        .post('/api/llm-request')
        .send({ llmId: 'test', targetPayload: {} })
        .expect(400);

      // Required fields per contract
      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('originalStatusCode');

      // Type validation
      expect(typeof response.body.error).toBe('boolean');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.originalStatusCode).toBe('number');

      // Content validation
      expect(response.body.error).toBe(true);
      expect(response.body.message.length).toBeGreaterThan(0);
      expect(response.body.originalStatusCode).toBe(response.status);

      // Optional fields should have correct types when present
      const stageType = response.body.stage
        ? typeof response.body.stage
        : 'string';
      const detailsType = response.body.details
        ? typeof response.body.details
        : 'object';

      expect(stageType).toBe('string');
      expect(detailsType).toBe('object');
    });
  });
});
