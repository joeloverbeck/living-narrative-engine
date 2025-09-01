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

  describe('Dependency Validation Issue Reproduction', () => {
    it('should reproduce the getCriticalLogs method not found error', () => {
      // This test reproduces the exact error from the logs:
      // "Invalid or missing method 'getCriticalLogs' on dependency 'HybridLogger'"
      
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

      // First, let's verify the HybridLogger actually has the required methods
      expect(typeof hybridLogger.getCriticalLogs).toBe('function');
      expect(typeof hybridLogger.getCriticalBufferStats).toBe('function');
      expect(typeof hybridLogger.clearCriticalBuffer).toBe('function');

      // Now try to create the CriticalLogNotifier - this should fail with the error from logs
      expect(() => {
        new CriticalLogNotifier({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          hybridLogger: hybridLogger,
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

    it('should test validateDependency function behavior with HybridLogger', () => {
      // Import the validateDependency function to test it directly
      const { validateDependency } = require('../../../src/utils/dependencyUtils.js');
      const mockLogger = testBed.createMockLogger();

      // This should reproduce the exact validation failure
      expect(() => {
        validateDependency(hybridLogger, 'HybridLogger', mockLogger, {
          requiredMethods: [
            'getCriticalLogs',
            'getCriticalBufferStats', 
            'clearCriticalBuffer',
          ],
        });
      }).toThrow('Invalid or missing method \'getCriticalLogs\' on dependency \'HybridLogger\'');
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