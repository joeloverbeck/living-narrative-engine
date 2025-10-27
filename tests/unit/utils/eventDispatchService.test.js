// tests/unit/utils/eventDispatchService.test.js
/**
 * @file Unit tests for EventDispatchService
 */

import {
  EventDispatchService,
  InvalidDispatcherError,
} from '../../../src/utils/eventDispatchService.js';
import { createErrorDetails } from '../../../src/utils/errorDetails.js';
import {
  ATTEMPT_ACTION_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

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

    it('should use a generated stack trace when the error lacks one', async () => {
      // Arrange
      const errorWithoutStack = { message: 'No stack available' };
      mockSafeEventDispatcher.dispatch
        .mockRejectedValueOnce(errorWithoutStack)
        .mockReturnValueOnce(true);
      createErrorDetails.mockReturnValue({});

      const eventName = 'missing:stack';
      const payload = { foo: 'bar' };
      const context = 'fallback stack test';

      // Act
      await service.dispatchWithErrorHandling(eventName, payload, context);

      // Assert
      expect(createErrorDetails).toHaveBeenCalledTimes(1);
      const [messageArg, stackArg] = createErrorDetails.mock.calls[0];
      expect(messageArg).toBe(`Exception in dispatch for ${eventName}`);
      expect(typeof stackArg).toBe('string');
      expect(stackArg.length).toBeGreaterThan(0);
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

    it('should pass dispatcher options when provided', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      const eventId = 'test:event';
      const payload = { data: 'test' };
      const options = { allowSchemaNotFound: true };

      // Act
      await service.safeDispatchEvent(eventId, payload, options);

      // Assert
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventId,
        payload,
        options
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(`Dispatched ${eventId}`, {
        payload,
        options,
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

    it('should warn and return early when safeEventDispatcher has no dispatch method', async () => {
      // Arrange - Temporarily replace the dispatch method after construction
      const originalDispatch = mockSafeEventDispatcher.dispatch;
      mockSafeEventDispatcher.dispatch = null;

      const eventId = 'test:event';
      const payload = { data: 'test' };

      // Act
      await service.safeDispatchEvent(eventId, payload);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SafeEventDispatcher unavailable for ${eventId}`
      );

      // Restore for cleanup
      mockSafeEventDispatcher.dispatch = originalDispatch;
    });

    it('should warn and return early when safeEventDispatcher dispatch method is not a function', async () => {
      // Arrange - Temporarily replace the dispatch method after construction
      const originalDispatch = mockSafeEventDispatcher.dispatch;
      mockSafeEventDispatcher.dispatch = 'not a function';

      const eventId = 'test:event';
      const payload = { data: 'test' };

      // Act
      await service.safeDispatchEvent(eventId, payload);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SafeEventDispatcher unavailable for ${eventId}`
      );

      // Restore for cleanup
      mockSafeEventDispatcher.dispatch = originalDispatch;
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
      // Arrange - Temporarily replace the dispatch method after construction
      const originalDispatch = mockSafeEventDispatcher.dispatch;
      mockSafeEventDispatcher.dispatch = null;

      // Act & Assert
      expect(() => {
        service.dispatchSystemError(
          'Test',
          {},
          { throwOnInvalidDispatcher: true }
        );
      }).toThrow(InvalidDispatcherError);

      // Restore for cleanup
      mockSafeEventDispatcher.dispatch = originalDispatch;
    });

    it('should not throw when dispatcher is invalid and throwOnInvalidDispatcher is false', () => {
      // Arrange - Temporarily replace the dispatch method after construction
      const originalDispatch = mockSafeEventDispatcher.dispatch;
      mockSafeEventDispatcher.dispatch = null;

      // Act & Assert
      expect(() => {
        service.dispatchSystemError('Test', {});
      }).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();

      // Restore for cleanup
      mockSafeEventDispatcher.dispatch = originalDispatch;
    });

    it('should handle synchronous errors in async mode', async () => {
      // Arrange
      const syncError = new Error('Synchronous error');
      mockSafeEventDispatcher.dispatch.mockImplementation(() => {
        throw syncError;
      });
      const message = 'Test sync error in async';
      const details = { test: true };

      // Act
      const result = await service.dispatchSystemError(message, details, {
        async: true,
      });

      // Assert
      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to dispatch system error event: ${message}`,
        expect.objectContaining({
          originalDetails: details,
          dispatchError: syncError,
        })
      );
    });

    it('should handle non-Promise return values in async mode', async () => {
      // Arrange
      mockSafeEventDispatcher.dispatch.mockReturnValue('not a promise');
      const message = 'Test non-promise return';
      const details = { test: true };

      // Act
      const result = await service.dispatchSystemError(message, details, {
        async: true,
      });

      // Assert
      expect(result).toBeUndefined();
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        { message, details }
      );
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
      // Arrange - Temporarily replace the dispatch method after construction
      const originalDispatch = mockSafeEventDispatcher.dispatch;
      mockSafeEventDispatcher.dispatch = null;

      // Act & Assert
      expect(() => {
        service.dispatchValidationError('Test');
      }).toThrow(InvalidDispatcherError);

      // Restore for cleanup
      mockSafeEventDispatcher.dispatch = originalDispatch;
    });
  });

  describe('tracing functionality', () => {
    let mockActionTraceFilter;
    let mockEventDispatchTracer;
    let mockEventTrace;

    beforeEach(() => {
      mockActionTraceFilter = {
        isEnabled: jest.fn(),
        shouldTrace: jest.fn(),
      };

      mockEventTrace = {
        captureDispatchStart: jest.fn(),
        captureDispatchSuccess: jest.fn(),
        captureDispatchError: jest.fn(),
      };

      mockEventDispatchTracer = {
        createTrace: jest.fn().mockReturnValue(mockEventTrace),
        writeTrace: jest.fn().mockResolvedValue(undefined),
      };

      service = new EventDispatchService({
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventDispatchTracer: mockEventDispatchTracer,
      });
    });

    describe('dispatchWithErrorHandling with tracing', () => {
      it('should handle trace creation errors gracefully', async () => {
        // Arrange
        const traceError = new Error('Trace creation failed');
        mockActionTraceFilter.isEnabled.mockReturnValue(true);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
        mockEventDispatchTracer.createTrace.mockImplementation(() => {
          throw traceError;
        });
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
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to create event dispatch trace',
          traceError
        );
        expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalled();
      });

      it('should handle trace write errors gracefully on success', async () => {
        // Arrange
        const writeError = new Error('Trace write failed');
        mockActionTraceFilter.isEnabled.mockReturnValue(true);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
        mockEventDispatchTracer.writeTrace.mockRejectedValue(writeError);
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
        expect(mockEventTrace.captureDispatchSuccess).toHaveBeenCalled();
        expect(mockEventDispatchTracer.writeTrace).toHaveBeenCalledWith(
          mockEventTrace
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to write event dispatch trace',
          writeError
        );
      });

      it('should handle trace write errors gracefully on dispatch failure', async () => {
        // Arrange
        const dispatchError = {
          message: 'Dispatch failed',
          stack: 'test stack',
        };
        const writeError = {
          message: 'Trace write failed',
          stack: 'test stack',
        };
        mockActionTraceFilter.isEnabled.mockReturnValue(true);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
        mockEventDispatchTracer.writeTrace.mockRejectedValue(writeError);

        // First call fails (original event), second call succeeds (system error)
        mockSafeEventDispatcher.dispatch
          .mockRejectedValueOnce(dispatchError)
          .mockReturnValueOnce(true);

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
        expect(mockEventTrace.captureDispatchError).toHaveBeenCalledWith(
          dispatchError,
          expect.objectContaining({ context })
        );
        expect(mockEventDispatchTracer.writeTrace).toHaveBeenCalledWith(
          mockEventTrace
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to write event dispatch trace',
          writeError
        );
      });

      it('should not trace when actionTraceFilter is disabled', async () => {
        // Arrange
        mockActionTraceFilter.isEnabled.mockReturnValue(false);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
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
        expect(mockEventDispatchTracer.createTrace).not.toHaveBeenCalled();
        expect(mockActionTraceFilter.isEnabled).toHaveBeenCalled();
      });

      it('should trace ATTEMPT_ACTION_ID events using action definition ID', async () => {
        // Arrange
        mockActionTraceFilter.isEnabled.mockReturnValue(true);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
        mockSafeEventDispatcher.dispatch.mockResolvedValue(true);

        const eventName = ATTEMPT_ACTION_ID;
        const payload = {
          action: { definitionId: 'test:action' },
          data: 'test',
        };
        const context = 'test context';

        // Act
        const result = await service.dispatchWithErrorHandling(
          eventName,
          payload,
          context
        );

        // Assert
        expect(result).toBe(true);
        expect(mockActionTraceFilter.shouldTrace).toHaveBeenCalledWith(
          'test:action'
        );
        expect(mockEventDispatchTracer.createTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            eventName,
            payload: expect.objectContaining({
              action: { definitionId: 'test:action' },
            }),
            context,
          })
        );
      });

      it('should trace non-action events using event name', async () => {
        // Arrange
        mockActionTraceFilter.isEnabled.mockReturnValue(true);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
        mockSafeEventDispatcher.dispatch.mockResolvedValue(true);

        const eventName = 'OTHER_EVENT_TYPE';
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
        expect(mockActionTraceFilter.shouldTrace).toHaveBeenCalledWith(
          'OTHER_EVENT_TYPE'
        );
      });
    });

    describe('payload sanitization', () => {
      beforeEach(() => {
        mockActionTraceFilter.isEnabled.mockReturnValue(true);
        mockActionTraceFilter.shouldTrace.mockReturnValue(true);
        mockSafeEventDispatcher.dispatch.mockResolvedValue(true);
      });

      it('should sanitize sensitive fields in payload', async () => {
        // Arrange
        const eventName = 'test:event';
        const payload = {
          data: 'test',
          password: 'secretpass',
          token: 'secrettoken',
          apiKey: 'secretkey',
          secret: 'secretvalue',
          credential: 'secretcred',
        };
        const context = 'test context';

        // Act
        await service.dispatchWithErrorHandling(eventName, payload, context);

        // Assert
        expect(mockEventDispatchTracer.createTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: {
              data: 'test',
              password: '[REDACTED]',
              token: '[REDACTED]',
              apiKey: '[REDACTED]',
              secret: '[REDACTED]',
              credential: '[REDACTED]',
            },
          })
        );
      });

      it('should handle null payload during sanitization', async () => {
        // Arrange
        const eventName = 'test:event';
        const payload = null;
        const context = 'test context';

        // Act
        await service.dispatchWithErrorHandling(eventName, payload, context);

        // Assert
        expect(mockEventDispatchTracer.createTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: null,
          })
        );
      });

      it('should handle non-object payload during sanitization', async () => {
        // Arrange
        const eventName = 'test:event';
        const payload = 'string payload';
        const context = 'test context';

        // Act
        await service.dispatchWithErrorHandling(eventName, payload, context);

        // Assert
        expect(mockEventDispatchTracer.createTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: 'string payload',
          })
        );
      });
    });
  });
});

describe('InvalidDispatcherError', () => {
  it('defaults details to an empty object when omitted', () => {
    const error = new InvalidDispatcherError('boom');

    expect(error.details).toEqual({});
    expect(error.message).toBe('boom');
  });
});
