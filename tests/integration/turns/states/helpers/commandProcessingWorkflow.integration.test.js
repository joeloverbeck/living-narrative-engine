import { describe, it, expect, beforeEach } from '@jest/globals';
import CommandProcessingWorkflow from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';
import EndTurnSuccessStrategy from '../../../../../src/turns/strategies/endTurnSuccessStrategy.js';
import EndTurnFailureStrategy from '../../../../../src/turns/strategies/endTurnFailureStrategy.js';
import TurnDirective from '../../../../../src/turns/constants/turnDirectives.js';
import { TurnContext } from '../../../../../src/turns/context/turnContext.js';

class TestLogger {
  constructor() {
    this.debug = this.#record('debug');
    this.info = this.#record('info');
    this.warn = this.#record('warn');
    this.error = this.#record('error');
    this.calls = { debug: [], info: [], warn: [], error: [] };
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
  constructor(logger, dispatcher) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetCalls = [];
    this.transitionCalls = [];
    this._currentState = null;
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

  async resetStateAndResources(reason) {
    this.resetCalls.push(reason);
  }

  async requestIdleStateTransition() {
    this.transitionCalls.push('requested');
  }
}

class TestProcessingState {
  constructor(handler, context) {
    this._handler = handler;
    this._context = context;
    this._isProcessing = true;
    this.finishCalls = 0;
  }

  getStateName() {
    return 'ProcessingCommandState';
  }

  get isProcessing() {
    return this._isProcessing;
  }

  finishProcessing() {
    this._isProcessing = false;
    this.finishCalls += 1;
  }

  _getTurnContext() {
    return this._context;
  }
}

class TestCommandProcessor {
  constructor(impl) {
    this.impl = impl;
    this.calls = [];
  }

  async dispatchAction(actor, turnAction) {
    this.calls.push({ actor, turnAction });
    return await this.impl(actor, turnAction);
  }
}

class TestCommandOutcomeInterpreter {
  constructor(impl) {
    this.impl = impl;
    this.calls = [];
  }

  async interpret(commandResult, turnContext) {
    this.calls.push({ commandResult, turnContext });
    return await this.impl(commandResult, turnContext);
  }
}

class TestDirectiveResolver {
  constructor(map) {
    this.map = map;
  }

  resolveStrategy(directive) {
    return this.map[directive] ?? null;
  }
}

class OptionalCommandDispatcher {
  constructor({ commandResult, validate = true }) {
    this.commandResult = commandResult;
    this.validateResult = validate;
    this.calls = [];
  }

  async dispatch({ turnContext, actor, turnAction, stateName }) {
    this.calls.push({ turnContext, actor, turnAction, stateName });
    if (this.commandResult instanceof Error) {
      throw this.commandResult;
    }
    return {
      commandResult: this.commandResult,
      turnContext,
    };
  }

  validateContextAfterDispatch({ turnContext, expectedActorId }) {
    return this.validateResult && turnContext.getActor().id === expectedActorId;
  }
}

class OptionalResultInterpreter {
  constructor({ directiveType, error }) {
    this.directiveType = directiveType;
    this.error = error;
    this.calls = [];
  }

  async interpret({ commandResult, turnContext, actorId, stateName }) {
    this.calls.push({ commandResult, turnContext, actorId, stateName });
    if (this.error) {
      throw this.error;
    }
    return { directiveType: this.directiveType };
  }
}

class OptionalDirectiveExecutor {
  constructor({ resolver, executed = true, error } = {}) {
    this.resolver = resolver;
    this.executed = executed;
    this.error = error;
    this.calls = [];
  }

