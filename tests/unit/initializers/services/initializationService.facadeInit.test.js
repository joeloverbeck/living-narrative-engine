import InitializationService from '../../../../src/initializers/services/initializationService.js';
import LlmAdapterInitializer from '../../../../src/initializers/services/llmAdapterInitializer.js';
import { SystemInitializationError } from '../../../../src/errors/InitializationError.js';
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
let contentDependencyValidator;
let llmAdapterInitializer;

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
  contentDependencyValidator = {
    validate: jest.fn().mockResolvedValue(undefined),
  };
  llmAdapterInitializer = new LlmAdapterInitializer();
});

describe('InitializationService DomUiFacade handling', () => {
  it('throws when DomUiFacade is missing', () => {
    expect(() => {
      const svc = new InitializationService({
        log: { logger },
        events: { validatedEventDispatcher: dispatcher, safeEventDispatcher },
        llm: { llmAdapter, llmConfigLoader },
        persistence: {
          entityManager,
          actionIndex: { buildIndex: jest.fn() },
          gameDataRepository: {
            getAllActionDefinitions: jest.fn().mockReturnValue([]),
          },
          thoughtListener,
          notesListener,
          // domUiFacade omitted
        },
        coreSystems: {
          modsLoader,
          scopeRegistry,
          dataRegistry,
          systemInitializer,
          worldInitializer,
          contentDependencyValidator,
          llmAdapterInitializer,
          // spatialIndexManager intentionally missing for this test
        },
      });
    }).toThrow(SystemInitializationError);
    expect(() => {
      const svc = new InitializationService({
        log: { logger },
        events: { validatedEventDispatcher: dispatcher, safeEventDispatcher },
        llm: { llmAdapter, llmConfigLoader },
        persistence: {
          entityManager,
          actionIndex: { buildIndex: jest.fn() },
          gameDataRepository: {
            getAllActionDefinitions: jest.fn().mockReturnValue([]),
          },
          thoughtListener,
          notesListener,
          // domUiFacade omitted
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
    }).toThrow('InitializationService requires a domUiFacade dependency');
  });
});
