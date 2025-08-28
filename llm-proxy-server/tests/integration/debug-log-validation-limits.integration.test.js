/**
 * @file Integration tests for debug log validation limits
 * @description Tests that reproduce validation limit issues causing HTTP 400/413 errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createSizeLimitConfig } from '../../src/middleware/timeout.js';
import debugRoutes from '../../src/routes/debugRoutes.js';

describe('Debug Log Validation Limits Integration', () => {
  let app;

  beforeEach(() => {
    app = express();

    // Apply the same middleware as the main server
    const sizeLimits = createSizeLimitConfig();
    app.use(express.json(sizeLimits.json));

    // Mount debug routes
    app.use('/api/debug-log', debugRoutes);
  });

  describe('Current Validation Limit Issues', () => {
    it('should accept 1001 log entries (old limit was 1000)', async () => {
      // Generate 1001 log entries which should now be accepted with new 5000 limit
      const logs = Array.from({ length: 1001 }, (_, i) => ({
        level: 'debug',
        message: `Test log message ${i}`,
        timestamp: new Date().toISOString(),
        category: 'test',
        source: 'test.js:1',
        sessionId: '12345678-1234-4234-8234-123456789012', // Valid UUID v4
        metadata: { index: i },
      }));

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        processed: 1001,
      });
    });

    it('should accept exactly 5000 log entries (new limit)', async () => {
      // Generate exactly 5000 log entries (new limit)
      const logs = Array.from({ length: 5000 }, (_, i) => ({
        level: 'debug',
        message: `Test log message ${i}`,
        timestamp: new Date().toISOString(),
        category: 'test',
      }));

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        processed: 5000,
      });
    });

    it('should reproduce HTTP 400 error with exactly 5001 log entries', async () => {
      // Generate exactly 5001 log entries to exceed new limit
      const logs = Array.from({ length: 5001 }, (_, i) => ({
        level: 'debug',
        message: `Test log message ${i}`,
        timestamp: new Date().toISOString(),
        category: 'test',
      }));

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining(
          'logs array cannot contain more than 5000 entries'
        ),
        stage: 'request_validation',
      });
    });

    it('should reproduce HTTP 413 error with payload exceeding 1MB', async () => {
      // Generate logs with large messages to exceed default 1MB limit
      const largeMessage = 'x'.repeat(2000); // 2KB per message
      const logs = Array.from({ length: 600 }, (_, i) => ({
        level: 'debug',
        message: `${largeMessage} - Large message ${i}`,
        timestamp: new Date().toISOString(),
        category: 'test',
        metadata: {
          largeData: 'y'.repeat(1000), // Additional 1KB
          index: i,
        },
      }));

      // This should be roughly 600 * 3KB = ~1.8MB, exceeding 1MB limit
      const requestSize = JSON.stringify({ logs }).length;
      expect(requestSize).toBeGreaterThan(1024 * 1024); // > 1MB

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(413);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('too large'),
      });
    });

    it('should handle empty logs array properly', async () => {
      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs: [] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('logs array cannot be empty'),
      });
    });

    it('should handle missing logs field', async () => {
      const response = await request(app)
        .post('/api/debug-log/')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('logs field is required'),
      });
    });

    it('should handle invalid log entry structure', async () => {
      const logs = [
        'invalid-log-entry', // String instead of object
        { level: 'debug' }, // Missing required fields
        null, // Null entry
      ];

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(400);

      expect(response.body.error).toBe(true);
    });
  });

  describe('Real-World Scenarios from Error Logs', () => {
    it('should reproduce the 1027 entry scenario from error logs', async () => {
      // Simulate the exact scenario from error_logs.txt
      const logs = Array.from({ length: 1027 }, (_, i) => ({
        level: 'debug',
        message: `composeDescription: Processing descriptorType: ${i % 4 === 0 ? 'height' : i % 4 === 1 ? 'build' : i % 4 === 2 ? 'body_composition' : 'body_hair'}`,
        timestamp: new Date(Date.now() + i).toISOString(),
        category: 'ui',
        source: 'bodyDescriptionComposer.js:96',
        sessionId: 'game-session-123',
        metadata: {
          entity: 'p_erotica:garazi_ibarrola_instance',
          descriptorType: i % 4 === 0 ? 'height' : 'build',
        },
      }));

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(400);

      expect(response.body).toMatchObject({
        error: true,
        message: expect.stringContaining('more than 1000 entries'),
      });
    });

    it('should reproduce the 9605 entry scenario from error logs', async () => {
      // Simulate the large batch scenario from error_logs.txt
      const logs = Array.from({ length: 9605 }, (_, i) => ({
        level: 'debug',
        message:
          i < 5000
            ? `validateAgainstSchema: Validating data ${i}`
            : `fetchContent: Processing file ${i - 5000}`,
        timestamp: new Date(Date.now() + i * 10).toISOString(),
        category: i < 5000 ? 'validation' : 'initialization',
        source:
          i < 5000
            ? 'schemaValidationUtils.js:73'
            : 'baseManifestItemLoader.js:376',
        sessionId: 'game-session-456',
      }));

      // This will definitely exceed both the 1000 entry limit AND the 1MB size limit
      const requestSize = JSON.stringify({ logs }).length;
      expect(requestSize).toBeGreaterThan(1024 * 1024); // > 1MB
      expect(logs.length).toBeGreaterThan(1000); // > 1000 entries

      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs });

      // Could be either 400 (validation) or 413 (size), both are expected
      expect([400, 413]).toContain(response.status);
    });
  });

  describe('Performance Impact Testing', () => {
    it('should measure processing time for large valid batches', async () => {
      const logs = Array.from({ length: 1000 }, (_, i) => ({
        level: 'debug',
        message: `Performance test message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/debug-log/')
        .send({ logs })
        .expect(200);

      const processingTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    });

    it('should handle concurrent requests without degradation', async () => {
      const createBatch = (batchId) =>
        Array.from({ length: 500 }, (_, i) => ({
          level: 'info',
          message: `Concurrent batch ${batchId} message ${i}`,
          timestamp: new Date().toISOString(),
        }));

      // Send 5 concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/debug-log/')
          .send({ logs: createBatch(i) })
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.processed).toBe(500);
      });
    });
  });
});
