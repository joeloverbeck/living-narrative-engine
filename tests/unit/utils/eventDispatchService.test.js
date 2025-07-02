// tests/unit/utils/eventDispatchService.test.js
/**
 * @file Unit tests for EventDispatchService
 */

import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { createErrorDetails } from '../../../src/utils/errorDetails.js';

// Mock the dependencies
jest.mock('../../../src/utils/safeDispatchErrorUtils.js');
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
      mockSafeEventDispatcher.dispatch.mockRejectedValue(error);
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
      expect(safeDispatchError).toHaveBeenCalledWith(
        mockSafeEventDispatcher,
        'System error during event dispatch.',
        expect.any(Object),
        mockLogger
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
});
