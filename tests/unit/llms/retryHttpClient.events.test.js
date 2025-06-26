import { RetryHttpClient } from '../../../src/llms/retryHttpClient.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

// Utility to create logger and dispatcher mocks
const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

/**
 * Helper to create Response objects
 *
 * @param body
 * @param init
 */
function createResponse(body, init) {
  return new Response(body, init);
}

describe('RetryHttpClient event dispatching', () => {
  let logger;
  let dispatcher;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = createDispatcher();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches a warning on a transient HTTP error before succeeding', async () => {
    global.fetch
      .mockResolvedValueOnce(createResponse('Service down', { status: 503 }))
      .mockResolvedValueOnce(createResponse('{"ok":true}', { status: 200 }));

    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    await client.request('https://example.com', { method: 'GET' });

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_WARNING_OCCURRED_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          statusCode: 503,
          url: 'https://example.com',
        }),
      })
    );
    expect(
      dispatcher.dispatch.mock.calls.some(
        (c) => c[0] === SYSTEM_ERROR_OCCURRED_ID
      )
    ).toBe(false);
  });

  it('dispatches an error after exhausting retries', async () => {
    global.fetch.mockResolvedValue(createResponse('Down', { status: 503 }));
    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    await expect(
      client.request('https://fail.test', { method: 'GET' })
    ).rejects.toThrow();

    expect(
      dispatcher.dispatch.mock.calls.some(
        (c) => c[0] === SYSTEM_ERROR_OCCURRED_ID
      )
    ).toBe(true);
  });

  it('emits no events when request succeeds initially', async () => {
    global.fetch.mockResolvedValue(
      createResponse('{"ok":true}', { status: 200 })
    );

    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    await client.request('https://ok.test', { method: 'GET' });

    expectNoDispatch(dispatcher.dispatch);
  });
});
