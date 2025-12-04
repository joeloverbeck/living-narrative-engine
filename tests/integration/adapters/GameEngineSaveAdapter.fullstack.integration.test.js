import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import GameEngine from '../../../src/engine/gameEngine.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  GAME_SAVED_ID,
} from '../../../src/constants/eventIds.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class SimpleEntityManager {
  constructor() {
    this.clearCount = 0;
  }

  clearAll() {
    this.clearCount += 1;
  }
}

class SimpleTurnManager {
  constructor() {
    this.started = false;
    this.stopped = false;
  }

  async start() {
    this.started = true;
  }

  async stop() {
    this.stopped = true;
  }
}

class SimplePlaytimeTracker {
  constructor() {
    this.resetCount = 0;
    this.sessionStarted = false;
    this.sessionEnded = false;
  }

  reset() {
    this.resetCount += 1;
  }

  startSession() {
    this.sessionStarted = true;
  }

  endSessionAndAccumulate() {
    this.sessionEnded = true;
  }
}

class SimpleInitializationService {
  async runInitializationSequence() {
    return { success: true };
  }
}

class RecordingSafeEventDispatcher {
  constructor() {
    this.events = [];
    this.batchModes = [];
  }

  async dispatch(eventId, payload, options) {
    this.events.push({ eventId, payload, options });
    return true;
  }

