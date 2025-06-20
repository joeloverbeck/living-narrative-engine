import { describe, expect, it, jest } from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  createChild: jest.fn(() => mockLogger),
};

const mockTurnStateFactory = {
  createIdleState: jest.fn((h) => new TurnIdleState(h)),
  createEndingState: jest.fn((h, id, err) => new TurnEndingState(h, id, err)),
  createAwaitingInputState: jest.fn(),
};

class SimpleHandler extends BaseTurnHandler {
  constructor() {
    super({ logger: mockLogger, turnStateFactory: mockTurnStateFactory });
    this._setInitialState(mockTurnStateFactory.createIdleState(this));
  }
  async startTurn() {}
  getTurnEndPort() {
    return { notifyTurnEnded: jest.fn() };
  }
}

describe('BaseTurnHandler robustness for optional state methods', () => {
  it('transition handles state without isIdle()', async () => {
    const handler = new SimpleHandler();
    const customState = {
      enterState: jest.fn(async () => {}),
      exitState: jest.fn(async () => {}),
      getStateName: () => 'CustomState',
      // no isIdle()
    };
    await expect(
      handler._transitionToState(customState)
    ).resolves.toBeUndefined();
    expect(handler._currentState).toBe(customState);
  });

  it('handleTurnEnd works when current state lacks isIdle/isEnding', async () => {
    const handler = new SimpleHandler();
    const incompleteState = {
      enterState: jest.fn(async () => {}),
      exitState: jest.fn(async () => {}),
      getStateName: () => 'IncompleteState',
      // no isIdle() or isEnding()
    };
    handler._currentState = incompleteState;
    await expect(handler._handleTurnEnd('A')).resolves.toBeUndefined();
    expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
  });
});
