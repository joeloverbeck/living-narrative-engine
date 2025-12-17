import { describe, it, expect, beforeEach } from '@jest/globals';
import GameSessionManager from '../../../src/engine/gameSessionManager.js';
import EngineState from '../../../src/engine/engineState.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import PlaytimeTracker from '../../../src/engine/playtimeTracker.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';

/**
 * @description Simple in-memory logger for capturing log output during tests.
 */
class TestLogger {
  constructor() {
    /** @type {Record<'debug' | 'info' | 'warn' | 'error', Array<{ message: string, details?: unknown }>>} */
    this.entries = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  /**
   * @description Records a debug message.
   * @param {string} message - Message to store.
   * @param {unknown} [details] - Optional structured details.
   * @returns {void}
   */
  debug(message, details) {
    this.entries.debug.push({ message, details });
  }

  /**
   * @description Records an info message.
   * @param {string} message - Message to store.
   * @param {unknown} [details] - Optional structured details.
   * @returns {void}
   */
  info(message, details) {
    this.entries.info.push({ message, details });
  }

  /**
   * @description Records a warning message.
   * @param {string} message - Message to store.
   * @param {unknown} [details] - Optional structured details.
   * @returns {void}
   */
  warn(message, details) {
    this.entries.warn.push({ message, details });
  }

  /**
   * @description Records an error message.
   * @param {string} message - Message to store.
   * @param {unknown} [details] - Optional structured details.
   * @returns {void}
   */
  error(message, details) {
    this.entries.error.push({ message, details });
  }

  /**
   * @description Retrieves the stored messages for a log level.
   * @param {'debug' | 'info' | 'warn' | 'error'} level - Log level to retrieve.
   * @returns {Array<{ message: string, details?: unknown }>}
   */
  get(level) {
    return this.entries[level];
  }
}

/**
 * @description Records event dispatches and delivers them to subscribers.
 */
class RecordingValidatedDispatcher {
  constructor() {
    /** @type {Array<{ eventName: string, payload: unknown }>} */
    this.events = [];
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();
  }

  /**
   * @description Dispatches an event to all subscribers while recording it.
   * @param {string} eventName - Event identifier.
   * @param {unknown} payload - Event payload.
   * @returns {Promise<boolean>}
   */
  async dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const listeners = this.subscribers.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        await listener({ type: eventName, payload });
      }
    }
    return true;
  }

  /**
   * @description Subscribes to an event.
   * @param {string} eventName - Event identifier.
   * @param {(event: { type: string, payload: unknown }) => void | Promise<void>} handler - Handler to register.
   * @returns {void}
   */
  subscribe(eventName, handler) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    this.subscribers.get(eventName).add(handler);
  }

  /**
   * @description Removes a registered event handler.
   * @param {string} eventName - Event identifier.
   * @param {(event: { type: string, payload: unknown }) => void | Promise<void>} handler - Handler to remove.
   * @returns {void}
   */
  unsubscribe(eventName, handler) {
    const listeners = this.subscribers.get(eventName);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this.subscribers.delete(eventName);
      }
    }
  }
}

/**
 * @description Extension of PlaytimeTracker that records session starts.
 */
class InstrumentedPlaytimeTracker extends PlaytimeTracker {
  constructor(deps) {
    super(deps);
    /** @type {number} */
    this.startSessionCalls = 0;
  }

  /**
   * @description Starts a play session while tracking invocation count.
   * @returns {void}
   */
  startSession() {
    this.startSessionCalls += 1;
    super.startSession();
  }
}

/**
 * @description Lightweight turn manager implementation used for integration testing.
 */
class TestTurnManager {
  constructor() {
    /** @type {number} */
    this.startCalls = 0;
    /** @type {number} */
    this.stopCalls = 0;
    /** @type {boolean} */
    this.running = false;
  }

  /**
   * @description Starts the manager.
   * @returns {Promise<void>}
   */
  async start() {
    this.startCalls += 1;
    this.running = true;
  }

  /**
   * @description Stops the manager.
   * @returns {Promise<void>}
   */
  async stop() {
    this.stopCalls += 1;
    this.running = false;
  }
}

