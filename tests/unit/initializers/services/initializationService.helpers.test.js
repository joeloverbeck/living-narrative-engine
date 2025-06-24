import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

let service;
let mockContainer;
let mockLogger;
let mockValidatedEventDispatcher;
let mockModsLoader;
let mockSystemInitializer;
let mockWorldInitializer;
let mockDomUiFacade;
let mockLlmAdapter;
let mockDataRegistry;
let mockScopeRegistry;
let mockSchemaValidator;
let mockConfiguration;

const WORLD = 'demoWorld';

beforeEach(() => {
  mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  };
  mockValidatedEventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
  mockModsLoader = { loadMods: jest.fn().mockResolvedValue({}) };
  mockSystemInitializer = {
    initializeAll: jest.fn().mockResolvedValue(undefined),
  };
  mockWorldInitializer = {
    initializeWorldEntities: jest.fn().mockResolvedValue(true),
  };
  mockDomUiFacade = {};
  mockLlmAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(false),
    isOperational: jest.fn().mockReturnValue(true),
  };
  mockDataRegistry = { get: jest.fn().mockReturnValue({}) };
  mockScopeRegistry = { initialize: jest.fn() };
  mockSchemaValidator = { validate: jest.fn() };
  mockConfiguration = { getContentTypeSchemaId: jest.fn() };

  mockContainer = {
    resolve: jest.fn((token) => {
      switch (token) {
        case tokens.ModsLoader:
          return mockModsLoader;
        case tokens.SystemInitializer:
          return mockSystemInitializer;
        case tokens.WorldInitializer:
          return mockWorldInitializer;
        case tokens.DomUiFacade:
          return mockDomUiFacade;
        case tokens.LLMAdapter:
          return mockLlmAdapter;
        case tokens.ISafeEventDispatcher:
          return {
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
            dispatch: jest.fn(),
          };
        case tokens.IEntityManager:
          return { getEntityInstance: jest.fn() };
        case tokens.IScopeRegistry:
          return mockScopeRegistry;
        case tokens.IDataRegistry:
          return mockDataRegistry;
        case tokens.ILogger:
          return mockLogger;
        case tokens.ISchemaValidator:
          return mockSchemaValidator;
        case tokens.IConfiguration:
          return mockConfiguration;
        default:
          return undefined;
      }
    }),
  };

  service = new InitializationService({
    container: mockContainer,
    logger: mockLogger,
    validatedEventDispatcher: mockValidatedEventDispatcher,
  });
});

describe('InitializationService helper methods', () => {
  it('_validateWorldName rejects invalid input', () => {
    const res = service._validateWorldName('');
    expect(res.success).toBe(false);
    expect(res.error).toBeInstanceOf(Error);
  });

  it('_loadWorldData resolves ModsLoader and loads mods', async () => {
    await service._loadWorldData(WORLD);
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ModsLoader);
    expect(mockModsLoader.loadMods).toHaveBeenCalledWith(WORLD);
  });

  it('_initializeScopeRegistry initializes scopes', () => {
    service._initializeScopeRegistry();
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IScopeRegistry);
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.IDataRegistry);
    expect(mockScopeRegistry.initialize).toHaveBeenCalledWith({});
  });

  it('_initializeLlmAdapter calls adapter.init when not initialized', async () => {
    await service._initializeLlmAdapter();
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.LLMAdapter);
    expect(mockLlmAdapter.init).toHaveBeenCalled();
  });

  it('_initializeSystems initializes tagged systems', async () => {
    await service._initializeSystems();
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokens.SystemInitializer
    );
    expect(mockSystemInitializer.initializeAll).toHaveBeenCalled();
  });

  it('_initializeWorldEntities invokes world initializer', async () => {
    await service._initializeWorldEntities(WORLD);
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WorldInitializer);
    expect(mockWorldInitializer.initializeWorldEntities).toHaveBeenCalledWith(
      WORLD
    );
  });

  it('_instantiateDomUi resolves DomUiFacade', () => {
    service._instantiateDomUi();
    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.DomUiFacade);
  });
});
