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
});

describe('InitializationService invalid world name handling', () => {
  it.each([[null], [undefined], ['']])(
    'returns failure for %p',
    async (bad) => {
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
      });

      const result = await service.runInitializationSequence(bad);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TypeError);
      expect(modsLoader.loadMods).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    }
  );
});
