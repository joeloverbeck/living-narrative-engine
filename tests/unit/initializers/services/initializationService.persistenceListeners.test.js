import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../../src/initializers/services/initHelpers.js', () => ({
  setupPersistenceListeners: jest.fn(),
}));

import { setupPersistenceListeners } from '../../../../src/initializers/services/initHelpers.js';
import InitializationService from '../../../../src/initializers/services/initializationService.js';
import LlmAdapterInitializer from '../../../../src/initializers/services/llmAdapterInitializer.js';
import { ACTION_DECIDED_ID } from '../../../../src/constants/eventIds.js';

const WORLD = 'persistenceWorld';

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
let actionIndex;
let gameDataRepository;
let thoughtListener;
let notesListener;
let contentDependencyValidator;
let llmAdapterInitializer;

beforeEach(() => {
  jest.clearAllMocks();
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
  actionIndex = { buildIndex: jest.fn() };
  gameDataRepository = {
    getAllActionDefinitions: jest.fn().mockReturnValue([]),
  };
  thoughtListener = { handleEvent: jest.fn() };
  notesListener = { handleEvent: jest.fn() };
  contentDependencyValidator = {
    validate: jest.fn().mockResolvedValue(undefined),
  };
  llmAdapterInitializer = new LlmAdapterInitializer();
});

describe('InitializationService persistence listener setup', () => {
  it('calls setupPersistenceListeners with dispatcher, listeners, and logger', async () => {
    const service = new InitializationService({
      log: { logger },
      events: { validatedEventDispatcher: dispatcher, safeEventDispatcher },
      llm: { llmAdapter, llmConfigLoader },
      persistence: {
        entityManager,
        domUiFacade,
        actionIndex,
        gameDataRepository,
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
        llmAdapterInitializer,
      },
    });

    await service.runInitializationSequence(WORLD);

    expect(setupPersistenceListeners).toHaveBeenCalledTimes(1);
    const [dispatcherArg, listenersArg, loggerArg] =
      setupPersistenceListeners.mock.calls[0];
    expect(dispatcherArg).toBe(safeEventDispatcher);
    expect(loggerArg).toBe(logger);
    expect(Array.isArray(listenersArg)).toBe(true);
    expect(listenersArg).toEqual([
      { eventId: ACTION_DECIDED_ID, handler: expect.any(Function) },
      { eventId: ACTION_DECIDED_ID, handler: expect.any(Function) },
    ]);
  });
});
