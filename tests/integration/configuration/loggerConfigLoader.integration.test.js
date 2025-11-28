/**
 * @file Integration tests for LoggerConfigLoader with real fetchWithRetry behavior.
 * @jest-environment node
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const baseUrl = 'http://logger-config.test';
const nativeFetch = global.fetch;
const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 *
 * @param payload
 * @param init
 */
function jsonResponse(payload, init = {}) {
  const body =
    typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  return new Response(body, {
    status: init.status ?? 200,
    headers: { ...jsonHeaders, ...(init.headers || {}) },
  });
}

class RecordingSafeEventDispatcher {
  constructor() {
    /** @type {{ eventName: string, payload: any }[]} */
    this.events = [];
  }

  /**
   * @param {string} eventName
   * @param {any} payload
   * @returns {Promise<boolean>}
   */
  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    return true;
  }
}

/**
 *
 */
function createRecordingLogger() {
  const logs = { debug: [], info: [], warn: [], error: [] };
  return {
    logs,
    debug(message, ...args) {
      logs.debug.push({ message, args });
    },
    info(message, ...args) {
      logs.info.push({ message, args });
    },
    warn(message, ...args) {
      logs.warn.push({ message, args });
    },
    error(message, ...args) {
      logs.error.push({ message, args });
    },
  };
}

