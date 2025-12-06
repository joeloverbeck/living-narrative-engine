import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import http from 'http';
import https from 'https';
import { HttpConfigurationProvider } from '../../../src/configuration/httpConfigurationProvider.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

class TestSchemaValidator {
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
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

const originalFetch = globalThis.fetch;

/**
 *
 */
function createNodeCompatibleFetch() {
  return async function testFetch(resource, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(resource);
        if (url.pathname === '/config/reject-string') {
          reject('broken-network');
          return;
        }
        if (url.pathname === '/config/reject-error') {
          reject(new Error('boom-error'));
          return;
        }

        const client = url.protocol === 'https:' ? https : http;

        const request = client.request(
          {
            method: options.method || 'GET',
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            headers: options.headers || {},
          },
          (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
              const buffer = Buffer.concat(chunks);
              const text = buffer.toString('utf8');
              const noStatusText = response.headers['x-no-status-text'];
              const statusTextValue =
                typeof noStatusText !== 'undefined'
                  ? ''
                  : response.statusMessage || '';
              const forceNonErrorJson =
                response.headers['x-force-non-error-json'];
              resolve({
                ok:
                  typeof response.statusCode === 'number' &&
                  response.statusCode >= 200 &&
                  response.statusCode < 300,
                status: response.statusCode ?? 0,
                statusText: statusTextValue,
                headers: {
                  get(name) {
                    const headerKey = name.toLowerCase();
                    const value = response.headers[headerKey];
                    if (Array.isArray(value)) {
                      return value[0] ?? null;
                    }
                    return value ?? null;
                  },
                },
                async json() {
                  if (typeof forceNonErrorJson !== 'undefined') {
                    throw 'broken-json';
                  }
                  return JSON.parse(text);
                },
                async text() {
                  return text;
                },
              });
            });
          }
        );

        request.on('error', (error) => {
          reject(error);
        });

        if (options.body) {
          request.write(options.body);
        }

        request.end();
      } catch (error) {
        reject(error);
      }
    });
  };
}

/**
 *
 */
function createProviderEnvironment() {
  const logger = createLogger();
  const eventBus = new EventBus({ logger });
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('events', SYSTEM_ERROR_OCCURRED_ID, {
    id: SYSTEM_ERROR_OCCURRED_ID,
    name: 'System Error Occurred',
    payloadSchema: null,
  });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });
  const provider = new HttpConfigurationProvider({
    logger,
    safeEventDispatcher,
  });

  const dispatchedEvents = [];
  eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (payload) => {
    dispatchedEvents.push(payload);
  });

  return {
    provider,
    logger,
    dispatchedEvents,
    safeEventDispatcher,
  };
}

