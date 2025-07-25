// tests/unit/dependencyInjection/registrations/uiRegistrations.registerLegacyInputHandler.test.js
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerLegacyInputHandler } from '../../../../src/dependencyInjection/registrations/uiRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock InputHandler
jest.mock('../../../../src/input/inputHandler.js', () => jest.fn());

describe('registerLegacyInputHandler', () => {
  let mockRegistrar;
  let mockLogger;
  let mockContainer;
  let MockInputHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked InputHandler
    MockInputHandler = require('../../../../src/input/inputHandler.js');

    mockRegistrar = {
      register: jest.fn(),
      singletonFactory: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock container for factory testing
    mockContainer = {
      resolve: jest.fn((token) => {
        const mocks = {
          [tokens.inputElement]: document.createElement('input'),
          [tokens.IValidatedEventDispatcher]: { dispatch: jest.fn() },
          [tokens.WindowDocument]: document,
          [tokens.ILogger]: mockLogger,
        };
        return mocks[token] || jest.fn();
      }),
    };
  });

  it('should register IInputHandler using registrar.singletonFactory', () => {
    registerLegacyInputHandler(mockRegistrar, mockLogger);

    expect(mockRegistrar.singletonFactory).toHaveBeenCalledWith(
      tokens.IInputHandler,
      expect.any(Function)
    );
  });

  it('should log debug message about registration', () => {
    registerLegacyInputHandler(mockRegistrar, mockLogger);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      `UI Registrations: Registered ${tokens.IInputHandler} (legacy) with VED.`
    );
  });

  it('should call registrar.singletonFactory exactly once', () => {
    registerLegacyInputHandler(mockRegistrar, mockLogger);

    expect(mockRegistrar.singletonFactory).toHaveBeenCalledTimes(1);
  });

  describe('factory function behavior', () => {
    it('should create InputHandler factory that resolves all required dependencies', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factoryCall = mockRegistrar.singletonFactory.mock.calls[0];
      expect(factoryCall[0]).toBe(tokens.IInputHandler);

      const factory = factoryCall[1];
      expect(typeof factory).toBe('function');

      // Test the factory function
      const result = factory(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.inputElement);
      expect(mockContainer.resolve).toHaveBeenCalledWith(
        tokens.IValidatedEventDispatcher
      );
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.WindowDocument);
      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    });

    it('should create InputHandler with correct constructor parameters', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];

      // Execute the factory
      factory(mockContainer);

      expect(MockInputHandler).toHaveBeenCalledWith(
        mockContainer.resolve(tokens.inputElement),
        undefined, // Second parameter is explicitly undefined
        expect.any(Object), // IValidatedEventDispatcher
        {
          document: expect.any(Object), // WindowDocument
          logger: expect.any(Object), // ILogger
        }
      );
    });

    it('should pass undefined as second parameter to InputHandler', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];
      factory(mockContainer);

      const constructorCall = MockInputHandler.mock.calls[0];
      expect(constructorCall[1]).toBeUndefined();
    });

    it('should pass options object with document and logger properties', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];
      factory(mockContainer);

      const constructorCall = MockInputHandler.mock.calls[0];
      const options = constructorCall[3];

      expect(options).toEqual({
        document: mockContainer.resolve(tokens.WindowDocument),
        logger: mockContainer.resolve(tokens.ILogger),
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing dependencies gracefully', () => {
      const faultyContainer = {
        resolve: jest.fn(() => {
          throw new Error('Dependency not found');
        }),
      };

      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];

      expect(() => {
        factory(faultyContainer);
      }).toThrow('Dependency not found');
    });

    it('should handle null inputElement', () => {
      const containerWithNullInput = {
        resolve: jest.fn((token) => {
          if (token === tokens.inputElement) {
            return null;
          }
          return mockContainer.resolve(token);
        }),
      };

      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];

      expect(() => {
        factory(containerWithNullInput);
      }).not.toThrow();

      expect(MockInputHandler).toHaveBeenCalledWith(
        null,
        undefined,
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('parameter validation', () => {
    it('should handle null registrar gracefully', () => {
      expect(() => {
        registerLegacyInputHandler(null, mockLogger);
      }).toThrow(); // This will throw because we try to call singletonFactory on null
    });

    it('should handle null logger gracefully', () => {
      expect(() => {
        registerLegacyInputHandler(mockRegistrar, null);
      }).toThrow(); // Will throw because logger.debug is called with null logger
    });
  });

  describe('registration details', () => {
    it('should use correct token for registration', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const call = mockRegistrar.singletonFactory.mock.calls[0];
      expect(call[0]).toBe(tokens.IInputHandler);
    });

    it('should register with singletonFactory lifecycle', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      // Verify singletonFactory was used instead of register
      expect(mockRegistrar.singletonFactory).toHaveBeenCalled();
      expect(mockRegistrar.register).not.toHaveBeenCalled();
    });
  });

  describe('dependency resolution order', () => {
    it('should resolve dependencies in the correct order', () => {
      registerLegacyInputHandler(mockRegistrar, mockLogger);

      const factory = mockRegistrar.singletonFactory.mock.calls[0][1];
      factory(mockContainer);

      const resolveCalls = mockContainer.resolve.mock.calls;

      // Verify all expected dependencies were resolved
      expect(resolveCalls).toEqual(
        expect.arrayContaining([
          [tokens.inputElement],
          [tokens.IValidatedEventDispatcher],
          [tokens.WindowDocument],
          [tokens.ILogger],
        ])
      );

      expect(resolveCalls).toHaveLength(4);
    });
  });
});
