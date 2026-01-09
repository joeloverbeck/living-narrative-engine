import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../../src/initializers/services/initHelpers.js', () => ({
  setupPersistenceListeners: jest.fn(),
}));

import { setupPersistenceListeners } from '../../../../src/initializers/services/initHelpers.js';
import InitializationService from '../../../../src/initializers/services/initializationService.js';
import LlmAdapterInitializer from '../../../../src/initializers/services/llmAdapterInitializer.js';
import {
  ACTION_DECIDED_ID,
  MOOD_STATE_UPDATED_ID,
  TURN_STARTED_ID,
} from '../../../../src/constants/eventIds.js';

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
let moodSexualListener;
let expressionPersistenceListener;
let contentDependencyValidator;
let llmAdapterInitializer;
let anatomyFormattingService;

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
  moodSexualListener = { handleEvent: jest.fn() };
  expressionPersistenceListener = { handleEvent: jest.fn() };
  contentDependencyValidator = {
    validate: jest.fn().mockResolvedValue(undefined),
  };
  llmAdapterInitializer = new LlmAdapterInitializer();
  anatomyFormattingService = { initialize: jest.fn() };
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
        moodSexualListener,
        expressionPersistenceListener,
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
        anatomyFormattingService,
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
      // ACTION_DECIDED_ID listeners
      { eventId: ACTION_DECIDED_ID, handler: expect.any(Function) },
      { eventId: ACTION_DECIDED_ID, handler: expect.any(Function) },
      { eventId: ACTION_DECIDED_ID, handler: expect.any(Function) },
      { eventId: ACTION_DECIDED_ID, handler: expect.any(Function) },
      // MOOD_STATE_UPDATED_ID listeners (for two-phase emotional state)
      { eventId: MOOD_STATE_UPDATED_ID, handler: expect.any(Function) },
      { eventId: MOOD_STATE_UPDATED_ID, handler: expect.any(Function) },
      // TURN_STARTED_ID listeners (for two-phase emotional state)
      { eventId: TURN_STARTED_ID, handler: expect.any(Function) },
      { eventId: TURN_STARTED_ID, handler: expect.any(Function) },
    ]);

    // Execute ACTION_DECIDED_ID handlers (first 4)
    listenersArg[0].handler();
    listenersArg[1].handler();
    listenersArg[2].handler();
    listenersArg[3].handler();

    const callOrder = {
      thought: thoughtListener.handleEvent.mock.invocationCallOrder[0],
      notes: notesListener.handleEvent.mock.invocationCallOrder[0],
      mood: moodSexualListener.handleEvent.mock.invocationCallOrder[0],
      expression:
        expressionPersistenceListener.handleEvent.mock.invocationCallOrder[0],
    };

    expect(callOrder.thought).toBeLessThan(callOrder.notes);
    expect(callOrder.notes).toBeLessThan(callOrder.mood);
    expect(callOrder.mood).toBeLessThan(callOrder.expression);
  });
});
