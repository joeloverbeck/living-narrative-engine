import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';

describe('AwaitingExternalTurnEndState - Environment Configuration', () => {
  let mockHandler;
  let mockCtx;
  let mockDispatcher;

  beforeEach(() => {
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
    // No environment restoration needed
  });

  describe('Environment-Based Default Timeouts', () => {
    it('should use 30-second timeout in production environment', async () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: productionProvider,
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
      expect(mockSetTimeout).toHaveBeenCalledTimes(1);
    });

    it('should use 3-second timeout in development environment', async () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: developmentProvider,
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
    });

    it('should use 3-second timeout in test environment', async () => {
      // Arrange
      const testProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false, IS_TEST: true });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: testProvider,
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
      // Note: Test environment treated as development
    });

    it('should use 3-second timeout when NODE_ENV is undefined in Jest environment', async () => {
      // Arrange
      // Use TestEnvironmentProvider to explicitly test Jest environment behavior
      const testProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false, IS_TEST: true });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: testProvider,
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
      // Jest environment is detected as 'test' mode, which uses development timeout
      // This is because isTestEnvironment() checks for globalThis.jest and takes precedence
    });
  });

  describe('Explicit Timeout Override', () => {
    it('should use explicit timeout over production default', async () => {
      // Arrange
      const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: productionProvider,
        timeoutMs: 5_000, // Explicit override
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5_000);
      // NOT 30_000 (production default ignored)
    });

    it('should use explicit timeout over development default', async () => {
      // Arrange
      const developmentProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: developmentProvider,
        timeoutMs: 10_000, // Explicit override
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 10_000);
      // NOT 3_000 (development default ignored)
    });
  });

  describe('Environment Detection Edge Cases', () => {
    it('should handle custom environment strings gracefully', async () => {
      // Arrange
      // Custom environments (not production) default to development timeout
      const customProvider = new TestEnvironmentProvider({ IS_PRODUCTION: false, NODE_ENV: 'staging' });
      const mockSetTimeout = jest.fn(() => 'timeout-id');

      // Act
      const state = new AwaitingExternalTurnEndState(mockHandler, {
        environmentProvider: customProvider,
        setTimeoutFn: mockSetTimeout,
      });
      await state.enterState(mockHandler, null);

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
      // Custom environments default to development timeout
    });
  });

  describe('Invalid Timeout Validation', () => {
    it('should throw InvalidArgumentError when timeoutMs is NaN', () => {
      // Arrange & Act & Assert
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: NaN,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: NaN,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*NaN/);
    });

    it('should throw InvalidArgumentError when timeoutMs is negative', () => {
      // Arrange & Act & Assert
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: -1000,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: -1000,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*-1000/);
    });

    it('should throw InvalidArgumentError when timeoutMs is Infinity', () => {
      // Arrange & Act & Assert
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: Infinity,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: Infinity,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*Infinity/);
    });

    it('should throw InvalidArgumentError when timeoutMs is zero', () => {
      // Arrange & Act & Assert
      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 0,
        });
      }).toThrow(InvalidArgumentError);

      expect(() => {
        new AwaitingExternalTurnEndState(mockHandler, {
          timeoutMs: 0,
        });
      }).toThrow(/timeoutMs must be a positive finite number.*0/);
    });
  });
});
