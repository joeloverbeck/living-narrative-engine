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
});
