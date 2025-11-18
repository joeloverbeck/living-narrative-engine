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
import http from 'node:http';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

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
  /** @type {http.Server} */
  let server;
  /** @type {string} */
  let baseUrl;
  /** @type {(req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>} */
  let currentHandler;

  beforeEach(async () => {
    currentHandler = () => {
      throw new Error('Test server handler not configured.');
    };
    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      Promise.resolve(currentHandler(req, res)).catch((error) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: 'Unhandled test server error',
            message: error.message,
          })
        );
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = /** @type {import('node:net').AddressInfo} */ (server.address());
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
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
    currentHandler = (req, res) => {
      expect(req.method).toBe('GET');
      expect(req.url).toBe('/config/logger-config.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          logLevel: 'debug',
          sinks: ['console'],
        })
      );
    };

    const { loader, safeEventDispatcher, logger } = createLoader();
    const result = await loader.loadConfig();

    expect(result).toEqual({ logLevel: 'debug', sinks: ['console'] });
    expect(safeEventDispatcher.events).toHaveLength(0);
    expect(logger.logs.error).toHaveLength(0);
  });

  it('rejects non-object payloads returned by the endpoint', async () => {
    const nonObjectPath = `${baseUrl}/invalid.json`;
    currentHandler = (req, res) => {
      expect(req.url).toBe('/invalid.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end('"not-an-object"');
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
    currentHandler = (req, res) => {
      expect(req.url).toBe('/malformed.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end('{"incomplete": true');
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
    currentHandler = (req, res) => {
      expect(req.url).toBe('/config/logger-config.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    };

    const { loader, safeEventDispatcher } = createLoader();
    const result = await loader.loadConfig();

    expect(result).toEqual({});
    expect(safeEventDispatcher.events).toHaveLength(0);
  });

  it('treats null payloads as validation errors', async () => {
    const nullPath = `${baseUrl}/null.json`;
    currentHandler = (req, res) => {
      expect(req.url).toBe('/null.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end('null');
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
    currentHandler = (req, res) => {
      expect(req.url).toBe('/invalid-log-level.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end('{"logLevel": 123}');
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
    currentHandler = (req, res) => {
      requestCount += 1;
      expect(req.url).toBe('/fail.json');
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'upstream failure' }));
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
    currentHandler = (req, res) => {
      expect(req.url).toBe('/non-object.json');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end('"plain-text"');
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
