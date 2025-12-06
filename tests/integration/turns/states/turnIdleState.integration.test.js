import { describe, expect, jest, beforeEach, test } from '@jest/globals';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { ITurnStateFactory } from '../../../../src/turns/interfaces/ITurnStateFactory.js';
import { ITurnEndPort } from '../../../../src/turns/ports/ITurnEndPort.js';

class TestTurnEndPort extends ITurnEndPort {
  constructor() {
    super();
    this.notifications = [];
  }

  async notifyTurnEnded(actorId, success) {
    this.notifications.push({ actorId, success });
  }
}

class TestAwaitingState extends AbstractTurnState {
  async enterState(handler, previousState) {
    await super.enterState(handler, previousState);
    handler._enteredAwaiting = (handler._enteredAwaiting || 0) + 1;
  }
}

class TestProcessingState extends AbstractTurnState {}
class TestEndingState extends AbstractTurnState {}
class TestExternalAwaitingState extends AbstractTurnState {}

class TestTurnStateFactory extends ITurnStateFactory {
  createInitialState(handler) {
    return new TurnIdleState(handler);
  }

  createIdleState(handler) {
    return new TurnIdleState(handler);
  }

  createEndingState(handler, actorId, error) {
    const state = new TestEndingState(handler);
    state._actorId = actorId;
    state._error = error;
    return state;
  }

  createAwaitingInputState(handler) {
    return new TestAwaitingState(handler);
  }

  createProcessingCommandState(handler) {
    return new TestProcessingState(handler);
  }

  createAwaitingExternalTurnEndState(handler) {
    return new TestExternalAwaitingState(handler);
  }
}

class TestTurnHandler extends BaseTurnHandler {
  constructor({ logger, turnStateFactory }) {
    super({ logger, turnStateFactory });
    this.turnEndPort = new TestTurnEndPort();
    this._resetCalls = [];
    this._setInitialState(this._turnStateFactory.createInitialState(this));
  }

  getTurnEndPort() {
    return this.turnEndPort;
  }

  resetStateAndResources(reason) {
    this._resetCalls.push(reason);
    super.resetStateAndResources(reason);
  }

  async startTurn(actor) {
    this._setCurrentActorInternal(actor);
    await this._currentState.startTurn(this, actor);
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createActor = (id = 'actor-1') => ({ id });

const createContext = (
  handler,
  actor,
  logger,
  { mismatchActor, failAwaitingTransition } = {}
) => {
  const actorForContext = mismatchActor ?? actor;
  return {
    getActor: jest.fn(() => actorForContext),
    getLogger: jest.fn(() => logger),
    requestAwaitingInputStateTransition: jest.fn(() => {
      if (failAwaitingTransition) {
        return Promise.reject(new Error('transition failure'));
      }
      return handler.requestAwaitingInputStateTransition();
    }),
    requestProcessingCommandStateTransition: jest.fn(() => Promise.resolve()),
    endTurn: jest.fn(() => Promise.resolve()),
    getStrategy: jest.fn(() => ({ decideAction: jest.fn() })),
  };
};

describe('TurnIdleState integration', () => {
  let logger;
  let stateFactory;
  let handler;
  let idleState;

  beforeEach(() => {
    logger = createLogger();
    stateFactory = new TestTurnStateFactory();
    handler = new TestTurnHandler({ logger, turnStateFactory: stateFactory });
    idleState = handler.getCurrentState();
  });

  test('enterState resets handler resources on entry', async () => {
    await idleState.enterState(handler, null);
    expect(handler._resetCalls).toContain('enterState-TurnIdleState');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Ensuring clean state')
    );
  });

  test('startTurn transitions to awaiting state when actor and context align', async () => {
    const actor = createActor('hero');
    const context = createContext(handler, actor, logger);
    handler._setCurrentTurnContextInternal(context);

    await handler.startTurn(actor);

    expect(context.requestAwaitingInputStateTransition).toHaveBeenCalledTimes(
      1
    );
    expect(handler._enteredAwaiting).toBe(1);
    expect(handler.getCurrentState()).toBeInstanceOf(TestAwaitingState);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Successfully transitioned to AwaitingActorDecisionState'
      )
    );
  });

