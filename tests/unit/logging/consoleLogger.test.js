import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('ConsoleLogger', () => {
  /** @type {Record<string, jest.SpyInstance>} */
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
    jest.clearAllMocks();
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  const instantiate = (level) => {
    const logger = new ConsoleLogger(level);
    jest.clearAllMocks();
    return logger;
  };

  it('respects provided string log level and logs initialization in debug mode', () => {
    new ConsoleLogger('DEBUG');

    expect(consoleSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('Log level changing from INFO to DEBUG')
    );
    expect(consoleSpies.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        '[ConsoleLogger] Initialized. Log level set to DEBUG (0).'
      )
    );
  });

  it('treats log level strings case-insensitively', () => {
    const logger = instantiate('warn');

    logger.info('info message');
    expect(consoleSpies.info).not.toHaveBeenCalled();

    logger.warn('warn message');
    expect(consoleSpies.warn).toHaveBeenCalledWith('warn message');
  });

  it('normalizes whitespace when parsing string log levels', () => {
    const logger = instantiate('  debug  ');

    logger.debug('visible');
    expect(consoleSpies.debug).toHaveBeenCalledWith('visible');

    jest.clearAllMocks();

    logger.setLogLevel('   ');

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid log level string: '   '")
    );

    jest.clearAllMocks();

    logger.debug('still debug');
    expect(consoleSpies.debug).toHaveBeenCalledWith('still debug');
  });

  it('logs a warning when provided with an invalid level string', () => {
    const logger = instantiate(LogLevel.INFO);

    logger.setLogLevel('INVALID');

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid log level string: 'INVALID'")
    );
    expect(consoleSpies.info).not.toHaveBeenCalled();

    jest.clearAllMocks();
    logger.debug('should not log');
    expect(consoleSpies.debug).not.toHaveBeenCalled();
    logger.info('still info');
    expect(consoleSpies.info).toHaveBeenCalledWith('still info');
  });

  it('logs a warning when provided with an invalid level type', () => {
    const logger = instantiate(LogLevel.INFO);

    // @ts-expect-error Testing invalid input type
    logger.setLogLevel({});

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid log level input type: 'object'")
    );
    expect(consoleSpies.info).not.toHaveBeenCalled();
  });

  it('logs transitions when switching to a different numeric level', () => {
    const logger = instantiate(LogLevel.INFO);

    logger.setLogLevel(LogLevel.ERROR);

    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[ConsoleLogger] Log level changing from INFO to ERROR.'
    );
    expect(consoleSpies.warn).not.toHaveBeenCalled();
  });

  it('suppresses transition logs when the numeric level is unchanged', () => {
    const logger = new ConsoleLogger(LogLevel.ERROR);
    jest.clearAllMocks();

    logger.setLogLevel(LogLevel.ERROR);

    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
  });

  it('returns the string name for known levels and UNKNOWN for unexpected values', () => {
    const logger = instantiate(LogLevel.INFO);

    expect(logger.getLogLevelName(LogLevel.WARN)).toBe('WARN');
    expect(logger.getLogLevelName(999)).toBe('UNKNOWN');
  });

  it('respects log level thresholds for output methods', () => {
    const logger = new ConsoleLogger(LogLevel.WARN);
    jest.clearAllMocks();

    logger.debug('debug message');
    expect(consoleSpies.debug).not.toHaveBeenCalled();

    logger.info('info message');
    expect(consoleSpies.info).not.toHaveBeenCalled();

    logger.warn('warn message');
    expect(consoleSpies.warn).toHaveBeenCalledWith('warn message');

    logger.error('error message');
    expect(consoleSpies.error).toHaveBeenCalledWith('error message');
  });

  it('treats [DEBUG]-tagged messages as debug-level output', () => {
    const infoLogger = new ConsoleLogger(LogLevel.INFO);
    jest.clearAllMocks();

    infoLogger.info('[DEBUG] should be hidden');
    infoLogger.warn('   [DEBUG] also hidden');
    infoLogger.error('\t[DEBUG]\t suppressed');

    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.debug).not.toHaveBeenCalled();

    const debugLogger = new ConsoleLogger(LogLevel.DEBUG);
    jest.clearAllMocks();

    debugLogger.info('[DEBUG] promoted to debug', 'extra');

    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.debug).toHaveBeenCalledWith(
      'promoted to debug',
      'extra'
    );
  });

  it('only emits group and table calls when debug logging is enabled', () => {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    jest.clearAllMocks();

    logger.groupCollapsed('group');
    logger.groupEnd();
    logger.table([{ value: 1 }], ['value']);

    expect(consoleSpies.groupCollapsed).toHaveBeenCalledWith('group');
    expect(consoleSpies.groupEnd).toHaveBeenCalled();
    expect(consoleSpies.table).toHaveBeenCalledWith([{ value: 1 }], ['value']);

    jest.clearAllMocks();
    logger.setLogLevel(LogLevel.INFO);
    jest.clearAllMocks();

    logger.groupCollapsed('skipped');
    logger.groupEnd();
    logger.table([{ value: 2 }]);

    expect(consoleSpies.groupCollapsed).not.toHaveBeenCalled();
    expect(consoleSpies.groupEnd).not.toHaveBeenCalled();
    expect(consoleSpies.table).not.toHaveBeenCalled();
  });
});
