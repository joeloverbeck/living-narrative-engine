// src/turns/strategies/repromptStrategy.test.js

import RepromptStrategy from '../../../src/turns/strategies/repromptStrategy.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import { AwaitingPlayerInputState } from '../../../src/turns/states/awaitingPlayerInputState.js';
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

    this.endTurn = jest.fn();
    this.getActor = jest.fn(() => this._actor);
    this.getLogger = jest.fn(() => this._logger);
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

  test('should correctly execute RE_PROMPT directive and request transition to AwaitingPlayerInputState', async () => {
    const directive = TurnDirective.RE_PROMPT;
    const cmdProcResult = {}; // Not directly used by this strategy beyond being a parameter

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
      AwaitingPlayerInputState
    );
    expect(mockTurnContext.requestTransition).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `RepromptStrategy: Transition to AwaitingPlayerInputState requested successfully for actor ${mockActor.id}.`
    );
    expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
  });

  test('should throw error and log if wrong directive is provided', async () => {
    const directive = TurnDirective.END_TURN_SUCCESS; // Incorrect directive
    const cmdProcResult = {};

    await expect(
      strategy.execute(mockTurnContext, directive, cmdProcResult)
    ).rejects.toThrow(
      'RepromptStrategy: Received non-RE_PROMPT directive (END_TURN_SUCCESS). Aborting.'
    );

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'RepromptStrategy: Received non-RE_PROMPT directive (END_TURN_SUCCESS). Aborting.'
    );
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
    expect(mockLogger.error).toHaveBeenCalledWith(
      'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.'
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
      AwaitingPlayerInputState
    );
    expect(mockTurnContext.requestTransition).toHaveBeenCalledTimes(1);

    const expectedOverallErrorMessage = `RepromptStrategy: Failed to request transition to AwaitingPlayerInputState for actor ${mockActor.id}. Error: ${transitionErrorMessage}`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedOverallErrorMessage,
      expect.any(Error) // The original error from requestTransition
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
    expect(mockLogger.error).toHaveBeenCalledWith(
      'RepromptStrategy: No actor found in ITurnContext. Cannot re-prompt.'
    );
    expect(mockTurnContext.endTurn).toHaveBeenCalled();
  });
});
