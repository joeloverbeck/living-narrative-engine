/**
 * @file Test suite for the startTurn behavior of ActorTurnHandler.
 * @see tests/turns/handlers/humanTurnHandler.startTurn.test.js
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import ActorTurnHandler from '../../../src/turns/handlers/actorTurnHandler.js';

/**
 * Creates a mock object with specified methods, which are all Jest mock functions.
 *
 * @param {string[]} methods - An array of method names to mock.
 * @returns {object} An object with mocked methods.
 */
const createMock = (methods) =>
  methods.reduce((mock, method) => {
    mock[method] = jest.fn();
    return mock;
  }, {});

describe('ActorTurnHandler', () => {
  let mockLogger;
  let mockTurnStateFactory;
  let mockCommandProcessor;
  let mockTurnEndPort;
  let mockPromptCoordinator;
  let mockCommandOutcomeInterpreter;
  let mockSafeEventDispatcher;
  let mockTurnStrategyFactory;
  let mockTurnContextBuilder;
  let mockInitialState;
  let mockActor;
  let mockTurnStrategy;
  let mockTurnContext; // <-- Added for clarity

  beforeEach(() => {
    // Reset mocks before each test
    mockLogger = createMock(['debug', 'error', 'warn', 'info']);
    mockCommandProcessor = createMock(['process']);
    mockTurnEndPort = createMock(['endTurn']);
    mockPromptCoordinator = createMock(['startPrompt']);
    mockCommandOutcomeInterpreter = createMock(['interpret']);
    mockSafeEventDispatcher = createMock(['dispatch', 'subscribe']);
    mockTurnStrategyFactory = createMock(['create']);
    mockTurnContextBuilder = createMock(['build']);

    mockInitialState = createMock([
      'startTurn',
      'getStateName',
      'enterState',
      'exitState',
    ]);
    mockTurnStateFactory = createMock(['createInitialState']);
    mockTurnStateFactory.createInitialState.mockReturnValue(mockInitialState);

    // Mock Actor
    mockActor = { id: 'player-123', name: 'Player', hasComponent: () => true };

    // --- FIX START ---
    // The TurnContext mock must be more realistic. It needs a getActor method.
    mockTurnContext = {
      name: 'MockTurnContext',
      getActor: jest.fn().mockReturnValue(mockActor),
    };

    // Mock return values for factories/builders
    mockTurnStrategy = { name: 'MockTurnStrategy' };
    mockTurnStrategyFactory.create.mockReturnValue(mockTurnStrategy);
    mockTurnContextBuilder.build.mockReturnValue(mockTurnContext); // <-- Use the more complete mock
    // --- FIX END ---
  });

  /**
   * Helper to create a ActorTurnHandler instance with all mocks.
   *
   * @returns {ActorTurnHandler}
   */
  const createInstance = () => {
    return new ActorTurnHandler({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
      commandProcessor: mockCommandProcessor,
      turnEndPort: mockTurnEndPort,
      promptCoordinator: mockPromptCoordinator,
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      safeEventDispatcher: mockSafeEventDispatcher,
      strategyFactory: mockTurnStrategyFactory,
      turnContextBuilder: mockTurnContextBuilder,
    });
  };

  describe('startTurn', () => {
    it('should call the strategy factory\'s "create" method with the actor\'s ID', async () => {
      const handler = createInstance();
      await handler.startTurn(mockActor);

      expect(mockTurnStrategyFactory.create).toHaveBeenCalledTimes(1);
      expect(mockTurnStrategyFactory.create).toHaveBeenCalledWith(mockActor.id);
    });

    it('should use the created strategy to build a turn context', async () => {
      const handler = createInstance();
      await handler.startTurn(mockActor);

      expect(mockTurnContextBuilder.build).toHaveBeenCalledTimes(1);
      const buildArgs = mockTurnContextBuilder.build.mock.calls[0][0];
      expect(buildArgs.strategy).toBe(mockTurnStrategy);
      expect(buildArgs.actor).toBe(mockActor);
    });

    it('should delegate starting the turn to the current state machine state', async () => {
      const handler = createInstance();
      await handler.startTurn(mockActor);

      expect(mockInitialState.startTurn).toHaveBeenCalledTimes(1);
      expect(mockInitialState.startTurn).toHaveBeenCalledWith(
        handler,
        mockActor
      );
    });

    it('should throw an error if the actor is invalid', async () => {
      const handler = createInstance();

      await expect(handler.startTurn(null)).rejects.toThrow(
        'entity is required and must have a valid id'
      );
      await expect(handler.startTurn({})).rejects.toThrow(
        'entity is required and must have a valid id'
      );
      await expect(handler.startTurn({ id: ' ' })).rejects.toThrow(
        'entity is required and must have a valid id'
      );
    });
  });
});
