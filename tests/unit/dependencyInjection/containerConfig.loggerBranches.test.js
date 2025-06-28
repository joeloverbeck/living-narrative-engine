import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';

// Mock registration bundles to isolate configureContainer logic
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
jest.mock('../../../src/dependencyInjection/registrations/aiRegistrations.js');
jest.mock(
  '../../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js'
);
jest.mock('../../../src/dependencyInjection/registrations/uiRegistrations.js');
jest.mock(
  '../../../src/dependencyInjection/registrations/initializerRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/runtimeRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/orchestrationRegistrations.js'
);

import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';

describe('configureContainer logger configuration branches', () => {
  let container;
  let ui;
  let setLevelSpy;
  let warnSpy;
  let debugSpy;
  let errorSpy;
  let loadConfigSpy;

  beforeEach(() => {
    container = new AppContainer();
    ui = { outputDiv: {}, inputElement: {}, titleElement: {}, document: {} };

    // Spies on logger instance methods
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

    // Ensure ISafeEventDispatcher resolves during configuration
    registerInfrastructure.mockImplementation((c) => {
      c.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    });

    loadConfigSpy = jest.spyOn(LoggerConfigLoader.prototype, 'loadConfig');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies log level when configuration specifies a string', async () => {
    loadConfigSpy.mockResolvedValue({ logLevel: 'WARN' });
    const beforeCalls = setLevelSpy.mock.calls.length;
    configureContainer(container, ui);
    await new Promise(process.nextTick);
    expect(setLevelSpy.mock.calls.length).toBe(beforeCalls + 2);
    expect(setLevelSpy).toHaveBeenLastCalledWith('WARN');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when logLevel is not a string', async () => {
    loadConfigSpy.mockResolvedValue({ logLevel: 5 });
    const beforeCalls = setLevelSpy.mock.calls.length;
    configureContainer(container, ui);
    await new Promise(process.nextTick);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("logLevel' is not a string")
    );
    expect(setLevelSpy.mock.calls.length).toBe(beforeCalls + 1);
  });

  it('warns when loader returns an error result', async () => {
    loadConfigSpy.mockResolvedValue({
      error: true,
      message: 'oops',
      path: 'p',
    });
    configureContainer(container, ui);
    await new Promise(process.nextTick);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load logger configuration from 'p'")
    );
  });

  it('logs debug when configuration has no logLevel', async () => {
    loadConfigSpy.mockResolvedValue({});
    configureContainer(container, ui);
    await new Promise(process.nextTick);
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Logger configuration file loaded but no specific'
      )
    );
  });

  it('logs error when loading configuration throws', async () => {
    loadConfigSpy.mockRejectedValue(new Error('network'));
    configureContainer(container, ui);
    await new Promise(process.nextTick);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'CRITICAL ERROR during asynchronous logger configuration loading'
      ),
      expect.any(Object)
    );
  });
});
