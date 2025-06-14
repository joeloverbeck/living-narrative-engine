/**
 * @file Test suite for AITurnHandler.
 * @description These tests verify the orchestration logic of AITurnHandler, ensuring it correctly
 * uses its dependencies (factories) to start and manage an AI's turn without containing business logic itself.
 * @see tests/turns/handlers/aiTurnHandler.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AITurnHandler } from '../../../src/turns/handlers/aiTurnHandler.js';

// Create mocks for all direct dependencies of AITurnHandler.
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockTurnState = {
  enterState: jest.fn(),
  exitState: jest.fn(),
  startTurn: jest.fn(),
  getStateName: () => 'MockInitialState',
};

const mockTurnStateFactory = {
  createInitialState: jest.fn(() => mockTurnState),
  createEndingState: jest.fn(),
  createIdleState: jest.fn(),
};

const mockTurnEndPort = {
  turnEnded: jest.fn(),
};

const mockAiStrategy = {
  decideAction: jest.fn(),
};

const mockStrategyFactory = {
  create: jest.fn(() => mockAiStrategy),
};

const mockTurnContext = {
  getActor: jest.fn(),
  // Add other methods if they are called by the handler directly.
};

const mockTurnContextBuilder = {
  build: jest.fn(() => mockTurnContext),
};

const mockActor = { id: 'ai-actor-1', name: 'Test AI' };

describe('AITurnHandler', () => {
  let handler;
  const dependencies = {
    logger: mockLogger,
    turnStateFactory: mockTurnStateFactory,
    turnEndPort: mockTurnEndPort,
    strategyFactory: mockStrategyFactory,
    turnContextBuilder: mockTurnContextBuilder,
  };

  beforeEach(() => {
    // Reset mocks before each test to ensure isolation.
    jest.clearAllMocks();

    // Re-create the handler before each test
    handler = new AITurnHandler(dependencies);
  });

  describe('Constructor', () => {
    it('should throw an error if the logger dependency is missing', () => {
      const deps = { ...dependencies, logger: undefined };
      // BaseTurnHandler is responsible for this check
      expect(() => new AITurnHandler(deps)).toThrow(
        'BaseTurnHandler: logger is required.'
      );
    });

    it('should throw an error if the turnStateFactory dependency is missing', () => {
      const deps = { ...dependencies, turnStateFactory: undefined };
      // BaseTurnHandler is responsible for this check
      expect(() => new AITurnHandler(deps)).toThrow(
        'BaseTurnHandler: turnStateFactory is required.'
      );
    });

    it('should throw an error if the turnEndPort dependency is missing', () => {
      const deps = { ...dependencies, turnEndPort: undefined };
      expect(() => new AITurnHandler(deps)).toThrow(
        'GenericTurnHandler: turnEndPort is required'
      );
    });

    it('should throw an error if the strategyFactory is missing', () => {
      const deps = { ...dependencies, strategyFactory: undefined };
      expect(() => new AITurnHandler(deps)).toThrow(
        'GenericTurnHandler: strategyFactory is required'
      );
    });

    it('should throw an error if the turnContextBuilder is missing', () => {
      const deps = { ...dependencies, turnContextBuilder: undefined };
      expect(() => new AITurnHandler(deps)).toThrow(
        'GenericTurnHandler: turnContextBuilder is required'
      );
    });

    it('should create and set an initial state using the turnStateFactory', () => {
      expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledTimes(1);
      expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
        expect.any(AITurnHandler)
      );
      // Expose internal property for testing purposes.
      expect(handler._currentState).toBe(mockTurnState);
    });
  });

  describe('startTurn', () => {
    it('should throw an error if the actor is null or invalid', async () => {
      const expectedError =
        'AITurnHandler.startTurn: entity is required and must have a valid id.';
      await expect(handler.startTurn(null)).rejects.toThrow(expectedError);
      await expect(handler.startTurn({ id: ' ' })).rejects.toThrow(
        expectedError
      );
      await expect(handler.startTurn({})).rejects.toThrow(expectedError);
    });

    it('should call strategyFactory.create to get a strategy', async () => {
      // Act
      await handler.startTurn(mockActor);

      // Assert
      expect(mockStrategyFactory.create).toHaveBeenCalledTimes(1);
    });

    it('should call turnContextBuilder.build with the correct parameters', async () => {
      // Act
      await handler.startTurn(mockActor);

      // Assert
      expect(mockTurnContextBuilder.build).toHaveBeenCalledTimes(1);
      expect(mockTurnContextBuilder.build).toHaveBeenCalledWith({
        handlerInstance: handler, // FIX: Expect the handler instance itself.
        actor: mockActor,
        strategy: mockAiStrategy,
        onEndTurn: expect.any(Function),
        awaitFlagProvider: expect.any(Function),
        setAwaitFlag: expect.any(Function),
      });
    });

    it('should delegate control to the current state`s startTurn method', async () => {
      // Act
      await handler.startTurn(mockActor);

      // Assert
      expect(mockTurnState.startTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnState.startTurn).toHaveBeenCalledWith(handler, mockActor);
    });

    it('should set the internal actor and turn context references', async () => {
      // Arrange
      // Make the mock context return the actor to test getCurrentActor correctly
      jest.spyOn(mockTurnContext, 'getActor').mockReturnValue(mockActor);

      // Act
      await handler.startTurn(mockActor);

      // Assert
      expect(handler.getCurrentActor()).toBe(mockActor);
      expect(handler.getTurnContext()).toBe(mockTurnContext);
    });
  });
});
