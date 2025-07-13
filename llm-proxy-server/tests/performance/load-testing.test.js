/**
 * @file load-testing.test.js
 * @description Load testing and stress testing for the LLM proxy server
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../../src/middleware/validation.js';
import rateLimit from 'express-rate-limit';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// Mock fetch globally for HTTP requests
global.fetch = jest.fn();

describe('Load Testing', () => {
  let app;
  let mockLogger;
  let mockLlmConfigService;
  let mockApiKeyService;
  let mockLlmRequestService;
  let controller;

  beforeEach(() => {
    // Create mock logger
    mockLogger = createMockLogger();

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

    // Create Express app with middleware
    app = express();
    app.use(express.json({ limit: '50mb' }));

    // Add rate limiting for load testing
    const rateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 1000, // Very high limit for load testing
      message: 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.post(
      '/api/llm-request',
      rateLimiter,
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      controller.handleLlmRequest.bind(controller)
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Concurrent Request Handling', () => {
    test('should handle 100 concurrent requests efficiently', async () => {
      const mockLlmConfig = {
        displayName: 'Load Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-load-test-key',
        source: 'environment',
      });

      // Mock different response times to simulate real conditions
      mockLlmRequestService.forwardRequest.mockImplementation(
        () =>
          new Promise(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    success: true,
                    statusCode: 200,
                    data: {
                      id: 'test-response',
                      choices: [{ message: { content: 'Load test response' } }],
                    },
                    contentTypeIfSuccess: 'application/json',
                  }),
                Math.random() * 100 + 50
              ) // 50-150ms delay
          )
      );

      const requestBody = {
        llmId: 'load-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Load test message' }],
        },
      };

      // Create 100 concurrent requests
      const requests = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .post('/api/llm-request')
          .send({
            ...requestBody,
            targetPayload: {
              ...requestBody.targetPayload,
              messages: [{ role: 'user', content: `Load test message ${i}` }],
            },
          })
          .expect(200)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const averageResponseTime = totalTime / 100;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('choices');
      });

      // Performance expectations
      expect(totalTime).toBeLessThan(5000); // All requests complete within 5 seconds
      expect(averageResponseTime).toBeLessThan(200); // Average under 200ms per request

      mockLogger.info('Concurrent Load Test Results:', {
        totalRequests: 100,
        totalTime: `${totalTime}ms`,
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`,
        requestsPerSecond: (100 / (totalTime / 1000)).toFixed(2),
      });
    });

    test('should handle burst traffic patterns', async () => {
      const mockLlmConfig = {
        displayName: 'Burst Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-burst-test-key',
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'burst-response',
          choices: [{ message: { content: 'Burst test response' } }],
        },
        contentTypeIfSuccess: 'application/json',
      });

      const requestBody = {
        llmId: 'burst-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Burst test message' }],
        },
      };

      // Simulate burst pattern: quiet periods followed by high traffic
      const burstPatterns = [
        { requests: 50, delay: 0 }, // Immediate burst
        { requests: 10, delay: 500 }, // Small burst after delay
        { requests: 30, delay: 100 }, // Medium burst
        { requests: 20, delay: 200 }, // Final burst
      ];

      const allResults = [];

      for (const pattern of burstPatterns) {
        await new Promise((resolve) => setTimeout(resolve, pattern.delay));

        const burstStart = Date.now();
        const burstRequests = Array.from({ length: pattern.requests }, () =>
          request(app).post('/api/llm-request').send(requestBody).expect(200)
        );

        const burstResponses = await Promise.all(burstRequests);
        const burstEnd = Date.now();

        allResults.push({
          requests: pattern.requests,
          time: burstEnd - burstStart,
          successRate:
            burstResponses.filter((r) => r.status === 200).length /
            pattern.requests,
        });
      }

      // All bursts should handle successfully
      allResults.forEach((result) => {
        expect(result.successRate).toBe(1); // 100% success rate
        expect(result.time).toBeLessThan(3000); // Each burst under 3 seconds
      });

      mockLogger.info('Burst Traffic Test Results:', allResults);
    });

    test('should maintain performance under sustained load', async () => {
      const mockLlmConfig = {
        displayName: 'Sustained Load LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-sustained-test-key',
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'sustained-response',
          choices: [{ message: { content: 'Sustained test response' } }],
        },
        contentTypeIfSuccess: 'application/json',
      });

      const requestBody = {
        llmId: 'sustained-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Sustained test message' }],
        },
      };

      // Perform sustained load test: multiple waves of requests
      const waves = 5;
      const requestsPerWave = 20;
      const waveResults = [];

      for (let wave = 0; wave < waves; wave++) {
        const waveStart = Date.now();

        const waveRequests = Array.from({ length: requestsPerWave }, (_, i) =>
          request(app)
            .post('/api/llm-request')
            .send({
              ...requestBody,
              targetPayload: {
                ...requestBody.targetPayload,
                messages: [
                  { role: 'user', content: `Wave ${wave}, Request ${i}` },
                ],
              },
            })
            .expect(200)
        );

        const waveResponses = await Promise.all(waveRequests);
        const waveEnd = Date.now();

        waveResults.push({
          wave,
          time: waveEnd - waveStart,
          requests: requestsPerWave,
          successRate:
            waveResponses.filter((r) => r.status === 200).length /
            requestsPerWave,
        });

        // Small delay between waves
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Performance should not degrade over time
      const firstWaveTime = waveResults[0].time;
      const lastWaveTime = waveResults[waves - 1].time;
      const performanceDegradation =
        (lastWaveTime - firstWaveTime) / firstWaveTime;

      // All waves should succeed
      waveResults.forEach((result) => {
        expect(result.successRate).toBe(1);
        expect(result.time).toBeLessThan(2000);
      });

      // Performance degradation should be minimal (under 50%)
      expect(performanceDegradation).toBeLessThan(0.5);

      mockLogger.info('Sustained Load Test Results:', {
        waves,
        requestsPerWave,
        waveResults,
        performanceDegradation: `${(performanceDegradation * 100).toFixed(1)}%`,
      });
    });
  });

  describe('Error Handling Under Load', () => {
    test('should handle mixed success/failure scenarios gracefully', async () => {
      const mockLlmConfig = {
        displayName: 'Mixed Results LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-mixed-test-key',
        source: 'environment',
      });

      // Mock service to return success 70% of the time, various errors 30%
      mockLlmRequestService.forwardRequest.mockImplementation(() => {
        const random = Math.random();
        if (random < 0.7) {
          return Promise.resolve({
            success: true,
            statusCode: 200,
            data: {
              id: 'success-response',
              choices: [{ message: { content: 'Success response' } }],
            },
            contentTypeIfSuccess: 'application/json',
          });
        } else if (random < 0.85) {
          const error = new Error('Simulated network error');
          error.code = 'ECONNREFUSED';
          return Promise.reject(error);
        } else {
          const error = new Error('Simulated API error');
          error.response = { status: 429, data: { error: 'Rate limited' } };
          return Promise.reject(error);
        }
      });

      const requestBody = {
        llmId: 'mixed-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Mixed test message' }],
        },
      };

      // Send 100 requests and analyze results
      const requests = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .post('/api/llm-request')
          .send({
            ...requestBody,
            targetPayload: {
              ...requestBody.targetPayload,
              messages: [{ role: 'user', content: `Mixed test ${i}` }],
            },
          })
      );

      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const endTime = Date.now();

      // Analyze response distribution
      const results = {
        success: 0,
        networkError: 0,
        apiError: 0,
        other: 0,
      };

      responses.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 200) {
            results.success++;
          } else if (result.value.status === 500) {
            // All service errors come back as 500 due to exception handling
            const errorMessage =
              result.value.body?.details?.originalErrorMessage || '';
            if (
              errorMessage.includes('network') ||
              errorMessage.includes('ECONNREFUSED')
            ) {
              results.networkError++;
            } else if (
              errorMessage.includes('429') ||
              errorMessage.includes('Rate limited')
            ) {
              results.apiError++;
            } else {
              results.other++;
            }
          } else {
            results.other++;
          }
        }
      });

      const totalTime = endTime - startTime;

      // Should handle errors gracefully without crashing
      expect(results.success).toBeGreaterThan(60); // At least 60% success
      expect(
        results.success +
          results.networkError +
          results.apiError +
          results.other
      ).toBe(100);
      expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds

      mockLogger.info('Mixed Load Test Results:', {
        totalRequests: 100,
        totalTime: `${totalTime}ms`,
        results,
        successRate: `${results.success}%`,
      });
    });

    test('should handle API key failures under load', async () => {
      const mockLlmConfig = {
        displayName: 'API Key Failure LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);

      // Mock API key service to fail intermittently
      mockApiKeyService.getApiKey.mockImplementation(() => {
        if (Math.random() < 0.8) {
          return Promise.resolve({
            apiKey: 'sk-intermittent-key',
            source: 'environment',
          });
        } else {
          return Promise.resolve({
            errorDetails: {
              stage: 'api_key_retrieval_error',
              message: 'API key file not found',
              details: { reason: 'Simulated file not found' },
            },
          });
        }
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'key-failure-response',
          choices: [{ message: { content: 'Success with valid key' } }],
        },
        contentTypeIfSuccess: 'application/json',
      });

      const requestBody = {
        llmId: 'key-failure-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'API key test' }],
        },
      };

      // Test with 50 concurrent requests
      const requests = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .post('/api/llm-request')
          .send({
            ...requestBody,
            targetPayload: {
              ...requestBody.targetPayload,
              messages: [{ role: 'user', content: `Key test ${i}` }],
            },
          })
      );

      const responses = await Promise.allSettled(requests);

      const results = {
        success: 0,
        keyError: 0,
        other: 0,
      };

      responses.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 200) {
            results.success++;
          } else if (
            result.value.status === 500 &&
            result.value.body.stage?.includes('api_key')
          ) {
            results.keyError++;
          } else {
            results.other++;
          }
        }
      });

      // Should handle key errors gracefully
      expect(results.success).toBeGreaterThan(30); // At least 60% success rate expected
      expect(results.keyError).toBeGreaterThan(5); // Some key errors expected
      expect(results.success + results.keyError + results.other).toBe(50);

      mockLogger.info('API Key Failure Load Test Results:', {
        totalRequests: 50,
        results,
        successRate: `${((results.success / 50) * 100).toFixed(1)}%`,
        keyErrorRate: `${((results.keyError / 50) * 100).toFixed(1)}%`,
      });
    });
  });

  describe('Large Payload Handling', () => {
    test('should handle large request payloads efficiently', async () => {
      const mockLlmConfig = {
        displayName: 'Large Payload LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-large-payload-key',
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'large-payload-response',
          choices: [
            { message: { content: 'Large payload processed successfully' } },
          ],
        },
        contentTypeIfSuccess: 'application/json',
      });

      // Create payloads of different sizes
      const payloadSizes = [
        { size: '1KB', content: 'Small payload. '.repeat(50) },
        { size: '10KB', content: 'Medium payload. '.repeat(500) },
        { size: '100KB', content: 'Large payload. '.repeat(5000) },
        { size: '1MB', content: 'Very large payload. '.repeat(50000) },
      ];

      const results = [];

      for (const payload of payloadSizes) {
        const requestBody = {
          llmId: 'large-payload-llm',
          targetPayload: {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: payload.content }],
          },
        };

        const startTime = Date.now();
        const response = await request(app)
          .post('/api/llm-request')
          .send(requestBody)
          .expect(200);
        const endTime = Date.now();

        results.push({
          size: payload.size,
          time: endTime - startTime,
          success: response.status === 200,
        });
      }

      // All payloads should be processed successfully
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.time).toBeLessThan(5000); // Under 5 seconds even for large payloads
      });

      mockLogger.info('Large Payload Test Results:', results);
    });

    test('should handle concurrent large payloads', async () => {
      const mockLlmConfig = {
        displayName: 'Concurrent Large Payload LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-concurrent-large-key',
        source: 'environment',
      });

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          id: 'concurrent-large-response',
          choices: [
            { message: { content: 'Concurrent large payload processed' } },
          ],
        },
        contentTypeIfSuccess: 'application/json',
      });

      // Create 20 concurrent requests with moderately large payloads
      const largeContent = 'Large concurrent payload content. '.repeat(1000); // ~35KB each

      const requests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/llm-request')
          .send({
            llmId: 'concurrent-large-llm',
            targetPayload: {
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'user', content: `${largeContent} Request ${i}` },
              ],
            },
          })
          .expect(200)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const averageResponseTime = totalTime / 20;

      // All large payload requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should handle concurrent large payloads efficiently
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds total
      expect(averageResponseTime).toBeLessThan(1000); // Under 1 second average

      mockLogger.info('Concurrent Large Payload Results:', {
        totalRequests: 20,
        payloadSizeEach: '~35KB',
        totalTime: `${totalTime}ms`,
        averageResponseTime: `${averageResponseTime.toFixed(2)}ms`,
      });
    });
  });

  describe('Resource Exhaustion Testing', () => {
    test('should handle resource exhaustion gracefully', async () => {
      const mockLlmConfig = {
        displayName: 'Resource Exhaustion LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-exhaustion-test-key',
        source: 'environment',
      });

      // Mock service to simulate resource exhaustion after some requests
      let requestCount = 0;
      mockLlmRequestService.forwardRequest.mockImplementation(() => {
        requestCount++;
        if (requestCount <= 150) {
          return Promise.resolve({
            success: true,
            statusCode: 200,
            data: {
              id: `exhaustion-response-${requestCount}`,
              choices: [{ message: { content: `Response ${requestCount}` } }],
            },
            contentTypeIfSuccess: 'application/json',
          });
        } else {
          const error = new Error('Service temporarily unavailable');
          error.response = {
            status: 503,
            data: { error: 'Service overloaded' },
          };
          return Promise.reject(error);
        }
      });

      const requestBody = {
        llmId: 'exhaustion-test-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Exhaustion test' }],
        },
      };

      // Send 200 requests to trigger exhaustion
      const requests = Array.from({ length: 200 }, (_, i) =>
        request(app)
          .post('/api/llm-request')
          .send({
            ...requestBody,
            targetPayload: {
              ...requestBody.targetPayload,
              messages: [{ role: 'user', content: `Exhaustion test ${i}` }],
            },
          })
      );

      const responses = await Promise.allSettled(requests);

      const results = {
        success: 0,
        serviceUnavailable: 0,
        other: 0,
      };

      responses.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 200) {
            results.success++;
          } else if (result.value.status === 500) {
            results.serviceUnavailable++;
          } else {
            results.other++;
          }
        }
      });

      // Should handle exhaustion gracefully with proper error responses
      expect(results.success).toBeGreaterThan(140); // Most initial requests succeed
      expect(results.serviceUnavailable).toBeGreaterThan(40); // Later requests fail gracefully
      expect(results.success + results.serviceUnavailable + results.other).toBe(
        200
      );

      mockLogger.info('Resource Exhaustion Test Results:', {
        totalRequests: 200,
        results,
        successRate: `${((results.success / 200) * 100).toFixed(1)}%`,
        exhaustionThreshold: 150,
      });
    });
  });
});