  test('startTurn rejects when actor entity is invalid', async () => {
    const actor = null;
    const validActor = createActor('fallback');
    const context = createContext(handler, validActor, logger);
    handler._setCurrentTurnContextInternal(context);

    await expect(handler.startTurn(actor)).rejects.toThrow(
      'TurnIdleState: invalid actorEntity.'
    );

    expect(handler._resetCalls).toContain('invalid-actor-TurnIdleState');
    expect(context.requestAwaitingInputStateTransition).not.toHaveBeenCalled();
    expect(handler.getCurrentState()).toBeInstanceOf(TurnIdleState);
  });

  test('startTurn rejects when turn context is missing', async () => {
    const actor = createActor('lonely');
    handler._setCurrentTurnContextInternal(null);

    await expect(handler.startTurn(actor)).rejects.toThrow(
      'TurnIdleState: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: lonely.'
    );

    expect(handler._resetCalls).toContain('missing-context-TurnIdleState');
    expect(handler.getCurrentState()).toBeInstanceOf(TurnIdleState);
  });

  test('startTurn rejects when context actor mismatches provided actor', async () => {
    const actor = createActor('actor-a');
    const mismatch = createActor('actor-b');
    const context = createContext(handler, actor, logger, {
      mismatchActor: mismatch,
    });
    handler._setCurrentTurnContextInternal(context);

    await expect(handler.startTurn(actor)).rejects.toThrow(
      "TurnIdleState: Actor in ITurnContext ('actor-b') does not match actor provided to state's startTurn ('actor-a')."
    );

    expect(handler._resetCalls).toContain('actor-mismatch-TurnIdleState');
    expect(context.requestAwaitingInputStateTransition).not.toHaveBeenCalled();
    expect(handler.getCurrentState()).toBeInstanceOf(TurnIdleState);
  });

  test('startTurn recovers to idle when awaiting input transition fails', async () => {
    const actor = createActor('actor-c');
    const context = createContext(handler, actor, logger, {
      failAwaitingTransition: true,
    });
    handler._setCurrentTurnContextInternal(context);

    await expect(handler.startTurn(actor)).rejects.toThrow(
      'transition failure'
    );

    expect(handler._resetCalls).toContain('transition-fail-TurnIdleState');
    expect(handler.getCurrentState()).toBeInstanceOf(TurnIdleState);
    expect(context.requestAwaitingInputStateTransition).toHaveBeenCalledTimes(
      1
    );
  });

  test('idle passthrough methods log standardized warnings', async () => {
    const actor = createActor('actor-d');
    const context = createContext(handler, actor, logger);
    handler._setCurrentTurnContextInternal(context);

    await expect(
      idleState.handleSubmittedCommand(handler, 'look', actor)
    ).rejects.toThrow(
      'Method \'handleSubmittedCommand(command: "look", entity: actor-d, contextActor: actor-d)\' must be implemented by concrete state TurnIdleState.'
    );

    await idleState.handleTurnEndedEvent(handler, { entityId: actor.id });

    await expect(
      idleState.processCommandResult(handler, actor, { outcome: 'ok' }, 'look')
    ).rejects.toThrow(
      'Method \'processCommandResult(actorId: actor-d, command: "look")\' must be implemented by concrete state TurnIdleState.'
    );

    await expect(
      idleState.handleDirective(handler, actor, 'noop', { outcome: 'ok' })
    ).rejects.toThrow(
      "Method 'handleDirective(actorId: actor-d, directive: noop)' must be implemented by concrete state TurnIdleState."
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "TurnIdleState: Command ('look') submitted by actor-d but no turn is active (handler is Idle)."
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'TurnIdleState: handleTurnEndedEvent called (for actor-d) but no turn is active (handler is Idle).'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'TurnIdleState: processCommandResult called (for actor-d) but no turn is active.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'TurnIdleState: handleDirective called (for actor-d) but no turn is active.'
    );
  });

  test('destroy delegates to base implementation and logs cleanup', async () => {
    const actor = createActor('actor-e');
    const context = createContext(handler, actor, logger);
    handler._setCurrentTurnContextInternal(context);

    await idleState.destroy(handler);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'BaseTurnHandler is being destroyed while in idle state.'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Destroy handling complete')
    );
  });

  test('isIdle reports true for TurnIdleState', () => {
    expect(idleState.isIdle()).toBe(true);
  });
});
