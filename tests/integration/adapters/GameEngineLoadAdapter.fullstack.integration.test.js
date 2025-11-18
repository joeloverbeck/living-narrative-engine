import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import GameEngine from '../../../src/engine/gameEngine.js';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_FAILED_UI,
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
    this.loadCalls = [];
    this.nextLoadResult = {
      success: true,
      data: {
        metadata: { gameTitle: 'Default World' },
        state: { actors: [] },
      },
    };
  }

  setLoadResult(result) {
    this.nextLoadResult = result;
  }

  async loadAndRestoreGame(identifier) {
    this.loadCalls.push(identifier);
    const result = this.nextLoadResult;
    if (result instanceof Error) {
      throw result;
    }
    return result;
  }

  isSavingAllowed() {
    return true;
  }

  async saveGame(saveName) {
    return { success: true, filePath: `/saves/${saveName}.json` };
  }
}

/**
 *
 */
function createAdapterEnvironment() {
  const container = new AppContainer();
  const logger = new RecordingLogger();
  const entityManager = new SimpleEntityManager();
  const turnManager = new SimpleTurnManager();
  const playtimeTracker = new SimplePlaytimeTracker();
  const safeEventDispatcher = new RecordingSafeEventDispatcher();
  const initializationService = new SimpleInitializationService();
  const persistenceService = new ConfigurableGamePersistenceService();

  container.register(tokens.ILogger, logger);
  container.register(tokens.IEntityManager, entityManager);
  container.register(tokens.ITurnManager, turnManager);
  container.register(tokens.PlaytimeTracker, playtimeTracker);
  container.register(tokens.ISafeEventDispatcher, safeEventDispatcher);
  container.register(tokens.IInitializationService, initializationService);
  container.register(tokens.GamePersistenceService, persistenceService);

  const engine = new GameEngine({ container, logger });
  const adapter = new GameEngineLoadAdapter(engine);

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

describe('GameEngineLoadAdapter real integration', () => {
  /** @type {ReturnType<typeof createAdapterEnvironment>} */
  let env;

  beforeEach(() => {
    env = createAdapterEnvironment();
  });

  it('loads a saved game through the full engine pipeline', async () => {
    const saveData = {
      metadata: { gameTitle: 'Reclaimed Realm' },
      state: { actors: ['hero-1'] },
    };
    env.persistenceService.setLoadResult({ success: true, data: saveData });

    const result = await env.adapter.load('slot-alpha');

    expect(result).toEqual({ success: true, data: saveData });
    expect(env.persistenceService.loadCalls).toEqual(['slot-alpha']);
    expect(env.entityManager.clearCount).toBe(1);
    expect(env.playtimeTracker.resetCount).toBe(1);
    expect(env.playtimeTracker.sessionStarted).toBe(true);
    expect(env.turnManager.started).toBe(true);

    const dispatchedIds = env.safeEventDispatcher.events.map((entry) => entry.eventId);
    expect(dispatchedIds).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_READY_UI,
    ]);

    const status = env.engine.getEngineStatus();
    expect(status).toEqual({
      isInitialized: true,
      isLoopRunning: true,
      activeWorld: 'Reclaimed Realm',
    });
  });

  it('returns standardized failure results when the persistence layer reports an error', async () => {
    env.persistenceService.setLoadResult({
      success: false,
      error: 'checksum mismatch',
      data: null,
    });

    const result = await env.adapter.load('slot-corrupt');

    expect(result).toEqual({ success: false, error: 'checksum mismatch', data: null });
    expect(env.turnManager.started).toBe(false);

    const dispatchedIds = env.safeEventDispatcher.events.map((entry) => entry.eventId);
    expect(dispatchedIds).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_OPERATION_FAILED_UI,
    ]);

    const status = env.engine.getEngineStatus();
    expect(status.isInitialized).toBe(false);
    expect(status.isLoopRunning).toBe(false);
    expect(status.activeWorld).toBeNull();
  });

  it('propagates validation failures from the engine when identifiers are invalid', async () => {
    await expect(env.adapter.load('')).rejects.toThrow(
      "GameEngine.loadGame: Invalid saveIdentifier ''"
    );
    expect(env.persistenceService.loadCalls).toEqual([]);
    expect(env.safeEventDispatcher.events).toEqual([]);
  });
});
