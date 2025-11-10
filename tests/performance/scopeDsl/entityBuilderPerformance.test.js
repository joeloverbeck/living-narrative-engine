/**
 * @file Performance benchmarks for EntityBuilder
 * @description Tests focused on measuring EntityBuilder performance characteristics
 * - Entity creation efficiency under load
 * - Component building scalability
 * - Memory usage patterns with large datasets
 * - Plain object creation optimization
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityBuilder from '../../../src/scopeDsl/core/entityBuilder.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { performance } from 'perf_hooks';

// Set longer timeout for performance tests
jest.setTimeout(30000);

describe('EntityBuilder Performance', () => {
  let entityBuilder;
  let entityManager;
  let gateway;
  let mockLogger;

  beforeEach(() => {
    // Create a real logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create a simple entity manager with test entities
    entityManager = new SimpleEntityManager();

    // Create a gateway implementation that uses the entity manager
    gateway = {
      getEntityInstance: (id) => entityManager.getEntityInstance(id),
      getEntities: () => Array.from(entityManager.entities),
      getEntitiesWithComponent: (componentTypeId) => {
        return Array.from(entityManager.entities).filter(
          (entity) => entity.components && entity.components[componentTypeId]
        );
      },
      hasComponent: (entityId, componentTypeId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity && entity.components && !!entity.components[componentTypeId]
        );
      },
      getComponentData: (entityId, componentTypeId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity && entity.components && entity.components[componentTypeId]
        );
      },
    };

    // Create the entity builder with real dependencies
    entityBuilder = new EntityBuilder(gateway, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Entity Creation Performance', () => {
    it('should build entities efficiently under high load', () => {
      // Setup performance test data
      entityManager.setEntities([
        {
          id: 'perfTest',
          componentTypeIds: ['core:perf1', 'core:perf2', 'core:perf3'],
          components: {
            'core:perf1': { data: 'test' },
            'core:perf2': { data: 'test' },
            'core:perf3': { data: 'test' },
          },
        },
      ]);

      // Measure single entity build time over many iterations
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        entityBuilder.createEntityForEvaluation('perfTest');
      }

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;

      // Performance target: Average time per entity should be very low
      expect(avgTime).toBeLessThan(1); // Less than 1ms per entity

      // Log performance metrics
      console.log(`Entity build performance:`);
      console.log(
        `  Total time for ${iterations} iterations: ${endTime - startTime}ms`
      );
      console.log(`  Average time per entity: ${avgTime.toFixed(3)}ms`);
    });

    it('should handle plain object creation efficiently', () => {
      const entity = {
        id: 'plainPerf',
        componentTypeIds: ['core:test'],
      };

      gateway.getComponentData = jest.fn().mockReturnValue({ test: true });

      const iterations = 5000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        entityBuilder.createWithComponents(entity);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Performance target: Should handle 5000 plain objects in under 100ms
      expect(totalTime).toBeLessThan(100);

      // Log performance metrics
      console.log(`Plain object creation performance:`);
      console.log(`  Total time for ${iterations} iterations: ${totalTime}ms`);
      console.log(
        `  Average time per object: ${(totalTime / iterations).toFixed(3)}ms`
      );
      console.log(
        `  Objects per second: ${Math.round(iterations / (totalTime / 1000))}`
      );
    });
  });

  describe('Component Scalability Performance', () => {
    it('should handle large numbers of component types efficiently', () => {
      // Create entity with many component types
      const componentTypeIds = [];
      for (let i = 0; i < 50; i++) {
        componentTypeIds.push(`core:component${i}`);
      }

      const entity = {
        id: 'largeEntity',
        componentTypeIds,
      };

      // Mock gateway to return data for each component
      gateway.getComponentData = jest.fn((entityId, componentTypeId) => {
        const index = parseInt(componentTypeId.match(/\d+/)[0]);
        return { index, data: `Component ${index} data` };
      });

      const startTime = Date.now();
      const result = entityBuilder.createWithComponents(entity);
      const endTime = Date.now();

      // Performance target: Should complete in under 100ms even with many components
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100);

      // Verify all components were created
      expect(Object.keys(result.components).length).toBe(50);
      expect(result.components['core:component25']).toEqual({
        index: 25,
        data: 'Component 25 data',
      });

      // Log performance metrics
      console.log(`Large component set performance:`);
      console.log(`  Components processed: 50`);
      console.log(`  Processing time: ${processingTime}ms`);
      console.log(
        `  Time per component: ${(processingTime / 50).toFixed(2)}ms`
      );
    });
  });

  describe('Memory Usage Performance', () => {
    it('should validate memory usage with large datasets', () => {
      // Create a large number of entities with substantial data
      const largeEntities = [];
      for (let i = 0; i < 1000; i++) {
        largeEntities.push({
          id: `large${i}`,
          componentTypeIds: ['core:bigdata'],
          components: {
            'core:bigdata': {
              array: new Array(100).fill(i),
              string: 'x'.repeat(1000),
              nested: { data: { value: i } },
            },
          },
        });
      }
      entityManager.setEntities(largeEntities);

      // Track memory usage (simplified - in real tests you'd use proper memory profiling)
      const startMemory = process.memoryUsage().heapUsed;

      // Build a subset of entities
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(entityBuilder.createEntityForEvaluation(`large${i}`));
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Performance target: Memory increase should be reasonable (less than 50MB for 100 entities)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Verify entities were built correctly
      expect(results[50].components['core:bigdata'].array[0]).toBe(50);

      // Log memory metrics
      console.log(`Memory usage performance:`);
      console.log(`  Entities processed: 100`);
      console.log(
        `  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `  Memory per entity: ${(memoryIncrease / 100 / 1024).toFixed(2)}KB`
      );
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent entity building operations', () => {
      // Setup many entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push({
          id: `concurrent${i}`,
          componentTypeIds: ['core:data'],
          components: { 'core:data': { index: i } },
        });
      }
      entityManager.setEntities(entities);

      // Build many entities concurrently using Promise-based approach
      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(
            entityBuilder.createEntityForEvaluation(`concurrent${i}`)
          )
        );
      }

      return Promise.all(promises).then((results) => {
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Verify all entities were built correctly
        results.forEach((result, i) => {
          expect(result.id).toBe(`concurrent${i}`);
          expect(result.components['core:data'].index).toBe(i);
        });

        // Log concurrent processing metrics
        console.log(`Concurrent processing performance:`);
        console.log(`  Total entities: 100`);
        console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
        console.log(
          `  Average time per entity: ${(totalTime / 100).toFixed(2)}ms`
        );
      });
    });
  });

  describe('Performance Summary', () => {
    it('should demonstrate overall EntityBuilder performance characteristics', () => {
      // This test serves as a performance summary and validation
      const performanceTargets = {
        singleEntityBuild: 1, // < 1ms per entity
        plainObjectCreation: 0.02, // < 0.02ms per object (5000 in 100ms)
        largeComponentSet: 100, // < 100ms for 50 components
        memoryPerEntity: 512, // < 512KB per entity
      };

      // Log performance targets for reference
      console.log(`EntityBuilder Performance Targets:`);
      console.log(
        `  Single entity build: < ${performanceTargets.singleEntityBuild}ms`
      );
      console.log(
        `  Plain object creation: < ${performanceTargets.plainObjectCreation}ms`
      );
      console.log(
        `  Large component set: < ${performanceTargets.largeComponentSet}ms`
      );
      console.log(
        `  Memory per entity: < ${performanceTargets.memoryPerEntity}KB`
      );

      // This test always passes - it's for documentation purposes
      expect(performanceTargets).toBeDefined();
    });
  });
});
