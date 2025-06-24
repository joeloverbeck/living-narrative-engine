import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let logger;
let dispatcher;
let modsLoader;
let scopeRegistry;
let dataRegistry;
let llmAdapter;
let llmConfigLoader;
let systemInitializer;
let worldInitializer;
let safeEventDispatcher;
let entityManager;
let domUiFacade;

beforeEach(() => {
  logger = { error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  modsLoader = { loadMods: jest.fn().mockResolvedValue({}) };
  scopeRegistry = { initialize: jest.fn() };
  dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
  llmAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(false),
    isOperational: jest.fn().mockReturnValue(true),
  };
  llmConfigLoader = { loadConfigs: jest.fn() };
  systemInitializer = { initializeAll: jest.fn().mockResolvedValue(undefined) };
  worldInitializer = {
    initializeWorldEntities: jest.fn().mockReturnValue(true),
  };
  safeEventDispatcher = { subscribe: jest.fn() };
  entityManager = {};
  domUiFacade = {};
});

describe('InitializationService DomUiFacade handling', () => {
  it('throws when DomUiFacade is missing', async () => {
    const svc = new InitializationService({
      logger,
      validatedEventDispatcher: dispatcher,
      modsLoader,
      scopeRegistry,
      dataRegistry,
      llmAdapter,
      llmConfigLoader,
      systemInitializer,
      worldInitializer,
      safeEventDispatcher,
      entityManager,
      domUiFacade: undefined,
    });

    const result = await svc.runInitializationSequence('w');
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});
