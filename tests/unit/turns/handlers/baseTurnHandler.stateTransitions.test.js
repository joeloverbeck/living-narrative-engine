/**
 * @file Complex state transition tests for BaseTurnHandler
 * This file focuses on complex state transition scenarios and edge cases
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BaseTurnHandler } from '../../../../src/turns/handlers/baseTurnHandler.js';
import { TurnIdleState } from '../../../../src/turns/states/turnIdleState.js';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

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

class TransitionTestHandler extends BaseTurnHandler {
  constructor(opts = {}) {
    super({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
      ...opts
    });
  }

  async startTurn(actor) {
    this._assertHandlerActive();
    return 'started';
  }

  getTurnEndPort() {
    return { notifyTurnEnded: jest.fn() };
  }

  // Expose internal methods for testing
  _exposeTransitionToState(state) {
    return this._transitionToState(state);
  }

  _exposeHandleTurnEnd(actorId, error, fromDestroy) {
    return this._handleTurnEnd(actorId, error, fromDestroy);
  }

  _exposeSetCurrentTurnContext(context) {
    return this._setCurrentTurnContextInternal(context);
  }

  _exposeSetCurrentActor(actor) {
    return this._setCurrentActorInternal(actor);
  }

  _setTestCurrentState(state) {
    this._currentState = state;
  }

  _setTestIsDestroyed(value) {
    this._isDestroyed = value;
  }

  _setTestIsDestroying(value) {
    this._isDestroying = value;
  }

  // Expose hooks for testing
  async _exposeOnEnterState(currentState, previousState) {
    return this.onEnterState(currentState, previousState);
  }

  async _exposeOnExitState(currentState, nextState) {
    return this.onExitState(currentState, nextState);
  }
}

describe('BaseTurnHandler State Transitions Tests', () => {
  let handler;
  let mockState;
  let mockIdleState;
  let mockEndingState;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock states
    mockState = {
      enterState: jest.fn().mockResolvedValue(undefined),
      exitState: jest.fn().mockResolvedValue(undefined),
      getStateName: () => 'MockState',
      isIdle: jest.fn().mockReturnValue(false),
      isEnding: jest.fn().mockReturnValue(false),
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    mockIdleState = {
      enterState: jest.fn().mockResolvedValue(undefined),
      exitState: jest.fn().mockResolvedValue(undefined),
      getStateName: () => 'TurnIdleState',
      isIdle: jest.fn().mockReturnValue(true),
      isEnding: jest.fn().mockReturnValue(false),
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    mockEndingState = {
      enterState: jest.fn().mockResolvedValue(undefined),
      exitState: jest.fn().mockResolvedValue(undefined),
      getStateName: () => 'TurnEndingState',
      isIdle: jest.fn().mockReturnValue(false),
      isEnding: jest.fn().mockReturnValue(true),
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock state factory
    mockTurnStateFactory.createIdleState.mockReturnValue(mockIdleState);
    mockTurnStateFactory.createEndingState.mockReturnValue(mockEndingState);
    mockTurnStateFactory.createAwaitingInputState.mockReturnValue({
      ...mockState,
      getStateName: () => 'MockAwaitingInputState',
    });
    mockTurnStateFactory.createProcessingCommandState.mockReturnValue({
      ...mockState,
      getStateName: () => 'MockProcessingCommandState',
    });
    mockTurnStateFactory.createAwaitingExternalTurnEndState.mockReturnValue({
      ...mockState,
      getStateName: () => 'MockAwaitingExternalTurnEndState',
    });

    handler = new TransitionTestHandler();
  });

  afterEach(() => {
    if (handler && !handler._isDestroyed) {
      handler.destroy();
    }
  });

  describe('State transition lifecycle', () => {
    it('should call exit hook before state exitState', async () => {
      const callOrder = [];
      
      const exitingState = {
        ...mockState,
        exitState: jest.fn().mockImplementation(async () => {
          callOrder.push('state-exitState');
        }),
        getStateName: () => 'ExitingState'
      };

      const enteringState = {
        ...mockState,
        enterState: jest.fn().mockImplementation(async () => {
          callOrder.push('state-enterState');
        }),
        getStateName: () => 'EnteringState'
      };

      handler._setTestCurrentState(exitingState);
      
      // Mock the hooks to track call order
      jest.spyOn(handler, 'onExitState').mockImplementation(async () => {
        callOrder.push('hook-onExitState');
      });
      jest.spyOn(handler, 'onEnterState').mockImplementation(async () => {
        callOrder.push('hook-onEnterState');
      });

      await handler._exposeTransitionToState(enteringState);

      expect(callOrder).toEqual([
        'hook-onExitState',
        'state-exitState',
        'hook-onEnterState',
        'state-enterState'
      ]);
    });

    it('should continue with enter even if exit fails', async () => {
      const exitingState = {
        ...mockState,
        exitState: jest.fn().mockRejectedValue(new Error('Exit failed')),
        getStateName: () => 'ExitingState'
      };

      const enteringState = {
        ...mockState,
        getStateName: () => 'EnteringState'
      };

      handler._setTestCurrentState(exitingState);
      
      await handler._exposeTransitionToState(enteringState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during ExitingState.exitState or onExitState hook'),
        expect.any(Error)
      );
      expect(enteringState.enterState).toHaveBeenCalled();
      expect(handler._currentState).toBe(enteringState);
    });

    it('should handle missing getStateName in previous state', async () => {
      const stateWithoutName = {
        ...mockState,
        getStateName: undefined
      };

      const enteringState = {
        ...mockState,
        getStateName: () => 'EnteringState'
      };

      handler._setTestCurrentState(stateWithoutName);
      
      await handler._exposeTransitionToState(enteringState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('State Transition: N/A → EnteringState')
      );
    });

    it('should handle null previous state gracefully', async () => {
      const enteringState = {
        ...mockState,
        getStateName: () => 'EnteringState'
      };

      handler._setTestCurrentState(null);
      
      await handler._exposeTransitionToState(enteringState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('State Transition: None (Initial) → EnteringState')
      );
      expect(handler._currentState).toBe(enteringState);
    });
  });

  describe('Transition to same state scenarios', () => {
    it('should allow transition to same idle state', async () => {
      const idleState = {
        ...mockState,
        isIdle: jest.fn().mockReturnValue(true),
        getStateName: () => 'TurnIdleState'
      };

      handler._setTestCurrentState(idleState);
      
      await handler._exposeTransitionToState(idleState);

      expect(idleState.enterState).toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Attempted to transition to the same state')
      );
    });

    it('should skip transition to same non-idle state', async () => {
      const nonIdleState = {
        ...mockState,
        isIdle: jest.fn().mockReturnValue(false),
        getStateName: () => 'NonIdleState'
      };

      handler._setTestCurrentState(nonIdleState);
      
      await handler._exposeTransitionToState(nonIdleState);

      expect(nonIdleState.enterState).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to transition to the same state NonIdleState. Skipping')
      );
    });

    it('should handle state without isIdle method in same state check', async () => {
      const stateWithoutIsIdle = {
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        getStateName: () => 'StateWithoutIsIdle',
        // No isIdle method
      };

      handler._setTestCurrentState(stateWithoutIsIdle);
      
      await handler._exposeTransitionToState(stateWithoutIsIdle);

      // Should not skip since isIdle defaults to false
      expect(stateWithoutIsIdle.enterState).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to transition to the same state StateWithoutIsIdle. Skipping')
      );
    });
  });

  describe('Error recovery during transitions', () => {
    it('should attempt recovery when enter state fails on non-idle state', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      const actor = { id: 'test-actor' };
      const context = { getActor: jest.fn().mockReturnValue(actor) };
      handler._exposeSetCurrentTurnContext(context);
      handler._exposeSetCurrentActor(actor);

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Forcing transition to TurnIdleState due to error entering FailingState')
      );
      expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(handler);
    });

    it('should handle recovery failure gracefully', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      const failingRecoveryState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Recovery failed')),
        getStateName: () => 'TurnIdleState',
        isIdle: jest.fn().mockReturnValue(true)
      };

      mockTurnStateFactory.createIdleState.mockReturnValue(failingRecoveryState);

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL - Failed to enter TurnIdleState even after an error')
      );
      expect(handler._currentState).toBe(failingRecoveryState);
    });

    it('should handle critical error when already in idle state', async () => {
      const failingIdleState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Idle enter failed')),
        getStateName: () => 'TurnIdleState',
        isIdle: jest.fn().mockReturnValue(true)
      };

      await handler._exposeTransitionToState(failingIdleState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL - Failed to enter TurnIdleState even after an error')
      );
    });
  });

  describe('Actor ID resolution in transitions', () => {
    it('should use context actor ID when available', async () => {
      const actor = { id: 'context-actor' };
      const context = { getActor: jest.fn().mockReturnValue(actor) };
      handler._exposeSetCurrentTurnContext(context);

      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('error-entering-FailingState-for-context-actor')
      );
    });

    it('should use handler actor ID when context unavailable', async () => {
      const actor = { id: 'handler-actor' };
      handler._exposeSetCurrentActor(actor);

      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('error-entering-FailingState-for-handler-actor')
      );
    });

    it('should use N/A when no actor available', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('error-entering-FailingState-for-N/A')
      );
    });
  });

  describe('State identity methods edge cases', () => {
    it('should handle state with isIdle throwing exception', async () => {
      const errorState = {
        ...mockState,
        isIdle: jest.fn().mockImplementation(() => {
          throw new Error('isIdle error');
        }),
        getStateName: () => 'ErrorState'
      };

      handler._setTestCurrentState(errorState);
      
      await handler._exposeTransitionToState(errorState);

      // Should not skip transition due to isIdle error
      expect(errorState.enterState).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to transition to the same state ErrorState. Skipping')
      );
    });

    it('should handle state with isEnding throwing exception', async () => {
      const errorState = {
        ...mockState,
        isEnding: jest.fn().mockImplementation(() => {
          throw new Error('isEnding error');
        }),
        getStateName: () => 'ErrorState'
      };

      handler._setTestCurrentState(errorState);
      
      await handler._exposeHandleTurnEnd('test-actor');

      // Should proceed with transition despite isEnding error
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
    });

    it('should handle state with both isIdle and isEnding throwing exceptions', async () => {
      const errorState = {
        ...mockState,
        isIdle: jest.fn().mockImplementation(() => {
          throw new Error('isIdle error');
        }),
        isEnding: jest.fn().mockImplementation(() => {
          throw new Error('isEnding error');
        }),
        getStateName: () => 'ErrorState'
      };

      handler._setTestCurrentState(errorState);
      
      await handler._exposeHandleTurnEnd('test-actor');

      // Should proceed with transition
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
    });
  });

  describe('Public transition request methods', () => {
    it('should handle transition request when handler is destroying', async () => {
      handler._setTestIsDestroying(true);
      
      await expect(handler.requestIdleStateTransition()).rejects.toThrow(
        'destroying or has been destroyed'
      );
    });

    it('should handle transition request when handler is destroyed', async () => {
      handler._setTestIsDestroyed(true);
      
      await expect(handler.requestAwaitingInputStateTransition()).rejects.toThrow(
        'destroying or has been destroyed'
      );
    });

    it('should create processing command state with TurnDirectiveStrategyResolver', async () => {
      const commandString = 'test command';
      const turnAction = { commandString, actionDefinitionId: 'test:action' };
      
      await handler.requestProcessingCommandStateTransition(commandString, turnAction);

      expect(mockTurnStateFactory.createProcessingCommandState).toHaveBeenCalledWith(
        handler,
        commandString,
        turnAction,
        expect.any(TurnDirectiveStrategyResolver)
      );
    });

    it('should handle all transition request methods in sequence', async () => {
      const turnAction = { commandString: 'test', actionDefinitionId: 'test:action' };
      
      await handler.requestIdleStateTransition();
      await handler.requestAwaitingInputStateTransition();
      await handler.requestProcessingCommandStateTransition('test', turnAction);
      await handler.requestAwaitingExternalTurnEndStateTransition();

      expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(handler);
      expect(mockTurnStateFactory.createAwaitingInputState).toHaveBeenCalledWith(handler);
      expect(mockTurnStateFactory.createProcessingCommandState).toHaveBeenCalledWith(
        handler, 'test', turnAction, expect.any(TurnDirectiveStrategyResolver)
      );
      expect(mockTurnStateFactory.createAwaitingExternalTurnEndState).toHaveBeenCalledWith(handler);
    });
  });

  describe('Complex transition scenarios', () => {
    it('should handle rapid state transitions', async () => {
      const states = [
        { ...mockState, getStateName: () => 'State1' },
        { ...mockState, getStateName: () => 'State2' },
        { ...mockState, getStateName: () => 'State3' }
      ];

      for (const state of states) {
        await handler._exposeTransitionToState(state);
      }

      expect(handler._currentState).toBe(states[2]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('State Transition: State2 → State3')
      );
    });

    it('should handle transition with complex hook interactions', async () => {
      let hookCallCount = 0;
      
      const complexState = {
        ...mockState,
        getStateName: () => 'ComplexState',
        enterState: jest.fn().mockImplementation(async () => {
          hookCallCount++;
        })
      };

      jest.spyOn(handler, 'onEnterState').mockImplementation(async () => {
        hookCallCount++;
      });

      jest.spyOn(handler, 'onExitState').mockImplementation(async () => {
        hookCallCount++;
      });

      await handler._exposeTransitionToState(complexState);

      expect(hookCallCount).toBe(2); // onEnterState + state.enterState (no exit since no previous state)
      expect(handler._currentState).toBe(complexState);
    });

    it('should handle transition with state factory errors', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      mockTurnStateFactory.createIdleState.mockImplementation(() => {
        throw new Error('Factory error');
      });

      await expect(handler._exposeTransitionToState(failingState)).rejects.toThrow('Factory error');
      
      // Restore the factory to prevent errors during cleanup
      mockTurnStateFactory.createIdleState.mockReturnValue(mockIdleState);
    });
  });

  describe('Edge case combinations', () => {
    it('should handle state without any optional methods', async () => {
      const minimalState = {
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        getStateName: () => 'MinimalState'
        // No isIdle, isEnding, or destroy methods
      };

      await handler._exposeTransitionToState(minimalState);

      expect(handler._currentState).toBe(minimalState);
      expect(minimalState.enterState).toHaveBeenCalled();
    });

    it('should handle transition during handler lifecycle events', async () => {
      const transitionState = {
        ...mockState,
        getStateName: () => 'TransitionState'
      };

      // Set up a scenario where transition happens during destroy
      handler._setTestIsDestroying(true);
      
      await handler._exposeTransitionToState(transitionState);

      expect(handler._currentState).toBe(transitionState);
    });
  });
});