describe('LoggerConfigLoader integration', () => {
  /** @type {(req: { method: string, url: URL, body?: string }) => Promise<Response> | Response} */
  let currentHandler;
  let fetchMock;

  beforeEach(() => {
    currentHandler = () => {
      throw new Error('Test server handler not configured.');
    };

    fetchMock = jest.fn(async (input, init = {}) => {
      if (!nativeFetch) {
        throw new Error('Global fetch is not available for testing.');
      }

      const urlString =
        typeof input === 'string'
          ? input
          : input?.url ?? (input instanceof URL ? input.href : null);

      if (!urlString || !urlString.startsWith(baseUrl)) {
        return nativeFetch(input, init);
      }

      const method = (init.method || 'GET').toUpperCase();
      const url = new URL(urlString);
      const body =
        typeof init.body === 'string'
          ? init.body
          : init.body
          ? JSON.stringify(init.body)
          : undefined;

      return currentHandler({ method, url, body });
    });

    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = nativeFetch;
  });

  const createLoader = () => {
    const logger = createRecordingLogger();
    const safeEventDispatcher = new RecordingSafeEventDispatcher();
    const loader = new LoggerConfigLoader({
      logger,
      safeEventDispatcher,
      configPath: `${baseUrl}/config/logger-config.json`,
    });
    return { loader, logger, safeEventDispatcher };
  };

  it('retrieves logger configuration objects over HTTP', async () => {
    currentHandler = (req) => {
      expect(req.method).toBe('GET');
      expect(req.url.pathname).toBe('/config/logger-config.json');
      return jsonResponse({
        logLevel: 'debug',
        sinks: ['console'],
      });
    };

    const { loader, safeEventDispatcher, logger } = createLoader();
    const result = await loader.loadConfig();

    expect(result).toEqual({ logLevel: 'debug', sinks: ['console'] });
    expect(safeEventDispatcher.events).toHaveLength(0);
    expect(logger.logs.error).toHaveLength(0);
  });

  it('rejects non-object payloads returned by the endpoint', async () => {
    const nonObjectPath = `${baseUrl}/invalid.json`;
    currentHandler = (req) => {
      expect(req.url.pathname).toBe('/invalid.json');
      return new Response('"not-an-object"', {
        status: 200,
        headers: jsonHeaders,
      });
    };

    const { loader, safeEventDispatcher } = createLoader();
    const result = await loader.loadConfig(nonObjectPath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: nonObjectPath,
      })
    );
    expect(safeEventDispatcher.events).toHaveLength(0);
  });

  it('classifies malformed JSON responses as parse failures', async () => {
    const malformedPath = `${baseUrl}/malformed.json`;
    currentHandler = (req) => {
      expect(req.url.pathname).toBe('/malformed.json');
      return new Response('{"incomplete": true', {
        status: 200,
        headers: jsonHeaders,
      });
    };

    const { loader, safeEventDispatcher, logger } = createLoader();
    const result = await loader.loadConfig(malformedPath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
        path: malformedPath,
      })
    );
    expect(logger.logs.error.length).toBeGreaterThanOrEqual(1);
    expect(safeEventDispatcher.events).toHaveLength(0);
  });

  it('returns an empty configuration object when the file has no keys', async () => {
    currentHandler = (req) => {
      expect(req.url.pathname).toBe('/config/logger-config.json');
      return jsonResponse({});
    };

    const { loader, safeEventDispatcher } = createLoader();
    const result = await loader.loadConfig();

    expect(result).toEqual({});
    expect(safeEventDispatcher.events).toHaveLength(0);
  });

  it('treats null payloads as validation errors', async () => {
    const nullPath = `${baseUrl}/null.json`;
    currentHandler = (req) => {
      expect(req.url.pathname).toBe('/null.json');
      return new Response('null', { status: 200, headers: jsonHeaders });
    };

    const { loader } = createLoader();
    const result = await loader.loadConfig(nullPath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: nullPath,
      })
    );
  });

  it('validates non-string logLevel values', async () => {
    const invalidLogLevelPath = `${baseUrl}/invalid-log-level.json`;
    currentHandler = (req) => {
      expect(req.url.pathname).toBe('/invalid-log-level.json');
      return jsonResponse({ logLevel: 123 });
    };

    const { loader, safeEventDispatcher } = createLoader();
    const result = await loader.loadConfig(invalidLogLevelPath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: invalidLogLevelPath,
      })
    );
    expect(safeEventDispatcher.events).toHaveLength(0);
  });

  it('retries transient errors and surfaces fetch failures with dispatched events', async () => {
    const failingPath = `${baseUrl}/fail.json`;
    let requestCount = 0;
    currentHandler = (req) => {
      requestCount += 1;
      expect(req.url.pathname).toBe('/fail.json');
      return jsonResponse({ message: 'upstream failure' }, { status: 500 });
    };

    const { loader, safeEventDispatcher } = createLoader();
    const result = await loader.loadConfig(failingPath);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
        path: failingPath,
      })
    );
    expect(requestCount).toBe(2);
    expect(safeEventDispatcher.events).toHaveLength(1);
    const dispatched = safeEventDispatcher.events[0];
    expect(dispatched.eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(dispatched.payload.message).toContain('status 500');
  });

  it('classifies network-level failures as fetch-stage errors and dispatches events', async () => {
    const networkFailurePath = `${baseUrl}/network.json`;
    currentHandler = () => {
      throw new Error('Fetch should not reach the server when network fails.');
    };

    const { loader, safeEventDispatcher } = createLoader();
    const originalFetch = global.fetch;
    global.fetch = () =>
      Promise.reject(new TypeError('Network request failed: link down'));

    let result;
    try {
      result = await loader.loadConfig(networkFailurePath);
    } finally {
      global.fetch = originalFetch;
    }

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
        path: networkFailurePath,
      })
    );
    expect(safeEventDispatcher.events).toHaveLength(1);
    expect(safeEventDispatcher.events[0].eventName).toBe(
      SYSTEM_ERROR_OCCURRED_ID
    );
    expect(safeEventDispatcher.events[0].payload.message).toContain(
      'network error'
    );
  });

  it('falls back to console logging when logger methods are missing', async () => {
    const malformedPath = `${baseUrl}/non-object.json`;
    currentHandler = (req) => {
      expect(req.url.pathname).toBe('/non-object.json');
      return new Response('"plain-text"', {
        status: 200,
        headers: jsonHeaders,
      });
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const minimalLogger = {
      info() {},
      debug() {},
    };

    const safeEventDispatcher = new RecordingSafeEventDispatcher();
    const loader = new LoggerConfigLoader({
      logger: minimalLogger,
      safeEventDispatcher,
      configPath: `${baseUrl}/config/logger-config.json`,
    });

    const validationResult = await loader.loadConfig(malformedPath);
    expect(validationResult).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: malformedPath,
      })
    );
    expect(warnSpy).toHaveBeenCalled();

    const networkFailurePath = `${baseUrl}/network-fallback.json`;
    const originalFetch = global.fetch;
    global.fetch = () =>
      Promise.reject(
        new TypeError('Network request failed: fallback branch exercised')
      );

    try {
      const networkResult = await loader.loadConfig(networkFailurePath);
      expect(networkResult).toEqual(
        expect.objectContaining({
          error: true,
          stage: 'parse',
          path: networkFailurePath,
        })
      );
    } finally {
      global.fetch = originalFetch;
    }

    expect(errorSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
