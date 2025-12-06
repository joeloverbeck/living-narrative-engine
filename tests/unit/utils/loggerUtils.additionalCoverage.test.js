import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ensureValidLogger,
  createPrefixedLogger,
  getPrefixedLogger,
  setupPrefixedLogger,
  logPreview,
  logStart,
  logEnd,
  logError,
} from '../../../src/utils/loggerUtils.js';

/**
 * @file Additional coverage tests for loggerUtils to exercise fallback paths and helper wrappers.
 */
describe('loggerUtils additional coverage', () => {
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ensureValidLogger uses default prefix when none supplied', () => {
    const fallback = ensureValidLogger(null);

    fallback.info('default message');

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'FallbackLogger: ',
      'default message'
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('ensureValidLogger omits prefix when fallback prefix is empty', () => {
    const fallback = ensureValidLogger(null, '');

    fallback.info('no prefix', { id: 42 });

    expect(consoleInfoSpy).toHaveBeenCalledWith('', 'no prefix', { id: 42 });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('createPrefixedLogger handles falsy prefix while forwarding error logs', () => {
    const baseLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const prefixed = createPrefixedLogger(baseLogger, null);
    const sampleError = new Error('boom');

    prefixed.error('failed to start', sampleError);

    expect(baseLogger.error).toHaveBeenCalledWith(
      'failed to start',
      sampleError
    );
    expect(baseLogger.info).not.toHaveBeenCalled();
  });

  it('getPrefixedLogger uses validated logger when prefix is undefined', () => {
    const baseLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const prefixed = getPrefixedLogger(baseLogger, undefined);
    prefixed.warn('still valid');

    expect(baseLogger.warn).toHaveBeenCalledWith('still valid');
  });

  it('setupPrefixedLogger falls back to empty prefix and preserves calls', () => {
    const baseLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const prefixed = setupPrefixedLogger(baseLogger, '');
    prefixed.debug('message');

    expect(baseLogger.debug).toHaveBeenCalledWith('message');
  });

  it('logPreview stringifies non-string data and uses default length', () => {
    const logger = { debug: jest.fn() };
    logPreview(logger, 'payload: ', { foo: 'bar' });

    expect(logger.debug).toHaveBeenCalledWith('payload: {"foo":"bar"}');
  });

  it('logStart and logEnd decorate debug output', () => {
    const logger = { debug: jest.fn() };

    logStart(logger, 'initializing cache');
    logEnd(logger, 'initializing cache');

    expect(logger.debug).toHaveBeenNthCalledWith(1, '▶️  initializing cache');
    expect(logger.debug).toHaveBeenNthCalledWith(2, '✅ initializing cache');
  });

  it('logError prefixes errors with context and forwards the error object', () => {
    const logger = { error: jest.fn() };
    const err = new Error('network offline');

    logError(logger, 'sync pipeline', err);

    expect(logger.error).toHaveBeenCalledWith(
      '❌ sync pipeline: network offline',
      err
    );
  });
});
