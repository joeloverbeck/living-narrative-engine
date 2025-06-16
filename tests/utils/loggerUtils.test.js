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
  initLogger,
} from '../../src/utils/loggerUtils.js';
import { validateDependency } from '../../src/utils/validationUtils.js';

jest.mock('../../src/utils/validationUtils.js');

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

  it('initLogger validates when not optional and returns logger', () => {
    const spy = validateDependency;
    const logger = initLogger('Svc', valid);
    expect(spy).toHaveBeenCalledWith(valid, 'logger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    expect(logger).toBe(valid);
  });

  it('initLogger skips validation when optional and logger missing', () => {
    const logger = initLogger('Svc', null, { optional: true });
    expect(validateDependency).not.toHaveBeenCalled();
    logger.error('oops');
    expect(consoleSpies.error).toHaveBeenCalledWith('Svc: ', 'oops');
  });
});
