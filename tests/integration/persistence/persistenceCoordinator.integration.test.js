import { describe, it, expect, beforeEach } from '@jest/globals';
import PersistenceCoordinator from '../../../src/engine/persistenceCoordinator.js';
import EngineState from '../../../src/engine/engineState.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  ENGINE_OPERATION_FAILED_UI,
  GAME_SAVED_ID,
} from '../../../src/constants/eventIds.js';
import { GAME_PERSISTENCE_LOAD_RESULT_UNAVAILABLE } from '../../common/engine/unavailableMessages.js';

class TestLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, context) {
    this.debugLogs.push({ message, context });
  }

  info(message, context) {
    this.infoLogs.push({ message, context });
  }

  warn(message, context) {
    this.warnLogs.push({ message, context });
  }

  error(message, context) {
    this.errorLogs.push({ message, context });
  }
}

class InMemoryValidatedDispatcher {
  constructor() {
    this.events = [];
    this.listeners = new Map();
  }

  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        await Promise.resolve().then(() => listener(payload));
      }
    }
    return true;
  }

  subscribe(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
    return () => this.unsubscribe(eventName, listener);
  }

  unsubscribe(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }
}

class TestPersistenceService {
  constructor({ saveHandler, loadHandler } = {}) {
    this.saveHandler = saveHandler;
    this.loadHandler = loadHandler;
    this.saveCalls = [];
    this.loadCalls = [];
  }

  async saveGame(saveName, includeManual, activeWorld) {
    this.saveCalls.push({ saveName, includeManual, activeWorld });
    if (this.saveHandler) {
      return await this.saveHandler({ saveName, includeManual, activeWorld });
    }
    return { success: true, filePath: `/saves/${saveName}.json` };
  }

  async loadAndRestoreGame(identifier) {
    this.loadCalls.push(identifier);
    if (this.loadHandler) {
      return await this.loadHandler(identifier);
    }
    return {
      success: true,
      data: {
        metadata: { gameTitle: 'Default Loaded World' },
      },
    };
  }
}

class TestSessionManager {
  constructor({
    safeEventDispatcher,
    logger,
    engineState,
    prepareBehavior,
    finalizeBehavior,
  }) {
    this.safeEventDispatcher = safeEventDispatcher;
    this.logger = logger;
    this.engineState = engineState;
    this.prepareBehavior = prepareBehavior;
    this.finalizeBehavior = finalizeBehavior;
    this.prepareCalls = [];
    this.finalizeCalls = [];
  }

  async prepareForLoadGameSession(saveIdentifier) {
    this.prepareCalls.push(saveIdentifier);
    if (this.prepareBehavior) {
      return await this.prepareBehavior(
        saveIdentifier,
        this.safeEventDispatcher
      );
    }
    const shortName = saveIdentifier.split(/[\\/]/).pop() || saveIdentifier;
    await this.safeEventDispatcher.dispatch(ENGINE_OPERATION_IN_PROGRESS_UI, {
      titleMessage: `Loading ${shortName}...`,
      inputDisabledMessage: `Loading game from ${shortName}...`,
    });
    this.logger.debug(
      `TestSessionManager.prepareForLoadGameSession: ${saveIdentifier}`
    );
    return undefined;
  }

  async finalizeLoadSuccess(saveData, saveIdentifier) {
    this.finalizeCalls.push({ saveData, saveIdentifier });
    if (this.finalizeBehavior) {
      return await this.finalizeBehavior(
        saveData,
        saveIdentifier,
        this.safeEventDispatcher,
        this.engineState
      );
    }
    const worldName = saveData?.metadata?.gameTitle || 'loaded-world';
    this.engineState.setStarted(worldName);
    await this.safeEventDispatcher.dispatch(ENGINE_READY_UI, {
      activeWorld: this.engineState.activeWorld,
      message: 'Load complete.',
    });
    this.logger.debug(
      `TestSessionManager.finalizeLoadSuccess: Completed for ${saveIdentifier}`
    );
    return { success: true, data: saveData };
  }
}

class LoadFailureHandler {
  constructor({ safeEventDispatcher, logger, engineState }) {
    this.safeEventDispatcher = safeEventDispatcher;
    this.logger = logger;
    this.engineState = engineState;
    this.calls = [];
  }

