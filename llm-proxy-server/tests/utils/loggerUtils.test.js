// llm-proxy-server/tests/utils/loggerUtils.test.js
// --- FILE START ---
import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ensureValidLogger } from '../../src/utils/loggerUtils.js';

describe('ensureValidLogger', () => {
  let consoleSpies;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  test('returns the provided logger when valid', () => {
    const validLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const result = ensureValidLogger(validLogger, 'MyPrefix');
    expect(result).toBe(validLogger);
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  test('returns a console fallback logger when logger is null', () => {
    const prefix = 'Fallback';
    const fallback = ensureValidLogger(null, prefix);

    fallback.info('hello');
    fallback.warn('warn');
    fallback.error('error');
    fallback.debug('dbg');

    expect(consoleSpies.info).toHaveBeenCalledWith(`${prefix}: `, 'hello');
    expect(consoleSpies.warn).toHaveBeenCalledWith(`${prefix}: `, 'warn');
    expect(consoleSpies.error).toHaveBeenCalledWith(`${prefix}: `, 'error');
    expect(consoleSpies.debug).toHaveBeenCalledWith(`${prefix}: `, 'dbg');
  });

  test('warns once and uses console fallback when logger is invalid', () => {
    const invalidLogger = { info: () => {}, warn: () => {} };
    const prefix = 'Bad';
    const fallback = ensureValidLogger(invalidLogger, prefix);

    expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpies.warn).toHaveBeenCalledWith(
      `${prefix}: `,
      `An invalid logger instance was provided. Falling back to console logging with prefix "${prefix}".`
    );

    fallback.warn('again');
    expect(consoleSpies.warn).toHaveBeenNthCalledWith(
      2,
      `${prefix}: `,
      'again'
    );
  });

  test('uses default prefix when none is provided', () => {
    const invalidLogger = { info: () => {} };
    const fallback = ensureValidLogger(invalidLogger);

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      'FallbackLogger: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "FallbackLogger".'
    );

    fallback.info('msg');
    expect(consoleSpies.info).toHaveBeenLastCalledWith(
      'FallbackLogger: ',
      'msg'
    );
  });
});
// --- FILE END ---
