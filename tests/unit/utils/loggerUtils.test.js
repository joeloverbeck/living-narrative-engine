import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from '@jest/globals';
import {
  ensureValidLogger,
  createPrefixedLogger,
  getPrefixedLogger,
  getModuleLogger,
  setupPrefixedLogger,
  initLogger,
  logPreview,
  logStart,
  logEnd,
  logError,
} from '../../../src/utils/loggerUtils.js';

describe('loggerUtils', () => {
  const valid = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
    Object.values(consoleSpies).forEach((s) => s.mockRestore());
  });

  it('ensureValidLogger returns original logger when valid', () => {
    const result = ensureValidLogger(valid, 'Pfx');
    expect(result).toBe(valid);
    expect(consoleSpies.warn).not.toHaveBeenCalled();
  });

  it('ensureValidLogger provides fallback and warns when logger invalid', () => {
    const invalid = {};
    const result = ensureValidLogger(invalid, 'Bad');
    expect(result).not.toBe(invalid);
    expect(typeof result.warn).toBe('function');
    expect(consoleSpies.warn).toHaveBeenCalledWith(
      'Bad: ',
      `An invalid logger instance was provided. Falling back to console logging with prefix "Bad".`
    );
  });

  it('createPrefixedLogger prefixes messages across log levels', () => {
    const prefixed = createPrefixedLogger(valid, 'X: ');

    prefixed.debug('debug msg', { id: 1 });
    prefixed.info('info msg');
    prefixed.warn('warn msg');
    prefixed.error('error msg', new Error('boom'));

    expect(valid.debug).toHaveBeenCalledWith('X: debug msg', { id: 1 });
    expect(valid.info).toHaveBeenCalledWith('X: info msg');
    expect(valid.warn).toHaveBeenCalledWith('X: warn msg');
    expect(valid.error).toHaveBeenCalledWith('X: error msg', expect.any(Error));
  });

  it('createPrefixedLogger defaults to empty prefix when falsy', () => {
    const prefixed = createPrefixedLogger(valid, '');

    prefixed.info('no prefix');

    expect(valid.info).toHaveBeenCalledWith('no prefix');
  });

  it('getModuleLogger prefixes messages with module name', () => {
    const mod = getModuleLogger('modX', valid);
    mod.info('ping');
    expect(valid.info).toHaveBeenCalledWith('[modX] ping');
  });

  it('getModuleLogger falls back to console when logger missing', () => {
    const log = getModuleLogger('modY', null);
    log.warn('oops');
    expect(consoleSpies.warn).toHaveBeenCalledWith('[modY] : ', '[modY] oops');
  });

  it('getPrefixedLogger returns prefixed fallback when logger missing', () => {
    const logger = getPrefixedLogger(null, 'GP: ');
    logger.debug('a');
    expect(consoleSpies.debug).toHaveBeenCalledWith('GP: : ', 'GP: a');
  });

  it('setupPrefixedLogger wraps and prefixes messages', () => {
    const log = setupPrefixedLogger(valid, 'SP: ');
    log.info('msg');
    expect(valid.info).toHaveBeenCalledWith('SP: msg');
  });

  it('setupPrefixedLogger falls back to console when logger missing', () => {
    const log = setupPrefixedLogger(null, 'Svc: ');
    expect(() => log.error('boom')).not.toThrow();
    expect(consoleSpies.error).toHaveBeenCalledWith('Svc: ', 'Svc: boom');
  });

  it('initLogger validates when not optional and returns logger', () => {
    const logger = initLogger('Svc', valid);
    expect(logger).toBe(valid);
  });

  it('initLogger throws when logger is null and not optional', () => {
    expect(() => initLogger('Svc', null)).toThrow(
      'Missing required dependency: logger.'
    );
    expect(consoleSpies.error).toHaveBeenCalledWith(
      'Missing required dependency: logger.'
    );
  });

  it('initLogger throws when logger missing required methods', () => {
    const invalidLogger = { info: jest.fn(), warn: jest.fn() }; // missing error and debug
    expect(() => initLogger('Svc', invalidLogger)).toThrow(
      "Invalid or missing method 'error' on dependency 'logger'."
    );
    expect(consoleSpies.error).toHaveBeenCalledWith(
      "Invalid or missing method 'error' on dependency 'logger'."
    );
  });

  it('initLogger skips validation when optional and logger missing', () => {
    const logger = initLogger('Svc', null, { optional: true });
    logger.error('oops');
    expect(consoleSpies.error).toHaveBeenCalledWith('Svc: ', 'oops');
  });

  it('logPreview logs truncated preview for long strings', () => {
    const logger = { debug: jest.fn() };
    logPreview(logger, 'label: ', 'a'.repeat(120), 100);
    expect(logger.debug).toHaveBeenCalledWith(
      'label: ' + 'a'.repeat(100) + '...'
    );
  });

  it('logPreview logs full string when shorter than limit', () => {
    const logger = { debug: jest.fn() };
    logPreview(logger, 'l: ', 'short', 100);
    expect(logger.debug).toHaveBeenCalledWith('l: short');
  });

  it('ensureValidLogger fallback delegates to console with provided prefix', () => {
    const fallback = ensureValidLogger(null, 'Service');

    fallback.info('info message', { foo: 1 });
    fallback.warn('warn message');
    fallback.error('error message');
    fallback.debug('debug message', 'details');

    expect(consoleSpies.info).toHaveBeenCalledWith(
      'Service: ',
      'info message',
      {
        foo: 1,
      }
    );
    expect(consoleSpies.warn).toHaveBeenCalledWith('Service: ', 'warn message');
    expect(consoleSpies.error).toHaveBeenCalledWith(
      'Service: ',
      'error message'
    );
    expect(consoleSpies.debug).toHaveBeenCalledWith(
      'Service: ',
      'debug message',
      'details'
    );
  });

  it('ensureValidLogger fallback omits prefix when empty string provided', () => {
    const fallback = ensureValidLogger(null, '');

    fallback.warn('just a warning');

    expect(consoleSpies.warn).toHaveBeenCalledWith('', 'just a warning');
  });

  it('ensureValidLogger applies default fallback prefix when omitted', () => {
    const fallback = ensureValidLogger(null);

    fallback.info('defaulted');

    expect(consoleSpies.info).toHaveBeenCalledWith(
      'FallbackLogger: ',
      'defaulted'
    );
  });

  it('logStart, logEnd, and logError decorate messages with symbols', () => {
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };
    const err = new Error('network offline');

    logStart(logger, 'boot sequence');
    logEnd(logger, 'boot sequence');
    logError(logger, 'boot sequence', err);

    expect(logger.debug).toHaveBeenNthCalledWith(1, '▶️  boot sequence');
    expect(logger.debug).toHaveBeenNthCalledWith(2, '✅ boot sequence');
    expect(logger.error).toHaveBeenCalledWith(
      '❌ boot sequence: network offline',
      err
    );
  });

  it('getPrefixedLogger omits prefix when provided value is falsy', () => {
    const baseLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const prefixed = getPrefixedLogger(baseLogger, '');
    prefixed.info('raw');

    expect(baseLogger.info).toHaveBeenCalledWith('raw');
  });

  it('setupPrefixedLogger supports empty prefix values', () => {
    const baseLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const prefixed = setupPrefixedLogger(baseLogger, '');
    prefixed.warn('message');

    expect(baseLogger.warn).toHaveBeenCalledWith('message');
  });

  it('logPreview stringifies objects and uses default length', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };

    logPreview(logger, 'payload: ', { foo: 'bar' });

    expect(logger.debug).toHaveBeenCalledWith('payload: {"foo":"bar"}');
  });

  it('logPreview gracefully handles undefined payloads', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };

    logPreview(logger, 'payload: ', undefined);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('payload: undefined');
  });

  it('logPreview falls back when serialization throws', () => {
    const logger = { debug: jest.fn(), warn: jest.fn() };
    const circular = {};
    circular.self = circular;

    logPreview(logger, 'payload: ', circular);

    expect(logger.warn).toHaveBeenCalledWith(
      'logPreview: Failed to serialize data for preview.',
      expect.any(TypeError)
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'payload: [Unserializable data: [object Object]]'
    );
  });
});
