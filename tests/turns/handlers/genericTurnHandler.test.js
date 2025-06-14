/**
 * @file This module contains tests for the GenericTurnHandler class.
 * @see src/turns/handlers/genericTurnHandler.js
 */

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { GenericTurnHandler } from '../../../src/turns/handlers/genericTurnHandler.js';

// Mock Dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogger: jest.fn(() => mockLogger), // Return self for context logging
};

const mockTurnState = {
  startTurn: jest.fn(),
  enterState: jest.fn(),
  exitState: jest.fn(),
  getStateName: jest.fn(() => 'MockState'),
  isIdle: jest.fn(() => false),
};

const mockTurnStateFactory = {
  createIdleState: jest.fn(() => ({
    ...mockTurnState,
    getStateName: () => 'IdleState',
    isIdle: () => true,
  })),
  createAwaitingExternalTurnEndState: jest.fn(() => ({
    ...mockTurnState,
    getStateName: () => 'AwaitingExternal',
  })),
  // Add other factory methods if needed for more complex tests
};

const mockTurnEndPort = {
  /* A mock object for dependency injection */
};

const mockStrategy = {
  /* A mock strategy object */
};

const mockTurnStrategyFactory = {
  create: jest.fn(() => mockStrategy),
};

const mockTurnContext = {
  getActor: jest.fn(),
  getLogger: jest.fn(() => mockLogger),
  cancelActivePrompt: jest.fn(),
};

const mockTurnContextBuilder = {
  build: jest.fn(() => mockTurnContext),
};

const mockActor = {
  id: 'player1',
  name: 'Test Actor',
};

