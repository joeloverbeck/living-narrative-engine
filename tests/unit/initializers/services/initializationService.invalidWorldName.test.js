import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { expectNoDispatch } from '../../../common/engine/dispatchTestUtils.js';

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
  thoughtListener = { handleEvent: jest.fn() };
  notesListener = { handleEvent: jest.fn() };
});

describe('InitializationService invalid world name handling', () => {
  it.each([[null], [undefined], ['']])(
    'returns failure for %p',
    async (bad) => {
      const service = new InitializationService({
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
        },
      });

      const result = await service.runInitializationSequence(bad);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TypeError);
      expect(modsLoader.loadMods).not.toHaveBeenCalled();
      expectNoDispatch(dispatcher.dispatch);
    }
  );
});