/**
 * @description Minimal anatomy initialization service supporting pending/await behavior.
 */
class TestAnatomyInitializationService {
  /**
   * @param {{ pendingCount?: number, shouldReject?: boolean }} [options]
   */
  constructor(options = {}) {
    const { pendingCount = 0, shouldReject = false } = options;
    /** @type {number} */
    this.pendingCount = pendingCount;
    /** @type {boolean} */
    this.shouldReject = shouldReject;
    /** @type {Array<number>} */
    this.waitCalls = [];
  }

  /**
   * @description Updates the pending generation count.
   * @param {number} value - Pending generation total.
   * @returns {void}
   */
  setPendingGenerationCount(value) {
    this.pendingCount = value;
  }

  /**
   * @description Retrieves the number of pending generations.
   * @returns {number}
   */
  getPendingGenerationCount() {
    return this.pendingCount;
  }

  /**
   * @description Waits for all generation tasks to complete.
   * @param {number} timeoutMs - Timeout in milliseconds.
   * @returns {Promise<void>}
   */
  async waitForAllGenerationsToComplete(timeoutMs) {
    this.waitCalls.push(timeoutMs);
    if (this.shouldReject) {
      throw new Error('Timed out while waiting for anatomy generation.');
    }
  }
}

/**
 * @description Creates a GameSessionManager with mostly real collaborators for integration coverage.
 * @param {{
 *   engineState?: EngineState,
 *   pendingCount?: number,
 *   anatomyReject?: boolean,
 *   includeAnatomyService?: boolean,
 *   includeTurnManager?: boolean,
 *   includePlaytimeTracker?: boolean
 * }} [options]
 * @returns {{
 *   manager: GameSessionManager,
 *   logger: TestLogger,
 *   safeDispatcher: SafeEventDispatcher,
 *   recordingDispatcher: RecordingValidatedDispatcher,
 *   playtimeTracker: InstrumentedPlaytimeTracker | null,
 *   turnManager: TestTurnManager | null,
 *   anatomyService: TestAnatomyInitializationService | null,
 *   engineState: EngineState,
 *   stopCalls: number,
 *   resetCalls: number,
 *   startEngineCalls: string[]
 * }}
 */
function createManagerEnvironment(options = {}) {
  const {
    engineState = new EngineState(),
    pendingCount = 0,
    anatomyReject = false,
    includeAnatomyService = true,
    includeTurnManager = true,
    includePlaytimeTracker = true,
  } = options;

  const logger = new TestLogger();
  const recordingDispatcher = new RecordingValidatedDispatcher();
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: recordingDispatcher,
    logger,
  });

  const playtimeTracker = includePlaytimeTracker
    ? new InstrumentedPlaytimeTracker({
        logger,
        safeEventDispatcher: safeDispatcher,
      })
    : null;

  const turnManager = includeTurnManager ? new TestTurnManager() : null;
  const anatomyService = includeAnatomyService
    ? new TestAnatomyInitializationService({
        pendingCount,
        shouldReject: anatomyReject,
      })
    : null;

  let stopCalls = 0;
  const stopFn = async () => {
    stopCalls += 1;
    if (turnManager && turnManager.running) {
      await turnManager.stop();
    }
  };

  let resetCalls = 0;
  const resetCoreGameStateFn = () => {
    resetCalls += 1;
    engineState.reset();
  };

  const startEngineCalls = [];
  const startEngineFn = (worldName) => {
    startEngineCalls.push(worldName);
    engineState.setStarted(worldName);
  };

  const manager = new GameSessionManager({
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher: safeDispatcher,
    engineState,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
    anatomyInitializationService: anatomyService,
  });

  return {
    manager,
    logger,
    safeDispatcher,
    recordingDispatcher,
    playtimeTracker,
    turnManager,
    anatomyService,
    engineState,
    get stopCalls() {
      return stopCalls;
    },
    get resetCalls() {
      return resetCalls;
    },
    startEngineCalls,
  };
}

