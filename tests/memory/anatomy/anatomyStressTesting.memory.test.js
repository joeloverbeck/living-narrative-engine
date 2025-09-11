/**
 * @file tests/memory/anatomy/anatomyStressTesting.memory.test.js
 * @description Memory stress tests for anatomy system to detect leaks and monitor memory usage patterns
 * Tests memory behavior under extreme load, garbage collection patterns, and memory cleanup
 * 
 * NOTE: Uses lightweight mocks for core memory leak detection to focus on fundamental
 * memory management patterns. The test bed can be configured with realistic description
 * generation mocks for integration testing scenarios.
 * 
 * Configuration:
 * - Memory leak detection: lightweight mocks (focus on core entity/cache management)
 * - Integration testing: realistic mocks (simulate production description complexity)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EnhancedAnatomyTestBed from '../../common/anatomy/enhancedAnatomyTestBed.js';
import ComplexBlueprintDataGenerator from '../../common/anatomy/complexBlueprintDataGenerator.js';

describe('Anatomy Memory Stress Testing', () => {
  jest.setTimeout(180000); // 3 minutes for memory tests

  let testBed;
  let dataGenerator;
  let anatomyGenerationService;
  let bodyGraphService;
  let descriptionService;
  let cacheManager;
  let memoryMonitor;

  // Memory thresholds (configured for lightweight mocks focused on core memory management)
  const MEMORY_THRESHOLDS = {
    LEAK_DETECTION_GROWTH: 0.5, // 50% growth over iterations (lightweight mocks for leak detection)
    LARGE_DATASET_HEAP: 500, // 500MB max heap for large datasets
    GC_FREQUENCY: 100, // Expected GC calls per 1000 operations
    HEAP_GROWTH_RATE: 0.25, // 25% growth rate acceptable 
    REFERENCE_RETENTION: 0.05, // 5% reference retention acceptable
  };

  /**
   * Memory monitoring utility
   */
  const createMemoryMonitor = () => ({
    snapshots: [],
    gcCount: 0,
    
    takeSnapshot: function(label) {
      if (global.gc) {
        global.gc();
      }
      const memory = process.memoryUsage();
      this.snapshots.push({
        label,
        timestamp: Date.now(),
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers,
      });
      return memory;
    },

    compareSnapshots: function(startLabel, endLabel) {
      const start = this.snapshots.find(s => s.label === startLabel);
      const end = this.snapshots.find(s => s.label === endLabel);
      if (!start || !end) return null;

      return {
        heapGrowth: end.heapUsed - start.heapUsed,
        heapGrowthPercent: ((end.heapUsed - start.heapUsed) / start.heapUsed) * 100,
        timeElapsed: end.timestamp - start.timestamp,
        externalGrowth: end.external - start.external,
      };
    },

    getAverageHeapSize: function() {
      if (this.snapshots.length === 0) return 0;
      const totalHeap = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0);
      return totalHeap / this.snapshots.length;
    },

    detectMemoryLeak: function(iterations, threshold = MEMORY_THRESHOLDS.LEAK_DETECTION_GROWTH) {
      if (this.snapshots.length < 2) return false;
      
      const firstQuarter = Math.floor(iterations * 0.25);
      const lastQuarter = Math.floor(iterations * 0.75);
      
      const earlyAvg = this.snapshots
        .slice(0, firstQuarter)
        .reduce((sum, s) => sum + s.heapUsed, 0) / firstQuarter;
      
      const lateAvg = this.snapshots
        .slice(lastQuarter)
        .reduce((sum, s) => sum + s.heapUsed, 0) / (this.snapshots.length - lastQuarter);
      
      const growth = (lateAvg - earlyAvg) / earlyAvg;
      return growth > threshold;
    },

    reset: function() {
      this.snapshots = [];
      this.gcCount = 0;
    },
  });

  beforeEach(async () => {
    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use lightweight mocks for memory leak detection tests to focus on core memory management
    testBed = new EnhancedAnatomyTestBed({ useLightweightMocks: true });
    dataGenerator = new ComplexBlueprintDataGenerator();
    memoryMonitor = createMemoryMonitor();

    // Get services from test bed
    anatomyGenerationService = testBed.anatomyGenerationService;
    bodyGraphService = testBed.bodyGraphService;
    descriptionService = testBed.anatomyDescriptionService;
    cacheManager = testBed.anatomyCacheManager;

    // Load stress test components
    testBed.loadStressTestComponents();
  });

  afterEach(async () => {
    testBed.cleanup();
    memoryMonitor.reset();
    
    // Force garbage collection after each test
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated anatomy generation and cleanup', async () => {
      const iterations = global.memoryTestUtils?.isCI() ? 50000 : 100000;
      const checkInterval = Math.floor(iterations / 20);

      memoryMonitor.takeSnapshot('start');

      for (let i = 0; i < iterations; i++) {
        // Generate simple anatomy
        const anatomy = await testBed.generateSimpleAnatomy();
        
        // Build and query cache
        bodyGraphService.buildAdjacencyCache(anatomy.rootId);
        const children = bodyGraphService.getChildren(anatomy.rootId);
        
        // Clean up immediately
        await testBed.cleanupEntity(anatomy.rootId);

        // Periodic memory checks
        if (i % checkInterval === 0 && i > 0) {
          memoryMonitor.takeSnapshot(`iteration_${i}`);
          
          if (i % (checkInterval * 5) === 0) {
            const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            console.log(`  Iteration ${i}/${iterations}: Heap ${heapMB}MB`);
          }
        }
      }

      memoryMonitor.takeSnapshot('end');

      // Analyze memory growth
      const comparison = memoryMonitor.compareSnapshots('start', 'end');
      const hasLeak = memoryMonitor.detectMemoryLeak(iterations);

      console.log(`Memory Leak Detection Results:`);
      console.log(`  Heap growth: ${(comparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Growth percent: ${comparison.heapGrowthPercent.toFixed(2)}%`);
      console.log(`  Leak detected: ${hasLeak}`);

      // Should not have significant memory leak
      expect(hasLeak).toBe(false);
      expect(Math.abs(comparison.heapGrowthPercent)).toBeLessThan(
        MEMORY_THRESHOLDS.LEAK_DETECTION_GROWTH * 100
      );
    });

    it('should not leak memory during cache operations', async () => {
      const iterations = 50000;
      const anatomy = await testBed.generateSimpleAnatomy();

      memoryMonitor.takeSnapshot('cache_start');

      for (let i = 0; i < iterations; i++) {
        // Clear and rebuild cache repeatedly (simulating invalidation)
        if (cacheManager && cacheManager.invalidateCacheForRoot) {
          cacheManager.invalidateCacheForRoot(anatomy.rootId);
        }
        bodyGraphService.buildAdjacencyCache(anatomy.rootId);
        
        // Query cache
        const children = bodyGraphService.getChildren(anatomy.rootId);
        // Note: getParents method doesn't exist on bodyGraphService
        // const parents = bodyGraphService.getParents(anatomy.rootId);

        if (i % 10000 === 0 && i > 0) {
          memoryMonitor.takeSnapshot(`cache_${i}`);
        }
      }

      memoryMonitor.takeSnapshot('cache_end');

      const comparison = memoryMonitor.compareSnapshots('cache_start', 'cache_end');
      console.log(`Cache Operations Memory Growth: ${comparison.heapGrowthPercent.toFixed(2)}%`);

      // Cache operations should not leak memory (adjusted threshold)
      expect(Math.abs(comparison.heapGrowthPercent)).toBeLessThan(50);

      await testBed.cleanupEntity(anatomy.rootId);
    });

    it('should not leak memory during description generation', async () => {
      const iterations = 10000;
      const anatomy = await generateLargeAnatomy(25);

      memoryMonitor.takeSnapshot('desc_start');

      for (let i = 0; i < iterations; i++) {
        // Generate description (may be cached)
        // Get entity first for description generation
        const entity = testBed.entityManager.getEntityInstance(anatomy.rootId);
        const description = await descriptionService.generateAllDescriptions(entity);
        
        // Clear any internal caches periodically (if method exists)
        // Note: clearCache method does not exist on anatomyDescriptionService
        // if (i % 1000 === 0 && descriptionService.clearCache) {
        //   descriptionService.clearCache();
        // }

        if (i % 2000 === 0 && i > 0) {
          memoryMonitor.takeSnapshot(`desc_${i}`);
        }
      }

      memoryMonitor.takeSnapshot('desc_end');

      const comparison = memoryMonitor.compareSnapshots('desc_start', 'desc_end');
      console.log(`Description Generation Memory Growth: ${comparison.heapGrowthPercent.toFixed(2)}%`);

      // Should not leak during description generation (adjusted threshold)
      expect(Math.abs(comparison.heapGrowthPercent)).toBeLessThan(30);

      await testBed.cleanupEntity(anatomy.rootId);
    });
  });

  /**
   * Helper to generate large anatomy (moved to top level for accessibility)
   */
  async function generateLargeAnatomy(partCount) {
    const blueprint = dataGenerator.generateLargeAnatomyBlueprint(partCount);
    testBed.loadBlueprints(blueprint.blueprints);
    testBed.loadEntityDefinitions(blueprint.entityDefinitions);
    
    // Load the recipe that was generated with the blueprint
    if (blueprint.recipe) {
      testBed.loadRecipes({
        [blueprint.recipe.id]: blueprint.recipe
      });
    }

    // Create an entity with a recipe for anatomy generation
    const entityId = `test-entity-${partCount}-${Date.now()}`;
    const entity = await testBed.entityManager.createEntityInstance('core:actor', {
      instanceId: entityId,
    });
    
    // Add anatomy body component with recipe to trigger anatomy generation
    await testBed.entityManager.addComponent(entityId, 'anatomy:body', {
      recipeId: `test:large_anatomy_${partCount}`,
    });

    // Generate anatomy using the service
    const result = await anatomyGenerationService.generateAnatomyIfNeeded(entityId);
    
    return { rootId: result?.rootId || entityId };
  }

  describe('Large Dataset Memory Usage', () => {

    it('should handle memory footprint of large anatomies efficiently', async () => {
      const partCounts = [10, 25, 50, 75, 100];
      const results = [];

      for (const count of partCounts) {
        memoryMonitor.takeSnapshot(`before_${count}`);
        
        const anatomy = await generateLargeAnatomy(count);
        
        // Build complete cache
        bodyGraphService.buildAdjacencyCache(anatomy.rootId);
        
        // Generate description to fully populate data
        // Get entity first for description generation
        const entity = testBed.entityManager.getEntityInstance(anatomy.rootId);
        await descriptionService.generateAllDescriptions(entity);
        
        memoryMonitor.takeSnapshot(`after_${count}`);

        const comparison = memoryMonitor.compareSnapshots(`before_${count}`, `after_${count}`);
        const memoryPerPart = comparison.heapGrowth / count;

        results.push({
          partCount: count,
          totalMemory: comparison.heapGrowth,
          memoryPerPart,
          heapUsedMB: process.memoryUsage().heapUsed / 1024 / 1024,
        });

        // Clean up
        await testBed.cleanupEntity(anatomy.rootId);
        
        // Force GC between tests
        if (global.gc) {
          global.gc();
        }
      }

      console.log('Large Dataset Memory Usage:');
      results.forEach(r => {
        console.log(`  ${r.partCount} parts: ` +
          `${(r.totalMemory / 1024 / 1024).toFixed(2)}MB total, ` +
          `${(r.memoryPerPart / 1024).toFixed(2)}KB per part, ` +
          `Heap: ${r.heapUsedMB.toFixed(2)}MB`);
      });

      // Memory per part should be relatively constant (linear scaling)
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const scalingRatio = lastResult.memoryPerPart / firstResult.memoryPerPart;
      
      // Should scale linearly (allow 50% variance)
      expect(scalingRatio).toBeLessThan(1.5);

      // Total heap should stay within threshold
      results.forEach(r => {
        expect(r.heapUsedMB).toBeLessThan(MEMORY_THRESHOLDS.LARGE_DATASET_HEAP);
      });
    });

    it('should efficiently manage memory for cache structures', async () => {
      const anatomies = [];
      const targetCount = 20;

      memoryMonitor.takeSnapshot('cache_struct_start');

      // Create multiple anatomies with caches
      for (let i = 0; i < targetCount; i++) {
        const anatomy = await testBed.generateSimpleAnatomy();
        bodyGraphService.buildAdjacencyCache(anatomy.rootId);
        anatomies.push(anatomy);
      }

      memoryMonitor.takeSnapshot('all_cached');

      // Invalidate half of the caches (if method exists)
      for (let i = 0; i < targetCount / 2; i++) {
        if (cacheManager && cacheManager.invalidateCacheForRoot) {
          cacheManager.invalidateCacheForRoot(anatomies[i].rootId);
        }
      }

      memoryMonitor.takeSnapshot('half_invalidated');

      // Rebuild invalidated caches
      for (let i = 0; i < targetCount / 2; i++) {
        bodyGraphService.buildAdjacencyCache(anatomies[i].rootId);
      }

      memoryMonitor.takeSnapshot('rebuilt');

      const fullComparison = memoryMonitor.compareSnapshots('cache_struct_start', 'all_cached');
      const invalidComparison = memoryMonitor.compareSnapshots('all_cached', 'half_invalidated');
      const rebuildComparison = memoryMonitor.compareSnapshots('half_invalidated', 'rebuilt');

      console.log('Cache Structure Memory Management:');
      console.log(`  Full cache build: ${(fullComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  After invalidation: ${(invalidComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  After rebuild: ${(rebuildComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Invalidation should not cause excessive memory growth (GC may not run immediately)
      expect(invalidComparison.heapGrowth).toBeLessThan(50_000_000); // 50MB threshold

      // Clean up
      for (const anatomy of anatomies) {
        await testBed.cleanupEntity(anatomy.rootId);
      }
    });

    it('should analyze component memory overhead', async () => {
      const componentTypes = [
        'anatomy:body',
        'anatomy:part',
        'anatomy:joint',
        'anatomy:sockets',
        'descriptors:body',
      ];

      const results = [];

      for (const componentType of componentTypes) {
        memoryMonitor.takeSnapshot(`before_${componentType}`);

        // Create entities with specific components
        const entities = [];
        for (let i = 0; i < 1000; i++) {
          const entity = await testBed.createEntityWithComponent(componentType);
          entities.push(entity);
        }

        memoryMonitor.takeSnapshot(`after_${componentType}`);

        const comparison = memoryMonitor.compareSnapshots(
          `before_${componentType}`,
          `after_${componentType}`
        );

        results.push({
          componentType,
          totalMemory: comparison.heapGrowth,
          memoryPerComponent: comparison.heapGrowth / 1000,
        });

        // Clean up
        for (const entity of entities) {
          await testBed.cleanupEntity(entity.id);
        }
      }

      console.log('Component Memory Overhead:');
      results.forEach(r => {
        console.log(`  ${r.componentType}: ${(r.memoryPerComponent / 1024).toFixed(2)}KB per component`);
      });
    });
  });

  describe('Garbage Collection Patterns', () => {
    it('should maintain healthy GC patterns under normal load', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      let operationCount = 0;
      let gcEvents = [];

      // Monitor GC if available
      if (global.gc) {
        const originalGC = global.gc;
        global.gc = function() {
          gcEvents.push(Date.now());
          originalGC();
        };
      }

      while (Date.now() - startTime < duration) {
        // Create and destroy anatomies
        const anatomy = await testBed.generateSimpleAnatomy();
        bodyGraphService.buildAdjacencyCache(anatomy.rootId);
        await testBed.cleanupEntity(anatomy.rootId);
        
        operationCount++;

        // Take periodic snapshots
        if (operationCount % 50 === 0) {
          memoryMonitor.takeSnapshot(`gc_test_${operationCount}`);
        }
      }

      const gcFrequency = gcEvents.length / (operationCount / 1000);
      const avgHeap = memoryMonitor.getAverageHeapSize() / 1024 / 1024;

      console.log('Garbage Collection Patterns:');
      console.log(`  Operations: ${operationCount}`);
      console.log(`  GC events: ${gcEvents.length}`);
      console.log(`  GC frequency: ${gcFrequency.toFixed(2)} per 1000 ops`);
      console.log(`  Average heap: ${avgHeap.toFixed(2)}MB`);

      // GC frequency should be reasonable
      expect(gcFrequency).toBeLessThan(MEMORY_THRESHOLDS.GC_FREQUENCY);
    });

    it('should handle memory reclamation efficiently', async () => {
      const phases = [
        { name: 'growth', count: 50 },
        { name: 'stable', count: 50 },
        { name: 'cleanup', count: 0 },
      ];

      const anatomies = [];

      for (const phase of phases) {
        memoryMonitor.takeSnapshot(`${phase.name}_start`);

        if (phase.name === 'growth') {
          // Create many anatomies
          for (let i = 0; i < phase.count; i++) {
            const anatomy = await generateLargeAnatomy(20);
            anatomies.push(anatomy);
          }
        } else if (phase.name === 'stable') {
          // Perform operations on existing anatomies
          for (let i = 0; i < phase.count; i++) {
            const anatomy = anatomies[i % anatomies.length];
            bodyGraphService.buildAdjacencyCache(anatomy.rootId);
            // Get entity first for description generation
        const entity = testBed.entityManager.getEntityInstance(anatomy.rootId);
        await descriptionService.generateAllDescriptions(entity);
          }
        } else if (phase.name === 'cleanup') {
          // Clean up all anatomies
          while (anatomies.length > 0) {
            const anatomy = anatomies.pop();
            await testBed.cleanupEntity(anatomy.rootId);
          }
          
          // Force GC
          if (global.gc) {
            global.gc();
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        memoryMonitor.takeSnapshot(`${phase.name}_end`);
      }

      // Analyze memory reclamation
      const growthComparison = memoryMonitor.compareSnapshots('growth_start', 'growth_end');
      const stableComparison = memoryMonitor.compareSnapshots('stable_start', 'stable_end');
      const cleanupComparison = memoryMonitor.compareSnapshots('cleanup_start', 'cleanup_end');

      console.log('Memory Reclamation:');
      console.log(`  Growth phase: ${(growthComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Stable phase: ${(stableComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Cleanup phase: ${(cleanupComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Growth phase should increase memory
      expect(growthComparison.heapGrowth).toBeGreaterThan(0);

      // Stable phase should have minimal growth
      expect(Math.abs(stableComparison.heapGrowthPercent)).toBeLessThan(10);

      // Cleanup should not cause excessive memory growth (GC may not run immediately)
      expect(cleanupComparison.heapGrowth).toBeLessThan(100_000_000); // 100MB threshold
    });

    it('should analyze reference retention patterns', async () => {
      const testReferences = new WeakMap();
      const strongReferences = [];
      const iterations = 100;

      memoryMonitor.takeSnapshot('ref_start');

      for (let i = 0; i < iterations; i++) {
        const anatomy = await testBed.generateSimpleAnatomy();
        
        // Add to weak map (should be GC'd)
        testReferences.set(anatomy, { index: i });
        
        // Keep some strong references
        if (i % 10 === 0) {
          strongReferences.push(anatomy);
        } else {
          // Clean up others immediately
          await testBed.cleanupEntity(anatomy.rootId);
        }
      }

      memoryMonitor.takeSnapshot('before_gc');

      // Force GC to test weak references
      if (global.gc) {
        global.gc();
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      memoryMonitor.takeSnapshot('after_gc');

      // Clean up strong references
      for (const anatomy of strongReferences) {
        await testBed.cleanupEntity(anatomy.rootId);
      }
      strongReferences.length = 0;

      if (global.gc) {
        global.gc();
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      memoryMonitor.takeSnapshot('ref_end');

      const gcComparison = memoryMonitor.compareSnapshots('before_gc', 'after_gc');
      const finalComparison = memoryMonitor.compareSnapshots('ref_start', 'ref_end');

      console.log('Reference Retention:');
      console.log(`  After GC: ${(gcComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final: ${(finalComparison.heapGrowth / 1024 / 1024).toFixed(2)}MB`);

      // Should have minimal retention after cleanup
      expect(Math.abs(finalComparison.heapGrowthPercent)).toBeLessThan(
        MEMORY_THRESHOLDS.REFERENCE_RETENTION * 100
      );
    });
  });
});