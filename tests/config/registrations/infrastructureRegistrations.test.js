// src/tests/dependencyInjection/registrations/infrastructureRegistrations.test.js

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { mockDeep } from 'jest-mock-extended';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import ActualEntityManager from '../../../src/entities/entityManager.js'; // Import the actual class for instanceof check

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
    container.register(
      tokens.ComponentDefinitionLoader,
      () => mockComponentLoader
    );
    container.register(tokens.RuleLoader, () => mockRuleLoader);
    container.register(tokens.ActionLoader, () => mockActionLoader);
    container.register(tokens.EventLoader, () => mockEventLoader);
    container.register(tokens.MacroLoader, () => ({
      loadItemsForMod: jest.fn(),
    }));
    container.register(tokens.EntityLoader, () => mockEntityLoader);
    container.register(tokens.IConfiguration, () => mockConfiguration);
    container.register(tokens.GameConfigLoader, () => mockGameConfigLoader);
    container.register(tokens.ModManifestLoader, () => mockModManifestLoader);
    container.register(tokens.IPathResolver, () => mockPathResolver);
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
  });

  test('should register ISpatialIndexManager correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.ISpatialIndexManager)).not.toThrow();
    const spatialManager = container.resolve(tokens.ISpatialIndexManager);
    expect(spatialManager).toBeDefined();
    // expect(spatialManager).toBeInstanceOf(ActualSpatialIndexManager); // If you import it
  });

  test('should register WorldLoader correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.WorldLoader)).not.toThrow();
    const worldLoader = container.resolve(tokens.WorldLoader);
    expect(worldLoader).toBeDefined();
    // expect(worldLoader).toBeInstanceOf(ActualWorldLoader); // If you import it
  });

  test('should register MacroLoader correctly', () => {
    registerInfrastructure(container);
    expect(() => container.resolve(tokens.MacroLoader)).not.toThrow();
    const macroLoader = container.resolve(tokens.MacroLoader);
    expect(macroLoader).toBeDefined();
  });

  test('should register GameDataRepository correctly (against IGameDataRepository)', () => {
    registerInfrastructure(container);
    // It's registered against IGameDataRepository
    expect(() => container.resolve(tokens.IGameDataRepository)).not.toThrow();
    const repo = container.resolve(tokens.IGameDataRepository);
    expect(repo).toBeDefined();
    // expect(repo).toBeInstanceOf(ActualGameDataRepository); // If you import it

    // The concrete token GameDataRepository might not be registered by registerInfrastructure
    // if it standardizes on interfaces. Let's check the current behavior.
    // The logs show "GameDataRepository" being registered by AppContainer in beforeEach.
    // infrastructureRegistrations registers against IGameDataRepository.
    // So, resolving GameDataRepository should still give the mock from beforeEach.
    expect(() => container.resolve(tokens.GameDataRepository)).not.toThrow();
    expect(container.resolve(tokens.GameDataRepository)).toBe(
      mockGameDataRepositoryConcrete
    );
  });

  test('should register EntityManager correctly (against IEntityManager)', () => {
    registerInfrastructure(container);
    // Corrected to resolve using the interface token
    expect(() => container.resolve(tokens.IEntityManager)).not.toThrow();
    const entityManager = container.resolve(tokens.IEntityManager);
    expect(entityManager).toBeDefined();
    expect(entityManager).toBeInstanceOf(ActualEntityManager); // Verify it's the correct concrete type
  });

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
      `Infrastructure Registration: Registered ${tokens.IValidatedEventDispatcher}.`
    );
  });

  test('should log completion message', () => {
    registerInfrastructure(container);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Infrastructure Registration: complete.'
    );
  });
});
