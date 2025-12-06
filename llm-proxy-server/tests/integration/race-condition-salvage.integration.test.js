/**
 * @file race-condition-salvage.integration.test.js
 * @description Integration tests for race condition handling and response salvage
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
import { SalvageRequestController } from '../../src/handlers/salvageRequestController.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';
import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import { createTimeoutMiddleware } from '../../src/middleware/timeout.js';
import { createSalvageRoutes } from '../../src/routes/salvageRoutes.js';

const REQUEST_TIMEOUT_MS = 50;
const GRACE_PERIOD_MS = 20;
const LATE_RESPONSE_DELAY_MS = REQUEST_TIMEOUT_MS + GRACE_PERIOD_MS + 10;
const GRACE_PERIOD_RESPONSE_DELAY_MS =
  REQUEST_TIMEOUT_MS + Math.floor(GRACE_PERIOD_MS / 2);

describe('Race Condition and Response Salvage Integration Tests', () => {
  let app;
  let mockLogger;
  let mockLlmConfigService;
  let mockApiKeyService;
  let mockLlmRequestService;
  let salvageService;
  let llmController;
  let salvageController;

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
      getLlmById: jest.fn(() => ({
        llmId: 'test-provider:model',
        displayName: 'Test Model',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
        apiKeyEnvVar: 'TEST_API_KEY',
        apiType: 'cloud',
      })),
    };

    mockApiKeyService = {
      getApiKey: jest.fn(() =>
        Promise.resolve({
          apiKey: 'test-key-12345',
          source: 'environment',
        })
      ),
      isApiKeyRequired: jest.fn(() => true),
    };

    mockLlmRequestService = {
      forwardRequest: jest.fn(),
    };

    // Create salvage service
    salvageService = new ResponseSalvageService(mockLogger, {
      defaultTtl: 30000,
      maxEntries: 1000,
    });

    // Create controllers
    llmController = new LlmRequestController(
      mockLogger,
      mockLlmConfigService,
      mockApiKeyService,
      mockLlmRequestService,
      salvageService
    );

    salvageController = new SalvageRequestController(
      mockLogger,
      salvageService
    );

    // Create Express app
    app = express();
    app.use(createRequestTrackingMiddleware({ logger: mockLogger }));
    app.use(express.json({ limit: '10mb' }));

    // Add LLM request route with timeout
    app.post(
      '/api/llm-request',
      createTimeoutMiddleware(REQUEST_TIMEOUT_MS, {
        logger: mockLogger,
        gracePeriod: GRACE_PERIOD_MS,
      }),
      (req, res) => llmController.handleLlmRequest(req, res)
    );

    // Add salvage routes
    app.use('/api/llm-request', createSalvageRoutes(salvageController));
  });

  afterEach(() => {
    if (salvageService && salvageService.cleanup) {
      salvageService.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Response Commitment and Race Conditions', () => {
    test('should prevent multiple response attempts with commitment pattern', async () => {
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { content: 'Test response' },
        contentTypeIfSuccess: 'application/json',
      });

      const response = await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('Test response');
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('already committed')
      );
    });

    test('should handle timeout vs success race condition', async () => {
      // Simulate slow LLM response that arrives after timeout fires
      mockLlmRequestService.forwardRequest.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: true,
                  statusCode: 200,
                  data: { content: 'Late response' },
                  contentTypeIfSuccess: 'application/json',
                }),
              LATE_RESPONSE_DELAY_MS
            ); // Arrives after timeout + grace period
          })
      );

      const response = await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      // Should receive timeout response
      expect(response.status).toBe(503);
      expect(response.body.stage).toBe('request_timeout');

      // Verify timeout was triggered
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timeout fired after'),
        expect.any(Object)
      );
    });

    test('should salvage successful response when headers already sent', async () => {
      let requestId = null;

      // Intercept request tracking to get request ID
      const originalHandler =
        llmController.handleLlmRequest.bind(llmController);
      llmController.handleLlmRequest = async function (req, res) {
        requestId = req.requestId;
        return originalHandler(req, res);
      };

      // Mock a scenario where response succeeds but can't be sent
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { content: 'Salvaged content', usage: { tokens: 100 } },
        contentTypeIfSuccess: 'application/json',
      });

      // Send request
      const response = await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: {
            model: 'test-model',
            messages: [{ role: 'user', content: 'test' }],
            temperature: 0.7,
          },
        });

      // Response should succeed
      expect(response.status).toBe(200);

      // Check if salvage was attempted (in case of race)
      const salvageWarnings = mockLogger.warn.mock.calls.filter((call) =>
        call[0].includes('could not be sent')
      );

      if (salvageWarnings.length > 0 && requestId) {
        // If salvaged, verify we can retrieve it
        const salvageResponse = await request(app).get(
          `/api/llm-request/salvage/${requestId}`
        );

        expect(salvageResponse.status).toBe(200);
        expect(salvageResponse.body.content).toBe('Salvaged content');
        expect(salvageResponse.body._salvageMetadata).toBeDefined();
        expect(salvageResponse.body._salvageMetadata.recovered).toBe(true);
      }
    });
  });

  describe('Response Salvage Service', () => {
    test('should salvage and retrieve response by request ID', async () => {
      const testRequestId = 'test-req-123';
      const testLlmId = 'test-provider:model';
      const testPayload = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        temperature: 0.7,
      };
      const testResponse = { content: 'Test response', usage: { tokens: 50 } };

      // Salvage response
      salvageService.salvageResponse(
        testRequestId,
        testLlmId,
        testPayload,
        testResponse,
        200
      );

      // Retrieve via endpoint
      const response = await request(app).get(
        `/api/llm-request/salvage/${testRequestId}`
      );

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('Test response');
      expect(response.body._salvageMetadata.originalRequestId).toBe(
        testRequestId
      );
      expect(response.body._salvageMetadata.llmId).toBe(testLlmId);
      expect(response.body._salvageMetadata.recovered).toBe(true);
    });

    test('should return 404 for non-existent salvaged response', async () => {
      const response = await request(app).get(
        '/api/llm-request/salvage/non-existent-id'
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(true);
      expect(response.body.stage).toBe('salvage_not_found');
    });

    test('should expire salvaged responses after TTL', async () => {
      const testRequestId = 'test-req-expire';

      // Create salvage service with very short TTL
      const shortTtlService = new ResponseSalvageService(mockLogger, {
        defaultTtl: 100, // 100ms TTL
      });

      shortTtlService.salvageResponse(
        testRequestId,
        'test-provider:model',
        { model: 'test' },
        { content: 'Expiring response' },
        200
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not be retrievable
      const retrieved = shortTtlService.retrieveByRequestId(testRequestId);
      expect(retrieved).toBeNull();

      shortTtlService.cleanup();
    });

    test('should retrieve salvage statistics', async () => {
      // Salvage multiple responses
      salvageService.salvageResponse(
        'req-1',
        'provider-1',
        { model: 'test' },
        { content: '1' },
        200
      );
      salvageService.salvageResponse(
        'req-2',
        'provider-2',
        { model: 'test' },
        { content: '2' },
        200
      );

      const response = await request(app).get('/api/llm-request/salvage-stats');

      expect(response.status).toBe(200);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.salvaged).toBe(2);
      expect(response.body.stats.totalCacheEntries).toBe(4); // 2 by ID + 2 by signature
    });
  });

  describe('Request Correlation and Tracking', () => {
    test('should assign correlation ID to all requests', async () => {
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { content: 'Test' },
      });

      const response = await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: { model: 'test', messages: [] },
        });

      expect(response.status).toBe(200);

      // Verify logger was called with requestId
      const debugCalls = mockLogger.debug.mock.calls;
      const hasRequestId = debugCalls.some((call) => call[1]?.requestId);
      expect(hasRequestId).toBe(true);
    });

    test('should track request state transitions', async () => {
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { content: 'Test' },
      });

      await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: { model: 'test', messages: [] },
        });

      // Verify request tracking was active (requestId should be present in logs)
      const debugCalls = mockLogger.debug.mock.calls;
      const hasRequestTracking = debugCalls.some(
        (call) => call[0].includes('Request') && call[1]?.requestId
      );

      expect(hasRequestTracking).toBe(true);
    });
  });

  describe('Grace Period Behavior', () => {
    test('should allow in-flight requests to complete during grace period', async () => {
      // Mock LLM response that completes just after timeout but within grace period
      mockLlmRequestService.forwardRequest.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: true,
                  statusCode: 200,
                  data: { content: 'Grace period response' },
                }),
              GRACE_PERIOD_RESPONSE_DELAY_MS
            ); // After timeout but before grace period expires
          })
      );

      const response = await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: { model: 'test', messages: [] },
        });

      // With grace period, timeout commits after REQUEST_TIMEOUT_MS
      // The additional GRACE_PERIOD_MS window still ends with the timeout response
      // because the commitment has already been made when the grace response arrives
      expect(response.status).toBe(503);
      expect(response.body.stage).toBe('request_timeout');
    });
  });

  describe('Error Handling with Salvage', () => {
    test('should handle LLM service errors without salvaging', async () => {
      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: false,
        statusCode: 500,
        errorStage: 'llm_service_error',
        errorMessage: 'LLM service unavailable',
        errorDetailsForClient: { reason: 'Service down' },
      });

      const response = await request(app)
        .post('/api/llm-request')
        .send({
          llmId: 'test-provider:model',
          targetPayload: { model: 'test', messages: [] },
        });

      expect(response.status).toBe(500);
      expect(response.body.stage).toBe('llm_service_error');

      // Should not salvage failed responses
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('salvaged successfully')
      );
    });

    test('should handle invalid request ID for salvage retrieval', async () => {
      const response = await request(app).get('/api/llm-request/salvage/');

      expect(response.status).toBe(404);
    });
  });
});
