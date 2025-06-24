import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const MOCK_WORLD = 'testWorld';

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

beforeEach(() => {
  logger = { error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  modsLoader = {
    loadMods: jest.fn().mockResolvedValue({
      finalModOrder: [],
      totals: {},
      incompatibilities: 0,
    }),
  };
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
  gameDataRepository = { getAllActionDefinitions: jest.fn().mockReturnValue([]) };
});

describe('InitializationService success path', () => {
  it('runs the initialization sequence successfully', async () => {
    const service = new InitializationService({
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
      actionIndex,
      gameDataRepository,
    });

    const result = await service.runInitializationSequence(MOCK_WORLD);

    expect(modsLoader.loadMods).toHaveBeenCalledWith(MOCK_WORLD);
    expect(llmAdapter.init).toHaveBeenCalled();
    expect(systemInitializer.initializeAll).toHaveBeenCalled();
    expect(worldInitializer.initializeWorldEntities).toHaveBeenCalledWith(
      MOCK_WORLD
    );
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
