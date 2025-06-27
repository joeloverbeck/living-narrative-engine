import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { SystemInitializationError } from '../../../../src/errors/InitializationError.js';
import { describe, it, expect, beforeEach } from '@jest/globals';

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
let spatialIndexManager;

beforeEach(() => {
  logger = { error: jest.fn(), debug: jest.fn() };
  dispatcher = { dispatch: jest.fn() };
  modsLoader = { loadMods: jest.fn() };
  scopeRegistry = { initialize: jest.fn() };
  dataRegistry = { getAll: jest.fn() };
  llmAdapter = { init: jest.fn() };
  llmConfigLoader = { loadConfigs: jest.fn() };
  systemInitializer = { initializeAll: jest.fn() };
  worldInitializer = { initializeWorldEntities: jest.fn() };
  safeEventDispatcher = { subscribe: jest.fn() };
  entityManager = {};
  domUiFacade = {};
  actionIndex = { buildIndex: jest.fn() };
  gameDataRepository = { getAllActionDefinitions: jest.fn(() => []) };
  thoughtListener = { handleEvent: jest.fn() };
  notesListener = { handleEvent: jest.fn() };
  spatialIndexManager = { buildIndex: jest.fn() };
});

describe('InitializationService constructor', () => {
  it('creates instance with valid dependencies', () => {
    expect(() =>
      new InitializationService({
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
          spatialIndexManager,
        },
        coreSystems: {
          modsLoader,
          scopeRegistry,
          dataRegistry,
          systemInitializer,
          worldInitializer,
        },
      })
    ).not.toThrow();
  });

  it('throws if logger is missing', () => {
    const create = () =>
      new InitializationService({
        events: { validatedEventDispatcher: dispatcher, safeEventDispatcher },
        llm: { llmAdapter, llmConfigLoader },
        persistence: {
          entityManager,
          domUiFacade,
          actionIndex,
          gameDataRepository,
          thoughtListener,
          notesListener,
          spatialIndexManager,
        },
        coreSystems: {
          modsLoader,
          scopeRegistry,
          dataRegistry,
          systemInitializer,
          worldInitializer,
        },
      });
    expect(create).toThrow(SystemInitializationError);
    expect(create).toThrow(/logger/);
  });

  it('throws if validatedEventDispatcher is missing', () => {
    const createVD = () =>
      new InitializationService({
        log: { logger },
        events: { safeEventDispatcher },
        llm: { llmAdapter, llmConfigLoader },
        persistence: {
          entityManager,
          domUiFacade,
          actionIndex,
          gameDataRepository,
          thoughtListener,
          notesListener,
          spatialIndexManager,
        },
        coreSystems: {
          modsLoader,
          scopeRegistry,
          dataRegistry,
          systemInitializer,
          worldInitializer,
        },
      });
    expect(createVD).toThrow(SystemInitializationError);
    expect(createVD).toThrow(/validatedEventDispatcher/);
  });
});
