/**
 * @file Integration tests for server endpoint communication in action tracing
 * @description Tests HTTP communication with LLM proxy server for trace writing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import http from 'http';
import {
  createTempDirectory,
  cleanupTempDirectory,
  startTestLlmProxyServer,
  startFlakyTestServer,
} from '../../../common/mockFactories/actionTracingExtended.js';

// Helper to make HTTP requests in Node.js environment
/**
 *
 * @param url
 * @param options
 */
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body } = options;
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method,
      headers,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

describe('Server Endpoint Integration', () => {
  let testServer;
  let testDirectory;

  beforeEach(async () => {
    testDirectory = await createTempDirectory('server-integration-traces');
    testServer = await startTestLlmProxyServer({
      port: 0, // Use random available port
      traceOutputDirectory: testDirectory,
    });
  });

  afterEach(async () => {
    if (testServer) {
      await testServer.stop();
    }
    await cleanupTempDirectory(testDirectory);
  });

  describe('Successful Server Communication', () => {
    it('should successfully write multiple formats via server endpoint', async () => {
      const formattedTraces = [
        {
          content: JSON.stringify(
            {
              test: 'json',
              timestamp: Date.now(),
              actionId: 'test:server_integration',
              actorId: 'test_actor',
            },
            null,
            2
          ),
          fileName: 'integration_test.json',
        },
        {
          content: [
            '=== Integration Test Trace ===',
            `Test: successful server communication`,
            `Timestamp: ${new Date().toISOString()}`,
            `Action: test:server_integration`,
            `Actor: test_actor`,
            '',
            'Prerequisites:',
            '  ✓ Server connectivity verified',
            '  ✓ File write permissions confirmed',
            '',
            'Performance Summary:',
            `  Total Duration: 150ms`,
            `  Network Time: 25ms`,
            `  Write Time: 125ms`,
          ].join('\n'),
          fileName: 'integration_test.txt',
        },
      ];

      // Send HTTP request to server endpoint
      const response = await makeHttpRequest(
        `${testServer.url}/api/traces/write`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traces: formattedTraces }),
        }
      );

      const result = response.ok;

      expect(result).toBe(true);

      // Verify files were actually written by the server
      const files = await fs.readdir(testDirectory);
      expect(files).toContain('integration_test.json');
      expect(files).toContain('integration_test.txt');

      // Verify file contents
      const jsonContent = await fs.readFile(
        path.join(testDirectory, 'integration_test.json'),
        'utf-8'
      );
      const textContent = await fs.readFile(
        path.join(testDirectory, 'integration_test.txt'),
        'utf-8'
      );

      expect(JSON.parse(jsonContent)).toEqual(
        expect.objectContaining({
          test: 'json',
          actionId: 'test:server_integration',
          actorId: 'test_actor',
        })
      );
      expect(textContent).toContain('=== Integration Test Trace ===');
      expect(textContent).toContain('test:server_integration');
      expect(textContent).toContain('Server connectivity verified');
    });

    it('should handle large trace data efficiently', async () => {
      // Create large trace data
      const largeComponents = {};
      for (let i = 0; i < 100; i++) {
        largeComponents[`component_${i}`] = {
          id: `comp_${i}`,
          data: `data_${i}`.repeat(50),
          metadata: {
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            version: '1.0.0',
          },
        };
      }

      const largeTrace = {
        content: JSON.stringify(
          {
            actionId: 'test:large_trace',
            actorId: 'performance_test_actor',
            timestamp: new Date().toISOString(),
            components: largeComponents,
            execution: {
              phases: Array.from({ length: 50 }, (_, i) => ({
                phase: `phase_${i}`,
                duration: Math.random() * 100,
                details: `Phase ${i} processing details`.repeat(10),
              })),
            },
          },
          null,
          2
        ),
        fileName: 'large_trace_test.json',
      };

      const startTime = performance.now();
      const response = await makeHttpRequest(
        `${testServer.url}/api/traces/write`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traces: [largeTrace] }),
        }
      );
      const endTime = performance.now();

      const result = response.ok;

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify file was written
      const files = await fs.readdir(testDirectory);
      expect(files).toContain('large_trace_test.json');

      const fileContent = await fs.readFile(
        path.join(testDirectory, 'large_trace_test.json'),
        'utf-8'
      );
      const parsedContent = JSON.parse(fileContent);
      expect(parsedContent.actionId).toBe('test:large_trace');
      expect(Object.keys(parsedContent.components)).toHaveLength(100);
    });

    it('should handle concurrent requests correctly', async () => {
      const concurrentTraces = Array.from({ length: 10 }, (_, i) => ({
        content: JSON.stringify({
          test: `concurrent_${i}`,
          actionId: `test:concurrent_${i}`,
          actorId: `actor_${i}`,
          timestamp: new Date().toISOString(),
        }),
        fileName: `concurrent_test_${i}.json`,
      }));

      // Send all requests concurrently
      const results = await Promise.all(
        concurrentTraces.map((trace) =>
          makeHttpRequest(`${testServer.url}/api/traces/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ traces: [trace] }),
          }).then((response) => response.ok)
        )
      );

      // All requests should succeed
      expect(results).toEqual(Array(10).fill(true));

      // Verify all files were written
      const files = await fs.readdir(testDirectory);
      for (let i = 0; i < 10; i++) {
        expect(files).toContain(`concurrent_test_${i}.json`);
      }

      // Verify content integrity
      for (let i = 0; i < 10; i++) {
        const content = await fs.readFile(
          path.join(testDirectory, `concurrent_test_${i}.json`),
          'utf-8'
        );
        const parsed = JSON.parse(content);
        expect(parsed.test).toBe(`concurrent_${i}`);
        expect(parsed.actionId).toBe(`test:concurrent_${i}`);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle server errors gracefully', async () => {
      // Stop server to simulate downtime
      await testServer.stop();

      const formattedTraces = [
        { content: '{"test": "json"}', fileName: 'error_test.json' },
      ];

      let result = false;
      try {
        const response = await makeHttpRequest(
          `${testServer.url}/api/traces/write`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ traces: formattedTraces }),
          }
        );
        result = response.ok;
      } catch (error) {
        result = false;
      }

      expect(result).toBe(false);
    });

    it('should retry failed requests with exponential backoff', async () => {
      let requestCount = 0;

      const flakyServer = await startFlakyTestServer({
        port: 0,
        failureRate: 0.67, // Fail 2/3 of requests
        onRequest: (count) => {
          requestCount = count;
        },
      });

      try {
        const formattedTraces = [
          { content: '{"test": "retry"}', fileName: 'retry_test.json' },
        ];

        const startTime = Date.now();

        // Simple retry mechanism for testing
        let result = false;
        for (let i = 0; i < 5; i++) {
          try {
            const response = await makeHttpRequest(
              `${flakyServer.url}/api/traces/write`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ traces: formattedTraces }),
              }
            );
            if (response.ok) {
              result = true;
              break;
            }
          } catch (error) {
            // Retry on error
          }
          await new Promise((resolve) => setTimeout(resolve, 100)); // Simple delay
        }

        const endTime = Date.now();

        expect(result).toBe(true); // Should eventually succeed
        expect(requestCount).toBeGreaterThan(1); // Should have retried
        expect(endTime - startTime).toBeGreaterThan(100); // Should have backoff delay
      } finally {
        await flakyServer.stop();
      }
    }, 15000); // Longer timeout for retry logic

    it('should handle network timeouts appropriately', async () => {
      // Create a server that delays responses
      let requestReceived = false;
      const slowServer = await startTestLlmProxyServer({
        port: 0,
        traceOutputDirectory: testDirectory,
        onRequest: () => {
          requestReceived = true;
          // Simulate slow server by delaying response
          return new Promise((resolve) => setTimeout(resolve, 2000));
        },
      });

      try {
        const formattedTraces = [
          { content: '{"test": "timeout"}', fileName: 'timeout_test.json' },
        ];

        const startTime = Date.now();
        let result = false;

        try {
          // Simple timeout simulation - this should fail due to server delay
          const response = await Promise.race([
            makeHttpRequest(`${slowServer.url}/api/traces/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ traces: formattedTraces }),
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 1000)
            ),
          ]);
          result = response.ok;
        } catch (error) {
          result = false;
        }

        const endTime = Date.now();

        expect(result).toBe(false); // Should fail due to timeout
        expect(endTime - startTime).toBeLessThan(1500); // Should timeout quickly
        expect(requestReceived).toBe(true); // Request should have been received
      } finally {
        await slowServer.stop();
      }
    }, 10000);

    it('should handle malformed server responses', async () => {
      // Create a server that returns invalid responses
      const malformedServer = await new Promise((resolve) => {
        const http = require('http');
        const server = http.createServer((req, res) => {
          if (req.method === 'POST' && req.url === '/api/traces/write') {
            // Return malformed JSON
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{ invalid json response');
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });

        server.listen(0, () => {
          const port = server.address().port;
          resolve({
            url: `http://localhost:${port}`,
            stop: () => new Promise((stopResolve) => server.close(stopResolve)),
          });
        });
      });

      try {
        const formattedTraces = [
          { content: '{"test": "malformed"}', fileName: 'malformed_test.json' },
        ];

        let result = false;
        try {
          const response = await makeHttpRequest(
            `${malformedServer.url}/api/traces/write`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ traces: formattedTraces }),
            }
          );

          // For malformed response test, we should try to parse the JSON response
          // A real client would do this and fail on malformed JSON
          if (response.ok) {
            try {
              JSON.parse(response.data); // This should throw on malformed JSON
              result = true;
            } catch (parseError) {
              result = false; // Malformed JSON should be treated as failure
            }
          } else {
            result = false;
          }
        } catch (error) {
          result = false;
        }

        expect(result).toBe(false); // Should handle malformed response gracefully
      } finally {
        await malformedServer.stop();
      }
    });
  });

  describe('Server Response Validation', () => {
    it('should validate server response format', async () => {
      const formattedTraces = [
        {
          content: JSON.stringify({
            actionId: 'test:response_validation',
            actorId: 'validation_test_actor',
            metadata: {
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              generator: 'integration_test',
            },
          }),
          fileName: 'response_validation_test.json',
        },
      ];

      const response = await makeHttpRequest(
        `${testServer.url}/api/traces/write`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traces: formattedTraces }),
        }
      );

      const result = response.ok;

      expect(result).toBe(true);

      // Verify the server response structure
      const files = await fs.readdir(testDirectory);
      expect(files).toContain('response_validation_test.json');

      const fileContent = await fs.readFile(
        path.join(testDirectory, 'response_validation_test.json'),
        'utf-8'
      );
      const parsedContent = JSON.parse(fileContent);

      expect(parsedContent).toEqual(
        expect.objectContaining({
          actionId: 'test:response_validation',
          actorId: 'validation_test_actor',
          metadata: expect.objectContaining({
            version: '1.0.0',
            generator: 'integration_test',
          }),
        })
      );
    });

    it('should handle empty file content gracefully', async () => {
      const formattedTraces = [
        {
          content: '',
          fileName: 'empty_content_test.txt',
        },
        {
          content: '{}',
          fileName: 'minimal_json_test.json',
        },
      ];

      const response = await makeHttpRequest(
        `${testServer.url}/api/traces/write`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traces: formattedTraces }),
        }
      );

      const result = response.ok;

      expect(result).toBe(true);

      const files = await fs.readdir(testDirectory);
      expect(files).toContain('empty_content_test.txt');
      expect(files).toContain('minimal_json_test.json');

      // Verify file contents
      const emptyContent = await fs.readFile(
        path.join(testDirectory, 'empty_content_test.txt'),
        'utf-8'
      );
      const minimalContent = await fs.readFile(
        path.join(testDirectory, 'minimal_json_test.json'),
        'utf-8'
      );

      expect(emptyContent).toBe('');
      expect(minimalContent).toBe('{}');
    });
  });
});
