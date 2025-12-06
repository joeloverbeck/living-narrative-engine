import { describe, it, expect } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../../src/turns/states/awaitingActorDecisionState.js';
import { TurnContext } from '../../../../../src/turns/context/turnContext.js';
import { ACTION_DECIDED_ID } from '../../../../../src/constants/eventIds.js';

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
}

class RecordingDispatcher {
  constructor() {
    this.dispatched = [];
  }

  async dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class RecordingTurnHandler {
  constructor(logger) {
    this._logger = logger;
    this._turnContext = null;
    this.processingTransitions = [];
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

  async requestProcessingCommandStateTransition(commandString, action) {
    this.processingTransitions.push({ commandString, action });
  }

  async requestIdleStateTransition() {}

  async requestAwaitingInputStateTransition() {}

  async requestAwaitingExternalTurnEndStateTransition() {}
}

/**
 *
 */
function createEntityManager() {
  return {
    getComponentData: () => null,
    getEntityInstance: () => null,
  };
}

/**
 *
 * @param id
 */
function createActor(id = 'actor-42') {
  return {
    id,
    components: {
      'core:player_type': { type: 'human' },
    },
  };
}

/**
 *
 * @param root0
 * @param root0.decideAction
 */
function createEnvironment({ decideAction }) {
  const contextLogger = new RecordingLogger('context');
  const handlerLogger = new RecordingLogger('handler');
  const dispatcher = new RecordingDispatcher();
  const handler = new RecordingTurnHandler(handlerLogger);
  const endTurnCalls = [];
  const actor = createActor();

  const strategy = {
    decideAction: (turnContext) => decideAction(turnContext),
  };

  const turnContext = new TurnContext({
    actor,
    logger: contextLogger,
    services: {
      entityManager: createEntityManager(),
      safeEventDispatcher: dispatcher,
      turnEndPort: { endTurn: async () => {} },
    },
    strategy,
    onEndTurnCallback: async (errorOrNull) => {
      endTurnCalls.push(errorOrNull);
    },
    handlerInstance: handler,
  });

  handler.setTurnContext(turnContext);
  const state = new AwaitingActorDecisionState(handler);

  return {
    state,
    turnContext,
    handler,
    contextLogger,
    handlerLogger,
    dispatcher,
    endTurnCalls,
    actor,
    strategy,
  };
}

describe('ActionDecisionWorkflow integration', () => {
  it('records decisions and transitions when the strategy returns a command', async () => {
    const extractedData = {
      thoughts: 'pondering',
      notes: [{ text: 'note', subject: 'testing' }],
    };
    const action = {
      actionDefinitionId: 'core:wave',
      commandString: 'perform-wave',
    };

    const env = createEnvironment({
      decideAction: async () => ({ action, extractedData }),
    });

    await env.state._handleActionDecision(
      env.turnContext,
      env.actor,
      env.strategy
    );

    expect(env.turnContext.getChosenAction()).toEqual(action);
    expect(env.turnContext.getDecisionMeta()).toBe(extractedData);
    expect(Object.isFrozen(env.turnContext.getDecisionMeta())).toBe(true);

    expect(env.dispatcher.dispatched).toHaveLength(1);
    expect(env.dispatcher.dispatched[0]).toEqual({
      eventName: ACTION_DECIDED_ID,
      payload: expect.objectContaining({
        actorId: env.actor.id,
        actorType: 'human',
        extractedData: expect.objectContaining({ thoughts: 'pondering' }),
      }),
    });

    expect(env.handler.processingTransitions).toEqual([
      { commandString: 'perform-wave', action },
    ]);
    expect(env.endTurnCalls).toHaveLength(0);
  });

  it('falls back to actionDefinitionId when command string is missing or whitespace', async () => {
    const action = {
      actionDefinitionId: 'core:shrug',
      commandString: '   ',
    };

    const env = createEnvironment({
      decideAction: async () => ({ action, extractedData: null }),
    });

    await env.state._handleActionDecision(
      env.turnContext,
      env.actor,
      env.strategy
    );

    expect(env.handler.processingTransitions).toEqual([
      { commandString: 'core:shrug', action },
    ]);
    expect(env.dispatcher.dispatched).toHaveLength(1);
    expect(env.turnContext.getChosenAction()).toEqual(action);
    expect(env.turnContext.getDecisionMeta()).toBeNull();
    expect(env.endTurnCalls).toHaveLength(0);
  });

  it('ends the turn with an error when strategy returns an invalid action', async () => {
    const invalidAction = { commandString: 'broken' };

    const env = createEnvironment({
      decideAction: async () => ({
        action: invalidAction,
        extractedData: null,
      }),
    });

    await env.state._handleActionDecision(
      env.turnContext,
      env.actor,
      env.strategy
    );

    expect(env.handler.processingTransitions).toHaveLength(0);
    expect(env.dispatcher.dispatched).toHaveLength(0);
    expect(env.turnContext.getChosenAction()).toBeNull();
    expect(
      env.contextLogger.calls.warn.some(([message]) =>
        String(message).includes('returned an invalid or null ITurnAction')
      )
    ).toBe(true);
    expect(env.endTurnCalls).toHaveLength(1);
    expect(env.endTurnCalls[0]).toBeInstanceOf(Error);
    expect(env.endTurnCalls[0].message).toContain(
      'returned an invalid or null ITurnAction'
    );
  });

  it('gracefully ends the turn when the strategy aborts', async () => {
    const env = createEnvironment({
      decideAction: () => {
        const abortError = new Error('aborted by user');
        abortError.name = 'AbortError';
        return Promise.reject(abortError);
      },
    });

    await env.state._handleActionDecision(
      env.turnContext,
      env.actor,
      env.strategy
    );

    expect(env.endTurnCalls).toEqual([null]);
    expect(env.handler.processingTransitions).toHaveLength(0);
    expect(env.dispatcher.dispatched).toHaveLength(0);
    expect(
      env.contextLogger.calls.debug.some(([message]) =>
        String(message).includes('was cancelled (aborted)')
      )
    ).toBe(true);
  });

  it('wraps unexpected errors and ends the turn with failure details', async () => {
    const env = createEnvironment({
      decideAction: () => Promise.reject(new Error('database offline')),
    });

    await env.state._handleActionDecision(
      env.turnContext,
      env.actor,
      env.strategy
    );

    expect(env.handler.processingTransitions).toHaveLength(0);
    expect(env.dispatcher.dispatched).toHaveLength(0);
    expect(env.endTurnCalls).toHaveLength(1);
    const [error] = env.endTurnCalls;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Error during action decision');
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.cause.message).toBe('database offline');
    expect(
      env.contextLogger.calls.error.some(([message]) =>
        String(message).includes('Error during action decision')
      )
    ).toBe(true);
  });
});
