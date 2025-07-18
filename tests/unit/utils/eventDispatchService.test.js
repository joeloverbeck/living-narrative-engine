// tests/unit/utils/eventDispatchService.test.js
/**
 * @file Unit tests for EventDispatchService
 */

import {
  EventDispatchService,
  InvalidDispatcherError,
} from '../../../src/utils/eventDispatchService.js';
import { createErrorDetails } from '../../../src/utils/errorDetails.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

// Mock the dependencies
jest.mock('../../../src/utils/errorDetails.js');

describe('EventDispatchService', () => {
  let mockSafeEventDispatcher;
  let mockLogger;
  let service;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock safeEventDispatcher
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create service instance
    service = new EventDispatchService({
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should throw error if safeEventDispatcher is missing', () => {
      expect(() => {
        new EventDispatchService({ logger: mockLogger });
      }).toThrow('EventDispatchService: safeEventDispatcher is required');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new EventDispatchService({
          safeEventDispatcher: mockSafeEventDispatcher,
        });
      }).toThrow('EventDispatchService: logger is required');
    });
  });

  describe('dispatchWithLogging', () => {
    it('should dispatch event and log success', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const eventName = 'test:event';
      const payload = { data: 'test' };

      // Act
      await service.dispatchWithLogging(eventName, payload);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload,
        {}
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Dispatched '${eventName}'.`
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should include identifier in log message when provided', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const eventName = 'test:event';
      const payload = { data: 'test' };
      const identifier = 'testEntity';

      // Act
      await service.dispatchWithLogging(eventName, payload, identifier);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Dispatched '${eventName}' for ${identifier}.`
      );
    });

    it('should log error when dispatch fails', async () => {
      // Arrange
      const error = new Error('Dispatch failed');
      mockSafeEventDispatcher.dispatch.mockRejectedValue(error);
      const eventName = 'test:event';
      const payload = { data: 'test' };

      // Act
      await service.dispatchWithLogging(eventName, payload);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed dispatching '${eventName}' event.`,
        error
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should pass options to dispatcher', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const eventName = 'test:event';
      const payload = { data: 'test' };
      const options = { allowSchemaNotFound: true };

      // Act
      await service.dispatchWithLogging(eventName, payload, '', options);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload,
        options
      );
    });
  });

  describe('dispatchWithErrorHandling', () => {
    it('should dispatch event and return true on success', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const eventName = 'test:event';
      const payload = { data: 'test' };
      const context = 'test context';

      // Act
      const result = await service.dispatchWithErrorHandling(
        eventName,
        payload,
        context
      );

      // Assert
      expect(result).toBe(true);
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `dispatchWithErrorHandling: Attempting dispatch: ${context} ('${eventName}')`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `dispatchWithErrorHandling: Dispatch successful for ${context}.`
      );
    });

    it('should log warning and return false when dispatcher returns false', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(false);
      const eventName = 'test:event';
      const payload = { data: 'test' };
      const context = 'test context';

      // Act
      const result = await service.dispatchWithErrorHandling(
        eventName,
        payload,
        context
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SafeEventDispatcher reported failure')
      );
    });

    it('should handle exceptions and dispatch system error', async () => {
      // Arrange
      const error = new Error('Dispatch error');
      // First call throws, second call (for system error) succeeds
      mockSafeEventDispatcher.dispatch
        .mockRejectedValueOnce(error)
        .mockReturnValueOnce(true);
      createErrorDetails.mockReturnValue({
        message: 'Error details',
        stack: 'Stack trace',
      });
      const eventName = 'test:event';
      const payload = { data: 'test' };
      const context = 'test context';

      // Act
      const result = await service.dispatchWithErrorHandling(
        eventName,
        payload,
        context
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL - Error during dispatch'),
        error
      );
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'System error during event dispatch.',
          details: expect.any(Object),
        }
      );
    });
  });

  describe('safeDispatchEvent', () => {
    it('should dispatch event successfully', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const eventId = 'test:event';
      const payload = { data: 'test' };

      // Act
      await service.safeDispatchEvent(eventId, payload);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventId,
        payload
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(`Dispatched ${eventId}`, {
        payload,
      });
    });

    it('should log error when dispatch fails', async () => {
      // Arrange
      const error = new Error('Dispatch failed');
      mockSafeEventDispatcher.dispatch.mockRejectedValue(error);
      const eventId = 'test:event';
      const payload = { data: 'test' };

      // Act
      await service.safeDispatchEvent(eventId, payload);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to dispatch ${eventId}`,
        error
      );
    });
  });

  describe('dispatchSystemError', () => {
    it('should dispatch system error synchronously by default', () => {
      // Arrange
      const message = 'Test error message';
      const details = { code: 'TEST_ERROR' };

      // Act
      service.dispatchSystemError(message, details);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        { message, details }
      );
    });

    it('should dispatch system error asynchronously when async option is true', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const message = 'Test async error';
      const details = { async: true };

      // Act
      await service.dispatchSystemError(message, details, { async: true });

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        { message, details }
      );
    });

    it('should log error when sync dispatch fails', () => {
      // Arrange
      const error = new Error('Dispatch failed');
      mockSafeEventDispatcher.dispatch.mockImplementation(() => {
        throw error;
      });
      const message = 'Test error';

      // Act
      service.dispatchSystemError(message);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to dispatch system error event: ${message}`,
        expect.objectContaining({
          originalDetails: {},
          dispatchError: error,
        })
      );
    });

    it('should log error when async dispatch fails', async () => {
      // Arrange
      const error = new Error('Async dispatch failed');
      mockSafeEventDispatcher.dispatch.mockReturnValue(Promise.reject(error));
      const message = 'Test async error';
      const details = { test: true };

      // Act
      await service.dispatchSystemError(message, details, { async: true });

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to dispatch system error event: ${message}`,
        expect.objectContaining({
          originalDetails: details,
          dispatchError: error,
        })
      );
    });

    it('should throw InvalidDispatcherError when dispatcher is invalid and throwOnInvalidDispatcher is true', () => {
      // Arrange - Create service with invalid dispatcher
      mockSafeEventDispatcher.dispatch = null;

      // Act & Assert
      expect(() => {
        service.dispatchSystemError(
          'Test',
          {},
          { throwOnInvalidDispatcher: true }
        );
      }).toThrow(InvalidDispatcherError);
    });

    it('should not throw when dispatcher is invalid and throwOnInvalidDispatcher is false', () => {
      // Arrange - We can't create EventDispatchService with null dispatcher
      // because constructor throws. Instead, let's test the error path differently.
      mockSafeEventDispatcher.dispatch = null;

      // Act & Assert
      expect(() => {
        service.dispatchSystemError('Test', {});
      }).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('dispatchValidationError', () => {
    it('should dispatch system error and return result with details', () => {
      // Arrange
      const message = 'Validation failed';
      const details = { field: 'email', reason: 'invalid format' };

      // Act
      const result = service.dispatchValidationError(message, details);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        { message, details }
      );
      expect(result).toEqual({
        ok: false,
        error: message,
        details,
      });
    });

    it('should dispatch system error and return result without details when details are undefined', () => {
      // Arrange
      const message = 'Validation failed';

      // Act
      const result = service.dispatchValidationError(message);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        { message, details: {} }
      );
      expect(result).toEqual({
        ok: false,
        error: message,
      });
    });

    it('should throw when dispatcher is invalid', () => {
      // Arrange
      mockSafeEventDispatcher.dispatch = null;

      // Act & Assert
      expect(() => {
        service.dispatchValidationError('Test');
      }).toThrow(InvalidDispatcherError);
    });
  });
});
