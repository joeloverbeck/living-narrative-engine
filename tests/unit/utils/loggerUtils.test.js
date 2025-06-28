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

  it('createPrefixedLogger prefixes messages', () => {
    const prefixed = createPrefixedLogger(valid, 'X: ');
    prefixed.info('hello');
    expect(valid.info).toHaveBeenCalledWith('X: hello');
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
});