  async handle(error, saveIdentifier) {
    const message = error instanceof Error ? error.message : String(error);
    this.calls.push({ error, saveIdentifier, message });
    this.logger.error(
      `LoadFailureHandler: ${message} for ${saveIdentifier}`,
      error
    );
    await this.safeEventDispatcher.dispatch(ENGINE_OPERATION_FAILED_UI, {
      errorMessage: `Failed to load game: ${message}`,
      saveIdentifier,
    });
    // Reset engine state to match production behavior
    this.engineState.reset();
    return { success: false, error: message, data: null };
  }
}

/**
 *
 * @param root0
 * @param root0.saveHandler
 * @param root0.loadHandler
 * @param root0.engineInitialized
 * @param root0.includePersistenceService
 * @param root0.prepareBehavior
 * @param root0.finalizeBehavior
 * @param root0.loadFailureHandler
 */
function createEnvironment({
  saveHandler,
  loadHandler,
  engineInitialized = true,
  includePersistenceService = true,
  prepareBehavior,
  finalizeBehavior,
  loadFailureHandler,
} = {}) {
  const logger = new TestLogger();
  const validatedDispatcher = new InMemoryValidatedDispatcher();
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });
  const engineState = new EngineState();
  if (engineInitialized) {
    engineState.setStarted('initial-world');
  }
  const sessionManager = new TestSessionManager({
    safeEventDispatcher,
    logger,
    engineState,
    prepareBehavior,
    finalizeBehavior,
  });
  const persistenceService = includePersistenceService
    ? new TestPersistenceService({ saveHandler, loadHandler })
    : null;
  const failureHandler =
    loadFailureHandler ??
    new LoadFailureHandler({ safeEventDispatcher, logger, engineState });

  const coordinator = new PersistenceCoordinator({
    logger,
    gamePersistenceService: persistenceService,
    safeEventDispatcher,
    sessionManager,
    engineState,
    handleLoadFailure: failureHandler.handle.bind(failureHandler),
  });

  return {
    coordinator,
    logger,
    engineState,
    validatedDispatcher,
    safeEventDispatcher,
    persistenceService,
    sessionManager,
    failureHandler,
  };
}

let environment;

beforeEach(() => {
  environment = undefined;
});

