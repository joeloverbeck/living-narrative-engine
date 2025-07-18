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
        options: { name: 'test-operation' },
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
        options: { name: 'test-operation', ...options },
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
        options: { name: 'test-op', ...circuitBreakerOptions },
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
        totalOperations: 0,
        totalFailures: 0,
        recentAlerts: [],
        healthChecksActive: expect.any(Boolean),
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

      expect(report).toBe('Monitoring is disabled');
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
});
