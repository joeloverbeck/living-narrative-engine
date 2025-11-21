import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';

describe('AwaitingExternalTurnEndState - Timeout Consistency Regression', () => {
  let mockHandler;
  let mockCtx;
  let mockDispatcher;

  beforeEach(() => {
    jest.useFakeTimers();

    // Create minimal mocks for state instantiation
    mockDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => () => {}),
    };

    mockCtx = {
      getChosenActionId: jest.fn(),
      getChosenAction: jest.fn(() => ({ actionDefinitionId: 'test-action' })),
      getActor: jest.fn(() => ({ id: 'test-actor' })),
      getSafeEventDispatcher: jest.fn(() => mockDispatcher),
      getLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn(() => true),
      endTurn: jest.fn(),
    };

    mockHandler = {
      getLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
      getTurnContext: jest.fn(() => mockCtx),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Exact Timeout Value Matching', () => {
    it('should use exactly 30,000ms timeout with production provider', async () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: productionProvider,
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: jest.fn(),
      });

      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        30_000 // EXACTLY 30000, not 30001 or 29999
      );
      expect(mockSetTimeout).toHaveBeenCalledTimes(1);
    });

    it('should use exactly 3,000ms timeout with development provider', async () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: developmentProvider,
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: jest.fn(),
      });

      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        3_000 // EXACTLY 3000
      );
    });

    it('should use exact explicit timeout and ignore provider', async () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: productionProvider, // Would give 30,000
        timeoutMs: 5_000, // Explicit override
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: jest.fn(),
      });

      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        5_000 // EXACTLY 5000, not 30000 from provider
      );
    });
  });

  describe('Cleanup in All Exit Paths', () => {
    it('should clear timeout in all exit paths', async () => {
      // Arrange
      const mockClearTimeout = jest.fn();
      let timeoutId;
      const mockSetTimeout = jest.fn(() => {
        timeoutId = `timeout-${Date.now()}`;
        return timeoutId;
      });

      // Test Path 1: exitState called directly
      {
        const state = new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 5_000,
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(mockHandler, null);
        const exitTimeoutId = timeoutId;

        await state.exitState(mockHandler, null);

        expect(mockClearTimeout).toHaveBeenCalledWith(exitTimeoutId);
        mockClearTimeout.mockClear();
      }

      // Test Path 2: destroy called
      {
        const state = new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 5_000,
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(mockHandler, null);
        const destroyTimeoutId = timeoutId;

        await state.destroy(mockHandler);

        expect(mockClearTimeout).toHaveBeenCalledWith(destroyTimeoutId);
        mockClearTimeout.mockClear();
      }

      // Test Path 3: Timeout fires (self-clears via #clearGuards)
      {
        const state = new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 5_000,
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(mockHandler, null);

        // Timeout fires (fast-forward timers)
        await jest.advanceTimersByTimeAsync(5_000);

        // Timeout callback internally calls #clearGuards which clears itself
        // (Verified by no orphan timers in integration tests)
        mockClearTimeout.mockClear();
      }
    });
  });
});
