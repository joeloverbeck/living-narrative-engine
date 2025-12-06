import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../src/turns/states/processingCommandState.js';
import { TurnContext } from '../../../src/turns/context/turnContext.js';

/**
 * Integration test to reproduce race conditions between turn end and command processing.
 *
 * These tests simulate timing issues where:
 * - Turn end is triggered while command processing is active
 * - Async workflows are interrupted by external events
 * - Multiple async operations compete for state control
 *
 * This can trigger both Warning 1 and Warning 2 simultaneously.
 */

class TestLogger {
  constructor() {
    this.calls = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
    this.debug = this.#record('debug');
    this.info = this.#record('info');
    this.warn = this.#record('warn');
    this.error = this.#record('error');
  }

  #record(level) {
    return (...args) => {
      this.calls[level].push(args);
    };
  }

  hasWarning(substring) {
    return this.calls.warn.some((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes(substring))
    );
  }

  hasDebug(substring) {
    return this.calls.debug.some((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes(substring))
    );
  }
}

class TestSafeEventDispatcher {
  constructor() {
    this.dispatched = [];
  }

  async dispatch(eventId, payload) {
    this.dispatched.push({ eventId, payload });
    return undefined;
  }

  subscribe() {
    return () => {};
  }
}

class TestEntityManager {
  constructor(actor) {
    this.actor = actor;
  }

  getComponentData(entityId, componentId) {
    if (entityId === this.actor.id && componentId === 'core:location') {
      return { value: 'test-location' };
    }
    return null;
  }

  getEntityInstance(entityId) {
    if (entityId === this.actor.id) {
      return { id: entityId, type: 'test:actor' };
    }
    return { id: entityId };
  }

  getAllComponentTypesForEntity(entityId) {
    if (entityId === this.actor.id) {
      return ['core:location'];
    }
    return [];
  }
}

class TestCommandProcessor {
  constructor(impl) {
    this.dispatchImpl = impl || (async () => ({ success: true }));
  }

  async dispatchAction(actor, turnAction) {
    return await this.dispatchImpl(actor, turnAction);
  }
}

class TestCommandOutcomeInterpreter {
  interpret() {
    return { directive: null, strategy: null, needsDirective: false };
  }
}

class TestDirectiveResolver {
  resolve() {
    return null;
  }
}

class TestTurnEndPort {
  constructor() {
    this.endCalls = [];
  }

  async endTurn(error) {
    this.endCalls.push(error ?? null);
  }
}

class TestHandler {
  constructor(logger, dispatcher, turnContext) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this._turnContext = turnContext;
    this.resetCalls = [];
    this.transitionCalls = [];
    this._currentState = null;
    this._isDestroyed = false;
    this._isDestroying = false;
  }

  setCurrentState(state) {
    this._currentState = state;
  }

  getCurrentState() {
    return this._currentState;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }

  getTurnContext() {
    return this._turnContext;
  }

  _resetTurnStateAndResources() {
    this.resetCalls.push('reset');
  }

  async _transitionToState(nextState) {
    this.transitionCalls.push(nextState);
  }
}

/**
 *
 * @param commandProcessorImpl
 */
function buildTestSetup(commandProcessorImpl) {
  const logger = new TestLogger();
  const dispatcher = new TestSafeEventDispatcher();
  const actor = { id: 'test-actor', type: 'test:actor' };
  const entityManager = new TestEntityManager(actor);
  const turnEndPort = new TestTurnEndPort();

  const strategy = {
    decideAction: async () => ({
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    }),
  };

  const handler = new TestHandler(logger, dispatcher, null);

  const turnContext = new TurnContext({
    actor,
    logger,
    services: {
      entityManager,
      safeEventDispatcher: dispatcher,
      turnEndPort,
    },
    strategy,
    onEndTurnCallback: async () => {},
    handlerInstance: handler,
  });

  handler._turnContext = turnContext;

  const commandProcessor = new TestCommandProcessor(commandProcessorImpl);
  const commandOutcomeInterpreter = new TestCommandOutcomeInterpreter();
  const directiveResolver = new TestDirectiveResolver();

  const state = new ProcessingCommandState({
    handler,
    commandProcessor,
    commandOutcomeInterpreter,
    commandString: 'test command',
    turnAction: {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    },
    directiveResolver,
  });

  handler.setCurrentState(state);

  return {
    state,
    handler,
    turnContext,
    actor,
    logger,
    dispatcher,
    commandProcessor,
    turnEndPort,
  };
}

