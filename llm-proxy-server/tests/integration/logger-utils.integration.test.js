import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

import { loadProxyLlmConfigs } from '../../src/proxyLlmConfigLoader.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { getEnhancedConsoleLogger } from '../../src/logging/enhancedConsoleLogger.js';
import {
  createSecureLogger,
  ensureValidLogger,
} from '../../src/utils/loggerUtils.js';
import { sendProxyError } from '../../src/utils/responseUtils.js';

const createSensitiveDetails = () => ({
  apiKey: 'sk-secret98765',
  token: undefined,
  authorization: 'Bearer super',
  password: 'hunter2',
  secret: 'closet',
  safeValue: 'visible',
  optionalContext: null,
  nested: {
    secret: '',
    child: {
      authorization: null,
      api_key: 'abcd',
      password: 'p455',
      deeper: {
        token: 'ABCDE',
      },
    },
    array: [
      { apiKey: 'A' },
      { apiKey: 'AB' },
      { apiKey: 'ABCD' },
      { apiKey: 'ABCDE' },
      { apiKey: null },
      { apiKey: undefined },
      { apiKey: '' },
    ],
  },
});

const buildTestApp = (logger, details) => {
  const app = express();
  app.get('/trigger-error', (_req, res) => {
    sendProxyError(
      res,
      500,
      'integration_test',
      'Simulated failure',
      details,
      'llm-test',
      logger
    );
  });
  return app;
};

