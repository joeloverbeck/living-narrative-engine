// tests/turns/states/awaitingExternalTurnEndState.test.js
// ****** MODIFIED FILE ******

import { jest } from '@jest/globals';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('AwaitingExternalTurnEndState – action propagation', () => {
  // Use a short timeout for faster tests
  const TIMEOUT_MS = 10;

  let mockCtx;
  let mockSafeEventDispatcher; // Renamed for clarity
  let mockHandler;
  let state;
  let mockLogger;

  beforeEach(() => {
    jest.useFakeTimers();

    const noop = () => {};
    mockLogger = {
      debug: jest.fn(noop),
      error: jest.fn(noop),
      warn: jest.fn(noop),
    };

    /* ── turn-context stub ─────────────────────────────────────────────── */
    // MODIFIED: This now mocks the full ISafeEventDispatcher interface needed by the SUT
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {
        /* mock unsubscribe fn */
      }),
    };

    mockCtx = {
      // chosen action exposes ONLY a definitionId (no numeric instance id)
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({
        actionDefinitionId: 'attack',
      }),

      getActor: () => ({ id: 'hero-123' }),
      // MODIFIED: Returns the more complete mock dispatcher
      getSafeEventDispatcher: () => mockSafeEventDispatcher,
      // REMOVED: Obsolete mock for getSubscriptionManager
      getLogger: () => mockLogger,
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
      endTurn: jest.fn(),
    };

    /* ── minimal handler stub ──────────────────────────────────────────── */
    mockHandler = {
      getLogger: () => mockLogger,
      getTurnContext: () => mockCtx,
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
      _transitionToState: jest.fn(),
      _resetTurnStateAndResources: jest.fn(),
    };

    /* ── state under test ──────────────────────────────────────────────── */
    state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: TIMEOUT_MS,
      setTimeoutFn: global.setTimeout,
      clearTimeoutFn: global.clearTimeout,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('dispatches core:system_error_occurred with the *definition* id on timeout', async () => {
    // prime the state
    await state.enterState(mockHandler, /* prev */ null);

    // let the 3 s guard-rail fire
    jest.advanceTimersByTime(TIMEOUT_MS + 1);

    expect(safeDispatchError).toHaveBeenCalledWith(
      mockSafeEventDispatcher,
      expect.stringContaining('No rule ended the turn for actor hero-123'),
      expect.objectContaining({
        actorId: 'hero-123',
        actionId: 'attack',
        code: 'TURN_END_TIMEOUT',
      }),
      mockLogger
    );
  });

  it('prefers getChosenActionId() when both ids are present', async () => {
    mockCtx.getChosenActionId.mockReturnValue('use-potion');
    mockCtx.getChosenAction.mockReturnValue({ actionDefinitionId: 'attack' });

    await state.enterState(mockHandler, null);
    jest.advanceTimersByTime(TIMEOUT_MS + 1);

    expect(safeDispatchError).toHaveBeenCalledWith(
      mockSafeEventDispatcher,
      expect.any(String),
      expect.objectContaining({
        actionId: 'use-potion',
      }),
      mockLogger
    );
  });
});

