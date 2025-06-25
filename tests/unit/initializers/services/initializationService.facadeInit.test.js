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
let thoughtListener;
let notesListener;

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
  thoughtListener = { handleEvent: jest.fn() };
  notesListener = { handleEvent: jest.fn() };
});

describe('InitializationService DomUiFacade handling', () => {
  it('throws when DomUiFacade is missing', () => {
    expect(() => {
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
        actionIndex: { buildIndex: jest.fn() },
        gameDataRepository: {
          getAllActionDefinitions: jest.fn().mockReturnValue([]),
        },
        thoughtListener,
        notesListener,
        // domUiFacade: domUiFacade, // Intentionally omitted
      });
    }).toThrow('InitializationService requires a domUiFacade dependency');
  });
});
