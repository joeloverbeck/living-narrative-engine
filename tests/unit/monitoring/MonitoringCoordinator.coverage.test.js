import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

const ORIGINAL_SET_INTERVAL = global.setInterval;
const ORIGINAL_CLEAR_INTERVAL = global.clearInterval;

describe('MonitoringCoordinator comprehensive coverage', () => {
  let MonitoringCoordinator;
  let logger;
  let performanceMonitorCtor;
  let performanceMonitorInstance;
  let circuitBreakerCtor;
  let createdCircuitBreakers;
  let eventBus;
  let subscribers;
  let memoryMonitor;
  let memoryPressureManager;
  let memoryReporter;
  let getErrorConfigMock;
  let getCircuitBreakerConfigMock;
  let currentTime;
  let dateNowSpy;
  let intervalCallback;

  const setTime = (value) => {
    currentTime = value;
  };

  const dispatchEvent = (eventName, payload) => {
    const handlers = subscribers.get(eventName) || [];
    handlers.forEach((handler) => handler({ type: eventName, payload }));
  };

  const setupCoordinator = (overrides = {}) => {
    const coordinator = new MonitoringCoordinator({
      logger,
      eventBus,
      memoryMonitor,
      memoryPressureManager,
      memoryReporter,
      enabled: true,
      checkInterval: 250,
      ...overrides,
    });
    return coordinator;
  };

  beforeEach(async () => {
    jest.resetModules();
    subscribers = new Map();
    intervalCallback = null;

    global.setInterval = jest.fn((cb, interval) => {
      intervalCallback = cb;
      return 101;
    });
    global.clearInterval = jest.fn();

    eventBus = {
      subscribe: jest.fn((event, handler) => {
        if (!subscribers.has(event)) {
          subscribers.set(event, []);
        }
        subscribers.get(event).push(handler);
      }),
      dispatch: jest.fn((event, payload) => dispatchEvent(event, payload)),
    };

    performanceMonitorInstance = {
      startTimer: jest.fn().mockReturnValue('timer-1'),
      stopTimer: jest.fn().mockReturnValue(42),
      timeOperation: jest.fn().mockImplementation(async (name, fn) => fn()),
      timeSync: jest.fn().mockImplementation((name, fn) => fn()),
      recordMetric: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        totalOperations: 20,
        slowOperations: 6,
        averageOperationTime: 240,
        maxOperationTime: 520,
        minOperationTime: 10,
        slowOperationsByType: {},
        operationCounts: {},
        memoryUsageWarnings: 2,
        activeTimers: 0,
      }),
      setEnabled: jest.fn(),
      checkMemoryUsage: jest.fn(),
      reset: jest.fn(),
    };

    performanceMonitorCtor = jest.fn().mockImplementation(() => performanceMonitorInstance);

    createdCircuitBreakers = [];
    circuitBreakerCtor = jest.fn().mockImplementation((params) => {
      const instance = {
        options: params.options,
        execute: jest.fn(async (fn) => fn()),
        executeSync: jest.fn((fn) => fn()),
        setEnabled: jest.fn(),
        getStats: jest.fn().mockReturnValue({
          state: 'HALF_OPEN',
          totalRequests: 12,
          totalFailures: 6,
          totalSuccesses: 6,
          lastFailureTime: Date.now(),
        }),
      };
      createdCircuitBreakers.push(instance);
      return instance;
    });

    memoryMonitor = {
      getCurrentUsage: jest.fn(() => ({
        usagePercent: 0.92,
        heapUsed: 256 * 1024 * 1024,
        heapTotal: 512 * 1024 * 1024,
        rss: 768 * 1024 * 1024,
      })),
      getPressureLevel: jest.fn()
        .mockReturnValueOnce('critical')
        .mockReturnValueOnce('warning')
        .mockReturnValue('normal'),
      getHistory: jest.fn(() => ['sample-history']),
      detectLeaks: jest.fn(() => ({ isLeak: true, confidence: 0.8 })),
      reset: jest.fn(),
      destroy: jest.fn(),
    };

    memoryPressureManager = {
      getManagementHistory: jest.fn(() => ['managed']),
      clearHistory: jest.fn(),
      destroy: jest.fn(),
    };

    memoryReporter = {
      getTopErrors: jest.fn(() => [{ name: 'TopError', count: 2 }]),
    };

    getErrorConfigMock = jest.fn(() => ({
      circuitBreaker: {
        default: {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 1000,
          halfOpenRequests: 1,
          volumeThreshold: 5,
          errorThresholdPercentage: 55,
        },
      },
    }));

    getCircuitBreakerConfigMock = jest.fn((name) =>
      name === 'service-with-config'
        ? { timeout: 4000, volumeThreshold: 20 }
        : {}
    );

    jest.doMock('../../../src/entities/monitoring/PerformanceMonitor.js', () => performanceMonitorCtor);
    jest.doMock('../../../src/entities/monitoring/CircuitBreaker.js', () => circuitBreakerCtor);
    jest.doMock('../../../src/config/errorHandling.config.js', () => ({
      getErrorConfig: getErrorConfigMock,
      getCircuitBreakerConfig: getCircuitBreakerConfigMock,
    }));

    ({ default: MonitoringCoordinator } = await import('../../../src/entities/monitoring/MonitoringCoordinator.js'));

    logger = createMockLogger();
    logger.warning = jest.fn();

    currentTime = 0;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    global.setInterval = ORIGINAL_SET_INTERVAL;
    global.clearInterval = ORIGINAL_CLEAR_INTERVAL;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers memory alerts and adds alerts from the event bus', () => {
    const coordinator = setupCoordinator();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'MEMORY_THRESHOLD_EXCEEDED',
      expect.any(Function)
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'MEMORY_LEAK_DETECTED',
      expect.any(Function)
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'MEMORY_STRATEGY_COMPLETED',
      expect.any(Function)
    );

    setTime(1_000);
    dispatchEvent('MEMORY_THRESHOLD_EXCEEDED', {
      level: 'critical',
      type: 'heap',
      value: '95%',
    });

    setTime(1_500);
    dispatchEvent('MEMORY_THRESHOLD_EXCEEDED', {
      level: 'warning',
      type: 'heap',
      value: '85%',
    });

    setTime(2_000);
    dispatchEvent('MEMORY_LEAK_DETECTED', {
      confidence: 0.87,
      metrics: {},
    });

    setTime(3_000);
    dispatchEvent('MEMORY_STRATEGY_COMPLETED', {
      strategy: 'gc',
      memoryFreed: 25 * 1024 * 1024,
    });

    const stats = coordinator.getStats();
    expect(stats.recentAlerts).toHaveLength(4);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Memory heap threshold exceeded: critical (95%)')
    );
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Potential memory leak detected')
    );
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Memory heap threshold exceeded: warning (85%)')
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Memory gc strategy executed')
    );
  });

  it('integrates error handlers and tracks error metrics', async () => {
    const coordinator = setupCoordinator();

    const centralErrorHandler = {
      handle: jest.fn().mockResolvedValue('handled'),
      getMetrics: jest.fn(() => ({ totalErrors: 10, recoveredErrors: 3 })),
    };
    const recoveryStrategyManager = {
      registerStrategy: jest.fn(),
      executeWithRecovery: jest.fn(async (fn) => fn()),
    };
    const errorReporter = {
      getTopErrors: jest.fn(() => [{ name: 'CriticalFailure', count: 4 }]),
    };

    coordinator.injectErrorHandlers(
      centralErrorHandler,
      recoveryStrategyManager,
      errorReporter
    );

    expect(recoveryStrategyManager.registerStrategy).toHaveBeenCalledTimes(2);
    const performanceStrategy = recoveryStrategyManager.registerStrategy.mock.calls.find(
      ([name]) => name === 'PerformanceError'
    )[1];
    const performanceFallback = performanceStrategy.fallback(new Error('perf')); // eslint-disable-line new-cap
    expect(performanceFallback).toEqual({ totalOperations: 0, averageTime: 0, maxTime: 0 });

    const circuitStrategy = recoveryStrategyManager.registerStrategy.mock.calls.find(
      ([name]) => name === 'CircuitBreakerError'
    )[1];
    const circuitFallback = circuitStrategy.fallback(new Error('cb'));
    expect(circuitFallback).toEqual({ allowed: true, fallback: true });

    dispatchEvent('ERROR_OCCURRED', {
      errorType: 'timeout',
      severity: 'critical',
      message: 'Operation timed out',
    });

    expect(performanceMonitorInstance.recordMetric).toHaveBeenCalledWith('error_timeout', 1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Critical error: Operation timed out')
    );

    dispatchEvent('ERROR_OCCURRED', {
      errorType: 'db',
      severity: 'error',
      message: 'Recoverable issue',
    });
    expect(performanceMonitorInstance.recordMetric).toHaveBeenCalledWith('error_db', 1);
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Error occurred: db')
    );

    dispatchEvent('ERROR_OCCURRED', {
      severity: 'error',
      message: 'Recoverable without type',
    });
    expect(performanceMonitorInstance.recordMetric).toHaveBeenCalledWith('error_unknown', 1);
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: Error occurred: unknown')
    );

    dispatchEvent('ERROR_OCCURRED', {
      severity: 'info',
      message: 'Informational notice',
    });

    expect(coordinator.getErrorHandler()).toBe(centralErrorHandler);
    expect(coordinator.getRecoveryManager()).toBe(recoveryStrategyManager);
    expect(coordinator.getErrorReporter()).toBe(errorReporter);

    coordinator.injectErrorHandlers(
      centralErrorHandler,
      recoveryStrategyManager,
      errorReporter
    );
    expect(logger.warn).toHaveBeenCalledWith('Error handlers already injected');
  });

  it('executes monitored operations with error handlers and recovery strategies', async () => {
    const coordinator = setupCoordinator();

    const error = new Error('boom');
    const centralErrorHandler = {
      handle: jest.fn().mockResolvedValue('fallback'),
    };
    const recoveryStrategyManager = {
      registerStrategy: jest.fn(),
      executeWithRecovery: jest.fn(async (fn) => fn()),
    };

    coordinator.injectErrorHandlers(centralErrorHandler, recoveryStrategyManager, null);

    performanceMonitorInstance.timeOperation.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(
      coordinator.executeMonitored('failing-operation', async () => {
        throw error;
      })
    ).resolves.toBe('fallback');
    expect(centralErrorHandler.handle).toHaveBeenCalledWith(error, {
      operation: 'failing-operation',
      context: '',
      monitoring: true,
    });

    await expect(
      coordinator.executeMonitored(
        'no-handler',
        async () => {
          throw new Error('skip');
        },
        { useErrorHandler: false }
      )
    ).rejects.toThrow('skip');

    const breaker = coordinator.getCircuitBreaker('flaky-service');
    breaker.execute.mockImplementationOnce(async () => {
      throw new Error('breaker-open');
    });
    performanceMonitorInstance.timeOperation.mockImplementation(async () => 'recovered');

    await expect(
      coordinator.executeMonitored('flaky-service', async () => 'ok')
    ).resolves.toBe('recovered');
    expect(recoveryStrategyManager.executeWithRecovery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        operationName: 'flaky-service',
        errorType: 'CircuitBreakerError',
        useCircuitBreaker: false,
        useFallback: true,
      })
    );

    const coordinatorWithoutHandlers = setupCoordinator();
    const breaker2 = coordinatorWithoutHandlers.getCircuitBreaker('always-fail');
    breaker2.execute.mockImplementationOnce(async () => {
      throw new Error('no-recovery');
    });

    await expect(
      coordinatorWithoutHandlers.executeMonitored('always-fail', async () => 'x')
    ).rejects.toThrow('no-recovery');
  });

  it('computes stats, health, and reporting details', () => {
    const coordinator = setupCoordinator();

    const centralErrorHandler = {
      handle: jest.fn(),
      getMetrics: jest.fn(() => ({ totalErrors: 8, recoveredErrors: 2 })),
    };
    const recoveryStrategyManager = {
      registerStrategy: jest.fn(),
      executeWithRecovery: jest.fn(),
    };
    const errorReporter = {
      getTopErrors: jest.fn(() => [{ name: 'ErrorX', count: 5 }]),
    };
    coordinator.injectErrorHandlers(centralErrorHandler, recoveryStrategyManager, errorReporter);

    const circuit = coordinator.getCircuitBreaker('service-with-config', { custom: true });
    circuit.getStats.mockReturnValue({
      state: 'OPEN',
      totalRequests: 30,
      totalFailures: 20,
      totalSuccesses: 10,
      lastFailureTime: Date.now(),
    });

    setTime(10_000);
    memoryMonitor.detectLeaks
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ isLeak: true, confidence: 0.8 });
    intervalCallback();

    const stats = coordinator.getStats();
    expect(stats.errors).toEqual({ totalErrors: 8, recoveredErrors: 2 });
    expect(stats.topErrors).toEqual([{ name: 'ErrorX', count: 5 }]);
    expect(stats.memory).toEqual(
      expect.objectContaining({ pressureLevel: 'warning', managementHistory: ['managed'] })
    );
    expect(stats.circuitBreakers['service-with-config']).toEqual({
      state: 'OPEN',
      totalRequests: 30,
      totalFailures: 20,
      totalSuccesses: 10,
      lastFailureTime: expect.any(Number),
    });
    expect(stats.healthStatus.status).toBe('unhealthy');

    const report = coordinator.getMonitoringReport();
    expect(report).toContain('Entity Module Monitoring Report');
    expect(report).toContain('Monitoring Status: Enabled');
    expect(report).toContain('Circuit Breakers:');
    expect(report).toContain('Recent Alerts:');

    expect(circuitBreakerCtor).toHaveBeenCalledWith({
      logger,
      options: expect.objectContaining({
        failureThreshold: 3,
        timeout: 4000,
        volumeThreshold: 20,
        custom: true,
        name: 'service-with-config',
      }),
    });
  });

  it('manages health checks, reset, and close flows', () => {
    const coordinator = setupCoordinator();

    expect(intervalCallback).toBeInstanceOf(Function);

    performanceMonitorInstance.checkMemoryUsage.mockImplementationOnce(() => {
      throw new Error('health failure');
    });
    setTime(20_000);
    intervalCallback();
    expect(logger.error).toHaveBeenCalledWith(
      'Health check failed:',
      expect.any(Error)
    );

    const breaker = coordinator.getCircuitBreaker('reset-test');
    coordinator.reset();
    expect(performanceMonitorInstance.reset).toHaveBeenCalled();
    expect(memoryMonitor.reset).toHaveBeenCalled();
    expect(memoryPressureManager.clearHistory).toHaveBeenCalled();

    const breakerAfterReset = coordinator.getCircuitBreaker('reset-test');
    expect(breakerAfterReset).not.toBe(breaker);

    coordinator.setEnabled(true);
    expect(global.clearInterval).toHaveBeenCalledWith(101);
    expect(global.setInterval).toHaveBeenCalledTimes(2);

    coordinator.setEnabled(false);
    expect(global.clearInterval).toHaveBeenCalledTimes(2);

    setTime(48 * 60 * 60 * 1000);
    intervalCallback();
    expect(coordinator.getStats().recentAlerts.length).toBeLessThanOrEqual(10);

    coordinator.close();
    expect(memoryMonitor.destroy).toHaveBeenCalled();
    expect(memoryPressureManager.destroy).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('MonitoringCoordinator closed');
  });

  it('supports synchronous monitoring paths and getters', () => {
    const coordinator = setupCoordinator();

    const syncResult = coordinator.executeSyncMonitored('sync-op', () => 'sync-value');
    expect(syncResult).toBe('sync-value');
    expect(performanceMonitorInstance.timeSync).toHaveBeenCalled();

    const breakerForSync = createdCircuitBreakers[createdCircuitBreakers.length - 1];
    const executeSyncCallsBefore = breakerForSync.executeSync.mock.calls.length;
    coordinator.executeSyncMonitored(
      'sync-no-breaker',
      () => 'no-breaker',
      { useCircuitBreaker: false }
    );
    expect(breakerForSync.executeSync.mock.calls.length).toBe(executeSyncCallsBefore);

    coordinator.setEnabled(false);
    coordinator.executeSyncMonitored('sync-disabled', () => 'disabled');
    expect(performanceMonitorInstance.timeSync).toHaveBeenCalledTimes(2);

    const timerId = coordinator.startTimer('manual', 'ctx');
    expect(performanceMonitorInstance.startTimer).toHaveBeenCalledWith('manual', 'ctx');
    coordinator.startTimer('manual-default');
    expect(performanceMonitorInstance.startTimer).toHaveBeenCalledWith(
      'manual-default',
      ''
    );
    coordinator.stopTimer(timerId);
    expect(performanceMonitorInstance.stopTimer).toHaveBeenCalledWith(timerId);

    expect(coordinator.getPerformanceMonitor()).toBe(performanceMonitorInstance);
    expect(coordinator.getMemoryMonitor()).toBe(memoryMonitor);
    expect(coordinator.getMemoryPressureManager()).toBe(memoryPressureManager);
    expect(coordinator.getMemoryReporter()).toBe(memoryReporter);
  });

  it('reports disabled monitoring immediately', () => {
    const coordinator = setupCoordinator({ enabled: false });
    const report = coordinator.getMonitoringReport();
    expect(report).toContain('Monitoring Status: Disabled');
    expect(report).toContain('Health Checks: Inactive');
    expect(report).toContain('Monitoring is disabled');
  });

  it('skips error tracking when the performance monitor is unavailable', () => {
    const incompleteMonitor = {
      timeOperation: jest.fn().mockImplementation(async (name, fn) => fn()),
      timeSync: jest.fn().mockImplementation((name, fn) => fn()),
      getMetrics: jest.fn().mockReturnValue({
        totalOperations: 0,
        slowOperations: 0,
        averageOperationTime: 0,
        maxOperationTime: 0,
        minOperationTime: 0,
        slowOperationsByType: {},
        operationCounts: {},
        memoryUsageWarnings: 0,
        activeTimers: 0,
      }),
      setEnabled: jest.fn(),
      checkMemoryUsage: jest.fn(),
      reset: jest.fn(),
      startTimer: jest.fn(),
      stopTimer: jest.fn(),
    };
    performanceMonitorCtor.mockImplementationOnce(() => incompleteMonitor);

    const isolatedLogger = createMockLogger();
    isolatedLogger.warning = jest.fn();
    const coordinator = new MonitoringCoordinator({
      logger: isolatedLogger,
      eventBus,
      memoryMonitor,
      memoryPressureManager,
      memoryReporter,
    });

    const central = { handle: jest.fn(), getMetrics: jest.fn(() => null) };
    const recovery = { registerStrategy: jest.fn(), executeWithRecovery: jest.fn() };
    coordinator.injectErrorHandlers(central, recovery, null);

    isolatedLogger.warning.mockClear();
    dispatchEvent('ERROR_OCCURRED', {
      severity: 'critical',
      message: 'Ignored because monitor missing',
    });

    expect(isolatedLogger.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('Error occurred')
    );
    expect(incompleteMonitor.timeOperation).not.toHaveBeenCalled();
  });

  it('handles error handler injection when recovery manager or event bus are missing', () => {
    const coordinatorWithoutRecovery = setupCoordinator({ eventBus: null });
    const centralNoRecovery = {
      handle: jest.fn(),
      getMetrics: jest.fn(() => ({ totalErrors: 0, recoveredErrors: 0 })),
    };
    coordinatorWithoutRecovery.injectErrorHandlers(centralNoRecovery, null, null);

    const statsWithoutRecovery = coordinatorWithoutRecovery.getStats();
    expect(statsWithoutRecovery.errors).toEqual({ totalErrors: 0, recoveredErrors: 0 });
    expect(statsWithoutRecovery.healthStatus.factors.errorRate).toBe(0);

    const recoveryOnlyManager = {
      registerStrategy: jest.fn(),
      executeWithRecovery: jest.fn(async (fn) => fn()),
    };
    const centralWithRecovery = {
      handle: jest.fn(),
      getMetrics: jest.fn(() => ({ totalErrors: 0, recoveredErrors: 0 })),
    };
    const coordinatorWithoutBus = setupCoordinator({ eventBus: null });
    coordinatorWithoutBus.injectErrorHandlers(
      centralWithRecovery,
      recoveryOnlyManager,
      null
    );

    expect(recoveryOnlyManager.registerStrategy).toHaveBeenCalledTimes(2);
    expect(eventBus.subscribe).not.toHaveBeenCalledWith(
      'ERROR_OCCURRED',
      expect.any(Function)
    );
  });

  it('handles default construction without optional dependencies', () => {
    const minimalLogger = createMockLogger();
    minimalLogger.warning = jest.fn();
    performanceMonitorInstance.getMetrics.mockReturnValue({
      totalOperations: 0,
      slowOperations: 0,
      averageOperationTime: 50,
      maxOperationTime: 70,
      minOperationTime: 10,
      slowOperationsByType: {},
      operationCounts: {},
      memoryUsageWarnings: 0,
      activeTimers: 0,
    });

    const minimalCoordinator = new MonitoringCoordinator({ logger: minimalLogger });

    intervalCallback();

    const stats = minimalCoordinator.getStats();
    expect(stats.memory).toBeNull();
    expect(stats.circuitBreakers).toEqual({});
    expect(stats.errors).toBeNull();
    expect(stats.topErrors).toBeNull();

    const report = minimalCoordinator.getMonitoringReport();
    expect(report).toContain('No circuit breakers active');
    expect(report).toContain('No recent alerts');

    minimalCoordinator.setEnabled(false);
    const disabledReport = minimalCoordinator.getMonitoringReport();
    expect(disabledReport).toContain('Monitoring Status: Disabled');
    expect(disabledReport).toContain('Monitoring is disabled');

    minimalCoordinator.reset();
    expect(minimalLogger.info).toHaveBeenCalledWith('Monitoring data reset');

    minimalCoordinator.close();
  });

  it('omits memory management history when manager is unavailable', () => {
    const coordinator = setupCoordinator({ memoryPressureManager: null });
    const stats = coordinator.getStats();
    expect(stats.memory.managementHistory).toBeUndefined();
  });

  it('produces memory report when usage metrics are missing', () => {
    memoryMonitor.getCurrentUsage
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        usagePercent: 0.5,
        heapUsed: 128 * 1024 * 1024,
        heapTotal: 256 * 1024 * 1024,
        rss: 0,
      });
    memoryMonitor.getPressureLevel.mockReset();
    memoryMonitor.getPressureLevel.mockReturnValue('normal');

    const coordinator = setupCoordinator();
    const reportWithoutUsage = coordinator.getMonitoringReport();
    expect(reportWithoutUsage).not.toContain('Heap Usage');

    const reportWithUsage = coordinator.getMonitoringReport();
    expect(reportWithUsage).toContain('Heap Usage: 50.0%');
    expect(reportWithUsage).not.toContain('RSS:');
  });

  it('emits circuit breaker alerts across states', () => {
    const coordinator = setupCoordinator();

    memoryMonitor.getPressureLevel.mockReturnValue('normal');
    memoryMonitor.detectLeaks.mockReturnValue(null);

    const halfOpenBreaker = coordinator.getCircuitBreaker('half-open-service');
    halfOpenBreaker.getStats.mockReturnValue({
      state: 'HALF_OPEN',
      totalRequests: 5,
      totalFailures: 1,
      totalSuccesses: 4,
      lastFailureTime: Date.now(),
    });

    const failingBreaker = coordinator.getCircuitBreaker('failing-service');
    failingBreaker.getStats.mockReturnValue({
      state: 'CLOSED',
      totalRequests: 20,
      totalFailures: 15,
      totalSuccesses: 5,
      lastFailureTime: Date.now(),
    });

    logger.info.mockClear();
    logger.warning.mockClear();
    intervalCallback();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Circuit breaker 'half-open-service' is HALF_OPEN")
    );
    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining("High failure rate (75%) for circuit breaker 'failing-service'")
    );
  });

  it('does not emit performance alerts for nominal metrics', () => {
    const coordinator = setupCoordinator();

    memoryMonitor.getPressureLevel.mockReset();
    memoryMonitor.getPressureLevel.mockReturnValue('normal');
    memoryMonitor.detectLeaks.mockReturnValue(null);

    logger.warning.mockClear();

    performanceMonitorInstance.getMetrics.mockReturnValueOnce({
      totalOperations: 0,
      slowOperations: 0,
      averageOperationTime: 80,
      maxOperationTime: 120,
      minOperationTime: 10,
      slowOperationsByType: {},
      operationCounts: {},
      memoryUsageWarnings: 0,
      activeTimers: 0,
    });
    intervalCallback();

    performanceMonitorInstance.getMetrics.mockReturnValueOnce({
      totalOperations: 10,
      slowOperations: 1,
      averageOperationTime: 90,
      maxOperationTime: 120,
      minOperationTime: 15,
      slowOperationsByType: {},
      operationCounts: {},
      memoryUsageWarnings: 0,
      activeTimers: 0,
    });
    intervalCallback();

    expect(logger.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('High average operation time')
    );
    expect(logger.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('High slow operation rate')
    );
  });

  it('executes monitored operations without a circuit breaker when disabled via options', async () => {
    const coordinator = setupCoordinator();

    await expect(
      coordinator.executeMonitored('no-breaker', async () => 'no-cb-result', {
        useCircuitBreaker: false,
        context: 'direct',
      })
    ).resolves.toBe('no-cb-result');

    expect(performanceMonitorInstance.timeOperation).toHaveBeenCalledWith(
      'no-breaker',
      expect.any(Function),
      'direct'
    );
  });

  it('bypasses monitoring logic when disabled', async () => {
    const coordinator = setupCoordinator();
    coordinator.setEnabled(false);
    performanceMonitorInstance.timeOperation.mockClear();

    const operation = jest.fn().mockResolvedValue('direct');
    await expect(
      coordinator.executeMonitored('disabled-call', operation)
    ).resolves.toBe('direct');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(performanceMonitorInstance.timeOperation).not.toHaveBeenCalled();
  });

  it('evaluates healthy and degraded health statuses', () => {
    const coordinator = setupCoordinator();

    performanceMonitorInstance.getMetrics.mockReturnValueOnce({
      totalOperations: 10,
      slowOperations: 0,
      averageOperationTime: 40,
      maxOperationTime: 80,
      minOperationTime: 10,
      slowOperationsByType: {},
      operationCounts: {},
      memoryUsageWarnings: 0,
      activeTimers: 0,
    });
    memoryMonitor.getPressureLevel.mockReturnValue('normal');
    const healthyStats = coordinator.getStats();
    expect(healthyStats.healthStatus.status).toBe('healthy');

    performanceMonitorInstance.getMetrics.mockReturnValueOnce({
      totalOperations: 20,
      slowOperations: 5,
      averageOperationTime: 150,
      maxOperationTime: 200,
      minOperationTime: 20,
      slowOperationsByType: {},
      operationCounts: {},
      memoryUsageWarnings: 0,
      activeTimers: 0,
    });
    memoryMonitor.getPressureLevel.mockReturnValue('normal');
    const degradedStats = coordinator.getStats();
    expect(degradedStats.healthStatus.status).toBe('degraded');
  });

  it('generates warning alerts for elevated memory pressure', () => {
    const coordinator = setupCoordinator();

    memoryMonitor.getPressureLevel.mockReset();
    memoryMonitor.getPressureLevel
      .mockReturnValueOnce('warning')
      .mockReturnValue('normal');

    intervalCallback();

    expect(logger.warning).toHaveBeenCalledWith(
      expect.stringContaining('Monitoring alert: High memory usage')
    );
  });
});
