/**
 * @file Integration test to diagnose health check endpoint issues
 * @description Tests the health check endpoints to identify connection issues
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import {
  buildHealthRoutesApp,
  createCacheService,
  createHttpAgentService,
  createOperationalLlmConfigService,
} from '../common/healthRoutesTestUtils.js';

const TEST_PORT = 3002;

describe('Health Check Endpoint Diagnosis', () => {
  let app;
  let server;

  beforeAll((done) => {
    const { app: expressApp } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      cacheService: createCacheService(),
      httpAgentService: createHttpAgentService(),
    });
    app = expressApp;

    server = app.listen(TEST_PORT, 'localhost', () => {
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should respond to basic health check endpoint', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'UP');
    expect(response.body).toHaveProperty('details');
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should respond to readiness check endpoint', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'UP');
    expect(Array.isArray(response.body.details.dependencies)).toBe(true);
  });

  it('should respond to liveness check endpoint', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'UP');
    expect(response.body).toHaveProperty('service', 'llm-proxy-server');
    expect(response.body).toHaveProperty('pid', process.pid);
  });

  it('should respond to detailed health check endpoint', async () => {
    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'UP');
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('environment');
  });

  it('should simulate remote logger health check behavior', async () => {
    const controller = new AbortController();
    let timeoutId;

    try {
      timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://localhost:${TEST_PORT}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'UP');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  });

  it('should test CORS behavior for health check endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:8080')
      .set('User-Agent', 'HealthCheck/1.0');

    expect(response.status).toBe(200);
  });
});
