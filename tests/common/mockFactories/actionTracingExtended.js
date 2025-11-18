/**
 * @file Extended mock factories for integration testing of action tracing
 * @description Provides additional mock implementations and helpers for integration tests
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const originalFetch = globalThis.fetch;
const fetchInterceptorState = {
  installed: false,
  servers: new Map(),
  counter: 0,
};

function extractRequestUrl(input) {
  if (typeof input === 'string') {
    return input;
  }
  if (typeof URL !== 'undefined' && input instanceof URL) {
    return input.href;
  }
  if (
    typeof Request !== 'undefined' &&
    input instanceof Request &&
    typeof input.url === 'string'
  ) {
    return input.url;
  }
  if (input && typeof input.url === 'string') {
    return input.url;
  }
  return null;
}

async function readRequestBody(input, init = {}) {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    const clone = input.clone();
    return clone.text();
  }
  if (!init.body) {
    return '';
  }
  if (typeof init.body === 'string') {
    return init.body;
  }
  if (Buffer.isBuffer(init.body)) {
    return init.body.toString();
  }
  if (init.body instanceof URLSearchParams) {
    return init.body.toString();
  }
  if (typeof init.body === 'object') {
    try {
      return JSON.stringify(init.body);
    } catch {
      return '';
    }
  }
  return String(init.body);
}

function normalizeHeaders(rawHeaders = {}) {
  if (rawHeaders instanceof Headers) {
    const headersObj = {};
    rawHeaders.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });
    return headersObj;
  }
  if (Array.isArray(rawHeaders)) {
    return rawHeaders.reduce((acc, entry) => {
      if (Array.isArray(entry) && entry.length === 2) {
        acc[String(entry[0]).toLowerCase()] = String(entry[1]);
      }
      return acc;
    }, {});
  }
  if (typeof rawHeaders === 'object') {
    return Object.entries(rawHeaders).reduce((acc, [key, value]) => {
      acc[String(key).toLowerCase()] = value;
      return acc;
    }, {});
  }
  return {};
}

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ensureFetchInterceptor() {
  if (fetchInterceptorState.installed) {
    return;
  }

  if (typeof originalFetch !== 'function') {
    throw new Error(
      'Global fetch must be available for action tracing integration tests.'
    );
  }

  globalThis.fetch = async function interceptedFetch(input, init) {
    const url = extractRequestUrl(input);
    const serverEntry = findServerForUrl(url);
    if (serverEntry) {
      return serverEntry.handleRequest(input, init, url);
    }
    return originalFetch(input, init);
  };

  fetchInterceptorState.installed = true;
}

function restoreFetchIfIdle() {
  if (
    fetchInterceptorState.servers.size === 0 &&
    fetchInterceptorState.installed &&
    typeof originalFetch === 'function'
  ) {
    globalThis.fetch = originalFetch;
    fetchInterceptorState.installed = false;
  }
}

function findServerForUrl(url) {
  if (!url) {
    return null;
  }
  for (const entry of fetchInterceptorState.servers.values()) {
    if (url.startsWith(entry.baseUrl)) {
      return entry;
    }
  }
  return null;
}

function registerInMemoryServer(handler) {
  ensureFetchInterceptor();
  const id = ++fetchInterceptorState.counter;
  const baseUrl = `http://trace-server-${id}.local`;

  const entry = {
    baseUrl,
    active: true,
    async handleRequest(input, init, url) {
      if (!this.active) {
        return createJsonResponse(
          { success: false, error: 'Server stopped' },
          503
        );
      }
      const body = await readRequestBody(input, init);
      const method = (init?.method || input?.method || 'GET').toUpperCase();
      const requestUrl = new URL(url);
      const headers = normalizeHeaders(init?.headers || input?.headers);

      return handler({
        url,
        pathname: requestUrl.pathname,
        method,
        headers,
        body,
      });
    },
    async stop() {
      this.active = false;
      fetchInterceptorState.servers.delete(baseUrl);
      restoreFetchIfIdle();
    },
  };

  fetchInterceptorState.servers.set(baseUrl, entry);
  return entry;
}

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
  const { traceOutputDirectory, onRequest, handler } = options;

  const serverEntry = registerInMemoryServer(async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200 });
    }

    if (typeof handler === 'function') {
      return handler(request);
    }

    if (
      request.method !== 'POST' ||
      request.pathname !== '/api/traces/write'
    ) {
      return new Response('Not Found', { status: 404 });
    }

    if (onRequest) {
      const maybePromise = onRequest(request);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
    }

    let requestData;
    try {
      requestData = request.body ? JSON.parse(request.body) : {};
    } catch (error) {
      return createJsonResponse(
        { success: false, error: 'Invalid JSON body' },
        400
      );
    }

    let traces;
    if (Array.isArray(requestData.traces)) {
      traces = requestData.traces;
    } else if (
      requestData.traceData &&
      typeof requestData.fileName === 'string'
    ) {
      traces = [
        { content: requestData.traceData, fileName: requestData.fileName },
      ];
    } else {
      return createJsonResponse(
        { success: false, error: 'Invalid request format' },
        400
      );
    }

    const results = [];
    if (traceOutputDirectory) {
      for (const trace of traces) {
        if (!trace.fileName) {
          return createJsonResponse(
            { success: false, error: 'Trace missing fileName' },
            400
          );
        }
        const filePath = path.join(traceOutputDirectory, trace.fileName);
        await fs.writeFile(filePath, trace.content, 'utf-8');
        results.push({
          fileName: trace.fileName,
          filePath,
          size: trace.content.length,
        });
      }
    }

    return createJsonResponse({
      success: true,
      files: results,
      totalFiles: traces.length,
    });
  });

  return {
    url: serverEntry.baseUrl,
    stop: () => serverEntry.stop(),
  };
}

/**
 * Start a flaky test server that fails intermittently
 *
 * @param {object} options - Server configuration options
 * @returns {Promise<object>} Server instance with url and stop method
 */
export async function startFlakyTestServer(options = {}) {
  const { failuresBeforeSuccess = 2, onRequest } = options;
  let requestCount = 0;

  const serverEntry = registerInMemoryServer(async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200 });
    }
    if (
      request.method !== 'POST' ||
      request.pathname !== '/api/traces/write'
    ) {
      return new Response('Not Found', { status: 404 });
    }

    requestCount += 1;
    if (onRequest) {
      onRequest(requestCount);
    }

    if (requestCount <= failuresBeforeSuccess) {
      return createJsonResponse(
        { success: false, error: 'Simulated server failure' },
        500
      );
    }

    return createJsonResponse({
      success: true,
      filePath: '/mock/path/trace.json',
      size: 100,
    });
  });

  return {
    url: serverEntry.baseUrl,
    stop: () => serverEntry.stop(),
  };
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
