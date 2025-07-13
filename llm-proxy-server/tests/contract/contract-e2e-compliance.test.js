/**
 * @file contract-e2e-compliance.test.js
 * @description End-to-end contract compliance tests validating full request/response cycles
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
import {
  contractValidator,
  contractMatchers,
} from './contract-validation-utils.js';

// Add custom matchers
expect.extend(contractMatchers);

describe('Contract E2E Compliance Tests', () => {
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

    // Create Express app with full middleware stack
    app = express();
    app.use(express.json({ limit: '10mb' }));

    app.post(
      '/api/llm-request',
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      (req, res) => {
        controller.handleLlmRequest(req, res).catch((error) => {
          // Log the error for debugging
          console.error('Controller error:', error);
          res.status(500).json({
            error: true,
            message:
              'An unexpected internal server error occurred in the proxy.',
            stage: 'internal_proxy_error',
            details: { originalErrorMessage: error.message },
            originalStatusCode: 500,
          });
        });
      }
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Request/Response Contract Compliance', () => {
    test('should handle successful request with contract-compliant input and validate response format', async () => {
      const mockLlmConfig = {
        displayName: 'Contract Test LLM',
        endpointUrl: 'https://api.contract-test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-key-value',
        errorDetails: null,
        source: 'environment',
      });

      const successResponse = {
        id: 'chatcmpl-contract-test',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-3.5-turbo-0613',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a contract-compliant response.',
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

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: successResponse,
      });

      // Test with contract-valid request
      const contractValidRequest = {
        llmId: 'contract-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Contract test message' }],
          temperature: 0.7,
          max_tokens: 100,
        },
        targetHeaders: {
          'X-Test': 'contract-compliance',
        },
      };

      // Validate request against contract before sending
      expect(contractValidRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(contractValidRequest)
        .expect(200);

      // Validate response structure
      expect(response.body).toEqual(successResponse);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      // Verify security requirements
      expect(response.body).toMeetSecurityRequirements();

      // Verify service calls with contract-valid data
      expect(mockLlmConfigService.getLlmById).toHaveBeenCalledWith(
        'contract-test-llm'
      );
      expect(mockApiKeyService.getApiKey).toHaveBeenCalledWith(
        mockLlmConfig,
        'contract-test-llm'
      );
      expect(mockLlmRequestService.forwardRequest).toHaveBeenCalledWith(
        'contract-test-llm',
        mockLlmConfig,
        contractValidRequest.targetPayload,
        contractValidRequest.targetHeaders,
        'test-key-value'
      );
    });

    test('should handle complex contract-valid requests with JSON schema responses', async () => {
      const mockLlmConfig = {
        displayName: 'OpenRouter JSON Schema LLM',
        endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'openrouter-test-key',
        errorDetails: null,
        source: 'environment',
      });

      const jsonSchemaResponse = {
        id: 'chatcmpl-json-schema',
        object: 'chat.completion',
        created: 1687123456,
        model: 'anthropic/claude-3-haiku',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                '{"name": "Elara Moonwhisper", "description": "A mystical elven ranger with silver hair and emerald eyes."}',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 28,
          total_tokens: 73,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: jsonSchemaResponse,
      });

      // Contract example from PROXY_API_CONTRACT.md
      const contractExampleRequest = {
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

      // Validate request against contract
      expect(contractExampleRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(contractExampleRequest)
        .expect(200);

      expect(response.body).toEqual(jsonSchemaResponse);
      expect(response.body).toMeetSecurityRequirements();

      // Verify the JSON content can be parsed and matches expected structure
      const parsedContent = JSON.parse(
        response.body.choices[0].message.content
      );
      expect(parsedContent).toHaveProperty('name');
      expect(parsedContent).toHaveProperty('description');
    });
  });

  describe('Error Response Contract Compliance (Section 2.1)', () => {
    test('should return contract-compliant error for missing llmId', async () => {
      const invalidRequest = {
        // Missing llmId field
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
        },
      };

      // Verify request is invalid according to contract
      expect(invalidRequest).not.toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(invalidRequest)
        .expect(400);

      // Validate error response against contract
      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      // Validate specific error fields
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('validation failed');
      expect(response.body.originalStatusCode).toBe(400);
      expect(response.body.stage).toBe('request_validation');

      // Validate status code is appropriate for validation errors
      const statusValidation = contractValidator.validateStatusCodeForStage(
        response.body.originalStatusCode,
        'request_validation'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should return contract-compliant error for missing targetPayload', async () => {
      const invalidRequest = {
        llmId: 'test-llm',
        // Missing targetPayload field
      };

      expect(invalidRequest).not.toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('validation failed');
      expect(response.body.originalStatusCode).toBe(400);
      expect(response.body.stage).toBe('request_validation');
    });

    test('should return contract-compliant error for unknown llmId', async () => {
      mockLlmConfigService.getLlmById.mockReturnValue(null);

      const validRequest = {
        llmId: 'nonexistent-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
        },
      };

      // Request is contract-valid but llmId doesn't exist
      expect(validRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(400);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('configuration not found');
      expect(response.body.stage).toContain('llm_config_lookup');
      expect(response.body.originalStatusCode).toBe(400);
      expect(response.body.details).toHaveProperty(
        'requestedLlmId',
        'nonexistent-llm'
      );

      // Validate status code for this error stage
      const statusValidation = contractValidator.validateStatusCodeForStage(
        response.body.originalStatusCode,
        'llm_config_lookup_failed'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should return contract-compliant error for API key retrieval failure', async () => {
      const mockLlmConfig = {
        displayName: 'API Key Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: null,
        errorDetails: {
          stage: 'api_key_retrieval_error',
          message: 'Key file not found',
          details: {
            llmId: 'api-key-test-llm',
            reason: 'File does not exist',
          },
        },
        source: null,
      });

      const validRequest = {
        llmId: 'api-key-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
        },
      };

      expect(validRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(500);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Key file not found');
      expect(response.body.stage).toContain('api_key_retrieval');
      expect(response.body.originalStatusCode).toBe(500);
      expect(response.body.details).toHaveProperty('llmId');

      // Validate status code for this error stage
      const statusValidation = contractValidator.validateStatusCodeForStage(
        response.body.originalStatusCode,
        'api_key_retrieval_error'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should return contract-compliant error for LLM forwarding network error', async () => {
      const mockLlmConfig = {
        displayName: 'Network Test LLM',
        endpointUrl: 'https://unreachable.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'network-test-key',
        errorDetails: null,
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 502,
        errorMessage:
          'Network error occurred while trying to connect to LLM provider',
        errorStage: 'llm_forwarding_error_network',
        errorDetailsForClient: {
          llmId: 'network-test-llm',
          reason: 'Connection refused to LLM provider endpoint',
        },
      });

      const validRequest = {
        llmId: 'network-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test network error' }],
        },
      };

      expect(validRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(502);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Network error');
      expect(response.body.stage).toContain('network');
      expect(response.body.originalStatusCode).toBe(502);

      // Validate status code for network errors
      const statusValidation = contractValidator.validateStatusCodeForStage(
        response.body.originalStatusCode,
        'llm_forwarding_error_network'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should return contract-compliant error for LLM HTTP client error', async () => {
      const mockLlmConfig = {
        displayName: 'HTTP Client Error LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'http-error-test-key',
        errorDetails: null,
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 400,
        errorMessage: 'LLM provider returned an error (HTTP 400)',
        errorStage: 'llm_forwarding_error_http_client',
        errorDetailsForClient: {
          llmId: 'http-error-test-llm',
          reason: 'Invalid model parameter',
          llmApiStatusCode: 400,
          llmApiResponseBody: {
            error: {
              message: 'Invalid model parameter',
              type: 'invalid_request_error',
            },
          },
        },
      });

      const validRequest = {
        llmId: 'http-error-test-llm',
        targetPayload: {
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'Test HTTP error' }],
        },
      };

      expect(validRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(400);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('LLM provider returned an error');
      expect(response.body.stage).toContain('http_client');
      expect(response.body.originalStatusCode).toBe(400);

      // Validate status code for HTTP client errors
      const statusValidation = contractValidator.validateStatusCodeForStage(
        response.body.originalStatusCode,
        'llm_forwarding_error_http_client'
      );
      expect(statusValidation.isValid).toBe(true);
    });

    test('should return contract-compliant error for proxy not operational', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        stage: 'initialization_failure',
        message: 'Configuration file not found',
        details: {
          pathAttempted: '/config/llm-configs.json',
          code: 'ENOENT',
        },
      });

      const validRequest = {
        llmId: 'test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test initialization error' }],
        },
      };

      expect(validRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(503);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('Configuration file not found');
      expect(response.body.stage).toContain('initialization');
      expect(response.body.originalStatusCode).toBe(503);
      expect(response.body.details).toHaveProperty('pathAttempted');

      // Validate status code for initialization errors
      const statusValidation = contractValidator.validateStatusCodeForStage(
        response.body.originalStatusCode,
        'initialization_failure'
      );
      expect(statusValidation.isValid).toBe(true);
    });
  });

  describe('HTTP Headers and Content-Type Compliance', () => {
    test('should return proper JSON content-type for successful responses', async () => {
      const mockLlmConfig = {
        displayName: 'Content Type Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'content-type-test-key',
        errorDetails: null,
        source: 'environment',
      });
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { choices: [{ message: { content: 'Response' } }] },
      });

      const validRequest = {
        llmId: 'content-type-test',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should return proper JSON content-type for error responses', async () => {
      const invalidRequest = {
        llmId: 'test-llm',
        // Missing targetPayload
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(invalidRequest)
        .expect(400);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toMatchErrorResponseContract();
    });

    test('should handle large request payloads within contract limits', async () => {
      const mockLlmConfig = {
        displayName: 'Large Payload LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'large-payload-test-key',
        errorDetails: null,
        source: 'environment',
      });
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          choices: [{ message: { content: 'Large payload processed' } }],
        },
      });

      const largeContent = 'Large test content. '.repeat(1000); // ~19KB
      const largeRequest = {
        llmId: 'large-payload-test',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: largeContent }],
          metadata: {
            description: 'Large payload test',
            additionalData: Array.from({ length: 100 }, (_, i) => `item-${i}`),
          },
        },
        targetHeaders: {
          'X-Large-Payload': 'true',
          'X-Content-Size': '19kb',
        },
      };

      // Validate large request against contract
      expect(largeRequest).toMatchRequestContract();

      const response = await request(app)
        .post('/api/llm-request')
        .send(largeRequest)
        .expect(200);

      expect(response.body).toMeetSecurityRequirements();
    });
  });

  describe('Security Contract Compliance', () => {
    test('should never expose API keys in successful responses', async () => {
      const mockLlmConfig = {
        displayName: 'Security Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'security-test-key-value',
        errorDetails: null,
        source: 'environment',
      });
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'security-test-response',
          choices: [{ message: { content: 'Secure response' } }],
        },
      });

      const validRequest = {
        llmId: 'security-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Security test' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(200);

      expect(response.body).toMeetSecurityRequirements();

      // Specifically check that no security-sensitive data is in response
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('security-test-key-value');
    });

    test('should never expose API keys in error responses', async () => {
      const mockLlmConfig = {
        displayName: 'Security Error Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'security-error-test-key',
        errorDetails: null,
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 502,
        errorMessage:
          'Network error occurred while trying to connect to LLM provider',
        errorStage: 'llm_forwarding_error_network',
        errorDetailsForClient: {
          llmId: 'security-error-test',
          reason: 'Connection failed to LLM provider endpoint',
        },
      });

      const validRequest = {
        llmId: 'security-error-test',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Security error test' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(502);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      // Specifically check that no security-sensitive data is in error response
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('security-error-test-key');
    });

    test('should not expose sensitive configuration in error details', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        stage: 'initialization_failure',
        message: 'Configuration loading failed',
        details: {
          reason: 'File access error',
          // Note: No sensitive paths or configuration exposed
        },
      });

      const validRequest = {
        llmId: 'config-security-test',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Config security test' }],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(validRequest)
        .expect(503);

      expect(response.body).toMatchErrorResponseContract();
      expect(response.body).toMeetSecurityRequirements();

      // Verify no sensitive configuration paths are exposed
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toMatch(/\/etc\//);
      expect(responseStr).not.toMatch(/\.env/);
      expect(responseStr).not.toMatch(/secret/i);
      expect(responseStr).not.toMatch(/password/i);
    });
  });

  describe('Contract Stability and Versioning', () => {
    test('should maintain consistent error response format across different error types', async () => {
      const errorScenarios = [
        {
          name: 'Missing llmId',
          request: { targetPayload: { model: 'test' } },
          expectedStatus: 400,
        },
        {
          name: 'Unknown llmId',
          request: { llmId: 'unknown', targetPayload: { model: 'test' } },
          setup: () => mockLlmConfigService.getLlmById.mockReturnValue(null),
          expectedStatus: 400,
        },
        {
          name: 'Service not operational',
          request: { llmId: 'test', targetPayload: { model: 'test' } },
          setup: () => {
            mockLlmConfigService.isOperational.mockReturnValue(false);
            mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
              stage: 'initialization_failure',
              message: 'Service unavailable',
              details: {},
            });
          },
          expectedStatus: 503,
        },
      ];

      for (const scenario of errorScenarios) {
        if (scenario.setup) {
          scenario.setup();
        }

        const response = await request(app)
          .post('/api/llm-request')
          .send(scenario.request)
          .expect(scenario.expectedStatus);

        // All error responses must follow the same contract
        expect(response.body).toMatchErrorResponseContract();
        expect(response.body).toMeetSecurityRequirements();

        // All must have the required fields
        expect(response.body).toHaveProperty('error', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty(
          'originalStatusCode',
          scenario.expectedStatus
        );

        // Reset mocks for next scenario
        jest.clearAllMocks();
        mockLlmConfigService.isOperational.mockReturnValue(true);
        mockLlmConfigService.getInitializationErrorDetails.mockReturnValue(
          null
        );
      }
    });

    test('should validate that all contract examples work with current implementation', async () => {
      // Test the exact example from PROXY_API_CONTRACT.md
      const contractExampleRequest = {
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

      // Verify the example is contract-compliant
      expect(contractExampleRequest).toMatchRequestContract();

      // Test that the example would work (simulate success)
      const mockLlmConfig = {
        displayName: 'OpenRouter Claude 3 Haiku JSON Schema',
        endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'openrouter-example-key',
        errorDetails: null,
        source: 'environment',
      });
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'contract-example-response',
          choices: [
            {
              message: {
                content:
                  '{"name": "Example Character", "description": "Contract example character"}',
              },
            },
          ],
        },
      });

      const response = await request(app)
        .post('/api/llm-request')
        .send(contractExampleRequest)
        .expect(200);

      expect(response.body).toMeetSecurityRequirements();
    });
  });
});
