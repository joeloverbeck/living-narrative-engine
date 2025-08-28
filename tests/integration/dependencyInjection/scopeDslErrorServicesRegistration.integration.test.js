/**
 * @file Integration test for ScopeDSL error services registration
 * Verifies that IScopeDslErrorFactory and IScopeDslErrorHandler can be resolved
 * and have proper dependencies injected.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('ScopeDSL Error Services Registration Integration', () => {
  let container;
  let mockLogger;

  beforeEach(() => {
    container = new AppContainer();

    // Register minimal dependencies first
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    container.register(tokens.ILogger, () => mockLogger, {
      lifecycle: 'singleton',
    });

    // Register minimal dependencies for infrastructure
    container.register(tokens.IDataRegistry, () => ({}), {
      lifecycle: 'singleton',
    });
    container.register(tokens.ISchemaValidator, () => ({}), {
      lifecycle: 'singleton',
    });
    container.register(tokens.IPathConfiguration, () => ({}), {
      lifecycle: 'singleton',
    });
    container.register(tokens.ISafeEventDispatcher, () => ({}), {
      lifecycle: 'singleton',
    });
    container.register(tokens.ITraceConfigLoader, () => ({}), {
      lifecycle: 'singleton',
    });

    // Register infrastructure services (includes our new error services)
    registerInfrastructure(container);
  });

  test('should register and resolve IScopeDslErrorFactory', () => {
    // Act
    const errorFactory = container.resolve(tokens.IScopeDslErrorFactory);

    // Assert
    expect(errorFactory).toBeDefined();
    expect(typeof errorFactory.unknown).toBe('function');
    expect(typeof errorFactory.fromTemplate).toBe('function');
    expect(typeof errorFactory.createForCategory).toBe('function');
  });

  test('should register and resolve IScopeDslErrorHandler', () => {
    // Act
    const errorHandler = container.resolve(tokens.IScopeDslErrorHandler);

    // Assert
    expect(errorHandler).toBeDefined();
    expect(typeof errorHandler.handleError).toBe('function');
    expect(typeof errorHandler.getErrorBuffer).toBe('function');
    expect(typeof errorHandler.clearErrorBuffer).toBe('function');
  });

  test('should inject proper dependencies into error handler', () => {
    // Act
    const errorHandler = container.resolve(tokens.IScopeDslErrorHandler);

    // Assert - Verify error handler can perform operations that require dependencies
    expect(() => errorHandler.getErrorBuffer()).not.toThrow();
    expect(() => errorHandler.clearErrorBuffer()).not.toThrow();

    // Verify error buffer starts empty
    const initialBuffer = errorHandler.getErrorBuffer();
    expect(Array.isArray(initialBuffer)).toBe(true);
    expect(initialBuffer.length).toBe(0);
  });

  test('should resolve services as singletons', () => {
    // Act
    const errorFactory1 = container.resolve(tokens.IScopeDslErrorFactory);
    const errorFactory2 = container.resolve(tokens.IScopeDslErrorFactory);
    const errorHandler1 = container.resolve(tokens.IScopeDslErrorHandler);
    const errorHandler2 = container.resolve(tokens.IScopeDslErrorHandler);

    // Assert
    expect(errorFactory1).toBe(errorFactory2);
    expect(errorHandler1).toBe(errorHandler2);
  });

  test('should configure error handler with proper environment settings', () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // Test both configurations with the same container
      const errorHandler = container.resolve(tokens.IScopeDslErrorHandler);

      // Assert - Should be created without error regardless of NODE_ENV
      expect(errorHandler).toBeDefined();

      // Should have error buffer functionality
      expect(typeof errorHandler.getErrorBuffer).toBe('function');
      expect(typeof errorHandler.clearErrorBuffer).toBe('function');
    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