  setBatchMode(enabled, options = {}) {
    this.batchModes.push({ enabled, options });
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class ConfigurableGamePersistenceService {
  constructor() {
    this.saveCalls = [];
    this.nextSaveResult = { success: true, filePath: '/saves/default.json' };
    this.throwable = null;
  }

  setSaveResult(result) {
    this.nextSaveResult = result;
    this.throwable = null;
  }

  setSaveError(error) {
    this.throwable = error instanceof Error ? error : new Error(String(error));
  }

  async saveGame(saveName, includeState, activeWorld) {
    this.saveCalls.push({ saveName, includeState, activeWorld });
    if (this.throwable) {
      throw this.throwable;
    }
    return this.nextSaveResult;
  }

  async loadAndRestoreGame() {
    throw new Error('Not implemented in tests');
  }

  isSavingAllowed() {
    return true;
  }
}

/**
 *
 */
function createSaveAdapterEnvironment() {
  const container = new AppContainer();
  const logger = new RecordingLogger();
  const entityManager = new SimpleEntityManager();
  const turnManager = new SimpleTurnManager();
  const playtimeTracker = new SimplePlaytimeTracker();
  const safeEventDispatcher = new RecordingSafeEventDispatcher();
  const initializationService = new SimpleInitializationService();
  const persistenceService = new ConfigurableGamePersistenceService();
  const turnActionChoicePipeline = { buildChoices: jest.fn() };
  const aiPromptPipeline = { generatePrompt: jest.fn() };
  const llmAdapter = { getCurrentActiveLlmId: jest.fn() };
  const entityDisplayDataProvider = { getEntityName: jest.fn() };

  const ensureRegistered = (token, value) => {
    if (typeof container.isRegistered === 'function' && container.isRegistered(token)) {
      return;
    }
    container.register(token, value);
  };

  ensureRegistered(tokens.ILogger, logger);
  ensureRegistered(tokens.IEntityManager, entityManager);
  ensureRegistered(tokens.ITurnManager, turnManager);
  ensureRegistered(tokens.PlaytimeTracker, playtimeTracker);
  ensureRegistered(tokens.ISafeEventDispatcher, safeEventDispatcher);
  ensureRegistered(tokens.IInitializationService, initializationService);
  ensureRegistered(tokens.GamePersistenceService, persistenceService);
  ensureRegistered(tokens.TurnActionChoicePipeline, turnActionChoicePipeline);
  ensureRegistered(tokens.IAIPromptPipeline, aiPromptPipeline);
  ensureRegistered(tokens.LLMAdapter, llmAdapter);
  ensureRegistered(tokens.EntityDisplayDataProvider, entityDisplayDataProvider);

  const engine = new GameEngine({ container, logger });
  const adapter = new GameEngineSaveAdapter(engine);

  return {
    adapter,
    engine,
    logger,
    entityManager,
    turnManager,
    playtimeTracker,
    safeEventDispatcher,
    persistenceService,
  };
}

/**
 *
 * @param env
 * @param worldName
 */
async function bootstrapInitializedEngine(env, worldName = 'Sanctuary') {
  await env.engine.startNewGame(worldName);
  env.safeEventDispatcher.events = [];
  env.persistenceService.saveCalls = [];
}

describe('GameEngineSaveAdapter real integration', () => {
  /** @type {ReturnType<typeof createSaveAdapterEnvironment>} */
  let env;

  beforeEach(() => {
    env = createSaveAdapterEnvironment();
  });

  it('saves a running game and dispatches UI feedback', async () => {
    await bootstrapInitializedEngine(env, 'Sanctuary Prime');
    env.persistenceService.setSaveResult({
      success: true,
      filePath: '/saves/sanctuary-prime.json',
    });

    const result = await env.adapter.save('slot-alpha', 'Sanctuary Chronicle');

    expect(result).toEqual({
      success: true,
      filePath: '/saves/sanctuary-prime.json',
    });
    expect(env.persistenceService.saveCalls).toEqual([
      {
        saveName: 'Sanctuary Chronicle',
        includeState: true,
        activeWorld: 'Sanctuary Prime',
      },
    ]);
    expect(env.safeEventDispatcher.events).toEqual([
      {
        eventId: ENGINE_OPERATION_IN_PROGRESS_UI,
        payload: {
          titleMessage: 'Saving...',
          inputDisabledMessage: 'Saving game "Sanctuary Chronicle"...',
        },
        options: undefined,
      },
      {
        eventId: GAME_SAVED_ID,
        payload: {
          saveName: 'Sanctuary Chronicle',
          path: '/saves/sanctuary-prime.json',
          type: 'manual',
        },
        options: undefined,
      },
      {
        eventId: ENGINE_READY_UI,
        payload: {
          activeWorld: 'Sanctuary Prime',
          message: 'Save operation finished. Ready.',
        },
        options: undefined,
      },
    ]);
    expect(env.turnManager.started).toBe(true);
    expect(env.playtimeTracker.sessionStarted).toBe(true);
    expect(env.logger.errorEntries).toEqual([]);
  });

  it('returns a failure result when the engine is not initialized', async () => {
    const result = await env.adapter.save('slot-beta', 'Dormant Save');

    expect(result).toEqual({
      success: false,
      error: 'Game engine is not initialized. Cannot save game.',
    });
    expect(env.persistenceService.saveCalls).toEqual([]);
    expect(env.safeEventDispatcher.events).toEqual([
      {
        eventId: 'core:ui_operation_failed',
        payload: {
          errorMessage:
            'Failed to save game: Game engine is not initialized. Cannot save game.',
          errorTitle: 'Save Failed',
        },
        options: undefined,
      },
      {
        eventId: ENGINE_READY_UI,
        payload: {
          activeWorld: null,
          message: 'Save operation finished. Ready.',
        },
        options: undefined,
      },
    ]);
  });

  it('propagates manual save failures from the persistence layer', async () => {
    await bootstrapInitializedEngine(env, 'Twilight Haven');
    env.persistenceService.setSaveResult({
      success: false,
      error: 'disk full',
    });

    const result = await env.adapter.save('slot-gamma', 'Twilight Chronicle');

    expect(result).toEqual({ success: false, error: 'disk full' });
    expect(env.persistenceService.saveCalls).toEqual([
      {
        saveName: 'Twilight Chronicle',
        includeState: true,
        activeWorld: 'Twilight Haven',
      },
    ]);
    expect(env.safeEventDispatcher.events).toEqual([
      {
        eventId: ENGINE_OPERATION_IN_PROGRESS_UI,
        payload: {
          titleMessage: 'Saving...',
          inputDisabledMessage: 'Saving game "Twilight Chronicle"...',
        },
        options: undefined,
      },
      {
        eventId: 'core:ui_operation_failed',
        payload: {
          errorMessage: 'Failed to save game: disk full',
          errorTitle: 'Save Failed',
        },
        options: undefined,
      },
      {
        eventId: ENGINE_READY_UI,
        payload: {
          activeWorld: 'Twilight Haven',
          message: 'Save operation finished. Ready.',
        },
        options: undefined,
      },
    ]);
    expect(env.logger.errorEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('normalizes unexpected save errors into failure results', async () => {
    await bootstrapInitializedEngine(env, 'Aurora Station');
    env.persistenceService.setSaveError(new Error('Disk I/O failure'));

    const result = await env.adapter.save('slot-delta', 'Aurora Archive');

    expect(result).toEqual({
      success: false,
      error: 'Unexpected error during save: Disk I/O failure',
    });
    expect(env.persistenceService.saveCalls).toEqual([
      {
        saveName: 'Aurora Archive',
        includeState: true,
        activeWorld: 'Aurora Station',
      },
    ]);
    expect(env.safeEventDispatcher.events).toEqual([
      {
        eventId: ENGINE_OPERATION_IN_PROGRESS_UI,
        payload: {
          titleMessage: 'Saving...',
          inputDisabledMessage: 'Saving game "Aurora Archive"...',
        },
        options: undefined,
      },
      {
        eventId: 'core:ui_operation_failed',
        payload: {
          errorMessage: 'Failed to save game: Unexpected error during save: Disk I/O failure',
          errorTitle: 'Save Failed',
        },
        options: undefined,
      },
      {
        eventId: ENGINE_READY_UI,
        payload: {
          activeWorld: 'Aurora Station',
          message: 'Save operation finished. Ready.',
        },
        options: undefined,
      },
    ]);
    expect(env.logger.errorEntries.length).toBeGreaterThanOrEqual(1);
  });
});
