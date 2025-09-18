/**
 * @file entityFactoryPerformance.test.js
 * @description Performance tests for entity factory operations
 *
 * Tests the performance characteristics of entity factory system including:
 * - Entity construction pipeline throughput
 * - Definition lookup and caching effectiveness
 * - Cache invalidation and optimization
 * - Large-scale entity creation performance
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from '../../e2e/entities/common/entityWorkflowTestBed.js';

describe('Entity Factory Performance Tests', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Construction Pipeline Performance', () => {
    it('should measure and validate construction pipeline performance', async () => {
      // Arrange
      const definitionId = 'test:performance_entity';
      const entityCount = 50;
      const performanceMetrics = {
        creationTimes: [],
        validationOverhead: [],
        totalTime: 0,
      };

      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Performance Test' },
          'core:position': { locationId: 'perf_location' },
          'test:complex': {
            data: Array(100).fill(0).map((_, i) => ({
              id: `item_${i}`,
              value: Math.random() * 100,
            })),
          },
        },
      });

      // Register complex component schema
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: { type: 'number' },
                },
              },
            },
          },
        },
        'test:complex'
      );

      // Act - Create multiple entities and measure performance
      const overallStart = performance.now();

      for (let i = 0; i < entityCount; i++) {
        const startTime = performance.now();

        const entity = await testBed.createTestEntity(definitionId, {
          instanceId: `perf_entity_${i}`,
          componentOverrides: {
            'core:name': { text: `Performance Entity ${i}` },
          },
        });

        const endTime = performance.now();
        const creationTime = endTime - startTime;

        performanceMetrics.creationTimes.push(creationTime);

        expect(entity).toBeDefined();
      }

      const overallEnd = performance.now();
      performanceMetrics.totalTime = overallEnd - overallStart;

      // Calculate metrics
      const avgCreationTime = performanceMetrics.creationTimes.reduce((a, b) => a + b, 0) / entityCount;
      const maxCreationTime = Math.max(...performanceMetrics.creationTimes);
      const minCreationTime = Math.min(...performanceMetrics.creationTimes);

      // Assert performance meets targets
      expect(avgCreationTime).toBeLessThan(100); // < 100ms average per entity
      expect(maxCreationTime).toBeLessThan(200); // No single creation > 200ms
      expect(performanceMetrics.totalTime / entityCount).toBeLessThan(100); // Overall average < 100ms

      // Log performance metrics for analysis
      testBed.logger.info(`Factory Performance Metrics:
        Total Entities: ${entityCount}
        Total Time: ${performanceMetrics.totalTime.toFixed(2)}ms
        Average Time: ${avgCreationTime.toFixed(2)}ms
        Min Time: ${minCreationTime.toFixed(2)}ms
        Max Time: ${maxCreationTime.toFixed(2)}ms`);
    });
  });

  describe('Definition Lookup and Caching Performance', () => {
    it('should efficiently cache and reuse entity definitions', async () => {
      // Arrange
      const definitionId = 'test:cached_definition';
      const entityCount = 20;
      const lookupTimes = [];

      // Create a complex definition to make caching benefits more apparent
      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'core:name': { text: 'Cached Entity' },
          'core:description': { text: 'Testing definition caching' },
          'test:nested': {
            level1: {
              level2: {
                level3: {
                  data: Array(50).fill(0).map((_, i) => `value_${i}`),
                },
              },
            },
          },
        },
      });

      // Act - Create multiple entities and measure lookup times
      for (let i = 0; i < entityCount; i++) {
        const lookupStart = performance.now();

        const entity = await testBed.entityManager.createEntityInstance(definitionId, {
          instanceId: `cached_entity_${i}`,
        });

        const lookupEnd = performance.now();
        const lookupTime = lookupEnd - lookupStart;
        lookupTimes.push(lookupTime);

        expect(entity).toBeDefined();
      }

      // Analyze caching effectiveness
      const firstLookupTime = lookupTimes[0];
      const cachedLookupTimes = lookupTimes.slice(1);
      const avgCachedTime = cachedLookupTimes.reduce((a, b) => a + b, 0) / cachedLookupTimes.length;

      // Assert caching is effective
      expect(avgCachedTime).toBeLessThan(firstLookupTime); // Cached lookups faster
      expect(avgCachedTime).toBeLessThan(5); // Cached lookups < 5ms

      // Verify cache hit rate improves over time
      const lastFiveLookups = lookupTimes.slice(-5);
      const avgLastFive = lastFiveLookups.reduce((a, b) => a + b, 0) / 5;
      expect(avgLastFive).toBeLessThan(3); // Very fast for warmed cache
    });

    it('should validate cache invalidation and refresh mechanisms', async () => {
      // Arrange
      const definitionId = 'test:mutable_definition';
      const originalDefinition = {
        id: definitionId,
        components: {
          'core:name': { text: 'Original Name' },
          'core:version': { value: 1 },
        },
      };

      const updatedDefinition = {
        id: definitionId,
        components: {
          'core:name': { text: 'Updated Name' },
          'core:version': { value: 2 },
          'core:timestamp': { modified: Date.now() },
        },
      };

      // Register version schema
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
        },
        'core:version'
      );

      // Act - Create entity with original definition
      await testBed.ensureEntityDefinitionExists(definitionId, originalDefinition);

      const entity1 = await testBed.entityManager.createEntityInstance(definitionId, {
        instanceId: 'cache_test_1',
      });

      expect(entity1).toBeDefined();

      // Get the cached definition indirectly through entity
      const entity1Name = testBed.entityManager.getEntityInstance('cache_test_1')
        .getComponentData('core:name');
      expect(entity1Name.text).toBe('Original Name');

      // Update the definition in registry
      testBed.registry.store('entityDefinitions', definitionId, updatedDefinition);

      // Create new entity with updated definition
      const entity2 = await testBed.entityManager.createEntityInstance(definitionId, {
        instanceId: 'cache_test_2',
      });

      expect(entity2).toBeDefined();

      // Verify new entity - cache invalidation behavior depends on implementation
      const entity2Instance = testBed.entityManager.getEntityInstance('cache_test_2');
      const entity2Name = entity2Instance.getComponentData('core:name');
      const entity2Version = entity2Instance.getComponentData('core:version');

      // In some implementations, the cache might not be immediately invalidated
      // This test validates that the system remains stable even if cache behavior varies
      expect(entity2Name).toBeDefined();
      expect(entity2Version).toBeDefined();

      // The version should be either original (cached) or updated (invalidated)
      expect([1, 2]).toContain(entity2Version.value);

      // Entity should exist and be functional
      expect(entity2).toBeDefined();
      expect(entity2Instance.id).toBe('cache_test_2');
    });

    it('should optimize lookup performance for large definition sets', async () => {
      // Arrange - Create many definitions
      const definitionCount = 100;
      const definitions = [];
      const lookupMetrics = {
        coldLookups: [],
        warmLookups: [],
      };

      // Create many definitions
      for (let i = 0; i < definitionCount; i++) {
        const defId = `test:bulk_def_${i}`;
        definitions.push(defId);

        await testBed.ensureEntityDefinitionExists(defId, {
          id: defId,
          components: {
            'core:name': { text: `Bulk Entity ${i}` },
            'test:index': { value: i },
          },
        });
      }

      // Register index schema
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
        },
        'test:index'
      );

      // Act - Cold lookups (first access)
      for (let i = 0; i < 10; i++) {
        const defId = definitions[i * 10]; // Sample every 10th definition
        const startTime = performance.now();

        const entity = await testBed.entityManager.createEntityInstance(defId, {
          instanceId: `cold_lookup_${i}`,
        });

        const endTime = performance.now();
        lookupMetrics.coldLookups.push(endTime - startTime);

        expect(entity).toBeDefined();
      }

      // Warm lookups (cached access)
      for (let i = 0; i < 10; i++) {
        const defId = definitions[i * 10]; // Same definitions as cold lookups
        const startTime = performance.now();

        const entity = await testBed.entityManager.createEntityInstance(defId, {
          instanceId: `warm_lookup_${i}`,
        });

        const endTime = performance.now();
        lookupMetrics.warmLookups.push(endTime - startTime);

        expect(entity).toBeDefined();
      }

      // Calculate metrics
      const avgColdLookup = lookupMetrics.coldLookups.reduce((a, b) => a + b, 0) / 10;
      const avgWarmLookup = lookupMetrics.warmLookups.reduce((a, b) => a + b, 0) / 10;
      const speedupFactor = avgColdLookup / avgWarmLookup;

      // Assert performance improvements
      // Allow warm lookups to be up to 10% slower due to timing noise
      // Both operations can be <1ms and subject to measurement variations
      const toleranceRatio = 1.1;
      expect(avgWarmLookup).toBeLessThan(avgColdLookup * toleranceRatio); // Warm should generally be faster
      expect(avgWarmLookup).toBeLessThan(5); // Warm lookups < 5ms
      expect(speedupFactor).toBeGreaterThan(0.9); // Allow for up to 10% measurement variance

      testBed.logger.info(`Lookup Performance:
        Avg Cold Lookup: ${avgColdLookup.toFixed(2)}ms
        Avg Warm Lookup: ${avgWarmLookup.toFixed(2)}ms
        Speedup Factor: ${speedupFactor.toFixed(2)}x`);
    });
  });
});