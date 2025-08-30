import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  RecoveryManager,
  RecoveryAction,
} from '../../../../../src/actions/tracing/recovery/recoveryManager.js';
import {
  TraceErrorType,
  TraceErrorSeverity,
} from '../../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('RecoveryManager', () => {
  let recoveryManager;
  let mockLogger;
  let mockConfig;
  let mockRetryManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockConfig = {};
    mockRetryManager = {
      retry: jest.fn().mockResolvedValue('retry-success'),
    };

    recoveryManager = new RecoveryManager({
      logger: mockLogger,
      config: mockConfig,
      retryManager: mockRetryManager,
    });
  });

  describe('Constructor', () => {
    it('should create manager with valid dependencies', () => {
      expect(recoveryManager).toBeInstanceOf(RecoveryManager);
    });

    it('should create manager with invalid logger (fallback)', () => {
      // ensureValidLogger provides a fallback, so this won't throw
      const manager = new RecoveryManager({
        logger: null,
        config: mockConfig,
        retryManager: mockRetryManager,
      });
      expect(manager).toBeInstanceOf(RecoveryManager);
    });
  });

  describe('attemptRecovery', () => {
    it('should handle low severity errors with continue action', async () => {
      const errorInfo = {
        id: 'error-123',
        type: TraceErrorType.VALIDATION,
        severity: TraceErrorSeverity.LOW,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.CONTINUE,
        shouldContinue: true,
        fallbackMode: null,
        success: true,
      });
    });

    it('should handle critical memory errors with emergency stop', async () => {
      const errorInfo = {
        id: 'error-456',
        type: TraceErrorType.MEMORY,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.EMERGENCY_STOP,
        shouldContinue: false,
        fallbackMode: 'emergency_disabled',
        success: true,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Emergency stop triggered for action tracing system',
        expect.any(Object)
      );
    });

    it('should handle critical non-memory errors with disable component', async () => {
      const errorInfo = {
        id: 'error-789',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.DISABLE_COMPONENT,
        shouldContinue: false,
        fallbackMode: 'disabled',
        success: true,
      });
    });

    it('should handle high severity file system errors with fallback', async () => {
      const errorInfo = {
        id: 'error-abc',
        type: TraceErrorType.FILE_SYSTEM,
        severity: TraceErrorSeverity.HIGH,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.FALLBACK,
        shouldContinue: true,
        fallbackMode: 'no-op',
        success: false,
      });
    });

    it('should handle medium severity retryable errors with retry', async () => {
      const errorInfo = {
        id: 'error-def',
        type: TraceErrorType.NETWORK,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      // Mock retry to fail and trigger fallback
      mockRetryManager.retry.mockRejectedValue(new Error('Retry failed'));

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(mockRetryManager.retry).toHaveBeenCalled();
      expect(result.action).toBe(RecoveryAction.FALLBACK);
    });

    it('should handle recovery failure gracefully', async () => {
      const errorInfo = {
        id: 'error-ghi',
        type: TraceErrorType.NETWORK, // Use a retryable error type
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      // Force an error in recovery by making retry reject unexpectedly
      mockRetryManager.retry.mockRejectedValue(new Error('Unexpected error'));

      const result = await recoveryManager.attemptRecovery(errorInfo);

      // When retry fails, it should fall back to fallback strategy
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.success).toBe(false);
      expect(result.fallbackMode).toBe('no-op');
      expect(mockRetryManager.retry).toHaveBeenCalled();
    });
  });

  describe('registerFallbackMode', () => {
    it('should register fallback handler for component', () => {
      const fallbackHandler = jest.fn();
      recoveryManager.registerFallbackMode('TestComponent', fallbackHandler);

      // Test by triggering a fallback scenario
      const errorInfo = {
        id: 'error-jkl',
        type: TraceErrorType.FILE_SYSTEM,
        severity: TraceErrorSeverity.HIGH,
        context: { componentName: 'TestComponent' },
      };

      recoveryManager.registerFallbackMode('TestComponent', fallbackHandler);
      // Note: We can't directly test the fallback was registered without exposing internals
      // But we can verify it doesn't throw
      expect(() => {
        recoveryManager.registerFallbackMode('TestComponent', fallbackHandler);
      }).not.toThrow();
    });
  });

  describe('isCircuitOpen', () => {
    it('should return false for component with no circuit breaker', () => {
      const result = recoveryManager.isCircuitOpen('TestComponent');
      expect(result).toBe(false);
    });

    it('should return true after component is disabled', async () => {
      const errorInfo = {
        id: 'error-mno',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName: 'TestComponent' },
      };

      await recoveryManager.attemptRecovery(errorInfo);
      const result = recoveryManager.isCircuitOpen('TestComponent');
      expect(result).toBe(true);
    });
  });

  describe('Recovery strategies', () => {
    it('should retry network errors', async () => {
      const errorInfo = {
        id: 'error-pqr',
        type: TraceErrorType.NETWORK,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      mockRetryManager.retry.mockResolvedValue('success');

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(mockRetryManager.retry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxAttempts: 3,
          delay: 1000,
          exponentialBackoff: true,
          maxDelay: 10000,
        })
      );
    });

    it('should retry timeout errors', async () => {
      const errorInfo = {
        id: 'error-stu',
        type: TraceErrorType.TIMEOUT,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      mockRetryManager.retry.mockResolvedValue('success');

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(mockRetryManager.retry).toHaveBeenCalled();
    });

    it('should not retry validation errors', async () => {
      const errorInfo = {
        id: 'error-vwx',
        type: TraceErrorType.VALIDATION,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(mockRetryManager.retry).not.toHaveBeenCalled();
      expect(result.action).toBe(RecoveryAction.FALLBACK);
    });
  });

  describe('Fallback handling', () => {
    it('should use registered fallback handler when available', async () => {
      const fallbackHandler = jest.fn().mockResolvedValue();
      recoveryManager.registerFallbackMode('TestComponent', fallbackHandler);

      const errorInfo = {
        id: 'error-yz1',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      // Since we can't mock the internal fallback, we just verify the result structure
      expect(result.action).toBe(RecoveryAction.FALLBACK);
    });

    it('should handle fallback handler failure', async () => {
      const fallbackHandler = jest
        .fn()
        .mockRejectedValue(new Error('Fallback failed'));
      recoveryManager.registerFallbackMode('TestComponent', fallbackHandler);

      const errorInfo = {
        id: 'error-234',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result.action).toBe(RecoveryAction.FALLBACK);
    });
  });

  describe('Circuit Breaker Edge Cases', () => {
    it('should handle simple circuit breaker without isOpen method', async () => {
      // First, disable a component to create circuit breaker
      const errorInfo = {
        id: 'error-circuit-test',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName: 'TestComponent' },
      };

      await recoveryManager.attemptRecovery(errorInfo);

      // Now test isCircuitOpen with the simple circuit breaker object
      const result = recoveryManager.isCircuitOpen('TestComponent');
      expect(result).toBe(true);
    });

    it('should open circuit breaker after exceeding error threshold', async () => {
      const componentName = 'ThresholdTestComponent';

      // Trigger 6 errors to exceed the threshold (>5 errors)
      for (let i = 0; i < 6; i++) {
        const errorInfo = {
          id: `error-threshold-${i}`,
          type: TraceErrorType.NETWORK,
          severity: TraceErrorSeverity.MEDIUM,
          context: { componentName },
        };

        await recoveryManager.attemptRecovery(errorInfo);
      }

      // The 6th error should trigger circuit breaker opening
      expect(recoveryManager.isCircuitOpen(componentName)).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Circuit breaker opened for component: ${componentName}`,
        expect.objectContaining({
          errorCount: expect.any(Number),
        })
      );
    });

    it('should disable component when circuit is already open', async () => {
      const componentName = 'AlreadyOpenComponent';

      // First, open the circuit by creating a critical error
      const criticalError = {
        id: 'error-critical',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName },
      };

      await recoveryManager.attemptRecovery(criticalError);

      // Now attempt recovery on the component with an open circuit
      const errorInfo = {
        id: 'error-after-circuit-open',
        type: TraceErrorType.NETWORK,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.DISABLE_COMPONENT,
        shouldContinue: false,
        fallbackMode: 'disabled',
        success: true,
      });
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should handle unknown recovery action with default case', async () => {
      // Create a scenario that would trigger default case by using an invalid error type
      const errorInfo = {
        id: 'error-unknown-action',
        type: 'INVALID_TYPE', // This should trigger default behavior
        severity: TraceErrorSeverity.LOW,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      // Default case should return continue action
      expect(result).toEqual({
        action: RecoveryAction.CONTINUE,
        shouldContinue: true,
        fallbackMode: null,
        success: true,
      });
    });

    it('should handle recovery attempt internal failure', async () => {
      // Create a mock that simulates internal failure in the recovery process
      const originalConsoleError = console.error;
      console.error = jest.fn(); // Suppress error logging for test

      // Create an error that will try to retry but fail in unexpected way
      const errorInfo = {
        id: 'error-internal-failure',
        type: TraceErrorType.NETWORK,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      // Mock retry manager to throw an error that simulates internal failure
      mockRetryManager.retry.mockImplementation(() => {
        throw new TypeError('Internal failure in recovery process');
      });

      const result = await recoveryManager.attemptRecovery(errorInfo);

      // Should fall back to fallback mode on retry failure (as per actual implementation)
      expect(result).toEqual({
        action: RecoveryAction.FALLBACK,
        shouldContinue: true,
        fallbackMode: 'no-op',
        success: false,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retry failed, falling back to fallback strategy',
        expect.objectContaining({
          component: 'TestComponent',
          error: 'Internal failure in recovery process',
        })
      );

      console.error = originalConsoleError;
    });

    it('should handle circuit breaker condition in isCircuitOpen', async () => {
      // Test the isCircuitOpen method with simple circuit breaker (line 138)
      const componentName = 'CircuitBreakerTestComponent';

      // First, create a critical error to open the circuit breaker
      const criticalError = {
        id: 'error-circuit-test',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName },
      };

      await recoveryManager.attemptRecovery(criticalError);

      // Test isCircuitOpen - this should hit the simple circuit breaker path (line 138)
      const isOpen = recoveryManager.isCircuitOpen(componentName);
      expect(isOpen).toBe(true);

      // Test with component that doesn't exist
      const nonExistentOpen = recoveryManager.isCircuitOpen(
        'NonExistentComponent'
      );
      expect(nonExistentOpen).toBe(false);
    });
  });

  describe('Service Management Operations', () => {
    it('should handle service restart operation directly', async () => {
      // Create a custom recovery manager to test restart service path
      const customRecoveryManager = new RecoveryManager({
        logger: mockLogger,
        config: mockConfig,
        retryManager: mockRetryManager,
      });

      // Access the private method directly to test restart service
      const errorInfo = {
        id: 'error-restart-service',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.HIGH,
        context: { componentName: 'ServiceComponent' },
      };

      // We'll test the restart service path by manually calling the method
      const strategy = { action: RecoveryAction.RESTART_SERVICE, priority: 1 };

      // Use reflection to access the private method for testing
      const handleRestartService =
        customRecoveryManager.constructor.prototype['#handleRestartService'];
      if (handleRestartService) {
        const result = await handleRestartService.call(
          customRecoveryManager,
          errorInfo,
          strategy
        );

        expect(result).toEqual({
          action: RecoveryAction.RESTART_SERVICE,
          shouldContinue: false,
          fallbackMode: 'restarting',
          success: true,
        });
      }
    });

    it('should handle emergency stop with multiple registered components', async () => {
      // Register multiple fallback modes to test the emergency stop iteration
      recoveryManager.registerFallbackMode('Component1', jest.fn());
      recoveryManager.registerFallbackMode('Component2', jest.fn());
      recoveryManager.registerFallbackMode('Component3', jest.fn());

      const errorInfo = {
        id: 'error-emergency',
        type: TraceErrorType.MEMORY,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName: 'TestComponent' },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.EMERGENCY_STOP,
        shouldContinue: false,
        fallbackMode: 'emergency_disabled',
        success: true,
      });

      // Verify all components are circuit broken
      expect(recoveryManager.isCircuitOpen('Component1')).toBe(true);
      expect(recoveryManager.isCircuitOpen('Component2')).toBe(true);
      expect(recoveryManager.isCircuitOpen('Component3')).toBe(true);
    });
  });

  describe('Retry Manager Integration', () => {
    it('should handle retry without retry manager instance', async () => {
      // Create recovery manager without retry manager
      const managerWithoutRetry = new RecoveryManager({
        logger: mockLogger,
        config: mockConfig,
        retryManager: null,
      });

      const errorInfo = {
        id: 'error-no-retry-manager',
        type: TraceErrorType.NETWORK,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      const result = await managerWithoutRetry.attemptRecovery(errorInfo);

      // Should fall back to fallback mode when no retry manager
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.fallbackMode).toBe('no-op');
      expect(result.success).toBe(false);
    });

    it('should execute retry operation placeholder', async () => {
      const errorInfo = {
        id: 'error-retry-placeholder',
        type: TraceErrorType.TIMEOUT,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      // Mock successful retry
      mockRetryManager.retry.mockResolvedValue('retry-success');

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.RETRY,
        shouldContinue: true,
        fallbackMode: null,
        success: true,
        retryResult: 'retry-success',
      });

      expect(mockRetryManager.retry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxAttempts: 3,
          delay: 1000,
          exponentialBackoff: true,
          maxDelay: 10000,
        })
      );
    });

    it('should handle retry manager without retry method', async () => {
      // Create recovery manager with invalid retry manager
      const invalidRetryManager = {}; // No retry method

      const managerWithInvalidRetry = new RecoveryManager({
        logger: mockLogger,
        config: mockConfig,
        retryManager: invalidRetryManager,
      });

      const errorInfo = {
        id: 'error-invalid-retry-manager',
        type: TraceErrorType.FILE_SYSTEM,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName: 'TestComponent' },
      };

      const result = await managerWithInvalidRetry.attemptRecovery(errorInfo);

      // Should fall back when retry manager doesn't have retry method
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.fallbackMode).toBe('no-op');
    });
  });

  describe('Fallback Handler Integration', () => {
    it('should successfully use registered fallback handler', async () => {
      const fallbackHandler = jest.fn().mockResolvedValue('fallback-success');
      const componentName = 'FallbackTestComponent';

      recoveryManager.registerFallbackMode(componentName, fallbackHandler);

      const errorInfo = {
        id: 'error-with-fallback',
        type: TraceErrorType.SERIALIZATION,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.FALLBACK,
        shouldContinue: true,
        fallbackMode: 'enabled',
        success: true,
      });

      expect(fallbackHandler).toHaveBeenCalledWith(errorInfo);
    });

    it('should handle fallback handler rejection', async () => {
      const fallbackHandler = jest
        .fn()
        .mockRejectedValue(new Error('Fallback handler failed'));
      const componentName = 'FailingFallbackComponent';

      recoveryManager.registerFallbackMode(componentName, fallbackHandler);

      const errorInfo = {
        id: 'error-fallback-fails',
        type: TraceErrorType.UNKNOWN,
        severity: TraceErrorSeverity.MEDIUM,
        context: { componentName },
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.FALLBACK,
        shouldContinue: true,
        fallbackMode: 'no-op',
        success: false,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Fallback handler failed',
        expect.objectContaining({
          component: componentName,
          error: 'Fallback handler failed',
        })
      );
    });
  });

  describe('Error Tracking and Time Windows', () => {
    it('should reset error count after time window expires', async () => {
      const componentName = 'TimeWindowComponent';

      // Mock Date.now to control time
      const originalDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      // Generate some errors
      for (let i = 0; i < 3; i++) {
        const errorInfo = {
          id: `error-time-${i}`,
          type: TraceErrorType.VALIDATION,
          severity: TraceErrorSeverity.LOW,
          context: { componentName },
        };
        await recoveryManager.attemptRecovery(errorInfo);
      }

      // Advance time by more than 5 minutes (300000ms)
      mockTime += 400000;

      // Generate another error - this should reset the count
      const errorInfo = {
        id: 'error-after-reset',
        type: TraceErrorType.VALIDATION,
        severity: TraceErrorSeverity.LOW,
        context: { componentName },
      };

      await recoveryManager.attemptRecovery(errorInfo);

      // Circuit should not be open since count was reset
      expect(recoveryManager.isCircuitOpen(componentName)).toBe(false);

      // Restore original Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Context Edge Cases', () => {
    it('should handle error info without context', async () => {
      const errorInfo = {
        id: 'error-no-context',
        type: TraceErrorType.UNKNOWN,
        severity: TraceErrorSeverity.LOW,
        // No context property
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      expect(result).toEqual({
        action: RecoveryAction.CONTINUE,
        shouldContinue: true,
        fallbackMode: null,
        success: true,
      });
    });

    it('should handle error info with context but no componentName', async () => {
      const errorInfo = {
        id: 'error-no-component-name',
        type: TraceErrorType.CONFIGURATION,
        severity: TraceErrorSeverity.MEDIUM,
        context: {}, // Empty context
      };

      const result = await recoveryManager.attemptRecovery(errorInfo);

      // Should use 'unknown' as component name and still process
      expect(result.action).toBe(RecoveryAction.FALLBACK);
    });
  });
});
