import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createSecureLogger,
  ensureValidLogger,
} from '../../src/utils/loggerUtils.js';
import { sendProxyError } from '../../src/utils/responseUtils.js';

/**
 * Creates a deterministic logger implementation that records invocations while fully
 * satisfying the ILogger contract used throughout the proxy.
 * @returns {{ logger: import('../../src/interfaces/coreServices.js').ILogger, records: Record<string, Array<[string, any]>> }}
 */
function createRecordingLogger() {
  const records = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  /**
   * @param {keyof typeof records} level
   * @returns {(message: string, context?: any) => void}
   */
  function record(level) {
    return (message, context) => {
      records[level].push([message, context]);
    };
  }

  return {
    logger: {
      debug: record('debug'),
      info: record('info'),
      warn: record('warn'),
      error: record('error'),
    },
    records,
  };
}

describe('logger utils default behaviour integration', () => {
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('retains valid loggers and supports mixed secure logging contexts', () => {
    process.env.NODE_ENV = 'test';

    const { logger, records } = createRecordingLogger();
    const effectiveLogger = ensureValidLogger(logger);

    expect(effectiveLogger).toBe(logger);

    const secureLogger = createSecureLogger(effectiveLogger);

    secureLogger.debug('debug-with-context', { token: 'abc123' });
    secureLogger.debug('debug-without-context');
    secureLogger.info('info-without-context');
    secureLogger.warn('warn-with-sensitive', {
      apiKey: 'sk-valid-999',
      nested: { secret: 'deep-secret' },
    });
    secureLogger.error('error-with-null', null);

    expect(records.debug).toHaveLength(2);
    expect(records.debug[0][1].token).toBe('abc1**');
    expect(records.debug[1][1]).toBeUndefined();

    expect(records.info).toHaveLength(1);
    expect(records.info[0][1]).toBeUndefined();

    expect(records.warn).toHaveLength(1);
    const sanitizedWarn = records.warn[0][1];
    expect(sanitizedWarn.apiKey).toBe('sk-v********');
    expect(sanitizedWarn.nested.secret).toBe('deep*******');

    expect(records.error).toHaveLength(1);
    expect(records.error[0][1]).toBeNull();
  });

  test('falls back to console logging with default prefix when logger contract is incomplete', async () => {
    process.env.NODE_ENV = 'production';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const invalidLogger = { info: () => {} };
    const fallbackLogger = ensureValidLogger(invalidLogger);
    const secureFallback = createSecureLogger(fallbackLogger);

    expect(typeof fallbackLogger.debug).toBe('function');
    expect(typeof fallbackLogger.error).toBe('function');

    expect(warnSpy).toHaveBeenCalledWith(
      'FallbackLogger: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "FallbackLogger".'
    );

    const app = express();
    app.get('/simulate-failure', (_req, res) => {
      sendProxyError(
        res,
        502,
        'default_fallback',
        'Simulated failure using fallback logger',
        { apiKey: 'sk-fallback', nested: { token: 'tok-secret' } },
        'req-fallback',
        secureFallback
      );
    });

    const response = await request(app).get('/simulate-failure');
    expect(response.status).toBe(502);

    fallbackLogger.debug('debug-no-context');
    fallbackLogger.info('info-no-context');

    const debugCall = debugSpy.mock.calls.find(
      ([prefix]) => prefix === 'FallbackLogger: '
    );
    expect(debugCall).toBeDefined();

    const errorCall = errorSpy.mock.calls.find(
      ([prefix]) => prefix === 'FallbackLogger: '
    );
    expect(errorCall).toBeDefined();
    const loggedContext = errorCall[2];
    expect(loggedContext.errorDetailsSentToClient.apiKey).toBe('[MASKED]');
    expect(loggedContext.errorDetailsSentToClient.nested.token).toBe(
      '[MASKED]'
    );

    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
