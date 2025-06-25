/* eslint-env jest */
/**
 * @file Test suite for orchestrationRegistrations.
 * @see tests/dependencyInjection/registrations/orchestrationRegistrations.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerOrchestration } from '../../../../src/dependencyInjection/registrations/orchestrationRegistrations.js';
import InitializationService from '../../../../src/initializers/services/initializationService.js';
import ShutdownService from '../../../../src/shutdown/services/shutdownService.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

describe('registerOrchestration', () => {
  /** @type {AppContainer} */
  let container;
  let mockLogger;
  let mockDispatcher;
  let mockGameLoop;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDispatcher = { dispatch: jest.fn() };
    mockGameLoop = {};

    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IValidatedEventDispatcher, () => mockDispatcher);
    container.register(tokens.ModsLoader, () => ({ loadMods: jest.fn() }));
    container.register(tokens.IScopeRegistry, () => ({
      initialize: jest.fn(),
    }));
    container.register(tokens.IDataRegistry, () => ({
      getAll: jest.fn().mockReturnValue([]),
    }));
    container.register(tokens.LLMAdapter, () => ({
      init: jest.fn(),
      isInitialized: jest.fn(),
      isOperational: jest.fn(),
    }));
    container.register(tokens.LlmConfigLoader, () => ({
      loadConfigs: jest.fn(),
    }));
    container.register(tokens.SystemInitializer, () => ({
      initializeAll: jest.fn(),
    }));
    container.register(tokens.WorldInitializer, () => ({
      initializeWorldEntities: jest.fn(),
    }));
    container.register(tokens.ISafeEventDispatcher, () => ({
      subscribe: jest.fn(),
    }));
    container.register(tokens.IEntityManager, () => ({}));
    container.register(tokens.DomUiFacade, () => ({}));
    container.register(tokens.GameLoop, () => mockGameLoop);
    
    // Add ActionIndex and GameDataRepository registrations for InitializationService
    container.register(tokens.ActionIndex, () => ({
      buildIndex: jest.fn(),
      getCandidateActions: jest.fn().mockReturnValue([])
    }));
    container.register(tokens.IGameDataRepository, () => ({
      getAllActionDefinitions: jest.fn().mockReturnValue([])
    }));
    container.register(tokens.ISpatialIndexManager, () => ({
      buildIndex: jest.fn()
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers InitializationService and ShutdownService as singleton factories', () => {
    registerOrchestration(container);

    expectSingleton(
      container,
      tokens.IInitializationService,
      InitializationService
    );
    expectSingleton(container, tokens.ShutdownService, ShutdownService);

    const initCall = registerSpy.mock.calls.find(
      (c) => c[0] === tokens.IInitializationService
    );
    expect(initCall[2]?.lifecycle).toBe('singletonFactory');

    const shutdownCall = registerSpy.mock.calls.find(
      (c) => c[0] === tokens.ShutdownService
    );
    expect(shutdownCall[2]?.lifecycle).toBe('singletonFactory');

    const logs = mockLogger.debug.mock.calls.map((c) => c[0]);
    expect(logs[0]).toBe('Orchestration Registration: Starting...');
    expect(logs).toContain(
      `Orchestration Registration: Registered ${tokens.IInitializationService} (Singleton).`
    );
    expect(logs).toContain(
      `Orchestration Registration: Registered ${tokens.ShutdownService} (Singleton).`
    );
    expect(logs).toContain('Orchestration Registration: Complete.');
  });

  it('throws descriptive error when dispatcher resolves to undefined', () => {
    const badContainer = new AppContainer();
    badContainer.register(tokens.ILogger, () => mockLogger);
    badContainer.register(tokens.IValidatedEventDispatcher, () => undefined);
    badContainer.register(tokens.ModsLoader, () => ({ loadMods: jest.fn() }));
    badContainer.register(tokens.IScopeRegistry, () => ({
      initialize: jest.fn(),
    }));
    badContainer.register(tokens.IDataRegistry, () => ({ getAll: jest.fn() }));
    badContainer.register(tokens.LLMAdapter, () => ({ init: jest.fn() }));
    badContainer.register(tokens.LlmConfigLoader, () => ({
      loadConfigs: jest.fn(),
    }));
    badContainer.register(tokens.SystemInitializer, () => ({
      initializeAll: jest.fn(),
    }));
    badContainer.register(tokens.WorldInitializer, () => ({
      initializeWorldEntities: jest.fn(),
    }));
    badContainer.register(tokens.ISafeEventDispatcher, () => ({
      subscribe: jest.fn(),
    }));
    badContainer.register(tokens.IEntityManager, () => ({}));
    badContainer.register(tokens.DomUiFacade, () => ({}));
    badContainer.register(tokens.GameLoop, () => mockGameLoop);
    
    // Add ActionIndex and GameDataRepository registrations
    badContainer.register(tokens.ActionIndex, () => ({
      buildIndex: jest.fn(),
      getCandidateActions: jest.fn().mockReturnValue([])
    }));
    badContainer.register(tokens.IGameDataRepository, () => ({
      getAllActionDefinitions: jest.fn().mockReturnValue([])
    }));
    badContainer.register(tokens.ISpatialIndexManager, () => ({
      buildIndex: jest.fn()
    }));

    registerOrchestration(badContainer);

    expect(() => badContainer.resolve(tokens.IInitializationService)).toThrow(
      `InitializationService Factory: Failed to resolve dependency: ${tokens.IValidatedEventDispatcher}`
    );
  });

  it('throws descriptive error when GameLoop resolves to undefined', () => {
    const badContainer = new AppContainer();
    badContainer.register(tokens.ILogger, () => mockLogger);
    badContainer.register(
      tokens.IValidatedEventDispatcher,
      () => mockDispatcher
    );
    badContainer.register(tokens.ModsLoader, () => ({ loadMods: jest.fn() }));
    badContainer.register(tokens.IScopeRegistry, () => ({
      initialize: jest.fn(),
    }));
    badContainer.register(tokens.IDataRegistry, () => ({ getAll: jest.fn() }));
    badContainer.register(tokens.LLMAdapter, () => ({ init: jest.fn() }));
    badContainer.register(tokens.LlmConfigLoader, () => ({
      loadConfigs: jest.fn(),
    }));
    badContainer.register(tokens.SystemInitializer, () => ({
      initializeAll: jest.fn(),
    }));
    badContainer.register(tokens.WorldInitializer, () => ({
      initializeWorldEntities: jest.fn(),
    }));
    badContainer.register(tokens.ISafeEventDispatcher, () => ({
      subscribe: jest.fn(),
    }));
    badContainer.register(tokens.IEntityManager, () => ({}));
    badContainer.register(tokens.DomUiFacade, () => ({}));
    badContainer.register(tokens.GameLoop, () => undefined);
    
    // Add ActionIndex and GameDataRepository registrations
    badContainer.register(tokens.ActionIndex, () => ({
      buildIndex: jest.fn(),
      getCandidateActions: jest.fn().mockReturnValue([])
    }));
    badContainer.register(tokens.IGameDataRepository, () => ({
      getAllActionDefinitions: jest.fn().mockReturnValue([])
    }));
    badContainer.register(tokens.ISpatialIndexManager, () => ({
      buildIndex: jest.fn()
    }));

    registerOrchestration(badContainer);

    expect(() => badContainer.resolve(tokens.ShutdownService)).toThrow(
      `ShutdownService Factory: Failed to resolve dependency: ${tokens.GameLoop}`
    );
  });
});
