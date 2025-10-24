import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResilientServiceWrapper } from '../../../../../src/actions/tracing/resilience/resilientServiceWrapper.js';
import { TraceErrorType } from '../../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('ResilientServiceWrapper', () => {
  let wrapper;
  let mockService;
  let mockErrorHandler;
  let mockLogger;

  beforeEach(() => {
    jest.useFakeTimers();
    mockService = {
      writeTrace: jest.fn().mockResolvedValue(),
      outputTrace: jest.fn().mockResolvedValue(),
      shouldTrace: jest.fn().mockReturnValue(true),
      isEnabled: jest.fn().mockReturnValue(true),
      getConfig: jest.fn().mockReturnValue({ enabled: true }),
      getInclusionConfig: jest.fn().mockReturnValue({ all: true }),
      someMethod: jest.fn().mockResolvedValue('success'),
    };

    mockErrorHandler = {
      handleError: jest.fn().mockResolvedValue({
        errorId: 'error-123',
        handled: true,
        severity: 'low',
        recoveryAction: 'continue',
        shouldContinue: true,
        fallbackMode: null,
      }),
      shouldDisableComponent: jest.fn().mockReturnValue(false),
      getErrorStatistics: jest.fn().mockReturnValue({
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        recentErrors: 0,
      }),
    };

    mockLogger = createMockLogger();

    wrapper = new ResilientServiceWrapper({
      service: mockService,
      errorHandler: mockErrorHandler,
      logger: mockLogger,
      serviceName: 'TestService',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create wrapper with valid dependencies', () => {
      expect(wrapper).toBeInstanceOf(ResilientServiceWrapper);
    });

    it('should throw if errorHandler is missing', () => {
      expect(() => {
        new ResilientServiceWrapper({
          service: mockService,
          errorHandler: null,
          logger: mockLogger,
          serviceName: 'TestService',
        });
      }).toThrow();
    });

    it('should create wrapper with invalid logger (fallback)', () => {
      // ensureValidLogger provides a fallback, so this won't throw
      const wrapper = new ResilientServiceWrapper({
        service: mockService,
        errorHandler: mockErrorHandler,
        logger: null,
        serviceName: 'TestService',
      });
      expect(wrapper).toBeInstanceOf(ResilientServiceWrapper);
    });
  });

  describe('createResilientProxy', () => {
    it('should create a proxy that wraps service methods', async () => {
      const proxy = wrapper.createResilientProxy();

      await proxy.someMethod('arg1', 'arg2');

      expect(mockService.someMethod).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should pass through non-function properties', () => {
      mockService.someProperty = 'value';
      const proxy = wrapper.createResilientProxy();

      expect(proxy.someProperty).toBe('value');
    });

    it('should handle successful method calls', async () => {
      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(result).toBe('success');
      expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle method errors', async () => {
      const error = new Error('Method failed');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          componentName: 'TestService',
          methodName: 'someMethod',
          argumentCount: 0,
        }),
        TraceErrorType.UNKNOWN
      );
    });
  });

  describe('Service enable/disable', () => {
    it('should be enabled by default', () => {
      expect(wrapper.isEnabled()).toBe(true);
    });

    it('should disable service with reason', () => {
      wrapper.disable('Test reason');

      expect(wrapper.isEnabled()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Service disabled: TestService',
        { reason: 'Test reason' }
      );
    });

    it('should re-enable service', () => {
      wrapper.disable('Test reason');
      wrapper.enable();

      expect(wrapper.isEnabled()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Service re-enabled: TestService'
      );
    });

    it('should return fallback when service is disabled', async () => {
      wrapper.disable('Test reason');
      const proxy = wrapper.createResilientProxy();

      const writeResult = await proxy.writeTrace();
      expect(writeResult).toBeUndefined();

      const shouldTraceResult = await proxy.shouldTrace();
      expect(shouldTraceResult).toBe(false);

      const configResult = await proxy.getConfig();
      expect(configResult).toEqual({});
    });

    it('should auto-disable when error threshold exceeded', async () => {
      mockErrorHandler.shouldDisableComponent.mockReturnValue(true);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(wrapper.isEnabled()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Service disabled: TestService',
        { reason: 'Error pattern threshold exceeded' }
      );
    });
  });

  describe('Error classification', () => {
    it('should classify validation errors', async () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.VALIDATION
      );
    });

    it('should classify file system errors', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.FILE_SYSTEM
      );
    });

    it('should classify timeout errors', async () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.TIMEOUT
      );
    });

    it('should classify memory errors', async () => {
      const error = new Error('Out of memory');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.MEMORY
      );
    });
  });

  describe('Recovery actions', () => {
    it('should continue on continue recovery action', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);
      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(result).toBeUndefined();
    });

    it('should handle retry recovery action', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);
      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'retry',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const resultPromise = proxy.someMethod();

      // Run all timers to handle retry delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBeUndefined();
    });

    it('should handle fallback recovery action', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);
      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'fallback',
        shouldContinue: true,
        fallbackMode: 'degraded',
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(wrapper.getFallbackMode()).toBe('degraded');
      expect(result).toBeUndefined();
    });

    it('should handle disable recovery action', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);
      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'disable',
        shouldContinue: false,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(wrapper.isEnabled()).toBe(false);
      expect(result).toBeUndefined();
    });
  });

  describe('Fallback behaviors', () => {
    it('should return no-op for write methods when disabled', async () => {
      wrapper.disable('Test');
      const proxy = wrapper.createResilientProxy();

      const writeResult = await proxy.writeTrace();
      expect(writeResult).toBeUndefined();
      expect(mockService.writeTrace).not.toHaveBeenCalled();

      const outputResult = await proxy.outputTrace();
      expect(outputResult).toBeUndefined();
      expect(mockService.outputTrace).not.toHaveBeenCalled();
    });

    it('should return false for boolean methods when disabled', async () => {
      wrapper.disable('Test');
      const proxy = wrapper.createResilientProxy();

      const shouldTraceResult = await proxy.shouldTrace();
      expect(shouldTraceResult).toBe(false);
      expect(mockService.shouldTrace).not.toHaveBeenCalled();

      const isEnabledResult = await proxy.isEnabled();
      expect(isEnabledResult).toBe(false);
      expect(mockService.isEnabled).not.toHaveBeenCalled();
    });

    it('should return empty config for config methods when disabled', async () => {
      wrapper.disable('Test');
      const proxy = wrapper.createResilientProxy();

      const configResult = await proxy.getConfig();
      expect(configResult).toEqual({});
      expect(mockService.getConfig).not.toHaveBeenCalled();

      const inclusionResult = await proxy.getInclusionConfig();
      expect(inclusionResult).toEqual({});
      expect(mockService.getInclusionConfig).not.toHaveBeenCalled();
    });
  });

  describe('Fallback mode recovery', () => {
    it('should reset fallback mode on successful execution', async () => {
      // First set fallback mode through an error
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValueOnce(error);
      mockErrorHandler.handleError.mockResolvedValueOnce({
        recoveryAction: 'fallback',
        shouldContinue: true,
        fallbackMode: 'degraded',
      });

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();
      expect(wrapper.getFallbackMode()).toBe('degraded');

      // Now succeed and check fallback is reset
      mockService.someMethod.mockResolvedValueOnce('success');
      await proxy.someMethod();

      expect(wrapper.getFallbackMode()).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Service recovered from fallback mode: TestService'
      );
    });
  });

  describe('Error threshold auto-disable', () => {
    it('should disable service when error count exceeds 5 within 5-minute window', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();

      // Trigger 6 errors to exceed threshold
      for (let i = 0; i < 6; i++) {
        await proxy.someMethod();
      }

      // After 6th error, service should be disabled
      expect(wrapper.isEnabled()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Service disabled: TestService',
        { reason: 'Error threshold exceeded' }
      );
    });

    it('should reset error count after 5-minute window expires', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();

      // Trigger 5 errors (not exceeding threshold)
      for (let i = 0; i < 5; i++) {
        await proxy.someMethod();
      }
      expect(wrapper.isEnabled()).toBe(true);

      // Advance time by more than 5 minutes
      jest.advanceTimersByTime(301000); // 5 minutes + 1 second

      // Trigger another error - should reset counter
      await proxy.someMethod();
      expect(wrapper.isEnabled()).toBe(true); // Still enabled as counter reset

      // Trigger 5 more errors within new window
      for (let i = 0; i < 5; i++) {
        await proxy.someMethod();
      }

      // Should now be disabled after 6 errors in new window
      expect(wrapper.isEnabled()).toBe(false);
    });
  });

  describe('Retry mechanism', () => {
    it('should successfully retry and clear fallback mode', async () => {
      const error = new Error('Temporary error');

      // First call fails, then succeeds on retry
      mockService.someMethod
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('retry-success');

      // Set up initial fallback mode
      wrapper['getFallbackMode'] = jest.fn().mockReturnValue('degraded');
      const originalGetFallbackMode = wrapper.getFallbackMode.bind(wrapper);
      wrapper.getFallbackMode = jest.fn().mockImplementation(() => {
        return wrapper['#fallbackMode'] || null;
      });

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'retry',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const resultPromise = proxy.someMethod();

      // Fast-forward through retry delays
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('retry-success');
      expect(mockService.someMethod).toHaveBeenCalledTimes(2);
    });

    it('should exhaust all retry attempts and return fallback', async () => {
      const error = new Error('Persistent error');
      mockService.someMethod.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'retry',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const resultPromise = proxy.someMethod();

      // Fast-forward through all retry delays
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // Should have attempted original + 3 retries = 4 total
      expect(mockService.someMethod).toHaveBeenCalledTimes(4);
      expect(result).toBeUndefined(); // Fallback result
    });

    it('should handle retry without continuation flag', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'retry',
        shouldContinue: false, // No continuation
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(result).toBeUndefined();
      expect(mockService.someMethod).toHaveBeenCalledTimes(1); // No retry attempts
    });
  });

  describe('Error classification edge cases', () => {
    it('should classify SyntaxError as serialization error', async () => {
      const error = new SyntaxError('Invalid JSON');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.SERIALIZATION
      );
    });

    it('should classify TypeError as serialization error', async () => {
      const error = new TypeError('Cannot read property of undefined');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.SERIALIZATION
      );
    });

    it('should classify network-related message as network error', async () => {
      const error = new Error('Network connection failed');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.NETWORK
      );
    });

    it('should classify ECONNREFUSED as network error', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.NETWORK
      );
    });

    it('should classify timeout message as timeout error', async () => {
      const error = new Error('Request timeout exceeded');
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.TIMEOUT
      );
    });

    it('should classify ETIMEOUT code as timeout error', async () => {
      const error = new Error('Connection timed out');
      error.code = 'ETIMEOUT';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.TIMEOUT
      );
    });

    it('should classify EACCES as file system error', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.FILE_SYSTEM
      );
    });

    it('should classify ENOSPC as file system error', async () => {
      const error = new Error('No space left on device');
      error.code = 'ENOSPC';
      mockService.someMethod.mockRejectedValue(error);

      const proxy = wrapper.createResilientProxy();
      await proxy.someMethod();

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        TraceErrorType.FILE_SYSTEM
      );
    });
  });

  describe('Recovery action edge cases', () => {
    it('should handle unknown recovery action with fallback', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'unknown-action', // Unknown action
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(result).toBeUndefined(); // Should use fallback
    });

    it('should handle undefined recovery action with fallback', async () => {
      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: undefined, // No action specified
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(result).toBeUndefined(); // Should use fallback
    });
  });

  describe('Fallback with getFallbackData method', () => {
    it('should use service getFallbackData method if available', async () => {
      const fallbackData = { fallback: 'data' };
      mockService.getFallbackData = jest.fn().mockReturnValue(fallbackData);

      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod('arg1', 'arg2');

      expect(mockService.getFallbackData).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe(fallbackData);
    });

    it('should handle getFallbackData method failure', async () => {
      const fallbackError = new Error('Fallback failed');
      mockService.getFallbackData = jest.fn().mockImplementation(() => {
        throw fallbackError;
      });

      const error = new Error('Test error');
      mockService.someMethod.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.someMethod();

      expect(mockService.getFallbackData).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Fallback method also failed',
        expect.objectContaining({
          service: 'TestService',
          method: 'someMethod',
          error: 'Fallback failed',
        })
      );
      expect(result).toBeUndefined(); // Falls back to standard fallback
    });
  });

  describe('Specific fallback return values', () => {
    it('should return resolved promise for writeTrace in fallback', async () => {
      const error = new Error('Test error');
      mockService.writeTrace.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.writeTrace();

      expect(result).toBeUndefined();
      await expect(Promise.resolve(result)).resolves.toBeUndefined();
    });

    it('should return resolved promise for outputTrace in fallback', async () => {
      const error = new Error('Test error');
      mockService.outputTrace.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.outputTrace();

      expect(result).toBeUndefined();
      await expect(Promise.resolve(result)).resolves.toBeUndefined();
    });

    it('should return false for shouldTrace in fallback', async () => {
      const error = new Error('Test error');
      mockService.shouldTrace.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.shouldTrace();

      expect(result).toBe(false);
    });

    it('should return false for isEnabled in fallback', async () => {
      const error = new Error('Test error');
      mockService.isEnabled.mockRejectedValue(error);

      mockErrorHandler.handleError.mockResolvedValue({
        recoveryAction: 'continue',
        shouldContinue: true,
      });

      const proxy = wrapper.createResilientProxy();
      const result = await proxy.isEnabled();

      expect(result).toBe(false);
    });
  });
});
