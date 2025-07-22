/**
 * @file Test suite for SafeEventDispatcher initialization
 * @description Ensures SafeEventDispatcher is properly initialized with required dependencies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

describe('SafeEventDispatcher - Initialization', () => {
  let mockLogger;
  let mockValidatedEventDispatcher;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: mockValidatedEventDispatcher,
        logger: mockLogger,
      });

      expect(safeDispatcher).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SafeEventDispatcher: Instance created successfully.'
      );
    });

    it('should throw error when validatedEventDispatcher is missing', () => {
      expect(() => {
        new SafeEventDispatcher({
          logger: mockLogger,
        });
      }).toThrow(
        'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency'
      );
    });

    it('should throw error when validatedEventDispatcher lacks dispatch method', () => {
      const invalidDispatcher = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      expect(() => {
        new SafeEventDispatcher({
          validatedEventDispatcher: invalidDispatcher,
          logger: mockLogger,
        });
      }).toThrow(
        'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency'
      );
    });

    it('should throw error when validatedEventDispatcher lacks subscribe method', () => {
      const invalidDispatcher = {
        dispatch: jest.fn(),
        unsubscribe: jest.fn(),
      };

      expect(() => {
        new SafeEventDispatcher({
          validatedEventDispatcher: invalidDispatcher,
          logger: mockLogger,
        });
      }).toThrow(
        'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency'
      );
    });

    it('should throw error when validatedEventDispatcher lacks unsubscribe method', () => {
      const invalidDispatcher = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      };

      expect(() => {
        new SafeEventDispatcher({
          validatedEventDispatcher: invalidDispatcher,
          logger: mockLogger,
        });
      }).toThrow(
        'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new SafeEventDispatcher({
          validatedEventDispatcher: mockValidatedEventDispatcher,
        });
      }).toThrow('SafeEventDispatcher: Invalid or missing logger dependency');
    });

    it('should throw error when logger lacks error method', () => {
      const invalidLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      };

      expect(() => {
        new SafeEventDispatcher({
          validatedEventDispatcher: mockValidatedEventDispatcher,
          logger: invalidLogger,
        });
      }).toThrow('SafeEventDispatcher: Invalid or missing logger dependency');
    });

    it('should throw error when logger lacks debug method', () => {
      const invalidLogger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      };

      expect(() => {
        new SafeEventDispatcher({
          validatedEventDispatcher: mockValidatedEventDispatcher,
          logger: invalidLogger,
        });
      }).toThrow('SafeEventDispatcher: Invalid or missing logger dependency');
    });

    it('should log error before throwing when validatedEventDispatcher is invalid', () => {
      try {
        new SafeEventDispatcher({
          logger: mockLogger,
        });
      } catch (error) {
        // Expected to throw
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency (requires dispatch, subscribe, and unsubscribe methods).'
      );
    });
  });

  describe('integration with event chain', () => {
    it('should properly integrate with EventBus -> ValidatedEventDispatcher -> SafeEventDispatcher chain', async () => {
      // This test documents the proper initialization pattern
      const EventBus = jest.fn().mockImplementation(() => ({
        dispatch: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn().mockReturnValue(() => {}),
        unsubscribe: jest.fn(),
      }));

      const ValidatedEventDispatcher = jest.fn().mockImplementation(() => ({
        dispatch: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn().mockReturnValue(() => {}),
        unsubscribe: jest.fn(),
      }));

      const GameDataRepository = jest.fn().mockImplementation(() => ({}));
      const AjvSchemaValidator = jest.fn().mockImplementation(() => ({}));

      // Proper initialization chain
      const eventBus = new EventBus({ logger: mockLogger });
      const mockRegistry = {}; // Empty mock registry for testing
      const gameDataRepository = new GameDataRepository(
        mockRegistry,
        mockLogger
      );
      const validatedEventDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository,
        schemaValidator: new AjvSchemaValidator({ logger: mockLogger }),
        logger: mockLogger,
      });
      const safeEventDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher,
        logger: mockLogger,
      });

      expect(safeEventDispatcher).toBeDefined();

      // Test that it can dispatch events
      const result = await safeEventDispatcher.dispatch('TEST_EVENT', {
        data: 'test',
      });
      expect(result).toBe(true);
    });
  });
});
