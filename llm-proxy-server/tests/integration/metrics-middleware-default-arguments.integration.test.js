/**
 * @file metrics-middleware-default-arguments.integration.test.js
 * @description Exercises Metrics middleware default arguments and fallback branches using real services.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  createCacheMetricsRecorder,
  createLlmMetricsMiddleware,
  createMetricsMiddleware,
} from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function instrumentConsole() {
  return {
    debugSpy: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    infoSpy: jest.spyOn(console, 'info').mockImplementation(() => {}),
    warnSpy: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    errorSpy: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

function restoreConsole(spies) {
  for (const spy of Object.values(spies)) {
    spy.mockRestore();
  }
}

function createRequest({
  method = 'GET',
  path = '/',
  body,
  headers = {},
  originalUrl,
  url,
}) {
  const headerEntries = Object.entries(headers).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]);
  const headerMap = new Map(headerEntries);

  return {
    method,
    path,
    body,
    correlationId: `${method}-${path}`,
    originalUrl,
    url,
    get(headerName) {
      if (!headerName) {
        return undefined;
      }
      return headerMap.get(headerName.toLowerCase());
    },
  };
}

function createResponse(statusCode = 200) {
  const headers = new Map();
  const response = {
    statusCode,
    headers,
    endCalls: [],
    finishHandler: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    get(name) {
      if (!name) {
        return undefined;
      }
      return headers.get(name.toLowerCase());
    },
    end(data, encoding) {
      this.endCalls.push({ data, encoding });
      if (typeof this.finishHandler === 'function') {
        this.finishHandler();
      }
      return this;
    },
    on(event, handler) {
      if (event === 'finish') {
        this.finishHandler = handler;
      }
    },
  };

  return response;
}

function createJsonResponse(statusCode = 200) {
  const response = createResponse(statusCode);
  response.jsonPayloads = [];
  response.json = function json(data) {
    this.jsonPayloads.push(data);
    return data;
  };
  return response;
}

describe('metrics middleware default arguments integration', () => {
  let metricsService;
  let logger;
  let consoleSpies;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    consoleSpies = instrumentConsole();
  });

  afterEach(() => {
    metricsService.clear();
    restoreConsole(consoleSpies);
  });

  it('covers default argument branches and fallback parsing paths', async () => {
    expect(() => createMetricsMiddleware()).toThrow(
      'metricsService is required for metrics middleware'
    );
    expect(() => createLlmMetricsMiddleware()).toThrow(
      'metricsService is required for LLM metrics middleware'
    );
    expect(() => createCacheMetricsRecorder()).toThrow(
      'metricsService is required for cache metrics recorder'
    );

    const metricsMiddleware = createMetricsMiddleware({ metricsService });
    const cacheMetrics = createCacheMetricsRecorder({ metricsService });
    const llmMetricsMiddleware = createLlmMetricsMiddleware({ metricsService });

    const firstRequest = createRequest({
      method: 'POST',
      path: '/unclassified',
      body: { payload: true },
    });
    const firstResponse = createResponse(202);
    const firstNext = jest.fn();

    metricsMiddleware(firstRequest, firstResponse, firstNext);
    expect(typeof firstResponse.end).toBe('function');
    firstResponse.end({ ok: true });

    const secondRequest = createRequest({
      method: 'POST',
      path: '/textual',
      originalUrl: '/textual',
      url: '/textual',
      body: 'plain',
      headers: {
        'content-length': '5',
      },
    });
    const secondResponse = createResponse(202);
    const secondNext = jest.fn();

    metricsMiddleware(secondRequest, secondResponse, secondNext);
    secondResponse.end(12345);

    cacheMetrics.recordOperation('purge', 'success');
    cacheMetrics.recordStats(2, 4096);

    const openrouterReq = {
      body: { llmId: 'openrouter/anthropic/claude-3-haiku' },
      correlationId: 'openrouter-case',
    };
    const openrouterRes = createJsonResponse(207);
    llmMetricsMiddleware(openrouterReq, openrouterRes, jest.fn());
    openrouterRes.json({
      token_usage: {
        input: 7,
      },
    });

    const anthropicReq = {
      body: { llmId: 'anthropic-claude-3-haiku' },
      correlationId: 'anthropic-case',
    };
    const anthropicRes = createJsonResponse(201);
    llmMetricsMiddleware(anthropicReq, anthropicRes, jest.fn());
    anthropicRes.json({
      usage: {
        prompt_tokens: 9,
      },
    });

    const fallbackReq = {
      body: { llmId: 'custom-model' },
      correlationId: 'fallback-case',
    };
    const fallbackRes = createJsonResponse(503);
    llmMetricsMiddleware(fallbackReq, fallbackRes, jest.fn());
    fallbackRes.json({
      data: {
        usage: {
          prompt_tokens: 3,
          completion_tokens: 0,
        },
      },
    });

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="POST",route="/",status_code="202"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="POST",route="/textual",status_code="202"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_cache_operations_total{operation="purge",result="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_cache_memory_usage_bytes{cache_type="general"} 4096'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="anthropic",model="claude-3-haiku",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="unknown",model="custom-model",status="error"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="unknown",model="custom-model",token_type="input"} 3'
    );
    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(firstResponse.endCalls).toHaveLength(1);
    expect(secondResponse.endCalls).toHaveLength(1);
  });
});
