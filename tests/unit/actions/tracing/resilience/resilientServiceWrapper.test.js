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
      const result = await proxy.someMethod();

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
});
