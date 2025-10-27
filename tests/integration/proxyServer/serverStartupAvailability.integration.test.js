/**
 * @file Integration test for LLM proxy server startup and availability
 * @description Tests server binding, startup sequence, and endpoint availability
 * @jest-environment node
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
/**
 * Waits for a server readiness endpoint to respond without connection errors.
 * @param {string} url - Endpoint to poll for readiness.
 * @param {object} options - Polling configuration.
 * @param {number} options.timeoutMs - Total time to wait before failing.
 * @param {number} [options.intervalMs=100] - Delay between polls in milliseconds.
 */
async function waitForReadiness(url, { timeoutMs, intervalMs = 100 }) {
  const deadline = Date.now() + timeoutMs;
  /** @type {Error | null} */
  let lastError = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() >= deadline) {
      const message =
        lastError && lastError.message
          ? `: ${lastError.message}`
          : '';
      throw new Error(`Timed out waiting for readiness${message}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok || response.status === 503) {
        return;
      }
      lastError = new Error(
        `Unexpected status code while waiting for readiness: ${response.status}`
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('LLM Proxy Server Startup and Availability - Integration', () => {
  /** @type {{ stop: () => Promise<void>; start: () => Promise<void> } | null} */
  let proxyController = null;
  const SERVER_PORT = 3002; // Use different port to avoid conflicts
  const SERVER_STARTUP_TIMEOUT = 30000;
  const CONNECTION_TEST_TIMEOUT = 10000;

  beforeAll(async () => {
    // Set test environment variables
    process.env.PROXY_PORT = SERVER_PORT.toString();
    process.env.PROXY_ALLOWED_ORIGIN =
      'http://localhost:8080,http://127.0.0.1:8080';
    process.env.NODE_ENV = 'test';
    process.env.LLM_CONFIG_PATH = '../config/llm-configs.json';
    process.env.METRICS_ENABLED = 'false';
    process.env.METRICS_COLLECT_DEFAULT = 'false';
    process.env.RATE_LIMITING_ENABLED = 'false';

    const { createProxyServer } = await import(
      '../../../llm-proxy-server/src/core/server.js'
    );

    proxyController = createProxyServer({
      metricsEnabled: false,
      collectDefaultMetrics: false,
      rateLimitingEnabled: false,
    });

    await proxyController.start();
    await waitForReadiness(
      `http://127.0.0.1:${SERVER_PORT}/health/ready`,
      {
        timeoutMs: SERVER_STARTUP_TIMEOUT,
        intervalMs: 100,
      }
    );
  }, SERVER_STARTUP_TIMEOUT + 5000);

  afterAll(async () => {
    if (proxyController) {
      await proxyController.stop();
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

      await Promise.all(
        endpoints.map(async (endpoint) => {
          try {
            const response = await fetch(`${endpoint}/health`, {
              method: 'GET',
              timeout: CONNECTION_TEST_TIMEOUT,
            });

            // We expect either success or 404, not connection refused
            expect([200, 404]).toContain(response.status);
          } catch (error) {
            if (error.code === 'ECONNREFUSED') {
              throw new Error(
                `Server not accessible at ${endpoint}: ${error.message}`
              );
            }

            const rootResponse = await fetch(`${endpoint}/`, {
              method: 'GET',
              timeout: CONNECTION_TEST_TIMEOUT,
            });

            expect(rootResponse.status).toBeDefined();
          }
        })
      );
    });
  });

  describe('Health Endpoint Availability', () => {
    it('should have health endpoint available at expected URLs', async () => {
      const testEndpoints = [
        `http://localhost:${SERVER_PORT}/health`,
        `http://127.0.0.1:${SERVER_PORT}/health`,
      ];

      await Promise.all(
        testEndpoints.map(async (endpoint) => {
          const response = await fetch(endpoint, {
            method: 'GET',
            timeout: CONNECTION_TEST_TIMEOUT,
          });

          // Should get a successful response from health endpoint
          expect(response).toBeDefined();
          expect(response.status).toBe(200);
        })
      );
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

      await Promise.all(
        testOrigins.map(async (origin) => {
          const response = await fetch(
            `http://127.0.0.1:${SERVER_PORT}/health`,
            {
              method: 'GET',
              headers: {
                Origin: origin,
              },
              timeout: 5000,
            }
          );

          // Should not get CORS errors for allowed origins
          expect(response.status).not.toBe(403);
          expect(response.status).toBe(200);
        })
      );
    });
  });
});
