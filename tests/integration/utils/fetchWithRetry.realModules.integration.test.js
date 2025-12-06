import http from 'node:http';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { fetchWithRetry } from '../../../src/utils/httpUtils.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { RetryManager } from '../../../src/utils/httpRetryManager.js';

class RecordingLogger {
  constructor() {
    this.messages = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #record(level, args) {
    const rendered = args
      .map((value) =>
        typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      )
      .join(' ');
    this.messages[level].push(rendered);
  }

  debug(...args) {
    this.#record('debug', args);
  }

  info(...args) {
    this.#record('info', args);
  }

  warn(...args) {
    this.#record('warn', args);
  }

  error(...args) {
    this.#record('error', args);
  }
}

class StubRegistry {
  getWorldDefinition() {
    return null;
  }

  getAllWorldDefinitions() {
    return [];
  }

  getStartingPlayerId() {
    return 'player-1';
  }

  getStartingLocationId() {
    return 'location-1';
  }

  getActionDefinition() {
    return null;
  }

  getAllActionDefinitions() {
    return [];
  }

  getEntityDefinition() {
    return null;
  }

  getAllEntityDefinitions() {
    return [];
  }

  getEventDefinition(eventId) {
    if (eventId === SYSTEM_ERROR_OCCURRED_ID) {
      return { id: eventId };
    }
    return null;
  }

  getAllEventDefinitions() {
    return [];
  }

  getComponentDefinition() {
    return null;
  }

  getAllComponentDefinitions() {
    return [];
  }

  getConditionDefinition() {
    return null;
  }

  getAllConditionDefinitions() {
    return [];
  }

  getGoalDefinition() {
    return null;
  }

  getAllGoalDefinitions() {
    return [];
  }

  getEntityInstanceDefinition() {
    return null;
  }

  getAllEntityInstanceDefinitions() {
    return [];
  }

  get() {
    return undefined;
  }

  getAll() {
    return [];
  }

  clear() {
    return undefined;
  }

  store() {
    return true;
  }
}

class StubSchemaValidator {
  isSchemaLoaded() {
    return false;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

/**
 *
 */
function createDispatcherEnvironment() {
  const logger = new RecordingLogger();
  const registry = new StubRegistry();
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new StubSchemaValidator();
  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });
  const recordedEvents = [];
  const unsubscribe = safeDispatcher.subscribe(
    SYSTEM_ERROR_OCCURRED_ID,
    (event) => {
      recordedEvents.push(event);
    }
  );

  return {
    logger,
    safeDispatcher,
    recordedEvents,
    unsubscribe,
  };
}

/**
 *
 * @param responder
 */
