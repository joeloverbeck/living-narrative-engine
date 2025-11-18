/**
 * @file Memory tests for clothing coverage blocking system
 * @description Tests memory usage patterns and leak detection for coverage analysis
 * with large wardrobes and repeated queries.
 * 
 * Memory Targets:
 * - Memory growth < 1KB per iteration during sustained operations
 * - Total memory growth < 10MB for 1000 iterations
 * - Efficient caching without memory leaks
 * - Memory stabilization within 2x threshold to account for GC timing variability
 * 
 * Note: This test uses the dedicated 'npm run test:memory' runner with --expose-gc flag
 * @see tests/performance/scopeDsl/coverageBlockingPerformance.test.js for performance tests
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { performance } from 'perf_hooks';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import createCoverageAnalyzer from '../../../src/clothing/analysis/coverageAnalyzer.js';
import fs from 'fs';
import path from 'path';

// Set optimized timeout for memory tests
jest.setTimeout(120000); // 2 minutes for memory testing

// Import scope files
const targetTopMostTorsoLowerNoAccessoriesScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/clothing/scopes/target_topmost_torso_lower_clothing_no_accessories.scope'
  ),
  'utf8'
);

describe('Coverage Blocking Memory Tests', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let entitiesGateway;
  let coverageAnalyzer;

  // Helper function to create large wardrobes
  /**
   *
   * @param entityId
   * @param itemCount
   */
  function createLargeWardrobe(entityId, itemCount = 50) {
    // Create entity
    const entity = entityManager.createEntity(entityId);
    entityManager.addComponent(entityId, 'core:actor', {
      name: `Large Wardrobe Actor ${entityId}`,
    });

    // Define all possible slots and layers
    const slots = [
      'head', 'neck', 'torso_upper', 'torso_lower', 
      'hands', 'feet', 'wrists', 'waist', 'back', 'legs'
    ];
    const layers = ['outer', 'base', 'underwear', 'accessories'];

    // Create complex equipment configuration
    const equipment = {};
    let itemIndex = 0;

    for (const slot of slots) {
      equipment[slot] = {};
      for (const layer of layers) {
        if (itemIndex >= itemCount) break;
        
        const itemId = `${entityId}:item_${itemIndex}`;
        equipment[slot][layer] = itemId;

        // Create item entity
        const item = entityManager.createEntity(itemId);
        entityManager.addComponent(itemId, 'clothing:item', {
          name: `Item ${itemIndex}`,
          slot: slot,
          layer: layer,
        });
        entityManager.addComponent(itemId, 'clothing:coverage_mapping', {
          covers: [slot],
          coveragePriority: layer,
        });

        itemIndex++;
      }
      if (itemIndex >= itemCount) break;
    }

    entityManager.addComponent(entityId, 'clothing:equipment', {
      equipped: equipment,
    });

    return equipment;
  }

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    
    // Create entities gateway
    entitiesGateway = {
      getComponentData: (entityId, componentType) => {
        const entity = entityManager.getEntityInstance(entityId);
        return entity ? entity.getComponentData(componentType) : null;
      },
    };

    // Create coverage analyzer
    coverageAnalyzer = createCoverageAnalyzer({ entitiesGateway });
    
    // Setup scope registry
    const parsedScopes = parseScopeDefinitions(
      targetTopMostTorsoLowerNoAccessoriesScopeContent,
      'test-scope.scope'
    );
    
    scopeRegistry = new ScopeRegistry();
    const scopeDefinitions = {};
    Array.from(parsedScopes.entries()).forEach(([name, scopeData]) => {
      scopeDefinitions[name] = scopeData;
    });
    scopeRegistry.initialize(scopeDefinitions);
    
    scopeEngine = new ScopeEngine({ scopeRegistry });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Force cleanup
    entityManager = null;
    scopeRegistry = null;
    scopeEngine = null;
    entitiesGateway = null;
    coverageAnalyzer = null;
  });

  describe('Memory Usage Patterns', () => {
    it('should not exhibit memory leaks during repeated coverage analysis', () => {
      const entityId = 'memory:leak_test';
      createLargeWardrobe(entityId, 30);

      // Get initial memory baseline
      if (global.gc) {
        global.gc();
      }
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many iterations
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        const equipment = entityManager.getComponentData(entityId, 'clothing:equipment').equipped;
        const analysis = coverageAnalyzer.analyzeCoverageBlocking(equipment, entityId);
        
        // Use the analysis to prevent optimization
        analysis.isAccessible('dummy', 'torso_lower', 'base');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      const finalMemory = process.memoryUsage().heapUsed;

      // Calculate memory growth
      const memoryGrowth = finalMemory - initialMemory;
      const growthPerIteration = memoryGrowth / iterations;

      // Should have minimal memory growth per iteration
      expect(growthPerIteration).toBeLessThan(1024); // Less than 1KB per iteration
      
      // Total growth should be reasonable
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB total

      console.log(`Memory usage after ${iterations} iterations:
        Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
        Per iteration: ${growthPerIteration.toFixed(2)} bytes`);
    });

    it('should efficiently cache coverage analysis results', () => {
      const entityId = 'memory:cache_test';
      createLargeWardrobe(entityId, 25);

      const equipment = entityManager.getComponentData(entityId, 'clothing:equipment').equipped;

      // Force GC before measuring
      if (global.gc) {
        global.gc();
      }
      const baselineMemory = process.memoryUsage().heapUsed;

      // First analysis (cold)
      const coldStart = performance.now();
      const analysis1 = coverageAnalyzer.analyzeCoverageBlocking(equipment, entityId);
      const coldEnd = performance.now();
      const coldTime = coldEnd - coldStart;

      // Measure memory after first analysis
      const afterFirstMemory = process.memoryUsage().heapUsed;
      const firstAnalysisMemory = afterFirstMemory - baselineMemory;

      // Repeated analyses (potentially cached)
      const warmTimes = [];
      for (let i = 0; i < 100; i++) {
        const warmStart = performance.now();
        const analysis = coverageAnalyzer.analyzeCoverageBlocking(equipment, entityId);
        const warmEnd = performance.now();
        warmTimes.push(warmEnd - warmStart);
      }

      // Force GC and measure final memory
      if (global.gc) {
        global.gc();
      }
      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryGrowth = finalMemory - baselineMemory;

      const avgWarmTime = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;

      // Memory shouldn't grow significantly for cached operations
      expect(totalMemoryGrowth).toBeLessThan(firstAnalysisMemory * 2); // Should not double

      // Warm queries should be faster or similar to cold
      expect(avgWarmTime).toBeLessThanOrEqual(coldTime * 1.5);

      console.log(`Cache memory performance:
        Initial analysis memory: ${(firstAnalysisMemory / 1024).toFixed(2)}KB
        Total memory after 100 cached ops: ${(totalMemoryGrowth / 1024).toFixed(2)}KB
        Cold time: ${coldTime.toFixed(2)}ms
        Warm avg time: ${avgWarmTime.toFixed(2)}ms`);
    });

    it('should maintain stable memory under sustained load', () => {
      const entityId = 'memory:sustained_load';
      createLargeWardrobe(entityId, 40);

      // Force initial GC
      if (global.gc) {
        global.gc();
      }
      const initialMemory = process.memoryUsage().heapUsed;

      const memorySnapshots = [];
      const iterations = 500;
      const snapshotInterval = 50;

      for (let i = 0; i < iterations; i++) {
        const equipment = entityManager.getComponentData(entityId, 'clothing:equipment').equipped;
        const analysis = coverageAnalyzer.analyzeCoverageBlocking(equipment, entityId);
        
        // Use the analysis
        analysis.isAccessible('dummy', 'torso_lower', 'base');

        // Take memory snapshots at intervals
        if (i % snapshotInterval === 0) {
          // Multiple GC cycles for more reliable memory measurements
          if (global.gc) {
            global.gc();
            global.gc(); // Second cycle to ensure thorough cleanup
          }
          const currentMemory = process.memoryUsage().heapUsed;
          memorySnapshots.push({
            iteration: i,
            memory: currentMemory - initialMemory,
          });
        }
      }

      // Final GC and measurement with multiple cycles for stability
      if (global.gc) {
        global.gc();
        global.gc(); // Additional cycle for thorough cleanup
      }
      const finalMemory = process.memoryUsage().heapUsed;
      const totalGrowth = finalMemory - initialMemory;

      // Memory should stabilize, not grow linearly
      const firstHalfAvg = memorySnapshots
        .slice(0, Math.floor(memorySnapshots.length / 2))
        .reduce((sum, s) => sum + s.memory, 0) / Math.floor(memorySnapshots.length / 2);
      
      const secondHalfAvg = memorySnapshots
        .slice(Math.floor(memorySnapshots.length / 2))
        .reduce((sum, s) => sum + s.memory, 0) / (memorySnapshots.length - Math.floor(memorySnapshots.length / 2));

      // Second half shouldn't be significantly higher than first half (indicates stabilization)
      // Using 2.0x threshold to account for GC timing variability and JIT optimization effects
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2.0);

      console.log(`Sustained load memory profile:
        Total iterations: ${iterations}
        Total memory growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB
        First half avg: ${(firstHalfAvg / 1024 / 1024).toFixed(2)}MB
        Second half avg: ${(secondHalfAvg / 1024 / 1024).toFixed(2)}MB
        Stabilization ratio: ${(secondHalfAvg / firstHalfAvg).toFixed(2)}
        Note: 2.0x threshold accounts for GC timing and JIT optimization variability`);
    });
  });
});