  async execute({ turnContext, directiveType, commandResult, stateName }) {
    this.calls.push({ turnContext, directiveType, commandResult, stateName });
    if (this.error) {
      throw this.error;
    }

    const strategy = this.resolver.resolveStrategy(directiveType);
    if (strategy) {
      await strategy.execute(turnContext, directiveType, commandResult);
    }

    return { executed: this.executed, stateChanged: false };
  }
}

const createActor = () => ({ id: 'actor-1', type: 'test:actor' });

function createTurnContextEnvironment({
  logger,
  dispatcher,
  onEndTurn,
  actor,
}) {
  const entityManager = new TestEntityManager(actor);
  const turnEndPort = new TestTurnEndPort();
  const strategy = {
    decideAction: async () => ({ actionDefinitionId: 'test', commandString: 'test' }),
  };

  const handler = new TestHandler(logger, dispatcher);

  const turnContext = new TurnContext({
    actor,
    logger,
    services: {
      entityManager,
      safeEventDispatcher: dispatcher,
      turnEndPort,
    },
    strategy,
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
  });

  return { turnContext, handler, turnEndPort };
}

describe('CommandProcessingWorkflow integration', () => {
  let logger;
  let dispatcher;
  let actor;
  let endTurnCalls;

  beforeEach(() => {
    logger = new TestLogger();
    dispatcher = new TestSafeEventDispatcher();
    actor = createActor();
    endTurnCalls = [];
  });

  function buildWorkflow({
    commandProcessorImpl,
    interpreterImpl,
    strategyMap,
    commandDispatcher,
    resultInterpreter,
    directiveExecutor,
    mutateHandler,
  }) {
    const { turnContext, handler } = createTurnContextEnvironment({
      logger,
      dispatcher,
      onEndTurn: (error) => endTurnCalls.push(error ?? null),
      actor,
    });

    const state = new TestProcessingState(handler, turnContext);
    handler.setCurrentState(state);

    if (mutateHandler) {
      mutateHandler(handler, state);
    }

    const resolver = new TestDirectiveResolver(strategyMap);

    const workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor: new TestCommandProcessor(commandProcessorImpl),
      commandOutcomeInterpreter: new TestCommandOutcomeInterpreter(
        interpreterImpl
      ),
      directiveStrategyResolver: resolver,
      exceptionHandler: new ProcessingExceptionHandler(state),
      commandDispatcher,
      resultInterpreter,
      directiveExecutor,
    });

    if (directiveExecutor instanceof OptionalDirectiveExecutor) {
      directiveExecutor.resolver = resolver;
    }

    return { workflow, turnContext, state, handler };
  }

  it('processes a successful command through the fallback pipeline', async () => {
    const successResult = { success: true, data: 'ok' };
    const { workflow, turnContext, state } = buildWorkflow({
      commandProcessorImpl: async () => successResult,
      interpreterImpl: async () => TurnDirective.END_TURN_SUCCESS,
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'test command',
    });

    expect(endTurnCalls).toEqual([null]);
    expect(state.isProcessing).toBe(false);
    expect(state.finishCalls).toBeGreaterThan(0);
  });

