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
let thoughtListener;
let notesListener;

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
  thoughtListener = { handleEvent: jest.fn() };
  notesListener = { handleEvent: jest.fn() };
});

describe('InitializationService failure scenarios', () => {
  const createService = (overrides = {}) => {
    const defaults = {
      logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
      validatedEventDispatcher: {
        dispatch: jest.fn().mockResolvedValue(undefined),
      },
      modsLoader: { loadMods: jest.fn() },
      scopeRegistry: { initialize: jest.fn() },
      dataRegistry: { getAll: jest.fn().mockReturnValue([]) },
      llmAdapter: { init: jest.fn() },
      llmConfigLoader: { loadConfigs: jest.fn() },
      systemInitializer: { initializeAll: jest.fn() },
      worldInitializer: { initializeWorldEntities: jest.fn() },
      safeEventDispatcher: { subscribe: jest.fn() },
      entityManager: {},
      domUiFacade: {},
      actionIndex: { buildIndex: jest.fn() },
      gameDataRepository: {
        getAllActionDefinitions: jest.fn().mockReturnValue([]),
      },
      thoughtListener: { handleEvent: jest.fn() },
      notesListener: { handleEvent: jest.fn() },
    };
    const deps = { ...defaults, ...overrides };
    return new InitializationService(deps);
  };

  it('fails when ModsLoader.loadMods rejects', async () => {
    const error = new Error('load');
    const svc = createService({
      modsLoader: { loadMods: jest.fn().mockRejectedValueOnce(error) },
    });
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });

  it('fails when ScopeRegistry.initialize throws', async () => {
    const err = new Error('scope');
    const svc = createService({
      scopeRegistry: {
        initialize: jest.fn().mockImplementation(() => {
          throw err;
        }),
      },
    });
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBe(err);
  });

  it('fails when SystemInitializer.initializeAll rejects', async () => {
    const err = new Error('sys');
    const svc = createService({
      systemInitializer: {
        initializeAll: jest.fn().mockRejectedValueOnce(err),
      },
    });
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBe(err);
  });

  it('fails when WorldInitializer reports failure', async () => {
    const svc = createService({
      worldInitializer: {
        initializeWorldEntities: jest.fn().mockReturnValueOnce(false),
      },
    });
    const result = await svc.runInitializationSequence(WORLD);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});