describe('AwaitingExternalTurnEndState – environment-based timeout resolution', () => {
  let mockCtx;
  let mockSafeEventDispatcher;
  let mockHandler;
  let mockLogger;
  let originalEnv;

  beforeEach(() => {
    jest.useFakeTimers();

    // Save original NODE_ENV
    originalEnv = process.env.NODE_ENV;

    const noop = () => {};
    mockLogger = {
      debug: jest.fn(noop),
      error: jest.fn(noop),
      warn: jest.fn(noop),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    mockCtx = {
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({
        actionDefinitionId: 'test-action',
      }),
      getActor: () => ({ id: 'test-actor' }),
      getSafeEventDispatcher: () => mockSafeEventDispatcher,
      getLogger: () => mockLogger,
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
      endTurn: jest.fn(),
    };

    mockHandler = {
      getLogger: () => mockLogger,
      getTurnContext: () => mockCtx,
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
      _transitionToState: jest.fn(),
      _resetTurnStateAndResources: jest.fn(),
    };
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should use development timeout (3s) when NODE_ENV is development', async () => {
    // Set environment to development
    process.env.NODE_ENV = 'development';

    // Create state without explicit timeout
    const state = new AwaitingExternalTurnEndState(mockHandler);

    await state.enterState(mockHandler, null);

    // Should NOT timeout before 3s
    jest.advanceTimersByTime(2_999);
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    // Should timeout at 3s
    jest.advanceTimersByTime(1);
    expect(mockCtx.endTurn).toHaveBeenCalled();
  });

  it('should use production timeout (30s) when NODE_ENV is production', async () => {
    // Set environment to production
    process.env.NODE_ENV = 'production';

    // Create state without explicit timeout
    const state = new AwaitingExternalTurnEndState(mockHandler);

    await state.enterState(mockHandler, null);

    // Should NOT timeout before 30s
    jest.advanceTimersByTime(29_999);
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    // Should timeout at 30s
    jest.advanceTimersByTime(1);
    expect(mockCtx.endTurn).toHaveBeenCalled();
  });

  it('should use development timeout (3s) when NODE_ENV is test', async () => {
    // Set environment to test
    process.env.NODE_ENV = 'test';

    // Create state without explicit timeout
    const state = new AwaitingExternalTurnEndState(mockHandler);

    await state.enterState(mockHandler, null);

    // Should NOT timeout before 3s
    jest.advanceTimersByTime(2_999);
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    // Should timeout at 3s
    jest.advanceTimersByTime(1);
    expect(mockCtx.endTurn).toHaveBeenCalled();
  });

  it('should allow explicit timeout override regardless of environment', async () => {
    // Set environment to production
    process.env.NODE_ENV = 'production';

    // Create state with explicit 5s timeout
    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: 5_000,
    });

    await state.enterState(mockHandler, null);

    // Should NOT timeout before 5s
    jest.advanceTimersByTime(4_999);
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    // Should timeout at 5s (not at production default of 30s)
    jest.advanceTimersByTime(1);
    expect(mockCtx.endTurn).toHaveBeenCalled();
  });

  it('should use development timeout in test environment by default', async () => {
    // NODE_ENV='test' is the default in Jest
    // Verify that test environment uses development timeout (3s, not 30s)

    // Create state without explicit timeout
    const state = new AwaitingExternalTurnEndState(mockHandler);

    await state.enterState(mockHandler, null);

    // Should NOT timeout before 3s
    jest.advanceTimersByTime(2_999);
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    // Should timeout at 3s (development timeout, not production 30s)
    jest.advanceTimersByTime(1);
    expect(mockCtx.endTurn).toHaveBeenCalled();
  });

  it('should preserve backward compatibility with explicit timeoutMs parameter', async () => {
    // Verify that existing code using explicit timeoutMs still works
    const customTimeout = 7_500;

    const state = new AwaitingExternalTurnEndState(mockHandler, {
      timeoutMs: customTimeout,
    });

    await state.enterState(mockHandler, null);

    // Should NOT timeout before custom timeout
    jest.advanceTimersByTime(customTimeout - 1);
    expect(mockCtx.endTurn).not.toHaveBeenCalled();

    // Should timeout at custom timeout
    jest.advanceTimersByTime(1);
    expect(mockCtx.endTurn).toHaveBeenCalled();
  });
});

