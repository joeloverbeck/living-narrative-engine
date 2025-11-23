import { describe, it, expect } from '@jest/globals';
import CommandProcessingWorkflow from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import { ProcessingExceptionHandler } from '../../../../../src/turns/states/helpers/processingExceptionHandler.js';
import TurnDirective from '../../../../../src/turns/constants/turnDirectives.js';
import { TurnContext } from '../../../../../src/turns/context/turnContext.js';
import { ServiceLookupError } from '../../../../../src/turns/states/helpers/getServiceFromContext.js';

class SilentStrategy {
  async execute() {}
}

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
    this._contextOverride = null;
    this._isProcessing = true;
    this.finishCalls = 0;
  }

  getStateName() {
    return 'ProcessingCommandState';
  }

  get isProcessing() {
    return this._isProcessing;
  }

  setProcessing(value) {
    this._isProcessing = value;
  }

  finishProcessing() {
    this._isProcessing = false;
    this.finishCalls += 1;
  }

  _getTurnContext() {
    return this._contextOverride ?? this._context;
  }

  overrideTurnContext(ctx) {
    this._contextOverride = ctx;
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
  constructor(map = {}, options = {}) {
    this.map = map;
    this.options = options;
  }

  resolveStrategy(directive) {
    if (typeof this.options.onResolve === 'function') {
      return this.options.onResolve(directive);
    }
    return this.map[directive] ?? null;
  }
}

/**
 *
 * @param root0
 * @param root0.logger
 * @param root0.dispatcher
 * @param root0.actor
 * @param root0.onEndTurn
 */
