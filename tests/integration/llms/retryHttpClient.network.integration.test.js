/** @jest-environment node */

/**
 * @file Integration tests for RetryHttpClient interacting with a real HTTP server.
 */

import { describe, it, expect } from '@jest/globals';
import { createServer } from 'http';
import { RetryHttpClient } from '../../../src/llms/retryHttpClient.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, details) {
    this.debugMessages.push({ message, details });
  }

  info(message, details) {
    this.infoMessages.push({ message, details });
  }

  warn(message, details) {
    this.warnMessages.push({ message, details });
  }

  error(message, details) {
    this.errorMessages.push({ message, details });
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return { ok: true };
  }
}

/**
 *
 * @param responses
 */
function createHttpServer(responses) {
  let callCount = 0;
  const server = createServer((req, res) => {
    const index = Math.min(callCount, responses.length - 1);
    const response = responses[index];
    callCount += 1;

    res.statusCode = response.status;
    const isStringBody = typeof response.body === 'string';
    const headers = {
      'content-type': isStringBody ? 'text/plain' : 'application/json',
      ...(response.headers || {}),
    };
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    const payload = isStringBody
      ? response.body
      : JSON.stringify(response.body);
    res.end(payload);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        async close() {
          await new Promise((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error);
              } else {
                resolveClose();
              }
            });
          });
        },
        getCallCount() {
          return callCount;
        },
      });
    });
  });
}