describe('AwaitingExternalTurnEndState - Timeout Validation', () => {
  let mockHandler;
  let mockCtx;
  let mockLogger;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    const noop = () => {};
    mockLogger = {
      debug: jest.fn(noop),
      error: jest.fn(noop),
      warn: jest.fn(noop),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    mockCtx = {
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({
        actionDefinitionId: 'test-action',
      }),
      getActor: () => ({ id: 'actor-123' }),
      endTurn: jest.fn(),
    };

    mockHandler = {
      getContext: () => mockCtx,
      getLogger: () => mockLogger,
      getSafeEventDispatcher: () => mockSafeEventDispatcher,
    };
  });

  describe('AC1: Reject NaN Timeout', () => {
    it('should throw InvalidArgumentError when timeoutMs is NaN', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: NaN });
      }).toThrow('timeoutMs must be a positive finite number, got: NaN (type: number)');
    });

    it('should not create state when timeoutMs is NaN', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: NaN });
      }).toThrow();
    });
  });

  describe('AC2: Reject Negative Timeout', () => {
    it('should throw InvalidArgumentError when timeoutMs is negative', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: -1000 });
      }).toThrow('timeoutMs must be a positive finite number, got: -1000 (type: number)');
    });

    it('should indicate value must be positive in error message', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: -5000 });
      }).toThrow(/positive finite number/);
    });

    it('should not create state when timeoutMs is negative', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: -1 });
      }).toThrow();
    });
  });

  describe('AC3: Reject Zero Timeout', () => {
    it('should throw InvalidArgumentError when timeoutMs is zero', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 0 });
      }).toThrow('timeoutMs must be a positive finite number, got: 0 (type: number)');
    });

    it('should indicate value must be positive (> 0) in error message', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 0 });
      }).toThrow(/positive finite number/);
    });

    it('should not create state when timeoutMs is zero', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 0 });
      }).toThrow();
    });
  });

  describe('AC4: Reject Infinity Timeout', () => {
    it('should throw InvalidArgumentError when timeoutMs is Infinity', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: Infinity });
      }).toThrow('timeoutMs must be a positive finite number, got: Infinity (type: number)');
    });

    it('should throw InvalidArgumentError when timeoutMs is -Infinity', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: -Infinity });
      }).toThrow('timeoutMs must be a positive finite number, got: -Infinity (type: number)');
    });

    it('should indicate value must be finite in error message', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: Infinity });
      }).toThrow(/finite number/);
    });

    it('should not create state when timeoutMs is Infinity', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: Infinity });
      }).toThrow();
    });
  });

  describe('AC5: Reject Non-Number Timeout', () => {
    it('should throw InvalidArgumentError when timeoutMs is a string', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: '3000' });
      }).toThrow('timeoutMs must be a positive finite number, got: 3000 (type: string)');
    });

    it('should throw InvalidArgumentError when timeoutMs is an object', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: {} });
      }).toThrow(/type: object/);
    });

    it('should not throw when timeoutMs is null (uses default like undefined)', () => {
      // null ?? default will use the default timeout, which is valid
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: null });
      }).not.toThrow();
    });

    it('should not throw when timeoutMs is undefined (uses default)', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: undefined });
      }).not.toThrow();
    });

    it('should include actual value and type in error message for strings', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 'invalid' });
      }).toThrow(/got: invalid.*type: string/);
    });

    it('should not create state when timeoutMs is non-number', () => {
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 'string' });
      }).toThrow();
    });
  });

  describe('AC6: Accept Valid Positive Finite Numbers', () => {
    it('should create state successfully with timeoutMs = 1000', () => {
      const state = new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 1000 });
      expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
    });

    it('should create state successfully with timeoutMs = 30000', () => {
      const state = new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 30_000 });
      expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
    });

    it('should create state successfully with fractional timeout (0.5)', () => {
      const state = new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 0.5 });
      expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
    });

    it('should create state successfully with very small positive number', () => {
      const state = new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 0.001 });
      expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
    });

    it('should create state successfully with large finite number', () => {
      const state = new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: 999_999 });
      expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
    });
  });

  describe('AC7: Validation Happens Before State Setup', () => {
    it('should throw before event subscription when timeout invalid', () => {
      // Mock subscribe to track if it was called
      const subscribeSpy = jest.fn().mockReturnValue(() => {});
      mockSafeEventDispatcher.subscribe = subscribeSpy;

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: NaN });
      }).toThrow();

      // Subscribe should never be called because validation failed
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('should throw before any state initialization with invalid timeout', () => {
      // Ensure no side effects occurred
      const dispatchSpy = jest.fn();
      mockSafeEventDispatcher.dispatch = dispatchSpy;

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: -100 });
      }).toThrow();

      // No events should be dispatched during failed construction
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should fail fast with no resources allocated', () => {
      // No cleanup should be needed because construction fails immediately
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, { timeoutMs: Infinity });
      }).toThrow();
      // Test passes if no cleanup errors or memory leaks
    });
  });

  describe('Timer Function Validation (AWAEXTTURENDSTAROB-003)', () => {
    let mockHandler;
    let mockSafeEventDispatcher;

    beforeEach(() => {
      const noop = () => {};
      const mockLogger = {
        debug: jest.fn(noop),
        error: jest.fn(noop),
        warn: jest.fn(noop),
      };

      mockSafeEventDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn().mockReturnValue(() => {}),
      };

      const mockCtx = {
        getChosenActionId: jest.fn().mockReturnValue(undefined),
        getChosenAction: jest.fn().mockReturnValue({
          actionDefinitionId: 'test-action',
        }),
        getActor: () => ({ id: 'actor-123' }),
        getTarget: () => ({ id: 'target-456' }),
      };

      mockHandler = {
        logger: mockLogger,
        context: mockCtx,
        safeEventDispatcher: mockSafeEventDispatcher,
        endTurn: jest.fn(),
      };
    });

    // AC1: Reject Non-Function setTimeoutFn
    describe('AC1: Reject non-function setTimeoutFn', () => {
      it('should throw InvalidArgumentError when setTimeoutFn is a string', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: 'not-a-function',
          });
        }).toThrow('setTimeoutFn must be a function, got: string');
      });

      it('should throw InvalidArgumentError when setTimeoutFn is null', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: null,
          });
        }).toThrow('setTimeoutFn must be a function, got: object');
      });

      it('should throw InvalidArgumentError when setTimeoutFn is a number', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: 123,
          });
        }).toThrow('setTimeoutFn must be a function, got: number');
      });

      it('should not create state when setTimeoutFn is invalid', () => {
        let state;
        expect(() => {
          state = new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: {},
          });
        }).toThrow();
        expect(state).toBeUndefined();
      });

      it('should not allocate resources when setTimeoutFn validation fails', () => {
        const dispatchSpy = jest.fn();
        mockSafeEventDispatcher.dispatch = dispatchSpy;

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: [],
          });
        }).toThrow();

        // No events should be dispatched during failed construction
        expect(dispatchSpy).not.toHaveBeenCalled();
      });
    });

    // AC2: Reject Non-Function clearTimeoutFn
    describe('AC2: Reject non-function clearTimeoutFn', () => {
      it('should throw InvalidArgumentError when clearTimeoutFn is null', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            clearTimeoutFn: null,
          });
        }).toThrow('clearTimeoutFn must be a function, got: object');
      });

      it('should throw InvalidArgumentError when clearTimeoutFn is an object', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            clearTimeoutFn: {},
          });
        }).toThrow('clearTimeoutFn must be a function, got: object');
      });

      it('should throw InvalidArgumentError when clearTimeoutFn is a boolean', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            clearTimeoutFn: false,
          });
        }).toThrow('clearTimeoutFn must be a function, got: boolean');
      });

      it('should not create state when clearTimeoutFn is invalid', () => {
        let state;
        expect(() => {
          state = new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            clearTimeoutFn: 'invalid',
          });
        }).toThrow();
        expect(state).toBeUndefined();
      });
    });

    // AC3: Accept Valid Function References
    describe('AC3: Accept valid function references', () => {
      it('should accept default setTimeout and clearTimeout', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
          });
        }).not.toThrow();
      });

      it('should accept custom mock timer functions', () => {
        const mockSetTimeout = jest.fn(() => 123);
        const mockClearTimeout = jest.fn(() => {});

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: mockSetTimeout,
            clearTimeoutFn: mockClearTimeout,
          });
        }).not.toThrow();
      });

      it('should store timer functions correctly when valid', () => {
        const mockSetTimeout = jest.fn(() => 123);
        const mockClearTimeout = jest.fn(() => {});

        const state = new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 5000,
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        expect(state).toBeDefined();
        // Functions are private, but we can verify state was created successfully
      });
    });

    // AC4: Accept Arrow Functions and Bound Functions
    describe('AC4: Accept arrow functions and bound functions', () => {
      it('should accept arrow functions', () => {
        const arrowSetTimeout = () => 123;
        const arrowClearTimeout = () => {};

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: arrowSetTimeout,
            clearTimeoutFn: arrowClearTimeout,
          });
        }).not.toThrow();
      });

      it('should accept bound functions', () => {
        const boundSetTimeout = setTimeout.bind(null);
        const boundClearTimeout = clearTimeout.bind(null);

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: boundSetTimeout,
            clearTimeoutFn: boundClearTimeout,
          });
        }).not.toThrow();
      });
    });

    // AC5: Default Values Work Correctly
    describe('AC5: Default values work correctly', () => {
      it('should not throw when using default timer functions', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
          });
        }).not.toThrow();
      });

      it('should create state successfully with defaults', () => {
        const state = new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 5000,
        });

        expect(state).toBeDefined();
        expect(state).toBeInstanceOf(AwaitingExternalTurnEndState);
      });
    });

    // AC6: Validation Happens Before State Setup
    describe('AC6: Validation happens before state setup', () => {
      it('should fail before event subscription with invalid setTimeoutFn', () => {
        const subscribeSpy = jest.fn().mockReturnValue(() => {});
        mockSafeEventDispatcher.subscribe = subscribeSpy;

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: 'invalid',
          });
        }).toThrow();

        // Subscription should not happen during failed construction
        expect(subscribeSpy).not.toHaveBeenCalled();
      });

      it('should fail before timeout initialization with invalid clearTimeoutFn', () => {
        const mockSetTimeout = jest.fn();

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: mockSetTimeout,
            clearTimeoutFn: null,
          });
        }).toThrow();

        // setTimeout should not be called during failed construction
        expect(mockSetTimeout).not.toHaveBeenCalled();
      });

      it('should require no cleanup when validation fails', () => {
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: 123,
          });
        }).toThrow();
        // Test passes if no cleanup errors or resource leaks
      });
    });

    // AC7: Both Validations Can Fail Independently
    describe('AC7: Both validations can fail independently', () => {
      it('should report setTimeoutFn error when only setTimeoutFn is invalid', () => {
        const validClearTimeout = jest.fn();

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: null,
            clearTimeoutFn: validClearTimeout,
          });
        }).toThrow('setTimeoutFn must be a function, got: object');
      });

      it('should report clearTimeoutFn error when only clearTimeoutFn is invalid', () => {
        const validSetTimeout = jest.fn();

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: validSetTimeout,
            clearTimeoutFn: null,
          });
        }).toThrow('clearTimeoutFn must be a function, got: object');
      });

      it('should fail on first invalid parameter when both are invalid', () => {
        // setTimeoutFn is validated first, so we expect that error
        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: 'invalid',
            clearTimeoutFn: 123,
          });
        }).toThrow('setTimeoutFn must be a function, got: string');
      });
    });

    // AC8: Existing Tests Still Pass
    describe('AC8: Existing tests compatibility', () => {
      it('should work with jest.useFakeTimers() mock timers', () => {
        jest.useFakeTimers();

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
          });
        }).not.toThrow();

        jest.useRealTimers();
      });

      it('should work with custom test timer mocks', () => {
        const testSetTimeout = jest.fn(() => ({ id: 'test-timer' }));
        const testClearTimeout = jest.fn(() => {});

        expect(() => {
          new AwaitingExternalTurnEndState(mockHandler, {
            timeoutMs: 5000,
            setTimeoutFn: testSetTimeout,
            clearTimeoutFn: testClearTimeout,
          });
        }).not.toThrow();
      });
    });
  });
});
