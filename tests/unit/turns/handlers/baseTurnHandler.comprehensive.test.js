/**
 * @file Comprehensive unit tests for BaseTurnHandler to achieve maximum coverage
 * This file targets uncovered lines and branches to bring coverage close to 100%
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  createChild: jest.fn(() => mockLogger),
};

const mockTurnStateFactory = {
  createIdleState: jest.fn(),
  createEndingState: jest.fn(),
  createAwaitingInputState: jest.fn(),
  createProcessingCommandState: jest.fn(),
  createAwaitingExternalTurnEndState: jest.fn(),
};

const createMockTurnContext = () => ({
  getLogger: jest.fn(() => mockLogger),
  getActor: jest.fn(() => ({ id: 'test-actor' })),
  getSafeEventDispatcher: jest.fn(() => ({ dispatch: jest.fn() })),
  cancelActivePrompt: jest.fn(),
});

const mockTurnAction = {
  commandString: 'test command',
  actionDefinitionId: 'test:action',
  resolvedParameters: {},
};

// Test handler implementation
class TestHandler extends BaseTurnHandler {
  constructor(opts = {}) {
    super({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
      ...opts,
    });
    this._setInitialState(mockTurnStateFactory.createIdleState(this));
  }

  async startTurn() {
    this._assertHandlerActive();
    return 'started';
  }

  getTurnEndPort() {
    return { notifyTurnEnded: jest.fn() };
  }

  // Helper methods for testing
  _exposeSetCurrentActor(actor) {
    return this._setCurrentActorInternal(actor);
  }

  _exposeSetCurrentTurnContext(context) {
    return this._setCurrentTurnContextInternal(context);
  }

  _exposeTransitionToState(state) {
    return this._transitionToState(state);
  }

  _exposeResetTurnStateAndResources(context) {
    return this._resetTurnStateAndResources(context);
  }

  _exposeHandleTurnEnd(actorId, error, fromDestroy) {
    return this._handleTurnEnd(actorId, error, fromDestroy);
  }

  _setTestCurrentState(state) {
    this._currentState = state;
  }
}

describe('BaseTurnHandler Comprehensive Coverage Tests', () => {
  let handler;
  let mockState;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock state factory
    mockTurnStateFactory.createIdleState.mockImplementation((h) => {
      const state = new TurnIdleState(h);
      jest.spyOn(state, 'enterState').mockResolvedValue(undefined);
      jest.spyOn(state, 'exitState').mockResolvedValue(undefined);
      return state;
    });

    mockTurnStateFactory.createEndingState.mockImplementation(
      (h, actorId, error) => {
        const state = new TurnEndingState(h, actorId, error);
        jest.spyOn(state, 'enterState').mockResolvedValue(undefined);
        jest.spyOn(state, 'exitState').mockResolvedValue(undefined);
        return state;
      }
    );

    mockTurnStateFactory.createAwaitingInputState.mockImplementation((h) => {
      const state = {
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        getStateName: () => 'MockAwaitingInputState',
        isIdle: jest.fn().mockReturnValue(false),
        isEnding: jest.fn().mockReturnValue(false),
      };
      return state;
    });

    mockTurnStateFactory.createProcessingCommandState.mockImplementation(
      (h, cmd, action, resolver) => {
        const state = {
          enterState: jest.fn().mockResolvedValue(undefined),
          exitState: jest.fn().mockResolvedValue(undefined),
          getStateName: () => 'MockProcessingCommandState',
          isIdle: jest.fn().mockReturnValue(false),
          isEnding: jest.fn().mockReturnValue(false),
        };
        return state;
      }
    );

    mockTurnStateFactory.createAwaitingExternalTurnEndState.mockImplementation(
      (h) => {
        const state = {
          enterState: jest.fn().mockResolvedValue(undefined),
          exitState: jest.fn().mockResolvedValue(undefined),
          getStateName: () => 'MockAwaitingExternalTurnEndState',
          isIdle: jest.fn().mockReturnValue(false),
          isEnding: jest.fn().mockReturnValue(false),
        };
        return state;
      }
    );

    mockState = {
      enterState: jest.fn().mockResolvedValue(undefined),
      exitState: jest.fn().mockResolvedValue(undefined),
      getStateName: () => 'MockState',
      isIdle: jest.fn().mockReturnValue(false),
      isEnding: jest.fn().mockReturnValue(false),
    };

    handler = new TestHandler();
  });

  afterEach(() => {
    if (handler && !handler._isDestroyed) {
      handler.destroy();
    }
  });

  describe('getCurrentActor() method', () => {
    it('should return actor from TurnContext when available', () => {
      const actor = { id: 'context-actor' };
      const context = { getActor: jest.fn().mockReturnValue(actor) };
      handler._exposeSetCurrentTurnContext(context);

      expect(handler.getCurrentActor()).toBe(actor);
      expect(context.getActor).toHaveBeenCalled();
    });

    it('should fallback to _currentActor when TurnContext throws error', () => {
      const fallbackActor = { id: 'fallback-actor' };
      const context = {
        getActor: jest.fn().mockImplementation(() => {
          throw new Error('Context error');
        }),
      };

      handler._exposeSetCurrentActor(fallbackActor);

      // Set the context directly without triggering the internal validation
      handler._currentTurnContext = context;

      expect(handler.getCurrentActor()).toBe(fallbackActor);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error accessing actor from TurnContext')
      );
    });

    it('should return _currentActor when no TurnContext', () => {
      const actor = { id: 'direct-actor' };
      handler._exposeSetCurrentActor(actor);

      expect(handler.getCurrentActor()).toBe(actor);
    });
  });

  describe('getSafeEventDispatcher() method', () => {
    it('should return dispatcher from TurnContext when available', () => {
      const dispatcher = { dispatch: jest.fn() };
      const context = {
        getSafeEventDispatcher: jest.fn().mockReturnValue(dispatcher),
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
      };
      handler._currentTurnContext = context;

      expect(handler.getSafeEventDispatcher()).toBe(dispatcher);
      expect(context.getSafeEventDispatcher).toHaveBeenCalled();
    });

    it('should warn and return null when TurnContext getSafeEventDispatcher throws error', () => {
      const context = {
        getSafeEventDispatcher: jest.fn().mockImplementation(() => {
          throw new Error('Dispatcher error');
        }),
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
      };
      handler._currentTurnContext = context;

      expect(handler.getSafeEventDispatcher()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error accessing dispatcher from TurnContext')
      );
    });

    it('should return null when TurnContext dispatcher is invalid', () => {
      const context = {
        getSafeEventDispatcher: jest.fn().mockReturnValue({ invalid: true }),
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
      };
      handler._currentTurnContext = context;

      expect(handler.getSafeEventDispatcher()).toBeNull();
    });

    it('should return safeEventDispatcher property when available', () => {
      const dispatcher = { dispatch: jest.fn() };
      handler.safeEventDispatcher = dispatcher;

      expect(handler.getSafeEventDispatcher()).toBe(dispatcher);
    });

    it('should warn and return null when no dispatcher available', () => {
      expect(handler.getSafeEventDispatcher()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('dispatcher unavailable')
      );
    });
  });

  describe('_setCurrentActorInternal() method', () => {
    it('should warn when setting different actor while TurnContext exists', () => {
      const contextActor = { id: 'context-actor' };
      const newActor = { id: 'new-actor' };
      const context = { getActor: jest.fn().mockReturnValue(contextActor) };

      handler._exposeSetCurrentTurnContext(context);
      handler._exposeSetCurrentActor(newActor);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Handler's actor set to 'new-actor' while an active TurnContext exists for 'context-actor'"
        )
      );
    });

    it('should handle null actor gracefully', () => {
      handler._exposeSetCurrentActor(null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Setting current actor to null')
      );
    });
  });

  describe('_setCurrentTurnContextInternal() method', () => {
    it('should align _currentActor with TurnContext actor when different', () => {
      const contextActor = { id: 'context-actor' };
      const oldActor = { id: 'old-actor' };
      const context = { getActor: jest.fn().mockReturnValue(contextActor) };

      handler._exposeSetCurrentActor(oldActor);
      handler._exposeSetCurrentTurnContext(context);

      expect(handler._currentActor).toBe(contextActor);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Aligning _currentActor ('old-actor') with new TurnContext actor ('context-actor')"
        )
      );
    });

    it('should handle null context gracefully', () => {
      handler._exposeSetCurrentTurnContext(null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Setting turn context to null')
      );
    });
  });

  describe('_transitionToState() method', () => {
    it('should throw error for invalid state', async () => {
      const invalidState = { invalid: true };

      await expect(
        handler._exposeTransitionToState(invalidState)
      ).rejects.toThrow('newState must implement ITurnState');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('newState must implement ITurnState')
      );
    });

    it('should skip transition to same state when not idle', async () => {
      const state = { ...mockState, isIdle: jest.fn().mockReturnValue(false) };
      handler._setTestCurrentState(state);

      await handler._exposeTransitionToState(state);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to transition to the same state')
      );
      expect(state.enterState).not.toHaveBeenCalled();
    });

    it('should allow transition to same state when idle', async () => {
      const state = { ...mockState, isIdle: jest.fn().mockReturnValue(true) };
      handler._setTestCurrentState(state);

      await handler._exposeTransitionToState(state);

      expect(state.enterState).toHaveBeenCalled();
    });

    it('should handle exitState error gracefully', async () => {
      const oldState = {
        ...mockState,
        exitState: jest.fn().mockRejectedValue(new Error('Exit error')),
        getStateName: () => 'OldState',
      };
      const newState = { ...mockState, getStateName: () => 'NewState' };

      handler._setTestCurrentState(oldState);

      await handler._exposeTransitionToState(newState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error during OldState.exitState or onExitState hook'
        ),
        expect.any(Error)
      );
      expect(handler._currentState).toBe(newState);
    });

    it('should handle enterState error and force transition to idle', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter error')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false),
      };

      const actor = { id: 'test-actor' };
      const context = { getActor: jest.fn().mockReturnValue(actor) };
      handler._exposeSetCurrentTurnContext(context);

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error during FailingState.enterState or onEnterState hook'
        ),
        expect.any(Error)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Forcing transition to TurnIdleState due to error entering FailingState'
        )
      );
      expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(
        handler
      );
    });

    it('should handle critical failure when forced idle transition fails', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter error')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false),
      };

      // Mock the idle state factory to also fail
      const failingIdleState = {
        ...mockState,
        enterState: jest
          .fn()
          .mockRejectedValue(new Error('Idle transition failed')),
        getStateName: () => 'TurnIdleState',
        isIdle: jest.fn().mockReturnValue(true),
      };
      mockTurnStateFactory.createIdleState.mockReturnValue(failingIdleState);

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL - Failed to enter TurnIdleState even after an error'
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Forcing transition to TurnIdleState due to error entering'
        )
      );
    });

    it('should handle critical failure when entering idle state after error', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter error')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(true), // This will trigger the "already idle" error path
      };

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL - Failed to enter TurnIdleState even after an error'
        )
      );
    });
  });

  describe('_handleTurnEnd() method', () => {
    it('should warn when endedActorId differs from contextActorId', async () => {
      const contextActor = { id: 'context-actor' };
      const context = { getActor: jest.fn().mockReturnValue(contextActor) };
      handler._exposeSetCurrentTurnContext(context);

      await handler._handleTurnEnd('different-actor');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "called for actor 'different-actor', but TurnContext is for 'context-actor'"
        )
      );
    });

    it('should warn when endedActorId differs from handlerActorId when no context', async () => {
      const handlerActor = { id: 'handler-actor' };
      handler._exposeSetCurrentActor(handlerActor);

      await handler._handleTurnEnd('different-actor');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "called for actor 'different-actor', no active TurnContext, but handler's _currentActor is 'handler-actor'"
        )
      );
    });

    it('should return early when already destroyed and not from destroy', async () => {
      handler._isDestroyed = true;

      await handler._exposeHandleTurnEnd('test-actor', null, false);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('handler already destroyed')
      );
      expect(mockTurnStateFactory.createEndingState).not.toHaveBeenCalled();
    });

    it('should warn when called with error while already in ending state', async () => {
      const endingState = {
        ...mockState,
        isEnding: jest.fn().mockReturnValue(true),
        getStateName: () => 'TurnEndingState',
      };
      handler._setTestCurrentState(endingState);

      const error = new Error('Test error');
      await handler._handleTurnEnd('test-actor', error, false);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "called for test-actor with error 'Test error', but already in TurnEndingState"
        )
      );
    });

    it('should warn when could not determine actor ID', async () => {
      // Clear all actor references
      handler._currentTurnContext = null;
      handler._currentActor = null;

      // Set a non-idle, non-ending state to avoid early return
      const nonIdleState = {
        ...mockState,
        isIdle: jest.fn().mockReturnValue(false),
        isEnding: jest.fn().mockReturnValue(false),
        getStateName: () => 'NonIdleState',
      };
      handler._setTestCurrentState(nonIdleState);

      await handler._exposeHandleTurnEnd(null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not determine actor ID for TurnEndingState'
        )
      );
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalledWith(
        handler,
        'UNKNOWN_ACTOR_FOR_STATE',
        null
      );
    });
  });

  describe('_resetTurnStateAndResources() method', () => {
    it('should handle cancelActivePrompt error gracefully', () => {
      const context = {
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
        cancelActivePrompt: jest.fn().mockImplementation(() => {
          throw new Error('Cancel error');
        }),
      };
      handler._exposeSetCurrentTurnContext(context);

      handler._exposeResetTurnStateAndResources('test-context');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error during cancelActivePrompt: Cancel error'
        ),
        expect.any(Error)
      );
    });

    it('should handle context without cancelActivePrompt method', () => {
      const context = {
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
        // No cancelActivePrompt method
      };
      handler._exposeSetCurrentTurnContext(context);

      handler._exposeResetTurnStateAndResources('test-context');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Clearing current TurnContext')
      );
    });
  });

  describe('destroy() method', () => {
    it('should handle cancelActivePrompt error during destroy', async () => {
      const context = {
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
        cancelActivePrompt: jest.fn().mockImplementation(() => {
          throw new Error('Cancel error during destroy');
        }),
      };
      handler._exposeSetCurrentTurnContext(context);

      await handler.destroy();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error during cancelActivePrompt: Cancel error during destroy'
        ),
        expect.any(Error)
      );
    });

    it('should handle state destroy error gracefully', async () => {
      const state = {
        ...mockState,
        destroy: jest.fn().mockRejectedValue(new Error('State destroy error')),
        getStateName: () => 'TestState',
      };
      handler._setTestCurrentState(state);

      await handler.destroy();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error during TestState.destroy(): State destroy error'
        ),
        expect.any(Error)
      );
    });

    it('should handle transition to idle error during destroy', async () => {
      const state = {
        ...mockState,
        isIdle: jest.fn().mockReturnValue(false),
        getStateName: () => 'TestState',
      };
      handler._setTestCurrentState(state);

      // Mock the transition to fail
      const failingIdleState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Transition error')),
        getStateName: () => 'TurnIdleState',
        isIdle: jest.fn().mockReturnValue(true),
      };
      mockTurnStateFactory.createIdleState.mockReturnValue(failingIdleState);

      await handler.destroy();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL - Failed to enter TurnIdleState even after an error'
        )
      );
    });
  });

  describe('_setInitialState() method', () => {
    it('should throw error for invalid initial state', () => {
      const invalidState = { invalid: true };

      expect(() => {
        const newHandler = new TestHandler();
        newHandler._setInitialState(invalidState);
      }).toThrow('Attempted to set invalid initial state');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to set invalid initial state'),
        { state: invalidState }
      );
    });

    it('should throw error when initial state already set', () => {
      const validState = {
        enterState: jest.fn(),
        exitState: jest.fn(),
        getStateName: () => 'ValidState',
      };

      expect(() => {
        handler._setInitialState(validState);
      }).toThrow('Initial state has already been set');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Initial state has already been set')
      );
    });
  });

  describe('Public transition request methods', () => {
    it('should request idle state transition', async () => {
      await handler.requestIdleStateTransition();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received request to transition to Idle state')
      );
      expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(
        handler
      );
    });

    it('should request awaiting input state transition', async () => {
      await handler.requestAwaitingInputStateTransition();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received request to transition to AwaitingInput state'
        )
      );
      expect(
        mockTurnStateFactory.createAwaitingInputState
      ).toHaveBeenCalledWith(handler);
    });

    it('should request processing command state transition', async () => {
      const commandString = 'test command';
      const turnAction = mockTurnAction;

      await handler.requestProcessingCommandStateTransition(
        commandString,
        turnAction
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received request to transition to ProcessingCommand state'
        )
      );
      expect(
        mockTurnStateFactory.createProcessingCommandState
      ).toHaveBeenCalledWith(
        handler,
        commandString,
        turnAction,
        expect.any(Object) // TurnDirectiveStrategyResolver
      );
    });

    it('should request awaiting external turn end state transition', async () => {
      await handler.requestAwaitingExternalTurnEndStateTransition();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Received request to transition to AwaitingExternalTurnEnd state'
        )
      );
      expect(
        mockTurnStateFactory.createAwaitingExternalTurnEndState
      ).toHaveBeenCalledWith(handler);
    });
  });

  describe('Abstract method implementations', () => {
    it('should throw error for unimplemented getTurnEndPort', () => {
      const baseHandler = new BaseTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
      });

      expect(() => baseHandler.getTurnEndPort()).toThrow(
        'Method not implemented'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('does not implement getTurnEndPort')
      );
    });

    it('should throw error for unimplemented startTurn', async () => {
      const baseHandler = new BaseTurnHandler({
        logger: mockLogger,
        turnStateFactory: mockTurnStateFactory,
      });

      await expect(baseHandler.startTurn({ id: 'test' })).rejects.toThrow(
        "Method 'startTurn(actor)' must be implemented"
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Method 'startTurn(actor)' must be implemented")
      );
    });
  });

  describe('Hook methods', () => {
    it('should call onEnterState hook', async () => {
      const prevState = mockState;
      const currentState = { ...mockState, getStateName: () => 'CurrentState' };

      await handler.onEnterState(currentState, prevState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'onEnterState hook: Entering CurrentState from MockState'
        )
      );
    });

    it('should call onExitState hook', async () => {
      const currentState = { ...mockState, getStateName: () => 'CurrentState' };
      const nextState = { ...mockState, getStateName: () => 'NextState' };

      await handler.onExitState(currentState, nextState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'onExitState hook: Exiting CurrentState to NextState'
        )
      );
    });

    it('should handle null previous state in onEnterState', async () => {
      const currentState = { ...mockState, getStateName: () => 'CurrentState' };

      await handler.onEnterState(currentState, null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'onEnterState hook: Entering CurrentState from None'
        )
      );
    });

    it('should handle null next state in onExitState', async () => {
      const currentState = { ...mockState, getStateName: () => 'CurrentState' };

      await handler.onExitState(currentState, null);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'onExitState hook: Exiting CurrentState to None'
        )
      );
    });
  });

  describe('resetStateAndResources() public method', () => {
    it('should delegate to internal reset method', () => {
      const spy = jest.spyOn(handler, '_resetTurnStateAndResources');

      handler.resetStateAndResources('test-reason');

      expect(spy).toHaveBeenCalledWith('test-reason');
    });
  });
});
