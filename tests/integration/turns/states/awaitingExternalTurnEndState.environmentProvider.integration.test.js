import { describe, it, expect, beforeEach } from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { ProcessEnvironmentProvider } from '../../../../src/configuration/ProcessEnvironmentProvider.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';
import { createEventBus } from '../../../common/mockFactories/eventBus.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

// Helper class for handler
class TestTurnHandler {
  constructor({ logger, dispatcher }) {
    this._logger = logger;
    this._dispatcher = dispatcher;
    this.resetStateAndResources = jest.fn();
    this.requestIdleStateTransition = jest.fn();
  }

  setTurnContext(ctx) {
    this._context = ctx;
  }

  getTurnContext() {
    return this._context;
  }

  getLogger() {
    return this._logger;
  }

  getSafeEventDispatcher() {
    return this._dispatcher;
  }
}

describe('AwaitingExternalTurnEndState - Environment Provider Integration', () => {
  let handler;
  let context;
  let logger;
  let eventBus;
  let dispatcher;

  beforeEach(() => {
    logger = createMockLogger();
    eventBus = createEventBus({ captureEvents: true });
    dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });
    handler = new TestTurnHandler({ logger, dispatcher });

    const actor = { id: 'test-actor' };
    context = new TurnContext({
      actor,
      logger,
      services: {
        safeEventDispatcher: dispatcher,
        turnEndPort: { signalTurnEnd: jest.fn() },
        entityManager: {
          getComponentData: jest.fn(),
          getEntityInstance: jest.fn(),
        },
      },
      strategy: {
        decideAction: jest.fn(),
        getMetadata: jest.fn(() => ({})),
        dispose: jest.fn(),
      },
      onEndTurnCallback: jest.fn(),
      handlerInstance: handler,
      onSetAwaitingExternalEventCallback: jest.fn(),
    });

    handler.setTurnContext(context);
  });

  describe('ProcessEnvironmentProvider Integration', () => {
    it('should use ProcessEnvironmentProvider to detect real environment', async () => {
      // Arrange
      const realProvider = new ProcessEnvironmentProvider();
      const originalNodeEnv = process.env.NODE_ENV;
      const mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
      const mockClearTimeout = jest.fn();

      try {
        // Set known environment
        process.env.NODE_ENV = 'production';

        // Act
        const state = new AwaitingExternalTurnEndState(handler, {
          environmentProvider: realProvider, // Real provider
          setTimeoutFn: mockSetTimeout,
          clearTimeoutFn: mockClearTimeout,
        });

        await state.enterState(handler, null);

        // Assert
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
        // ProcessEnvironmentProvider correctly detects production environment
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('TestEnvironmentProvider Integration', () => {
    it('should use TestEnvironmentProvider for isolated test configuration', async () => {
      // Arrange - Custom test timeout (development mode = 3 seconds)
      const customTestProvider = new TestEnvironmentProvider({
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: true,
      });
      const mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
      const mockClearTimeout = jest.fn();

      // Act
      const state = new AwaitingExternalTurnEndState(handler, {
        environmentProvider: customTestProvider,
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: mockClearTimeout,
      });

      await state.enterState(handler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
      // TestEnvironmentProvider provides isolated, predictable configuration
      // No dependency on system environment variables
    });
  });

  describe('Provider Error Handling', () => {
    it('should gracefully handle provider throwing error with fallback to production timeout', async () => {
      // Arrange - Provider that always throws
      const errorProvider = {
        getEnvironment: () => {
          throw new Error('Environment detection failed');
        },
      };
      const mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
      const mockClearTimeout = jest.fn();

      // Act
      const state = new AwaitingExternalTurnEndState(handler, {
        environmentProvider: errorProvider,
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: mockClearTimeout,
      });

      await state.enterState(handler, null);

      // Assert
      // Note: Error is caught silently during construction (no logger available yet)
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
      // Falls back to production timeout (safe default)
      // State remains functional despite provider error
    });

    it('should handle provider returning invalid structure with fallback', async () => {
      // Arrange - Provider returns invalid data
      const malformedProvider = {
        getEnvironment: () => null, // Invalid: should return object with IS_PRODUCTION
      };
      const mockSetTimeout = jest.fn((fn, ms) => `timeout-${ms}`);
      const mockClearTimeout = jest.fn();

      // Act
      const state = new AwaitingExternalTurnEndState(handler, {
        environmentProvider: malformedProvider,
        setTimeoutFn: mockSetTimeout,
        clearTimeoutFn: mockClearTimeout,
      });

      await state.enterState(handler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
      // Null-ish coalescing in #resolveDefaultTimeout handles null
      // Defaults to production timeout via IS_PRODUCTION ?? true
    });
  });
});
