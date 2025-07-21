/**
 * @file Test suite for ActorTurnHandler
 * @see src/turns/handlers/actorTurnHandler.js
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import ActorTurnHandler from '../../../../src/turns/handlers/actorTurnHandler.js';
import { ActorMismatchError } from '../../../../src/errors/actorMismatchError.js';

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
  let mockTurnEndPort;
  let mockTurnStrategyFactory;
  let mockStrategyFactory;
  let mockTurnContextBuilder;
  let mockContainer;
  let mockInitialState;
  let mockActor;
  let mockTurnContext;
  let handler;

  beforeEach(() => {
    // Reset mocks before each test
    mockLogger = createMock(['debug', 'error', 'warn', 'info']);
    mockTurnStateFactory = createMock(['createInitialState']);
    mockTurnEndPort = createMock(['endTurn']);
    mockTurnStrategyFactory = createMock(['create']);
    mockStrategyFactory = createMock(['create']);
    mockTurnContextBuilder = createMock(['build']);
    mockContainer = createMock(['resolve']);

    mockInitialState = createMock([
      'getStateName',
      'enterState',
      'handleSubmittedCommand',
      'handleTurnEndedEvent',
      'startTurn',
    ]);
    mockInitialState.getStateName.mockReturnValue('InitialState');

    mockActor = { id: 'test-actor-123', type: 'actor' };

    mockTurnContext = createMock([
      'getActor',
      'endTurn',
      'getLogger',
      'getSafeEventDispatcher',
    ]);
    mockTurnContext.getActor.mockReturnValue(mockActor);

    mockTurnStateFactory.createInitialState.mockReturnValue(mockInitialState);
  });

  describe('constructor', () => {
    it('should initialize with turnStrategyFactory', () => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
        container: mockContainer,
      });

      expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
        handler
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler initialised. Dependencies assigned. Initial state set.'
      );
    });

    it('should initialize with legacy strategyFactory parameter', () => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        strategyFactory: mockStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
        handler
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler initialised. Dependencies assigned. Initial state set.'
      );
    });

    it('should initialize without container (optional parameter)', () => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      expect(mockTurnStateFactory.createInitialState).toHaveBeenCalledWith(
        handler
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler initialised. Dependencies assigned. Initial state set.'
      );
    });
  });

  describe('_resetTurnStateAndResources', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      // Mock the parent class method
      handler._resetAwaitTurnEndFlags = jest.fn();
      handler._currentActor = null;
      handler._currentTurnContext = null;
    });

    it('should reset state with provided actorIdContextForLog', () => {
      const actorId = 'test-actor-456';
      handler._resetTurnStateAndResources(actorId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ActorTurnHandler._resetTurnStateAndResources specific cleanup for '${actorId}'.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `ActorTurnHandler: Actor-specific state reset complete for '${actorId}'.`
      );
    });

    it('should use default parameter value when no argument provided', () => {
      handler.getCurrentActor = jest
        .fn()
        .mockReturnValue({ id: 'current-actor-789' });
      handler._resetTurnStateAndResources();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ActorTurnHandler._resetTurnStateAndResources specific cleanup for 'N/A'."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ActorTurnHandler: Actor-specific state reset complete for 'N/A'."
      );
    });

    it('should use getCurrentActor when actorIdContextForLog is null', () => {
      handler.getCurrentActor = jest
        .fn()
        .mockReturnValue({ id: 'current-actor-789' });
      handler._resetTurnStateAndResources(null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ActorTurnHandler._resetTurnStateAndResources specific cleanup for 'current-actor-789'."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ActorTurnHandler: Actor-specific state reset complete for 'current-actor-789'."
      );
    });

    it('should use ATH-reset default when getCurrentActor returns null and param is null', () => {
      handler.getCurrentActor = jest.fn().mockReturnValue(null);
      handler._resetTurnStateAndResources(null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ActorTurnHandler._resetTurnStateAndResources specific cleanup for 'ATH-reset'."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ActorTurnHandler: Actor-specific state reset complete for 'ATH-reset'."
      );
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      handler._currentState = mockInitialState;
      handler._isDestroyed = false;
      handler._isDestroying = false;
    });

    it('should destroy handler successfully', async () => {
      await handler.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler.destroy() invoked. Current state: InitialState'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler.destroy() cleanup complete.'
      );
    });

    it('should skip destruction if already destroyed', async () => {
      handler._isDestroyed = true;

      await handler.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler.destroy() called but already destroyed.'
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'ActorTurnHandler.destroy() cleanup complete.'
      );
    });

    it('should handle null current state during destruction', async () => {
      handler._currentState = null;

      await handler.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler.destroy() invoked. Current state: undefined'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler.destroy() cleanup complete.'
      );
    });
  });

  describe('signalNormalApparentTermination', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });
    });

    it('should log normal termination signal', () => {
      handler.signalNormalApparentTermination();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActorTurnHandler: Normal apparent termination signaled.'
      );
    });
  });

  describe('_ensureActorAndContextMatch', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      handler.getTurnContext = jest.fn();
      handler._assertValidActor = jest.fn();
    });

    it('should throw ActorMismatchError when actor is invalid', () => {
      handler._assertValidActor.mockImplementation(() => {
        throw new Error('Invalid actor');
      });
      handler.getTurnContext.mockReturnValue(mockTurnContext);

      expect(() => handler._ensureActorAndContextMatch(null)).toThrow(
        ActorMismatchError
      );
      expect(() => handler._ensureActorAndContextMatch(null)).toThrow(
        'A valid actor must be provided to handle a command.'
      );
    });

    it('should throw ActorMismatchError with Unknown expectedActorId when context is null', () => {
      handler._assertValidActor.mockImplementation(() => {
        throw new Error('Invalid actor');
      });
      handler.getTurnContext.mockReturnValue(null);

      try {
        handler._ensureActorAndContextMatch(null);
      } catch (error) {
        expect(error).toBeInstanceOf(ActorMismatchError);
        expect(error.expectedActorId).toBe('Unknown');
        expect(error.actualActorId).toBe(null);
        expect(error.operation).toBe('handleSubmittedCommand');
      }
    });

    it('should throw ActorMismatchError when no active turn context', () => {
      handler.getTurnContext.mockReturnValue(null);
      const testActor = { id: 'test-actor' };

      expect(() => handler._ensureActorAndContextMatch(testActor)).toThrow(
        ActorMismatchError
      );
      expect(() => handler._ensureActorAndContextMatch(testActor)).toThrow(
        "Cannot handle command for actor 'test-actor'; no active turn context."
      );
    });

    it('should throw ActorMismatchError when actor IDs do not match', () => {
      const contextActor = { id: 'expected-actor' };
      const providedActor = { id: 'different-actor' };

      mockTurnContext.getActor.mockReturnValue(contextActor);
      handler.getTurnContext.mockReturnValue(mockTurnContext);

      expect(() => handler._ensureActorAndContextMatch(providedActor)).toThrow(
        ActorMismatchError
      );
      expect(() => handler._ensureActorAndContextMatch(providedActor)).toThrow(
        "Actor mismatch: command for 'different-actor' but current context is for 'expected-actor'."
      );
    });

    it('should return context when validation passes', () => {
      mockTurnContext.getActor.mockReturnValue(mockActor);
      handler.getTurnContext.mockReturnValue(mockTurnContext);

      const result = handler._ensureActorAndContextMatch(mockActor);

      expect(result).toBe(mockTurnContext);
      expect(handler._assertValidActor).toHaveBeenCalledWith(
        mockActor,
        'handleSubmittedCommand'
      );
    });
  });

  describe('handleSubmittedCommand', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      handler._currentState = mockInitialState;
      handler.getTurnContext = jest.fn().mockReturnValue(mockTurnContext);
      handler._assertHandlerActive = jest.fn();
      handler._ensureActorAndContextMatch = jest
        .fn()
        .mockReturnValue(mockTurnContext);
      handler._handleTurnEnd = jest.fn();
    });

    it('should handle command when state can process it', async () => {
      const commandString = 'test command';

      await handler.handleSubmittedCommand(commandString, mockActor);

      expect(handler._assertHandlerActive).toHaveBeenCalled();
      expect(handler._ensureActorAndContextMatch).toHaveBeenCalledWith(
        mockActor
      );
      expect(mockInitialState.handleSubmittedCommand).toHaveBeenCalledWith(
        handler,
        commandString,
        mockActor
      );
    });

    it('should handle ActorMismatchError and end turn with context', async () => {
      const mismatchError = new ActorMismatchError('Test mismatch', {
        expectedActorId: 'expected-id',
        actualActorId: 'actual-id',
        operation: 'test-op',
      });

      handler._ensureActorAndContextMatch.mockImplementation(() => {
        throw mismatchError;
      });

      await handler.handleSubmittedCommand('command', mockActor);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActorTurnHandler: Test mismatch',
        {
          expectedId: 'expected-id',
          actualId: 'actual-id',
          name: 'ActorMismatchError',
        }
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(mismatchError);
      expect(handler._handleTurnEnd).not.toHaveBeenCalled();
    });

    it('should handle ActorMismatchError and use _handleTurnEnd when no context', async () => {
      const mismatchError = new ActorMismatchError('Test mismatch');

      handler._ensureActorAndContextMatch.mockImplementation(() => {
        throw mismatchError;
      });
      handler.getTurnContext.mockReturnValue(null);

      await handler.handleSubmittedCommand('command', mockActor);

      expect(handler._handleTurnEnd).toHaveBeenCalledWith(
        mockActor.id,
        mismatchError
      );
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
    });

    it('should end turn when current state cannot handle command', async () => {
      handler._currentState = {
        getStateName: jest.fn().mockReturnValue('BadState'),
      };

      await handler.handleSubmittedCommand('command', mockActor);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActorTurnHandler: handleSubmittedCommand called, but current state BadState cannot handle it.'
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle null current state', async () => {
      handler._currentState = null;

      await handler.handleSubmittedCommand('command', mockActor);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActorTurnHandler: handleSubmittedCommand called, but current state undefined cannot handle it.'
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('_ensureStateCanHandleTurnEndEvent', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });
    });

    it('should throw error when current state is null', () => {
      handler._currentState = null;

      expect(() => handler._ensureStateCanHandleTurnEndEvent()).toThrow(
        'Current state undefined cannot handle turn ended event.'
      );
    });

    it('should throw error when state lacks handleTurnEndedEvent method', () => {
      handler._currentState = {
        getStateName: jest.fn().mockReturnValue('IncompleteState'),
      };

      expect(() => handler._ensureStateCanHandleTurnEndEvent()).toThrow(
        'Current state IncompleteState cannot handle turn ended event.'
      );
    });

    it('should not throw when state can handle turn end event', () => {
      handler._currentState = mockInitialState;

      expect(() => handler._ensureStateCanHandleTurnEndEvent()).not.toThrow();
    });
  });

  describe('handleTurnEndedEvent', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });

      handler._currentState = mockInitialState;
      handler.getTurnContext = jest.fn().mockReturnValue(mockTurnContext);
      handler._assertHandlerActive = jest.fn();
      handler._resetAwaitTurnEndFlags = jest.fn();
      handler._ensureStateCanHandleTurnEndEvent = jest.fn();
    });

    it('should handle turn ended event with active context', async () => {
      const payload = { payload: { entityId: 'test-entity' } };

      await handler.handleTurnEndedEvent(payload);

      expect(handler._assertHandlerActive).toHaveBeenCalled();
      expect(handler._ensureStateCanHandleTurnEndEvent).toHaveBeenCalled();
      expect(mockInitialState.handleTurnEndedEvent).toHaveBeenCalledWith(
        handler,
        { entityId: 'test-entity' }
      );
    });

    it('should handle turn ended event without active context', async () => {
      handler.getTurnContext.mockReturnValue(null);
      const payload = { payload: { entityId: 'test-entity' } };

      await handler.handleTurnEndedEvent(payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActorTurnHandler: handleTurnEndedEvent received without an active turn context. This is usually a safe, recoverable condition. Event for entity: test-entity'
      );
      expect(handler._resetAwaitTurnEndFlags).toHaveBeenCalled();
      expect(mockInitialState.handleTurnEndedEvent).toHaveBeenCalledWith(
        handler,
        { entityId: 'test-entity' }
      );
    });

    it('should handle missing entityId in payload', async () => {
      handler.getTurnContext.mockReturnValue(null);
      const payload = { payload: {} };

      await handler.handleTurnEndedEvent(payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActorTurnHandler: handleTurnEndedEvent received without an active turn context. This is usually a safe, recoverable condition. Event for entity: N/A'
      );
    });

    it('should handle error during state delegation', async () => {
      const error = new Error('State delegation failed');
      handler._ensureStateCanHandleTurnEndEvent.mockImplementation(() => {
        throw error;
      });

      const payload = { payload: { entityId: 'test-entity' } };

      await handler.handleTurnEndedEvent(payload);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "ActorTurnHandler: Error while delegating 'handleTurnEndedEvent' to state 'InitialState': State delegation failed",
        { error }
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(error);
    });

    it('should not delegate to state when no context and state lacks method', async () => {
      handler.getTurnContext.mockReturnValue(null);
      handler._currentState = {
        getStateName: jest.fn().mockReturnValue('BadState'),
      };

      const payload = { payload: { entityId: 'test-entity' } };

      await handler.handleTurnEndedEvent(payload);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(handler._resetAwaitTurnEndFlags).toHaveBeenCalled();
      // Should not throw error since state delegation is skipped
    });
  });

  describe('inherited methods', () => {
    beforeEach(() => {
      handler = new ActorTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
        turnEndPort: mockTurnEndPort,
        turnStrategyFactory: mockTurnStrategyFactory,
        turnContextBuilder: mockTurnContextBuilder,
      });
    });

    it('should call parent startTurn', async () => {
      // Setup required methods and state
      handler._assertHandlerActive = jest.fn();
      handler._assertValidActor = jest.fn();
      handler._currentState = mockInitialState;
      handler._currentTurnContext = mockTurnContext;

      // Mock the strategy factory to return a mock strategy
      const mockStrategy = createMock(['getAction']);
      mockTurnStrategyFactory.create.mockReturnValue(mockStrategy);

      // Mock turn context builder
      mockTurnContextBuilder.build.mockReturnValue(mockTurnContext);

      await handler.startTurn(mockActor);

      expect(handler._assertHandlerActive).toHaveBeenCalled();
      expect(handler._assertValidActor).toHaveBeenCalledWith(
        mockActor,
        'startTurn'
      );
      expect(mockTurnStrategyFactory.create).toHaveBeenCalledWith(mockActor.id);
    });

    it('should call parent onEnterState', async () => {
      const currentState = createMock(['getStateName']);
      currentState.getStateName.mockReturnValue('CurrentState');
      const previousState = createMock(['getStateName']);
      previousState.getStateName.mockReturnValue('PreviousState');

      await handler.onEnterState(currentState, previousState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('onEnterState')
      );
    });

    it('should call parent onExitState', async () => {
      const currentState = createMock(['getStateName']);
      currentState.getStateName.mockReturnValue('CurrentState');
      const nextState = createMock(['getStateName']);
      nextState.getStateName.mockReturnValue('NextState');

      await handler.onExitState(currentState, nextState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('onExitState')
      );
    });
  });
});
