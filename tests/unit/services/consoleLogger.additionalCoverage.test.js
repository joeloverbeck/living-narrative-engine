import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

/**
 * Creates spies for console methods used in ConsoleLogger.
 *
 * @description Set up spies for console methods used in ConsoleLogger.
 * @returns {{info: jest.SpyInstance, warn: jest.SpyInstance, debug: jest.SpyInstance,
 *   groupCollapsed: jest.SpyInstance, groupEnd: jest.SpyInstance, table: jest.SpyInstance}}
 *   Object containing the created spies.
 */
function setupConsoleSpies() {
  return {
    info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    groupCollapsed: jest
      .spyOn(console, 'groupCollapsed')
      .mockImplementation(() => {}),
    groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
    table: jest.spyOn(console, 'table').mockImplementation(() => {}),
  };
}

/**
 * Restores all spies created by {@link setupConsoleSpies}.
 *
 * @description Restore all spies created by {@link setupConsoleSpies}.
 * @param {{[k: string]: jest.SpyInstance}} spies - The spies to restore.
 * @returns {void}
 */
function restoreSpies(spies) {
  Object.values(spies).forEach((spy) => spy.mockRestore());
}

describe('ConsoleLogger additional coverage', () => {
  /** @type {ConsoleLogger} */
  let logger;
  /** @type {{[k: string]: jest.SpyInstance}} */
  let spies;

  beforeEach(() => {
    spies = setupConsoleSpies();
    logger = new ConsoleLogger();
    // Clear any constructor logs
    Object.values(spies).forEach((spy) => spy.mockClear());
  });

  afterEach(() => {
    restoreSpies(spies);
  });

  it('handles invalid log level string without changing the level', () => {
    logger.setLogLevel('VERBOSE');
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(spies.info).not.toHaveBeenCalled();

    logger.setLogLevel(LogLevel.ERROR);
    expect(spies.info).toHaveBeenCalledTimes(1);
    expect(spies.warn).toHaveBeenCalledTimes(1);
  });

  it('changes log level when given a valid numeric level', () => {
    logger.setLogLevel(LogLevel.WARN);
    expect(spies.info).toHaveBeenCalledTimes(1);
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it('ignores setting the same log level without logging', () => {
    logger.setLogLevel('INFO');
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it('supports debug only helpers when level is DEBUG', () => {
    logger.setLogLevel(LogLevel.DEBUG);
    Object.values(spies).forEach((spy) => spy.mockClear());

    logger.groupCollapsed('grp');
    logger.groupEnd();
    logger.table([{ id: 1 }]);

    expect(spies.groupCollapsed).toHaveBeenCalledTimes(1);
    expect(spies.groupCollapsed).toHaveBeenCalledWith('grp');
    expect(spies.groupEnd).toHaveBeenCalledTimes(1);
    expect(spies.table).toHaveBeenCalledTimes(1);

    Object.values(spies).forEach((spy) => spy.mockClear());

    logger.setLogLevel(LogLevel.INFO);
    logger.groupCollapsed('grp2');
    logger.groupEnd();
    logger.table([{ id: 2 }]);

    expect(spies.groupCollapsed).not.toHaveBeenCalled();
    expect(spies.groupEnd).not.toHaveBeenCalled();
    expect(spies.table).not.toHaveBeenCalled();
  });

  it('getLogLevelName returns expected names', () => {
    expect(logger.getLogLevelName(LogLevel.INFO)).toBe('INFO');
    expect(logger.getLogLevelName(999)).toBe('UNKNOWN');
  });
});
