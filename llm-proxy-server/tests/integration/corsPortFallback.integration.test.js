/**
 * @file corsPortFallback.integration.test.js
 * @description Integration tests for CORS configuration handling port fallback scenarios
 * Ensures the LLM proxy server accepts requests from both default port (8080) and fallback port (8081)
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
import { getAppConfigService } from '../../src/config/appConfig.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../../src/middleware/validation.js';

describe('CORS Port Fallback Integration Tests', () => {
  let app;
  let mockLogger;
  let mockLlmConfigService;
  let mockApiKeyService;
  let mockLlmRequestService;
  let controller;
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Set up CORS configuration to include both ports
    process.env.PROXY_ALLOWED_ORIGIN = 
      'http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081';

    // Create mock logger
    mockLogger = new ConsoleLogger();
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'info').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'error').mockImplementation(() => {});

    // Create mock services
    mockLlmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn((llmId) => ({
        llmId: llmId,
        model: 'test-model',
        endpointUrl: 'http://test.example.com/api',
        apiKeyEnvVar: 'TEST_API_KEY',
      })),
    };

    mockApiKeyService = {
      getApiKey: jest.fn(() => Promise.resolve({
        success: true,
        apiKey: 'test-api-key',
      })),
      isApiKeyRequired: jest.fn(() => true),
    };

    mockLlmRequestService = {
      forwardRequest: jest.fn(() => Promise.resolve({
        success: true,
        data: { choices: [{ message: { content: 'test response' } }] },
        status: 200,
      })),
    };

    // Create controller
    controller = new LlmRequestController(
      mockLogger,
      mockLlmConfigService,
      mockApiKeyService,
      mockLlmRequestService
    );

    // Create Express app with CORS configuration
    app = express();
    
    // Get app config and CORS origins
    const appConfigService = getAppConfigService(mockLogger);
    const allowedOriginsArray = appConfigService.getAllowedOriginsArray();

    if (allowedOriginsArray.length > 0) {
      const corsOptions = {
        origin: allowedOriginsArray,
        methods: ['POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-Title', 'HTTP-Referer'],
      };
      app.use(cors(corsOptions));
    }

    app.use(express.json());
    app.post(
      '/api/llm-request',
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      (req, res) => controller.handleLlmRequest(req, res)
    );
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  /**
   * Test CORS preflight (OPTIONS) requests from default port 8080
   */
  test('should handle CORS preflight from localhost:8080', async () => {
    const response = await request(app)
      .options('/api/llm-request')
      .set('Origin', 'http://localhost:8080')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  /**
   * Test CORS preflight (OPTIONS) requests from 127.0.0.1:8080
   */
  test('should handle CORS preflight from 127.0.0.1:8080', async () => {
    const response = await request(app)
      .options('/api/llm-request')
      .set('Origin', 'http://127.0.0.1:8080')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8080');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  /**
   * Test CORS preflight (OPTIONS) requests from fallback port 8081
   */
  test('should handle CORS preflight from localhost:8081 (fallback port)', async () => {
    const response = await request(app)
      .options('/api/llm-request')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  /**
   * Test CORS preflight (OPTIONS) requests from 127.0.0.1:8081 (fallback port)
   */
  test('should handle CORS preflight from 127.0.0.1:8081 (fallback port)', async () => {
    const response = await request(app)
      .options('/api/llm-request')
      .set('Origin', 'http://127.0.0.1:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8081');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  /**
   * Test actual POST request from default port 8080
   */
  test('should handle POST request from localhost:8080', async () => {
    const requestBody = {
      llmId: 'test-llm',
      targetPayload: {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test message' }],
      },
      targetHeaders: {},
    };

    const response = await request(app)
      .post('/api/llm-request')
      .set('Origin', 'http://localhost:8080')
      .set('Content-Type', 'application/json')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    expect(mockLlmRequestService.forwardRequest).toHaveBeenCalled();
  });

  /**
   * Test actual POST request from fallback port 8081
   */
  test('should handle POST request from 127.0.0.1:8081 (fallback port)', async () => {
    const requestBody = {
      llmId: 'test-llm',
      targetPayload: {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test message' }],
      },
      targetHeaders: {},
    };

    const response = await request(app)
      .post('/api/llm-request')
      .set('Origin', 'http://127.0.0.1:8081')
      .set('Content-Type', 'application/json')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8081');
    expect(mockLlmRequestService.forwardRequest).toHaveBeenCalled();
  });

  /**
   * Test that unauthorized origins are still blocked
   */
  test('should block requests from unauthorized origins', async () => {
    const requestBody = {
      llmId: 'test-llm',
      targetPayload: {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test message' }],
      },
      targetHeaders: {},
    };

    const response = await request(app)
      .post('/api/llm-request')
      .set('Origin', 'http://malicious.example.com')
      .set('Content-Type', 'application/json')
      .send(requestBody);

    // CORS should block this - no Access-Control-Allow-Origin header should be present
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  /**
   * Test that requests without restricted origins still work (non-browser requests)
   */
  test('should handle requests without Origin header (server-to-server)', async () => {
    const requestBody = {
      llmId: 'test-llm',
      targetPayload: {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test message' }],
      },
      targetHeaders: {},
    };

    const response = await request(app)
      .post('/api/llm-request')
      .set('Content-Type', 'application/json')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(mockLlmRequestService.forwardRequest).toHaveBeenCalled();
  });

  /**
   * Test configuration validation - ensure both ports are in allowed origins
   */
  test('should have both default and fallback ports in CORS configuration', () => {
    const appConfigService = getAppConfigService(mockLogger);
    const allowedOrigins = appConfigService.getAllowedOriginsArray();

    expect(allowedOrigins).toContain('http://localhost:8080');
    expect(allowedOrigins).toContain('http://127.0.0.1:8080');
    expect(allowedOrigins).toContain('http://localhost:8081');
    expect(allowedOrigins).toContain('http://127.0.0.1:8081');
  });
});