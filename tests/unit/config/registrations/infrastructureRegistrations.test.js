// src/tests/dependencyInjection/registrations/infrastructureRegistrations.test.js

import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerInfrastructure } from '../../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import { mockDeep } from 'jest-mock-extended';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
// NOTE: ActualEntityManager import is no longer needed in this file.

// --- Mock Dependencies ---
// Mock only the essential dependencies needed for registerInfrastructure and ValidatedEventDispatcher
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockEventBus = {
  dispatch: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};
// GameDataRepository is registered with its concrete token by infrastructureRegistrations
// but used as an interface by others. For pre-registration, let's use the concrete.
const mockGameDataRepositoryConcrete = {
  getEventDefinition: jest.fn(),
  getActionDefinition: jest.fn(),
};
const mockSchemaValidator = {
  validate: jest.fn().mockReturnValue({ isValid: true }),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  addSchema: jest.fn(),
};
const mockDataRegistry = mockDeep();
const mockSchemaLoader = mockDeep();
const mockConditionLoader = mockDeep();
const mockComponentLoader = mockDeep();
const mockRuleLoader = mockDeep();
const mockActionLoader = mockDeep();
const mockEventLoader = mockDeep();
const mockEntityLoader = mockDeep();
const mockConfiguration = mockDeep();
const mockGameConfigLoader = mockDeep();
const mockModManifestLoader = mockDeep();
const mockPathResolver = mockDeep();
const mockSpatialIndexManager = mockDeep();

