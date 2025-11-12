import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import {
  RecoveryManager,
  RecoveryAction,
} from '../../../../src/actions/tracing/recovery/recoveryManager.js';
import { RetryManager } from '../../../../src/actions/tracing/resilience/retryManager.js';
import {
  TraceErrorSeverity,
  TraceErrorType,
} from '../../../../src/actions/tracing/errors/traceErrorHandler.js';

const componentName = 'AdvancedTracingService';

describe('RecoveryManager advanced integration scenarios', () => {
  let logger;
  let retryManager;

  /**
   * @param {object} [overrides]
   * @returns {RecoveryManager}
   */
  const createManager = (overrides = {}) => {
    const baseConfig = {
      circuitBreaker: { threshold: 2, resetTimeout: 500 },
    };

    return new RecoveryManager({
      logger,
      retryManager,
      config: { ...baseConfig, ...overrides },
    });
  };

  beforeEach(() => {
    logger = new ConsoleLogger(LogLevel.ERROR);
    retryManager = new RetryManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('applies overrides and invokes custom recovery handlers before default flows', async () => {
    const customHandler = jest.fn(async (errorInfo, strategy) => ({
      action: strategy.action,
      shouldContinue: false,
      fallbackMode: 'custom-handler',
      success: true,
      metadata: { receivedId: errorInfo.id },
    }));

    const recoveryManager = createManager({
      customRecoveryHandlers: {
        [RecoveryAction.RESTART_SERVICE]: customHandler,
      },
    });

    const recoveryResult = await recoveryManager.attemptRecovery({
      id: 'override-case',
      type: TraceErrorType.NETWORK,
      severity: TraceErrorSeverity.MEDIUM,
      recoveryStrategyOverride: {
        action: RecoveryAction.RESTART_SERVICE,
        shouldContinue: false,
      },
      context: { componentName },
    });

    expect(customHandler).toHaveBeenCalledTimes(1);
    expect(recoveryResult.action).toBe(RecoveryAction.RESTART_SERVICE);
    expect(recoveryResult.fallbackMode).toBe('custom-handler');
    expect(recoveryResult.metadata.receivedId).toBe('override-case');
  });

  it('falls back to safest disable strategy when custom handlers throw', async () => {
    const failingHandler = jest
      .fn()
      .mockRejectedValue(new Error('restart not possible'));

    const recoveryManager = createManager({
      customRecoveryHandlers: {
        [RecoveryAction.FALLBACK]: failingHandler,
      },
    });

    const recoveryResult = await recoveryManager.attemptRecovery({
      id: 'failing-custom-handler',
      type: TraceErrorType.FILE_SYSTEM,
      severity: TraceErrorSeverity.HIGH,
      context: { componentName },
    });

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(recoveryResult.action).toBe(RecoveryAction.DISABLE_COMPONENT);
    expect(recoveryResult.shouldContinue).toBe(false);
    expect(recoveryResult.success).toBe(false);
  });

  it('degrades gracefully when registered fallback handlers fail', async () => {
    const recoveryManager = createManager();

    recoveryManager.registerFallbackMode(componentName, async () => {
      throw new Error('fallback path failed');
    });

    const recoveryResult = await recoveryManager.attemptRecovery({
      id: 'failing-fallback',
      type: TraceErrorType.FILE_SYSTEM,
      severity: TraceErrorSeverity.HIGH,
      context: { componentName },
    });

    expect(recoveryResult.action).toBe(RecoveryAction.FALLBACK);
    expect(recoveryResult.fallbackMode).toBe('no-op');
    expect(recoveryResult.success).toBe(false);
  });

  it('opens circuit breakers after repeated errors and resets once the timeout elapses', async () => {
    jest.useFakeTimers({ now: new Date('2024-01-01T00:00:00Z') });
    const recoveryManager = createManager();

    const baseError = {
      type: TraceErrorType.NETWORK,
      severity: TraceErrorSeverity.LOW,
      context: { componentName },
    };

    await recoveryManager.attemptRecovery({ ...baseError, id: 'first-error' });

    jest.setSystemTime(new Date('2024-01-01T00:00:10Z'));
    const secondAttempt = await recoveryManager.attemptRecovery({
      ...baseError,
      id: 'second-error',
    });

    expect(secondAttempt.action).toBe(RecoveryAction.DISABLE_COMPONENT);
    expect(recoveryManager.isCircuitOpen(componentName)).toBe(true);

    jest.setSystemTime(new Date('2024-01-01T00:00:11Z'));
    expect(recoveryManager.isCircuitOpen(componentName)).toBe(false);
  });

  it('exposes deep recovery utilities for advanced operational tooling', async () => {
    const recoveryManager = createManager();
    const utils = recoveryManager.getTestUtils();

    recoveryManager.registerFallbackMode(componentName, async () => {});

    const restartResult = await utils.invokeRestartService(
      { id: 'restart-test', context: { componentName } },
      { action: RecoveryAction.RESTART_SERVICE }
    );
    expect(restartResult.fallbackMode).toBe('restarting');

    const emergencyResult = await utils.invokeEmergencyStop(
      { id: 'emergency-test', severity: TraceErrorSeverity.CRITICAL },
      { action: RecoveryAction.EMERGENCY_STOP }
    );
    expect(emergencyResult.action).toBe(RecoveryAction.EMERGENCY_STOP);
    expect(recoveryManager.isCircuitOpen(componentName)).toBe(true);

    await expect(
      utils.invokeExecuteOriginalOperation({ id: 'unimplemented-op' })
    ).rejects.toThrow('Original operation re-execution not implemented');

    const now = Date.now();
    utils.setLastResetTime(componentName, now - 600000);
    utils.trackComponentError(componentName);
    expect(utils.getErrorCount(componentName)).toBe(1);

    utils.setCircuitBreaker(componentName, {
      isOpen: () => false,
      openTime: now,
    });
    expect(utils.getCircuitBreaker(componentName).isOpen()).toBe(false);
  });
});
