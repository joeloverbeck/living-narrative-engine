/**
 * @file Integration tests for loadAndApplyLoggerConfig interacting with real logger configuration loader.
 * @jest-environment node
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { loadAndApplyLoggerConfig } from '../../../src/configuration/utils/loggerConfigUtils.js';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import fs from 'fs/promises';
import path from 'path';

class TestSchemaValidator {
  isSchemaLoaded() {
    return false;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

/**
 *
 * @param initialLevel
 */
function createRecordingLogger(initialLevel = 'INFO') {
  const logger = new ConsoleLogger(initialLevel);

  const originalSetLogLevel = logger.setLogLevel.bind(logger);
  const originalDebug = logger.debug.bind(logger);
  const originalInfo = logger.info.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  const originalError = logger.error.bind(logger);

  logger.setLogLevelCalls = [];
  logger.debugLogs = [];
  logger.infoLogs = [];
  logger.warnLogs = [];
  logger.errorLogs = [];

  logger.setLogLevel = function setLogLevel(level) {
    this.setLogLevelCalls.push(level);
    return originalSetLogLevel(level);
  };

  logger.debug = function debug(message, ...args) {
    this.debugLogs.push({ message, args });
    return originalDebug(message, ...args);
  };

  logger.info = function info(message, ...args) {
    this.infoLogs.push({ message, args });
    return originalInfo(message, ...args);
  };

  logger.warn = function warn(message, ...args) {
    this.warnLogs.push({ message, args });
    return originalWarn(message, ...args);
  };

  logger.error = function error(message, ...args) {
    this.errorLogs.push({ message, args });
    return originalError(message, ...args);
  };

  return logger;
}

/**
 *
 * @param logger
 */
function createProviderEnvironment(logger) {
  const container = new AppContainer();
  const eventBus = new EventBus({ logger });
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('events', SYSTEM_ERROR_OCCURRED_ID, {
    id: SYSTEM_ERROR_OCCURRED_ID,
    name: 'System Error Occurred',
    payloadSchema: null,
  });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new TestSchemaValidator();
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  container.register(tokens.ISafeEventDispatcher, safeEventDispatcher);

  const dispatchedEvents = [];
  eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (payload) => {
    dispatchedEvents.push(payload);
  });

  return {
    container,
    safeEventDispatcher,
    dispatchedEvents,
  };
}

