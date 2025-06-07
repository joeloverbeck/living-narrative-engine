// src/turns/strategies/waitForTurnEndEventStrategy.test.js

import WaitForTurnEndEventStrategy from '../../../src/turns/strategies/waitForTurnEndEventStrategy.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import { AwaitingExternalTurnEndState } from '../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js'; // Mocked or actual, depending on test needs
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
    this.requestTransition = jest.fn(
      async (StateClass, constructorArgs = []) => {
        // Simulate transition success
      }
    );
    // Add other methods if they become necessary for this strategy's tests
  }

  resetAllMocks() {
    this.endTurn.mockClear();
    this.getActor.mockClear();
    this.getLogger.mockClear();
    this.requestTransition.mockClear();
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

describe('WaitForTurnEndEventStrategy', () => {
  let strategy;
  let mockLogger;
  let mockActor;
  let mockTurnContext;

  beforeEach(() => {
    strategy = new WaitForTurnEndEventStrategy();
    mockLogger = new MockLogger();
    mockActor = new MockEntity('actor-wait-123');
    mockTurnContext = new MockTurnContext(mockActor, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should correctly execute WAIT_FOR_EVENT directive and request transition', async () => {
    const directive = TurnDirective.WAIT_FOR_EVENT;
    const cmdProcResult = {};

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
      AwaitingExternalTurnEndState
    );
    expect(mockTurnContext.requestTransition).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `WaitForTurnEndEventStrategy: Transition to AwaitingExternalTurnEndState requested successfully for actor ${mockActor.id}.`
    );
    expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
  });

  test('should throw error and log if wrong directive is provided', async () => {
    const directive = TurnDirective.RE_PROMPT; // Incorrect directive
    const cmdProcResult = {};

    await expect(
      strategy.execute(mockTurnContext, directive, cmdProcResult)
    ).rejects.toThrow(
      'WaitForTurnEndEventStrategy: Received wrong directive (RE_PROMPT). Expected WAIT_FOR_EVENT.'
    );

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WaitForTurnEndEventStrategy: Received wrong directive (RE_PROMPT). Expected WAIT_FOR_EVENT.'
    );
    expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
    expect(mockTurnContext.endTurn).not.toHaveBeenCalled(); // Strategy throws, calling state handles endTurn
  });

  test('should call turnContext.endTurn with an error if turnContext.getActor() returns null', async () => {
    mockTurnContext = new MockTurnContext(null, mockLogger); // No actor in context

    const directive = TurnDirective.WAIT_FOR_EVENT;
    const cmdProcResult = {};
    const expectedErrorMsg =
      'WaitForTurnEndEventStrategy: No actor found in ITurnContext. Cannot transition to AwaitingExternalTurnEndState without an actor.';

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
    expect(mockTurnContext.requestTransition).not.toHaveBeenCalled();
    expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(expectedErrorMsg);
  });

  test('should call turnContext.endTurn if requestTransition fails', async () => {
    const transitionErrorMessage = 'Simulated transition failure';
    mockTurnContext.requestTransition.mockRejectedValueOnce(
      new Error(transitionErrorMessage)
    );

    const directive = TurnDirective.WAIT_FOR_EVENT;
    const cmdProcResult = {};
    const expectedOverallErrorMsg = `WaitForTurnEndEventStrategy: Failed to request transition to AwaitingExternalTurnEndState for actor ${mockActor.id}. Error: ${transitionErrorMessage}`;

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1); // For initial, info, and error logs
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.requestTransition).toHaveBeenCalledWith(
      AwaitingExternalTurnEndState
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedOverallErrorMsg,
      expect.any(Error)
    );
    expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(expectedOverallErrorMsg);
  });
});