describe('logger utils integration coverage', () => {
  describe('ensureValidLogger with proxy configuration loader', () => {
    let warnSpy;
    let debugSpy;
    let errorSpy;

    afterEach(() => {
      if (warnSpy) {
        warnSpy.mockRestore();
      }
      if (debugSpy) {
        debugSpy.mockRestore();
      }
      if (errorSpy) {
        errorSpy.mockRestore();
      }
    });

    test('falls back to console logging when loader receives an invalid logger', async () => {
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'logger-utils-integration-')
      );
      const configPath = path.join(tempDir, 'llm-configs.json');
      const fileContents = JSON.stringify({
        defaultConfigId: 'default-model',
        configs: {
          'default-model': {
            provider: 'test',
            model: 'integration',
          },
        },
      });
      await fs.writeFile(configPath, fileContents, 'utf-8');

      const invalidLogger = {
        info: () => {},
      };

      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const fileReader = new NodeFileSystemReader();
      const result = await loadProxyLlmConfigs(
        configPath,
        invalidLogger,
        fileReader
      );

      expect(result.error).toBe(false);
      expect(result.llmConfigs).toEqual(JSON.parse(fileContents));
      expect(warnSpy).toHaveBeenCalledWith(
        'ProxyLlmConfigLoader: ',
        'An invalid logger instance was provided. Falling back to console logging with prefix "ProxyLlmConfigLoader".'
      );
      expect(debugSpy).toHaveBeenCalledWith(
        'ProxyLlmConfigLoader: ',
        expect.stringContaining('Attempting to load LLM configurations from:')
      );

      await fs.writeFile(configPath, '{ "bad": true', 'utf-8');
      const errorResult = await loadProxyLlmConfigs(
        configPath,
        invalidLogger,
        fileReader
      );

      expect(errorResult.error).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(
        'ProxyLlmConfigLoader: ',
        expect.stringContaining('Failed to parse LLM configurations'),
        expect.objectContaining({ errorStage: 'parse_json_syntax_error' })
      );

      await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('retries leverage fallback logging when logger is invalid', async () => {
      const invalidLogger = { info: () => {} };
      const warnSpyLocal = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const debugSpyLocal = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});
      const infoSpyLocal = jest
        .spyOn(console, 'info')
        .mockImplementation(() => {});

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

      const { RetryManager } = await import('../../src/utils/proxyApiUtils.js');
      const retryManager = new RetryManager(
        'https://example.com/resource',
        { method: 'GET' },
        1,
        10,
        20,
        invalidLogger
      );

      const result = await retryManager.executeWithRetry();
      expect(result).toEqual({ ok: true });

      expect(warnSpyLocal).toHaveBeenCalledWith(
        'RetryManager: ',
        'An invalid logger instance was provided. Falling back to console logging with prefix "RetryManager".'
      );
      expect(debugSpyLocal).toHaveBeenCalledWith(
        'RetryManager: ',
        expect.stringContaining(
          'Initiating request sequence for https://example.com/resource'
        )
      );
      expect(infoSpyLocal).toHaveBeenCalledWith(
        'RetryManager: ',
        expect.stringContaining(
          'Successfully fetched and parsed JSON from https://example.com/resource'
        )
      );

      warnSpyLocal.mockRestore();
      debugSpyLocal.mockRestore();
      infoSpyLocal.mockRestore();
      if (originalFetch) {
        global.fetch = originalFetch;
      } else {
        delete global.fetch;
      }
    });
  });

  describe('secure logger masking via sendProxyError', () => {
    let enhancedLogger;
    let originalNodeEnv;

    beforeAll(() => {
      enhancedLogger = getEnhancedConsoleLogger();
    });

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('masks sensitive data in production logs', async () => {
      process.env.NODE_ENV = 'production';
      const secureLogger = enhancedLogger.createSecure();
      const errorSpy = jest
        .spyOn(enhancedLogger, 'error')
        .mockImplementation(() => {});
      const warnSpy = jest
        .spyOn(enhancedLogger, 'warn')
        .mockImplementation(() => {});
      const infoSpy = jest
        .spyOn(enhancedLogger, 'info')
        .mockImplementation(() => {});
      const debugSpy = jest
        .spyOn(enhancedLogger, 'debug')
        .mockImplementation(() => {});

      const app = buildTestApp(secureLogger, createSensitiveDetails());
      const response = await request(app).get('/trigger-error');
      expect(response.status).toBe(500);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedContext = errorSpy.mock.calls[0][1];
      const sanitized = loggedContext.errorDetailsSentToClient;

      expect(sanitized.apiKey).toBe('[MASKED]');
      expect(sanitized.token).toBe('[UNDEFINED]');
      expect(sanitized.authorization).toBe('[MASKED]');
      expect(sanitized.password).toBe('[MASKED]');
      expect(sanitized.secret).toBe('[MASKED]');
      expect(sanitized.safeValue).toBe('visible');
      expect(sanitized.nested.secret).toBe('[EMPTY]');
      expect(sanitized.nested.child.authorization).toBe('[NULL]');
      expect(sanitized.nested.child.api_key).toBe('[MASKED]');
      expect(sanitized.nested.child.password).toBe('[MASKED]');
      expect(sanitized.nested.child.deeper.token).toBe('[MASKED]');
      expect(sanitized.nested.array[0].apiKey).toBe('[MASKED]');
      expect(sanitized.nested.array[1].apiKey).toBe('[MASKED]');
      expect(sanitized.nested.array[2].apiKey).toBe('[MASKED]');
      expect(sanitized.nested.array[3].apiKey).toBe('[MASKED]');
      expect(sanitized.nested.array[4].apiKey).toBe('[NULL]');
      expect(sanitized.nested.array[5].apiKey).toBe('[UNDEFINED]');
      expect(sanitized.nested.array[6].apiKey).toBe('[EMPTY]');

      secureLogger.info('manual info context', {
        optionalContext: null,
        safeValue: 'manual',
      });
      secureLogger.warn('manual warn context', null);
      secureLogger.debug('manual debug context', 'trace');

      expect(infoSpy).toHaveBeenCalledWith('manual info context', {
        optionalContext: null,
        safeValue: 'manual',
      });
      expect(warnSpy).toHaveBeenCalledWith('manual warn context', null);
      expect(debugSpy).toHaveBeenCalledWith('manual debug context', 'trace');

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });

    test('retains contextual structure while partially masking in development', async () => {
      process.env.NODE_ENV = 'development';
      const secureLogger = enhancedLogger.createSecure();
      const errorSpy = jest
        .spyOn(enhancedLogger, 'error')
        .mockImplementation(() => {});
      const warnSpy = jest
        .spyOn(enhancedLogger, 'warn')
        .mockImplementation(() => {});
      const infoSpy = jest
        .spyOn(enhancedLogger, 'info')
        .mockImplementation(() => {});
      const debugSpy = jest
        .spyOn(enhancedLogger, 'debug')
        .mockImplementation(() => {});

      const app = buildTestApp(secureLogger, createSensitiveDetails());
      const response = await request(app).get('/trigger-error');
      expect(response.status).toBe(500);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedContext = errorSpy.mock.calls[0][1];
      const sanitized = loggedContext.errorDetailsSentToClient;

      const expectMasked = (original) => {
        if (original === null) return '[NULL]';
        if (original === undefined) return '[UNDEFINED]';
        if (original === '') return '[EMPTY]';
        if (original.length <= 1) {
          return '*'.repeat(original.length);
        }
        if (original.length <= 4) {
          const firstChar = original.charAt(0);
          return firstChar + '*'.repeat(original.length - 1);
        }
        const visible = original.substring(0, 4);
        return visible + '*'.repeat(original.length - 4);
      };

      expect(sanitized.apiKey).toBe(expectMasked('sk-secret98765'));
      expect(sanitized.token).toBe('[UNDEFINED]');
      expect(sanitized.authorization).toBe(expectMasked('Bearer super'));
      expect(sanitized.password).toBe(expectMasked('hunter2'));
      expect(sanitized.secret).toBe(expectMasked('closet'));
      expect(sanitized.safeValue).toBe('visible');
      expect(sanitized.nested.secret).toBe('[EMPTY]');
      expect(sanitized.nested.child.authorization).toBe('[NULL]');
      expect(sanitized.nested.child.api_key).toBe(expectMasked('abcd'));
      expect(sanitized.nested.child.password).toBe(expectMasked('p455'));
      expect(sanitized.nested.child.deeper.token).toBe(expectMasked('ABCDE'));
      expect(sanitized.nested.array[0].apiKey).toBe(expectMasked('A'));
      expect(sanitized.nested.array[1].apiKey).toBe(expectMasked('AB'));
      expect(sanitized.nested.array[2].apiKey).toBe(expectMasked('ABCD'));
      expect(sanitized.nested.array[3].apiKey).toBe(expectMasked('ABCDE'));
      expect(sanitized.nested.array[4].apiKey).toBe('[NULL]');
      expect(sanitized.nested.array[5].apiKey).toBe('[UNDEFINED]');
      expect(sanitized.nested.array[6].apiKey).toBe('[EMPTY]');

      secureLogger.info('manual info context', {
        optionalContext: null,
        safeValue: 'manual',
      });
      secureLogger.warn('manual warn context', null);
      secureLogger.debug('manual debug context', 'trace');

      expect(infoSpy).toHaveBeenCalledWith('manual info context', {
        optionalContext: null,
        safeValue: 'manual',
      });
      expect(warnSpy).toHaveBeenCalledWith('manual warn context', null);
      expect(debugSpy).toHaveBeenCalledWith('manual debug context', 'trace');

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe('additional logger utility fallbacks', () => {
    let originalNodeEnv;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('provides console logger with blank prefix when no logger is supplied', () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      const fallback = ensureValidLogger(undefined, '');
      fallback.info('info-event');
      fallback.warn('warn-event', { code: 42 });
      fallback.error('error-event');
      fallback.debug('debug-event');

      expect(infoSpy).toHaveBeenCalledWith('', 'info-event');
      expect(warnSpy).toHaveBeenCalledWith('', 'warn-event', { code: 42 });
      expect(errorSpy).toHaveBeenCalledWith('', 'error-event');
      expect(debugSpy).toHaveBeenCalledWith('', 'debug-event');

      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      debugSpy.mockRestore();
    });

    test('createSecureLogger sanitizes nested structures without express helpers', () => {
      process.env.NODE_ENV = 'production';

      const captured = { debug: [], info: [], warn: [], error: [] };
      const baseLogger = {
        debug: (message, context) => captured.debug.push({ message, context }),
        info: (message, context) => captured.info.push({ message, context }),
        warn: (message, context) => captured.warn.push({ message, context }),
        error: (message, context) => captured.error.push({ message, context }),
      };

      const secureLogger = createSecureLogger(baseLogger);
      const complexContext = {
        apiKey: 'sk-integration',
        nested: {
          token: 'tok-secret',
          list: [
            { password: 'pass-1' },
            { values: ['safe', { secret: 'deep' }] },
          ],
        },
        mixedArray: ['text', 123, { authorization: 'Bearer token' }],
      };

      secureLogger.debug('dbg', complexContext);
      secureLogger.info('inf', { safe: true, api_key: 'key-42' });
      secureLogger.warn('warn', ['array-entry', { secret: '' }]);
      secureLogger.error('err');

      expect(captured.debug[0].context.apiKey).toBe('[MASKED]');
      expect(captured.debug[0].context.nested.token).toBe('[MASKED]');
      expect(captured.debug[0].context.nested.list[0].password).toBe(
        '[MASKED]'
      );
      expect(captured.debug[0].context.nested.list[1].values[1].secret).toBe(
        '[MASKED]'
      );
      expect(captured.debug[0].context.mixedArray[2].authorization).toBe(
        '[MASKED]'
      );
      expect(captured.info[0].context.api_key).toBe('[MASKED]');
      expect(captured.warn[0].context[1].secret).toBe('[EMPTY]');
      expect(captured.error[0].context).toBeUndefined();
    });
  });
});