describe('HttpConfigurationProvider integration', () => {
  const validConfig = {
    llms: {
      default: 'test-llm',
      providers: [
        {
          id: 'test-llm',
          url: 'http://example.com/api',
          model: 'gpt-test',
        },
      ],
    },
  };

  let server;
  let baseUrl;

  beforeAll(async () => {
    const testFetch = createNodeCompatibleFetch();
    globalThis.fetch = testFetch;
    if (typeof window !== 'undefined') {
      window.fetch = testFetch;
    }

    server = http.createServer((req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.end('Bad Request');
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.url === '/config/success') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(validConfig));
        return;
      }

      if (req.url === '/config/server-error') {
        res.statusCode = 500;
        res.statusMessage = 'Internal Server Error';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'boom' }));
        return;
      }

      if (req.url === '/config/status-without-text') {
        res.statusCode = 503;
        res.statusMessage = '';
        res.setHeader('X-No-Status-Text', 'true');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'unavailable' }));
        return;
      }

      if (req.url === '/config/invalid-json') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end('{"llms": ');
        return;
      }

      if (req.url === '/config/invalid-json-non-error') {
        res.statusCode = 200;
        res.setHeader('X-Force-Non-Error-Json', 'true');
        res.setHeader('Content-Type', 'application/json');
        res.end('{"llms": ');
        return;
      }

      res.statusCode = 404;
      res.statusMessage = 'Not Found';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Failed to determine server address');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) {
      if (typeof window !== 'undefined') {
        window.fetch = originalFetch;
      }
      globalThis.fetch = originalFetch;
      return;
    }
    await new Promise((resolve) => server.close(resolve));
    if (typeof window !== 'undefined') {
      window.fetch = originalFetch;
    }
    globalThis.fetch = originalFetch;
  });

  let environment;

  beforeEach(() => {
    environment = createProviderEnvironment();
  });

  it('requires a safe event dispatcher dependency', () => {
    expect(() => new HttpConfigurationProvider()).toThrow(
      'HttpConfigurationProvider requires ISafeEventDispatcher'
    );
    expect(
      () => new HttpConfigurationProvider({ logger: createLogger() })
    ).toThrow('HttpConfigurationProvider requires ISafeEventDispatcher');
  });

  it('falls back to the console logger when none is provided', async () => {
    const { safeEventDispatcher, dispatchedEvents } = environment;
    const provider = new HttpConfigurationProvider({ safeEventDispatcher });
    const url = `${baseUrl}/config/success`;

    const config = await provider.fetchData(url);

    expect(config).toEqual(validConfig);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('fetches and returns configuration data from an HTTP endpoint', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/success`;

    const config = await provider.fetchData(url);

    expect(config).toEqual(validConfig);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('dispatches a system error when sourceUrl is blank', async () => {
    const { provider, dispatchedEvents } = environment;

    await expect(provider.fetchData('   ')).rejects.toThrow(
      'HttpConfigurationProvider: sourceUrl must be a non-empty string.'
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      message:
        'HttpConfigurationProvider: sourceUrl must be a non-empty string.',
      details: {
        scopeName: 'HttpConfigurationProvider.fetchData',
        url: '   ',
      },
    });
  });

  it('dispatches a system error when HTTP response is not ok with status text', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/server-error`;

    await expect(provider.fetchData(url)).rejects.toThrow(
      `Failed to fetch configuration file from ${url}: Internal Server Error`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      message: expect.stringContaining('Failed to fetch configuration from'),
      details: expect.objectContaining({
        statusCode: 500,
        statusText: 'Internal Server Error',
        url,
      }),
    });
  });

  it('uses fallback status text when the response does not include one', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/status-without-text`;

    await expect(provider.fetchData(url)).rejects.toThrow(
      `Failed to fetch configuration file from ${url}: HTTP status 503`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      details: expect.objectContaining({
        statusCode: 503,
        statusText: 'HTTP status 503',
        url,
      }),
    });
  });

  it('dispatches a system error when JSON parsing fails', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/invalid-json`;

    await expect(provider.fetchData(url)).rejects.toThrow(
      `Failed to parse configuration data from ${url} as JSON`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      message: expect.stringContaining('Failed to parse JSON response'),
      details: expect.objectContaining({
        url,
        scopeName: 'HttpConfigurationProvider.fetchData',
      }),
    });
  });

  it('dispatches a system error when JSON parser throws a non-error value', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/invalid-json-non-error`;

    await expect(provider.fetchData(url)).rejects.toThrow(
      `Failed to parse configuration data from ${url} as JSON`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      details: expect.objectContaining({ url, error: 'broken-json' }),
    });
  });

  it('dispatches a system error when fetch fails before receiving a response', async () => {
    const { provider, dispatchedEvents } = environment;
    const unreachableUrl = 'http://127.0.0.1:65534/unreachable';

    await expect(provider.fetchData(unreachableUrl)).rejects.toThrow(
      `Could not load configuration from ${unreachableUrl}`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      message: expect.stringContaining(
        'Error loading or parsing configuration'
      ),
      details: expect.objectContaining({ url: unreachableUrl }),
    });
  });

  it('dispatches a system error when fetch rejects with a non-error value', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/reject-string`;

    await expect(provider.fetchData(url)).rejects.toThrow(
      `Could not load configuration from ${url}: broken-network`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      details: expect.objectContaining({ url, error: 'broken-network' }),
    });
  });

  it('dispatches a system error when fetch rejects with an Error instance', async () => {
    const { provider, dispatchedEvents } = environment;
    const url = `${baseUrl}/config/reject-error`;

    await expect(provider.fetchData(url)).rejects.toThrow(
      `Could not load configuration from ${url}: boom-error`
    );

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatchedEvents[0].payload).toMatchObject({
      details: expect.objectContaining({ url, error: 'boom-error' }),
    });
  });
});
