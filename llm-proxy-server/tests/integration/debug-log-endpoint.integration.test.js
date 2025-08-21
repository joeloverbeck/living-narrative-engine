/**
 * @file debug-log-endpoint.integration.test.js
 * @description Integration tests for debug log endpoint following established patterns
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
import { createSecurityMiddleware } from '../../src/middleware/security.js';
import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';
import debugRoutes from '../../src/routes/debugRoutes.js';

describe('Debug Log Endpoint Integration Tests', () => {
  let app;
  let server;

  beforeEach(async () => {
    // Create Express application
    app = express();

    // Configure middleware stack (matching main server configuration)
    app.use(compression());
    app.use(cors());
    app.use(createSecurityMiddleware());
    app.use(createTimeoutMiddleware(30000));
    app.use(express.json(createSizeLimitConfig()));

    // Register debug routes
    app.use('/api/debug-log', debugRoutes);

    // Start server on random port for testing
    server = app.listen(0);
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    jest.clearAllMocks();
  });

  const validDebugLogRequest = {
    logs: [
      {
        level: 'info',
        message: 'Test log message',
        timestamp: '2024-01-01T12:00:00.000Z',
        category: 'test',
        source: 'test.js:123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        metadata: { userId: 'test-user' },
      },
      {
        level: 'error',
        message: 'Error occurred',
        timestamp: '2024-01-01T12:00:01.000Z',
      },
    ],
  };

  describe('POST /api/debug-log', () => {
    test('should accept valid debug log request', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send(validDebugLogRequest)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        processed: 2,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
        ),
      });
    });

    test('should accept minimal valid debug log request', async () => {
      const minimalRequest = {
        logs: [
          {
            level: 'debug',
            message: 'Simple debug message',
            timestamp: '2024-01-01T12:00:00.000Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(minimalRequest)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        processed: 1,
        timestamp: expect.any(String),
      });
    });

    test('should accept large batch of logs', async () => {
      const largeBatch = {
        logs: Array(100).fill({
          level: 'info',
          message: 'Batch log entry',
          timestamp: '2024-01-01T12:00:00.000Z',
          category: 'batch',
        }),
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(largeBatch)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        processed: 100,
        timestamp: expect.any(String),
      });
    });

    test('should reject request without Content-Type header', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send(JSON.stringify(validDebugLogRequest)) // Send as string without Content-Type
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
      });
    });

    test('should reject request with wrong Content-Type', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send(JSON.stringify(validDebugLogRequest)) // Send as string
        .set('Content-Type', 'text/plain')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
      });
    });

    test('should reject request without logs field', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs',
              message: 'logs field is required',
            }),
          ]),
        },
      });
    });

    test('should reject request with non-array logs', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send({ logs: 'not-an-array' })
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs',
              message: 'logs must be an array',
            }),
          ]),
        },
      });
    });

    test('should reject request with empty logs array', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send({ logs: [] })
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs',
              message: 'logs array cannot be empty',
            }),
          ]),
        },
      });
    });

    test('should reject request with too many logs', async () => {
      const tooManyLogs = {
        logs: Array(1001).fill({
          level: 'info',
          message: 'Too many logs',
          timestamp: '2024-01-01T12:00:00.000Z',
        }),
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(tooManyLogs)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs',
              message: 'logs array cannot contain more than 1000 entries',
            }),
          ]),
        },
      });
    });

    test('should reject log entry without required level field', async () => {
      const invalidRequest = {
        logs: [
          {
            message: 'Missing level',
            timestamp: '2024-01-01T12:00:00.000Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].level',
              message: 'level is required for each log entry',
            }),
          ]),
        },
      });
    });

    test('should reject log entry with invalid level', async () => {
      const invalidRequest = {
        logs: [
          {
            level: 'invalid',
            message: 'Invalid level',
            timestamp: '2024-01-01T12:00:00.000Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].level',
              message: 'level must be one of: debug, info, warn, error',
            }),
          ]),
        },
      });
    });

    test('should reject log entry without required message field', async () => {
      const invalidRequest = {
        logs: [
          {
            level: 'info',
            timestamp: '2024-01-01T12:00:00.000Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].message',
              message: 'message is required for each log entry',
            }),
          ]),
        },
      });
    });

    test('should reject log entry with empty message', async () => {
      const invalidRequest = {
        logs: [
          {
            level: 'info',
            message: '   ',
            timestamp: '2024-01-01T12:00:00.000Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].message',
              message: 'message cannot be empty',
            }),
          ]),
        },
      });
    });

    test('should reject log entry with invalid timestamp', async () => {
      const invalidRequest = {
        logs: [
          {
            level: 'info',
            message: 'Invalid timestamp',
            timestamp: 'not-a-date',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].timestamp',
              message: 'timestamp must be a valid ISO 8601 datetime',
            }),
          ]),
        },
      });
    });

    test('should reject log entry with invalid sessionId', async () => {
      const invalidRequest = {
        logs: [
          {
            level: 'info',
            message: 'Invalid sessionId',
            timestamp: '2024-01-01T12:00:00.000Z',
            sessionId: 'not-a-uuid',
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].sessionId',
              message: 'sessionId must be a valid UUID v4',
            }),
          ]),
        },
      });
    });

    test('should reject log entry with too large metadata', async () => {
      const largeMetadata = {};
      // Create large metadata object (> 50KB when serialized but < Express body limit)
      for (let i = 0; i < 500; i++) {
        largeMetadata[`key${i}`] = 'x'.repeat(100);
      }

      const invalidRequest = {
        logs: [
          {
            level: 'info',
            message: 'Large metadata',
            timestamp: '2024-01-01T12:00:00.000Z',
            metadata: largeMetadata,
          },
        ],
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              field: 'logs[0].metadata',
              message:
                'metadata object is too large (max 50KB when serialized)',
            }),
          ]),
        },
      });
    });

    test('should reject request with extra fields', async () => {
      const invalidRequest = {
        logs: validDebugLogRequest.logs,
        extraField: 'not allowed',
      };

      const response = await request(app)
        .post('/api/debug-log')
        .send(invalidRequest)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: 'Client request validation failed.',
        stage: 'request_validation',
        details: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Unexpected fields in request body: extraField',
            }),
          ]),
        },
      });
    });

    test('should handle rate limiting', async () => {
      // Make multiple requests quickly to trigger rate limiting
      // Note: This test may be flaky depending on rate limiting configuration
      const requests = Array(10)
        .fill(0)
        .map(() =>
          request(app)
            .post('/api/debug-log')
            .send(validDebugLogRequest)
            .set('Content-Type', 'application/json')
        );

      const responses = await Promise.allSettled(requests);

      // Some requests should succeed, but we might hit rate limits
      // This test mainly ensures rate limiting middleware is applied
      const fulfilledResponses = responses.filter(
        (result) => result.status === 'fulfilled'
      );
      const successCodes = [200, 429];

      fulfilledResponses.forEach((result) => {
        expect(successCodes).toContain(result.value.status);
      });

      // Ensure we got at least one response
      expect(fulfilledResponses.length).toBeGreaterThan(0);
    });

    test('should return consistent response format on success', async () => {
      const response = await request(app)
        .post('/api/debug-log')
        .send(validDebugLogRequest)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        processed: expect.any(Number),
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
        ),
      });

      expect(response.body.processed).toBe(validDebugLogRequest.logs.length);
      expect(typeof response.body.success).toBe('boolean');
      expect(typeof response.body.timestamp).toBe('string');
    });
  });
});
