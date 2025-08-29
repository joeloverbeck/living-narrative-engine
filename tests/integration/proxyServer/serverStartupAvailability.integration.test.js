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
    const serverPath = path.join(__dirname, '../../../llm-proxy-server/src/core/server.js');
    
    // Set test environment variables
    process.env.PROXY_PORT = SERVER_PORT.toString();
    process.env.PROXY_ALLOWED_ORIGIN = 'http://localhost:8080,http://127.0.0.1:8080';
    process.env.NODE_ENV = 'test';
    
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: path.join(__dirname, '../../../llm-proxy-server')
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Server failed to start within ${SERVER_STARTUP_TIMEOUT}ms`));
      }, SERVER_STARTUP_TIMEOUT);

      let output = '';
      
      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Check for the actual log message from the server
        if (output.includes(`LLM Proxy Server listening on port ${SERVER_PORT}`) || 
            output.includes(`listening on port ${SERVER_PORT}`)) {
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
    await new Promise(resolve => setTimeout(resolve, 2000));
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
        timeout: CONNECTION_TEST_TIMEOUT
      }).catch(() => null);

      // Health endpoint might not exist yet, but server should be running
      // So we expect either a valid response or a 404, not a connection error
      expect(response).not.toBeNull();
    });

    it('should be accessible via both localhost and 127.0.0.1', async () => {
      const endpoints = [
        `http://localhost:${SERVER_PORT}`,
        `http://127.0.0.1:${SERVER_PORT}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${endpoint}/health`, {
            method: 'GET',
            timeout: CONNECTION_TEST_TIMEOUT
          });
          
          // We expect either success or 404, not connection refused
          expect([200, 404]).toContain(response.status);
        } catch (error) {
          // If health endpoint doesn't exist, try a basic request
          if (error.code === 'ECONNREFUSED') {
            throw new Error(`Server not accessible at ${endpoint}: ${error.message}`);
          }
          
          // Try the debug-log endpoint instead
          try {
            const debugResponse = await fetch(`${endpoint}/api/debug-log`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ logs: [] }),
              timeout: CONNECTION_TEST_TIMEOUT
            });
            
            // Should get some response, even if validation fails
            expect(debugResponse.status).toBeDefined();
          } catch (debugError) {
            if (debugError.code === 'ECONNREFUSED') {
              throw new Error(`Server not accessible at ${endpoint}: ${debugError.message}`);
            }
          }
        }
      }
    });
  });

  describe('Debug Log Endpoint Availability', () => {
    it('should have debug-log endpoint available at expected URLs', async () => {
      const testEndpoints = [
        `http://localhost:${SERVER_PORT}/api/debug-log`,
        `http://127.0.0.1:${SERVER_PORT}/api/debug-log`
      ];

      for (const endpoint of testEndpoints) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:8080' // Valid CORS origin
          },
          body: JSON.stringify({
            logs: [
              {
                level: 'info',
                message: 'Test log message',
                timestamp: new Date().toISOString(),
                sessionId: 'test-session'
              }
            ]
          }),
          timeout: CONNECTION_TEST_TIMEOUT
        });

        // Should not get connection refused - expect valid HTTP response
        expect(response).toBeDefined();
        expect(response.status).toBeDefined();
        
        // Should be either success (200) or validation error (400), not connection error
        expect([200, 400, 422]).toContain(response.status);
      }
    });

    it('should handle CORS properly for allowed origins', async () => {
      const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/debug-log`, {
        method: 'OPTIONS', // Preflight request
        headers: {
          'Origin': 'http://localhost:8080',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        },
        timeout: CONNECTION_TEST_TIMEOUT
      });

      // OPTIONS requests typically return 204 No Content for CORS preflight
      expect([200, 204]).toContain(response.status);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });

  describe('Race Condition Testing', () => {
    it('should handle rapid connection attempts during startup phase', async () => {
      // Simulate the race condition where client starts logging immediately
      const connectionPromises = [];
      
      for (let i = 0; i < 10; i++) {
        const promise = fetch(`http://127.0.0.1:${SERVER_PORT}/api/debug-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            logs: [{
              level: 'info',
              message: `Rapid test message ${i}`,
              timestamp: new Date().toISOString(),
              sessionId: 'race-condition-test'
            }]
          }),
          timeout: 5000
        }).catch(error => ({ error: error.message }));
        
        connectionPromises.push(promise);
      }

      const responses = await Promise.all(connectionPromises);
      
      // All requests should get valid responses, not connection failures
      for (const response of responses) {
        if (response.error) {
          expect(response.error).not.toContain('ECONNREFUSED');
          expect(response.error).not.toContain('Connection refused');
        } else {
          expect(response.status).toBeDefined();
        }
      }
    });
  });

  describe('Server Configuration Validation', () => {
    it('should be configured with correct CORS origins', async () => {
      // This test validates the server configuration matches client expectations
      const testOrigins = [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:8081',
        'http://127.0.0.1:8081'
      ];

      for (const origin of testOrigins) {
        const response = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/debug-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin
          },
          body: JSON.stringify({ logs: [] }),
          timeout: 5000
        });

        // Should not get CORS errors for allowed origins
        expect(response.status).not.toBe(403);
      }
    });
  });
});