async function startServer(responder) {
  const requests = [];
  let callIndex = 0;
  const server = http.createServer(async (req, res) => {
    const index = callIndex++;
    requests.push({
      method: req.method,
      url: req.url,
      headers: { ...req.headers },
    });

    try {
      const response = await responder({ req, index });
      const { status = 200, headers = {}, body = '' } = response || {};
      res.writeHead(status, headers);
      res.end(body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ message: 'handler error', details: error.message })
      );
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/**
 *
 * @param url
 * @param options
 */
function nodeFetch(url, options = {}) {
  const target = new URL(url);
  const { method = 'GET', headers = {}, body } = options;

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        method,
        hostname: target.hostname,
        port: target.port || 80,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const textContent = buffer.toString('utf8');
          const headerMap = new Map(
            Object.entries(response.headers).map(([key, value]) => [
              key.toLowerCase(),
              Array.isArray(value) ? value.join(', ') : (value ?? null),
            ])
          );

          const clonedText = async () => textContent;
          resolve({
            status: response.statusCode,
            ok: response.statusCode >= 200 && response.statusCode < 300,
            headers: {
              get(name) {
                return headerMap.get(name.toLowerCase()) ?? null;
              },
            },
            async json() {
              if (!textContent) {
                return null;
              }
              return JSON.parse(textContent);
            },
            async text() {
              return textContent;
            },
            clone() {
              return {
                text: clonedText,
              };
            },
          });
        });
      }
    );

    request.on('error', reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

class RecordingRetryManager extends RetryManager {
  constructor(maxRetries, baseDelayMs, maxDelayMs, logger) {
    super(maxRetries, baseDelayMs, maxDelayMs, logger);
    this.performCalls = [];
  }

  async perform(attemptFn, responseHandler) {
    return super.perform(
      async (attempt) => {
        const result = await attemptFn(attempt);
        if (result && typeof result.status === 'number') {
          this.performCalls.push({
            type: 'response',
            attempt,
            status: result.status,
          });
        }
        return result;
      },
      async (response, attempt) => {
        if (response && typeof response.status === 'number') {
          this.performCalls.push({
            type: 'handler',
            attempt,
            status: response.status,
          });
        }
        return responseHandler(response, attempt);
      }
    );
  }
}

describe('fetchWithRetry real module integration', () => {
  let environment;

  beforeEach(() => {
    environment = createDispatcherEnvironment();
  });

  afterEach(() => {
    if (environment && typeof environment.unsubscribe === 'function') {
      environment.unsubscribe();
    }
  });

  it('performs a successful request without dispatching system errors', async () => {
    const server = await startServer(() => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok' }),
    }));

    try {
      const result = await fetchWithRetry(
        `${server.url}/success`,
        { method: 'GET' },
        2,
        10,
        20,
        environment.safeDispatcher,
        environment.logger,
        nodeFetch
      );

      expect(result).toEqual({ status: 'ok' });
      expect(environment.recordedEvents).toHaveLength(0);
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('retries failing requests and succeeds with a provided retry manager', async () => {
    let responseIndex = 0;
    const responses = [
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'temporary' }),
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'recovered' }),
      },
    ];

    const server = await startServer(() => responses[responseIndex++]);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.25);
    const retryManager = new RecordingRetryManager(
      3,
      5,
      10,
      environment.logger
    );

    try {
      const result = await fetchWithRetry(
        `${server.url}/unstable`,
        { method: 'GET' },
        3,
        5,
        10,
        environment.safeDispatcher,
        environment.logger,
        nodeFetch,
        retryManager
      );

      expect(result).toEqual({ status: 'recovered' });
      expect(server.requests.length).toBeGreaterThanOrEqual(2);
      expect(environment.recordedEvents).toHaveLength(0);
      expect(
        retryManager.performCalls.some(
          (entry) => entry.type === 'handler' && entry.status === 500
        )
      ).toBe(true);
    } finally {
      randomSpy.mockRestore();
      await server.close();
    }
  });

  it('honors Retry-After headers when retrying throttled responses', async () => {
    let callNumber = 0;
    const server = await startServer(() => {
      callNumber += 1;
      if (callNumber === 1) {
        return {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'retry later' }),
        };
      }
      if (callNumber === 2) {
        return {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '0.01',
          },
          body: JSON.stringify({ error: 'Too Many Requests' }),
        };
      }
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const result = await fetchWithRetry(
        `${server.url}/throttled`,
        { method: 'GET' },
        3,
        5,
        10,
        environment.safeDispatcher,
        environment.logger,
        nodeFetch
      );

      expect(result).toEqual({ success: true });
      const warnMessages = environment.logger.messages.warn.join(' ');
      expect(warnMessages).toContain('Retrying in 5ms');
      expect(warnMessages).toContain('Retrying in 10ms');
      expect(server.requests.length).toBeGreaterThanOrEqual(3);
    } finally {
      randomSpy.mockRestore();
      await server.close();
    }
  });

  it('dispatches system error events for non-retryable HTTP responses', async () => {
    const server = await startServer(() => ({
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: 'invalid input',
    }));

    try {
      await expect(
        fetchWithRetry(
          `${server.url}/bad-request`,
          { method: 'POST', body: JSON.stringify({ value: 1 }) },
          2,
          5,
          10,
          environment.safeDispatcher,
          environment.logger,
          nodeFetch
        )
      ).rejects.toMatchObject({
        status: 400,
        body: 'invalid input',
      });

      expect(environment.recordedEvents).toHaveLength(1);
      const dispatchedEvent = environment.recordedEvents[0];
      expect(dispatchedEvent.type).toBe(SYSTEM_ERROR_OCCURRED_ID);
      expect(dispatchedEvent.payload.message).toContain('invalid input');
    } finally {
      await server.close();
    }
  });

  it('preserves structured error payloads for non-retryable responses', async () => {
    const server = await startServer(() => ({
      status: 422,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'invalid', reason: 'bad data' }),
    }));

    try {
      await expect(
        fetchWithRetry(
          `${server.url}/structured-error`,
          { method: 'DELETE' },
          2,
          5,
          10,
          environment.safeDispatcher,
          environment.logger,
          nodeFetch
        )
      ).rejects.toMatchObject({
        status: 422,
        body: { code: 'invalid', reason: 'bad data' },
      });

      expect(environment.recordedEvents).toHaveLength(1);
      const dispatchedEvent = environment.recordedEvents[0];
      expect(dispatchedEvent.payload.message).toContain('structured-error');
      expect(dispatchedEvent.payload.details.body).toMatchObject({
        code: 'invalid',
      });
    } finally {
      await server.close();
    }
  });

  it('wraps persistent network failures and dispatches error events', async () => {
    const failingFetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await expect(
      fetchWithRetry(
        'https://example.invalid/resource',
        { method: 'GET' },
        2,
        5,
        10,
        environment.safeDispatcher,
        environment.logger,
        failingFetch
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('persistent network error'),
    });

    expect(environment.recordedEvents).toHaveLength(1);
    const eventPayload = environment.recordedEvents[0].payload;
    expect(eventPayload.message).toContain(
      'Failed for https://example.invalid/resource'
    );
    expect(eventPayload.details.originalErrorName).toBe('TypeError');
  });

  it('handles alternate network failure messaging consistently', async () => {
    const failingFetch = async () => {
      throw new TypeError('Network request failed');
    };

    await expect(
      fetchWithRetry(
        'https://example.invalid/alt',
        { method: 'GET' },
        2,
        5,
        10,
        environment.safeDispatcher,
        environment.logger,
        failingFetch
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('Network request failed'),
    });

    expect(environment.recordedEvents).toHaveLength(1);
    expect(
      environment.recordedEvents[0].payload.details.originalErrorMessage
    ).toBe('Network request failed');
  });

  it('sets credentials to omit for localhost requests when necessary', async () => {
    const capturedOptions = [];
    const capturingFetch = async (url, options) => {
      capturedOptions.push({ url, options: { ...options } });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await fetchWithRetry(
      'http://localhost:8123/test',
      {},
      1,
      5,
      10,
      environment.safeDispatcher,
      environment.logger,
      capturingFetch
    );

    expect(result).toEqual({ ok: true });
    expect(capturedOptions).toHaveLength(1);
    expect(capturedOptions[0].options.credentials).toBe('omit');
    expect(environment.recordedEvents).toHaveLength(0);
  });

  it('falls back to the global fetch implementation when none is provided', async () => {
    const server = await startServer(() => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handled: true }),
    }));

    const originalFetch = global.fetch;
    global.fetch = nodeFetch;

    try {
      const result = await fetchWithRetry(
        `${server.url}/default`,
        { method: 'GET' },
        1,
        5,
        10,
        environment.safeDispatcher,
        environment.logger
      );

      expect(result).toEqual({ handled: true });
      expect(environment.recordedEvents).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
      await server.close();
    }
  });
});
