import { beforeAll, afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

const createConsoleLoggerInstance = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setLogLevel: jest.fn(),
  groupCollapsed: jest.fn(),
  groupEnd: jest.fn(),
  table: jest.fn(),
  processBatch: jest.fn(),
  flush: jest.fn(),
  updateCategories: jest.fn(),
  getBuffer: jest.fn().mockReturnValue([]),
});

const createNoOpLoggerInstance = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setLogLevel: jest.fn(),
  processBatch: jest.fn(),
  flush: jest.fn(),
  updateCategories: jest.fn(),
  getBuffer: jest.fn().mockReturnValue([]),
});

let mockConsoleLoggerFactory = () => {
  throw new Error('mockConsoleLoggerFactory not initialized');
};
let mockNoOpLoggerFactory = () => {
  throw new Error('mockNoOpLoggerFactory not initialized');
};
let mockCreateSafeErrorLogger = jest.fn();

const defaultConfig = {
  enabled: true,
  mode: 'development',
  fallbackToConsole: true,
  logLevel: 'INFO',
  remote: { endpoint: '/debug', batchSize: 10 },
  categories: { general: { enabled: true, level: 'info' } },
  console: { enabled: true },
  performance: {},
};

jest.mock('../../../src/logging/consoleLogger.js', () => ({
  __esModule: true,
  default: class MockConsoleLogger {
    constructor(...args) {
      mockConsoleLoggerFactory.call(this, ...args);
    }
  },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 },
}));

jest.mock('../../../src/logging/noOpLogger.js', () => ({
  __esModule: true,
  default: class MockNoOpLogger {
    constructor(...args) {
      mockNoOpLoggerFactory.call(this, ...args);
    }
  },
}));

jest.mock('../../../src/logging/config/defaultConfig.js', () => ({
  __esModule: true,
  DEFAULT_CONFIG: defaultConfig,
}));

jest.mock('../../../src/utils/safeErrorLogger.js', () => ({
  __esModule: true,
  createSafeErrorLogger: (...args) => mockCreateSafeErrorLogger(...args),
}));

