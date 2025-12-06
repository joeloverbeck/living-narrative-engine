import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

class TestHandler {
  constructor(logger) {
    this._logger = logger;
    this._turnContext = null;
    this._isDestroying = false;
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

  resetStateAndResources() {
    // No-op for integration scenario
  }

  async requestIdleStateTransition() {
    // No-op for integration scenario
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createTurnEnvironment = () => {
  const logger = createLogger();
  const handler = new TestHandler(logger);
  const actor = { id: 'actor-integration' };
  const services = {
    entityManager: {
      getComponentData: jest.fn().mockReturnValue(null),
      getEntityInstance: jest.fn().mockReturnValue(null),
    },
  };
  const strategy = { decideAction: jest.fn() };
  const onEndTurn = jest.fn();

  const turnContext = new TurnContext({
    actor,
    logger,
    services,
    strategy,
    onEndTurnCallback: onEndTurn,
    handlerInstance: handler,
  });

  handler.setTurnContext(turnContext);

  const state = new AwaitingActorDecisionState(handler);

  return { handler, state, turnContext, logger, onEndTurn, actor };
};

describe('AwaitingActorDecisionState destroy cleanup integration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a warning when no actor is available in context during destruction', async () => {
    const { state, handler, turnContext, logger, onEndTurn } =
      createTurnEnvironment();
    jest.spyOn(turnContext, 'getActor').mockReturnValue(null);

    await state.destroy(handler);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Actor ID from context: N/A_in_context')
    );
    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it('skips ending the turn when the handler is already tearing down', async () => {
    const { state, handler, turnContext, logger, onEndTurn } =
      createTurnEnvironment();
    handler._isDestroying = true;
    const endTurnSpy = jest.spyOn(turnContext, 'endTurn');

    await state.destroy(handler);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('is already being destroyed')
    );
    expect(endTurnSpy).not.toHaveBeenCalled();
    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it('ends the turn via the turn context when an actor is still active', async () => {
    const { state, handler, turnContext, logger, onEndTurn, actor } =
      createTurnEnvironment();
    const endTurnSpy = jest.spyOn(turnContext, 'endTurn');

    await state.destroy(handler);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Handler destroyed while state was active for actor ${actor.id}`
      )
    );
    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    const [errorArg] = endTurnSpy.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toContain(`actor ${actor.id}`);
    expect(onEndTurn).toHaveBeenCalledWith(errorArg);
  });
});
