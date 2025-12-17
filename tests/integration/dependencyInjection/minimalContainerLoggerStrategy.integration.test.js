import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';

// Mock registration bundles to allow container to work
jest.mock(
  '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/commandAndActionRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/interpreterRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/eventBusAdapterRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/initializerRegistrations.js'
);
jest.mock(
  '../../../src/dependencyInjection/registrations/runtimeRegistrations.js'
);

describe('MinimalContainerConfig LoggerStrategy Integration', () => {
  let container;
  let originalNodeEnv;

  beforeEach(() => {
    container = new AppContainer();
    originalNodeEnv = process.env.NODE_ENV;

    // Ensure ISafeEventDispatcher resolves during configuration
    const { registerInfrastructure } = jest.requireMock(
      '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js'
    );
    registerInfrastructure.mockImplementation((c) => {
      c.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    });

    // Mock initializer registrations
    const { registerInitializers } = jest.requireMock(
      '../../../src/dependencyInjection/registrations/initializerRegistrations.js'
    );
    registerInitializers.mockImplementation((c) => {
      c.register(tokens.SystemInitializer, { initialize: jest.fn() });
      c.register(tokens.AnatomyInitializationService, {
        initialize: jest.fn(),
      });
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  describe('ILogger Interface Compliance', () => {
    it('should register LoggerStrategy as ILogger', async () => {
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(LoggerStrategy);
    });

    it('should provide all ILogger methods', async () => {
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // Core ILogger methods
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');

      // Extended methods
      expect(typeof logger.setLogLevel).toBe('function');
      expect(typeof logger.getMode).toBe('function');
    });

    it('should properly delegate logging calls without throwing', async () => {
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // Test that each logging method can be called without throwing
      expect(() => logger.info('Test info message')).not.toThrow();
      expect(() => logger.warn('Test warn message')).not.toThrow();
      expect(() => logger.error('Test error message')).not.toThrow();
      expect(() => logger.debug('Test debug message')).not.toThrow();

      // Test with additional arguments
      expect(() => logger.info('Test', { data: 'value' })).not.toThrow();
      expect(() => logger.error('Error', new Error('test'))).not.toThrow();
    });
  });

  describe('Mode Detection', () => {
    it('should use console mode in test environment', async () => {
      // Clear DEBUG_LOG_MODE to allow minimalContainerConfig to force console mode
      const originalDebugLogMode = process.env.DEBUG_LOG_MODE;
      delete process.env.DEBUG_LOG_MODE;

      process.env.NODE_ENV = 'test';
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // In test mode with no DEBUG_LOG_MODE, minimalContainerConfig forces console mode
      expect(logger.getMode()).toBe('console');

      // Restore original value
      if (originalDebugLogMode !== undefined) {
        process.env.DEBUG_LOG_MODE = originalDebugLogMode;
      }
    });

    it('should respect DEBUG_LOG_MODE environment variable', async () => {
      process.env.DEBUG_LOG_MODE = 'none';
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      expect(logger.getMode()).toBe('none');
      delete process.env.DEBUG_LOG_MODE;
    });
  });

  describe('setLogLevel Compatibility', () => {
    it('should support setLogLevel method', async () => {
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // Should not throw
      expect(() => logger.setLogLevel('DEBUG')).not.toThrow();
      expect(() => logger.setLogLevel('INFO')).not.toThrow();
      expect(() => logger.setLogLevel('WARN')).not.toThrow();
      expect(() => logger.setLogLevel('ERROR')).not.toThrow();
    });

    it('should support mode switching via setLogLevel', async () => {
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // Test mode switching
      logger.setLogLevel('none');
      expect(logger.getMode()).toBe('none');

      logger.setLogLevel('console');
      expect(logger.getMode()).toBe('console');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing code expecting ILogger interface', async () => {
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // Simulate existing code that uses ILogger
      const existingCode = (logger) => {
        logger.info('Starting operation');
        logger.debug('Debug details');
        logger.warn('Warning message');
        logger.error('Error occurred');
        return true;
      };

      // Should work without errors
      expect(existingCode(logger)).toBe(true);
    });

    it('should maintain functionality with loadAndApplyLoggerConfig', async () => {
      // This test verifies that the async configuration loading still works
      await configureMinimalContainer(container);
      const logger = container.resolve(tokens.ILogger);

      // The configuration loading happens asynchronously in configureMinimalContainer
      // Wait for next tick to ensure it completes
      await new Promise(process.nextTick);

      // Logger should still be functional
      expect(logger).toBeDefined();
      expect(typeof logger.setLogLevel).toBe('function');
    });
  });
});