describe('LoggerStrategy near-complete coverage', () => {
  let LoggerStrategy;
  let LoggerMode;
  let consoleLoggerInstances;
  let noOpLoggerInstances;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  beforeEach(async () => {
    jest.resetModules();
    consoleLoggerInstances = [];
    noOpLoggerInstances = [];
    mockCreateSafeErrorLogger = jest.fn();
    defaultConfig.remote = { endpoint: '/debug', batchSize: 10 };
    defaultConfig.categories = {
      general: { enabled: true, level: 'info' },
    };

    mockConsoleLoggerFactory = jest.fn().mockImplementation(function MockConsoleLogger(level) {
      const instance = createConsoleLoggerInstance();
      instance.__initialLevel = level;
      Object.assign(this, instance);
      consoleLoggerInstances.push(this);
    });

    mockNoOpLoggerFactory = jest.fn().mockImplementation(function MockNoOpLogger() {
      const instance = createNoOpLoggerInstance();
      Object.assign(this, instance);
      noOpLoggerInstances.push(this);
    });

    ({ default: LoggerStrategy, LoggerMode } = await import('../../../src/logging/loggerStrategy.js'));

    jest.clearAllMocks();
    consoleLoggerInstances.forEach((instance) => instance.getBuffer.mockReturnValue([]));
    noOpLoggerInstances.forEach((instance) => instance.getBuffer.mockReturnValue([]));
  });

  const createStrategy = (options = {}) => new LoggerStrategy(options);

  it('initializes with provided console logger and wraps with safe logger when eventBus exists', () => {
    const providedLogger = createConsoleLoggerInstance();
    const eventBus = { dispatch: jest.fn() };
    const strategy = createStrategy({
      mode: LoggerMode.CONSOLE,
      dependencies: { consoleLogger: providedLogger, eventBus },
    });

    expect(mockConsoleLoggerFactory).not.toHaveBeenCalled();
    expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    expect(strategy.getCurrentLogger()).toBe(providedLogger);
    expect(providedLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[LoggerStrategy] Initialized with mode: console'),
    );
    expect(mockCreateSafeErrorLogger).toHaveBeenCalledWith({ logger: providedLogger, eventBus });
  });

  it('defers safe logger wrapping when event bus is not available yet', () => {
    const providedLogger = createConsoleLoggerInstance();
    const strategy = createStrategy({
      mode: LoggerMode.CONSOLE,
      dependencies: { consoleLogger: providedLogger },
    });

    expect(strategy.getCurrentLogger()).toBe(providedLogger);
    expect(mockCreateSafeErrorLogger).not.toHaveBeenCalled();
    expect(providedLogger.debug).toHaveBeenCalledWith(
      '[LoggerStrategy] EventBus not available during bootstrap - SafeErrorLogger wrapping deferred',
    );
  });

  it('creates a console logger when none is provided and merges config safely', () => {
    const strategy = createStrategy({
      mode: LoggerMode.CONSOLE,
      config: { console: { showTimestamp: true } },
    });

    expect(mockConsoleLoggerFactory).toHaveBeenCalledWith('INFO');
    const createdLogger = strategy.getCurrentLogger();
    expect(createdLogger).toBe(consoleLoggerInstances[0]);
    expect(createdLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('[LoggerStrategy] Initialized with mode:'),
    );
    expect(mockCreateSafeErrorLogger).not.toHaveBeenCalled();
  });

  it('does not mutate DEFAULT_CONFIG when normalizing missing config sections', () => {
    const originalRemote = JSON.parse(JSON.stringify(defaultConfig.remote));
    const originalCategories = JSON.parse(
      JSON.stringify(defaultConfig.categories)
    );

    createStrategy({
      config: { remote: null, categories: null },
    });

    expect(defaultConfig.remote).toEqual(originalRemote);
    expect(defaultConfig.categories).toEqual(originalCategories);
  });

  it('detects mode from DEBUG_LOG_MODE environment variable when explicit mode missing', () => {
    const previous = process.env.DEBUG_LOG_MODE;
    process.env.DEBUG_LOG_MODE = 'production';

    const strategy = createStrategy();

    expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);

    if (previous === undefined) {
      delete process.env.DEBUG_LOG_MODE;
    } else {
      process.env.DEBUG_LOG_MODE = previous;
    }
  });

  it('switches modes via setLogLevel and transfers buffered logs', () => {
    const eventBus = { dispatch: jest.fn() };
    const buffer = [{ level: 'info', message: 'pending', args: ['ctx'] }];
    const mockLogger = createNoOpLoggerInstance();
    mockLogger.getBuffer.mockReturnValue(buffer);

    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger, eventBus },
    });

    expect(strategy.getCurrentLogger()).toBe(mockLogger);

    strategy.setLogLevel('console');

    const newLogger = strategy.getCurrentLogger();
    expect(newLogger).toBe(consoleLoggerInstances[0]);
    expect(newLogger.processBatch).toHaveBeenCalledWith(buffer);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'logger.mode.changed', payload: expect.objectContaining({ from: LoggerMode.TEST, to: LoggerMode.CONSOLE }) }),
    );
    expect(newLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Switched from test to console mode'),
    );
  });

  it('supports switching to no-op mode and updating log levels directly', () => {
    const eventBus = { dispatch: jest.fn() };
    const strategy = createStrategy({ dependencies: { eventBus } });

    const initialLogger = strategy.getCurrentLogger();
    strategy.setLogLevel('none');

    expect(strategy.getMode()).toBe(LoggerMode.NONE);
    expect(noOpLoggerInstances.length).toBeGreaterThanOrEqual(2);
    const latestNoOpInstance = noOpLoggerInstances[noOpLoggerInstances.length - 1];
    expect(strategy.getCurrentLogger()).toBe(latestNoOpInstance);

    strategy.setLogLevel('DEBUG');
    expect(latestNoOpInstance.setLogLevel).toHaveBeenCalledWith('DEBUG');
    expect(initialLogger.setLogLevel).not.toHaveBeenCalled();
  });

  it('handles special commands including status, reload, reset, and flush', () => {
    const dependencies = {
      eventBus: { dispatch: jest.fn() },
      config: { console: { enabled: false }, categories: { ui: { level: 'debug' } } },
    };
    const strategy = createStrategy({ dependencies });
    const logger = strategy.getCurrentLogger();

    const status = strategy.setLogLevel('status');
    expect(logger.info).toHaveBeenCalledWith('[LoggerStrategy] Status:', expect.any(Object));
    expect(status).toMatchObject({ mode: expect.any(String), logger: expect.any(Object) });

    strategy.setLogLevel('reload');
    expect(logger.info).toHaveBeenCalledWith('[LoggerStrategy] Configuration reloaded');

    strategy.setLogLevel('flush');
    expect(logger.flush).toHaveBeenCalled();

    logger.flush = undefined;
    logger.processBatch.mockClear();
    strategy.setLogLevel('flush');
    expect(logger.processBatch).toHaveBeenCalledWith([]);

    strategy.setLogLevel('reset');
    expect(strategy.getMode()).toBe(LoggerMode.TEST);
    expect(strategy.getCurrentLogger()).toBe(noOpLoggerInstances[0]);
  });

  it('applies configuration objects and updates categories with validation', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.setLogLevel({
      mode: 'console',
      logLevel: 'WARN',
      categories: { general: { level: 'error' }, ai: { level: 'info' } },
    });

    expect(logger.updateCategories).toHaveBeenCalledWith({ general: { level: 'error' }, ai: { level: 'info' } });
    expect(logger.setLogLevel).toHaveBeenCalledWith('WARN');
  });

  it('rejects invalid configuration objects and logs errors', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.setLogLevel({ categories: 'not-an-object' });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid configuration'),
    );
  });

  it('warns for unsupported inputs to setLogLevel', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.setLogLevel(Symbol('bad'));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid setLogLevel input'),
    );
  });

  it('wraps console logger when event bus available but leaves logger untouched otherwise', () => {
    const strategyWithoutEventBus = createStrategy({ mode: LoggerMode.CONSOLE });
    expect(mockCreateSafeErrorLogger).not.toHaveBeenCalled();
    expect(strategyWithoutEventBus.getCurrentLogger()).toBe(consoleLoggerInstances[0]);

    const eventBus = { dispatch: jest.fn() };
    const strategyWithEventBus = createStrategy({
      mode: LoggerMode.CONSOLE,
      dependencies: { eventBus },
    });
    expect(mockCreateSafeErrorLogger).toHaveBeenCalledWith({
      logger: strategyWithEventBus.getCurrentLogger(),
      eventBus,
    });
  });

  it('falls back gracefully when mock logger is missing methods and dispatches error event', () => {
    const eventBus = { dispatch: jest.fn() };
    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger: { info: jest.fn() }, eventBus },
      config: { fallbackToConsole: true },
    });

    jest.runAllTimers();

    expect(mockConsoleLoggerFactory).toHaveBeenCalled();
    expect(strategy.getCurrentLogger()).toBe(consoleLoggerInstances[0]);
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'LOGGER_CREATION_FAILED',
      payload: expect.objectContaining({ mode: LoggerMode.TEST }),
    });
  });

  it('uses no-op logger when fallback to console is disabled', () => {
    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger: { info: jest.fn() } },
      config: { fallbackToConsole: false },
    });

    expect(mockConsoleLoggerFactory).not.toHaveBeenCalled();
    expect(strategy.getCurrentLogger()).toBe(noOpLoggerInstances[0]);
  });

  it('supports console grouping helpers without throwing when underlying methods missing', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    logger.groupCollapsed = undefined;
    logger.groupEnd = undefined;
    logger.table = undefined;

    expect(() => strategy.groupCollapsed('label')).not.toThrow();
    expect(() => strategy.groupEnd()).not.toThrow();
    expect(() => strategy.table([], ['col'])).not.toThrow();
  });
});
