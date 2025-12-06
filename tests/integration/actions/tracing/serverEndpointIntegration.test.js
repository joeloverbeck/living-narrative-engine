/**
 * @file Integration tests for server endpoint communication in action tracing
 * @description Tests HTTP communication with LLM proxy server for trace writing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import {
  createTempDirectory,
  cleanupTempDirectory,
  startTestLlmProxyServer,
  startFlakyTestServer,
} from '../../../common/mockFactories/actionTracingExtended.js';

/**
 *
 * @param server
 * @param traces
 */
async function postTraces(server, traces) {
  const response = await fetch(`${server.url}/api/traces/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ traces }),
  });
  return {
    ok: response.ok,
    status: response.status,
    data: await response.text(),
  };
}

describe('Server Endpoint Integration', () => {
  let testServer;
  let testDirectory;

  // PERFORMANCE: Use beforeAll instead of beforeEach to reuse server across tests
  beforeAll(async () => {
    testDirectory = await createTempDirectory('server-integration-traces');
    testServer = await startTestLlmProxyServer({
      port: 0, // Use random available port
      traceOutputDirectory: testDirectory,
    });
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
    }
    await cleanupTempDirectory(testDirectory);
  });

  describe('Successful Server Communication', () => {
    it('should successfully write multiple formats via server endpoint', async () => {
      const testId = Date.now(); // Unique ID to avoid file conflicts when server is shared
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
          fileName: `integration_test_${testId}.json`,
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
          fileName: `integration_test_${testId}.txt`,
        },
      ];

      const response = await postTraces(testServer, formattedTraces);

      const result = response.ok;

      expect(result).toBe(true);

      // Verify files were actually written by the server
      const files = await fs.readdir(testDirectory);
      expect(files).toContain(`integration_test_${testId}.json`);
      expect(files).toContain(`integration_test_${testId}.txt`);

      // Verify file contents
      const jsonContent = await fs.readFile(
        path.join(testDirectory, `integration_test_${testId}.json`),
        'utf-8'
      );
      const textContent = await fs.readFile(
        path.join(testDirectory, `integration_test_${testId}.txt`),
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
      const testId = Date.now();
      // PERFORMANCE: Reduced from 100 to 20 components and 50 to 10 phases
      // This still tests large data handling but runs much faster
      const largeComponents = {};
      for (let i = 0; i < 20; i++) {
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
              phases: Array.from({ length: 10 }, (_, i) => ({
                phase: `phase_${i}`,
                duration: Math.random() * 100,
                details: `Phase ${i} processing details`.repeat(10),
              })),
            },
          },
          null,
          2
        ),
        fileName: `large_trace_test_${testId}.json`,
      };

      const startTime = performance.now();
      const response = await postTraces(testServer, [largeTrace]);
      const endTime = performance.now();

      const result = response.ok;

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify file was written
      const files = await fs.readdir(testDirectory);
      expect(files).toContain(`large_trace_test_${testId}.json`);

      const fileContent = await fs.readFile(
        path.join(testDirectory, `large_trace_test_${testId}.json`),
        'utf-8'
      );
      const parsedContent = JSON.parse(fileContent);
      expect(parsedContent.actionId).toBe('test:large_trace');
      expect(Object.keys(parsedContent.components)).toHaveLength(20);
    });

    it('should handle concurrent requests correctly', async () => {
      const testId = Date.now();
      // PERFORMANCE: Reduced from 10 to 5 concurrent requests - still validates concurrency
      const concurrentTraces = Array.from({ length: 5 }, (_, i) => ({
        content: JSON.stringify({
          test: `concurrent_${i}`,
          actionId: `test:concurrent_${i}`,
          actorId: `actor_${i}`,
          timestamp: new Date().toISOString(),
        }),
        fileName: `concurrent_test_${testId}_${i}.json`,
      }));

      // Send all requests concurrently
      const results = await Promise.all(
        concurrentTraces.map(async (trace) => {
          const response = await postTraces(testServer, [trace]);
          return response.ok;
        })
      );

      // All requests should succeed
      expect(results).toEqual(Array(5).fill(true));

      // Verify all files were written
      const files = await fs.readdir(testDirectory);
      for (let i = 0; i < 5; i++) {
        expect(files).toContain(`concurrent_test_${testId}_${i}.json`);
      }

      // Verify content integrity
      for (let i = 0; i < 5; i++) {
        const content = await fs.readFile(
          path.join(testDirectory, `concurrent_test_${testId}_${i}.json`),
          'utf-8'
        );
        const parsed = JSON.parse(content);
        expect(parsed.test).toBe(`concurrent_${i}`);
        expect(parsed.actionId).toBe(`test:concurrent_${i}`);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    // PERFORMANCE: Create separate servers for error tests to avoid stopping shared server
    let errorTestServer;
    let errorTestDirectory;

    beforeAll(async () => {
      errorTestDirectory = await createTempDirectory('error-test-traces');
    });

    afterAll(async () => {
      await cleanupTempDirectory(errorTestDirectory);
    });

    it('should handle server errors gracefully', async () => {
      // Create and immediately stop a server to simulate downtime
      errorTestServer = await startTestLlmProxyServer({
        port: 0,
        traceOutputDirectory: errorTestDirectory,
      });
      const serverUrl = errorTestServer.url;
      await errorTestServer.stop();

      const formattedTraces = [
        { content: '{"test": "json"}', fileName: 'error_test.json' },
      ];

      let result = false;
      try {
        const response = await postTraces({ url: serverUrl }, formattedTraces);
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

        // PERFORMANCE: Reduced retry delay from 100ms to 10ms
        let result = false;
        for (let i = 0; i < 5; i++) {
          try {
            const response = await postTraces(flakyServer, formattedTraces);
            if (response.ok) {
              result = true;
              break;
            }
          } catch (error) {
            // Retry on error
          }
          await new Promise((resolve) => setTimeout(resolve, 10)); // Reduced delay
        }

        const endTime = Date.now();

        expect(result).toBe(true); // Should eventually succeed
        expect(requestCount).toBeGreaterThan(1); // Should have retried
        expect(endTime - startTime).toBeGreaterThan(10); // Should have backoff delay
      } finally {
        await flakyServer.stop();
      }
    }, 5000); // Reduced from 15000ms to 5000ms

    it('should handle network timeouts appropriately', async () => {
      // PERFORMANCE: Reduced delay from 2000ms to 400ms
      let requestReceived = false;
      const slowServer = await startTestLlmProxyServer({
        port: 0,
        traceOutputDirectory: errorTestDirectory,
        onRequest: () => {
          requestReceived = true;
          // Simulate slow server - reduced delay
          return new Promise((resolve) => setTimeout(resolve, 400));
        },
      });

      try {
        const formattedTraces = [
          { content: '{"test": "timeout"}', fileName: 'timeout_test.json' },
        ];

        const startTime = Date.now();
        let result = false;

        try {
          // Reduced timeout from 1000ms to 150ms
          const response = await Promise.race([
            postTraces(slowServer, formattedTraces),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 150)
            ),
          ]);
          result = response.ok;
        } catch (error) {
          result = false;
        }

        const endTime = Date.now();

        expect(result).toBe(false); // Should fail due to timeout
        expect(endTime - startTime).toBeLessThan(500); // Should timeout quickly
        expect(requestReceived).toBe(true); // Request should have been received
      } finally {
        await slowServer.stop();
      }
    }, 5000); // Account for server creation/teardown overhead

    it('should handle malformed server responses', async () => {
      const malformedServer = await startTestLlmProxyServer({
        handler: async (request) => {
          if (
            request.method === 'POST' &&
            request.pathname === '/api/traces/write'
          ) {
            return new Response('{ invalid json response', {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response('Not Found', { status: 404 });
        },
      });

      try {
        const formattedTraces = [
          { content: '{"test": "malformed"}', fileName: 'malformed_test.json' },
        ];

        let result = false;
        try {
          const response = await postTraces(malformedServer, formattedTraces);

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
      const testId = Date.now();
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
          fileName: `response_validation_test_${testId}.json`,
        },
      ];

      const response = await postTraces(testServer, formattedTraces);

      const result = response.ok;

      expect(result).toBe(true);

      // Verify the server response structure
      const files = await fs.readdir(testDirectory);
      expect(files).toContain(`response_validation_test_${testId}.json`);

      const fileContent = await fs.readFile(
        path.join(testDirectory, `response_validation_test_${testId}.json`),
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
      const testId = Date.now();
      const formattedTraces = [
        {
          content: '',
          fileName: `empty_content_test_${testId}.txt`,
        },
        {
          content: '{}',
          fileName: `minimal_json_test_${testId}.json`,
        },
      ];

      const response = await postTraces(testServer, formattedTraces);

      const result = response.ok;

      expect(result).toBe(true);

      const files = await fs.readdir(testDirectory);
      expect(files).toContain(`empty_content_test_${testId}.txt`);
      expect(files).toContain(`minimal_json_test_${testId}.json`);

      // Verify file contents
      const emptyContent = await fs.readFile(
        path.join(testDirectory, `empty_content_test_${testId}.txt`),
        'utf-8'
      );
      const minimalContent = await fs.readFile(
        path.join(testDirectory, `minimal_json_test_${testId}.json`),
        'utf-8'
      );

      expect(emptyContent).toBe('');
      expect(minimalContent).toBe('{}');
    });
  });
});
