/**
 * @file Integration test for LLM proxy server startup and availability
 * @description Tests server binding, startup sequence, and endpoint availability
 * @jest-environment node
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');

describe('LLM Proxy Server Startup and Availability - Integration', () => {
  let serverProcess = null;
  const SERVER_PORT = 3002; // Use different port to avoid conflicts
  const SERVER_STARTUP_TIMEOUT = 30000;
  const CONNECTION_TEST_TIMEOUT = 10000;

  beforeAll(async () => {
    // Start the proxy server for testing
    const serverPath = path.join(
      __dirname,
      '../../../llm-proxy-server/src/core/server.js'
    );

    // Set test environment variables
    process.env.PROXY_PORT = SERVER_PORT.toString();
    process.env.PROXY_ALLOWED_ORIGIN =
      'http://localhost:8080,http://127.0.0.1:8080';
    process.env.NODE_ENV = 'test';
    process.env.LLM_CONFIG_PATH = '../config/llm-configs.json';

    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: path.join(__dirname, '../../../llm-proxy-server'),
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Server failed to start within ${SERVER_STARTUP_TIMEOUT}ms`)
        );
      }, SERVER_STARTUP_TIMEOUT);

      let output = '';

      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Check for the actual log message from the server
        if (
          output.includes(
            `LLM Proxy Server listening on port ${SERVER_PORT}`
          ) ||
          output.includes(`listening on port ${SERVER_PORT}`)
        ) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Server process error: ${error.message}`));
      });

      serverProcess.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });

    // Give server additional time to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, SERVER_STARTUP_TIMEOUT + 5000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);

        serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  });

  describe('Server Binding and Startup', () => {
    it('should start successfully and bind to the correct port', async () => {
      // Test basic server availability
      const response = await fetch(`http://localhost:${SERVER_PORT}/health`, {
        method: 'GET',
        timeout: CONNECTION_TEST_TIMEOUT,
      }).catch(() => null);

      // Health endpoint might not exist yet, but server should be running
      // So we expect either a valid response or a 404, not a connection error
      expect(response).not.toBeNull();
    });

    it('should be accessible via both localhost and 127.0.0.1', async () => {
      const endpoints = [
        `http://localhost:${SERVER_PORT}`,
        `http://127.0.0.1:${SERVER_PORT}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${endpoint}/health`, {
            method: 'GET',
            timeout: CONNECTION_TEST_TIMEOUT,
          });

          // We expect either success or 404, not connection refused
          expect([200, 404]).toContain(response.status);
        } catch (error) {
          // If health endpoint doesn't exist, try a basic request to root
          if (error.code === 'ECONNREFUSED') {
            throw new Error(
              `Server not accessible at ${endpoint}: ${error.message}`
            );
          }

          // Try the root endpoint instead
          try {
            const rootResponse = await fetch(`${endpoint}/`, {
              method: 'GET',
              timeout: CONNECTION_TEST_TIMEOUT,
            });

            // Should get some response, even if it's an error
            expect(rootResponse.status).toBeDefined();
          } catch (rootError) {
            if (rootError.code === 'ECONNREFUSED') {
              throw new Error(
                `Server not accessible at ${endpoint}: ${rootError.message}`
              );
            }
          }
        }
      }
    });
  });

  describe('Health Endpoint Availability', () => {
    it('should have health endpoint available at expected URLs', async () => {
      const testEndpoints = [
        `http://localhost:${SERVER_PORT}/health`,
        `http://127.0.0.1:${SERVER_PORT}/health`,
      ];

      for (const endpoint of testEndpoints) {
        const response = await fetch(endpoint, {
          method: 'GET',
          timeout: CONNECTION_TEST_TIMEOUT,
        });

        // Should get a successful response from health endpoint
        expect(response).toBeDefined();
        expect(response.status).toBe(200);
      }
    });

    it('should have readiness endpoint available', async () => {
      const response = await fetch(
        `http://127.0.0.1:${SERVER_PORT}/health/ready`,
        {
          method: 'GET',
          timeout: CONNECTION_TEST_TIMEOUT,
        }
      );

      // Should get a response from readiness endpoint (may be 200 or 503 depending on state)
      expect(response).toBeDefined();
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Metrics Endpoint Availability', () => {
    it('should have metrics endpoint available', async () => {
      const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/metrics`, {
        method: 'GET',
        timeout: CONNECTION_TEST_TIMEOUT,
      });

      // Should get metrics response
      expect(response).toBeDefined();
      expect(response.status).toBe(200);

      // Should return Prometheus format
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toContain('text/plain');
    });
  });

  describe('LLM Request Endpoint Availability', () => {
    it('should have llm-request endpoint available but reject invalid requests', async () => {
      const response = await fetch(
        `http://127.0.0.1:${SERVER_PORT}/api/llm-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:8080',
          },
          body: JSON.stringify({
            // Invalid request - missing required fields
            invalidField: 'test',
          }),
          timeout: CONNECTION_TEST_TIMEOUT,
        }
      );

      // Should get a response (likely 400 for validation error, not connection refused)
      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
      expect([400, 422]).toContain(response.status); // Validation error expected
    });
  });

  describe('Traces Endpoint Availability', () => {
    it('should have traces endpoint available', async () => {
      const response = await fetch(
        `http://127.0.0.1:${SERVER_PORT}/api/traces`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:8080',
          },
          body: JSON.stringify({
            // Basic trace data - may not be valid but should get a response
            action: 'test',
          }),
          timeout: CONNECTION_TEST_TIMEOUT,
        }
      );

      // Should get a response from traces endpoint (not connection refused)
      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
      // Accept any valid HTTP status (endpoint exists and responds)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS properly for allowed origins', async () => {
      const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`, {
        method: 'OPTIONS', // Preflight request
        headers: {
          Origin: 'http://localhost:8080',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type',
        },
        timeout: CONNECTION_TEST_TIMEOUT,
      });

      // OPTIONS requests typically return 200 or 204 No Content for CORS preflight
      expect([200, 204]).toContain(response.status);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });

    it('should be configured with correct CORS origins for API endpoints', async () => {
      // Test CORS configuration with health endpoint (simpler than LLM requests)
      const testOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080'];

      for (const origin of testOrigins) {
        const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/health`, {
          method: 'GET',
          headers: {
            Origin: origin,
          },
          timeout: 5000,
        });

        // Should not get CORS errors for allowed origins
        expect(response.status).not.toBe(403);
        expect(response.status).toBe(200);
      }
    });
  });
});
