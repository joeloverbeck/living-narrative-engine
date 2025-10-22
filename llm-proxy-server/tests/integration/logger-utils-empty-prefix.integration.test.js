import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createSecureLogger, ensureValidLogger } from '../../src/utils/loggerUtils.js';
import { sendProxyError } from '../../src/utils/responseUtils.js';

const ORIGINAL_ENV = { ...process.env };

describe('logger utils empty prefix fallback integration', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  test('retains silent prefix when fallbackMessagePrefix is empty while masking sensitive data', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const invalidLogger = { info: () => {} };
    const fallbackLogger = ensureValidLogger(invalidLogger, '');

    expect(typeof fallbackLogger.error).toBe('function');
    expect(typeof fallbackLogger.debug).toBe('function');

    const initializationWarning = warnSpy.mock.calls.find(([, message]) =>
      typeof message === 'string' && message.includes('invalid logger instance')
    );
    expect(initializationWarning).toBeDefined();
    expect(initializationWarning?.[0]).toBe('');

    const secureLogger = createSecureLogger(fallbackLogger);

    const app = express();
    app.get('/simulate', (_req, res) => {
      secureLogger.warn('observability-branch', {
        apiKey: '',
        token: undefined,
        nested: {
          secret: null,
          authorization: 'A',
          password: 'pw',
          api_key: 'prod',
          token: 'Z',
        },
      });

      sendProxyError(
        res,
        401,
        'integration_fallback',
        'Missing credentials',
        {
          apiKey: '',
          nested: {
            authorization: null,
            token: 'z',
            chain: [{ apiKey: 'abc' }, { apiKey: 'abcd' }, { apiKey: 'abcde' }],
          },
        },
        'llm-integration-empty-prefix',
        secureLogger
      );
    });

    const response = await request(app).get('/simulate');
    expect(response.status).toBe(401);
    expect(response.body.details.nested.chain).toHaveLength(3);

    const sanitizedWarnCall = warnSpy.mock.calls.find(([, message]) => message === 'observability-branch');
    expect(sanitizedWarnCall).toBeDefined();
    expect(sanitizedWarnCall?.[0]).toBe('');
    const sanitizedWarnContext = sanitizedWarnCall?.[2];
    expect(sanitizedWarnContext).toBeDefined();
    expect(sanitizedWarnContext.apiKey).toBe('[EMPTY]');
    expect(sanitizedWarnContext.token).toBe('[UNDEFINED]');
    expect(sanitizedWarnContext.nested.secret).toBe('[NULL]');
    expect(sanitizedWarnContext.nested.authorization).toBe('*');
    expect(sanitizedWarnContext.nested.password).toBe('p*');
    expect(sanitizedWarnContext.nested.api_key).toBe('p***');
    expect(sanitizedWarnContext.nested.token).toBe('*');

    const errorCall = errorSpy.mock.calls.find(([, message]) =>
      typeof message === 'string' && message.includes('LLM Proxy Server: Sending error to client')
    );
    expect(errorCall).toBeDefined();
    expect(errorCall?.[0]).toBe('');
    const errorContext = errorCall?.[2]?.errorDetailsSentToClient;
    expect(errorContext).toBeDefined();
    expect(errorContext.apiKey).toBe('[EMPTY]');
    expect(errorContext.nested.authorization).toBe('[NULL]');
    expect(errorContext.nested.token).toBe('*');
    expect(errorContext.nested.chain[0].apiKey).toBe('a**');
    expect(errorContext.nested.chain[1].apiKey).toBe('a***');
    expect(errorContext.nested.chain[2].apiKey).toBe('abcd*');

    expect(infoSpy.mock.calls.every(([prefix]) => prefix === '')).toBe(true);
    expect(debugSpy.mock.calls.every(([prefix]) => prefix === '')).toBe(true);
  });
});
