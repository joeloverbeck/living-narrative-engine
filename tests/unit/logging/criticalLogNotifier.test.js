/**
 * @file Unit tests for CriticalLogNotifier - reproduction test for dependency validation failure
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
import HybridLogger from '../../../src/logging/hybridLogger.js';
import { JSDOM } from 'jsdom';

describe('CriticalLogNotifier - Dependency Validation', () => {
  let testBed;
  let dom;
  let hybridLogger;
  let mockConsoleLogger;
  let mockRemoteLogger;
  let mockCategoryDetector;

  beforeEach(() => {
    testBed = createTestBed();
    
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

    // Create mock dependencies for HybridLogger
    mockConsoleLogger = testBed.createMock('consoleLogger', ['debug', 'info', 'warn', 'error']);
    mockRemoteLogger = testBed.createMock('remoteLogger', ['debug', 'info', 'warn', 'error']);
    mockCategoryDetector = testBed.createMock('categoryDetector', ['detectCategory']);
    mockCategoryDetector.detectCategory.mockReturnValue('general');

    // Create HybridLogger instance
    hybridLogger = new HybridLogger({
      consoleLogger: mockConsoleLogger,
      remoteLogger: mockRemoteLogger,
      categoryDetector: mockCategoryDetector,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.navigator;
    delete global.localStorage;
    jest.clearAllMocks();
  });

  describe('Dependency Validation', () => {
    it('should successfully instantiate CriticalLogNotifier with valid HybridLogger', () => {
      const mockLogger = testBed.createMockLogger();
      const mockDocumentContext = {
        query: jest.fn((selector) => {
          if (selector === 'document') return document;
          return document.querySelector(selector);
        }),
        create: jest.fn((tagName) => document.createElement(tagName)),
        getDocument: () => document,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const mockValidatedEventDispatcher = testBed.createMock('validatedEventDispatcher', ['dispatch', 'subscribe']);

      // Verify the HybridLogger has the required methods
      expect(typeof hybridLogger.getCriticalLogs).toBe('function');
      expect(typeof hybridLogger.getCriticalBufferStats).toBe('function');
      expect(typeof hybridLogger.clearCriticalBuffer).toBe('function');

      // Should successfully create CriticalLogNotifier with valid HybridLogger
      let notifier;
      expect(() => {
        notifier = new CriticalLogNotifier({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          hybridLogger: hybridLogger,
          config: {
            enableVisualNotifications: true,
          },
        });
      }).not.toThrow();

      expect(notifier).toBeDefined();
      
      // Clean up
      if (notifier && typeof notifier.dispose === 'function') {
        notifier.dispose();
      }
    });

    it('should throw error when hybridLogger is missing required methods', () => {
      const mockLogger = testBed.createMockLogger();
      const mockDocumentContext = {
        query: jest.fn((selector) => {
          if (selector === 'document') return document;
          return document.querySelector(selector);
        }),
        create: jest.fn((tagName) => document.createElement(tagName)),
        getDocument: () => document,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const mockValidatedEventDispatcher = testBed.createMock('validatedEventDispatcher', ['dispatch', 'subscribe']);

      // Create a mock that's missing the required methods
      const incompleteMockHybridLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        // Missing: getCriticalLogs, getCriticalBufferStats, clearCriticalBuffer
      };

      // Should throw when missing methods
      expect(() => {
        new CriticalLogNotifier({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          hybridLogger: incompleteMockHybridLogger,
          config: {
            enableVisualNotifications: true,
          },
        });
      }).toThrow('Invalid or missing method \'getCriticalLogs\' on dependency \'HybridLogger\'');
    });

    it('should throw error when hybridLogger methods are not functions', () => {
      const mockLogger = testBed.createMockLogger();
      const mockDocumentContext = {
        query: jest.fn((selector) => {
          if (selector === 'document') return document;
          return document.querySelector(selector);
        }),
        create: jest.fn((tagName) => document.createElement(tagName)),
        getDocument: () => document,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      const mockValidatedEventDispatcher = testBed.createMock('validatedEventDispatcher', ['dispatch', 'subscribe']);

      // Create a mock with non-function properties
      const invalidMockHybridLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        getCriticalLogs: 'not-a-function',  // Invalid: string instead of function
        getCriticalBufferStats: jest.fn(),
        clearCriticalBuffer: jest.fn(),
      };

      // Should throw when methods aren't functions
      expect(() => {
        new CriticalLogNotifier({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          hybridLogger: invalidMockHybridLogger,
          config: {
            enableVisualNotifications: true,
          },
        });
      }).toThrow('Invalid or missing method \'getCriticalLogs\' on dependency \'HybridLogger\'');
    });

    it('should verify HybridLogger methods exist and are callable', () => {
      // Verify that the methods exist and work
      expect(hybridLogger.getCriticalLogs).toBeDefined();
      expect(typeof hybridLogger.getCriticalLogs).toBe('function');
      
      expect(hybridLogger.getCriticalBufferStats).toBeDefined();
      expect(typeof hybridLogger.getCriticalBufferStats).toBe('function');
      
      expect(hybridLogger.clearCriticalBuffer).toBeDefined();
      expect(typeof hybridLogger.clearCriticalBuffer).toBe('function');

      // Test that methods are actually callable
      const logs = hybridLogger.getCriticalLogs();
      expect(Array.isArray(logs)).toBe(true);
      
      const stats = hybridLogger.getCriticalBufferStats();
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('currentSize');
      expect(stats).toHaveProperty('maxSize');
      
      // This should not throw
      expect(() => hybridLogger.clearCriticalBuffer()).not.toThrow();
    });
  });

  describe('Method Enumeration Investigation', () => {
    it('should investigate if methods are enumerable', () => {
      // Check if methods are enumerable properties
      const ownKeys = Object.getOwnPropertyNames(hybridLogger);
      const prototypeKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(hybridLogger));
      
      console.log('Own keys:', ownKeys);
      console.log('Prototype keys:', prototypeKeys);
      console.log('getCriticalLogs enumerable on instance:', Object.propertyIsEnumerable.call(hybridLogger, 'getCriticalLogs'));
      console.log('getCriticalLogs enumerable on prototype:', Object.propertyIsEnumerable.call(Object.getPrototypeOf(hybridLogger), 'getCriticalLogs'));
      
      // Check descriptor
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(hybridLogger), 'getCriticalLogs');
      console.log('getCriticalLogs descriptor:', descriptor);

      // This test helps debug why validation might fail
      expect(hybridLogger.getCriticalLogs).toBeDefined();
    });

    it('should test hasOwnProperty vs in operator', () => {
      // Test different ways to check for method existence
      expect('getCriticalLogs' in hybridLogger).toBe(true);
      expect(hybridLogger.hasOwnProperty('getCriticalLogs')).toBe(false); // Should be false for prototype methods
      expect(Object.getPrototypeOf(hybridLogger).hasOwnProperty('getCriticalLogs')).toBe(true);
      
      // Test the method validation approach
      expect(typeof hybridLogger.getCriticalLogs === 'function').toBe(true);
    });
  });
});