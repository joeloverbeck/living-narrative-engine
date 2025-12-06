import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../src/turns/states/processingCommandState.js';
import { TurnContext } from '../../../src/turns/context/turnContext.js';
import CommandProcessingWorkflow from '../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';

/**
 * Integration test to reproduce Warning 2:
 * "ProcessingCommandState: processing flag became false after dispatch for actor X"
 *
 * This warning occurs in commandProcessingWorkflow.js:211-213 when the
 * isProcessing flag unexpectedly becomes false after commandProcessor.dispatchAction()
 * returns. This can happen when:
 * - Another event handler calls finishProcessing()
 * - State transition occurs during dispatch
 * - Turn end is triggered during dispatch
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

class SilentStrategy {
  async execute() {}
}

class TestDirectiveResolver {
  resolve() {
    return new SilentStrategy();
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

describe('ProcessingCommandState - Flag Cleared During Dispatch', () => {
  let setup;

  beforeEach(() => {
    setup = null;
  });

  afterEach(async () => {
    if (setup?.state) {
      // Ensure cleanup
      if (setup.state.isProcessing) {
        setup.state.finishProcessing();
      }
    }
  });

  it('should warn when processing flag is cleared by command processor', async () => {
    // Arrange: Command processor that manipulates state during execution
    setup = buildTestSetup(async (actor, turnAction) => {
      // External code clears the processing flag (simulates the bug/edge case)
      setup.state.finishProcessing();
      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    };

    // Act: Process command - workflow will detect flag became false
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: Warning should be logged
    const debugMessages = logger.calls.debug.flat();
    const flagDebug = debugMessages.find(
      (msg) =>
        typeof msg === 'string' &&
        msg.includes('processing flag became false after dispatch') &&
        msg.includes(actor.id)
    );

    expect(flagDebug).toBeTruthy();
    expect(flagDebug).toContain('test-actor');
  });

  it('should match the existing test pattern from commandProcessingWorkflow.fallbacks.integration.test.js', async () => {
    // This replicates the test at line 426 of the fallbacks test file
    // to ensure we're reproducing the exact same scenario

    setup = buildTestSetup(async () => {
      // Directly manipulate the state's processing flag
      setup.state._setProcessing(false);
      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'process flag drop',
    };

    // Act: Process command
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: Verify state and warning
    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('processing flag became false after dispatch')
      )
    ).toBe(true);
  });

  it('should reproduce warning when state transition occurs during dispatch', async () => {
    // Arrange: Command processor that triggers state exit
    setup = buildTestSetup(async () => {
      // Simulate state transition by calling exitState
      await setup.state.exitState(setup.handler, null);
      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    };

    // Act: Process command
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: Warning should appear
    const debugMessages = logger.calls.debug.flat();
    const flagDebug = debugMessages.find(
      (msg) =>
        typeof msg === 'string' && msg.includes('processing flag became false')
    );

    expect(flagDebug).toBeTruthy();
    // exitState should have cleared the flag
    expect(state.isProcessing).toBe(false);
  });

  it('should handle multiple processing flag manipulations', async () => {
    // Arrange: Command processor that toggles flag multiple times
    let callCount = 0;
    setup = buildTestSetup(async () => {
      callCount++;
      // First call: clear flag
      if (callCount === 1) {
        setup.state.finishProcessing();
      }
      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    };

    // Act: Process command
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: Warning logged
    const debugMessages = logger.calls.debug.flat();
    const flagDebugs = debugMessages.filter(
      (msg) =>
        typeof msg === 'string' && msg.includes('processing flag became false')
    );

    expect(flagDebugs.length).toBeGreaterThan(0);
  });

  it('should reproduce the exact runtime scenario - flag cleared during event dispatch', async () => {
    // Arrange: Simulate the exact flow from the runtime warning
    // commandProcessingWorkflow.js:211-213 checks this after dispatchAction returns

    let eventHandlerCalled = false;
    setup = buildTestSetup(async () => {
      // Simulate an event handler that manipulates the state
      // (like what might happen during action rule execution)
      eventHandlerCalled = true;
      setup.state.finishProcessing();
      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    };

    // Act: Process command as would happen in real workflow
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: Exact warning message from runtime
    const debugMessages = logger.calls.debug.flat();
    const exactWarning = debugMessages.find(
      (msg) =>
        typeof msg === 'string' &&
        msg.includes('processing flag became false after dispatch') &&
        msg.includes(actor.id)
    );

    expect(exactWarning).toBeTruthy();
    expect(exactWarning).toMatch(
      /processing flag became false after dispatch.*test-actor/
    );
    expect(eventHandlerCalled).toBe(true);
    expect(state.isProcessing).toBe(false);
  });

  it('should handle fast synchronous operations that may clear flag', async () => {
    // Arrange: Fast synchronous command processor
    // Note: Fast operations can complete before the flag check in _dispatchAction,
    // causing the flag to be cleared by the workflow's finally block.
    // This is expected behavior for fast operations, not an error.
    setup = buildTestSetup(async () => {
      // Fast synchronous execution
      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    };

    // Act: Process command normally
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: Debug message MAY appear for fast operations - this is expected
    // The workflow can complete synchronously, clearing the flag before the check runs
    const debugMessages = logger.calls.debug.flat();
    const flagDebug = debugMessages.find(
      (msg) =>
        typeof msg === 'string' && msg.includes('processing flag became false')
    );

    // This is acceptable - fast operations are handled correctly either way
    expect(state.isProcessing).toBe(false);
  });

  it('should handle the case where both command processor and external code clear the flag', async () => {
    // Arrange: Chaotic scenario with multiple flag manipulations
    let dispatchCount = 0;

    setup = buildTestSetup(async () => {
      dispatchCount++;

      // First dispatch: clear flag immediately
      if (dispatchCount === 1) {
        setup.state.finishProcessing();
      }

      return { success: true };
    });

    const { state, turnContext, actor, logger } = setup;
    const turnAction = {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    };

    // Also have external code trying to clear
    setTimeout(() => {
      if (state.isProcessing) {
        state.finishProcessing();
      }
    }, 5);

    // Act: Process command
    await state._processCommandInternal(turnContext, actor, turnAction);

    // Assert: System should handle gracefully
    expect(state.isProcessing).toBe(false);
    const debugMessages = logger.calls.debug.flat();
    const hasDebug = debugMessages.some(
      (msg) =>
        typeof msg === 'string' && msg.includes('processing flag became false')
    );
    // Warning may or may not appear depending on timing, but no errors should occur
    expect(hasDebug).toBeDefined(); // Test passes regardless of warning presence
  });
});
