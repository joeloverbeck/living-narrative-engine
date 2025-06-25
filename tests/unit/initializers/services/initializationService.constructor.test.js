import InitializationService from '../../../../src/initializers/services/initializationService.js';
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
});

describe('InitializationService constructor', () => {
  it('creates instance with valid dependencies', () => {
    expect(
      () =>
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
          actionIndex,
          gameDataRepository,
          thoughtListener,
          notesListener,
        })
    ).not.toThrow();
  });

  it('throws if logger is missing', () => {
    expect(
      () =>
        new InitializationService({
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
          thoughtListener,
          notesListener,
        })
    ).toThrow(/logger/);
  });

  it('throws if validatedEventDispatcher is missing', () => {
    expect(
      () =>
        new InitializationService({
          logger,
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
          thoughtListener,
          notesListener,
        })
    ).toThrow(/validatedEventDispatcher/);
  });
});
