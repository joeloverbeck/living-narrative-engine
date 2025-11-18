import { describe, it, expect } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import GameEngine from '../../../src/engine/gameEngine.js';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
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

class RecordingValidatedDispatcher {
  constructor() {
    this.events = [];
    this.listeners = new Map();
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    const listeners = this.listeners.get(eventId);
    if (listeners) {
      for (const listener of listeners) {
        await listener({ type: eventId, payload });
      }
    }
    return true;
  }

  subscribe(eventId, listener) {
    if (!this.listeners.has(eventId)) {
      this.listeners.set(eventId, new Set());
    }
    this.listeners.get(eventId).add(listener);
    return () => this.unsubscribe(eventId, listener);
  }

  unsubscribe(eventId, listener) {
    const listeners = this.listeners.get(eventId);
    if (!listeners) {
      return false;
    }
    const removed = listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(eventId);
    }
    return removed;
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
    this.startCount = 0;
    this.stopCount = 0;
    this.started = false;
  }

  async start() {
    this.startCount += 1;
    this.started = true;
  }

  async stop() {
    this.stopCount += 1;
    this.started = false;
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

class PassiveAnatomyInitializationService {
  getPendingGenerationCount() {
    return 0;
  }

  async waitForAllGenerationsToComplete() {
    return true;
  }
}

class ConfigurablePersistenceService {
  constructor() {
    this.loadBehavior = {
      mode: 'success',
      payload: {
        success: true,
        data: {
          metadata: { gameTitle: 'Restored Realm' },
          state: {},
        },
      },
    };
    this.loadCalls = [];
  }

  setSuccessfulLoad(data) {
    this.loadBehavior = {
      mode: 'success',
      payload: { success: true, data },
    };
  }

  setFailureResult(errorMessage) {
    this.loadBehavior = {
      mode: 'failure',
      payload: { success: false, error: errorMessage, data: null },
    };
  }

  setThrowingError(error) {
    this.loadBehavior = {
      mode: 'throw',
      payload: error instanceof Error ? error : new Error(String(error)),
    };
  }

  async loadAndRestoreGame(identifier) {
    this.loadCalls.push(identifier);
    const behavior = this.loadBehavior;
    if (behavior.mode === 'throw') {
      throw behavior.payload;
    }
    return behavior.payload;
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
function createLoadAdapterEnvironment() {
  const container = new AppContainer();
  const logger = new RecordingLogger();
  const validatedDispatcher = new RecordingValidatedDispatcher();
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });
  const entityManager = new SimpleEntityManager();
  const turnManager = new SimpleTurnManager();
  const playtimeTracker = new SimplePlaytimeTracker();
  const initializationService = new SimpleInitializationService();
  const anatomyInitializationService = new PassiveAnatomyInitializationService();
  const persistenceService = new ConfigurablePersistenceService();

  container.register(tokens.ILogger, logger);
  container.register(tokens.ISafeEventDispatcher, safeEventDispatcher);
  container.register(tokens.IEntityManager, entityManager);
  container.register(tokens.ITurnManager, turnManager);
  container.register(tokens.PlaytimeTracker, playtimeTracker);
  container.register(tokens.IInitializationService, initializationService);
  container.register(tokens.AnatomyInitializationService, anatomyInitializationService);
  container.register(tokens.GamePersistenceService, persistenceService);

  const engine = new GameEngine({ container, logger });
  const adapter = new GameEngineLoadAdapter(engine);

  return {
    adapter,
    engine,
    persistenceService,
    entityManager,
    turnManager,
    playtimeTracker,
    validatedDispatcher,
  };
}

describe('GameEngineLoadAdapter integration – failure recovery coverage', () => {
  it('loads a saved game and transitions engine state with real orchestrator', async () => {
    const env = createLoadAdapterEnvironment();
    const saveData = {
      metadata: { gameTitle: 'Integration World' },
      state: { actors: ['hero-1'] },
    };
    env.persistenceService.setSuccessfulLoad(saveData);

    const result = await env.adapter.load('slot-success');

    expect(result).toEqual({ success: true, data: saveData });
    expect(env.persistenceService.loadCalls).toEqual(['slot-success']);
    expect(env.entityManager.clearCount).toBe(1);
    expect(env.playtimeTracker.resetCount).toBe(1);
    expect(env.playtimeTracker.sessionStarted).toBe(true);
    expect(env.turnManager.startCount).toBe(1);
    expect(env.turnManager.started).toBe(true);
    expect(env.validatedDispatcher.events.map((event) => event.eventId)).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_READY_UI,
    ]);
    expect(env.engine.getEngineStatus()).toEqual({
      isInitialized: true,
      isLoopRunning: true,
      activeWorld: 'Integration World',
    });
  });

  it('dispatches failure UI and returns standardized result when persistence throws', async () => {
    const env = createLoadAdapterEnvironment();
    env.persistenceService.setThrowingError(new Error('storage offline'));

    const result = await env.adapter.load('slot-crash');

    expect(result).toEqual({ success: false, error: 'storage offline', data: null });
    expect(env.persistenceService.loadCalls).toEqual(['slot-crash']);
    // Entity manager and playtime tracker are cleared/reset twice: once during prepare phase, once during failure recovery
    expect(env.entityManager.clearCount).toBe(2);
    expect(env.playtimeTracker.resetCount).toBe(2);
    expect(env.playtimeTracker.sessionStarted).toBe(false);
    expect(env.turnManager.startCount).toBe(0);
    expect(env.turnManager.started).toBe(false);
    expect(env.validatedDispatcher.events.map((event) => event.eventId)).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_OPERATION_FAILED_UI,
    ]);
    expect(env.engine.getEngineStatus()).toEqual({
      isInitialized: false,
      isLoopRunning: false,
      activeWorld: null,
    });
  });
});
