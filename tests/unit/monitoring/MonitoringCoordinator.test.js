import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonitoringCoordinator from '../../../src/entities/monitoring/MonitoringCoordinator.js';
import PerformanceMonitor from '../../../src/entities/monitoring/PerformanceMonitor.js';
import CircuitBreaker from '../../../src/entities/monitoring/CircuitBreaker.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

jest.mock('../../../src/entities/monitoring/PerformanceMonitor.js');
jest.mock('../../../src/entities/monitoring/CircuitBreaker.js');

describe('MonitoringCoordinator', () => {
  let coordinator;
  let logger;
  let mockPerformanceMonitor;
  let mockCircuitBreaker;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createMockLogger();
    // Add warning method since #addAlert uses logger[type] and type can be 'warning'
    logger.warning = jest.fn();

    // Mock PerformanceMonitor
    mockPerformanceMonitor = {
      startTimer: jest.fn().mockReturnValue('timer-123'),
      stopTimer: jest.fn().mockReturnValue(50),
      timeOperation: jest.fn().mockImplementation(async (name, fn) => fn()),
      timeSync: jest.fn().mockImplementation((name, fn) => fn()),
      getMetrics: jest.fn().mockReturnValue({
        totalOperations: 0,
        slowOperations: 0,
        averageOperationTime: 0,
        maxOperationTime: 0,
        minOperationTime: 0,
        operationCounts: {},
        slowOperationsByType: {},
        memoryUsageWarnings: 0,
        activeTimers: 0,
      }),
      setEnabled: jest.fn(),
      checkMemoryUsage: jest.fn(),
      reset: jest.fn(),
      getRecentOperations: jest.fn().mockReturnValue([]),
    };
    PerformanceMonitor.mockImplementation(() => mockPerformanceMonitor);

    // Mock CircuitBreaker
    mockCircuitBreaker = {
      execute: jest.fn().mockImplementation(async (fn) => fn()),
      executeSync: jest.fn().mockImplementation((fn) => fn()),
      getStats: jest.fn().mockReturnValue({
        state: 'CLOSED',
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        lastFailureTime: null,
      }),
      setEnabled: jest.fn(),
    };
    CircuitBreaker.mockImplementation(() => mockCircuitBreaker);
  });

  describe('constructor', () => {
    it('should create coordinator with default settings', () => {
      coordinator = new MonitoringCoordinator({ logger });

      expect(coordinator).toBeDefined();
      expect(PerformanceMonitor).toHaveBeenCalledWith({
        logger,
        enabled: true,
      });
    });

    it('should create coordinator in disabled state when enabled is false', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: false });

      expect(coordinator).toBeDefined();
      // setEnabled is not called in constructor for PerformanceMonitor
      // The enabled state is passed as constructor param
    });

    it('should create coordinator with custom check interval', () => {
      const checkInterval = 60000;
      coordinator = new MonitoringCoordinator({
        logger,
        checkInterval,
      });

      expect(coordinator).toBeDefined();
    });
  });

  describe('getPerformanceMonitor', () => {
    it('should return the performance monitor instance', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const monitor = coordinator.getPerformanceMonitor();

      expect(monitor).toBe(mockPerformanceMonitor);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should create and return a new circuit breaker', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const breaker = coordinator.getCircuitBreaker('test-operation');

      expect(CircuitBreaker).toHaveBeenCalledWith({
        logger,
        options: {
          failureThreshold: 2, // Test environment default
          successThreshold: 2,
          timeout: 30000,
          halfOpenRequests: 3,
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          name: 'test-operation',
        },
      });
      expect(breaker).toBe(mockCircuitBreaker);
    });

    it('should return existing circuit breaker for same operation', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const breaker1 = coordinator.getCircuitBreaker('test-operation');
      const breaker2 = coordinator.getCircuitBreaker('test-operation');

      expect(breaker1).toBe(breaker2);
      expect(CircuitBreaker).toHaveBeenCalledTimes(1);
    });

    it('should create circuit breaker with custom options', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const options = { failureThreshold: 10, timeout: 30000 };
      coordinator.getCircuitBreaker('test-operation', options);

      expect(CircuitBreaker).toHaveBeenCalledWith({
        logger,
        options: {
          failureThreshold: 10, // Overridden by custom options
          successThreshold: 2,
          timeout: 30000,
          halfOpenRequests: 3,
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          name: 'test-operation',
        },
      });
    });
  });

  describe('executeMonitored', () => {
    let operation;
    let result;

    beforeEach(() => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });
      operation = jest.fn().mockResolvedValue('success');
      result = null;
    });

    it('should execute operation with monitoring', async () => {
      result = await coordinator.executeMonitored('test-op', operation, {
        context: 'test-context',
      });

      expect(operation).toHaveBeenCalled();
      expect(result).toBe('success');
      expect(mockPerformanceMonitor.timeOperation).toHaveBeenCalledWith(
        'test-op',
        expect.any(Function),
        'test-context'
      );
    });

    it('should handle operation errors', async () => {
      const error = new Error('Test error');
      operation = jest.fn().mockRejectedValue(error);
      mockPerformanceMonitor.timeOperation.mockRejectedValue(error);

      await expect(
        coordinator.executeMonitored('test-op', operation)
      ).rejects.toThrow(error);

      expect(mockPerformanceMonitor.timeOperation).toHaveBeenCalled();
    });

    it('should use circuit breaker when requested', async () => {
      result = await coordinator.executeMonitored('test-op', operation, {
        useCircuitBreaker: true,
      });

      expect(mockCircuitBreaker.execute).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(result).toBe('success');
    });

    it('should skip monitoring when disabled', async () => {
      coordinator.setEnabled(false);
      result = await coordinator.executeMonitored('test-op', operation);

      expect(operation).toHaveBeenCalled();
      expect(result).toBe('success');
      expect(mockPerformanceMonitor.timeOperation).not.toHaveBeenCalled();
    });

    it('should apply custom circuit breaker options', async () => {
      const circuitBreakerOptions = { failureThreshold: 5 };
      await coordinator.executeMonitored('test-op', operation, {
        useCircuitBreaker: true,
        circuitBreakerOptions,
      });

      expect(CircuitBreaker).toHaveBeenCalledWith({
        logger,
        options: {
          failureThreshold: 5, // Overridden by custom options
          successThreshold: 2,
          timeout: 30000,
          halfOpenRequests: 3,
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          name: 'test-op',
        },
      });
    });
  });

  describe('executeSyncMonitored', () => {
    let operation;

    beforeEach(() => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });
      operation = jest.fn().mockReturnValue('sync-success');
    });

    it('should execute sync operation with monitoring', () => {
      const result = coordinator.executeSyncMonitored(
        'test-sync-op',
        operation,
        { context: 'sync-context' }
      );

      expect(operation).toHaveBeenCalled();
      expect(result).toBe('sync-success');
      expect(mockPerformanceMonitor.timeSync).toHaveBeenCalledWith(
        'test-sync-op',
        expect.any(Function),
        'sync-context'
      );
    });

    it('should handle sync operation errors', () => {
      const error = new Error('Sync error');
      operation = jest.fn().mockImplementation(() => {
        throw error;
      });
      mockPerformanceMonitor.timeSync.mockImplementation(() => {
        throw error;
      });

      expect(() =>
        coordinator.executeSyncMonitored('test-sync-op', operation)
      ).toThrow(error);

      expect(mockPerformanceMonitor.timeSync).toHaveBeenCalled();
    });

    it('should use circuit breaker for sync operations', () => {
      const result = coordinator.executeSyncMonitored(
        'test-sync-op',
        operation,
        { useCircuitBreaker: true }
      );

      expect(mockCircuitBreaker.executeSync).toHaveBeenCalled();
      expect(result).toBe('sync-success');
    });
  });

  describe('getStats', () => {
    it('should return combined stats from all components', () => {
      coordinator = new MonitoringCoordinator({ logger });
      coordinator.getCircuitBreaker('op1');
      coordinator.getCircuitBreaker('op2');

      const stats = coordinator.getStats();

      expect(stats).toEqual({
        enabled: true,
        performance: mockPerformanceMonitor.getMetrics(),
        circuitBreakers: {
          op1: {
            state: 'CLOSED',
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            lastFailureTime: null,
          },
          op2: {
            state: 'CLOSED',
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            lastFailureTime: null,
          },
        },
        memory: null,
        totalOperations: 0,
        totalFailures: 0,
        recentAlerts: [],
        healthChecksActive: expect.any(Boolean),
        errors: null,
        topErrors: null,
        healthStatus: {
          score: 100,
          status: 'healthy',
          factors: {
            performance: 0,
            circuitBreakers: 0,
            memory: 'normal',
            errorRate: 0
          }
        }
      });
    });
  });

  describe('getMonitoringReport', () => {
    it('should return comprehensive monitoring report', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const report = coordinator.getMonitoringReport();

      expect(report).toContain('Entity Module Monitoring Report');
      expect(report).toContain('Monitoring Status: Enabled');
      expect(report).toContain('Performance Metrics:');
      expect(report).toContain('Circuit Breakers:');
    });

    it('should indicate when monitoring is disabled', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: false });
      const report = coordinator.getMonitoringReport();

      expect(report).toContain('Monitoring Status: Disabled');
      expect(report).toContain('Monitoring is disabled');
      expect(report).toContain('Health Checks: Inactive');
    });
  });

  describe('setEnabled', () => {
    it('should enable monitoring', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: false });
      coordinator.setEnabled(true);

      expect(mockPerformanceMonitor.setEnabled).toHaveBeenCalledWith(true);
    });

    it('should disable monitoring', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });
      coordinator.setEnabled(false);

      expect(mockPerformanceMonitor.setEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('startTimer and stopTimer', () => {
    it('should delegate timer operations to performance monitor', () => {
      coordinator = new MonitoringCoordinator({ logger });

      const timerId = coordinator.startTimer('test-op', 'test-context');
      expect(mockPerformanceMonitor.startTimer).toHaveBeenCalledWith(
        'test-op',
        'test-context'
      );
      expect(timerId).toBe('timer-123');

      const duration = coordinator.stopTimer(timerId);
      expect(mockPerformanceMonitor.stopTimer).toHaveBeenCalledWith(timerId);
      expect(duration).toBe(50);
    });
  });

  describe('reset', () => {
    it('should reset all monitoring state', () => {
      coordinator = new MonitoringCoordinator({ logger });
      coordinator.getCircuitBreaker('op1');
      coordinator.getCircuitBreaker('op2');

      coordinator.reset();

      expect(mockPerformanceMonitor.reset).toHaveBeenCalled();
      // Getting circuit breakers after reset should create new instances
      coordinator.getCircuitBreaker('op1');
      expect(CircuitBreaker).toHaveBeenCalledTimes(3); // 2 before reset, 1 after
    });
  });

  describe('close', () => {
    it('should log closure', () => {
      coordinator = new MonitoringCoordinator({ logger });
      coordinator.close();

      expect(logger.info).toHaveBeenCalledWith('MonitoringCoordinator closed');
    });
  });

  describe('health checks', () => {
    let realSetInterval;
    let realClearInterval;
    let intervalCallback;

    beforeEach(() => {
      // Capture the real functions
      realSetInterval = global.setInterval;
      realClearInterval = global.clearInterval;

      // Mock setInterval to capture the callback
      global.setInterval = jest.fn((callback, interval) => {
        intervalCallback = callback;
        return 123; // Return a fake interval ID
      });
      global.clearInterval = jest.fn();
    });

    afterEach(() => {
      // Restore real functions
      global.setInterval = realSetInterval;
      global.clearInterval = realClearInterval;
    });

    it('should start health checks when enabled', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
        checkInterval: 5000,
      });

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5000
      );
    });

    it('should not start health checks when disabled', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: false,
      });

      expect(global.setInterval).not.toHaveBeenCalled();
    });

    it('should stop health checks when disabling monitoring', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      coordinator.setEnabled(false);

      expect(global.clearInterval).toHaveBeenCalledWith(123);
    });

    it('should restart health checks when enabling monitoring', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: false,
      });

      coordinator.setEnabled(true);

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );
    });

    it('should perform health check and check memory usage', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      // Trigger the health check
      intervalCallback();

      expect(mockPerformanceMonitor.checkMemoryUsage).toHaveBeenCalled();
    });

    it('should handle health check errors gracefully', () => {
      mockPerformanceMonitor.checkMemoryUsage.mockImplementation(() => {
        throw new Error('Memory check failed');
      });

      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      // Should not throw
      expect(() => intervalCallback()).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Health check failed:',
        expect.any(Error)
      );
    });

    it('should check circuit breaker health and add alerts for OPEN state', () => {
      const openBreaker = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'OPEN',
          totalRequests: 20,
          totalFailures: 15,
          totalSuccesses: 5,
          lastFailureTime: Date.now(),
        }),
      };

      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      // Override the circuit breaker for this test
      CircuitBreaker.mockImplementationOnce(() => openBreaker);
      coordinator.getCircuitBreaker('test-operation');

      // Trigger health check
      intervalCallback();

      expect(logger.warning).toHaveBeenCalledWith(
        expect.stringContaining("Circuit breaker 'test-operation' is OPEN")
      );
      expect(logger.warning).toHaveBeenCalledWith(
        expect.stringContaining('High failure rate (75%) for circuit breaker')
      );
    });

    it('should check circuit breaker health and add alerts for HALF_OPEN state', () => {
      const halfOpenBreaker = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'HALF_OPEN',
          totalRequests: 10,
          totalFailures: 3,
          totalSuccesses: 7,
          lastFailureTime: Date.now(),
        }),
      };

      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      // Override the circuit breaker for this test
      CircuitBreaker.mockImplementationOnce(() => halfOpenBreaker);
      coordinator.getCircuitBreaker('test-operation');

      // Trigger health check
      intervalCallback();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Circuit breaker 'test-operation' is HALF_OPEN")
      );
    });

    it('should detect performance degradation', () => {
      mockPerformanceMonitor.getMetrics.mockReturnValue({
        totalOperations: 100,
        slowOperations: 30,
        averageOperationTime: 250,
        maxOperationTime: 500,
        minOperationTime: 10,
        operationCounts: {},
        slowOperationsByType: {},
        memoryUsageWarnings: 0,
        activeTimers: 0,
      });

      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      // Trigger health check
      intervalCallback();

      expect(logger.warning).toHaveBeenCalledWith(
        expect.stringContaining('High average operation time: 250.00ms')
      );
      expect(logger.warning).toHaveBeenCalledWith(
        expect.stringContaining('High slow operation rate: 30%')
      );
    });

    it('should clean up old alerts', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      // Add some alerts directly (we'll access private field through getStats)
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const recentTimestamp = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago

      // We need to trigger alerts through the health check system
      // First set up a circuit breaker that will generate alerts
      const openBreaker = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'OPEN',
          totalRequests: 20,
          totalFailures: 15,
          totalSuccesses: 5,
          lastFailureTime: Date.now(),
        }),
      };

      CircuitBreaker.mockImplementationOnce(() => openBreaker);
      coordinator.getCircuitBreaker('test-operation');

      // Trigger health check to add alerts
      intervalCallback();

      const statsAfter = coordinator.getStats();
      // Recent alerts should be present
      expect(statsAfter.recentAlerts.length).toBeGreaterThan(0);
      // All alerts should be recent (within 24 hours)
      statsAfter.recentAlerts.forEach((alert) => {
        expect(Date.now() - alert.timestamp).toBeLessThan(24 * 60 * 60 * 1000);
      });
    });

    it('should stop health checks on close', () => {
      coordinator = new MonitoringCoordinator({
        logger,
        enabled: true,
      });

      coordinator.close();

      expect(global.clearInterval).toHaveBeenCalledWith(123);
    });
  });

  describe('executeSyncMonitored with disabled monitoring', () => {
    it('should skip circuit breaker when monitoring is disabled', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: false });
      const operation = jest.fn().mockReturnValue('result');

      const result = coordinator.executeSyncMonitored('test-op', operation, {
        useCircuitBreaker: true,
      });

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
      expect(mockCircuitBreaker.executeSync).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.timeSync).not.toHaveBeenCalled();
    });

    it('should skip performance monitoring when disabled', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: false });
      const operation = jest.fn().mockReturnValue('result');

      const result = coordinator.executeSyncMonitored('test-op', operation, {
        useCircuitBreaker: false,
      });

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
      expect(mockPerformanceMonitor.timeSync).not.toHaveBeenCalled();
    });
  });

  describe('executeMonitored without circuit breaker', () => {
    it('should execute operation without circuit breaker when useCircuitBreaker is false', async () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });
      const operation = jest.fn().mockResolvedValue('success');

      const result = await coordinator.executeMonitored('test-op', operation, {
        useCircuitBreaker: false,
      });

      expect(result).toBe('success');
      expect(mockPerformanceMonitor.timeOperation).toHaveBeenCalled();
      expect(mockCircuitBreaker.execute).not.toHaveBeenCalled();
    });
  });

  describe('executeSyncMonitored without circuit breaker', () => {
    it('should execute sync operation without circuit breaker when useCircuitBreaker is false', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });
      const operation = jest.fn().mockReturnValue('sync-result');

      const result = coordinator.executeSyncMonitored('test-op', operation, {
        useCircuitBreaker: false,
      });

      expect(result).toBe('sync-result');
      expect(mockPerformanceMonitor.timeSync).toHaveBeenCalled();
      expect(mockCircuitBreaker.executeSync).not.toHaveBeenCalled();
    });
  });

  describe('getMonitoringReport with various states', () => {
    it('should show circuit breakers with different states', () => {
      coordinator = new MonitoringCoordinator({ logger });

      // Create circuit breakers with different states
      const openBreaker = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'OPEN',
          totalRequests: 100,
          totalFailures: 60,
          totalSuccesses: 40,
          lastFailureTime: Date.now(),
        }),
      };

      const halfOpenBreaker = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'HALF_OPEN',
          totalRequests: 50,
          totalFailures: 10,
          totalSuccesses: 40,
          lastFailureTime: Date.now(),
        }),
      };

      CircuitBreaker.mockImplementationOnce(() => openBreaker);
      coordinator.getCircuitBreaker('operation-1');

      CircuitBreaker.mockImplementationOnce(() => halfOpenBreaker);
      coordinator.getCircuitBreaker('operation-2');

      const report = coordinator.getMonitoringReport();

      expect(report).toContain('operation-1: OPEN (60/100 failures)');
      expect(report).toContain('operation-2: HALF_OPEN (10/50 failures)');
    });

    it('should show recent alerts in report', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });

      // We need to trigger alerts through the health check system
      // Set up metrics that will trigger alerts
      mockPerformanceMonitor.getMetrics.mockReturnValue({
        totalOperations: 100,
        slowOperations: 30,
        averageOperationTime: 250,
        maxOperationTime: 500,
        minOperationTime: 10,
        operationCounts: {},
        slowOperationsByType: {},
        memoryUsageWarnings: 5,
        activeTimers: 0,
      });

      // Mock setInterval to capture callback
      const originalSetInterval = global.setInterval;
      let intervalCallback;
      global.setInterval = jest.fn((callback) => {
        intervalCallback = callback;
        return 123;
      });

      // Re-create coordinator to capture interval
      coordinator = new MonitoringCoordinator({ logger, enabled: true });

      // Trigger health check to generate alerts
      intervalCallback();

      // Restore setInterval
      global.setInterval = originalSetInterval;

      const report = coordinator.getMonitoringReport();

      expect(report).toContain('Recent Alerts:');
      expect(report).toMatch(/WARNING: High average operation time/);
    });

    it('should show memory warnings in report', () => {
      mockPerformanceMonitor.getMetrics.mockReturnValue({
        totalOperations: 50,
        slowOperations: 5,
        averageOperationTime: 45,
        maxOperationTime: 100,
        minOperationTime: 10,
        operationCounts: { 'test-op': 50 },
        slowOperationsByType: { 'test-op': 5 },
        memoryUsageWarnings: 3,
        activeTimers: 2,
      });

      coordinator = new MonitoringCoordinator({ logger });
      const report = coordinator.getMonitoringReport();

      expect(report).toContain('Memory Warnings: 3');
    });

    it('should handle empty circuit breakers in report', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const report = coordinator.getMonitoringReport();

      expect(report).toContain('Circuit Breakers:');
      expect(report).toContain('No circuit breakers active');
    });

    it('should handle no recent alerts in report', () => {
      coordinator = new MonitoringCoordinator({ logger });
      const report = coordinator.getMonitoringReport();

      expect(report).toContain('Recent Alerts:');
      expect(report).toContain('No recent alerts');
    });
  });

  describe('setEnabled with circuit breakers', () => {
    it('should propagate enabled state to all circuit breakers', () => {
      coordinator = new MonitoringCoordinator({ logger, enabled: true });

      // Create multiple circuit breakers
      const breaker1 = coordinator.getCircuitBreaker('op1');
      const breaker2 = coordinator.getCircuitBreaker('op2');

      coordinator.setEnabled(false);

      expect(breaker1.setEnabled).toHaveBeenCalledWith(false);
      expect(breaker2.setEnabled).toHaveBeenCalledWith(false);
      expect(mockPerformanceMonitor.setEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('getStats with multiple circuit breakers', () => {
    it('should aggregate failure counts from all circuit breakers', () => {
      coordinator = new MonitoringCoordinator({ logger });

      // Create circuit breakers with different failure counts
      const breaker1 = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'CLOSED',
          totalRequests: 100,
          totalFailures: 10,
          totalSuccesses: 90,
          lastFailureTime: null,
        }),
      };

      const breaker2 = {
        ...mockCircuitBreaker,
        getStats: jest.fn().mockReturnValue({
          state: 'OPEN',
          totalRequests: 50,
          totalFailures: 30,
          totalSuccesses: 20,
          lastFailureTime: Date.now(),
        }),
      };

      CircuitBreaker.mockImplementationOnce(() => breaker1);
      coordinator.getCircuitBreaker('op1');

      CircuitBreaker.mockImplementationOnce(() => breaker2);
      coordinator.getCircuitBreaker('op2');

      const stats = coordinator.getStats();

      expect(stats.totalFailures).toBe(40); // 10 + 30
      expect(stats.circuitBreakers.op1.totalFailures).toBe(10);
      expect(stats.circuitBreakers.op2.totalFailures).toBe(30);
    });
  });

  describe('constructor with custom circuit breaker options', () => {
    it('should apply default circuit breaker options to all breakers', () => {
      const defaultOptions = {
        failureThreshold: 5,
        timeout: 10000,
        resetTimeout: 30000,
      };

      coordinator = new MonitoringCoordinator({
        logger,
        circuitBreakerOptions: defaultOptions,
      });

      coordinator.getCircuitBreaker('test-op');

      expect(CircuitBreaker).toHaveBeenCalledWith({
        logger,
        options: {
          failureThreshold: 2, // Test environment default overrides constructor
          successThreshold: 2, // From config default
          timeout: 30000, // Test environment default overrides constructor
          halfOpenRequests: 3, // From config default
          volumeThreshold: 10, // From config default
          errorThresholdPercentage: 50, // From config default
          resetTimeout: 30000, // Added by constructor options
          name: 'test-op',
        },
      });
    });

    it('should merge default and custom options for circuit breakers', () => {
      const defaultOptions = {
        failureThreshold: 5,
        timeout: 10000,
      };

      coordinator = new MonitoringCoordinator({
        logger,
        circuitBreakerOptions: defaultOptions,
      });

      const customOptions = {
        failureThreshold: 10, // Override default
        resetTimeout: 60000, // Add new option
      };

      coordinator.getCircuitBreaker('test-op', customOptions);

      expect(CircuitBreaker).toHaveBeenCalledWith({
        logger,
        options: {
          failureThreshold: 10, // Overridden by method options
          successThreshold: 2, // From config default
          timeout: 30000, // Test environment default overrides constructor
          halfOpenRequests: 3, // From config default
          volumeThreshold: 10, // From config default
          errorThresholdPercentage: 50, // From config default
          resetTimeout: 60000, // Added by method options
          name: 'test-op',
        },
      });
    });
  });
});
