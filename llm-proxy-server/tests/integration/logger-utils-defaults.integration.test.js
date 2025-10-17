import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  ensureValidLogger,
  createSecureLogger,
} from '../../src/utils/loggerUtils.js';
import { getEnhancedConsoleLogger } from '../../src/logging/enhancedConsoleLogger.js';
import { sendProxyError } from '../../src/utils/responseUtils.js';

/**
 * @description Integration coverage for default logger fallbacks and secure logger behaviour without context objects.
 */
describe('logger utils default fallback integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the default fallback logger prefix when no logger is provided', async () => {
    const app = express();

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    app.get('/default-fallback', (_req, res) => {
      const fallbackLogger = ensureValidLogger(undefined);

      fallbackLogger.info('default-info', { requestId: 'abc-123' });
      fallbackLogger.debug('default-debug-message');

      sendProxyError(
        res,
        502,
        'default-fallback-stage',
        'default fallback error',
        { apiKey: 'sk-integrate-default' },
        'llm-default',
        fallbackLogger
      );
    });

    const response = await request(app).get('/default-fallback');
    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: true,
      message: 'default fallback error',
      stage: 'default-fallback-stage',
      details: { apiKey: 'sk-integrate-default' },
      originalStatusCode: 502,
    });

    expect(infoSpy).toHaveBeenCalledWith('FallbackLogger: ', 'default-info', {
      requestId: 'abc-123',
    });
    expect(debugSpy).toHaveBeenCalledWith(
      'FallbackLogger: ',
      'default-debug-message'
    );

    const errorLogCall = errorSpy.mock.calls.find(
      ([prefix]) => prefix === 'FallbackLogger: '
    );
    expect(errorLogCall).toBeDefined();
    expect(errorLogCall?.[1]).toContain(
      'LLM Proxy Server: Sending error to client'
    );

    expect(
      warnSpy.mock.calls.some(([prefix]) => prefix === 'FallbackLogger: ')
    ).toBe(false);
  });

  it('routes secure logger calls without context and sanitizes structured data', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const baseLogger = getEnhancedConsoleLogger();
    const debugSpy = jest
      .spyOn(baseLogger, 'debug')
      .mockImplementation(() => {});
    const warnSpy = jest.spyOn(baseLogger, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(baseLogger, 'info').mockImplementation(() => {});

    const secureLogger = createSecureLogger(baseLogger);

    const app = express();
    app.get('/secure-no-context', (_req, res) => {
      secureLogger.debug('no-context-debug');
      secureLogger.warn('no-context-warn');
      secureLogger.info('with-context', {
        apiKey: 'sk-context-secret',
        nested: { token: 'inner-token' },
      });
      res.status(204).end();
    });

    const response = await request(app).get('/secure-no-context');
    expect(response.status).toBe(204);

    expect(debugSpy).toHaveBeenCalledWith('no-context-debug', undefined);
    expect(warnSpy).toHaveBeenCalledWith('no-context-warn', undefined);

    const infoCall = infoSpy.mock.calls.find(
      ([message]) => message === 'with-context'
    );
    expect(infoCall).toBeDefined();
    expect(infoCall?.[1]?.apiKey).toMatch(/^sk-c\*+$/);
    expect(infoCall?.[1]?.nested?.token).toMatch(/^inne\*+$/);

    consoleWarnSpy.mockRestore();
  });
});
