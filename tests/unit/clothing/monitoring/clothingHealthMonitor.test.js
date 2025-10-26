import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import ClothingHealthMonitor from '../../../../src/clothing/monitoring/clothingHealthMonitor.js';
import { validateDependency } from '../../../../src/utils/dependencyUtils.js';

jest.mock('../../../../src/utils/dependencyUtils.js', () => ({
  validateDependency: jest.fn(),
}));

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('ClothingHealthMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('performs health checks for the available clothing services', async () => {
    const logger = createLogger();
    const services = {
      clothingAccessibilityService: {
        getAccessibleItems: jest.fn().mockReturnValue(['hat']),
      },
      priorityManager: {
        calculatePriority: jest.fn().mockReturnValue(7),
      },
      coverageAnalyzer: {
        analyzeCoverageBlocking: jest.fn().mockReturnValue({ blocked: [] }),
      },
      errorHandler: {
        getErrorMetrics: jest.fn().mockReturnValue({
          warnings: { count: 2 },
          errors: { count: 1 },
        }),
      },
    };

    const nowSpy = jest.spyOn(performance, 'now');
    let clock = 0;
    nowSpy.mockImplementation(() => {
      clock += 5;
      return clock;
    });

    const monitor = new ClothingHealthMonitor(services, logger, 250);

    expect(validateDependency).toHaveBeenCalledWith(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    const results = await monitor.performHealthCheck();

    expect(results).toBeInstanceOf(Map);
    expect(results.size).toBe(4);

    const accessibilityResult = results.get('ClothingAccessibilityService');
    expect(accessibilityResult).toMatchObject({
      healthy: true,
      response: 'OK',
      testOperation: 'getAccessibleItems',
    });
    expect(typeof accessibilityResult.duration).toBe('string');

    const priorityResult = results.get('ClothingPriorityManager');
    expect(priorityResult).toMatchObject({
      healthy: true,
      samplePriority: 7,
    });

    const coverageResult = results.get('CoverageAnalyzer');
    expect(coverageResult).toMatchObject({
      healthy: true,
      testOperation: 'analyzeCoverageBlocking',
    });

    const errorHandlerResult = results.get('ClothingErrorHandler');
    expect(errorHandlerResult).toMatchObject({
      healthy: true,
      errorCount: 3,
    });

    expect(logger.debug).toHaveBeenCalledTimes(4);
    expect(services.clothingAccessibilityService.getAccessibleItems).toHaveBeenCalledWith(
      expect.stringContaining('health_check_entity_'),
      { mode: 'topmost' },
    );
    expect(services.priorityManager.calculatePriority).toHaveBeenCalledWith('base', 'removal');

    expect(monitor.getServiceHealth('ClothingAccessibilityService')).toMatchObject({
      healthy: true,
      testOperation: 'getAccessibleItems',
    });

    const report = monitor.getHealthReport();
    expect(report.monitoringActive).toBe(false);
    expect(report.checkInterval).toBe(250);
    expect(report.services.ClothingAccessibilityService.healthy).toBe(true);
    expect(report.overall.totalServices).toBe(4);
  });

  it('records unhealthy status when a health check throws', async () => {
    const logger = createLogger();
    const services = {
      clothingAccessibilityService: {
        getAccessibleItems: jest.fn(() => {
          throw new Error('access failure');
        }),
      },
    };

    jest.spyOn(performance, 'now').mockImplementation(() => 10);

    const monitor = new ClothingHealthMonitor(services, logger);

    const results = await monitor.performHealthCheck();
    const accessibilityResult = results.get('ClothingAccessibilityService');

    expect(accessibilityResult.healthy).toBe(false);
    expect(accessibilityResult.error).toBe('access failure');
    expect(logger.debug).toHaveBeenCalledWith(
      'Health check completed',
      expect.objectContaining({
        service: 'ClothingAccessibilityService',
        healthy: false,
      }),
    );

    const overall = monitor.getOverallHealth();
    expect(overall.healthy).toBe(false);
    expect(overall.totalServices).toBe(1);
    expect(overall.unhealthyServices).toBe(1);
  });

  it('returns default health data when no checks have run', () => {
    const monitor = new ClothingHealthMonitor({}, createLogger());

    const serviceHealth = monitor.getServiceHealth('Nonexistent');
    expect(serviceHealth).toMatchObject({
      healthy: false,
      error: 'No health check performed',
    });

    const overall = monitor.getOverallHealth();
    expect(overall).toMatchObject({
      healthy: false,
      totalServices: 0,
      healthyServices: 0,
      unhealthyServices: 0,
    });
  });

  it('groups healthy and unhealthy services in the overall summary', async () => {
    const logger = createLogger();
    const services = {
      clothingAccessibilityService: {
        getAccessibleItems: jest.fn().mockReturnValue(['item']),
      },
      priorityManager: {
        calculatePriority: jest.fn(() => {
          throw new Error('priority failure');
        }),
      },
    };

    jest.spyOn(performance, 'now').mockImplementation(() => 5);

    const monitor = new ClothingHealthMonitor(services, logger);
    await monitor.performHealthCheck();

    const overall = monitor.getOverallHealth();
    expect(overall.healthy).toBe(false);
    expect(overall.totalServices).toBe(2);
    expect(overall.healthyServices).toBe(1);
    expect(overall.unhealthyServices).toBe(1);
    expect(overall.services.healthy).toContain('ClothingAccessibilityService');
    expect(overall.services.unhealthy).toContain('ClothingPriorityManager');
  });

  it('handles failures in optional clothing services', async () => {
    const logger = createLogger();
    const services = {
      coverageAnalyzer: {
        analyzeCoverageBlocking: jest.fn(() => {
          throw new Error('coverage issue');
        }),
      },
      errorHandler: {
        getErrorMetrics: jest.fn(() => {
          throw new Error('metrics unavailable');
        }),
      },
    };

    const monitor = new ClothingHealthMonitor(services, logger);
    const results = await monitor.performHealthCheck();

    expect(results.get('CoverageAnalyzer')).toMatchObject({
      healthy: false,
      error: 'coverage issue',
    });
    expect(results.get('ClothingErrorHandler')).toMatchObject({
      healthy: false,
      error: 'metrics unavailable',
    });

    const serviceHealth = monitor.getServiceHealth('ClothingErrorHandler');
    expect(serviceHealth.healthy).toBe(false);
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  it('supports custom health checks and reports thrown errors', async () => {
    const logger = createLogger();
    const monitor = new ClothingHealthMonitor({}, logger);

    expect(() => monitor.registerHealthCheck('', () => ({}))).toThrow(
      'serviceName must be a non-empty string',
    );
    expect(() => monitor.registerHealthCheck('Custom', null)).toThrow(
      'healthCheck must be a function',
    );

    monitor.registerHealthCheck('ExplosiveService', () => {
      throw new Error('boom');
    });

    const results = await monitor.performHealthCheck();
    const failure = results.get('ExplosiveService');

    expect(failure.healthy).toBe(false);
    expect(failure.error).toBe('boom');
    expect(logger.warn).toHaveBeenCalledWith('Health check failed', {
      service: 'ExplosiveService',
      error: 'boom',
    });
  });

  it('manages monitoring intervals and disposal', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const services = {};
    const monitor = new ClothingHealthMonitor(services, logger, 100);

    const checkSpy = jest
      .spyOn(monitor, 'performHealthCheck')
      .mockResolvedValue(new Map());

    monitor.startMonitoring();

    expect(logger.info).toHaveBeenCalledWith('Health monitoring started', {
      interval: '100ms',
    });
    expect(checkSpy).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    expect(checkSpy).toHaveBeenCalledTimes(2);

    monitor.startMonitoring();
    expect(logger.warn).toHaveBeenCalledWith('Health monitoring already started');

    monitor.stopMonitoring();
    expect(logger.info).toHaveBeenCalledWith('Health monitoring stopped');

    const report = monitor.getHealthReport();
    expect(report.monitoringActive).toBe(false);
    expect(report.checkInterval).toBe(100);

    monitor.dispose();
    expect(monitor.getHealthReport().services).toEqual({});
    expect(checkSpy).toHaveBeenCalledTimes(2);
  });
});
