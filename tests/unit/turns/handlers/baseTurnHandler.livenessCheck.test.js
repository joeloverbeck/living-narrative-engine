import { describe, it, expect, jest } from '@jest/globals';
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
  createEndingState: jest.fn((h, actorId, err) => {
    const state = new TurnEndingState(h, actorId, err);
    jest.spyOn(state, 'enterState').mockResolvedValue(undefined);
    jest.spyOn(state, 'exitState').mockResolvedValue(undefined);
    return state;
  }),
  createAwaitingInputState: jest.fn(),
  createProcessingCommandState: jest.fn(),
  createAwaitingExternalTurnEndState: jest.fn(),
};

class SimpleHandler extends BaseTurnHandler {
  constructor(opts) {
    super(opts);
    this._setInitialState(mockTurnStateFactory.createIdleState(this));
  }

  async startTurn() {
    this._assertHandlerActive();
    return 'started';
  }
}

describe('BaseTurnHandler liveness checks', () => {
  it('startTurn throws when handler is destroying', async () => {
    const handler = new SimpleHandler({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
    });
    handler._isDestroying = true;
    await expect(handler.startTurn({ id: 'A' })).rejects.toThrow(
      'destroying or'
    );
  });

  it('_handleTurnEnd throws when called while destroying and not from destroy', async () => {
    const handler = new SimpleHandler({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
    });
    handler._isDestroying = true;
    await expect(handler._handleTurnEnd('A')).rejects.toThrow('destroying or');
  });

  it('_handleTurnEnd does not throw when called from destroy', async () => {
    const handler = new SimpleHandler({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
    });
    handler._isDestroying = true;
    await expect(
      handler._handleTurnEnd('A', null, true)
    ).resolves.toBeUndefined();
  });
});
