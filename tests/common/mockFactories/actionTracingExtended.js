/**
 * @file Extended mock factories for integration testing of action tracing
 * @description Provides additional mock implementations and helpers for integration tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

/**
 * Create temporary directory for testing
 *
 * @param {string} prefix - Directory prefix
 * @returns {Promise<string>} Path to temporary directory
 */
export async function createTempDirectory(prefix = 'test') {
  const tempDir = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up temporary directory
 *
 * @param {string} directory - Directory path to clean up
 * @returns {Promise<void>}
 */
export async function cleanupTempDirectory(directory) {
  try {
    await fs.rm(directory, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `Failed to cleanup temp directory ${directory}:`,
      error.message
    );
  }
}

/**
 * Create mock ActionExecutionTrace with customizable options
 *
 * @param {object} options - Trace configuration options
 * @returns {object} Mock ActionExecutionTrace instance
 */
export function createMockActionExecutionTrace(options = {}) {
  const {
    actionId = 'test:action',
    actorId = 'test-actor',
    timestamp = new Date().toISOString(),
    components = {},
    prerequisites = [],
    targets = [],
    commandString = 'test command',
    parameters = {},
    duration = null,
    status = 'success',
  } = options;

  return {
    actionId,
    actorId,
    timestamp,
    components,
    prerequisites,
    targets,
    isComplete: status === 'success',
    hasError: status === 'failed',
    duration,
    execution: {
      startTime: Date.now() - (duration || 100),
      endTime: Date.now(),
      duration: duration || 100,
      status,
      result: {
        success: status === 'success',
        error: status === 'failed' ? 'Test error' : null,
      },
    },
    turnAction: {
      actionDefinitionId: actionId,
      commandString,
      parameters,
    },
    toJSON: jest.fn().mockReturnValue({
      metadata: {
        actionId,
        actorId,
        traceType: 'execution',
        createdAt: timestamp,
        version: '1.0',
      },
      turnAction: {
        actionDefinitionId: actionId,
        commandString,
        parameters,
      },
      components,
      prerequisites,
      targets,
      execution: {
        startTime: Date.now() - (duration || 100),
        endTime: Date.now(),
        duration: duration || 100,
        status,
        result: {
          success: status === 'success',
          error: status === 'failed' ? 'Test error' : null,
        },
      },
    }),
  };
}

/**
 * Start a test LLM proxy server
 *
 * @param {object} options - Server configuration options
 * @returns {Promise<object>} Server instance with url and stop method
 */
export async function startTestLlmProxyServer(options = {}) {
  const { port = 0, traceOutputDirectory, onRequest } = options;

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/api/traces/write') {
        // Handle request delay if onRequest returns a promise
        if (onRequest) {
          const delayPromise = onRequest(req);
          if (delayPromise && typeof delayPromise.then === 'function') {
            await delayPromise;
          }
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const requestData = JSON.parse(body);
            let traces;

            // Handle both single trace and multi-trace formats
            if (requestData.traces) {
              traces = requestData.traces; // Multi-trace format
            } else if (requestData.traceData && requestData.fileName) {
              traces = [
                {
                  content: requestData.traceData,
                  fileName: requestData.fileName,
                },
              ]; // Single trace format
            } else {
              throw new Error('Invalid request format');
            }

            const results = [];
            if (traceOutputDirectory) {
              for (const trace of traces) {
                const filePath = path.join(
                  traceOutputDirectory,
                  trace.fileName
                );
                await fs.writeFile(filePath, trace.content, 'utf-8');
                results.push({
                  fileName: trace.fileName,
                  filePath,
                  size: trace.content.length,
                });
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                files: results,
                totalFiles: traces.length,
              })
            );
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                error: error.message,
              })
            );
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      const actualPort = server.address().port;
      resolve({
        url: `http://localhost:${actualPort}`,
        port: actualPort,
        stop: () => new Promise((stopResolve) => server.close(stopResolve)),
      });
    });
  });
}

/**
 * Start a flaky test server that fails intermittently
 *
 * @param {object} options - Server configuration options
 * @returns {Promise<object>} Server instance with url and stop method
 */
export async function startFlakyTestServer(options = {}) {
  const { port = 0, failureRate = 0.5, onRequest } = options;
  let requestCount = 0;

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requestCount++;
      if (onRequest) onRequest(requestCount);

      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/api/traces/write') {
        // Simulate intermittent failures - more deterministic approach
        // Fail the first few requests, then succeed
        const shouldFail = requestCount <= 2; // Fail first 2 requests, succeed on 3rd
        if (shouldFail) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: 'Simulated server failure',
            })
          );
          return;
        }

        // Consume request body
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              filePath: '/mock/path/trace.json',
              size: 100,
            })
          );
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      const actualPort = server.address().port;
      resolve({
        url: `http://localhost:${actualPort}`,
        port: actualPort,
        requestCount: () => requestCount,
        stop: () => new Promise((stopResolve) => server.close(stopResolve)),
      });
    });
  });
}

/**
 * Create a mock FileTraceOutputHandler for testing
 *
 * @param {object} options - Configuration options
 * @returns {object} Mock FileTraceOutputHandler
 */
export function createMockFileTraceOutputHandler(options = {}) {
  const { shouldSucceed = true } = options;

  return {
    writeFormattedTraces: jest.fn().mockImplementation(async (traces) => {
      if (!shouldSucceed) {
        throw new Error('Mock write failure');
      }
      return true;
    }),
    initialize: jest.fn().mockResolvedValue(true),
    writeTrace: jest.fn().mockResolvedValue(true),
    getQueueLength: jest.fn().mockReturnValue(0),
    isInitialized: jest.fn().mockReturnValue(true),
  };
}

/**
 * Create realistic trace data for testing
 *
 * @param {object} options - Trace data options
 * @returns {object} Realistic trace data
 */
export function createRealisticTraceData(options = {}) {
  const {
    actionId = 'caressing:fondle_ass',
    actorId = 'player_character',
    targetId = 'npc_romantic_partner',
    timestamp = new Date().toISOString(),
  } = options;

  return {
    actionId,
    actorId,
    timestamp,
    components: {
      position: { x: 10, y: 20, z: 0 },
      health: { current: 100, max: 100 },
      relationship: { level: 'intimate', trust: 85 },
    },
    prerequisites: [
      { type: 'component', id: 'core:position', satisfied: true },
      { type: 'relationship', condition: 'intimacy > 50', satisfied: true },
      { type: 'consent', condition: 'mutual', satisfied: true },
    ],
    targets: [
      {
        entityId: targetId,
        components: ['core:position', 'caressing:relationship'],
      },
    ],
    execution: {
      startTime: Date.now() - 150,
      endTime: Date.now(),
      duration: 150,
      status: 'success',
      phases: [
        { phase: 'validation', duration: 10 },
        { phase: 'execution', duration: 130 },
        { phase: 'cleanup', duration: 10 },
      ],
    },
    turnAction: {
      actionDefinitionId: actionId,
      commandString: 'fondle ass',
      parameters: {
        target: targetId,
        intensity: 'gentle',
      },
    },
    performance: {
      totalDuration: 150,
      validationTime: 10,
      executionTime: 130,
      outputTime: 10,
    },
  };
}
