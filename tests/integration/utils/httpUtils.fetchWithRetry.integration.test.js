import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fetchWithRetry } from '../../../src/utils/httpUtils.js';
import { RetryManager } from '../../../src/utils/httpRetryManager.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const noopSchemaValidator = {
  isSchemaLoaded: () => true,
  validate: () => ({ isValid: true, errors: [] }),
};

/**
 *
 */
function createIntegrationEnvironment() {
  const logger = new ConsoleLogger('DEBUG');
  const eventBus = new EventBus({ logger });
  const registry = new InMemoryDataRegistry({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);

  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator: noopSchemaValidator,
    logger,
  });

  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  return {
    logger,
    eventBus,
    safeEventDispatcher,
  };
}

/**
 *
 * @param root0
 * @param root0.ok
 * @param root0.status
 * @param root0.statusText
 * @param root0.body
 * @param root0.headers
 */
function createResponse({
  ok,
  status,
  statusText = '',
  body,
  headers = {},
}) {
  const serializedBody =
    typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const headerEntries = Object.entries(headers).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]);
  const headerMap = new Map(headerEntries);

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name) => headerMap.get(name.toLowerCase()) ?? null,
    },
    async json() {
      return typeof body === 'undefined' ? null : body;
    },
    async text() {
      return serializedBody;
    },
    clone() {
      return {
        text: () => Promise.resolve(serializedBody),
      };
    },
  };
}

describe('fetchWithRetry integration', () => {
  let logger;
  let eventBus;
  let safeEventDispatcher;
  let randomSpy;

  beforeEach(() => {
    ({ logger, eventBus, safeEventDispatcher } = createIntegrationEnvironment());
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    randomSpy.mockRestore();
  });

  it('retries transient network errors and succeeds', async () => {
    jest.useFakeTimers();

    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        createResponse({ ok: true, status: 200, body: { ok: true } })
      );

    const retryManager = new RetryManager(3, 40, 500, logger);

    const fetchPromise = fetchWithRetry(
      'http://localhost/api/data',
      { method: 'GET' },
      3,
      40,
      500,
      safeEventDispatcher,
      logger,
      fetchFn,
      retryManager
    );

    await jest.advanceTimersByTimeAsync(40);
    const result = await fetchPromise;

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('uses Retry-After headers for HTTP 429 responses before succeeding', async () => {
    jest.useFakeTimers();

    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          body: { error: 'slow down' },
          headers: { 'Retry-After': '0.05' },
        })
      )
      .mockResolvedValueOnce(
        createResponse({ ok: true, status: 200, body: { data: 'ready' } })
      );

    const resultPromise = fetchWithRetry(
      'https://api.example.com/resource',
      { method: 'POST' },
      3,
      50,
      1000,
      safeEventDispatcher,
      logger,
      fetchFn
    );

    await jest.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result).toEqual({ data: 'ready' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('dispatches system error events when retries are exhausted', async () => {
    const errorResponse = createResponse({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      body: { error: 'boom' },
    });
    const fetchFn = jest.fn().mockResolvedValue(errorResponse);

    const receivedEvents = [];
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
      receivedEvents.push(event);
    });

    const failingPromise = fetchWithRetry(
      'https://api.example.com/fail',
      { method: 'GET' },
      2,
      30,
      200,
      safeEventDispatcher,
      logger,
      fetchFn
    );

    await expect(failingPromise).rejects.toThrow(
      /API request to https:\/\/api.example.com\/fail failed after 2 attempt\(s\)/
    );

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(receivedEvents[0].payload.message).toContain(
      'fetchWithRetry: API request to https://api.example.com/fail failed after 2 attempt(s)'
    );
    expect(receivedEvents[0].payload.details.status).toBe(500);
  });
});
