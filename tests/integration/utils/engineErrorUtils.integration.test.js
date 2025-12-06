import { describe, it, expect } from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import EngineState from '../../../src/engine/engineState.js';
import { ENGINE_OPERATION_FAILED_UI } from '../../../src/constants/eventIds.js';
import {
  dispatchFailureAndReset,
  processOperationFailure,
} from '../../../src/utils/engineErrorUtils.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, metadata) {
    this.debugLogs.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoLogs.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnLogs.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorLogs.push({ message, metadata });
  }
}

class EventBusDispatcher {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.dispatchCalls = [];
  }

  async dispatch(eventId, payload) {
    this.dispatchCalls.push({ eventId, payload });
    await this.eventBus.dispatch(eventId, payload);
    return true;
  }
}

/**
 *
 * @param root0
 * @param root0.includeDispatcher
 */
function createIntegrationEnvironment({ includeDispatcher = true } = {}) {
  const logger = new RecordingLogger();
  const eventBus = new EventBus({ logger });
  const recordedEvents = [];
  const callSequence = [];

  eventBus.subscribe(ENGINE_OPERATION_FAILED_UI, async (event) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    recordedEvents.push(event);
    callSequence.push('event');
  });

  const dispatcher = includeDispatcher
    ? new EventBusDispatcher(eventBus)
    : null;

  const engineState = new EngineState();
  engineState.setStarted('integration-world');

  let resetCount = 0;
  const resetEngineState = () => {
    resetCount += 1;
    engineState.reset();
    callSequence.push('reset');
  };

  return {
    logger,
    dispatcher,
    recordedEvents,
    engineState,
    resetEngineState,
    getResetCount: () => resetCount,
    callSequence,
  };
}

describe('engineErrorUtils integration', () => {
  it('dispatches failure UI events and resets engine state using the real EventBus', async () => {
    const env = createIntegrationEnvironment();

    await dispatchFailureAndReset(
      env.dispatcher,
      'Operation failed while loading test save.',
      'Load Failure',
      env.resetEngineState,
      env.logger
    );

    expect(env.recordedEvents).toHaveLength(1);
    const [event] = env.recordedEvents;
    expect(event.type).toBe(ENGINE_OPERATION_FAILED_UI);
    expect(event.payload).toEqual({
      errorMessage: 'Operation failed while loading test save.',
      errorTitle: 'Load Failure',
    });

    expect(env.callSequence).toEqual(['event', 'reset']);
    expect(env.getResetCount()).toBe(1);
    expect(env.engineState.isInitialized).toBe(false);
    expect(env.engineState.isGameLoopRunning).toBe(false);
    expect(env.engineState.activeWorld).toBeNull();

    expect(env.dispatcher.dispatchCalls).toHaveLength(1);
    expect(env.logger.debugLogs.map((entry) => entry.message)).toContain(
      'engineErrorUtils.dispatchFailureAndReset: Dispatching UI event for operation failed.'
    );
  });

  it('logs when the dispatcher is missing but still resets the engine state', async () => {
    const env = createIntegrationEnvironment({ includeDispatcher: false });

    await dispatchFailureAndReset(
      null,
      'Critical failure during initialization.',
      'Initialization Failure',
      env.resetEngineState,
      env.logger
    );

    expect(env.recordedEvents).toHaveLength(0);
    expect(env.callSequence).toEqual(['reset']);
    expect(env.getResetCount()).toBe(1);

    expect(env.logger.errorLogs.map((entry) => entry.message)).toContain(
      'engineErrorUtils.dispatchFailureAndReset: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
    );
  });

  it('normalizes arbitrary errors and returns standardized failure results when requested', async () => {
    const env = createIntegrationEnvironment();

    const result = await processOperationFailure(
      env.logger,
      env.dispatcher,
      'loadGame',
      'database offline',
      'Load Error',
      'Unable to load game',
      env.resetEngineState,
      true
    );

    expect(result).toEqual({
      success: false,
      error: 'database offline',
      data: null,
    });

    expect(env.recordedEvents).toHaveLength(1);
    const [event] = env.recordedEvents;
    expect(event.payload).toEqual({
      errorMessage: 'Unable to load game: database offline',
      errorTitle: 'Load Error',
    });

    expect(env.logger.errorLogs).toHaveLength(1);
    expect(env.logger.errorLogs[0].message).toBe(
      'GameEngine.loadGame: database offline'
    );
    expect(env.logger.errorLogs[0].metadata).toBeInstanceOf(Error);
    expect(env.logger.errorLogs[0].metadata.message).toBe('database offline');

    expect(env.callSequence).toEqual(['event', 'reset']);
    expect(env.getResetCount()).toBe(1);
  });

  it('avoids duplicating failure prefixes when error message already includes the prefix', async () => {
    const env = createIntegrationEnvironment();
    const prefixedMessage = 'Failed to load game: Save slot corrupt';

    const result = await processOperationFailure(
      env.logger,
      env.dispatcher,
      'loadGame',
      prefixedMessage,
      'Load Error',
      'Failed to load game',
      env.resetEngineState,
      true
    );

    expect(result).toEqual({
      success: false,
      error: prefixedMessage,
      data: null,
    });

    expect(env.recordedEvents).toHaveLength(1);
    const [event] = env.recordedEvents;
    expect(event.payload).toEqual({
      errorMessage: prefixedMessage,
      errorTitle: 'Load Error',
    });

    expect(env.logger.errorLogs[0].message).toBe(
      `GameEngine.loadGame: ${prefixedMessage}`
    );
    expect(env.callSequence).toEqual(['event', 'reset']);
  });

  it('propagates engine Error objects without wrapping and resolves with undefined by default', async () => {
    const env = createIntegrationEnvironment();
    const underlyingError = new Error('validation failed');

    const outcome = await processOperationFailure(
      env.logger,
      env.dispatcher,
      'triggerManualSave',
      underlyingError,
      'Save Error',
      'Unable to save',
      env.resetEngineState
    );

    expect(outcome).toBeUndefined();
    expect(env.logger.errorLogs[0].metadata).toBe(underlyingError);
    expect(env.recordedEvents[0].payload).toEqual({
      errorMessage: 'Unable to save: validation failed',
      errorTitle: 'Save Error',
    });
    expect(env.callSequence).toEqual(['event', 'reset']);
    expect(env.getResetCount()).toBe(1);
  });
});
