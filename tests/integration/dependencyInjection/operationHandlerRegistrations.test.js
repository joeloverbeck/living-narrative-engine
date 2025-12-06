import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import PrepareActionContextHandler from '../../../src/logic/operationHandlers/prepareActionContextHandler.js';

describe('Operation Handler Registration Integration', () => {
  let container;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let logger;

  beforeEach(async () => {
    container = new AppContainer();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    logger = new ConsoleLogger(LogLevel.ERROR);
    container.register(tokens.ILogger, () => logger);

    await configureBaseContainer(container, {
      includeGameSystems: false,
      includeUI: false,
      logger: logger,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should resolve PrepareActionContextHandler', () => {
    expect(() =>
      container.resolve(tokens.PrepareActionContextHandler)
    ).not.toThrow();
    const handler = container.resolve(tokens.PrepareActionContextHandler);
    expect(handler).toBeInstanceOf(PrepareActionContextHandler);
  });

  it('should register PREPARE_ACTION_CONTEXT in OperationRegistry', () => {
    const registry = container.resolve(tokens.OperationRegistry);
    expect(registry.hasHandler('PREPARE_ACTION_CONTEXT')).toBe(true);
  });
});
