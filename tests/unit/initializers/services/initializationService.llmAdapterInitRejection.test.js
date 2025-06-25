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
  logger = { error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  modsLoader = { loadMods: jest.fn().mockResolvedValue({}) };
  scopeRegistry = { initialize: jest.fn() };
  dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
  llmAdapter = {
    init: jest.fn(),
    isOperational: jest.fn().mockReturnValue(false),
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

describe('InitializationService LLM adapter rejection', () => {
  it('continues when llmAdapter.init rejects', async () => {
    const error = new Error('adapter');
    llmAdapter.init.mockRejectedValueOnce(error);

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
      domUiFacade,
      actionIndex: { buildIndex: jest.fn() },
      gameDataRepository: {
        getAllActionDefinitions: jest.fn().mockReturnValue([]),
      },
      thoughtListener,
      notesListener,
      spatialIndexManager: { buildIndex: jest.fn() },
    });

    const result = await svc.runInitializationSequence(WORLD);
    expect(logger.error).toHaveBeenCalledWith(
      `InitializationService: CRITICAL error during ConfigurableLLMAdapter.init(): ${error.message}`,
      expect.objectContaining({ errorName: error.name })
    );
    expect(result.success).toBe(true);
  });
});
