/**
 * @file Unit tests for the GenericTurnHandler class.
 * @see src/turns/handlers/genericTurnHandler.test.js
 */

import { jest, describe, beforeEach, expect } from '@jest/globals';

import { GenericTurnHandler } from '../../../src/turns/handlers/genericTurnHandler.js';
import { TurnContextBuilder } from '../../../src/turns/builders/turnContextBuilder.js';
import { BaseTurnHandler } from '../../../src/turns/handlers/baseTurnHandler.js';

// Mock dependencies using Jest
jest.mock('../../../src/turns/builders/turnContextBuilder.js');

// Minimal mocks for other dependencies
const mockLogger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
const mockTurnStateFactory = { createIdleState: jest.fn() };
const mockTurnEndPort = { signalTurnEnd: jest.fn() };
const mockStrategyFactory = {
  create: jest.fn().mockReturnValue({ name: 'dummyStrategy' }),
};
const mockCurrentState = { startTurn: jest.fn().mockResolvedValue(undefined) };
const mockTurnContext = {
  getLogger: () => mockLogger,
  getActor: () => ({ id: 'actor-123' }),
};

/**
 * A concrete, testable version of the abstract GenericTurnHandler.
 */
class TestableGenericTurnHandler extends GenericTurnHandler {
  constructor(deps) {
    super(deps);
    // Pre-set a valid state to avoid errors related to initial state handling.
    this._currentState = mockCurrentState;
  }
}

describe('GenericTurnHandler', () => {
  let mockTurnContextBuilderInstance;

  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();

    // After jest.mock(), TurnContextBuilder is a mock constructor.
    // We can access the instance it creates.
    // We call the constructor so we can get an instance to pass to our handler.
    mockTurnContextBuilderInstance = new TurnContextBuilder();
    // We also mock the 'build' method on this specific instance.
    mockTurnContextBuilderInstance.build.mockReturnValue(mockTurnContext);
  });

  describe('startTurn', () => {
    it('should pass its own instance as "handlerInstance" to the TurnContextBuilder', async () => {
      // Arrange
      const handler = new TestableGenericTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        strategyFactory: mockStrategyFactory,
        turnContextBuilder: mockTurnContextBuilderInstance,
      });

      const actor = { id: 'actor-123' };

      // Act: Call the method under test
      await handler.startTurn(actor);

      // Assert
      // 1. Ensure the builder's 'build' method was called exactly once.
      expect(mockTurnContextBuilderInstance.build).toHaveBeenCalledTimes(1);

      // 2. Retrieve the arguments passed to the 'build' method.
      const buildArgs = mockTurnContextBuilderInstance.build.mock.calls[0][0];

      // 3. Verify the arguments object is well-formed and contains the fix.
      expect(buildArgs).toBeDefined();
      expect(buildArgs).toBeInstanceOf(Object);

      // 4. This is the primary assertion that validates the fix.
      expect(buildArgs).toHaveProperty('handlerInstance');
      expect(buildArgs.handlerInstance).toBe(handler); // It must be the handler instance itself.
      expect(buildArgs.handlerInstance).toBeInstanceOf(BaseTurnHandler); // Verify correct type

      // 5. Sanity-check other properties to ensure correctness.
      expect(buildArgs.actor).toBe(actor);
      expect(buildArgs).toHaveProperty('strategy');
      expect(buildArgs).toHaveProperty('onEndTurn');
      expect(typeof buildArgs.onEndTurn).toBe('function');
    });

    it('should call startTurn on the current state after creating the context', async () => {
      // Arrange
      const handler = new TestableGenericTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        strategyFactory: mockStrategyFactory,
        turnContextBuilder: mockTurnContextBuilderInstance,
      });

      const actor = { id: 'actor-123' };

      // Act
      await handler.startTurn(actor);

      // Assert
      expect(mockCurrentState.startTurn).toHaveBeenCalledTimes(1);
      // Ensure it's called with the correct handler context and actor
      expect(mockCurrentState.startTurn).toHaveBeenCalledWith(handler, actor);
    });
  });
});
