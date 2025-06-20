// src/turns/strategies/endTurnSuccessStrategy.test.js

import EndTurnSuccessStrategy from '../../../../src/turns/strategies/endTurnSuccessStrategy.js';
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
// Assuming ITurnContext is an interface/abstract class, we'll mock it.
// Similarly for Entity and ILogger.

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
    this._logger = logger || new MockLogger(); // Ensure logger is always an object with jest.fn()

    this.endTurn = jest.fn();
    this.getActor = jest.fn(() => this._actor);
    this.getLogger = jest.fn(() => this._logger);
  }

  // Helper to reset mocks for this context instance between tests if needed directly
  resetAllMocks() {
    this.endTurn.mockClear();
    this.getActor.mockClear();
    this.getLogger.mockClear();
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

describe('EndTurnSuccessStrategy', () => {
  let strategy;
  let mockLogger;
  let mockActor;
  let mockTurnContext;

  beforeEach(() => {
    strategy = new EndTurnSuccessStrategy();
    mockLogger = new MockLogger();
    mockActor = new MockEntity('actor-123');
    // Default setup for mockTurnContext, can be overridden in specific tests
    mockTurnContext = new MockTurnContext(mockActor, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should correctly execute END_TURN_SUCCESS directive', async () => {
    const directive = TurnDirective.END_TURN_SUCCESS;
    const cmdProcResult = {}; // Not used by this strategy on success

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `EndTurnSuccessStrategy: Executing END_TURN_SUCCESS for actor ${mockActor.id}.`
    );
    expect(mockTurnContext.endTurn).toHaveBeenCalledWith(null);
    expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
  });

  test('should throw error and log if wrong directive is provided', async () => {
    const directive = TurnDirective.RE_PROMPT; // Incorrect directive
    const cmdProcResult = {};

    await expect(
      strategy.execute(mockTurnContext, directive, cmdProcResult)
    ).rejects.toThrow(
      'EndTurnSuccessStrategy: Received wrong directive (RE_PROMPT). Expected END_TURN_SUCCESS.'
    );

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'EndTurnSuccessStrategy: Received wrong directive (RE_PROMPT). Expected END_TURN_SUCCESS.'
    );
    expect(mockTurnContext.endTurn).not.toHaveBeenCalled(); // Strategy throws, calling state handles endTurn
  });

  test('should call turnContext.endTurn with an error if turnContext.getActor() returns null', async () => {
    // Configure mockTurnContext for this specific test case
    mockTurnContext = new MockTurnContext(null, mockLogger); // No actor in context

    const directive = TurnDirective.END_TURN_SUCCESS;
    const cmdProcResult = {};

    await strategy.execute(mockTurnContext, directive, cmdProcResult);

    expect(mockTurnContext.getLogger).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.getActor).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'EndTurnSuccessStrategy: No actor found in ITurnContext for END_TURN_SUCCESS. Cannot end turn.'
    );
    expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
    expect(mockTurnContext.endTurn).toHaveBeenCalledWith(
      expect.any(Error) // Check that it's an error object
    );
    // Optionally, check the error message
    const errorArg = mockTurnContext.endTurn.mock.calls[0][0];
    expect(errorArg.message).toBe(
      'EndTurnSuccessStrategy: No actor found in ITurnContext for END_TURN_SUCCESS. Cannot end turn.'
    );
  });

  test('should still use context logger even if actor is null', async () => {
    mockTurnContext = new MockTurnContext(null, mockLogger); // No actor

    const directive = TurnDirective.END_TURN_SUCCESS;
    await strategy.execute(mockTurnContext, directive, {});

    expect(mockTurnContext.getLogger).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled(); // It will log an error about missing actor
    expect(mockTurnContext.endTurn).toHaveBeenCalled();
  });
});
