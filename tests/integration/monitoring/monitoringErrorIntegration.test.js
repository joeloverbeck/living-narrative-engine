/**
 * @file Integration test for MonitoringCoordinator and Error Handler integration
 * @description Verifies that the monitoring system correctly integrates with error handlers
 * and that there are no circular dependencies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerMemoryMonitoring } from '../../../src/dependencyInjection/registrations/monitoringRegistrations.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import EventBus from '../../../src/events/eventBus.js';

describe('Monitoring and Error Handler Integration', () => {
  let container;
  let logger;
  let eventBus;

  beforeEach(() => {
    container = new AppContainer();
    logger = new ConsoleLogger();
    eventBus = new EventBus({ logger });

    // Register basic services
    container.register(tokens.ILogger, logger, { singleton: true });
    container.register(tokens.IEventBus, eventBus, { singleton: true });

    // Register monitoring and error handling services
    registerMemoryMonitoring(container);
  });

  it('should register MonitoringCoordinator successfully', () => {
    expect(() => {
      const monitoringCoordinator = container.resolve(
        tokens.IMonitoringCoordinator
      );
      expect(monitoringCoordinator).toBeDefined();
      expect(monitoringCoordinator.getStats).toBeDefined();
      expect(monitoringCoordinator.injectErrorHandlers).toBeDefined();
    }).not.toThrow();
  });

  it('should register CentralErrorHandler successfully', () => {
    expect(() => {
      const errorHandler = container.resolve(tokens.ICentralErrorHandler);
      expect(errorHandler).toBeDefined();
    }).not.toThrow();
  });

  it('should register RecoveryStrategyManager successfully', () => {
    expect(() => {
      const recoveryManager = container.resolve(
        tokens.IRecoveryStrategyManager
      );
      expect(recoveryManager).toBeDefined();
    }).not.toThrow();
  });

  it('should register ErrorReporter successfully', () => {
    expect(() => {
      const errorReporter = container.resolve(tokens.IErrorReporter);
      expect(errorReporter).toBeDefined();
    }).not.toThrow();
  });

  it('should have error handlers injected into MonitoringCoordinator', () => {
    // Resolve MonitoringCoordinator - this should trigger the deferred injection
    const monitoringCoordinator = container.resolve(
      tokens.IMonitoringCoordinator
    );

    // Get error handling components (this will trigger their creation and injection)
    const errorHandler = container.resolve(tokens.ICentralErrorHandler);
    const recoveryManager = container.resolve(tokens.IRecoveryStrategyManager);
    const errorReporter = container.resolve(tokens.IErrorReporter);

    // Verify that error handlers are accessible through MonitoringCoordinator
    expect(monitoringCoordinator.getErrorHandler).toBeDefined();
    expect(monitoringCoordinator.getRecoveryManager).toBeDefined();
    expect(monitoringCoordinator.getErrorReporter).toBeDefined();

    // Since injection happens in registerMemoryMonitoring, these should be set
    const injectedHandler = monitoringCoordinator.getErrorHandler();
    const injectedRecoveryManager = monitoringCoordinator.getRecoveryManager();
    const injectedReporter = monitoringCoordinator.getErrorReporter();

    expect(injectedHandler).toBe(errorHandler);
    expect(injectedRecoveryManager).toBe(recoveryManager);
    expect(injectedReporter).toBe(errorReporter);
  });

  it('should handle executeMonitored with error handler integration', async () => {
    const monitoringCoordinator = container.resolve(
      tokens.IMonitoringCoordinator
    );

    // Create a simple operation that succeeds
    const successOperation = jest.fn().mockResolvedValue('success');
    const result = await monitoringCoordinator.executeMonitored(
      'test-operation',
      successOperation,
      { useErrorHandler: true }
    );

    expect(result).toBe('success');
    expect(successOperation).toHaveBeenCalled();
  });

  it('should calculate health status including error metrics', () => {
    const monitoringCoordinator = container.resolve(
      tokens.IMonitoringCoordinator
    );
    const stats = monitoringCoordinator.getStats();

    expect(stats.healthStatus).toBeDefined();
    expect(stats.healthStatus.score).toBeGreaterThanOrEqual(0);
    expect(stats.healthStatus.score).toBeLessThanOrEqual(100);
    expect(stats.healthStatus.status).toMatch(/healthy|degraded|unhealthy/);
    expect(stats.healthStatus.factors).toBeDefined();
    expect(stats.healthStatus.factors.errorRate).toBeDefined();
  });

  it('should not have circular dependency errors', () => {
    // This test passes if we can resolve all services without errors
    expect(() => {
      const monitoringCoordinator = container.resolve(
        tokens.IMonitoringCoordinator
      );
      const errorHandler = container.resolve(tokens.ICentralErrorHandler);
      const recoveryManager = container.resolve(
        tokens.IRecoveryStrategyManager
      );
      const errorReporter = container.resolve(tokens.IErrorReporter);

      // Verify all are defined
      expect(monitoringCoordinator).toBeDefined();
      expect(errorHandler).toBeDefined();
      expect(recoveryManager).toBeDefined();
      expect(errorReporter).toBeDefined();
    }).not.toThrow();
  });
});
