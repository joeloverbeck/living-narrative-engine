import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const WORLD = 'world';

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
  logger = { error: jest.fn(), debug: jest.fn() };
  dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  modsLoader = { loadMods: jest.fn().mockResolvedValue({}) };
  scopeRegistry = { initialize: jest.fn() };
  dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
  llmAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    isOperational: jest.fn().mockReturnValue(true),
    isInitialized: jest.fn().mockReturnValue(false),
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

describe('InitializationService failure scenarios', () => {
  const createService = () =>
    new InitializationService({
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
      domUiFacade,
    });

  it('fails when ModsLoader.loadMods rejects', async () => {
    const error = new Error('load');
    modsLoader.loadMods.mockRejectedValueOnce(error);
    const svc = createService();
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });

  it('fails when ScopeRegistry.initialize throws', async () => {
    const err = new Error('scope');
    scopeRegistry.initialize.mockImplementation(() => {
      throw err;
    });
    const svc = createService();
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBe(err);
  });

  it('fails when SystemInitializer.initializeAll rejects', async () => {
    const err = new Error('sys');
    systemInitializer.initializeAll.mockRejectedValueOnce(err);
    const svc = createService();
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBe(err);
  });

  it('fails when WorldInitializer reports failure', async () => {
    worldInitializer.initializeWorldEntities.mockReturnValueOnce(false);
    const svc = createService();
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});