  it('routes failure directive to the EndTurnFailureStrategy', async () => {
    const failureError = new Error('directive failure');
    const { workflow, turnContext, state } = buildWorkflow({
      commandProcessorImpl: async () => ({ success: false, error: failureError }),
      interpreterImpl: async () => TurnDirective.END_TURN_FAILURE,
      strategyMap: {
        [TurnDirective.END_TURN_FAILURE]: new EndTurnFailureStrategy(),
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'fail command',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBe(failureError);
    expect(state.isProcessing).toBe(false);
  });

  it('handles command processor exceptions and dispatches system errors', async () => {
    const dispatchFailure = new Error('dispatch failure');
    const { workflow, turnContext, state } = buildWorkflow({
      commandProcessorImpl: async () => {
        throw dispatchFailure;
      },
      interpreterImpl: async () => TurnDirective.END_TURN_SUCCESS,
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'boom command',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBe(dispatchFailure);
    expect(dispatcher.dispatched).toHaveLength(1);
    expect(state.isProcessing).toBe(false);
  });

  it('uses optional services when provided', async () => {
    const commandResult = { success: true, data: 'service' };
    const commandDispatcher = new OptionalCommandDispatcher({
      commandResult,
    });
    const resultInterpreter = new OptionalResultInterpreter({
      directiveType: TurnDirective.END_TURN_SUCCESS,
    });
    const directiveExecutor = new OptionalDirectiveExecutor();

    const { workflow, turnContext, state } = buildWorkflow({
      commandProcessorImpl: async () => {
        throw new Error('should not use fallback processor');
      },
      interpreterImpl: async () => {
        throw new Error('should not use fallback interpreter');
      },
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      },
      commandDispatcher,
      resultInterpreter,
      directiveExecutor,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'service command',
    });

    expect(commandDispatcher.calls).toHaveLength(1);
    expect(resultInterpreter.calls).toHaveLength(1);
    expect(directiveExecutor.calls).toHaveLength(1);
    expect(endTurnCalls).toEqual([null]);
    expect(state.isProcessing).toBe(false);
  });

  it('aborts when optional dispatcher detects invalid context', async () => {
    const commandDispatcher = new OptionalCommandDispatcher({
      commandResult: { success: true },
      validate: false,
    });

    const { workflow, turnContext, state } = buildWorkflow({
      commandProcessorImpl: async () => ({ success: true }),
      interpreterImpl: async () => TurnDirective.END_TURN_SUCCESS,
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      },
      commandDispatcher,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'invalid context',
    });

    expect(endTurnCalls).toHaveLength(0);
    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.warn.some(([message]) =>
        message.includes('ProcessingCommandState')
      )
    ).toBe(true);
  });

  it('handles directive execution errors through the exception handler', async () => {
    const directiveExecutor = new OptionalDirectiveExecutor({
      error: new Error('directive failure'),
    });

    const { workflow, turnContext } = buildWorkflow({
      commandProcessorImpl: async () => ({ success: true }),
      interpreterImpl: async () => TurnDirective.END_TURN_SUCCESS,
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      },
      directiveExecutor,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'directive failure',
    });

    expect(endTurnCalls).toHaveLength(1);
  });

  it('forces processing to finish when dispatch returns null', async () => {
    const { workflow, turnContext, state } = buildWorkflow({
      commandProcessorImpl: async () => null,
      interpreterImpl: async () => TurnDirective.END_TURN_SUCCESS,
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'no result',
    });

    expect(state.isProcessing).toBe(false);
    expect(state.finishCalls).toBeGreaterThan(0);
  });

  it('resets the handler when endTurn throws during exception handling', async () => {
    const failingTurnContext = createTurnContextEnvironment({
      logger,
      dispatcher,
      onEndTurn: () => {
        throw new Error('endTurn failure');
      },
      actor,
    });

    const state = new TestProcessingState(
      failingTurnContext.handler,
      failingTurnContext.turnContext
    );
    failingTurnContext.handler.setCurrentState(state);

    const workflow = new CommandProcessingWorkflow({
      state,
      commandProcessor: new TestCommandProcessor(async () => {
        throw new Error('dispatch failure');
      }),
      commandOutcomeInterpreter: new TestCommandOutcomeInterpreter(async () =>
        TurnDirective.END_TURN_SUCCESS
      ),
      directiveStrategyResolver: new TestDirectiveResolver({
        [TurnDirective.END_TURN_SUCCESS]: new EndTurnSuccessStrategy(),
      }),
      exceptionHandler: new ProcessingExceptionHandler(state),
    });

    await workflow.processCommand(
      failingTurnContext.turnContext,
      actor,
      {
        actionDefinitionId: 'test:action',
        commandString: 'failing end turn',
      }
    );

    expect(failingTurnContext.handler.resetCalls).toHaveLength(1);
    expect(failingTurnContext.handler.transitionCalls).toHaveLength(1);
  });
});
