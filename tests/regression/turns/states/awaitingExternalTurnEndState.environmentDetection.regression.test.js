/**
 * @file Regression tests for AwaitingExternalTurnEndState environment detection
 * @description Prevents regression to module-level constant evaluation patterns.
 * Verifies that environment changes are respected without module isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';

describe('AwaitingExternalTurnEndState - Environment Detection Regression', () => {
  let originalNodeEnv;
  let mockSetTimeout;
  let mockClearTimeout;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
    mockClearTimeout = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  /**
   * Helper to create minimal mock handler implementing ITurnStateHost
   * @param {string} actorId - Actor ID for the mock
   * @returns {object} Mock handler with required interface
   */
  function createMockHandler(actorId = 'test-actor') {
    const noop = () => {};
    const mockLogger = {
      debug: jest.fn(noop),
      error: jest.fn(noop),
      warn: jest.fn(noop),
      info: jest.fn(noop),
    };

    const mockSafeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {
        /* mock unsubscribe fn */
      }),
    };

    const mockCtx = {
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({
        actionDefinitionId: 'test-action',
      }),
      getActor: () => ({ id: actorId }),
      getSafeEventDispatcher: () => mockSafeEventDispatcher,
      getLogger: () => mockLogger,
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
      endTurn: jest.fn(),
    };

    return {
      getLogger: () => mockLogger,
      getTurnContext: () => mockCtx,
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
      _transitionToState: jest.fn(),
      _resetTurnStateAndResources: jest.fn(),
    };
  }

  describe('No Module-Level Constant Evaluation', () => {
    it('should respect environment changes between instances without module isolation', async () => {
      // Arrange - Create first instance in production
      process.env.NODE_ENV = 'production';
      const handler1 = createMockHandler('actor1');

      const state1 = new AwaitingExternalTurnEndState(handler1, {
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: mockClearTimeout,
      });

      await state1.enterState(handler1, null);

      // Assert first instance uses production timeout (30s)
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);

      // Act - Change environment and create second instance
      process.env.NODE_ENV = 'development';
      mockSetTimeout.mockClear(); // Clear previous calls

      const handler2 = createMockHandler('actor2');
      const state2 = new AwaitingExternalTurnEndState(handler2, {
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: mockClearTimeout,
      });

      await state2.enterState(handler2, null);

      // Assert second instance uses development timeout (3s)
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);

      // Verify no module-level constant was used
      // (If module-level constant existed, both would use same timeout)
    });

    it('should create multiple instances with alternating environment configs correctly', async () => {
      // Arrange - Create array to track timeouts
      const timeouts = [];
      const localMockSetTimeout = jest.fn((fn, ms) => {
        timeouts.push(ms);
        return `timeout-${ms}`;
      });

      // Act - Create 5 instances alternating between production and development
      for (let i = 0; i < 5; i++) {
        process.env.NODE_ENV = i % 2 === 0 ? 'production' : 'development';
        const handler = createMockHandler(`actor-${i}`);

        const state = new AwaitingExternalTurnEndState(handler, {
          setTimeoutFn: localMockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(handler, null);
      }

      // Assert - Verify alternating pattern
      expect(timeouts).toEqual([
        30_000, // 0: production
        3_000, // 1: development
        30_000, // 2: production
        3_000, // 3: development
        30_000, // 4: production
      ]);

      // Verify each instance gets correct environment-based timeout
      // Verify no single module-level constant used for all
    });
  });

  describe('Jest Environment Compatibility', () => {
    it('should work correctly in Jest test environment without jest.isolateModulesAsync', async () => {
      // Arrange - Set Jest default test environment
      process.env.NODE_ENV = 'test';
      const handler = createMockHandler();

      // Act - Create state directly (no isolation wrapper)
      const state = new AwaitingExternalTurnEndState(handler, {
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: mockClearTimeout,
      });

      await state.enterState(handler, null);

      // Assert - Test environment treated as development (3s timeout)
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);

      // Verify no jest.isolateModulesAsync needed
      // Verify no cache busting required
      // (This test itself proves both by running successfully)
    });
  });

  describe('Browser Environment Handling', () => {
    it('should handle Jest environment even without process global (Jest detection still works)', async () => {
      // Arrange - Simulate browser environment but Jest still running
      const originalProcess = global.process;
      const originalJest = global.jest;
      delete global.process; // Remove Node.js process global

      try {
        const handler = createMockHandler();

        // Act - Create state without process global but with Jest global
        const state = new AwaitingExternalTurnEndState(handler, {
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(handler, null);

        // Assert - Jest environment still detected (globalThis.jest exists)
        // so it uses development timeout (3s), not production fallback
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);

        // Verify no reference errors
        // Verify graceful handling of missing process global
        // Verify test environment detection works via alternative methods
      } finally {
        // Cleanup - Restore process global
        global.process = originalProcess;
        if (!originalJest) {
          delete global.jest;
        }
      }
    });

    it('should default to development timeout when both process and jest globals missing', async () => {
      // Arrange - Simulate true browser environment (no process, no jest)
      const originalProcess = global.process;
      const originalJest = global.jest;
      delete global.process; // Remove Node.js process global
      delete global.jest; // Remove Jest global to simulate true browser

      try {
        const handler = createMockHandler();

        // Act - Create state in true browser environment
        const state = new AwaitingExternalTurnEndState(handler, {
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(handler, null);

        // Assert - Without process or jest, defaults to development mode (3s)
        // This is the fallback behavior in getEnvironmentMode()
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);

        // Verify no reference errors
        // Verify graceful degradation to safe default
      } finally {
        // Cleanup - Restore globals
        global.process = originalProcess;
        global.jest = originalJest;
      }
    });
  });
});
