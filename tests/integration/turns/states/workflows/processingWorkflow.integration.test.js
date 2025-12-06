import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { ProcessingWorkflow } from '../../../../../src/turns/states/workflows/processingWorkflow.js';
import { ProcessingCommandState } from '../../../../../src/turns/states/processingCommandState.js';
import { TurnContext } from '../../../../../src/turns/context/turnContext.js';
import { ENTITY_SPOKE_ID } from '../../../../../src/constants/eventIds.js';

class RecordingLogger {
  constructor(label) {
    this.label = label;
    this.calls = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.calls.debug.push(args);
  }

  info(...args) {
    this.calls.info.push(args);
  }

  warn(...args) {
    this.calls.warn.push(args);
  }

  error(...args) {
    this.calls.error.push(args);
  }

  createChildLogger() {
    return this;
  }
}

class RecordingDispatcher {
  constructor() {
    this.calls = [];
  }

  async dispatch(eventName, payload) {
    this.calls.push({ eventName, payload });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class TestTurnHandler {
  constructor(logger, dispatcher) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this._turnContext = null;
    this.resetReasons = [];
    this.idleRequests = [];
    this._isDestroyed = false;
  }

  setTurnContext(ctx) {
    this._turnContext = ctx;
  }

  getTurnContext() {
    return this._turnContext;
  }

  getLogger() {
    return this._logger;
  }

  async resetStateAndResources(reason) {
    this.resetReasons.push(reason);
  }

  async requestIdleStateTransition() {
    this.idleRequests.push('idle');
  }

  async requestAwaitingInputStateTransition() {}

  async requestAwaitingExternalTurnEndStateTransition() {}

  async requestProcessingCommandStateTransition() {}

  getSafeEventDispatcher() {
    return this._dispatcher;
  }
}

/**
 *
 * @param root0
 * @param root0.commandString
 * @param root0.initialAction
 * @param root0.contextAction
 * @param root0.decisionMeta
 * @param root0.processThrows
 * @param root0.processHook
 * @param root0.autoFinishProcessing
 */
function createProcessingTestEnvironment({
  commandString = 'perform-wave',
  initialAction = {
    actionDefinitionId: 'initial:noop',
    commandString: 'initial-action',
    resolvedParameters: { initial: true },
  },
  contextAction = {
    actionDefinitionId: 'ctx:wave',
    commandString: 'wave-now',
    resolvedParameters: { intensity: 'polite' },
  },
  decisionMeta = { speech: 'Hello!', thoughts: 'Keep calm.', notes: [] },
  processThrows = null,
  processHook = null,
  autoFinishProcessing = true,
} = {}) {
  const handlerLogger = new RecordingLogger('handler');
  const dispatcher = new RecordingDispatcher();
  const handler = new TestTurnHandler(handlerLogger, dispatcher);

  const actor = { id: 'actor-42' };
  const strategy = {
    async decideAction() {
      return { action: contextAction, extractedData: decisionMeta };
    },
  };
  const endTurnCalls = [];

  const services = {
    entityManager: {
      getComponentData: () => null,
      getEntityInstance: () => null,
    },
    safeEventDispatcher: dispatcher,
    turnEndPort: {
      endTurn: async (error) => {
        endTurnCalls.push({ source: 'port', error });
      },
    },
  };

  const turnContext = new TurnContext({
    actor,
    logger: handlerLogger,
    services,
    strategy,
    onEndTurnCallback: async (errorOrNull) => {
      endTurnCalls.push({ source: 'callback', error: errorOrNull });
    },
    handlerInstance: handler,
  });

  if (contextAction) {
    turnContext.setChosenAction(contextAction);
  }
  if (decisionMeta !== undefined) {
    turnContext.setDecisionMeta(decisionMeta);
  }

  handler.setTurnContext(turnContext);

  const processCalls = [];
  let stateInstance;

  const commandProcessingWorkflowFactory = () => ({
    async processCommand(ctx, actorArg, actionArg) {
      processCalls.push({ ctx, actor: actorArg, action: actionArg });
      if (typeof processHook === 'function') {
        await processHook({
          ctx,
          actor: actorArg,
          action: actionArg,
          state: stateInstance,
        });
      }
      if (processThrows) {
        throw processThrows;
      }
      if (autoFinishProcessing && stateInstance) {
        stateInstance.finishProcessing();
      }
    },
  });

  const state = new ProcessingCommandState({
    handler,
    commandProcessor: {
      async processCommand() {},
      async dispatchAction() {},
    },
    commandOutcomeInterpreter: {
      async interpret() {},
    },
    commandString,
    turnAction: initialAction,
    directiveResolver: {
      resolveStrategy: () => ({ execute: async () => {} }),
    },
    commandProcessingWorkflowFactory,
  });

  stateInstance = state;

  return {
    state,
    handler,
    handlerLogger,
    dispatcher,
    actor,
    turnContext,
    processCalls,
    endTurnCalls,
    decisionMeta,
    contextAction,
    commandString,
  };
}

describe('ProcessingWorkflow integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('processes a context-provided action and dispatches speech metadata', async () => {
    const decisionMeta = {
      speech: 'Integration greeting',
      thoughts: 'Hope this works',
      notes: [{ text: 'remember to smile', subject: 'etiquette' }],
    };
    const contextAction = {
      actionDefinitionId: 'ctx:greet',
      commandString: 'say-hello',
      resolvedParameters: { wave: true },
    };
    const env = createProcessingTestEnvironment({
      commandString: 'say-hello-command',
      contextAction,
      decisionMeta,
    });

    env.state._setTurnAction(null);
    const workflow = new ProcessingWorkflow(
      env.state,
      env.commandString,
      null,
      (action) => env.state._setTurnAction(action),
      env.state._exceptionHandler
    );

    await workflow.run(env.handler, null);

    expect(env.processCalls).toHaveLength(1);
    expect(env.processCalls[0]).toEqual({
      ctx: env.turnContext,
      actor: env.actor,
      action: contextAction,
    });

    expect(env.dispatcher.calls).toContainEqual({
      eventName: ENTITY_SPOKE_ID,
      payload: {
        entityId: env.actor.id,
        speechContent: 'Integration greeting',
        thoughts: 'Hope this works',
        notes: decisionMeta.notes,
      },
    });
    expect(env.state.isProcessing).toBe(false);
    expect(env.endTurnCalls).toHaveLength(0);
  });

  it('logs a warning and aborts when the state is already processing', async () => {
    const env = createProcessingTestEnvironment();
    env.state.startProcessing();

    const workflow = new ProcessingWorkflow(
      env.state,
      env.commandString,
      env.contextAction,
      (action) => env.state._setTurnAction(action),
      env.state._exceptionHandler
    );

    await workflow.run(env.handler, null);

    expect(env.processCalls).toHaveLength(0);
    expect(
      env.handlerLogger.calls.warn.some(([message]) =>
        message.includes('enterState called while already processing')
      )
    ).toBe(true);
  });

  it('invokes the exception handler when no actor is available', async () => {
    const env = createProcessingTestEnvironment();
    env.turnContext.getActor = () => null;
    env.state._setTurnAction(null);

    const handleSpy = jest.spyOn(env.state._exceptionHandler, 'handle');

    const workflow = new ProcessingWorkflow(
      env.state,
      env.commandString,
      null,
      (action) => env.state._setTurnAction(action),
      env.state._exceptionHandler
    );

    await workflow.run(env.handler, null);

    expect(handleSpy).toHaveBeenCalledTimes(1);
    const [ctxArg, errorArg, contextTag] = handleSpy.mock.calls[0];
    expect(ctxArg).toBe(env.turnContext);
    expect(errorArg.message).toContain('No actor present');
    expect(contextTag).toBe('NoActorOnEnter');
    expect(env.endTurnCalls).not.toHaveLength(0);
    expect(env.processCalls).toHaveLength(0);
  });

  it('handles failures when retrieving an action from the context', async () => {
    const env = createProcessingTestEnvironment();
    env.state._setTurnAction(null);
    env.turnContext.getChosenAction = () => {
      throw new Error('action retrieval failed');
    };

    const handleSpy = jest.spyOn(env.state._exceptionHandler, 'handle');

    const workflow = new ProcessingWorkflow(
      env.state,
      env.commandString,
      null,
      (action) => env.state._setTurnAction(action),
      env.state._exceptionHandler
    );

    await workflow.run(env.handler, null);

    expect(handleSpy).toHaveBeenCalled();
    const errorMessages = handleSpy.mock.calls.map(([, err]) => err.message);
    expect(
      errorMessages.some((msg) => msg.includes('Error retrieving ITurnAction'))
    ).toBe(true);
    expect(
      errorMessages.some((msg) => msg.includes('No ITurnAction available'))
    ).toBe(true);
    expect(env.processCalls).toHaveLength(0);
  });

  it('validates action metadata and reports invalid actions', async () => {
    const env = createProcessingTestEnvironment();
    env.state._setTurnAction(null);
    env.turnContext.getChosenAction = () => ({ commandString: 'bad-action' });

    const handleSpy = jest.spyOn(env.state._exceptionHandler, 'handle');

    const workflow = new ProcessingWorkflow(
      env.state,
      env.commandString,
      null,
      (action) => env.state._setTurnAction(action),
      env.state._exceptionHandler
    );

    await workflow.run(env.handler, null);

    expect(handleSpy).toHaveBeenCalledTimes(1);
    const [, errorArg] = handleSpy.mock.calls[0];
    expect(errorArg.message).toContain('ITurnAction for actor');
    expect(env.processCalls).toHaveLength(0);
  });

  it('routes processing errors through the exception handler with context fallback', async () => {
    const processError = new Error('processing failure');
    const env = createProcessingTestEnvironment({
      processThrows: processError,
      processHook: () => {
        env.handler.setTurnContext(null);
      },
      autoFinishProcessing: false,
    });

    env.state._setTurnAction(null);

    const handleSpy = jest.spyOn(env.state._exceptionHandler, 'handle');

    const workflow = new ProcessingWorkflow(
      env.state,
      env.commandString,
      null,
      (action) => env.state._setTurnAction(action),
      env.state._exceptionHandler
    );

    await workflow.run(env.handler, null);

    expect(env.processCalls).toHaveLength(1);
    expect(handleSpy).toHaveBeenCalledTimes(1);
    const [ctxArg, errorArg, actorId] = handleSpy.mock.calls[0];
    expect(ctxArg).toBe(env.turnContext);
    expect(errorArg).toBe(processError);
    expect(actorId).toBe(env.actor.id);
    expect(
      env.handlerLogger.calls.error.some(([message]) =>
        message.includes('Uncaught error from _processCommandInternal scope')
      )
    ).toBe(true);
  });
});