describe('RetryHttpClient network integration', () => {
  it('throws when the dispatcher dependency lacks a dispatch function', () => {
    const logger = new RecordingLogger();
    const invalidDispatcher = {};

    expect(() => {
      new RetryHttpClient({
        logger,
        dispatcher: invalidDispatcher,
      });
    }).toThrow('RetryHttpClient: dispatcher dependency invalid.');

    expect(
      logger.errorMessages.some(({ message }) =>
        message.includes('RetryHttpClient: Missing or invalid SafeEventDispatcher')
      )
    ).toBe(true);
  });

  it('retries retryable failures and returns the eventual success response', async () => {
    const server = await createHttpServer([
      { status: 500, body: { error: 'temporary' } },
      { status: 200, body: { message: 'success', attempt: 2 } },
    ]);

    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 2,
      defaultBaseDelayMs: 5,
      defaultMaxDelayMs: 10,
    });

    try {
      const result = await client.request(`${server.baseUrl}/api/llm-request`, {
        method: 'GET',
      });

      expect(result).toEqual({ message: 'success', attempt: 2 });
      expect(server.getCallCount()).toBe(2);

      const eventIds = dispatcher.events.map((event) => event.eventId);
      expect(eventIds).toEqual([SYSTEM_WARNING_OCCURRED_ID]);

      const warningEvent = dispatcher.events.find(
        (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
      );
      expect(warningEvent.payload.details.statusCode).toBe(500);

      expect(logger.debugMessages.some(({ message }) =>
        message.includes('RetryHttpClient.request: Attempt 2/3')
      )).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('emits a system error once retries are exhausted', async () => {
    const server = await createHttpServer([
      { status: 503, body: { error: 'overloaded' } },
      { status: 503, body: 'still overloaded' },
      { status: 503, body: { error: 'give up' } },
    ]);

    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 2,
      defaultBaseDelayMs: 5,
      defaultMaxDelayMs: 10,
    });

    try {
      await expect(
        client.request(`${server.baseUrl}/api/llm-request`, {
          method: 'POST',
          body: JSON.stringify({ payload: 'data' }),
          headers: { 'Content-Type': 'application/json' },
        })
      ).rejects.toThrow('status 503');

      expect(server.getCallCount()).toBe(3);

      const warningEvents = dispatcher.events.filter(
        (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
      );
      expect(warningEvents).toHaveLength(2);

      const errorEvents = dispatcher.events.filter(
        (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(errorEvents).toHaveLength(1);

      const finalError = errorEvents[0];
      expect(finalError.payload.details.scopeName).toBe('RetryHttpClient');

      expect(
        logger.debugMessages.filter(({ message }) =>
          message.includes('RetryHttpClient: Attempting salvage recovery')
        )
      ).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it('attempts salvage recovery when a prior request id exists and maps abort signals correctly', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 1,
      defaultMaxDelayMs: 2,
    });

    const originalFetch = global.fetch;
    const fetchCalls = [];
    let stage = 'warmup';
    const baseUrl = 'https://llm.example.com/api/llm-request';

    const errorResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: 'temporary-outage' }),
    };
    errorResponse.clone = () => ({
      text: errorResponse.text,
    });

    global.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (stage === 'warmup') {
        stage = 'failing';
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (name === 'X-Request-ID' ? 'request-123' : null),
          },
          json: async () => ({
            headers: {
              get: (name) => (name === 'X-Request-ID' ? 'request-123' : null),
            },
          }),
        };
      }

      if (stage === 'failing') {
        stage = 'salvage';
        return errorResponse;
      }

      if (url.includes('/salvage/request-123')) {
        stage = 'done';
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ recovered: true }),
          marker: 'salvaged',
        };
      }

      throw new Error(`Unexpected fetch call for URL: ${url}`);
    };

    try {
      const warmupResult = await client.request(baseUrl, { method: 'GET' });
      expect(warmupResult.headers.get('X-Request-ID')).toBe('request-123');

      const controller = new AbortController();
      const salvageResult = await client.request(baseUrl, {
        method: 'POST',
        abortSignal: controller.signal,
      });

      expect(salvageResult.marker).toBe('salvaged');
      expect(fetchCalls[1].options.signal).toBe(controller.signal);
      expect('abortSignal' in fetchCalls[1].options).toBe(false);

      const infoMessages = logger.infoMessages.map(({ message }) => message);
      expect(
        infoMessages.some((message) =>
          message.includes('Attempting salvage recovery for request request-123')
        )
      ).toBe(true);
      expect(
        infoMessages.some((message) =>
          message.includes('Successfully recovered salvaged response for request request-123')
        )
      ).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('continues retries when salvage data is unavailable', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 2,
      defaultBaseDelayMs: 1,
      defaultMaxDelayMs: 2,
    });

    const originalFetch = global.fetch;
    const baseUrl = 'https://llm.example.com/api/llm-request';
    let stage = 'warmup';
    const calls = [];

    const errorResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: 'outage' }),
    };
    errorResponse.clone = () => ({ text: errorResponse.text });

    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });

      if (stage === 'warmup') {
        stage = 'firstFailure';
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (name === 'X-Request-ID' ? 'cached-id' : null),
          },
          json: async () => ({
            headers: {
              get: (name) => (name === 'X-Request-ID' ? 'cached-id' : null),
            },
          }),
        };
      }

      if (stage === 'firstFailure') {
        stage = 'salvageFail';
        return errorResponse;
      }

      if (stage === 'salvageFail') {
        stage = 'retrySuccess';
        return { ok: false, status: 404, text: async () => 'not found' };
      }

      if (stage === 'retrySuccess') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ message: 'recovered' }),
        };
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    };

    try {
      await client.request(baseUrl, { method: 'GET' });

      const result = await client.request(baseUrl, { method: 'POST' });
      expect(result).toEqual({ message: 'recovered' });

      expect(
        logger.debugMessages.some(({ message }) =>
          message.includes('No salvaged response available for request cached-id')
        )
      ).toBe(true);
      expect(
        dispatcher.events.filter(
          (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
        )
      ).toHaveLength(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('dispatches warning and error events for network failures without status codes', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    const originalFetch = global.fetch;
    const firstError = new Error('first attempt');
    firstError.body = null;
    firstError.message = undefined;
    const secondError = new Error('retry failed');
    secondError.body = undefined;

    let attemptCount = 0;
    global.fetch = async () => {
      const error = attemptCount === 0 ? firstError : secondError;
      attemptCount += 1;
      throw error;
    };

    try {
      await expect(
        client.request('https://llm.example.com/api/llm-request', {
          method: 'GET',
        })
      ).rejects.toBe(secondError);

      expect(attemptCount).toBe(2);

      const warningEvents = dispatcher.events.filter(
        (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
      );
      expect(warningEvents).toHaveLength(1);
      expect(warningEvents[0].payload.details.raw).toBe('');

      const errorEvents = dispatcher.events.filter(
        (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].payload.details.raw).toBe('retry failed');
      expect(errorEvents[0].payload.details.scopeName).toBe('RetryHttpClient');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('logs salvage recovery failures when the salvage endpoint throws', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    const originalFetch = global.fetch;
    const baseUrl = 'https://llm.example.com/api/llm-request';
    let stage = 'warmup';

    global.fetch = async (url) => {
      if (stage === 'warmup') {
        stage = 'firstFailure';
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (name === 'X-Request-ID' ? 'request-456' : null),
          },
          json: async () => ({
            headers: {
              get: (name) => (name === 'X-Request-ID' ? 'request-456' : null),
            },
          }),
        };
      }

      if (stage === 'firstFailure') {
        stage = 'salvage';
        const error = new Error('primary failure');
        error.status = 503;
        error.body = { reason: 'transient-outage' };
        throw error;
      }

      if (stage === 'salvage') {
        stage = 'retry';
        throw new Error('salvage fetch failed');
      }

      if (stage === 'retry') {
        stage = 'done';
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ message: 'recovered after salvage failure' }),
        };
      }

      throw new Error(`Unexpected fetch stage ${stage} for ${url}`);
    };

    try {
      const warmupResponse = await client.request(baseUrl, { method: 'GET' });
      expect(warmupResponse.headers.get('X-Request-ID')).toBe('request-456');

      const result = await client.request(baseUrl, { method: 'POST' });
      expect(result).toEqual({ message: 'recovered after salvage failure' });

      const warningEvents = dispatcher.events.filter(
        (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
      );
      expect(warningEvents).toHaveLength(1);

      const salvageFailureLogs = logger.debugMessages.filter(({ message }) =>
        message.includes('RetryHttpClient: Salvage recovery failed for request request-456')
      );
      expect(salvageFailureLogs).toHaveLength(1);
      expect(salvageFailureLogs[0].details).toEqual({ error: 'salvage fetch failed' });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('normalizes non-serializable error payloads before dispatching events', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    const originalFetch = global.fetch;
    const firstError = new Error('temporary glitch');
    firstError.status = 503;
    firstError.body = { info: 1n };
    const finalError = new Error('persistent failure');
    finalError.status = 500;
    finalError.body = { info: 2n };

    let callIndex = 0;
    global.fetch = async () => {
      const errorToThrow = callIndex === 0 ? firstError : finalError;
      callIndex += 1;
      throw errorToThrow;
    };

    try {
      await expect(
        client.request('https://llm.example.com/api/llm-request', { method: 'POST' })
      ).rejects.toBe(finalError);

      const warningEvent = dispatcher.events.find(
        (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
      );
      expect(warningEvent.payload.details.raw).toBe('[object Object]');

      const errorEvent = dispatcher.events.find(
        (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(errorEvent.payload.details.raw).toBe('[object Object]');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('dispatches empty raw payloads when both error body and message are missing', async () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    const originalFetch = global.fetch;
    const firstError = new Error();
    firstError.message = undefined;
    firstError.body = undefined;
    const secondError = new Error();
    secondError.message = undefined;
    secondError.body = null;

    let attempt = 0;
    global.fetch = async () => {
      const error = attempt === 0 ? firstError : secondError;
      attempt += 1;
      throw error;
    };

    try {
      await expect(
        client.request('https://llm.example.com/api/llm-request', { method: 'GET' })
      ).rejects.toBe(secondError);

      const warningEvent = dispatcher.events.find(
        (event) => event.eventId === SYSTEM_WARNING_OCCURRED_ID
      );
      expect(warningEvent.payload.details.raw).toBe('');

      const errorEvent = dispatcher.events.find(
        (event) => event.eventId === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(errorEvent.payload.details.raw).toBe('');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