describe('registerInfrastructure', () => {
  let container;

  beforeEach(() => {
    container = new AppContainer();
    // Register mocks needed by registerInfrastructure and its direct/indirect dependencies
    container.register(tokens.ILogger, () => mockLogger);

    // These are overwritten by registerInfrastructure, causing warnings.
    // If testing registerInfrastructure in isolation, these might not be needed here,
    // or the test could clear specific registrations before calling registerInfrastructure.
    // For now, we'll leave them as they demonstrate the "overwrite" but don't break most tests.
    container.register(tokens.EventBus, () => mockEventBus); // Will be overwritten
    container.register(tokens.IEventBus, () => mockEventBus); // Will be overwritten
    container.register(
      tokens.ISpatialIndexManager,
      () => mockSpatialIndexManager
    ); // Will be overwritten

    // Dependencies that are *resolved by* factories within registerInfrastructure
    container.register(
      tokens.GameDataRepository,
      () => mockGameDataRepositoryConcrete
    ); // For ValidatedEventDispatcher if it resolved concrete
    container.register(
      tokens.IGameDataRepository,
      () => mockGameDataRepositoryConcrete
    ); // Pre-register mock for IGameDataRepository
    container.register(tokens.ISchemaValidator, () => mockSchemaValidator);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(tokens.SchemaLoader, () => mockSchemaLoader);
    container.register(tokens.ConditionLoader, () => mockConditionLoader);
    container.register(tokens.ComponentLoader, () => mockComponentLoader);
    container.register(tokens.RuleLoader, () => mockRuleLoader);
    container.register(tokens.ActionLoader, () => mockActionLoader);
    container.register(tokens.EventLoader, () => mockEventLoader);
    container.register(tokens.MacroLoader, () => ({
      loadItemsForMod: jest.fn(),
    }));
    container.register(tokens.EntityLoader, () => mockEntityLoader);
    container.register(tokens.IConfiguration, () => mockConfiguration);
    container.register(tokens.GameConfigLoader, () => mockGameConfigLoader);
    container.register(tokens.PromptTextLoader, () => ({
      loadPromptText: jest.fn(),
    }));
    container.register(tokens.ModManifestLoader, () => mockModManifestLoader);
    container.register(tokens.IDataFetcher, () => ({ fetch: jest.fn() }));
    container.register(tokens.IPathResolver, () => mockPathResolver);
    // IScopeRegistry is required by ScopeEngine but registered in commandAndActionRegistrations
    // Mock it here for test isolation
    container.register(tokens.IScopeRegistry, () => ({
      registerScope: jest.fn(),
      getScope: jest.fn(),
      hasScope: jest.fn(),
      getAllScopes: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should register EventBus correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.EventBus)).not.toThrow();
    const eventBus = container.resolve(tokens.EventBus);
    expect(eventBus).toBeDefined();
    // expect(eventBus).toBeInstanceOf(ActualEventBus); // If you import the actual EventBus
    expect(container.resolve(tokens.IEventBus)).toBe(eventBus);
  });

  test('should register ISpatialIndexManager correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ISpatialIndexManager)).not.toThrow();
    const spatialManager = container.resolve(tokens.ISpatialIndexManager);
    expect(spatialManager).toBeDefined();
    // expect(spatialManager).toBeInstanceOf(ActualSpatialIndexManager); // If you import it
  });

  test('should register ModsLoader correctly', () => {
    // This test has been removed as ModsLoader is now registered in loadersRegistrations.js
    // registerInfrastructure(container);
    // expect(() => container.resolve(tokens.ModsLoader)).not.toThrow();
    // const modsLoader = container.resolve(tokens.ModsLoader);
    // expect(modsLoader).toBeDefined();
    // expect(modsLoader).toBeInstanceOf(ActualModsLoader); // If you import it
  });

  test('should register MacroLoader correctly', () => {
    // This test has been removed as MacroLoader is not registered in infrastructureRegistrations.js
  });

  test('should register GameDataRepository correctly (against IGameDataRepository)', () => {
    registerInfrastructure(container);
    // It's registered against IGameDataRepository
    expect(() => container.resolve(tokens.IGameDataRepository)).not.toThrow();
    const repo = container.resolve(tokens.IGameDataRepository);
    expect(repo).toBeDefined();
    // expect(repo).toBeInstanceOf(ActualGameDataRepository); // If you import it

    // The concrete token GameDataRepository is aliased to the interface token.
    // Resolving either token should return the same singleton instance.
    expect(() => container.resolve(tokens.GameDataRepository)).not.toThrow();
    expect(container.resolve(tokens.GameDataRepository)).toBe(repo);
  });

  // THIS TEST HAS BEEN REMOVED
  // As per Ticket 8, the IEntityManager is no longer registered in the infrastructure bundle.
  // This test is now obsolete and its failure is expected. The registration is tested
  // in the worldAndEntityRegistrations.test.js suite.
  // test('should register EntityManager correctly (against IEntityManager)', () => { ... });

  test('should register IValidatedEventDispatcher correctly', () => {
    registerInfrastructure(container);
    expect(() =>
      container.resolve(tokens.IValidatedEventDispatcher)
    ).not.toThrow();
    const dispatcherInstance = container.resolve(
      tokens.IValidatedEventDispatcher
    );
    expect(dispatcherInstance).toBeInstanceOf(ValidatedEventDispatcher);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Registered ${String(tokens.IValidatedEventDispatcher)}.`
    );
  });

  test('should register ServiceSetup correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ServiceSetup)).not.toThrow();
    const serviceSetup = container.resolve(tokens.ServiceSetup);
    expect(serviceSetup).toBeDefined();
  });

  test('should register IPathConfiguration correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.IPathConfiguration)).not.toThrow();
    const pathConfig = container.resolve(tokens.IPathConfiguration);
    expect(pathConfig).toBeDefined();
  });

  test('should register ITraceConfigLoader correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ITraceConfigLoader)).not.toThrow();
    const traceConfigLoader = container.resolve(tokens.ITraceConfigLoader);
    expect(traceConfigLoader).toBeDefined();
  });

  test('should register ActionIndexingService correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ActionIndexingService)).not.toThrow();
    const actionIndexingService = container.resolve(
      tokens.ActionIndexingService
    );
    expect(actionIndexingService).toBeDefined();
  });

  test('should register ISafeEventDispatcher correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ISafeEventDispatcher)).not.toThrow();
    const safeEventDispatcher = container.resolve(tokens.ISafeEventDispatcher);
    expect(safeEventDispatcher).toBeDefined();
  });

  test('should register EventDispatchService correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.EventDispatchService)).not.toThrow();
    const eventDispatchService = container.resolve(tokens.EventDispatchService);
    expect(eventDispatchService).toBeDefined();
  });

  test('should register ScopeEngine correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ScopeEngine)).not.toThrow();
    const scopeEngine = container.resolve(tokens.ScopeEngine);
    expect(scopeEngine).toBeDefined();
  });

  test('should register DslParser correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.DslParser)).not.toThrow();
    const dslParser = container.resolve(tokens.DslParser);
    expect(dslParser).toBeDefined();
  });

  test('should register IScopeEngine correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.IScopeEngine)).not.toThrow();
    const scopeEngine = container.resolve(tokens.IScopeEngine);
    expect(scopeEngine).toBeDefined();
    // Should be the same instance as ScopeEngine
    expect(scopeEngine).toBe(container.resolve(tokens.ScopeEngine));
  });

  test('should handle optional dependencies gracefully', () => {
    // Test that EventDispatchService can resolve even when action tracing tokens are not available
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.EventDispatchService)).not.toThrow();
    const eventDispatchService = container.resolve(tokens.EventDispatchService);
    expect(eventDispatchService).toBeDefined();
  });

  test('should log completion message', () => {
    registerInfrastructure(container);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Infrastructure Registration: complete.'
    );
  });
});
