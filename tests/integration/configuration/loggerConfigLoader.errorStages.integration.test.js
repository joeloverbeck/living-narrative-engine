/**
 * @file Integration tests covering LoggerConfigLoader error stage classification.
 */
import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
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

const DEFAULT_CONFIG_URL = 'https://integration.test/config/logger-config.json';
const NON_JSON_CONFIG_URL = 'https://integration.test/config/logger-config';

/**
 * @param {(url: string, options: RequestInit) => Promise<Response>} fetchImpl
 * @param {string} [configPath]
 */
async function runLoaderWithFetch(fetchImpl, configPath = DEFAULT_CONFIG_URL) {
  const safeEventDispatcher = new RecordingSafeEventDispatcher();
  const logger = createRecordingLogger();
  const loader = new LoggerConfigLoader({
    logger,
    safeEventDispatcher,
    configPath,
  });

  const previousFetch = global.fetch;
  global.fetch = fetchImpl;

  try {
    const result = await loader.loadConfig();
    return { result, safeEventDispatcher, logger };
  } finally {
    global.fetch = previousFetch;
  }
}

describe('LoggerConfigLoader integration - error stage classification', () => {
  /** @type {typeof fetch | undefined} */
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('classifies HTTP status failures as fetch-stage issues and preserves status codes', async () => {
    let callCount = 0;
    const body = JSON.stringify({ error: 'bad-request' });

    const fetchImpl = async (url) => {
      expect(url).toBe(NON_JSON_CONFIG_URL);
      callCount += 1;
      return new Response(body, {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const { result, safeEventDispatcher } = await runLoaderWithFetch(
      fetchImpl,
      NON_JSON_CONFIG_URL
    );

    expect(callCount).toBe(1);
    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch',
        path: NON_JSON_CONFIG_URL,
      })
    );
    expect(result.message).toContain('status 400');
    expect(safeEventDispatcher.events).toHaveLength(1);
    expect(safeEventDispatcher.events[0]).toEqual(
      expect.objectContaining({ eventName: SYSTEM_ERROR_OCCURRED_ID })
    );
  });

  it.each([
    [
      'failed to fetch keyword is recognized',
      new TypeError('Failed to fetch: offline mode enforced'),
    ],
    [
      'network keyword covers broader connectivity failures',
      new TypeError('Network request failed because router offline'),
    ],
    [
      'not found keyword is treated as fetch error when provided by upstream services',
      new Error('Resource not found in configuration registry'),
    ],
  ])('returns fetch stage when %s', async (_label, thrownError) => {
    const fetchImpl = async () => {
      throw thrownError;
    };

    const { result, safeEventDispatcher } = await runLoaderWithFetch(
      fetchImpl,
      NON_JSON_CONFIG_URL
    );

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch',
        path: NON_JSON_CONFIG_URL,
      })
    );

    if (thrownError instanceof TypeError) {
      expect(safeEventDispatcher.events.length).toBeGreaterThan(0);
    } else {
      expect(safeEventDispatcher.events).toHaveLength(0);
    }
  });

  it.each([
    [
      'json keyword maps to parse stage classification',
      new Error('json structure invalid for logger config'),
    ],
    [
      'parse keyword results in parse stage classification',
      new Error('parse failure encountered during logger config load'),
    ],
    [
      'token keyword results in parse stage classification',
      new Error('unexpected token } encountered while parsing config'),
    ],
  ])('returns parse stage when %s', async (_label, thrownError) => {
    const fetchImpl = async () => {
      throw thrownError;
    };

    const { result, safeEventDispatcher } = await runLoaderWithFetch(fetchImpl);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
        path: DEFAULT_CONFIG_URL,
      })
    );
    expect(safeEventDispatcher.events).toHaveLength(0);
  });

  it('keeps fetch_or_parse stage when an error message lacks keywords', async () => {
    const fetchImpl = async () => {
      throw new Error('mystery failure without diagnostic keywords');
    };

    const { result } = await runLoaderWithFetch(fetchImpl, NON_JSON_CONFIG_URL);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch_or_parse',
        path: NON_JSON_CONFIG_URL,
      })
    );
  });

  it('keeps fetch_or_parse stage when the thrown error has no message', async () => {
    const fetchImpl = async () => {
      throw { message: '' };
    };

    const { result } = await runLoaderWithFetch(fetchImpl, NON_JSON_CONFIG_URL);

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch_or_parse',
        path: NON_JSON_CONFIG_URL,
      })
    );
  });
});
