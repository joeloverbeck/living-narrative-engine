/**
 * @file Integration tests for the ConsoleLogger implementation to ensure
 *       logging level transitions and console method gating behave as expected.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('ConsoleLogger Integration', () => {
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      groupCollapsed: jest
        .spyOn(console, 'groupCollapsed')
        .mockImplementation(() => {}),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      table: jest.spyOn(console, 'table').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  it('initializes with explicit log level and emits setup diagnostics', () => {
    const logger = new ConsoleLogger('DEBUG');

    expect(consoleSpies.info).toHaveBeenNthCalledWith(
      1,
      '[ConsoleLogger] Log level changing from INFO to DEBUG.'
    );
    expect(consoleSpies.debug).toHaveBeenCalledWith(
      '[ConsoleLogger] Initialized. Log level set to DEBUG (0).'
    );

    logger.debug('detailed trace');
    expect(consoleSpies.debug).toHaveBeenCalledWith('detailed trace');

    logger.warn('warn while debugging');
    expect(consoleSpies.warn).toHaveBeenCalledWith('warn while debugging');
  });

  it('defaults to INFO when no log level is provided', () => {
    new ConsoleLogger();

    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  it('suppresses all logging when configured for NONE', () => {
    const logger = new ConsoleLogger('NONE');

    expect(consoleSpies.info).toHaveBeenCalledTimes(1);
    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[ConsoleLogger] Log level changing from INFO to NONE.'
    );

    logger.info('should not reach console');
    logger.warn('still suppressed');
    logger.error('errors suppressed too');
    logger.debug('debug suppressed');

    expect(consoleSpies.info).toHaveBeenCalledTimes(1);
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  it('warns and preserves the level when given an invalid string', () => {
    const logger = new ConsoleLogger('INFO');
    consoleSpies.warn.mockClear();
    consoleSpies.info.mockClear();

    logger.setLogLevel('invalid');

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      "[ConsoleLogger] Invalid log level string: 'invalid'. Using previous or default: INFO."
    );
    expect(consoleSpies.info).not.toHaveBeenCalled();

    logger.info('info still enabled');
    expect(consoleSpies.info).toHaveBeenCalledWith('info still enabled');
  });

  it('warns and keeps the existing level when given an unsupported type or value', () => {
    const logger = new ConsoleLogger('INFO');
    consoleSpies.warn.mockClear();

    logger.setLogLevel(true);

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      "[ConsoleLogger] Invalid log level input type: 'boolean', value: 'true'. Using previous or default: INFO."
    );

    consoleSpies.warn.mockClear();
    logger.setLogLevel(999);

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      "[ConsoleLogger] Invalid log level input type: 'number', value: '999'. Using previous or default: INFO."
    );
  });

  it('applies numeric log level inputs and ignores redundant assignments', () => {
    const logger = new ConsoleLogger('INFO');
    consoleSpies.info.mockClear();

    logger.setLogLevel(LogLevel.WARN);
    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[ConsoleLogger] Log level changing from INFO to WARN.'
    );

    consoleSpies.info.mockClear();
    logger.setLogLevel(LogLevel.WARN);
    expect(consoleSpies.info).not.toHaveBeenCalled();

    logger.setLogLevel('warn');
    expect(consoleSpies.info).not.toHaveBeenCalled();
  });

  it('gates informational and warning output once the level is ERROR', () => {
    const logger = new ConsoleLogger('INFO');
    consoleSpies.info.mockClear();
    consoleSpies.warn.mockClear();
    consoleSpies.error.mockClear();

    logger.setLogLevel(LogLevel.ERROR);
    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[ConsoleLogger] Log level changing from INFO to ERROR.'
    );

    consoleSpies.info.mockClear();
    logger.info('ignored info message');
    logger.warn('ignored warning');

    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();

    logger.error('critical issue', { detail: 'context' });
    expect(consoleSpies.error).toHaveBeenCalledWith('critical issue', {
      detail: 'context',
    });
  });

  it('only exposes debug helpers when the level permits', () => {
    const logger = new ConsoleLogger('INFO');
    consoleSpies.groupCollapsed.mockClear();
    consoleSpies.groupEnd.mockClear();
    consoleSpies.table.mockClear();

    logger.groupCollapsed('group');
    logger.groupEnd();
    logger.table([{ label: 'row' }]);

    expect(consoleSpies.groupCollapsed).not.toHaveBeenCalled();
    expect(consoleSpies.groupEnd).not.toHaveBeenCalled();
    expect(consoleSpies.table).not.toHaveBeenCalled();

    logger.setLogLevel(LogLevel.DEBUG);
    logger.groupCollapsed('group');
    logger.groupEnd();
    logger.table([{ label: 'row' }], ['label']);

    expect(consoleSpies.groupCollapsed).toHaveBeenLastCalledWith('group');
    expect(consoleSpies.groupEnd).toHaveBeenCalledTimes(1);
    expect(consoleSpies.table).toHaveBeenCalledWith(
      [{ label: 'row' }],
      ['label']
    );
  });

  it('returns UNKNOWN for unsupported numeric levels', () => {
    const logger = new ConsoleLogger('INFO');
    expect(logger.getLogLevelName(999)).toBe('UNKNOWN');
  });
});
