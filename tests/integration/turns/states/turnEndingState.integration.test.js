import {
  describe,
  expect,
  test,
  beforeEach,
  jest,
} from '@jest/globals';
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

  test('enterState notifies turn end port, signals termination, and transitions to idle', async () => {
    const actor = { id: 'actor-1' };
    const context = buildTurnContext({
      handler,
      actor,
      logger,
      dispatcher,
    });
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    const idleRequestSpy = jest.spyOn(
      context,
      'requestIdleStateTransition'
    );
    const handlerIdleSpy = jest.spyOn(handler, 'requestIdleStateTransition');

    await state.enterState(handler, new TurnIdleState(handler));

    expect(handler.turnEndPort.notifications).toEqual([
      { actorId: actor.id, success: true },
    ]);
    expect(handler.normalTerminationSignals).toBe(1);
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
    expect(idleRequestSpy).toHaveBeenCalledTimes(1);
    expect(handlerIdleSpy).toHaveBeenCalledTimes(1);
    expect(handler.getCurrentState()).toBeInstanceOf(TurnIdleState);
  });

  test('enterState dispatches error when turn end port notification fails', async () => {
    const actor = { id: 'actor-2' };
    const failingPort = new ThrowingTurnEndPort('boom');
    handler.turnEndPort = failingPort;

    const context = buildTurnContext({
      handler,
      actor,
      logger,
      dispatcher,
      turnEndPort: failingPort,
    });
    const state = new TurnEndingState(handler, actor.id, new Error('turn failed'));
    handler._currentState = state;

    await state.enterState(handler, new TurnIdleState(handler));

    expect(dispatcher.events.some((event) =>
      event.eventId === SYSTEM_ERROR_OCCURRED_ID &&
      event.payload.message.startsWith(
        'TurnEndingState: Failed notifying TurnEndPort'
      )
    )).toBe(true);
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
    expect(handler.normalTerminationSignals).toBe(1);
    expect(handler.getCurrentState()).toBeInstanceOf(TurnIdleState);
    expect(
      handler.turnEndPort instanceof ThrowingTurnEndPort
    ).toBe(true);
  });

  test('enterState logs warning when context is missing', async () => {
    const actor = { id: 'actor-3' };
    handler._setCurrentActorInternal(actor);
    handler._setCurrentTurnContextInternal(null);
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    await state.enterState(handler, new TurnIdleState(handler));

    expect(logger.warn).toHaveBeenCalledWith(
      `TurnEndingState: TurnEndPort not notified for actor ${actor.id}. Reason: ITurnContext not available.`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'TurnEndingState: No ITurnContext available – Idle transition skipped.'
    );
    expect(handler.normalTerminationSignals).toBe(0);
    expect(handler.resetReasons).toContain(
      `enterState-TurnEndingState-actor-${actor.id}`
    );
  });

  test('enterState handles actor mismatch by skipping notifications', async () => {
    const actor = { id: 'actor-4' };
    const mismatchActor = { id: 'other-actor' };
    const context = buildTurnContext({
      handler,
      actor: mismatchActor,
      logger,
      dispatcher,
    });
    const state = new TurnEndingState(handler, actor.id);
    handler._currentState = state;

    const idleRequestSpy = jest.spyOn(
      context,
      'requestIdleStateTransition'
    );

    await state.enterState(handler, new TurnIdleState(handler));

    expect(handler.turnEndPort.notifications).toHaveLength(0);
    expect(handler.normalTerminationSignals).toBe(0);
    expect(idleRequestSpy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      `TurnEndingState: TurnEndPort not notified for actor ${actor.id}. Reason: ITurnContext actor mismatch (context: ${mismatchActor.id}, target: ${actor.id}).`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `TurnEndingState: Normal apparent termination not signaled. Context actor ('${mismatchActor.id}') vs target actor ('${actor.id}') mismatch or no context actor.`
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

  test('destroy attempts idle transition and dispatches error when it fails', async () => {
    const actor = { id: 'actor-6' };
    const context = buildTurnContext({
      handler,
      actor,
      logger,
      dispatcher,
    });
    context.requestIdleStateTransition = jest
      .fn()
      .mockRejectedValue(new Error('forced failure'));

    handler._currentState = new NoopState(handler);

    const state = new TurnEndingState(handler, actor.id);

    await state.destroy(handler);

    expect(logger.warn).toHaveBeenCalledWith(
      `TurnEndingState: Handler destroyed while in TurnEndingState for actor ${actor.id}.`
    );
    expect(handler.resetReasons).toContain(
      `destroy-TurnEndingState-actor-${actor.id}`
    );
    expect(context.requestIdleStateTransition).toHaveBeenCalledTimes(1);
    expect(
      dispatcher.events.some((event) =>
        event.eventId === SYSTEM_ERROR_OCCURRED_ID &&
        event.payload.message.startsWith(
          'TurnEndingState: Failed forced transition to TurnIdleState'
        )
      )
    ).toBe(true);
  });
});
