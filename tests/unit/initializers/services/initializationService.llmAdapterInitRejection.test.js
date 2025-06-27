import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { UI_SHOW_FATAL_ERROR_ID } from '../../../../src/constants/eventIds.js';
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
let contentDependencyValidator;

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
  contentDependencyValidator = {
    validate: jest.fn().mockResolvedValue(undefined),
  };
});

describe('InitializationService LLM adapter rejection', () => {
  it('fails when llmAdapter.init rejects', async () => {
    const error = new Error('adapter');
    llmAdapter.init.mockRejectedValueOnce(error);

    const svc = new InitializationService({
      log: { logger },
      events: { validatedEventDispatcher: dispatcher, safeEventDispatcher },
      llm: { llmAdapter, llmConfigLoader },
      persistence: {
        entityManager,
        domUiFacade,
        actionIndex: { buildIndex: jest.fn() },
        gameDataRepository: {
          getAllActionDefinitions: jest.fn().mockReturnValue([]),
        },
        thoughtListener,
        notesListener,
        spatialIndexManager: { buildIndex: jest.fn() },
      },
      coreSystems: {
        modsLoader,
        scopeRegistry,
        dataRegistry,
        systemInitializer,
        worldInitializer,
        contentDependencyValidator,
      },
    });

    const result = await svc.runInitializationSequence(WORLD);
    expect(logger.error).toHaveBeenCalledWith(
      `InitializationService: CRITICAL error during ConfigurableLLMAdapter.init(): ${error.message}`,
      expect.objectContaining({ errorName: error.name })
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      UI_SHOW_FATAL_ERROR_ID,
      expect.any(Object)
    );
    expect(result.success).toBe(false);
  });
});
