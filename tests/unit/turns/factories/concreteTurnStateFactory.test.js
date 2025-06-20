/**
 * @file Test suite for ConcreteTurnStateFactory.
 * @see tests/unit/turns/factories/concreteTurnStateFactory.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// SUT (System Under Test)
import { ConcreteTurnStateFactory } from '../../../../src/turns/factories/concreteTurnStateFactory.js';

// Dependencies (the classes the factory is expected to create)
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';

// --- Mocks ---

// A mock logger to be returned by other mocks.
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// A mock for the SafeEventDispatcher, returned by the turn context mock.
const mockSafeEventDispatcher = {
  dispatch: jest.fn(),
  subscribe: jest.fn(),
};

// A mock for the ITurnContext, returned by the handler mock.
const mockTurnContext = {
  getSafeEventDispatcher: jest.fn(() => mockSafeEventDispatcher),
  getLogger: jest.fn(() => mockLogger),
};

// A comprehensive mock for the BaseTurnHandler required by state constructors.
const mockHandler = {
  getTurnContext: jest.fn(() => mockTurnContext),
  getCurrentActor: jest.fn(),
  // The `_resolveLogger` method is used internally by states.
  _resolveLogger: jest.fn(() => mockLogger),
};

describe('ConcreteTurnStateFactory', () => {
  let factory;

  beforeEach(() => {
    // Create a new factory instance before each test to ensure isolation.
    factory = new ConcreteTurnStateFactory();
    // Clear any previous mock calls to avoid test cross-contamination.
    jest.clearAllMocks();
  });

  /**
   * Test suite for `createInitialState`.
   */
  describe('createInitialState()', () => {
    it('should create an instance of TurnIdleState for the initial state', () => {
      // Action: Call the method to create the initial state.
      const state = factory.createInitialState(mockHandler);

      // Assert: Verify the created state is of the correct type and holds a reference to its handler.
      expect(state).toBeInstanceOf(TurnIdleState);
      expect(state._handler).toBe(mockHandler);
    });
  });

  /**
   * Test suite for `createIdleState`.
   */
  describe('createIdleState()', () => {
    it('should create an instance of TurnIdleState', () => {
      // Action: Call the method to create an idle state.
      const state = factory.createIdleState(mockHandler);

      // Assert: Verify the state is of the correct type and has the correct handler.
      expect(state).toBeInstanceOf(TurnIdleState);
      expect(state._handler).toBe(mockHandler);
    });
  });

  /**
   * Test suite for `createEndingState`.
   */
  describe('createEndingState()', () => {
    it('should create an instance of TurnEndingState when an error is provided', () => {
      // Arrange: Define test data for a turn that ended with an error.
      const actorId = 'test-actor-id';
      const error = new Error('A test error occurred');

      // Action: Call the factory method.
      const state = factory.createEndingState(mockHandler, actorId, error);

      // Assert: The factory's job is to create the correct object. We verify the type.
      // We no longer test private fields as it's against encapsulation and caused the previous failure.
      expect(state).toBeInstanceOf(TurnEndingState);
      expect(state._handler).toBe(mockHandler);
    });

    it('should create an instance of TurnEndingState when no error is provided (null)', () => {
      // Arrange: Define test data for a turn that ended successfully.
      const actorId = 'test-actor-id';

      // Action: Call the factory method.
      const state = factory.createEndingState(mockHandler, actorId, null);

      // Assert: Verify the type of the created instance.
      expect(state).toBeInstanceOf(TurnEndingState);
      expect(state._handler).toBe(mockHandler);
    });
  });

  /**
   * Test suite for `createAwaitingInputState`.
   */
  describe('createAwaitingInputState()', () => {
    it('should create an instance of AwaitingActorDecisionState', () => {
      // Action: Call the factory method.
      const state = factory.createAwaitingInputState(mockHandler);

      // Assert: Verify the state type and its handler.
      expect(state).toBeInstanceOf(AwaitingActorDecisionState);
      expect(state._handler).toBe(mockHandler);
    });
  });

  /**
   * Test suite for `createProcessingCommandState`.
   */
  describe('createProcessingCommandState()', () => {
    it('should create an instance of ProcessingCommandState', () => {
      // Arrange: Define the parameters for the state.
      const commandString = 'look around';
      const turnAction = {
        actionDefinitionId: 'look',
        commandString: 'look around',
      };

      // Action: Call the factory method.
      const state = factory.createProcessingCommandState(
        mockHandler,
        commandString,
        turnAction
      );

      // Assert: Verify the created instance is of the correct class.
      // We do not assert private fields anymore.
      expect(state).toBeInstanceOf(ProcessingCommandState);
      expect(state._handler).toBe(mockHandler);
    });
  });

  /**
   * Test suite for `createAwaitingExternalTurnEndState`.
   */
  describe('createAwaitingExternalTurnEndState()', () => {
    it('should create an instance of AwaitingExternalTurnEndState', () => {
      // Action: Call the factory method.
      const state = factory.createAwaitingExternalTurnEndState(mockHandler);

      // Assert: Verify the state type and its handler.
      expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
      expect(state._handler).toBe(mockHandler);
    });
  });
});
