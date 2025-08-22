import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { loadAndApplyLoggerConfig } from '../../../src/configuration/utils/loggerConfigUtils.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';

// Mock registration bundles so configureMinimalContainer can run without side effects
jest.mock(
  '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/persistenceRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/interpreterRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/initializerRegistrations.js'
);

jest.mock(
  '../../../src/dependencyInjection/registrations/runtimeRegistrations.js'
);

describe('minimalContainerConfig logger handling', () => {
  let container;
  let setLevelSpy;
  let loggerStrategySetLevelSpy;
  let warnSpy;
  let debugSpy;
  let errorSpy;
  let loadConfigSpy;

  beforeEach(() => {
    container = new AppContainer();

    // Ensure ISafeEventDispatcher resolves during configuration
    const { registerInfrastructure } = jest.requireMock(
      '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
    );
    registerInfrastructure.mockImplementation((c) => {
      c.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    });

    // Mock initializer registrations to prevent anatomy system warnings
    const { registerInitializers } = jest.requireMock(
      '../../../src/dependencyInjection/registrations/initializerRegistrations.js'
    );
    registerInitializers.mockImplementation((c) => {
      c.register(tokens.SystemInitializer, { initialize: jest.fn() });
      c.register(tokens.AnatomyInitializationService, {
        initialize: jest.fn(),
      });
    });

    // Spy on ConsoleLogger methods (used internally by LoggerStrategy)
    setLevelSpy = jest
      .spyOn(ConsoleLogger.prototype, 'setLogLevel')
      .mockImplementation(() => {});
    warnSpy = jest
      .spyOn(ConsoleLogger.prototype, 'warn')
      .mockImplementation(() => {});
    debugSpy = jest
      .spyOn(ConsoleLogger.prototype, 'debug')
      .mockImplementation(() => {});
    errorSpy = jest
      .spyOn(ConsoleLogger.prototype, 'error')
      .mockImplementation(() => {});

    // Also spy on LoggerStrategy's setLogLevel method
    loggerStrategySetLevelSpy = jest
      .spyOn(LoggerStrategy.prototype, 'setLogLevel')
      .mockImplementation((level) => {
        // Delegate to the ConsoleLogger setLogLevel spy when not a mode switch
        if (
          typeof level === 'string' &&
          !['remote', 'console', 'hybrid', 'none'].includes(level.toLowerCase())
        ) {
          setLevelSpy(level);
        }
      });

    // Mock LoggerStrategy's getMode method for the debug message
    jest.spyOn(LoggerStrategy.prototype, 'getMode').mockReturnValue('test');

    loadConfigSpy = jest.spyOn(LoggerConfigLoader.prototype, 'loadConfig');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies log level when configuration specifies a string', async () => {
    loadConfigSpy.mockResolvedValue({ logLevel: 'WARN' });
    configureMinimalContainer(container);
    await new Promise(process.nextTick);
    // LoggerStrategy's setLogLevel should be called, which then delegates to ConsoleLogger
    expect(loggerStrategySetLevelSpy).toHaveBeenCalledWith('WARN');
    expect(setLevelSpy).toHaveBeenLastCalledWith('WARN');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when logLevel is not a string', async () => {
    loadConfigSpy.mockResolvedValue({ logLevel: 5 });
    configureMinimalContainer(container);
    await new Promise(process.nextTick);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("logLevel' is not a string")
    );
  });

  it('warns when loader returns an error result', async () => {
    loadConfigSpy.mockResolvedValue({
      error: true,
      message: 'oops',
      path: 'p',
    });
    configureMinimalContainer(container);
    await new Promise(process.nextTick);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load logger configuration from 'p'")
    );
  });

  it('logs debug when configuration has no logLevel', async () => {
    loadConfigSpy.mockResolvedValue({});
    configureMinimalContainer(container);
    await new Promise(process.nextTick);
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Logger configuration file loaded but no specific'
      )
    );
  });

  it('logs error when loading configuration throws', async () => {
    const logger = new ConsoleLogger(LogLevel.INFO);
    container.register(tokens.ILogger, logger);
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });

    loadConfigSpy.mockRejectedValue(new Error('network'));
    await loadAndApplyLoggerConfig(
      container,
      logger,
      tokens,
      'MinimalContainerConfig'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Object)
    );
  });
});
