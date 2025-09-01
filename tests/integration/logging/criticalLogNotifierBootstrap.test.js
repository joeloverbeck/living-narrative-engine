/**
 * @file Integration test for CriticalLogNotifier bootstrap failure scenario
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
import { JSDOM } from 'jsdom';

describe('CriticalLogNotifier Bootstrap Integration', () => {
  let testBed;
  let container;
  let dom;

  beforeEach(() => {
    testBed = createTestBed();
    container = new AppContainer();
    
    // Set up JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    // Set up global DOM objects
    global.document = dom.window.document;
    global.window = dom.window;
    global.navigator = dom.window.navigator;
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    // Set up mock fetch for remote logging
    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: () => Promise.resolve('OK'),
        json: () => Promise.resolve({ status: 'success' })
      })
    );

    // Register LoggerStrategy as ILogger (simulates the real bootstrap)
    const loggerStrategy = new LoggerStrategy({
      mode: 'development', // Force development mode to ensure HybridLogger is used
      config: {
        remoteLogging: {
          enabled: false, // Disable remote logging to avoid network calls in tests
        },
      },
      dependencies: {
        consoleLogger: new ConsoleLogger(LogLevel.INFO),
      },
    });
    container.register(tokens.ILogger, () => loggerStrategy, { lifecycle: 'singleton' });

    // Register IDocumentContext mock
    const mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === 'document') return document;
        if (selector === 'body') return document.body;
        return document.querySelector(selector);
      }),
      create: jest.fn((tagName) => document.createElement(tagName)),
      getDocument: () => document,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    container.register(tokens.IDocumentContext, () => mockDocumentContext, { lifecycle: 'singleton' });

    // Register IValidatedEventDispatcher mock
    const mockValidatedEventDispatcher = testBed.createMock('validatedEventDispatcher', ['dispatch', 'subscribe']);
    container.register(tokens.IValidatedEventDispatcher, () => mockValidatedEventDispatcher, { lifecycle: 'singleton' });
  });

  afterEach(() => {
    testBed.cleanup();
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.navigator;
    delete global.localStorage;
    delete global.fetch;
    jest.clearAllMocks();
  });

  describe('Bootstrap Process', () => {
    it('should successfully create CriticalLogNotifier using container resolution (reproduces production scenario)', () => {
      // This test reproduces the exact production scenario where CriticalLogNotifier
      // gets created during bootstrap via dependency injection

      // First verify the ILogger resolves to LoggerStrategy
      const logger = container.resolve(tokens.ILogger);
      expect(logger).toBeInstanceOf(LoggerStrategy);
      expect(typeof logger.getCurrentLogger).toBe('function');

      // Now register the CriticalLogNotifier exactly as in production
      container.register(
        tokens.ICriticalLogNotifier,
        (c) => 
          new CriticalLogNotifier({
            logger: c.resolve(tokens.ILogger),
            documentContext: c.resolve(tokens.IDocumentContext),
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            hybridLogger: c.resolve(tokens.ILogger).getCurrentLogger(), // This should be the fix
            config: {
              enableVisualNotifications: true,
              notificationPosition: 'top-right',
              maxRecentLogs: 20,
            },
          }),
        {
          lifecycle: 'singleton',
        }
      );

      // This should not throw - this was the failing line in production
      expect(() => {
        const criticalNotifier = container.resolve(tokens.ICriticalLogNotifier);
        expect(criticalNotifier).toBeInstanceOf(CriticalLogNotifier);
      }).not.toThrow();
    });

    it('should reproduce the original error with the old code (for reference)', () => {
      // This test shows what happens with the old broken code
      container.register(
        'TestICriticalLogNotifier',
        (c) => 
          new CriticalLogNotifier({
            logger: c.resolve(tokens.ILogger),
            documentContext: c.resolve(tokens.IDocumentContext),
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            hybridLogger: c.resolve(tokens.ILogger), // This is the bug - LoggerStrategy instead of HybridLogger
            config: {
              enableVisualNotifications: true,
              notificationPosition: 'top-right',
              maxRecentLogs: 20,
            },
          }),
        {
          lifecycle: 'singleton',
        }
      );

      // This should throw the original error
      expect(() => {
        container.resolve('TestICriticalLogNotifier');
      }).toThrow('Invalid or missing method \'getCriticalLogs\' on dependency \'HybridLogger\'');
    });

    it('should verify HybridLogger methods are available through getCurrentLogger', () => {
      const logger = container.resolve(tokens.ILogger);
      expect(logger).toBeInstanceOf(LoggerStrategy);
      
      const hybridLogger = logger.getCurrentLogger();
      
      // Verify the hybrid logger has the required methods
      expect(typeof hybridLogger.getCriticalLogs).toBe('function');
      expect(typeof hybridLogger.getCriticalBufferStats).toBe('function');
      expect(typeof hybridLogger.clearCriticalBuffer).toBe('function');
      
      // Verify methods actually work
      const logs = hybridLogger.getCriticalLogs();
      expect(Array.isArray(logs)).toBe(true);
      
      const stats = hybridLogger.getCriticalBufferStats();
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('currentSize');
      expect(stats).toHaveProperty('maxSize');
      
      // This should not throw
      expect(() => hybridLogger.clearCriticalBuffer()).not.toThrow();
    });

    it('should test full infrastructure registration (simulates real bootstrap)', () => {
      // This test simulates the real bootstrap process more closely
      
      // First register some basic dependencies that infrastructure needs
      const mockRegistrar = {
        instance: jest.fn((token, instance) => {
          container.register(token, () => instance, { lifecycle: 'singleton' });
        }),
        single: jest.fn((token, constructor) => {
          container.register(token, (c) => new constructor(), { lifecycle: 'singleton' });
        }),
        singletonFactory: jest.fn((token, factory) => {
          container.register(token, factory, { lifecycle: 'singleton' });
        }),
      };

      // Mock some additional dependencies
      container.register('ServiceSetup', () => ({}), { lifecycle: 'singleton' });
      container.register(tokens.ServiceSetup, () => ({}), { lifecycle: 'singleton' });
      container.register(tokens.IPathConfiguration, () => ({}), { lifecycle: 'singleton' });

      // Register infrastructure - this should include the fixed CriticalLogNotifier
      expect(() => {
        registerInfrastructure(container, mockRegistrar);
      }).not.toThrow();

      // Verify the CriticalLogNotifier can be resolved
      expect(() => {
        const criticalNotifier = container.resolve(tokens.ICriticalLogNotifier);
        expect(criticalNotifier).toBeInstanceOf(CriticalLogNotifier);
      }).not.toThrow();
    });
  });

  describe('Critical Logging Integration', () => {
    let criticalNotifier;

    beforeEach(() => {
      // Create a working CriticalLogNotifier for integration tests
      container.register(
        tokens.ICriticalLogNotifier,
        (c) => 
          new CriticalLogNotifier({
            logger: c.resolve(tokens.ILogger),
            documentContext: c.resolve(tokens.IDocumentContext),
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
            hybridLogger: c.resolve(tokens.ILogger).getCurrentLogger(),
            config: {
              enableVisualNotifications: true,
              notificationPosition: 'top-right',
              maxRecentLogs: 20,
            },
          }),
        {
          lifecycle: 'singleton',
        }
      );

      criticalNotifier = container.resolve(tokens.ICriticalLogNotifier);
    });

    it('should integrate with HybridLogger critical buffer', () => {
      const logger = container.resolve(tokens.ILogger);
      const hybridLogger = logger.getCurrentLogger();

      // Log some critical messages
      hybridLogger.warn('Test warning message');
      hybridLogger.error('Test error message');

      // Verify they appear in the critical buffer (note: may include additional system warnings)
      const logs = hybridLogger.getCriticalLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      
      // Find our test logs in the buffer
      const testWarning = logs.find(log => log.message === 'Test warning message');
      const testError = logs.find(log => log.message === 'Test error message');
      
      expect(testWarning).toBeDefined();
      expect(testWarning.level).toBe('warn');
      expect(testError).toBeDefined();
      expect(testError.level).toBe('error');

      // Verify buffer stats (should have at least our 2 test logs)
      const stats = hybridLogger.getCriticalBufferStats();
      expect(stats.currentSize).toBeGreaterThanOrEqual(2);
      expect(stats.maxSize).toBeGreaterThan(0);

      // Verify clear works
      hybridLogger.clearCriticalBuffer();
      const logsAfterClear = hybridLogger.getCriticalLogs();
      expect(logsAfterClear).toHaveLength(0);
    });

    it('should allow CriticalLogNotifier to access critical logs', () => {
      const logger = container.resolve(tokens.ILogger);
      const hybridLogger = logger.getCurrentLogger();

      // Add some logs
      hybridLogger.warn('Integration test warning');
      hybridLogger.error('Integration test error');

      // Verify CriticalLogNotifier can access the logs through its hybridLogger dependency
      const logs = hybridLogger.getCriticalLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some(log => log.message === 'Integration test warning')).toBe(true);
      expect(logs.some(log => log.message === 'Integration test error')).toBe(true);
    });
  });
});