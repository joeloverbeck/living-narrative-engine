import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { ITurnStateFactory } from '../../../../src/turns/interfaces/ITurnStateFactory.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { ITurnEndPort } from '../../../../src/turns/ports/ITurnEndPort.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { UNKNOWN_ACTOR_ID } from '../../../../src/constants/unknownIds.js';

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

class RecordingTurnEndPort extends ITurnEndPort {
  constructor() {
    super();
    this.notifications = [];
  }

  async notifyTurnEnded(actorId, success) {
    this.notifications.push({ actorId, success });
  }
}

class ThrowingTurnEndPort extends ITurnEndPort {
  constructor(errorMessage) {
    super();
    this.error = new Error(errorMessage);
  }

  async notifyTurnEnded() {
    throw this.error;
  }
}

class NoopState extends AbstractTurnState {}

class TestTurnStateFactory extends ITurnStateFactory {
  createInitialState(handler) {
    return new TurnIdleState(handler);
  }

  createIdleState(handler) {
    return new TurnIdleState(handler);
  }

  createEndingState(handler, actorId, error) {
    return new TurnEndingState(handler, actorId, error);
  }

  createAwaitingInputState(handler) {
    return new NoopState(handler);
  }

  createProcessingCommandState(handler) {
    return new NoopState(handler);
  }

  createAwaitingExternalTurnEndState(handler) {
    return new NoopState(handler);
  }
}

class TestTurnHandler extends BaseTurnHandler {
  constructor({ logger, turnStateFactory, safeEventDispatcher }) {
    super({ logger, turnStateFactory });
    this.turnEndPort = new RecordingTurnEndPort();
    this.safeEventDispatcher = safeEventDispatcher;
    this.resetReasons = [];
    this.normalTerminationSignals = 0;
    this._setInitialState(this._turnStateFactory.createInitialState(this));
  }

  getTurnEndPort() {
    return this.turnEndPort;
  }

  signalNormalApparentTermination() {
    this.normalTerminationSignals += 1;
  }

  resetStateAndResources(reason) {
    this.resetReasons.push(reason);
    super.resetStateAndResources(reason);
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const buildTurnContext = ({
  handler,
  actor,
  logger,
  dispatcher,
  turnEndPort = handler.getTurnEndPort(),
  onEndTurn = () => Promise.resolve(),
}) => {
  const context = new TurnContext({
    actor,
    logger,
    services: {
      safeEventDispatcher: dispatcher,
      turnEndPort,
    },
    strategy: { decideAction: () => null },
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
  });

  handler._setCurrentActorInternal(actor);
  handler._setCurrentTurnContextInternal(context);

  return context;
};

describe('TurnEndingState integration', () => {
  let logger;
  let dispatcher;
  let stateFactory;
  let handler;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = new RecordingDispatcher();
    stateFactory = new TestTurnStateFactory();
    handler = new TestTurnHandler({
      logger,
      turnStateFactory: stateFactory,
      safeEventDispatcher: dispatcher,
    });
  });

  test('constructor resolves missing actor id and dispatches warning', () => {
    const fallbackActor = { id: 'handler-actor' };
    handler._setCurrentActorInternal(fallbackActor);

    const state = new TurnEndingState(handler, null);

    expect(state.isEnding()).toBe(true);
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0]).toEqual({
      eventId: SYSTEM_ERROR_OCCURRED_ID,
      payload: expect.objectContaining({
        message: 'Actor ID must be provided but was missing.',
        details: {
          providedActorId: null,
          fallbackActorId: fallbackActor.id,
        },
      }),
    });
    expect(logger.warn).toHaveBeenCalledWith(
      `Actor ID was missing; fell back to '${fallbackActor.id}'.`
    );
  });

  test('constructor falls back to UNKNOWN_ACTOR_ID when no actor available', () => {
    const state = new TurnEndingState(handler, undefined);

    expect(state.isEnding()).toBe(true);
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].payload.details.fallbackActorId).toBe(
      UNKNOWN_ACTOR_ID
    );
  });

  test('enterState signals termination and performs cleanup (notification moved to destroy)', async () => {
    const actor = { id: 'actor-1' };
    buildTurnContext({
      handler,
      actor,
      logger,
      dispatcher,
    });
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    await state.enterState(handler, new TurnIdleState(handler));

    // Notification is now handled by BaseTurnHandler.destroy(), not enterState
    expect(handler.turnEndPort.notifications).toHaveLength(0);
    expect(handler.normalTerminationSignals).toBe(1);
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
    // TurnEndingState is now a terminal state - no idle transition requested
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Completed cleanup, awaiting destruction (actor ${actor.id}).`
    );
  });

  test('enterState performs cleanup regardless of turn error (notification in destroy)', async () => {
    const actor = { id: 'actor-2' };
    const failingPort = new ThrowingTurnEndPort('boom');
    handler.turnEndPort = failingPort;

    buildTurnContext({
      handler,
      actor,
      logger,
      dispatcher,
      turnEndPort: failingPort,
    });
    const state = new TurnEndingState(
      handler,
      actor.id,
      new Error('turn failed')
    );
    handler._currentState = state;

    await state.enterState(handler, new TurnIdleState(handler));

    // Notification errors are now handled in BaseTurnHandler.destroy(), not enterState
    // enterState just performs cleanup
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
    expect(handler.normalTerminationSignals).toBe(1);
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Completed cleanup, awaiting destruction (actor ${actor.id}).`
    );
  });

  test('enterState performs cleanup when context is missing (no termination signal)', async () => {
    const actor = { id: 'actor-3' };
    handler._setCurrentActorInternal(actor);
    handler._setCurrentTurnContextInternal(null);
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    await state.enterState(handler, new TurnIdleState(handler));

    // Without context, no termination signal but cleanup still happens
    expect(handler.normalTerminationSignals).toBe(0);
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Completed cleanup, awaiting destruction (actor ${actor.id}).`
    );
  });

  test('enterState handles actor mismatch by skipping termination signal', async () => {
    const actor = { id: 'actor-4' };
    const mismatchActor = { id: 'other-actor' };
    buildTurnContext({
      handler,
      actor: mismatchActor,
      logger,
      dispatcher,
    });
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    await state.enterState(handler, new TurnIdleState(handler));

    // With actor mismatch, termination signal is skipped but cleanup happens
    expect(handler.normalTerminationSignals).toBe(0);
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Normal apparent termination not signaled. Context actor ('${mismatchActor.id}') vs target actor ('${actor.id}') mismatch or no context actor.`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Completed cleanup, awaiting destruction (actor ${actor.id}).`
    );
  });

  test('exitState logs transition information', async () => {
    const actor = { id: 'actor-5' };
    buildTurnContext({ handler, actor, logger, dispatcher });
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    await state.exitState(handler, new TurnIdleState(handler));

    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Exiting for (intended) actor ${actor.id}. Transitioning to TurnIdleState. ITurnContext should be null.`
    );
  });

  test('destroy logs debug message (terminal state - no transition attempted)', async () => {
    const actor = { id: 'actor-6' };
    buildTurnContext({
      handler,
      actor,
      logger,
      dispatcher,
    });

    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    await state.destroy(handler);

    // TurnEndingState is now a terminal state - destroy() just logs debug
    // Notification and transition to Idle are handled by BaseTurnHandler.destroy()
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState.destroy() called for actor ${actor.id}.`
    );
  });
});