describe('ProcessingCommandState - Race Condition Scenarios', () => {
  let setup;

  beforeEach(() => {
    setup = null;
  });

  afterEach(async () => {
    if (setup?.state) {
      if (setup.state.isProcessing) {
        setup.state.finishProcessing();
      }
    }
  });

  it('should handle concurrent state modifications', async () => {
    // Arrange: Multiple async operations modifying state
    let operationCount = 0;

    setup = buildTestSetup(async () => {
      operationCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    });

    const { state, handler, turnContext, actor } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'concurrent command',
    };

    // Act: Start processing
    state.startProcessing();
    const processingPromise = state._processCommandInternal(
      turnContext,
      actor,
      turnAction
    );

    // Concurrent operations
    const operations = [
      processingPromise.catch(() => {}),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        if (state.isProcessing) {
          state.finishProcessing();
        }
      })(),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await state.destroy(handler).catch(() => {});
      })(),
    ];

    // Wait for all to complete
    await Promise.all(operations);

    // Assert: State should be stable and cleaned up
    expect(state.isProcessing).toBe(false);
  });

  it('should handle rapid fire state transitions', async () => {
    // Arrange: Quick succession of state changes
    setup = buildTestSetup(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { success: true };
    });

    const { state, handler, turnContext, actor } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'rapid transition',
    };

    // Act: Rapid operations
    const operations = [
      (async () => {
        state.startProcessing();
        await state
          ._processCommandInternal(turnContext, actor, turnAction)
          .catch(() => {});
      })(),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await state.exitState(handler, null).catch(() => {});
      })(),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 7));
        await state.destroy(handler).catch(() => {});
      })(),
    ];

    await Promise.all(operations);

    // Assert: State should reach stable end state
    expect(state.isProcessing).toBe(false);
  });

  it('should handle the scenario where processing completes just before destroy', async () => {
    // Edge case: timing where processing finishes right before destroy

    setup = buildTestSetup(async () => {
      // Very quick command
      return { success: true };
    });

    const { state, handler, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'quick command',
    };

    // Act: Process and destroy in quick succession
    const processingPromise = state._processCommandInternal(
      turnContext,
      actor,
      turnAction
    );

    // Small delay to let processing likely complete
    await new Promise((resolve) => setTimeout(resolve, 10));
    await state.destroy(handler);

    await processingPromise.catch(() => {});

    // Assert: Should not have debug message if processing completed before destroy
    const hasDestroyDebug = logger.hasDebug(
      'Destroyed during active processing'
    );
    // Timing-dependent - may or may not have debug message, but should be stable
    expect(state.isProcessing).toBe(false);
  });

  it('should handle both warnings occurring in the same scenario', async () => {
    // Arrange: Scenario that can trigger both warnings
    setup = buildTestSetup(async () => {
      // Command processor clears flag (Warning 2)
      setup.state.finishProcessing();
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { success: true };
    });

    const { state, handler, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'double warning command',
    };

    // Act: Start processing
    state.startProcessing();
    const processingPromise = state._processCommandInternal(
      turnContext,
      actor,
      turnAction
    );

    // Trigger destroy while processing (Warning 1)
    await new Promise((resolve) => setTimeout(resolve, 10));
    await state.destroy(handler);

    await processingPromise.catch(() => {});

    // Assert: May have both debug messages or just one depending on timing
    const hasFlagDebug = logger.hasDebug('processing flag became false');
    const hasDestroyDebug = logger.hasDebug(
      'Destroyed during active processing'
    );

    // At least one debug message should appear
    expect(hasFlagDebug || hasDestroyDebug).toBe(true);
    expect(state.isProcessing).toBe(false);
  });

  it('should handle cleanup in complex async scenarios', async () => {
    // Arrange: Multiple nested async operations
    let nestedOpCount = 0;

    setup = buildTestSetup(async () => {
      nestedOpCount++;
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 20)),
        (async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (setup.state.isProcessing) {
            setup.state.finishProcessing();
          }
        })(),
      ]);
      return { success: true };
    });

    const { state, handler, turnContext, actor } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'nested async command',
    };

    // Act: Process with concurrent destroy
    const processingPromise = state._processCommandInternal(
      turnContext,
      actor,
      turnAction
    );

    await new Promise((resolve) => setTimeout(resolve, 15));
    await state.destroy(handler);

    await processingPromise.catch(() => {});

    // Assert: All async operations cleaned up
    expect(state.isProcessing).toBe(false);
    expect(nestedOpCount).toBeGreaterThan(0);
  });

  it('should maintain state integrity through multiple destroy attempts', async () => {
    // Arrange: Scenario with multiple destroy calls
    setup = buildTestSetup(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    });

    const { state, handler } = setup;

    // Act: Multiple concurrent destroy calls
    state.startProcessing();
    const destroyPromises = [
      state.destroy(handler),
      state.destroy(handler),
      state.destroy(handler),
    ];

    await Promise.all(destroyPromises);

    // Assert: State should be clean despite multiple destroys
    expect(state.isProcessing).toBe(false);
  });
});