describe('PersistenceCoordinator integration', () => {
  it('performs a successful manual save and dispatches UI events', async () => {
    environment = createEnvironment({
      saveHandler: async ({ saveName, activeWorld }) => ({
        success: true,
        filePath: `/manual/${activeWorld}/${saveName}.json`,
      }),
    });

    const result = await environment.coordinator.triggerManualSave('Sunrise');

    expect(result).toEqual({
      success: true,
      filePath: '/manual/initial-world/Sunrise.json',
    });
    expect(environment.persistenceService.saveCalls).toEqual([
      {
        saveName: 'Sunrise',
        includeManual: true,
        activeWorld: 'initial-world',
      },
    ]);
    expect(
      environment.validatedDispatcher.events.map((e) => e.eventName)
    ).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      GAME_SAVED_ID,
      ENGINE_READY_UI,
    ]);
    const savedEvent = environment.validatedDispatcher.events[1];
    expect(savedEvent.payload).toMatchObject({
      saveName: 'Sunrise',
      type: 'manual',
    });
  });

  it('propagates manual save failures while still signalling readiness', async () => {
    environment = createEnvironment({
      saveHandler: async () => ({ success: false, error: 'Disk full' }),
    });

    const result = await environment.coordinator.triggerManualSave('Evening');

    expect(result).toEqual({ success: false, error: 'Disk full' });
    expect(
      environment.validatedDispatcher.events.map((e) => e.eventName)
    ).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_OPERATION_FAILED_UI,
      ENGINE_READY_UI,
    ]);
  });

  it('captures unexpected errors thrown during save operations', async () => {
    environment = createEnvironment({
      saveHandler: async () => {
        throw new Error('Save operation failed');
      },
    });

    const result = await environment.coordinator.triggerManualSave('Twilight');

    expect(result).toEqual({
      success: false,
      error: 'Unexpected error during save: Save operation failed',
    });
    expect(
      environment.validatedDispatcher.events.map((e) => e.eventName)
    ).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_OPERATION_FAILED_UI,
      ENGINE_READY_UI,
    ]);
    expect(
      environment.logger.errorLogs.some((entry) =>
        entry.message.includes('Unexpected error during save')
      )
    ).toBe(true);
  });

  it('converts non-Error save exceptions into error messages', async () => {
    environment = createEnvironment({
      saveHandler: async () => {
        throw 'string failure';
      },
    });

    const result = await environment.coordinator.triggerManualSave('Aurora');

    expect(result).toEqual({
      success: false,
      error: 'Unexpected error during save: string failure',
    });
    expect(
      environment.validatedDispatcher.events.map((e) => e.eventName)
    ).toEqual([
      ENGINE_OPERATION_IN_PROGRESS_UI,
      ENGINE_OPERATION_FAILED_UI,
      ENGINE_READY_UI,
    ]);
  });

  it('refuses to save when the engine is not initialized', async () => {
    environment = createEnvironment({ engineInitialized: false });

    const result = await environment.coordinator.triggerManualSave('Offline');

    expect(result).toEqual({
      success: false,
      error: 'Game engine is not initialized. Cannot save game.',
    });
    expect(
      environment.validatedDispatcher.events.map((event) => event.eventName)
    ).toEqual([ENGINE_OPERATION_FAILED_UI, ENGINE_READY_UI]);
  });

  it('reports missing persistence service during manual save attempts', async () => {
    environment = createEnvironment({ includePersistenceService: false });

    const result = await environment.coordinator.triggerManualSave('NoService');

    expect(result).toEqual({
      success: false,
      error: 'GamePersistenceService is not available. Cannot save game.',
    });
    expect(
      environment.validatedDispatcher.events.map((event) => event.eventName)
    ).toEqual([ENGINE_OPERATION_FAILED_UI, ENGINE_READY_UI]);
  });

  it('loads a game successfully and coordinates session finalization', async () => {
    const loadedData = {
      metadata: { gameTitle: 'Recovered World' },
      gameState: { entities: [] },
    };
    environment = createEnvironment({
      loadHandler: async () => ({ success: true, data: loadedData }),
    });

    const result = await environment.coordinator.loadGame('slot-1');

    expect(result).toEqual({ success: true, data: loadedData });
    expect(environment.sessionManager.prepareCalls).toEqual(['slot-1']);
    expect(environment.sessionManager.finalizeCalls).toHaveLength(1);
    expect(environment.engineState.activeWorld).toBe('Recovered World');
    expect(
      environment.validatedDispatcher.events.map((e) => e.eventName)
    ).toEqual([ENGINE_OPERATION_IN_PROGRESS_UI, ENGINE_READY_UI]);
  });

  it('delegates load failures to the provided handler when restore fails', async () => {
    environment = createEnvironment({
      loadHandler: async () => ({
        success: false,
        error: 'not found',
        data: null,
      }),
    });

    const result = await environment.coordinator.loadGame('missing-slot');

    expect(result).toEqual({ success: false, error: 'not found', data: null });
    expect(environment.failureHandler.calls).toEqual([
      expect.objectContaining({
        saveIdentifier: 'missing-slot',
        message: 'not found',
      }),
    ]);
    const dispatchedEvents = environment.validatedDispatcher.events.map(
      (e) => e.eventName
    );
    expect(dispatchedEvents).toContain(ENGINE_OPERATION_FAILED_UI);
  });

  it('handles exceptions thrown during session preparation', async () => {
    environment = createEnvironment({
      prepareBehavior: async () => {
        throw new Error('preparation failed');
      },
    });

    const result = await environment.coordinator.loadGame('unstable-slot');

    expect(result).toEqual({
      success: false,
      error: 'preparation failed',
      data: null,
    });
    expect(environment.failureHandler.calls).toHaveLength(1);
    const failureCall = environment.failureHandler.calls[0];
    expect(failureCall.error).toBeInstanceOf(Error);
    expect(failureCall.message).toBe('preparation failed');
  });

  it('wraps non-Error exceptions from load operations before delegation', async () => {
    environment = createEnvironment({
      loadHandler: async () => {
        throw 'load crashed';
      },
    });

    const result = await environment.coordinator.loadGame(
      'string-exception-slot'
    );

    expect(result).toEqual({
      success: false,
      error: 'load crashed',
      data: null,
    });
    expect(environment.failureHandler.calls).toHaveLength(1);
    const failureCall = environment.failureHandler.calls[0];
    expect(failureCall.error).toBeInstanceOf(Error);
    expect(failureCall.message).toBe('load crashed');
  });

  it('reports missing persistence service during load attempts and resets engine state', async () => {
    environment = createEnvironment({ includePersistenceService: false });
    environment.engineState.setStarted('Preload World');

    const result = await environment.coordinator.loadGame('offline-slot');

    expect(result).toEqual({
      success: false,
      error: GAME_PERSISTENCE_LOAD_RESULT_UNAVAILABLE,
      data: null,
    });
    expect(environment.engineState.isInitialized).toBe(false);
  });
});
