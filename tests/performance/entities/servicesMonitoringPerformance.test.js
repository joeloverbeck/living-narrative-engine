/**
 * @file Performance benchmarks for Services Monitoring under load
 * @description Tests focused on measuring monitoring performance under concurrent operations
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createDefaultServicesWithConfig } from '../../../src/entities/utils/createDefaultServicesWithConfig.js';
import EntityManagerIntegrationTestBed from '../../common/entities/entityManagerIntegrationTestBed.js';
import {
  createMockIdGenerator,
  createMockComponentCloner,
  createMockDefaultComponentPolicy,
} from '../../common/mockFactories/entities.js';
import {
  initializeGlobalConfig,
  resetGlobalConfig,
} from '../../../src/entities/utils/configUtils.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Services Monitoring Performance', () => {
  let services = null;
  let testBed = null;
  let monitoringCoordinator = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset global config first to ensure clean state
    resetGlobalConfig();

    // Create test bed with dependencies
    testBed = new EntityManagerIntegrationTestBed();

    // Initialize configuration with monitoring enabled BEFORE creating services
    const userConfig = {
      performance: {
        ENABLE_MONITORING: true,
        SLOW_OPERATION_THRESHOLD: 50, // Low threshold for testing
      },
      errorHandling: {
        ENABLE_CIRCUIT_BREAKER: true,
        CIRCUIT_BREAKER_THRESHOLD: 3,
        CIRCUIT_BREAKER_TIMEOUT: 1000,
      },
      monitoring: {
        ENABLE_HEALTH_CHECKS: true,
        HEALTH_CHECK_INTERVAL: 5000,
        SLOW_OPERATION_ALERT_THRESHOLD: 50,
      },
    };
    initializeGlobalConfig(testBed.mocks.logger, userConfig);

    // Add test entity definition to registry
    const actorDefinition = new EntityDefinition('core:actor', {
      description: 'Test actor entity',
      components: {
        'core:actor': {},
      },
    });
    testBed.mocks.registry.store(
      'entityDefinitions',
      'core:actor',
      actorDefinition
    );

    // Add component definition to registry
    testBed.mocks.registry.store('components', 'core:short_term_memory', {
      id: 'core:short_term_memory',
      dataSchema: {
        type: 'object',
        properties: {
          capacity: { type: 'number' },
          entries: { type: 'array' },
        },
        required: ['capacity', 'entries'],
      },
    });

    // Create services with monitoring enabled
    services = createDefaultServicesWithConfig({
      registry: testBed.mocks.registry,
      validator: testBed.mocks.validator,
      logger: testBed.mocks.logger,
      eventDispatcher: testBed.mocks.eventDispatcher,
      idGenerator: createMockIdGenerator(),
      cloner: createMockComponentCloner(),
      defaultPolicy: createMockDefaultComponentPolicy(),
    });

    // Get monitoring coordinator
    monitoringCoordinator = services.monitoringCoordinator;
  });

  afterEach(async () => {
    // Clean up any created entities
    if (services && services.entityRepository) {
      services.entityRepository.clear();
    }

    // Stop monitoring services if stop method exists
    if (
      monitoringCoordinator &&
      typeof monitoringCoordinator.stop === 'function'
    ) {
      await monitoringCoordinator.stop();
    }

    // Reset global config
    resetGlobalConfig();

    // Cleanup test bed
    testBed?.cleanup();
  });

  describe('Performance Monitoring Under Load', () => {
    it('should handle concurrent operations monitoring', async () => {
      const { entityLifecycleManager } = services;

      // Create multiple entities concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          entityLifecycleManager.createEntityInstance('core:actor', {
            instanceId: `concurrent-entity-${i}`,
          })
        );
      }

      await Promise.all(promises);

      // Check that all operations were monitored
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const createStats = performanceMonitor.getOperationsByType(
        'createEntityInstance'
      );
      expect(createStats.length).toBeGreaterThanOrEqual(10);
    });

    it('should track operation performance over time', async () => {
      const { entityLifecycleManager, componentMutationService } = services;

      // Perform various operations
      await entityLifecycleManager.createEntityInstance('core:actor', {
        instanceId: 'perf-test-entity',
      });

      await componentMutationService.addComponent(
        'perf-test-entity',
        'core:short_term_memory',
        { capacity: 5, entries: [] }
      );

      await componentMutationService.removeComponent(
        'perf-test-entity',
        'core:short_term_memory'
      );

      await entityLifecycleManager.removeEntityInstance('perf-test-entity');

      // Get comprehensive stats
      const stats = monitoringCoordinator.getStats();
      expect(stats.totalOperations).toBeGreaterThanOrEqual(4);

      // Check recent operations
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const recentOps = performanceMonitor.getRecentOperations();
      expect(recentOps.length).toBeGreaterThan(0);
    });

    it('should handle high-volume concurrent operations efficiently', async () => {
      const { entityLifecycleManager } = services;

      const startTime = performance.now();

      // Create a large number of entities concurrently
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          entityLifecycleManager.createEntityInstance('core:actor', {
            instanceId: `load-test-entity-${i}`,
          })
        );
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time even with monitoring overhead
      expect(totalTime).toBeLessThan(2000); // 2 seconds

      console.log(`Created 50 entities with monitoring in ${totalTime}ms`);

      // Verify monitoring captured all operations
      const performanceMonitor = monitoringCoordinator.getPerformanceMonitor();
      const createStats = performanceMonitor.getOperationsByType(
        'createEntityInstance'
      );
      expect(createStats.length).toBeGreaterThanOrEqual(50);

      // Check monitoring overhead didn't significantly impact performance
      const avgTimePerOperation = totalTime / 50;
      console.log(
        `Average time per monitored operation: ${avgTimePerOperation.toFixed(2)}ms`
      );
      expect(avgTimePerOperation).toBeLessThan(40); // Should be less than 40ms per operation
    });

    it('should maintain performance during mixed operations under load', async () => {
      const { entityLifecycleManager, componentMutationService } = services;

      const startTime = performance.now();

      // Mixed operations under load
      const operations = [];

      // Create entities
      for (let i = 0; i < 20; i++) {
        operations.push(
          entityLifecycleManager.createEntityInstance('core:actor', {
            instanceId: `mixed-entity-${i}`,
          })
        );
      }

      // Add components
      for (let i = 0; i < 15; i++) {
        operations.push(
          componentMutationService.addComponent(
            `mixed-entity-${i}`,
            'core:short_term_memory',
            { capacity: 5, entries: [] }
          )
        );
      }

      // Remove some components
      for (let i = 0; i < 10; i++) {
        operations.push(
          componentMutationService.removeComponent(
            `mixed-entity-${i}`,
            'core:short_term_memory'
          )
        );
      }

      await Promise.all(operations);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(
        `Completed 45 mixed operations with monitoring in ${totalTime}ms`
      );

      // Verify all operations were monitored
      const stats = monitoringCoordinator.getStats();
      expect(stats.totalOperations).toBeGreaterThanOrEqual(45);

      // Performance should be reasonable
      const avgTimePerOperation = totalTime / 45;
      console.log(
        `Average time per mixed monitored operation: ${avgTimePerOperation.toFixed(2)}ms`
      );
    });

    it('should demonstrate monitoring performance scaling', async () => {
      const { entityLifecycleManager } = services;

      const operationCounts = [10, 25, 50, 100];
      const results = {};

      for (const count of operationCounts) {
        const startTime = performance.now();

        const promises = [];
        for (let i = 0; i < count; i++) {
          promises.push(
            entityLifecycleManager.createEntityInstance('core:actor', {
              instanceId: `scale-test-${count}-${i}`,
            })
          );
        }

        await Promise.all(promises);

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        results[count] = {
          totalTime,
          avgTime: totalTime / count,
        };

        // Cleanup for next iteration
        for (let i = 0; i < count; i++) {
          await entityLifecycleManager.removeEntityInstance(
            `scale-test-${count}-${i}`
          );
        }
      }

      console.log('Monitoring performance scaling results:');
      for (const [count, data] of Object.entries(results)) {
        console.log(
          `  ${count} operations: ${data.totalTime.toFixed(2)}ms total, ${data.avgTime.toFixed(2)}ms avg`
        );
      }

      // Verify monitoring overhead doesn't grow exponentially
      const scalingFactor = results[100].avgTime / results[10].avgTime;
      expect(scalingFactor).toBeLessThan(3); // Should not be more than 3x slower
    });
  });
});
