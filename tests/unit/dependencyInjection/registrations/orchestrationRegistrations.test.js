/* eslint-env jest */
/**
 * @file Unit tests for the orchestration registrations.
 */

import {
  describe,
  it,
  expect,
  jest,
  afterEach,
} from '@jest/globals';

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerOrchestration } from '../../../../src/dependencyInjection/registrations/orchestrationRegistrations.js';
import InitializationService from '../../../../src/initializers/services/initializationService.js';
import ShutdownService from '../../../../src/shutdown/services/shutdownService.js';
import ComponentAccessService from '../../../../src/entities/componentAccessService.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

/**
 * Creates a mock logger with the methods required by the registrations.
 *
 * @returns {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }}
 *   Logger mock with the required interface.
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Builds a container populated with the dependencies required by
 * {@link registerOrchestration}.
 *
 * @returns {{
 *   container: AppContainer,
 *   logger: ReturnType<typeof createLoggerMock>,
 *   validatedEventDispatcher: { dispatch: jest.Mock },
 *   safeEventDispatcher: { subscribe: jest.Mock },
 *   gameLoop: { stop: jest.Mock }
 * }}
 *   The populated container along with a few commonly asserted mocks.
 */
function createContainerWithDefaults() {
  const container = new AppContainer();

  const logger = createLoggerMock();
  const validatedEventDispatcher = { dispatch: jest.fn() };
  const safeEventDispatcher = { subscribe: jest.fn() };
  const modsLoader = { loadMods: jest.fn() };
  const scopeRegistry = { initialize: jest.fn() };
  const dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
  const llmAdapter = {
    init: jest.fn(),
    isInitialized: jest.fn(),
    isOperational: jest.fn(),
  };
  const llmConfigLoader = { loadConfigs: jest.fn() };
  const systemInitializer = { initializeAll: jest.fn() };
  const worldInitializer = { initializeWorldEntities: jest.fn() };
  const entityManager = { getEntityInstance: jest.fn() };
  const domUiFacade = {};
  const actionIndex = {
    buildIndex: jest.fn(),
    getCandidateActions: jest.fn(),
  };
  const gameDataRepository = {
    getAllActionDefinitions: jest.fn().mockReturnValue([]),
  };
  const spatialIndexManager = { buildIndex: jest.fn() };
  const anatomyFormattingService = { initialize: jest.fn() };
  const gameLoop = { stop: jest.fn() };

  container.register(tokens.ILogger, () => logger);
  container.register(tokens.IValidatedEventDispatcher, () => validatedEventDispatcher);
  container.register(tokens.ModsLoader, () => modsLoader);
  container.register(tokens.IScopeRegistry, () => scopeRegistry);
  container.register(tokens.IDataRegistry, () => dataRegistry);
  container.register(tokens.LLMAdapter, () => llmAdapter);
  container.register(tokens.LlmConfigLoader, () => llmConfigLoader);
  container.register(tokens.SystemInitializer, () => systemInitializer);
  container.register(tokens.WorldInitializer, () => worldInitializer);
  container.register(tokens.ISafeEventDispatcher, () => safeEventDispatcher);
  container.register(tokens.IEntityManager, () => entityManager);
  container.register(tokens.DomUiFacade, () => domUiFacade);
  container.register(tokens.ActionIndex, () => actionIndex);
  container.register(tokens.IGameDataRepository, () => gameDataRepository);
  container.register(tokens.ISpatialIndexManager, () => spatialIndexManager);
  container.register(tokens.AnatomyFormattingService, () => anatomyFormattingService);
  container.register(tokens.GameLoop, () => gameLoop);

  return {
    container,
    logger,
    validatedEventDispatcher,
    safeEventDispatcher,
    gameLoop,
  };
}

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('registerOrchestration', () => {
  it('registers InitializationService and ShutdownService as singleton factories', () => {
    const { container, logger } = createContainerWithDefaults();
    const registerSpy = jest.spyOn(container, 'register');

    registerOrchestration(container);

    expectSingleton(
      container,
      tokens.IInitializationService,
      InitializationService
    );
    expectSingleton(container, tokens.ShutdownService, ShutdownService);

    const initCall = registerSpy.mock.calls.find(
      ([token]) => token === tokens.IInitializationService
    );
    expect(initCall?.[2]?.lifecycle).toBe('singletonFactory');

    const shutdownCall = registerSpy.mock.calls.find(
      ([token]) => token === tokens.ShutdownService
    );
    expect(shutdownCall?.[2]?.lifecycle).toBe('singletonFactory');

    const logs = logger.debug.mock.calls.map(([message]) => message);
    expect(logs[0]).toBe('Orchestration Registration: Starting...');
    expect(logs).toContain(
      `Orchestration Registration: Registered ${tokens.IInitializationService} (Singleton).`
    );
    expect(logs).toContain(
      `Orchestration Registration: Registered ${tokens.ShutdownService} (Singleton).`
    );
    expect(logs).toContain('Orchestration Registration: Complete.');
  });

  it('registers ComponentAccessService when not already registered', () => {
    const { container, logger } = createContainerWithDefaults();

    expect(container.isRegistered(tokens.ComponentAccessService)).toBe(false);

    registerOrchestration(container);

    expect(container.isRegistered(tokens.ComponentAccessService)).toBe(true);
    expect(
      container.resolve(tokens.ComponentAccessService)
    ).toBeInstanceOf(ComponentAccessService);

    const logs = logger.debug.mock.calls.map(([message]) => message);
    expect(logs).toContain(
      `Orchestration Registration: Registered ${String(tokens.ComponentAccessService)} (default).`
    );
  });

  it('skips ComponentAccessService registration when already registered', () => {
    const { container, logger } = createContainerWithDefaults();
    const existingService = { already: true };

    container.register(tokens.ComponentAccessService, () => existingService);

    registerOrchestration(container);

    expect(container.resolve(tokens.ComponentAccessService)).toBe(existingService);

    const logs = logger.debug.mock.calls.map(([message]) => message);
    expect(logs).not.toContain(
      `Orchestration Registration: Registered ${String(tokens.ComponentAccessService)} (default).`
    );
  });

  describe('InitializationService factory error handling', () => {
    it.each([
      {
        description: 'logger resolves to undefined',
        override: (container) => container.setOverride(tokens.ILogger, undefined),
        expectedMessage: `InitializationService Factory: Failed to resolve dependency: ${tokens.ILogger}`,
      },
      {
        description: 'validated dispatcher resolves to undefined',
        override: (container) =>
          container.setOverride(tokens.IValidatedEventDispatcher, undefined),
        expectedMessage: `InitializationService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`,
      },
      {
        description: 'mods loader resolves to undefined',
        override: (container) => container.setOverride(tokens.ModsLoader, undefined),
        expectedMessage: `InitializationService Factory: Failed to resolve dependency: ${tokens.ModsLoader}`,
      },
      {
        description: 'system initializer resolves to undefined',
        override: (container) =>
          container.setOverride(tokens.SystemInitializer, undefined),
        expectedMessage: `InitializationService Factory: Failed to resolve dependency: ${tokens.SystemInitializer}`,
      },
      {
        description: 'world initializer resolves to undefined',
        override: (container) =>
          container.setOverride(tokens.WorldInitializer, undefined),
        expectedMessage: `InitializationService Factory: Failed to resolve dependency: ${tokens.WorldInitializer}`,
      },
    ])('throws descriptive error when $description', ({ override, expectedMessage }) => {
      const { container } = createContainerWithDefaults();

      registerOrchestration(container);
      override(container);

      expect(() => container.resolve(tokens.IInitializationService)).toThrow(
        expectedMessage
      );
    });
  });

  describe('ShutdownService factory error handling', () => {
    it.each([
      {
        description: 'logger resolves to undefined',
        override: (container) => container.setOverride(tokens.ILogger, undefined),
        expectedMessage: `ShutdownService Factory: Failed to resolve dependency: ${tokens.ILogger}`,
      },
      {
        description: 'validated dispatcher resolves to undefined',
        override: (container) =>
          container.setOverride(tokens.IValidatedEventDispatcher, undefined),
        expectedMessage: `ShutdownService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`,
      },
      {
        description: 'game loop resolves to undefined',
        override: (container) => container.setOverride(tokens.GameLoop, undefined),
        expectedMessage: `ShutdownService Factory: Failed to resolve dependency: ${tokens.GameLoop}`,
      },
    ])('throws descriptive error when $description', ({ override, expectedMessage }) => {
      const { container } = createContainerWithDefaults();

      registerOrchestration(container);
      override(container);

      expect(() => container.resolve(tokens.ShutdownService)).toThrow(
        expectedMessage
      );
    });
  });

  it('successfully creates both services with all dependencies resolved', () => {
    const { container, logger } = createContainerWithDefaults();

    registerOrchestration(container);

    const initializationService = container.resolve(tokens.IInitializationService);
    const shutdownService = container.resolve(tokens.ShutdownService);

    expect(initializationService).toBeInstanceOf(InitializationService);
    expect(shutdownService).toBeInstanceOf(ShutdownService);

    const logs = logger.debug.mock.calls.map(([message]) => message);
    expect(logs).toContain('Orchestration Registration: Starting...');
    expect(logs).toContain('Orchestration Registration: Complete.');
  });
});

