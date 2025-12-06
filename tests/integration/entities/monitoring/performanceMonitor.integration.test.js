/**
 * @file Integration test for the entity PerformanceMonitor working with real monitoring infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MonitoringCoordinator from '../../../../src/entities/monitoring/MonitoringCoordinator.js';
import { EntityRepositoryAdapter } from '../../../../src/entities/services/entityRepositoryAdapter.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';

describe('Entity performance monitoring integration', () => {
  let performanceSpy;
  let dateSpy;
  let originalMemoryUsage;

  beforeEach(() => {
    let perfCounter = 0;
    performanceSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
      perfCounter += 8;
      return perfCounter;
    });

    let dateCounter = 1_700_000_000_000;
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      dateCounter += 1000;
      return dateCounter;
    });

    originalMemoryUsage = process.memoryUsage;
  });

  afterEach(() => {
    performanceSpy.mockRestore();
    dateSpy.mockRestore();
    process.memoryUsage = originalMemoryUsage;
  });

  it('should collect repository and workflow metrics through the monitoring coordinator', async () => {
    const coordinator = new MonitoringCoordinator({
      logger: console,
      enabled: true,
    });
    const repository = new EntityRepositoryAdapter({
      logger: console,
      monitoringCoordinator: coordinator,
    });

    const monitor = coordinator.getPerformanceMonitor();
    monitor.setSlowOperationThreshold(5);

    const entity = { id: 'entity-1', componentTypeIds: ['core:test'] };
    repository.add(entity);
    expect(repository.has('entity-1')).toBe(true);
    expect(repository.get('entity-1')).toBe(entity);

    await coordinator.executeMonitored(
      'async-repository-cycle',
      async () => {
        repository.add({ id: 'entity-2', componentTypeIds: ['core:extra'] });
        repository.remove('entity-2');
      },
      { context: 'integration-run', useCircuitBreaker: false }
    );

    try {
      repository.remove('missing-entity');
    } catch (error) {
      expect(error).toBeInstanceOf(EntityNotFoundError);
    }

    await expect(
      coordinator.executeMonitored(
        'failing-operation',
        async () => {
          throw new Error('boom');
        },
        {
          context: 'integration-run',
          useCircuitBreaker: false,
          useErrorHandler: false,
        }
      )
    ).rejects.toThrow('boom');

    process.memoryUsage = () => ({
      heapUsed: 900 * 1024 * 1024,
      heapTotal: 1024 * 1024 * 1024,
    });
    monitor.checkMemoryUsage();

    const metrics = monitor.getMetrics();
    expect(metrics.totalOperations).toBeGreaterThanOrEqual(5);
    expect(metrics.slowOperations).toBeGreaterThan(0);
    expect(metrics.memoryUsageWarnings).toBeGreaterThan(0);
    expect(metrics.operationCounts['repository.add']).toBeGreaterThanOrEqual(2);

    const recentOps = monitor.getRecentOperations(3);
    expect(recentOps.length).toBeGreaterThan(0);
    expect(recentOps[0].timestamp).toBeGreaterThan(
      recentOps[recentOps.length - 1].timestamp
    );

    const addOperations = monitor.getOperationsByType('repository.add');
    expect(addOperations.some((op) => op.context.startsWith('entity:'))).toBe(
      true
    );

    const slowOps = monitor.getSlowOperations();
    expect(slowOps.some((op) => op.operation === 'failing-operation')).toBe(
      true
    );

    const report = monitor.getPerformanceReport();
    expect(report).toContain('Performance Monitor Report');
    expect(report).toContain('Total Operations');

    const manualTimerId = monitor.startTimer('manual-step', 'manual');
    expect(typeof manualTimerId).toBe('string');
    const manualDuration = monitor.stopTimer(manualTimerId);
    expect(manualDuration).toBeGreaterThan(0);

    monitor.setEnabled(false);
    expect(monitor.getPerformanceReport()).toBe(
      'Performance monitoring is disabled'
    );
    const disabledMetrics = monitor.getMetrics();
    expect(disabledMetrics.totalOperations).toBe(0);
    expect(monitor.getRecentOperations()).toEqual([]);
    expect(monitor.getOperationsByType('repository.add')).toEqual([]);
    expect(monitor.getSlowOperations()).toEqual([]);
    expect(monitor.startTimer('disabled-op')).toBeNull();
    expect(monitor.timeSync('disabled-sync', () => 'value')).toBe('value');
    await expect(
      monitor.timeOperation('disabled-async', async () => 'ok')
    ).resolves.toBe('ok');

    monitor.setEnabled(true);
    monitor.setSlowOperationThreshold(2);
    const reenabedTimer = monitor.startTimer('reenabled-op');
    expect(typeof reenabedTimer).toBe('string');
    expect(monitor.stopTimer(reenabedTimer)).toBeGreaterThan(0);
    expect(monitor.stopTimer('missing-timer')).toBeNull();

    monitor.reset();
    const resetMetrics = monitor.getMetrics();
    expect(resetMetrics.totalOperations).toBe(0);
    expect(monitor.getRecentOperations()).toHaveLength(0);
    expect(monitor.getSlowOperations()).toHaveLength(0);
  });
});
