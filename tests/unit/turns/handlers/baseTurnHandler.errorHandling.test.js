/**
 * @file Error handling tests for BaseTurnHandler
 * This file focuses on error scenarios and edge cases to maximize coverage
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
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

// Test handler that exposes internal methods
class ErrorTestHandler extends BaseTurnHandler {
  constructor(opts = {}) {
    super({
      logger: opts.logger !== undefined ? opts.logger : mockLogger,
      turnStateFactory: opts.turnStateFactory !== undefined ? opts.turnStateFactory : mockTurnStateFactory,
    });
  }

  async startTurn(actor) {
    this._assertHandlerActive();
    if (!actor) {
      throw new Error('Actor required');
    }
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

  _exposeResetTurnStateAndResources(context) {
    return this._resetTurnStateAndResources(context);
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
}

describe('BaseTurnHandler Error Handling Tests', () => {
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

    mockTurnStateFactory.createEndingState.mockImplementation((h, actorId, error) => {
      const state = new TurnEndingState(h, actorId, error);
      jest.spyOn(state, 'enterState').mockResolvedValue(undefined);
      jest.spyOn(state, 'exitState').mockResolvedValue(undefined);
      return state;
    });

    mockState = {
      enterState: jest.fn().mockResolvedValue(undefined),
      exitState: jest.fn().mockResolvedValue(undefined),
      getStateName: () => 'MockState',
      isIdle: jest.fn().mockReturnValue(false),
      isEnding: jest.fn().mockReturnValue(false),
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    handler = new ErrorTestHandler();
  });

  afterEach(() => {
    if (handler && !handler._isDestroyed) {
      handler.destroy();
    }
  });

  describe('Constructor validation', () => {
    it('should throw error when logger is missing', () => {
      expect(() => {
        new ErrorTestHandler({ logger: null, turnStateFactory: mockTurnStateFactory });
      }).toThrow('BaseTurnHandler: logger is required');
    });

    it('should throw error when turnStateFactory is missing', () => {
      expect(() => {
        new ErrorTestHandler({ logger: mockLogger, turnStateFactory: null });
      }).toThrow('BaseTurnHandler: turnStateFactory is required');
    });

    it('should log error to console when logger is missing', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        new ErrorTestHandler({ logger: null, turnStateFactory: mockTurnStateFactory });
      } catch (e) {
        // Expected to throw
      }
      
      expect(consoleSpy).toHaveBeenCalledWith('BaseTurnHandler: logger is required.');
      consoleSpy.mockRestore();
    });

    it('should log error to console when turnStateFactory is missing', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        new ErrorTestHandler({ logger: mockLogger, turnStateFactory: null });
      } catch (e) {
        // Expected to throw
      }
      
      expect(consoleSpy).toHaveBeenCalledWith('BaseTurnHandler: turnStateFactory is required.');
      consoleSpy.mockRestore();
    });
  });

  describe('getLogger() error handling', () => {
    it('should fallback to base logger when TurnContext getLogger throws', () => {
      const context = {
        getLogger: jest.fn().mockImplementation(() => {
          throw new Error('Logger access error');
        }),
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' })
      };
      handler._exposeSetCurrentTurnContext(context);
      
      const logger = handler.getLogger();
      
      expect(logger).toBe(mockLogger);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error accessing logger from TurnContext: Logger access error')
      );
    });

    it('should fallback to base logger when TurnContext getLogger returns null', () => {
      const context = {
        getLogger: jest.fn().mockReturnValue(null),
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' })
      };
      handler._exposeSetCurrentTurnContext(context);
      
      const logger = handler.getLogger();
      
      expect(logger).toBe(mockLogger);
    });
  });

  describe('State transition error recovery', () => {
    it('should recover from state transition failure during error handling', async () => {
      const currentState = {
        ...mockState,
        getStateName: () => 'CurrentState',
        isIdle: jest.fn().mockReturnValue(false),
        isEnding: jest.fn().mockReturnValue(false)
      };
      
      const failingEndingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Ending state failed')),
        getStateName: () => 'TurnEndingState',
        isIdle: jest.fn().mockReturnValue(false),
        isEnding: jest.fn().mockReturnValue(true)
      };

      handler._setTestCurrentState(currentState);
      mockTurnStateFactory.createEndingState.mockReturnValue(failingEndingState);

      await handler._exposeHandleTurnEnd('test-actor', new Error('Original error'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during TurnEndingState.enterState or onEnterState hook'),
        expect.any(Error)
      );
      expect(mockTurnStateFactory.createIdleState).toHaveBeenCalled();
    });

    it('should handle cascade failure when idle state also fails', async () => {
      const failingState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('State failed')),
        getStateName: () => 'FailingState',
        isIdle: jest.fn().mockReturnValue(false)
      };

      const failingIdleState = {
        ...mockState,
        enterState: jest.fn().mockRejectedValue(new Error('Idle state also failed')),
        getStateName: () => 'TurnIdleState',
        isIdle: jest.fn().mockReturnValue(true)
      };

      mockTurnStateFactory.createIdleState.mockReturnValue(failingIdleState);

      await handler._exposeTransitionToState(failingState);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL - Failed to enter TurnIdleState even after an error')
      );
    });

    it('should handle state without isIdle method gracefully', async () => {
      const stateWithoutIsIdle = {
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        getStateName: () => 'StateWithoutIsIdle',
        destroy: jest.fn().mockResolvedValue(undefined),
        // No isIdle method
      };

      handler._setTestCurrentState(stateWithoutIsIdle);

      // This should not throw an error even though isIdle is missing
      await expect(handler.destroy()).resolves.toBeUndefined();
    });

    it('should handle state without isEnding method gracefully', async () => {
      const stateWithoutIsEnding = {
        enterState: jest.fn().mockResolvedValue(undefined),
        exitState: jest.fn().mockResolvedValue(undefined),
        getStateName: () => 'StateWithoutIsEnding',
        isIdle: jest.fn().mockReturnValue(false),
        // No isEnding method
      };

      handler._setTestCurrentState(stateWithoutIsEnding);
      
      await handler._exposeHandleTurnEnd('test-actor');

      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
    });
  });

  describe('Destroy error scenarios', () => {
    it('should handle destroy when state lacks destroy method', async () => {
      const stateWithoutDestroy = {
        ...mockState,
        getStateName: () => 'StateWithoutDestroy',
        isIdle: jest.fn().mockReturnValue(false),
        // No destroy method
      };
      delete stateWithoutDestroy.destroy;

      handler._setTestCurrentState(stateWithoutDestroy);
      
      await handler.destroy();

      expect(handler._isDestroyed).toBe(true);
      expect(mockTurnStateFactory.createIdleState).toHaveBeenCalled();
    });

    it('should handle context without cancelActivePrompt method during destroy', async () => {
      const contextWithoutCancel = {
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
        // No cancelActivePrompt method
      };
      handler._exposeSetCurrentTurnContext(contextWithoutCancel);
      
      await handler.destroy();

      expect(handler._isDestroyed).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('destroy() complete')
      );
    });

    it('should handle state already in idle during destroy', async () => {
      const idleState = {
        ...mockState,
        getStateName: () => 'TurnIdleState',
        isIdle: jest.fn().mockReturnValue(true)
      };
      handler._setTestCurrentState(idleState);
      
      await handler.destroy();

      expect(handler._isDestroyed).toBe(true);
      // Should not try to transition to idle if already idle
      expect(mockTurnStateFactory.createIdleState).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle assertion errors', () => {
    it('should throw when calling operations on destroyed handler', async () => {
      handler._setTestIsDestroyed(true);
      
      await expect(handler.startTurn({ id: 'test' })).rejects.toThrow('ErrorTestHandler: Operation invoked while handler is destroying or has been destroyed.');
    });

    it('should throw when calling operations on destroying handler', async () => {
      handler._setTestIsDestroying(true);
      
      await expect(handler.startTurn({ id: 'test' })).rejects.toThrow('ErrorTestHandler: Operation invoked while handler is destroying or has been destroyed.');
    });

    it('should not throw when calling from destroy process', async () => {
      handler._setTestIsDestroying(true);
      
      await expect(
        handler._exposeHandleTurnEnd('test-actor', null, true)
      ).resolves.toBeUndefined();
    });
  });

  describe('TurnContext access error scenarios', () => {
    it('should handle missing TurnContext methods gracefully', () => {
      const incompleteContext = {
        // Missing getLogger, getActor, getSafeEventDispatcher methods
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' })
      };
      handler._exposeSetCurrentTurnContext(incompleteContext);
      
      expect(handler.getLogger()).toBe(mockLogger);
      expect(handler.getCurrentActor()).toEqual({ id: 'test-actor' });
      expect(handler.getSafeEventDispatcher()).toBeNull();
    });

    it('should handle TurnContext.getActor returning null', () => {
      const context = {
        getActor: jest.fn().mockReturnValue(null)
      };
      handler._exposeSetCurrentTurnContext(context);
      
      expect(handler.getCurrentActor()).toBeNull();
    });

    it('should handle TurnContext.getSafeEventDispatcher returning invalid dispatcher', () => {
      const context = {
        getSafeEventDispatcher: jest.fn().mockReturnValue({
          // Missing dispatch method
          invalid: true
        }),
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' })
      };
      handler._exposeSetCurrentTurnContext(context);
      
      expect(handler.getSafeEventDispatcher()).toBeNull();
    });
  });

  describe('Resource cleanup error scenarios', () => {
    it('should handle cleanup when all resources are null', () => {
      handler._exposeSetCurrentTurnContext(null);
      handler._exposeSetCurrentActor(null);
      
      handler._exposeResetTurnStateAndResources('null-resources-test');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Base per-turn state reset complete')
      );
    });

    it('should handle cleanup when TurnContext has null actor', () => {
      const context = {
        getActor: jest.fn().mockReturnValue(null),
        cancelActivePrompt: jest.fn()
      };
      handler._exposeSetCurrentTurnContext(context);
      
      handler._exposeResetTurnStateAndResources('null-actor-test');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Context actor: None')
      );
    });

    it('should handle cleanup when handler actor is null', () => {
      handler._exposeSetCurrentActor(null);
      
      handler._exposeResetTurnStateAndResources('null-handler-actor-test');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Handler actor: None')
      );
    });
  });

  describe('Edge cases in state identity checks', () => {
    it('should handle null currentState in isIdle check', async () => {
      handler._setTestCurrentState(null);
      
      await handler._exposeHandleTurnEnd('test-actor');
      
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
    });

    it('should handle state with isIdle that throws error', async () => {
      const errorState = {
        ...mockState,
        isIdle: jest.fn().mockImplementation(() => {
          throw new Error('isIdle error');
        }),
        getStateName: () => 'ErrorState'
      };
      handler._setTestCurrentState(errorState);
      
      await handler._exposeHandleTurnEnd('test-actor');
      
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
    });

    it('should handle state with isEnding that throws error', async () => {
      const errorState = {
        ...mockState,
        isEnding: jest.fn().mockImplementation(() => {
          throw new Error('isEnding error');
        }),
        getStateName: () => 'ErrorState'
      };
      handler._setTestCurrentState(errorState);
      
      await handler._exposeHandleTurnEnd('test-actor');
      
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalled();
    });
  });

  describe('Actor ID resolution edge cases', () => {
    it('should handle all actor IDs being null or undefined', async () => {
      handler._exposeSetCurrentTurnContext(null);
      handler._exposeSetCurrentActor(null);
      
      await handler._exposeHandleTurnEnd(null);
      
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalledWith(
        handler,
        'UNKNOWN_ACTOR_FOR_STATE',
        null
      );
    });

    it('should handle context actor being null but handler actor existing', async () => {
      const context = {
        getActor: jest.fn().mockReturnValue(null)
      };
      const handlerActor = { id: 'handler-actor' };
      
      handler._exposeSetCurrentTurnContext(context);
      handler._exposeSetCurrentActor(handlerActor);
      
      await handler._exposeHandleTurnEnd('end-actor');
      
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalledWith(
        handler,
        'end-actor',
        null
      );
    });

    it('should handle context getActor throwing error', async () => {
      const context = {
        getActor: jest.fn().mockImplementation(() => {
          throw new Error('getActor error');
        })
      };
      
      handler._exposeSetCurrentTurnContext(context);
      
      await handler._exposeHandleTurnEnd('end-actor');
      
      expect(mockTurnStateFactory.createEndingState).toHaveBeenCalledWith(
        handler,
        'end-actor',
        null
      );
    });
  });

  describe('Complex error combinations', () => {
    it('should handle multiple errors in sequence', async () => {
      const problematicState = {
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        exitState: jest.fn().mockRejectedValue(new Error('Exit failed')),
        getStateName: () => 'ProblematicState',
        isIdle: jest.fn().mockReturnValue(false),
        destroy: jest.fn().mockRejectedValue(new Error('Destroy failed'))
      };

      const currentState = {
        ...mockState,
        getStateName: () => 'CurrentState'
      };

      handler._setTestCurrentState(currentState);
      
      // This should trigger multiple error paths
      await handler._exposeTransitionToState(problematicState);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during ProblematicState.enterState or onEnterState hook –'),
        expect.any(Error)
      );
    });

    it('should handle errors during destroy with complex state', async () => {
      const complexState = {
        enterState: jest.fn().mockRejectedValue(new Error('Enter failed')),
        exitState: jest.fn().mockRejectedValue(new Error('Exit failed')),
        getStateName: () => 'ComplexState',
        isIdle: jest.fn().mockReturnValue(false),
        destroy: jest.fn().mockRejectedValue(new Error('State destroy failed'))
      };

      const problematicContext = {
        getActor: jest.fn().mockReturnValue({ id: 'test-actor' }),
        cancelActivePrompt: jest.fn().mockImplementation(() => {
          throw new Error('Cancel failed');
        })
      };

      handler._setTestCurrentState(complexState);
      handler._exposeSetCurrentTurnContext(problematicContext);
      
      await handler.destroy();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error during cancelActivePrompt'),
        expect.any(Error)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during ComplexState.destroy()'),
        expect.any(Error)
      );
      expect(handler._isDestroyed).toBe(true);
    });
  });
});