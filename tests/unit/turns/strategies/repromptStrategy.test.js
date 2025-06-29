// src/turns/strategies/repromptStrategy.test.js

import RepromptStrategy from '../../../../src/turns/strategies/repromptStrategy.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

// --- Mocks ---

class MockEntity {
  constructor(id) {
    this.id = id || 'test-actor-id';
  }
}

class MockLogger {
  info = jest.fn();
  error = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
}

class MockTurnContext {
  constructor(actor, logger) {
    this._actor = actor;
    this._logger = logger || new MockLogger();

    this._safeEventDispatcher = { dispatch: jest.fn() };

    this.endTurn = jest.fn();
    this.getActor = jest.fn(() => this._actor);
    this.getLogger = jest.fn(() => this._logger);
    this.getSafeEventDispatcher = jest.fn(() => this._safeEventDispatcher);
    this.requestTransition = jest.fn(() => Promise.resolve()); // Default to successful transition
  }

  // Helper to reset mocks for this context instance between tests
  resetAllMocks() {
    this.endTurn.mockClear();
    this.getActor.mockClear().mockImplementation(() => this._actor); // Reset impl to original
    this.getLogger.mockClear().mockImplementation(() => this._logger); // Reset impl to original
    this.requestTransition
      .mockClear()
      .mockImplementation(() => Promise.resolve()); // Reset impl to original

    this.getSafeEventDispatcher
      .mockClear()
      .mockImplementation(() => this._safeEventDispatcher);
    this._safeEventDispatcher.dispatch.mockClear();

    if (
      this._logger &&
      typeof this._logger.info === 'function' &&
      this._logger.info.mockClear
    ) {
      this._logger.info.mockClear();
      this._logger.error.mockClear();
      this._logger.warn.mockClear();
      this._logger.debug.mockClear();
    }
  }
}

// --- Test Suite ---

describe('RepromptStrategy', () => {
  let strategy;
  let mockLogger;
  let mockActor;
  let mockTurnContext;

  beforeEach(() => {
    strategy = new RepromptStrategy();
    mockLogger = new MockLogger();
    mockActor = new MockEntity('actor-789');
    mockTurnContext = new MockTurnContext(mockActor, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should correctly execute RE_PROMPT directive and request transition to AwaitingActorDecisionState', async () => {
    const directive = TurnDirective.RE_PROMPT;
    const cmdProcResult = {}; // Not directly used by this strategy beyond being a parameter

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
      AwaitingActorDecisionState
    );
    expect(mockTurnContext.requestTransition).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `RepromptStrategy: Transition to AwaitingActorDecisionState requested successfully for actor ${mockActor.id}.`
    );
    expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
  });

  test('should throw error and log if wrong directive is provided', async () => {
    const directive = TurnDirective.END_TURN_SUCCESS; // Incorrect directive
    const cmdProcResult = {};

    await expect(
      strategy.execute(mockTurnContext, directive, cmdProcResult)
    ).rejects.toThrow(
      'RepromptStrategy: Received wrong directive (END_TURN_SUCCESS). Expected RE_PROMPT.'
    );

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getSafeEventDispatcher).toHaveBeenCalledTimes(1);
    expect(mockTurnContext._safeEventDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
    expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
  });

  test('should call turnContext.endTurn with an error if turnContext.getActor() returns null', async () => {
    mockTurnContext.getActor.mockReturnValue(null); // No actor in context

    const directive = TurnDirective.RE_PROMPT;
    const cmdProcResult = {};

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getSafeEventDispatcher).toHaveBeenCalledTimes(1);
    expect(mockTurnContext._safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message:
          'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.',
        details: { directive },
      }
    );
    expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
    expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));

    const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(
      'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.'
    );
  });

  test('should call turnContext.endTurn with an error if turnContext.requestTransition fails', async () => {
    const transitionErrorMessage = 'Failed to create new state';
    mockTurnContext.requestTransition.mockRejectedValue(
      new Error(transitionErrorMessage)
    );

    const directive = TurnDirective.RE_PROMPT;
    const cmdProcResult = {};

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
      AwaitingActorDecisionState
    );
    expect(mockTurnContext.requestTransition).toHaveBeenCalledTimes(1);

    const expectedOverallErrorMessage = `RepromptStrategy: Failed to request transition to AwaitingActorDecisionState for actor ${mockActor.id}. Error: ${transitionErrorMessage}`;
    expect(mockTurnContext.getSafeEventDispatcher).toHaveBeenCalledTimes(1);
    expect(mockTurnContext._safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message: expectedOverallErrorMessage,
        details: {
          actorId: mockActor.id,
          error: transitionErrorMessage,
          stack: expect.any(String),
        },
      }
    );

    expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(expectedOverallErrorMessage);
  });

  test('should still use context logger even if actor is null during error logging', async () => {
    mockTurnContext.getActor.mockReturnValue(null); // No actor

    const directive = TurnDirective.RE_PROMPT;
    await strategy.execute(mockTurnContext, directive, {});

    expect(mockTurnContext.getLogger).toHaveBeenCalled(); // Should be called to get the logger
    expect(mockTurnContext.getSafeEventDispatcher).toHaveBeenCalledTimes(1);
    expect(mockTurnContext._safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message:
          'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.',
        details: { directive },
      }
    );
    expect(mockTurnContext.endTurn).toHaveBeenCalled();
  });
});