describe('GameSessionManager integration (real collaborators)', () => {
  describe('prepareForNewGameSession', () => {
    it('stops the existing session and resets state when already initialized', async () => {
      const engineState = new EngineState();
      engineState.setStarted('ExistingWorld');
      const env = createManagerEnvironment({ engineState });

      await env.manager.prepareForNewGameSession('NewWorld');

      expect(env.stopCalls).toBe(1);
      expect(env.resetCalls).toBe(1);
      expect(env.engineState.activeWorld).toBe('NewWorld');
      expect(
        env.logger
          .get('warn')
          .some((entry) => entry.message.includes('Engine already initialized'))
      ).toBe(true);
      expect(env.recordingDispatcher.events).toHaveLength(0);
    });
  });

  describe('finalizeNewGameSuccess', () => {
    /** @type {ReturnType<typeof createManagerEnvironment>} */
    let env;

    beforeEach(() => {
      env = createManagerEnvironment({ pendingCount: 2 });
    });

    it('waits for pending anatomy generation before starting turns', async () => {
      await env.manager.prepareForNewGameSession('WorldA');
      await env.manager.finalizeNewGameSuccess('WorldA');

      expect(env.startEngineCalls).toEqual(['WorldA']);
      expect(env.playtimeTracker.startSessionCalls).toBe(1);
      expect(env.anatomyService.waitCalls).toEqual([15000]);
      expect(env.turnManager.startCalls).toBe(1);
      expect(env.engineState.activeWorld).toBe('WorldA');
      expect(env.recordingDispatcher.events.at(-1)).toEqual({
        eventName: ENGINE_READY_UI,
        payload: { activeWorld: 'WorldA', message: 'Enter command...' },
      });
      expect(
        env.logger
          .get('info')
          .some((entry) =>
            entry.message.includes('Waiting for 2 anatomy generations')
          )
      ).toBe(true);
      expect(
        env.logger
          .get('info')
          .some((entry) =>
            entry.message.includes('Anatomy generation completed')
          )
      ).toBe(true);
    });

    it('logs a warning when anatomy completion times out but still starts turns', async () => {
      const timeoutEnv = createManagerEnvironment({
        pendingCount: 1,
        anatomyReject: true,
      });

      await timeoutEnv.manager.finalizeNewGameSuccess('WorldTimeout');

      expect(timeoutEnv.turnManager.startCalls).toBe(1);
      expect(
        timeoutEnv.logger
          .get('warn')
          .some((entry) =>
            entry.message.includes(
              'Anatomy generation did not complete in time'
            )
          )
      ).toBe(true);
    });

    it('warns when playtime tracker is not available', async () => {
      const noPlaytimeEnv = createManagerEnvironment({
        pendingCount: 0,
        includePlaytimeTracker: false,
      });

      await noPlaytimeEnv.manager.finalizeNewGameSuccess('WorldNoPlaytime');

      expect(
        noPlaytimeEnv.logger
          .get('warn')
          .some((entry) =>
            entry.message.includes('PlaytimeTracker not available')
          )
      ).toBe(true);
      expect(noPlaytimeEnv.turnManager.startCalls).toBe(1);
    });

    it('warns when anatomy service is missing but still completes startup', async () => {
      const noAnatomyEnv = createManagerEnvironment({
        includeAnatomyService: false,
      });

      await noAnatomyEnv.manager.finalizeNewGameSuccess('WorldNoAnatomy');

      expect(
        noAnatomyEnv.logger
          .get('warn')
          .some((entry) =>
            entry.message.includes('AnatomyInitializationService not available')
          )
      ).toBe(true);
      expect(noAnatomyEnv.turnManager.startCalls).toBe(1);
    });

    it('throws a critical error when the turn manager is not available', async () => {
      const noTurnsEnv = createManagerEnvironment({
        includeTurnManager: false,
      });

      await expect(
        noTurnsEnv.manager.finalizeNewGameSuccess('WorldNoTurns')
      ).rejects.toThrow(
        'GameSessionManager critical error: TurnManager service is unavailable during game finalization.'
      );
      expect(
        noTurnsEnv.logger
          .get('error')
          .some((entry) => entry.message.includes('TurnManager not available'))
      ).toBe(true);
    });
  });
});