describe('GenericTurnHandler', () => {
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    handler = new GenericTurnHandler({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
      turnEndPort: mockTurnEndPort,
      strategyFactory: mockTurnStrategyFactory,
      turnContextBuilder: mockTurnContextBuilder,
    });

    // The startTurn method requires a non-null _currentState.
    // In a real scenario, a concrete handler implementation would set an initial state.
    // We simulate this using the protected _setInitialState method for our test setup.
    handler._setInitialState(mockTurnState);
  });

  describe('Constructor', () => {
    it('should throw an error if turnEndPort is missing', () => {
      expect(
        () =>
          new GenericTurnHandler({
            logger: mockLogger,
            turnStateFactory: mockTurnStateFactory,
            strategyFactory: mockTurnStrategyFactory,
            turnContextBuilder: mockTurnContextBuilder,
          })
      ).toThrow('GenericTurnHandler: turnEndPort is required');
    });

    it('should throw an error if strategyFactory is missing', () => {
      expect(
        () =>
          new GenericTurnHandler({
            logger: mockLogger,
            turnStateFactory: mockTurnStateFactory,
            turnEndPort: mockTurnEndPort,
            turnContextBuilder: mockTurnContextBuilder,
          })
      ).toThrow('GenericTurnHandler: strategyFactory is required');
    });

    it('should throw an error if turnContextBuilder is missing', () => {
      expect(
        () =>
          new GenericTurnHandler({
            logger: mockLogger,
            turnStateFactory: mockTurnStateFactory,
            turnEndPort: mockTurnEndPort,
            strategyFactory: mockTurnStrategyFactory,
          })
      ).toThrow('GenericTurnHandler: turnContextBuilder is required');
    });
  });

  describe('startTurn and Context Creation', () => {
    it('should throw an error if the actor is invalid', async () => {
      await expect(handler.startTurn(null)).rejects.toThrow(
        'entity is required and must have a valid id'
      );
      await expect(handler.startTurn({})).rejects.toThrow(
        'entity is required and must have a valid id'
      );
      await expect(handler.startTurn({ id: '   ' })).rejects.toThrow(
        'entity is required and must have a valid id'
      );
    });

    it('should use the common context creation path', async () => {
      await handler.startTurn(mockActor);

      // 1. Verify a strategy is created for the actor
      expect(mockTurnStrategyFactory.create).toHaveBeenCalledWith(mockActor.id);
      expect(mockTurnStrategyFactory.create).toHaveBeenCalledTimes(1);

      // 2. Verify the turn context builder was used to create the context
      expect(mockTurnContextBuilder.build).toHaveBeenCalledTimes(1);

      // 3. Verify the newly created turn context was set internally
      expect(handler.getTurnContext()).toBe(mockTurnContext);

      // 4. Verify the turn is started on the current state object
      expect(mockTurnState.startTurn).toHaveBeenCalledWith(handler, mockActor);
      expect(mockTurnState.startTurn).toHaveBeenCalledTimes(1);
    });

    it('should pass the correct parameters to TurnContextBuilder.build', async () => {
      await handler.startTurn(mockActor);

      // Verify that the builder receives all necessary components
      expect(mockTurnContextBuilder.build).toHaveBeenCalledWith({
        handlerInstance: handler, // FIX: Expect the handler instance itself.
        actor: mockActor,
        strategy: mockStrategy,
        onEndTurn: expect.any(Function), // Callback to handle turn termination
        awaitFlagProvider: expect.any(Function), // Callback to check the await state
        setAwaitFlag: expect.any(Function), // Callback to modify the await state
      });
    });
  });

  describe('Await-Flag Management', () => {
    let setAwaitFlag;
    let awaitFlagProvider;

    beforeEach(async () => {
      // To test the flag functions, we capture them from the `build` call.
      // This simulates how the TurnContext would receive and use them.
      mockTurnContextBuilder.build.mockImplementation((params) => {
        setAwaitFlag = params.setAwaitFlag;
        awaitFlagProvider = params.awaitFlagProvider;
        return mockTurnContext;
      });

      // Execute startTurn to trigger the build and capture the callbacks
      await handler.startTurn(mockActor);
    });

    it('should provide callbacks to the turn context builder', () => {
      expect(setAwaitFlag).toBeInstanceOf(Function);
      expect(awaitFlagProvider).toBeInstanceOf(Function);
    });

    it('should have the await-flag initially be idle (false)', () => {
      // The `awaitFlagProvider` is a bound call to `_getIsAwaitingExternalTurnEndFlag`
      expect(awaitFlagProvider()).toBe(false);
    });

    it('should flip the await-flag to waiting (true) when setAwaitFlag is called', () => {
      // The `setAwaitFlag` is a bound call to `_markAwaitingTurnEnd`
      setAwaitFlag(true, 'player1');
      expect(awaitFlagProvider()).toBe(true);
    });

    it('should flip the await-flag back to idle (false) when called with false', () => {
      // Set to true first
      setAwaitFlag(true, 'player1');
      expect(awaitFlagProvider()).toBe(true);

      // Then set back to false
      setAwaitFlag(false);
      expect(awaitFlagProvider()).toBe(false);
    });

    it('should log the state change when flipping the await-flag', () => {
      mockLogger.debug.mockClear();

      setAwaitFlag(true, 'player1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "GenericTurnHandler._markAwaitingTurnEnd: State: Idle → State: Waiting for Actor 'player1'"
      );

      mockLogger.debug.mockClear();

      setAwaitFlag(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "GenericTurnHandler._markAwaitingTurnEnd: State: Waiting for Actor 'player1' → State: Idle"
      );
    });

    it('_resetTurnStateAndResources should reset a waiting await-flag', () => {
      // Arrange: set the flag to waiting
      setAwaitFlag(true, 'player1');
      expect(awaitFlagProvider()).toBe(true);

      // Act: call the reset method (it's protected, but we can call for testing)
      handler._resetTurnStateAndResources('test-context');

      // Assert: flag should be reset to false
      expect(awaitFlagProvider()).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "GenericTurnHandler: Clearing turn-end waiting state (was State: Waiting for Actor 'player1')."
      );
    });
  });
});
