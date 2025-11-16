/**
 * @file Test suite for character-concepts-manager logger accessibility
 * Tests to ensure logger is properly accessible from the controller
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CharacterConceptsManagerController } from '../../src/domUI/characterConceptsManagerController.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import {
  createTestContainer,
  resolveControllerDependencies,
} from '../common/testContainerConfig.js';

describe('Character Concepts Manager - Logger Accessibility', () => {
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let controller;
  let container;
  let controllerDependencies;

  beforeEach(async () => {
    // Mock logger with all required methods
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock character builder service
    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    container = await createTestContainer({
      mockServices: {
        [tokens.CharacterBuilderService]: mockCharacterBuilderService,
      },
    });
    controllerDependencies = resolveControllerDependencies(container);

    controller = new CharacterConceptsManagerController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      ...controllerDependencies,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    controller = null;
    container = null;
  });

  describe('Logger Getter', () => {
    it('should expose logger via public getter', () => {
      // This test will initially fail because logger getter doesn't exist
      expect(controller.logger).toBeDefined();
      expect(controller.logger).toBe(mockLogger);
    });

    it('should have all required logger methods accessible', () => {
      // This test will initially fail because logger getter doesn't exist
      expect(controller.logger).toBeDefined();
      expect(controller.logger.debug).toBeDefined();
      expect(controller.logger.info).toBeDefined();
      expect(controller.logger.warn).toBeDefined();
      expect(controller.logger.error).toBeDefined();
    });
  });

  describe('Page Visibility Handling', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
      // Set up JSDOM environment
      dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true,
      });
      window = dom.window;
      document = window.document;

      // Make global
      global.window = window;
      global.document = document;
    });

    afterEach(() => {
      if (dom && dom.window) {
        dom.window.close();
      }
    });

    it('should handle page visibility changes without errors', () => {
      // Simulate what setupPageVisibilityHandling does
      const logger = controller.logger;

      // This should not throw
      expect(() => {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            logger.info('Page hidden');
          } else {
            logger.info('Page visible');
          }
        });
      }).not.toThrow();

      // Trigger visibility change
      Object.defineProperty(document, 'hidden', {
        writable: true,
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new window.Event('visibilitychange'));

      expect(logger.info).toHaveBeenCalledWith('Page hidden');
    });

    it('should handle online/offline events without errors', () => {
      const logger = controller.logger;

      // This should not throw
      expect(() => {
        window.addEventListener('online', () => {
          logger.info('Connection restored');
        });

        window.addEventListener('offline', () => {
          logger.warn('Connection lost');
        });
      }).not.toThrow();

      // Trigger online event
      window.dispatchEvent(new window.Event('online'));
      expect(logger.info).toHaveBeenCalledWith('Connection restored');

      // Trigger offline event
      window.dispatchEvent(new window.Event('offline'));
      expect(logger.warn).toHaveBeenCalledWith('Connection lost');
    });
  });

  describe('Global Error Handling', () => {
    let window;

    beforeEach(() => {
      // Create a mock window object
      window = {
        addEventListener: jest.fn(),
      };
      global.window = window;
    });

    it('should set up error handlers without throwing', () => {
      const logger = controller.logger;

      // This should not throw
      expect(() => {
        window.addEventListener('error', (event) => {
          logger.error('Unhandled error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error,
          });
        });

        window.addEventListener('unhandledrejection', (event) => {
          logger.error('Unhandled promise rejection', {
            reason: event.reason,
            promise: event.promise,
          });
        });
      }).not.toThrow();

      // Verify event listeners were added
      expect(window.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
    });

    it('should log errors when error events occur', () => {
      const logger = controller.logger;
      let errorHandler;

      // Capture the error handler
      window.addEventListener.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Set up error handler
      window.addEventListener('error', (event) => {
        logger.error('Unhandled error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      });

      // Simulate an error event
      const mockErrorEvent = {
        message: 'Test error',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        error: new Error('Test error'),
        preventDefault: jest.fn(),
      };

      errorHandler(mockErrorEvent);

      expect(logger.error).toHaveBeenCalledWith('Unhandled error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        error: expect.any(Error),
      });
    });
  });
});
