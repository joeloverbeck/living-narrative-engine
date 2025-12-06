import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFactory = () => ({
  createIdleState: jest.fn(),
  createEndingState: jest.fn(),
  createAwaitingInputState: jest.fn(),
  createProcessingCommandState: jest.fn(),
  createAwaitingExternalTurnEndState: jest.fn(),
});

class ConcreteTurnHandler extends BaseTurnHandler {
  constructor({ logger, turnStateFactory }) {
    super({ logger, turnStateFactory });
  }

  async startTurn() {
    return undefined;
  }

  getTurnEndPort() {
    return { notifyTurnEnded: jest.fn() };
  }
}

describe('BaseTurnHandler additional coverage', () => {
  let logger;
  let factory;
  let handler;

  beforeEach(() => {
    logger = createLogger();
    factory = createFactory();
    handler = new ConcreteTurnHandler({ logger, turnStateFactory: factory });
  });

  it('uses the logger from the active turn context when available', () => {
    const contextLogger = createLogger();
    handler._currentTurnContext = {
      getLogger: () => contextLogger,
    };

    expect(handler.getLogger()).toBe(contextLogger);
  });

  it('warns when setting actor while an active context has a different actor', () => {
    const contextActor = { id: 'context-actor' };
    handler._currentTurnContext = { getActor: () => contextActor };

    const newActor = { id: 'new-actor' };
    handler._setCurrentActorInternal(newActor);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Handler's actor set to 'new-actor' while an active TurnContext exists"
      )
    );
    expect(handler._currentActor).toBe(newActor);
  });

  it('silently updates the actor when it matches the active context', () => {
    const sharedActor = { id: 'shared-actor' };
    handler._currentTurnContext = {
      getActor: () => sharedActor,
      getLogger: () => createLogger(),
    };

    handler._setCurrentActorInternal(sharedActor);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(handler._currentActor).toBe(sharedActor);
  });

  it('aligns the handler actor when a new context carries a different actor', () => {
    handler._currentActor = { id: 'handler-actor' };
    const contextActor = { id: 'context-actor' };
    const turnContext = { getActor: () => contextActor };

    handler._setCurrentTurnContextInternal(turnContext);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "Aligning _currentActor ('handler-actor') with new TurnContext actor ('context-actor')"
      )
    );
    expect(handler._currentActor).toBe(contextActor);
  });

  it('keeps the handler actor when the new context already matches', () => {
    const contextActor = { id: 'aligned-actor' };
    handler._currentActor = contextActor;

    handler._setCurrentTurnContextInternal({ getActor: () => contextActor });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Setting turn context to object for actor aligned-actor'
      )
    );
    expect(handler._currentActor).toBe(contextActor);
  });

  it('aligns with contexts that lack actor identifiers', () => {
    handler._currentActor = { id: 'handler-actor' };
    const turnContext = { getActor: () => ({}) };

    handler._setCurrentTurnContextInternal(turnContext);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("TurnContext actor ('null')")
    );
  });

  it('logs fallback values when actors are missing during updates', () => {
    const contextLogger = createLogger();
    handler._currentTurnContext = {
      getActor: () => ({ id: 'context-actor' }),
      getLogger: () => contextLogger,
    };

    handler._setCurrentActorInternal(null);

    const turnContext = {
      getActor: () => null,
      getLogger: () => createLogger(),
    };
    handler._setCurrentTurnContextInternal(turnContext);

    expect(contextLogger.warn).toHaveBeenCalled();
    expect(contextLogger.debug).toHaveBeenCalled();
  });

  it('skips transitioning to the same non-idle state', async () => {
    const persistentState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('Persistent'),
      isIdle: jest.fn().mockReturnValue(false),
    };
    handler._currentState = persistentState;

    await handler._transitionToState(persistentState);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to transition to the same state')
    );
    expect(persistentState.exitState).not.toHaveBeenCalled();
    expect(persistentState.enterState).not.toHaveBeenCalled();
  });

  it('uses default state names when the previous state omits them', async () => {
    const namelessState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn(),
      isIdle: jest.fn().mockReturnValue(false),
    };
    handler._currentState = namelessState;

    await handler._transitionToState(namelessState);

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('N/A'));
  });

  it('allows re-entering the same idle state without early return', async () => {
    const idleState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('IdleRepeat'),
      isIdle: jest.fn().mockReturnValue(true),
    };
    handler._currentState = idleState;

    await handler._transitionToState(idleState);

    expect(idleState.enterState).toHaveBeenCalled();
  });

  it('recovers from errors entering a new state by transitioning to idle', async () => {
    const failingState = {
      enterState: jest.fn().mockRejectedValue(new Error('enter boom')),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('FailingState'),
      isIdle: jest.fn().mockReturnValue(false),
    };
    const idleState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('IdleState'),
      isIdle: jest.fn().mockReturnValue(true),
    };
    factory.createIdleState.mockReturnValue(idleState);

    const resetSpy = jest.spyOn(handler, '_resetTurnStateAndResources');

    await handler._transitionToState(failingState);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during FailingState.enterState or onEnterState hook'
      ),
      expect.any(Error)
    );
    expect(resetSpy).toHaveBeenCalledWith(
      'error-entering-FailingState-for-N/A'
    );
    expect(factory.createIdleState).toHaveBeenCalled();
    expect(idleState.enterState).toHaveBeenCalled();
  });

  it('recovers from errors when the new state lacks isIdle', async () => {
    handler._currentState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('PrevState'),
      isIdle: jest.fn().mockReturnValue(true),
    };
    const failingState = {
      enterState: jest.fn().mockRejectedValue(new Error('enter boom')),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('FailingState'),
    };
    const idleState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('IdleState'),
      isIdle: jest.fn().mockReturnValue(true),
    };
    factory.createIdleState.mockReturnValue(idleState);

    await handler._transitionToState(failingState);

    expect(factory.createIdleState).toHaveBeenCalled();
    expect(idleState.enterState).toHaveBeenCalled();
  });

  it('ignores turn end requests once destroyed', async () => {
    handler._isDestroyed = true;

    await handler._handleTurnEnd('ended-actor');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('handler already destroyed')
    );
    expect(factory.createEndingState).not.toHaveBeenCalled();
  });

  it('logs unknown actor when handling turn end without an id', async () => {
    handler._isDestroyed = true;

    await handler._handleTurnEnd();

    expect(logger.warn).toHaveBeenCalled();
  });

  it('honors fromDestroy flag even when already destroyed', async () => {
    handler._isDestroyed = true;
    handler._currentState = {
      isEnding: () => true,
      isIdle: () => false,
      getStateName: () => 'Ending',
    };
    const endingState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: () => 'EndingState',
      isIdle: () => true,
    };
    factory.createEndingState.mockReturnValue(endingState);

    await handler._handleTurnEnd('actor-id', null, true);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('clears context, actor, and cancels prompts when resetting resources', () => {
    const cancelActivePrompt = jest.fn();
    const contextActor = { id: 'context-actor' };
    handler._currentTurnContext = {
      cancelActivePrompt,
      getActor: () => contextActor,
    };
    handler._currentActor = { id: 'handler-actor' };

    const setContextSpy = jest.spyOn(handler, '_setCurrentTurnContextInternal');
    const setActorSpy = jest.spyOn(handler, '_setCurrentActorInternal');

    handler._resetTurnStateAndResources('unit-test');

    expect(cancelActivePrompt).toHaveBeenCalled();
    expect(setContextSpy).toHaveBeenCalledWith(null);
    expect(setActorSpy).toHaveBeenCalledWith(null);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Clearing current handler actor')
    );
  });

  it('uses default reset reason and handles missing cancelActivePrompt', () => {
    handler._currentTurnContext = {
      getActor: () => null,
    };

    handler._resetTurnStateAndResources();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("_resetTurnStateAndResources (context: 'N/A')")
    );
  });

  it('clears actors with missing ids without logging unknown values repeatedly', () => {
    handler._currentActor = { id: undefined };

    handler._resetTurnStateAndResources('missing-id');

    expect(logger.debug).toHaveBeenCalled();
  });

  it('cancels active prompts and transitions to idle during destroy()', async () => {
    const contextActor = { id: 'context-actor' };
    handler._currentTurnContext = {
      cancelActivePrompt: jest.fn(),
      getActor: () => contextActor,
    };
    const activeState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('ActiveState'),
      isIdle: jest.fn().mockReturnValue(false),
    };
    const idleState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn().mockReturnValue('IdleState'),
      isIdle: jest.fn().mockReturnValue(true),
    };

    handler._currentState = activeState;
    factory.createIdleState.mockReturnValue(idleState);

    await handler.destroy();

    expect(handler._isDestroyed).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Attempting to cancel active prompt in TurnContext'
      )
    );
    expect(factory.createIdleState).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Ensuring transition to TurnIdleState')
    );
  });

  it('returns early from destroy when already destroyed', async () => {
    handler._isDestroyed = true;

    await handler.destroy();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('destroy() called but already destroyed.')
    );
  });

  it('skips idle transition during destroy when already idle and no context prompt', async () => {
    handler._currentState = {
      isIdle: jest.fn().mockReturnValue(true),
      getStateName: jest.fn().mockReturnValue('IdleState'),
    };
    handler._currentTurnContext = { getActor: () => ({ id: 'actor' }) };

    await handler.destroy();

    expect(factory.createIdleState).not.toHaveBeenCalled();
  });

  it('logs default actor ids when cancelling prompts without actor data', async () => {
    handler._currentState = {
      isIdle: jest.fn().mockReturnValue(false),
      getStateName: jest.fn(),
    };
    handler._currentTurnContext = {
      cancelActivePrompt: jest.fn(),
      getActor: () => ({}),
    };
    const idleState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: jest.fn(),
      isIdle: jest.fn().mockReturnValue(true),
    };
    factory.createIdleState.mockReturnValue(idleState);

    await handler.destroy();

    expect(logger.debug).toHaveBeenCalled();
  });
});