function createTurnContextEnvironment({ logger, dispatcher, actor, onEndTurn }) {
  const entityManager = new TestEntityManager(actor);
  const turnEndPort = new TestTurnEndPort();
  const strategy = {
    decideAction: async () => ({
      actionDefinitionId: 'test-action',
      commandString: 'test command',
    }),
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

/**
 *
 * @param root0
 * @param root0.commandProcessorImpl
 * @param root0.interpreterImpl
 * @param root0.strategyMap
 * @param root0.commandDispatcher
 * @param root0.resultInterpreter
 * @param root0.directiveExecutor
 * @param root0.onAfterCreate
 */
function buildWorkflow({
  commandProcessorImpl = async () => ({ success: true }),
  interpreterImpl = async () => TurnDirective.END_TURN_SUCCESS,
  strategyMap = {
    [TurnDirective.END_TURN_SUCCESS]: new SilentStrategy(),
  },
  commandDispatcher = null,
  resultInterpreter = null,
  directiveExecutor = null,
  onAfterCreate,
} = {}) {
  const logger = new TestLogger();
  const dispatcher = new TestSafeEventDispatcher();
  const actor = { id: 'actor-1', type: 'test:actor' };
  const endTurnCalls = [];

  const { turnContext, handler } = createTurnContextEnvironment({
    logger,
    dispatcher,
    actor,
    onEndTurn: (error) => endTurnCalls.push(error ?? null),
  });

  const state = new TestProcessingState(handler, turnContext);
  handler.setCurrentState(state);

  const commandProcessor = new TestCommandProcessor(commandProcessorImpl);
  const interpreter = new TestCommandOutcomeInterpreter(interpreterImpl);
  const resolver = new TestDirectiveResolver(strategyMap);

  const workflow = new CommandProcessingWorkflow({
    state,
    commandProcessor,
    commandOutcomeInterpreter: interpreter,
    directiveStrategyResolver: resolver,
    exceptionHandler: new ProcessingExceptionHandler(state),
    commandDispatcher,
    resultInterpreter,
    directiveExecutor,
  });

  if (directiveExecutor && typeof directiveExecutor.setResolver === 'function') {
    directiveExecutor.setResolver(resolver);
  }

  if (typeof onAfterCreate === 'function') {
    onAfterCreate({
      workflow,
      state,
      turnContext,
      handler,
      logger,
      dispatcher,
      resolver,
      endTurnCalls,
      actor,
      commandProcessor,
      interpreter,
    });
  }

  return {
    workflow,
    state,
    turnContext,
    handler,
    logger,
    dispatcher,
    resolver,
    endTurnCalls,
    actor,
    commandProcessor,
    interpreter,
  };
}

class NullReturningCommandDispatcher {
  constructor() {
    this.calls = [];
  }

  async dispatch(params) {
    this.calls.push(params);
    return null;
  }

  validateContextAfterDispatch() {
    throw new Error('validateContextAfterDispatch should not be called when dispatch returns null');
  }
}

class DirectiveExecutorStub {
  constructor({ onExecute }) {
    this.onExecute = onExecute;
    this.calls = [];
    this._resolver = null;
  }

  setResolver(resolver) {
    this._resolver = resolver;
  }

  async execute({ turnContext, directiveType, commandResult, stateName }) {
    this.calls.push({ turnContext, directiveType, commandResult, stateName });
    if (this.onExecute) {
      return await this.onExecute({
        turnContext,
        directiveType,
        commandResult,
        stateName,
        resolver: this._resolver,
      });
    }
    return { executed: true, stateChanged: false };
  }
}

class ValidatingCommandDispatcher {
  constructor(commandResult) {
    this.commandResult = commandResult;
    this.dispatchCalls = [];
    this.validateCalls = [];
  }

  async dispatch(params) {
    this.dispatchCalls.push(params);
    return {
      commandResult: this.commandResult,
      turnContext: params.turnContext,
    };
  }

  validateContextAfterDispatch({ turnContext, expectedActorId }) {
    this.validateCalls.push({ turnContext, expectedActorId });
    return turnContext.getActor()?.id === expectedActorId;
  }
}

class ResultInterpreterServiceStub {
  constructor(directiveType) {
    this.directiveType = directiveType;
    this.calls = [];
  }

  async interpret({ commandResult, turnContext, actorId, stateName }) {
    this.calls.push({ commandResult, turnContext, actorId, stateName });
    return { directiveType: this.directiveType };
  }
}

describe('CommandProcessingWorkflow fallback coverage integration', () => {
  it('requires core dependencies in the constructor', () => {
    const state = {
      _handler: { getLogger: () => new TestLogger() },
      getStateName: () => 'ProcessingCommandState',
    };
    const resolver = new TestDirectiveResolver();
    const interpreter = new TestCommandOutcomeInterpreter(async () => TurnDirective.END_TURN_SUCCESS);

    expect(
      () =>
        new CommandProcessingWorkflow({
          state,
          commandOutcomeInterpreter: interpreter,
          directiveStrategyResolver: resolver,
        })
    ).toThrow('commandProcessor is required');

    expect(
      () =>
        new CommandProcessingWorkflow({
          state,
          commandProcessor: new TestCommandProcessor(async () => ({ success: true })),
          directiveStrategyResolver: resolver,
        })
    ).toThrow('commandOutcomeInterpreter is required');

    expect(
      () =>
        new CommandProcessingWorkflow({
          state,
          commandProcessor: new TestCommandProcessor(async () => ({ success: true })),
          commandOutcomeInterpreter: interpreter,
        })
    ).toThrow('directiveStrategyResolver is required');
  });

  it('warns and stops when processing flag becomes false during dispatch', async () => {
    const { workflow, state, turnContext, actor, logger } = buildWorkflow({
      commandProcessorImpl: async () => {
        state.setProcessing(false);
        return { success: true };
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'process flag drop',
    });

    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('processing flag became false after dispatch')
      )
    ).toBe(true);
  });

  it('handles invalid context after dispatch without ending the turn', async () => {
    const { workflow, state, turnContext, actor, logger, endTurnCalls } = buildWorkflow({
      commandProcessorImpl: async () => {
        state.overrideTurnContext({
          getLogger: () => turnContext.getLogger(),
          endTurn: turnContext.endTurn.bind(turnContext),
        });
        return { success: true };
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'invalid context',
    });

    expect(endTurnCalls).toHaveLength(0);
    expect(
      logger.calls.warn.some(([message]) =>
        message.includes('Context validation failed after dispatch')
      )
    ).toBe(true);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('shouldEndTurn=false')
      )
    ).toBe(true);
  });

  it('forces finishProcessing when optional command dispatcher returns null', async () => {
    const dispatcher = new NullReturningCommandDispatcher();
    const { workflow, state, turnContext, actor, logger } = buildWorkflow({
      commandDispatcher: dispatcher,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'dispatcher-null',
    });

    expect(dispatcher.calls).toHaveLength(1);
    expect(state.finishCalls).toBeGreaterThan(0);
    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.warn.some(([message]) =>
        message.includes('isProcessing was unexpectedly true at the end')
      )
    ).toBe(true);
  });

  it('reports a service lookup error when the command processor disappears', async () => {
    const { workflow, state, turnContext, actor, endTurnCalls, logger } = buildWorkflow();

    workflow._commandProcessor = null;

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'missing processor',
    });

    expect(state.isProcessing).toBe(false);
    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(ServiceLookupError);
    expect(endTurnCalls[0].message).toContain('ICommandProcessor could not be resolved');
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('Command processor not available')
      )
    ).toBe(true);
  });

  it('throws when the command outcome interpreter is missing at runtime', async () => {
    const { workflow, turnContext, actor, endTurnCalls, logger } = buildWorkflow();

    workflow._commandOutcomeInterpreter = null;

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'missing interpreter',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toContain('Command outcome interpreter not available');
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('Error during result interpretation')
      )
    ).toBe(true);
  });

  it('handles invalid directive types returned by the interpreter', async () => {
    const { workflow, interpreter, turnContext, actor, endTurnCalls, logger } = buildWorkflow();

    interpreter.impl = async () => null;

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'invalid directive',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toContain('Invalid directive type');
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('Error during result interpretation')
      )
    ).toBe(true);
  });

  it('uses optional command dispatcher to deliver command results', async () => {
    const dispatcher = new ValidatingCommandDispatcher({ success: true, via: 'dispatcher' });

    const { workflow, state, turnContext, actor, logger } = buildWorkflow({
      commandDispatcher: dispatcher,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'dispatcher-valid',
    });

    expect(dispatcher.dispatchCalls).toHaveLength(1);
    expect(dispatcher.validateCalls).toHaveLength(1);
    expect(state.finishCalls).toBeGreaterThan(0);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('state remains ProcessingCommandState')
      )
    ).toBe(true);
  });

  it('stops processing when optional dispatcher validation fails', async () => {
    const dispatcher = new ValidatingCommandDispatcher({ success: true });
    dispatcher.validateContextAfterDispatch = () => false;

    const { workflow, state, turnContext, actor } = buildWorkflow({
      commandDispatcher: dispatcher,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'dispatcher-invalid',
    });

    expect(dispatcher.dispatchCalls).toHaveLength(1);
    expect(state.isProcessing).toBe(false);
  });

  it('catches errors thrown during fallback dispatch', async () => {
    const { workflow, state, turnContext, actor, endTurnCalls, logger } = buildWorkflow({
      commandProcessorImpl: async () => {
        throw new Error('dispatch boom');
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'dispatch-error',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toBe('dispatch boom');
    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('Error during action dispatch')
      )
    ).toBe(true);
  });

  it('supports optional result interpreter service', async () => {
    const resultInterpreter = new ResultInterpreterServiceStub(
      TurnDirective.END_TURN_SUCCESS
    );

    const { workflow, turnContext, actor, logger } = buildWorkflow({
      resultInterpreter,
      commandProcessorImpl: async () => ({ success: true, from: 'processor' }),
      interpreterImpl: async () => {
        throw new Error('fallback interpreter should not run');
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'result-interpreter',
    });

    expect(resultInterpreter.calls).toHaveLength(1);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('state remains ProcessingCommandState')
      )
    ).toBe(true);
  });

  it('uses directive executor short-circuit when execution clears processing flag', async () => {
    let capturedState;
    const directiveExecutor = new DirectiveExecutorStub({
      onExecute: async ({ resolver, directiveType }) => {
        const strategy = resolver.resolveStrategy(directiveType);
        await strategy.execute();
        capturedState.setProcessing(false);
        return { executed: true, stateChanged: false };
      },
    });

    const { workflow, state, turnContext, actor, logger } = buildWorkflow({
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new SilentStrategy(),
      },
      directiveExecutor,
      onAfterCreate: ({ state: createdState }) => {
        capturedState = createdState;
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'executor-clears-processing',
    });

    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('Processing flag false after directive strategy')
      )
    ).toBe(true);
  });

  it('marks processing complete when directive executor changes the state', async () => {
    let capturedState;
    let capturedHandler;
    const otherState = {
      getStateName: () => 'OtherState',
    };

    const directiveExecutor = new DirectiveExecutorStub({
      onExecute: async ({ resolver, directiveType }) => {
        const strategy = resolver.resolveStrategy(directiveType);
        capturedHandler.setCurrentState(otherState);
        await strategy.execute();
        return { executed: true, stateChanged: true };
      },
    });

    const { workflow, state, handler, turnContext, actor, logger } = buildWorkflow({
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new SilentStrategy(),
      },
      directiveExecutor,
      onAfterCreate: ({ state: createdState, handler: createdHandler }) => {
        capturedState = createdState;
        capturedHandler = createdHandler;
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'executor-state-change',
    });

    expect(state.finishCalls).toBe(1);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('state changed from ProcessingCommandState to OtherState')
      )
    ).toBe(true);
    expect(capturedState.isProcessing).toBe(false);
  });

  it('throws when directive strategy resolver disappears', async () => {
    const { workflow, turnContext, actor, endTurnCalls, logger } = buildWorkflow();

    workflow._directiveStrategyResolver = null;

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'resolver-missing',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toContain('Directive strategy resolver not available');
    const resolverError = logger.calls.error.find(([message]) =>
      message.includes('Error during directive execution')
    );
    expect(resolverError?.[1]?.error).toContain(
      'Directive strategy resolver not available'
    );
  });

  it('handles missing strategy resolution gracefully', async () => {
    const resolver = new TestDirectiveResolver({}, {
      onResolve: () => null,
    });

    const { workflow, turnContext, actor, endTurnCalls, logger } = buildWorkflow({
      onAfterCreate: ({ workflow: createdWorkflow }) => {
        createdWorkflow._directiveStrategyResolver = resolver;
      },
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'missing-strategy',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toContain('Could not resolve ITurnDirectiveStrategy');
    const resolveError = logger.calls.error.find(([message]) =>
      message.includes('Error during directive execution')
    );
    expect(resolveError?.[1]?.error).toContain(
      'Could not resolve ITurnDirectiveStrategy'
    );
  });

  it('logs when fallback strategy execution toggles processing flag to false', async () => {
    const { workflow, state, resolver, turnContext, actor, logger } = buildWorkflow({
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new SilentStrategy(),
      },
    });

    resolver.map[TurnDirective.END_TURN_SUCCESS] = {
      execute: async (ctx, directive, result) => {
        ctx.getLogger().debug('custom strategy executed', { directive, result });
        state.setProcessing(false);
      },
    };

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'fallback-processing-flag',
    });

    expect(state.isProcessing).toBe(false);
    expect(state.finishCalls).toBe(0);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('Processing flag false after directive strategy')
      )
    ).toBe(true);
  });

  it('finishes processing when fallback strategy changes the state', async () => {
    const otherState = { getStateName: () => 'AlternateState' };

    const { workflow, state, handler, resolver, turnContext, actor, logger } = buildWorkflow({
      strategyMap: {
        [TurnDirective.END_TURN_SUCCESS]: new SilentStrategy(),
      },
    });

    resolver.map[TurnDirective.END_TURN_SUCCESS] = {
      execute: async () => {
        handler.setCurrentState(otherState);
      },
    };

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'fallback-state-change',
    });

    expect(state.finishCalls).toBe(1);
    expect(state.isProcessing).toBe(false);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('state changed from ProcessingCommandState to AlternateState')
      )
    ).toBe(true);
  });

  it('routes strategy execution errors through the exception handler', async () => {
    const { workflow, resolver, turnContext, actor, endTurnCalls, logger } = buildWorkflow();

    resolver.map[TurnDirective.END_TURN_SUCCESS] = {
      async execute() {
        throw new Error('strategy boom');
      },
    };

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'fallback-strategy-error',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toContain('strategy boom');
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('Error during directive execution')
      )
    ).toBe(true);
  });

  it('converts non-error throws into proper Error instances', async () => {
    const thrown = { message: 'non-error failure', stack: 'stack-trace' };

    const directiveExecutor = new DirectiveExecutorStub({
      onExecute: async () => {
        throw thrown;
      },
    });

    const { workflow, turnContext, actor, endTurnCalls, logger } = buildWorkflow({
      directiveExecutor,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'non-error-throw',
    });

    expect(endTurnCalls).toHaveLength(1);
    expect(endTurnCalls[0]).toBeInstanceOf(Error);
    expect(endTurnCalls[0].message).toBe('non-error failure');
    expect(endTurnCalls[0].stack).toBe('stack-trace');
    expect(
      logger.calls.error.some(([message]) =>
        message.includes('Error in command processing workflow')
      )
    ).toBe(true);
  });

  it('completes processing when directive executor leaves state unchanged', async () => {
    const directiveExecutor = new DirectiveExecutorStub({});

    const { workflow, state, turnContext, actor, logger } = buildWorkflow({
      directiveExecutor,
    });

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'executor-state-unchanged',
    });

    expect(state.finishCalls).toBe(1);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('state remains ProcessingCommandState')
      )
    ).toBe(true);
  });

  it('finishes processing when fallback strategy leaves state unchanged', async () => {
    const { workflow, state, turnContext, actor, logger } = buildWorkflow();

    await workflow.processCommand(turnContext, actor, {
      actionDefinitionId: 'test:action',
      commandString: 'fallback-state-unchanged',
    });

    expect(state.finishCalls).toBe(1);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('state remains ProcessingCommandState')
      )
    ).toBe(true);
  });
});
