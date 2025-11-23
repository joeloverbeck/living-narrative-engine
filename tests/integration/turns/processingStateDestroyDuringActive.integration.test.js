import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../src/turns/states/processingCommandState.js';
import { TurnContext } from '../../../src/turns/context/turnContext.js';
import { ProcessingExceptionHandler } from '../../../src/turns/states/helpers/processingExceptionHandler.js';
import CommandProcessingWorkflow from '../../../src/turns/states/helpers/commandProcessingWorkflow.js';

/**
 * Integration test to reproduce Warning 1:
 * "ProcessingCommandState: Destroyed during active processing for actor X"
 *
 * This warning occurs when the state's destroy() method is called while
 * the isProcessing flag is still true, indicating abnormal termination
 * (e.g., turn end during async command processing).
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

  // Create handler first (but without turnContext yet)
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

  // Now set the turnContext on the handler
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

describe('ProcessingCommandState - Destroy During Active Processing', () => {
  let setup;

  beforeEach(() => {
    setup = null;
  });

  afterEach(async () => {
    if (setup?.state) {
      // Ensure cleanup even if test fails
      if (setup.state.isProcessing) {
        setup.state.finishProcessing();
      }
    }
  });

  it('should warn when destroyed while processing flag is true', async () => {
    // Arrange: Create state with slow async command processor
    setup = buildTestSetup(async () => {
      // Simulate a command that takes time to process
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true };
    });

    const { state, handler, logger, actor } = setup;

    // Act: Manually set processing flag (simulating state during workflow)
    state.startProcessing();
    expect(state.isProcessing).toBe(true);

    // Destroy while processing is true (abnormal termination)
    await state.destroy(handler);

    // Assert: Verify the debug message was logged (changed from warn to debug)
    const debugMessages = logger.calls.debug.flat();
    const destroyDebug = debugMessages.find((msg) =>
      typeof msg === 'string' &&
      msg.includes('Destroyed during active processing') &&
      msg.includes(actor.id)
    );

    expect(destroyDebug).toBeTruthy();
    expect(destroyDebug).toContain('ProcessingCommandState');
    expect(destroyDebug).toContain(actor.id);

    // Processing flag should be cleared after destroy
    expect(state.isProcessing).toBe(false);
  });

  it('should not warn when destroyed with processing flag false', async () => {
    // Arrange: Create state in normal condition
    setup = buildTestSetup();
    const { state, handler, logger } = setup;

    // Ensure processing is false
    expect(state.isProcessing).toBe(false);

    // Act: Destroy in normal state
    await state.destroy(handler);

    // Assert: No debug message should be logged (changed from warn to debug)
    const debugMessages = logger.calls.debug.flat();
    const destroyDebug = debugMessages.find((msg) =>
      typeof msg === 'string' && msg.includes('Destroyed during active processing')
    );

    expect(destroyDebug).toBeUndefined();
  });

  it('should handle rapid destroy calls gracefully', async () => {
    // Arrange: Create state and start processing
    setup = buildTestSetup();
    const { state, handler } = setup;

    state.startProcessing();
    expect(state.isProcessing).toBe(true);

    // Act: Call destroy multiple times rapidly
    const destroyPromises = [
      state.destroy(handler),
      state.destroy(handler),
      state.destroy(handler),
    ];

    await Promise.all(destroyPromises);

    // Assert: Processing should be cleared, no errors
    expect(state.isProcessing).toBe(false);
  });

  it('should reproduce the exact runtime scenario - turn end during command processing', async () => {
    // Arrange: Simulate the exact flow from the runtime warning
    setup = buildTestSetup(async () => {
      // Command takes time to execute
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true };
    });

    const { state, handler, turnContext, actor, logger } = setup;

    // Start command processing (like actionDecisionWorkflow.run)
    state.startProcessing();
    expect(state.isProcessing).toBe(true);

    // Simulate turn end event being fired during processing
    // (like turnManager._handleTurnEnd)
    // This would call baseTurnHandler.destroy()
    // Which calls currentState.destroy()

    // Act: Destroy as would happen during turn end
    await state.destroy(handler);

    // Assert: Exact debug message from runtime should appear (changed from warn to debug)
    const debugMessages = logger.calls.debug.flat();
    const exactDebug = debugMessages.find(
      (msg) =>
        typeof msg === 'string' &&
        msg.includes('ProcessingCommandState') &&
        msg.includes('Destroyed during active processing') &&
        msg.includes(actor.id)
    );

    expect(exactDebug).toBeTruthy();
    expect(exactDebug).toMatch(/ProcessingCommandState.*Destroyed during active processing.*test-actor/);

    // Processing should be cleared
    expect(state.isProcessing).toBe(false);
  });
});
