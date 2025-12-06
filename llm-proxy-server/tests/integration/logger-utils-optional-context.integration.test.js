import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createSecureLogger } from '../../src/utils/loggerUtils.js';
import { getEnhancedConsoleLogger } from '../../src/logging/enhancedConsoleLogger.js';

/**
 * @description Integration tests for secure logger handling when optional contexts are omitted.
 */
describe('logger utils optional context integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes through undefined contexts without invoking sanitization', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const baseLogger = getEnhancedConsoleLogger();
    const debugSpy = jest
      .spyOn(baseLogger, 'debug')
      .mockImplementation(() => {});
    const infoSpy = jest.spyOn(baseLogger, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(baseLogger, 'warn').mockImplementation(() => {});
    const errorSpy = jest
      .spyOn(baseLogger, 'error')
      .mockImplementation(() => {});

    const secureLogger = createSecureLogger(baseLogger);

    const app = express();
    app.get('/secure-optional-context', (_req, res) => {
      secureLogger.debug('debug-no-context');
      secureLogger.info('info-no-context');
      secureLogger.warn('warn-no-context');
      secureLogger.error('error-no-context');
      res.status(204).end();
    });

    const response = await request(app).get('/secure-optional-context');
    expect(response.status).toBe(204);

    expect(debugSpy).toHaveBeenCalledWith('debug-no-context', undefined);
    expect(infoSpy).toHaveBeenCalledWith('info-no-context', undefined);
    expect(warnSpy).toHaveBeenCalledWith('warn-no-context', undefined);
    expect(errorSpy).toHaveBeenCalledWith('error-no-context', undefined);

    consoleWarnSpy.mockRestore();
  });
});
