import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockFactory = () => ({
  createIdleState: jest.fn(),
  createEndingState: jest.fn(),
  createAwaitingInputState: jest.fn(),
  createProcessingCommandState: jest.fn(),
  createAwaitingExternalTurnEndState: jest.fn(),
});

class TestTurnHandler extends BaseTurnHandler {
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

describe('BaseTurnHandler final coverage scenarios', () => {
  let logger;
  let factory;
  let handler;

  beforeEach(() => {
    logger = createMockLogger();
    factory = createMockFactory();
    handler = new TestTurnHandler({ logger, turnStateFactory: factory });
  });

  it('returns the current state via getCurrentState()', () => {
    const state = { name: 'current-state' };
    handler._currentState = state;

    expect(handler.getCurrentState()).toBe(state);
  });

  it('ignores _handleTurnEnd when destruction status changes mid-call', async () => {
    let accessCount = 0;
    Object.defineProperty(handler, '_isDestroyed', {
      configurable: true,
      get() {
        accessCount += 1;
        return accessCount >= 3;
      },
      set(v) {
        accessCount = v ? 3 : 0;
      },
    });

    await handler._handleTurnEnd('actor-1', null, false);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'handler is already destroyed and call is not from destroy process.'
      )
    );
    expect(factory.createEndingState).not.toHaveBeenCalled();

    delete handler._isDestroyed;
    handler._isDestroyed = false;
  });

  it('recovers during destroy() if transitioning to idle fails', async () => {
    const activeState = {
      isIdle: jest.fn().mockReturnValue(false),
      getStateName: jest.fn().mockReturnValue('ActiveState'),
    };
    handler._currentState = activeState;

    const attemptIdleState = {
      getStateName: jest.fn().mockReturnValue('AttemptIdle'),
    };
    const fallbackIdleState = {
      getStateName: jest.fn().mockReturnValue('FallbackIdle'),
    };
    factory.createIdleState
      .mockReturnValueOnce(attemptIdleState)
      .mockReturnValueOnce(fallbackIdleState);

    const transitionError = new Error('transition failed');
    const transitionSpy = jest
      .spyOn(handler, '_transitionToState')
      .mockRejectedValue(transitionError);

    await handler.destroy();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error while transitioning to TurnIdleState during destroy'
      ),
      transitionError
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Forcibly set state to TurnIdleState due to transition error.'
      )
    );
    expect(handler._currentState).toBe(fallbackIdleState);
    expect(factory.createIdleState).toHaveBeenCalledTimes(2);
    transitionSpy.mockRestore();
  });
});
