/**
 * @file Integration test to diagnose health check endpoint issues
 * @description Tests the health check endpoints to identify connection issues
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../src/routes/healthRoutes.js';

describe('Health Check Endpoint Diagnosis', () => {
  let app;
  let server;
  const TEST_PORT = 3002; // Use different port to avoid conflicts

  beforeAll((done) => {
    // Create minimal Express app with health routes
    app = express();
    app.use('/health', healthRoutes);
    
    server = app.listen(TEST_PORT, 'localhost', () => {
      console.log(`Test server listening on http://localhost:${TEST_PORT}`);
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
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'llm-proxy-server');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  it('should respond to readiness check endpoint', async () => {
    const response = await request(app).get('/health/ready');
    
    // Should return 200 or 503 depending on services availability
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('service', 'llm-proxy-server');
    expect(response.body).toHaveProperty('checks');
  });

  it('should respond to liveness check endpoint', async () => {
    const response = await request(app).get('/health/live');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'alive');
    expect(response.body).toHaveProperty('service', 'llm-proxy-server');
    expect(response.body).toHaveProperty('pid');
  });

  it('should respond to detailed health check endpoint', async () => {
    const response = await request(app).get('/health/detailed');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('environment');
    expect(response.body.system).toHaveProperty('memory');
  });

  it('should simulate remote logger health check behavior', async () => {
    // This simulates what the remote logger does for health checks
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://localhost:${TEST_PORT}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      
    } catch (error) {
      // This should help us understand what's causing the health check failures
      console.error('Health check simulation failed:', error.message);
      throw error;
    }
  });

  it('should test CORS behavior for health check endpoint', async () => {
    // Test if CORS is affecting health check requests
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:8080')
      .set('User-Agent', 'RemoteLogger/1.0');
    
    expect(response.status).toBe(200);
    // Note: CORS headers might not be present since we don't have CORS middleware in this test
    // but the request should still succeed
  });
});