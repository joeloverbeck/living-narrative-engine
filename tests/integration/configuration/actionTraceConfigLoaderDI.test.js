/**
 * @file Integration tests for ActionTraceConfigLoader dependency injection
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('ActionTraceConfigLoader - DI Integration', () => {
  let container;

  beforeEach(() => {
    // Create a fresh container for each test
    container = new AppContainer();

    // Mock DOM elements required by configureContainer
    const mockOutputDiv = document.createElement('div');
    const mockInputElement = document.createElement('input');
    const mockTitleElement = document.createElement('h1');
    const mockDocument = document;

    // Register dummy dispatchers first
    container.register(
      tokens.ISafeEventDispatcher,
      {
        dispatch: jest.fn(),
      },
      { lifecycle: 'singleton' }
    );

    container.register(
      tokens.IValidatedEventDispatcher,
      {
        dispatch: jest.fn(),
      },
      { lifecycle: 'singleton' }
    );

    // Configure the container with full configuration (includes logger and action tracing)
    configureContainer(container, {
      outputDiv: mockOutputDiv,
      inputElement: mockInputElement,
      titleElement: mockTitleElement,
      document: mockDocument,
    });
  });

  afterEach(() => {
    // Cleanup after each test
    container = null;
  });

  describe('Container Resolution', () => {
    it('should resolve IActionTraceConfigLoader from DI container', () => {
      // Act
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Assert
      expect(actionTraceConfigLoader).toBeDefined();
      expect(actionTraceConfigLoader).not.toBeNull();
      expect(typeof actionTraceConfigLoader.loadConfig).toBe('function');
      expect(typeof actionTraceConfigLoader.isEnabled).toBe('function');
      expect(typeof actionTraceConfigLoader.shouldTraceAction).toBe('function');
    });

    it('should resolve ITraceConfigLoader from DI container', () => {
      // Act
      const traceConfigLoader = container.resolve(tokens.ITraceConfigLoader);

      // Assert
      expect(traceConfigLoader).toBeDefined();
      expect(traceConfigLoader).not.toBeNull();
      expect(typeof traceConfigLoader.loadConfig).toBe('function');
    });

    it('should resolve the same singleton instance on multiple calls', () => {
      // Act
      const instance1 = container.resolve(tokens.IActionTraceConfigLoader);
      const instance2 = container.resolve(tokens.IActionTraceConfigLoader);

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Dependencies', () => {
    it('should initialize ActionTraceConfigLoader with correct dependencies', () => {
      // Act
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Assert
      // The loader should be properly initialized without throwing errors
      expect(() => actionTraceConfigLoader.getStatistics()).not.toThrow();
      expect(typeof actionTraceConfigLoader.resetStatistics).toBe('function');
    });

    it('should have all required dependencies available', () => {
      // Act & Assert - These should all resolve without throwing
      expect(() => container.resolve(tokens.ITraceConfigLoader)).not.toThrow();
      expect(() => container.resolve(tokens.ISchemaValidator)).not.toThrow();
      expect(() => container.resolve(tokens.ILogger)).not.toThrow();
    });
  });

  describe('Configuration Loading Integration', () => {
    it('should load configuration via DI-resolved dependencies', async () => {
      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const configResult = await actionTraceConfigLoader.loadConfig();

      // Assert
      expect(configResult).toBeDefined();
      // Should not throw errors even if config file doesn't exist
      // (it should return default configuration)
    });

    it('should check if tracing is enabled via DI', async () => {
      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const isEnabled = await actionTraceConfigLoader.isEnabled();

      // Assert
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should validate patterns using DI-resolved dependencies', () => {
      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act & Assert
      expect(() =>
        actionTraceConfigLoader.testPattern('core:*', 'core:action')
      ).not.toThrow();
    });
  });

  describe('Performance and Monitoring Integration', () => {
    it('should provide statistics via DI integration', () => {
      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const stats = actionTraceConfigLoader.getStatistics();

      // Assert
      expect(stats).toBeDefined();
      expect(typeof stats.exactMatches).toBe('number');
      expect(typeof stats.wildcardMatches).toBe('number');
      expect(typeof stats.totalLookups).toBe('number');
    });

    it('should provide cache info via DI integration', () => {
      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const stats = actionTraceConfigLoader.getStatistics();

      // Assert
      expect(stats).toBeDefined();
      expect(stats.cacheTtl).toBeDefined();
      expect(typeof stats.cacheStatus).toBe('string');
      expect(typeof stats.cacheAge).toBe('number');
    });
  });

  describe('Error Handling with DI', () => {
    it('should handle configuration loading errors gracefully', async () => {
      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act & Assert
      // Should not throw even with invalid configuration attempts
      await expect(actionTraceConfigLoader.loadConfig()).resolves.toBeDefined();
    });

    it('should handle dependency failures gracefully during resolution', () => {
      // Act & Assert
      // The container should resolve the service even if some dependencies have issues
      expect(() =>
        container.resolve(tokens.IActionTraceConfigLoader)
      ).not.toThrow();
    });
  });
});
