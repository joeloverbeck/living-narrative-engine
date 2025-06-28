import InitializationService from '../../../../src/initializers/services/initializationService.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const WORLD = 'helperWorld';

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
});

const createService = (overrides = {}) =>
  new InitializationService({
    log: { logger },
    events: { validatedEventDispatcher: dispatcher, safeEventDispatcher },
    llm: { llmAdapter, llmConfigLoader, ...(overrides.llm || {}) },
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
    ...(overrides || {}),
  });

describe('InitializationService LLM adapter helper logic', () => {
  it('returns failure when llmAdapter is missing', async () => {
    const svc = createService({ llm: { llmConfigLoader } });
    const result = await svc.runInitializationSequence(WORLD);

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'InitializationService: No ILLMAdapter provided. Skipping initialization.'
    );
  });

  it('returns failure when llmAdapter lacks init', async () => {
    llmAdapter = { isInitialized: jest.fn(), isOperational: jest.fn() };
    const svc = createService({ llm: { llmAdapter, llmConfigLoader } });

    const result = await svc.runInitializationSequence(WORLD);

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'InitializationService: ILLMAdapter missing required init() method.'
    );
  });

  it('skips initialization when adapter already initialized and operational', async () => {
    llmAdapter = {
      init: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      isOperational: jest.fn().mockReturnValue(true),
    };
    const svc = createService({ llm: { llmAdapter, llmConfigLoader } });

    const result = await svc.runInitializationSequence(WORLD);

    expect(result.success).toBe(true);
    expect(llmAdapter.init).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'InitializationService: ConfigurableLLMAdapter already initialized. Skipping.'
    );
  });

  it('fails when adapter already initialized but not operational', async () => {
    llmAdapter = {
      init: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      isOperational: jest.fn().mockReturnValue(false),
    };
    const svc = createService({ llm: { llmAdapter, llmConfigLoader } });

    const result = await svc.runInitializationSequence(WORLD);

    expect(result.success).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'InitializationService: ConfigurableLLMAdapter already initialized but not operational.'
    );
  });

  it('returns failure when LlmConfigLoader is invalid', async () => {
    llmConfigLoader = {};
    const svc = createService({ llm: { llmAdapter, llmConfigLoader } });

    const result = await svc.runInitializationSequence(WORLD);

    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'InitializationService: LlmConfigLoader missing or invalid. Cannot initialize adapter.'
    );
  });
});