describe('loadAndApplyLoggerConfig integration', () => {
  const consoleSpies = [];
  const originalFetch = globalThis.fetch;
  const loggerConfigPath = path.join(
    process.cwd(),
    'config',
    'logger-config.json'
  );
  let originalLoggerConfig;

  beforeAll(async () => {
    try {
      originalLoggerConfig = await fs.readFile(loggerConfigPath, 'utf8');
    } catch (error) {
      originalLoggerConfig = null;
    }
    [
      'debug',
      'info',
      'warn',
      'error',
      'groupCollapsed',
      'groupEnd',
      'table',
    ].forEach((method) => {
      if (typeof console[method] === 'function') {
        consoleSpies.push(
          jest.spyOn(console, method).mockImplementation(() => {})
        );
      }
    });
  });

  afterAll(async () => {
    if (originalLoggerConfig === null) {
      await fs.unlink(loggerConfigPath).catch(() => {});
    } else {
      await fs.writeFile(loggerConfigPath, originalLoggerConfig, 'utf8');
    }
    globalThis.fetch = originalFetch;
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   *
   * @param payload
   */
  async function writeLoggerConfig(payload) {
    await fs.mkdir(path.dirname(loggerConfigPath), { recursive: true });
    await fs.writeFile(loggerConfigPath, JSON.stringify(payload), 'utf8');
  }

  it('applies string log levels from local configuration in Node.js', async () => {
    await writeLoggerConfig({ logLevel: 'DEBUG' });

    const logger = createRecordingLogger('INFO');
    const { container, dispatchedEvents } = createProviderEnvironment(logger);

    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'IntegrationTest'
    );

    expect(logger.setLogLevelCalls).toEqual(['DEBUG']);
    expect(logger.warnLogs).toHaveLength(0);
    expect(
      logger.debugLogs.some((entry) =>
        entry.message.includes('Attempting to load logger configuration')
      )
    ).toBe(true);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('warns when the resolved log level is not a string', async () => {
    await writeLoggerConfig({ logLevel: 42 });

    const logger = createRecordingLogger('INFO');
    const { container, dispatchedEvents } = createProviderEnvironment(logger);

    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'IntegrationTest'
    );

    expect(logger.setLogLevelCalls).toHaveLength(0);
    expect(
      logger.warnLogs.some(
        (entry) =>
          entry.message.includes('logLevel') &&
          entry.message.includes('must be a string')
      )
    ).toBe(true);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('warns when the configuration file fails to load in Node.js', async () => {
    await fs.writeFile(loggerConfigPath, '{ invalid json', 'utf8');

    const logger = createRecordingLogger('INFO');
    const { container, dispatchedEvents } = createProviderEnvironment(logger);

    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'IntegrationTest'
    );

    expect(logger.setLogLevelCalls).toHaveLength(0);
    expect(
      logger.warnLogs.some((entry) =>
        entry.message.includes('Failed to load logger configuration from')
      )
    ).toBe(true);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('handles non-string log levels returned without error flags', async () => {
    const logger = createRecordingLogger('INFO');
    const { container } = createProviderEnvironment(logger);

    const originalLoadConfig = LoggerConfigLoader.prototype.loadConfig;
    LoggerConfigLoader.prototype.loadConfig =
      async function loadConfigOverride() {
        return { logLevel: 123 };
      };

    try {
      await loadAndApplyLoggerConfig(
        container,
        logger,
        tokens,
        'IntegrationTest'
      );
    } finally {
      LoggerConfigLoader.prototype.loadConfig = originalLoadConfig;
    }

    expect(logger.setLogLevelCalls).toHaveLength(0);
    expect(
      logger.warnLogs.some(
        (entry) =>
          entry.message.includes('logLevel') &&
          entry.message.includes('not a string')
      )
    ).toBe(true);
  });

  it('uses fallback metadata when loader errors omit path and stage', async () => {
    const logger = createRecordingLogger('INFO');
    const { container } = createProviderEnvironment(logger);

    const originalLoadConfig = LoggerConfigLoader.prototype.loadConfig;
    LoggerConfigLoader.prototype.loadConfig =
      async function loadConfigFallback() {
        return { error: true, message: 'broken config' };
      };

    try {
      await loadAndApplyLoggerConfig(container, logger, tokens);
    } finally {
      LoggerConfigLoader.prototype.loadConfig = originalLoadConfig;
    }

    expect(
      logger.warnLogs.some((entry) => entry.message.includes("'default path'"))
    ).toBe(true);
    expect(
      logger.warnLogs.some((entry) => entry.message.includes('Stage: N/A'))
    ).toBe(true);
  });

  it('logs diagnostic information when the configuration file has no log level', async () => {
    await writeLoggerConfig({ otherSetting: true });

    const logger = createRecordingLogger('INFO');
    const { container, dispatchedEvents } = createProviderEnvironment(logger);

    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'IntegrationTest'
    );

    expect(logger.setLogLevelCalls).toHaveLength(0);
    expect(
      logger.debugLogs.some((entry) =>
        entry.message.includes(
          'Logger configuration file loaded but no specific logLevel found'
        )
      )
    ).toBe(true);
    expect(dispatchedEvents).toHaveLength(0);
  });

  it('logs a critical error when the safe event dispatcher is missing from the container', async () => {
    const logger = createRecordingLogger('INFO');
    const container = new AppContainer();

    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'IntegrationTest'
    );

    expect(
      logger.errorLogs.some((entry) =>
        entry.message.includes(
          'CRITICAL ERROR during asynchronous logger configuration loading'
        )
      )
    ).toBe(true);
  });
});
