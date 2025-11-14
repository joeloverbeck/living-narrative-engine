import { beforeAll, afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

let consoleInfoSpy;
let consoleWarnSpy;
let consoleErrorSpy;
let consoleDebugSpy;

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
  let LogLevel;
  let consoleLoggerInstances;
  let noOpLoggerInstances;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
    consoleInfoSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    consoleDebugSpy?.mockRestore();
  });

  beforeEach(async () => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

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
    ({ LogLevel } = jest.requireMock('../../../src/logging/consoleLogger.js'));

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
    expect(providedLogger.info).toHaveBeenCalledWith(
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

    expect(mockConsoleLoggerFactory).toHaveBeenCalledWith('INFO', {});
    const createdLogger = strategy.getCurrentLogger();
    expect(createdLogger).toBe(consoleLoggerInstances[0]);
    expect(createdLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[LoggerStrategy] Initialized with mode:'),
    );
    expect(mockCreateSafeErrorLogger).not.toHaveBeenCalled();
  });

  it('warns and falls back to defaults when initial config is not an object', () => {
    createStrategy({
      mode: LoggerMode.CONSOLE,
      // @ts-expect-error - intentional invalid type to exercise defensive branch
      config: 'not-an-object',
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[LoggerStrategy] Invalid configuration provided, using defaults',
    );
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

  it('does not mutate DEFAULT_CONFIG when reset command is used', () => {
    const strategy = createStrategy();
    const snapshot = JSON.parse(JSON.stringify(defaultConfig));

    strategy.setLogLevel('reset');
    strategy.setLogLevel({
      categories: { general: { level: 'debug' } },
    });

    expect(defaultConfig).toEqual(snapshot);
  });

  it('does not mutate DEFAULT_CONFIG when reload command is used', () => {
    const strategy = createStrategy();
    const snapshot = JSON.parse(JSON.stringify(defaultConfig));

    strategy.setLogLevel('reload');
    strategy.setLogLevel({
      categories: { general: { level: 'error' } },
    });

    expect(defaultConfig).toEqual(snapshot);
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

  it('trims DEBUG_LOG_MODE environment variable before detecting mode', () => {
    const previous = process.env.DEBUG_LOG_MODE;
    process.env.DEBUG_LOG_MODE = '  Development  ';

    const strategy = createStrategy();

    expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);

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

  it('handles flush command when batch processing is unavailable', () => {
    const strategy = createStrategy();
    const logger = strategy.getCurrentLogger();

    logger.flush = undefined;
    logger.processBatch = undefined;

    expect(() => strategy.setLogLevel('flush')).not.toThrow();
  });

  it('returns early when switching to the currently active mode', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const originalLogger = strategy.getCurrentLogger();
    mockConsoleLoggerFactory.mockClear();

    strategy.setLogLevel('console');

    expect(strategy.getCurrentLogger()).toBe(originalLogger);
    expect(mockConsoleLoggerFactory).not.toHaveBeenCalled();
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

  it('replays buffered logs individually when new logger lacks batch processing support', () => {
    const buffer = [
      { message: 'pending log', args: ['ctx'] },
      { level: 'warn', message: 'warned', args: ['meta'] },
    ];
    const mockLogger = createNoOpLoggerInstance();
    mockLogger.getBuffer.mockReturnValue(buffer);

    mockConsoleLoggerFactory.mockImplementation(function MockConsoleLogger() {
      const instance = createConsoleLoggerInstance();
      delete instance.processBatch;
      Object.assign(this, instance);
      consoleLoggerInstances.push(this);
    });

    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger },
    });

    strategy.setLogLevel('console');

    const newLogger = strategy.getCurrentLogger();
    expect(newLogger.info).toHaveBeenCalledWith('pending log', 'ctx');
    expect(newLogger.warn).toHaveBeenCalledWith('warned', 'meta');
  });

  it('forwards console grouping helpers when available', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.groupCollapsed('group');
    strategy.groupEnd();
    strategy.table([{ id: 1 }], ['id']);

    expect(logger.groupCollapsed).toHaveBeenCalledWith('group');
    expect(logger.groupEnd).toHaveBeenCalled();
    expect(logger.table).toHaveBeenCalledWith([{ id: 1 }], ['id']);
  });

  it('supports numeric log levels and catches logger errors gracefully', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.setLogLevel(LogLevel.INFO);
    expect(logger.setLogLevel).toHaveBeenCalledWith(LogLevel.INFO);

    logger.setLogLevel.mockImplementation(() => {
      throw new Error('fail');
    });

    strategy.setLogLevel('DEBUG');
    expect(logger.setLogLevel).toHaveBeenCalledWith('DEBUG');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LoggerStrategy] Error in setLogLevel:',
      expect.any(Error),
    );
  });

  it('recreates production logger configuration when remote settings change', () => {
    const strategy = createStrategy({ mode: LoggerMode.PRODUCTION });
    mockConsoleLoggerFactory.mockClear();

    strategy.setLogLevel({ remote: { endpoint: '/prod', batchSize: 5 } });

    expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
    expect(mockConsoleLoggerFactory).not.toHaveBeenCalled();
  });

  it('collects detailed configuration validation errors', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.setLogLevel({ mode: 'invalid-mode' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid mode: invalid-mode'),
    );

    logger.error.mockClear();
    strategy.setLogLevel({
      categories: { general: { level: 'invalid-level' }, ui: 'not-an-object' },
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid log level for category general: invalid-level'),
    );

    logger.error.mockClear();
    strategy.setLogLevel({ logLevel: 'INVALID' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid log level: INVALID'),
    );
  });

  it('reports configuration must be an object when provided invalid input', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.setLogLevel({ categories: null });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Categories must be an object'),
    );
  });

  it('reports event bus dispatch failures during logger fallback', () => {
    const mockLogger = { info: jest.fn() };
    const eventBus = { dispatch: jest.fn() };
    const originalSetTimeout = global.setTimeout;

    mockConsoleLoggerFactory.mockImplementation(() => {
      throw new Error('console unavailable');
    });

    global.setTimeout = () => {
      throw new Error('timer failure');
    };

    try {
      const strategy = createStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger, eventBus },
      });

      expect(strategy.getCurrentLogger()).toBe(noOpLoggerInstances[0]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LoggerStrategy] Failed to dispatch logger creation error:',
        expect.any(Error),
      );
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });

  it('falls back to no-op logger when console fallback throws errors', () => {
    mockConsoleLoggerFactory.mockImplementation(() => {
      throw new Error('console failure');
    });

    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });

    expect(strategy.getCurrentLogger()).toBe(noOpLoggerInstances[0]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LoggerStrategy] Failed to create logger, falling back to console:',
      expect.any(Error),
    );
  });

  it('logs a warning when SafeErrorLogger wrapping fails', () => {
    mockCreateSafeErrorLogger.mockImplementation(() => {
      throw new Error('wrap failure');
    });

    const eventBus = { dispatch: jest.fn() };
    const strategy = createStrategy({
      mode: LoggerMode.CONSOLE,
      dependencies: { eventBus },
    });

    expect(strategy.getCurrentLogger()).toBe(consoleLoggerInstances[0]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[LoggerStrategy] Failed to wrap logger with SafeErrorLogger:',
      expect.any(Error),
    );
  });

  it('detects mode from configuration when environment overrides are absent', () => {
    const previousDebugMode = process.env.DEBUG_LOG_MODE;
    delete process.env.DEBUG_LOG_MODE;
    const previousDefaultMode = defaultConfig.mode;
    defaultConfig.mode = undefined;

    try {
      const strategy = createStrategy({ config: { mode: LoggerMode.DEVELOPMENT } });
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
    } finally {
      defaultConfig.mode = previousDefaultMode;
      if (previousDebugMode === undefined) {
        delete process.env.DEBUG_LOG_MODE;
      } else {
        process.env.DEBUG_LOG_MODE = previousDebugMode;
      }
    }
  });

  it('detects mode from NODE_ENV mapping when JEST_WORKER_ID is unavailable', () => {
    const previousDebugMode = process.env.DEBUG_LOG_MODE;
    const previousJestWorker = process.env.JEST_WORKER_ID;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.DEBUG_LOG_MODE;
    delete process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'production';
    const previousDefaultMode = defaultConfig.mode;
    defaultConfig.mode = undefined;

    try {
      const strategy = createStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
    } finally {
      defaultConfig.mode = previousDefaultMode;
      if (previousDebugMode === undefined) {
        delete process.env.DEBUG_LOG_MODE;
      } else {
        process.env.DEBUG_LOG_MODE = previousDebugMode;
      }
      if (previousJestWorker === undefined) {
        delete process.env.JEST_WORKER_ID;
      } else {
        process.env.JEST_WORKER_ID = previousJestWorker;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('falls back to console mode when no detection hints are available', () => {
    const previousDebugMode = process.env.DEBUG_LOG_MODE;
    const previousJestWorker = process.env.JEST_WORKER_ID;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.DEBUG_LOG_MODE;
    delete process.env.JEST_WORKER_ID;
    delete process.env.NODE_ENV;
    const previousDefaultMode = defaultConfig.mode;
    defaultConfig.mode = undefined;

    try {
      const strategy = createStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    } finally {
      defaultConfig.mode = previousDefaultMode;
      if (previousDebugMode === undefined) {
        delete process.env.DEBUG_LOG_MODE;
      } else {
        process.env.DEBUG_LOG_MODE = previousDebugMode;
      }
      if (previousJestWorker === undefined) {
        delete process.env.JEST_WORKER_ID;
      } else {
        process.env.JEST_WORKER_ID = previousJestWorker;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('detects test mode when JEST_WORKER_ID is present', () => {
    const previousDebugMode = process.env.DEBUG_LOG_MODE;
    delete process.env.DEBUG_LOG_MODE;
    const previousDefaultMode = defaultConfig.mode;
    defaultConfig.mode = undefined;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    const previousJestWorker = process.env.JEST_WORKER_ID;
    process.env.JEST_WORKER_ID = '42';

    try {
      const strategy = createStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
    } finally {
      defaultConfig.mode = previousDefaultMode;
      if (previousDebugMode === undefined) {
        delete process.env.DEBUG_LOG_MODE;
      } else {
        process.env.DEBUG_LOG_MODE = previousDebugMode;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousJestWorker === undefined) {
        delete process.env.JEST_WORKER_ID;
      } else {
        process.env.JEST_WORKER_ID = previousJestWorker;
      }
    }
  });

  it('detects development mode from NODE_ENV mapping', () => {
    const previousDebugMode = process.env.DEBUG_LOG_MODE;
    const previousJestWorker = process.env.JEST_WORKER_ID;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.DEBUG_LOG_MODE;
    delete process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'development';
    const previousDefaultMode = defaultConfig.mode;
    defaultConfig.mode = undefined;

    try {
      const strategy = createStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
    } finally {
      defaultConfig.mode = previousDefaultMode;
      if (previousDebugMode === undefined) {
        delete process.env.DEBUG_LOG_MODE;
      } else {
        process.env.DEBUG_LOG_MODE = previousDebugMode;
      }
      if (previousJestWorker === undefined) {
        delete process.env.JEST_WORKER_ID;
      } else {
        process.env.JEST_WORKER_ID = previousJestWorker;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('detects test mode from NODE_ENV mapping', () => {
    const previousDebugMode = process.env.DEBUG_LOG_MODE;
    const previousJestWorker = process.env.JEST_WORKER_ID;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.DEBUG_LOG_MODE;
    delete process.env.JEST_WORKER_ID;
    process.env.NODE_ENV = 'test';
    const previousDefaultMode = defaultConfig.mode;
    defaultConfig.mode = undefined;

    try {
      const strategy = createStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
    } finally {
      defaultConfig.mode = previousDefaultMode;
      if (previousDebugMode === undefined) {
        delete process.env.DEBUG_LOG_MODE;
      } else {
        process.env.DEBUG_LOG_MODE = previousDebugMode;
      }
      if (previousJestWorker === undefined) {
        delete process.env.JEST_WORKER_ID;
      } else {
        process.env.JEST_WORKER_ID = previousJestWorker;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('warns when base configuration contains an unsupported mode', () => {
    createStrategy({ config: { mode: 'broken-mode' } });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[LoggerStrategy] Invalid mode 'broken-mode' in config, will use auto-detection",
    );
  });

  it('recovers when a provided console logger lacks required methods', () => {
    const invalidLogger = createConsoleLoggerInstance();
    delete invalidLogger.info;
    mockConsoleLoggerFactory.mockImplementationOnce(function InvalidConsole() {
      Object.assign(this, invalidLogger);
      consoleLoggerInstances.push(this);
    });

    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LoggerStrategy] Failed to create logger, falling back to console:',
      expect.any(Error),
    );
    expect(mockConsoleLoggerFactory).toHaveBeenCalledTimes(2);
    expect(strategy.getCurrentLogger()).toBe(consoleLoggerInstances[1]);
  });

  it('delegates basic log methods to the active logger', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();

    strategy.info('info', 'ctx');
    strategy.warn('warn', 'ctx');
    strategy.error('error', 'ctx');
    strategy.debug('debug', 'ctx');

    expect(logger.info).toHaveBeenCalledWith('info', 'ctx');
    expect(logger.warn).toHaveBeenCalledWith('warn', 'ctx');
    expect(logger.error).toHaveBeenCalledWith('error', 'ctx');
    expect(logger.debug).toHaveBeenCalledWith('debug', 'ctx');
  });

  it('switches modes via configuration objects when mode differs from current state', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    strategy.setLogLevel({ mode: 'test' });

    expect(strategy.getMode()).toBe(LoggerMode.TEST);
    expect(strategy.getCurrentLogger()).toBe(noOpLoggerInstances[0]);
  });

  it('constructs without options and respects none mode without debug logging', () => {
    const defaultStrategy = new LoggerStrategy();
    expect(defaultStrategy.getMode()).toBe(LoggerMode.TEST);

    consoleDebugSpy.mockClear();

    const noneStrategy = new LoggerStrategy({ mode: LoggerMode.NONE });
    expect(noneStrategy.getMode()).toBe(LoggerMode.NONE);
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it('ignores whitespace-only DEBUG_LOG_MODE values during detection', () => {
    const previous = process.env.DEBUG_LOG_MODE;
    process.env.DEBUG_LOG_MODE = '   ';

    const strategy = createStrategy();
    expect(strategy.getMode()).toBe(LoggerMode.TEST);

    if (previous === undefined) {
      delete process.env.DEBUG_LOG_MODE;
    } else {
      process.env.DEBUG_LOG_MODE = previous;
    }
  });

  it('ignores non-string DEBUG_LOG_MODE values gracefully', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process.env,
      'DEBUG_LOG_MODE'
    );

    Object.defineProperty(process.env, 'DEBUG_LOG_MODE', {
      configurable: true,
      get() {
        return { unexpected: true };
      },
    });

    try {
      const strategy = createStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(process.env, 'DEBUG_LOG_MODE', originalDescriptor);
      } else {
        delete process.env.DEBUG_LOG_MODE;
      }
    }
  });

  it('falls through when DEBUG_LOG_MODE contains unsupported values', () => {
    const previous = process.env.DEBUG_LOG_MODE;
    process.env.DEBUG_LOG_MODE = 'legacy-mode';

    const strategy = createStrategy();
    expect(strategy.getMode()).toBe(LoggerMode.TEST);

    if (previous === undefined) {
      delete process.env.DEBUG_LOG_MODE;
    } else {
      process.env.DEBUG_LOG_MODE = previous;
    }
  });

  it('uses INFO fallback when config log level is falsy', () => {
    const strategy = new LoggerStrategy({
      mode: LoggerMode.CONSOLE,
      config: { logLevel: '' },
    });

    expect(consoleLoggerInstances[0].__initialLevel).toBe('INFO');
    expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
  });

  it('skips buffering when original logger lacks getBuffer support', () => {
    const mockLogger = createNoOpLoggerInstance();
    delete mockLogger.getBuffer;

    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger },
    });

    strategy.setLogLevel('console');
    const newLogger = strategy.getCurrentLogger();
    expect(newLogger.processBatch).not.toHaveBeenCalled();
  });

  it('replays buffered logs while ignoring unknown levels and missing args', () => {
    const buffer = [
      { message: 'plain message' },
      { level: 'mystery', message: 'unknown branch' },
    ];
    const mockLogger = createNoOpLoggerInstance();
    mockLogger.getBuffer.mockReturnValue(buffer);

    mockConsoleLoggerFactory.mockImplementation(function ConsoleWithoutBatch() {
      const instance = createConsoleLoggerInstance();
      delete instance.processBatch;
      Object.assign(this, instance);
      consoleLoggerInstances.push(this);
    });

    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger },
    });

    strategy.setLogLevel('console');
    const newLogger = strategy.getCurrentLogger();
    expect(newLogger.info).toHaveBeenCalledWith('plain message');
    expect(newLogger.warn).not.toHaveBeenCalled();
  });

  it('retains current level when replacement logger lacks a setter', () => {
    const mockLogger = createNoOpLoggerInstance();
    mockLogger.getBuffer.mockReturnValue([]);

    mockConsoleLoggerFactory.mockImplementation(function ConsoleWithoutSetter() {
      const instance = createConsoleLoggerInstance();
      delete instance.setLogLevel;
      Object.assign(this, instance);
      consoleLoggerInstances.push(this);
    });

    const strategy = createStrategy({
      mode: LoggerMode.TEST,
      dependencies: { mockLogger },
    });

    strategy.setLogLevel('ERROR');
    strategy.setLogLevel('console');

    const newLogger = strategy.getCurrentLogger();
    expect(newLogger.setLogLevel).toBeUndefined();
  });

  it('switches to direct mode names without map entries', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    strategy.setLogLevel('production');

    expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
  });

  it('handles traditional log level updates when logger lacks a setter', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();
    delete logger.setLogLevel;

    expect(() => strategy.setLogLevel('INFO')).not.toThrow();
  });

  it('ignores invalid input warnings when logger lacks warn method', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();
    delete logger.warn;

    expect(() => strategy.setLogLevel(Symbol('bad'))).not.toThrow();
  });

  it('ignores invalid configuration errors when logger lacks error method', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();
    delete logger.error;

    expect(() => strategy.setLogLevel({ categories: 'not-object' })).not.toThrow();
  });

  it('switches to development mode via configuration updates', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    strategy.setLogLevel({ mode: 'development' });

    expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
  });

  it('applies log level configuration even when logger lacks setter', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();
    delete logger.setLogLevel;

    expect(() => strategy.setLogLevel({ logLevel: 'ERROR' })).not.toThrow();
  });

  it('skips remote logger recreation outside production mode', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const originalLogger = strategy.getCurrentLogger();

    strategy.setLogLevel({ remote: { endpoint: '/dev' } });

    expect(strategy.getCurrentLogger()).toBe(originalLogger);
  });

  it('handles reload command when logger info method is missing', () => {
    const strategy = createStrategy();
    const logger = strategy.getCurrentLogger();
    delete logger.info;

    expect(() => strategy.setLogLevel('reload')).not.toThrow();
  });

  it('resets to fallback log level when defaults omit logLevel', () => {
    const previousLogLevel = defaultConfig.logLevel;
    defaultConfig.logLevel = undefined;

    try {
      const strategy = createStrategy();
      const logger = strategy.getCurrentLogger();
      delete logger.info;

      expect(() => strategy.setLogLevel('reset')).not.toThrow();
    } finally {
      defaultConfig.logLevel = previousLogLevel;
    }
  });

  it('returns status when logger info method is missing', () => {
    const strategy = createStrategy();
    const logger = strategy.getCurrentLogger();
    delete logger.info;

    const status = strategy.setLogLevel('status');
    expect(status).toMatchObject({ mode: expect.any(String) });
  });

  it('updates categories when logger lacks updateCategories method', () => {
    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });
    const logger = strategy.getCurrentLogger();
    delete logger.updateCategories;

    expect(() =>
      strategy.setLogLevel({
        categories: { story: { level: 'info' } },
      })
    ).not.toThrow();
  });

  it('reports status with empty category list after reload merge', () => {
    const dependencies = {
      config: { categories: null },
    };
    const strategy = createStrategy({ dependencies });

    const status = strategy.setLogLevel('status');
    expect(status.config.categories).toEqual(expect.arrayContaining(['general']));

    strategy.setLogLevel('reload');
    const reloadedStatus = strategy.setLogLevel('status');
    expect(reloadedStatus.config.categories).toEqual([]);
  });

  it('mergeConfig ignores inherited properties from source objects', () => {
    const inheritedConsoleConfig = Object.create({ protoFlag: true });
    inheritedConsoleConfig.theme = 'dark';

    const strategy = createStrategy({ mode: LoggerMode.CONSOLE });

    expect(() =>
      strategy.setLogLevel({
        console: inheritedConsoleConfig,
      })
    ).not.toThrow();
  });

  it('falls back to default mode when process is completely unavailable', () => {
    // This test verifies that LoggerStrategy handles the case where process
    // is not accessible at all (neither as local variable nor as globalThis.process)

    // Save original reference to process
    const originalGlobalProcess = globalThis.process;
    let hadGlobalProcess = false;
    if ('process' in globalThis) {
      hadGlobalProcess = true;
    }

    try {
      // Remove globalThis.process to simulate environment without process
      delete globalThis.process;

      // Create strategy - should fall back to default CONSOLE mode
      const strategy = createStrategy();

      // Verify it uses the default CONSOLE mode when process is unavailable
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    } finally {
      // Restore globalThis.process
      if (hadGlobalProcess) {
        globalThis.process = originalGlobalProcess;
      }
    }
  });
});
