/**
 * @file Performance benchmarks for clothing coverage blocking system
 * @description Tests performance characteristics of coverage analysis and scope resolution
 * with large wardrobes, repeated queries, and memory usage patterns.
 * @see workflows/CLOREMLOG-003-create-coverage-blocking-integration-tests.md
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

// Import scope files
const targetTopMostTorsoLowerNoAccessoriesScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/clothing/scopes/target_topmost_torso_lower_clothing_no_accessories.scope'
  ),
  'utf8'
);

describe('Coverage Blocking Performance Benchmarks', () => {
  let entityManager;
  let logger;
  let jsonLogicEval;
  let scopeRegistry;
  let scopeEngine;
  let entitiesGateway;
  let coverageAnalyzer;

  // Helper function to create large wardrobes - defined at the top level
  /**
   * Creates a large wardrobe with multiple items across slots and layers
   *
   * @param {string} entityId - The entity ID to create
   * @param {number} itemCount - Number of items to create
   * @returns {object} The equipment configuration
   */
  function createLargeWardrobe(entityId, itemCount = 50) {
    // Create entity
    entityManager.createEntity(entityId);
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
        entityManager.createEntity(itemId);
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

    jsonLogicEval = {
      evaluate: jest.fn(),
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
  });

  describe('Large Wardrobe Performance', () => {

    it('should handle 50+ item wardrobes within performance budget', () => {
      const entityId = 'perf:large_wardrobe';
      createLargeWardrobe(entityId, 50);

      // Get the AST from the scope registry
      const scopeAst = scopeRegistry.getScopeAst('clothing:target_topmost_torso_lower_clothing_no_accessories');
      const actorEntity = entityManager.getEntityInstance(entityId);
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        entitiesGateway,
      };

      // Warm up
      for (let i = 0; i < 5; i++) {
        scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
      }

      // Measure performance
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      // Calculate statistics
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Performance assertions
      expect(avgTime).toBeLessThan(10); // Average < 10ms
      expect(maxTime).toBeLessThan(50); // Max < 50ms
      expect(minTime).toBeLessThan(5);  // Min < 5ms

      // Log performance metrics for analysis
      console.log(`Large wardrobe performance (50 items):
        Average: ${avgTime.toFixed(2)}ms
        Max: ${maxTime.toFixed(2)}ms
        Min: ${minTime.toFixed(2)}ms`);
    });

    it('should scale linearly with wardrobe size', () => {
      const sizes = [10, 20, 30, 40, 50];
      const avgTimes = [];

      // Get the AST once since it's the same for all iterations
      const scopeAst = scopeRegistry.getScopeAst('clothing:target_topmost_torso_lower_clothing_no_accessories');

      for (const size of sizes) {
        const entityId = `perf:wardrobe_${size}`;
        createLargeWardrobe(entityId, size);

        const actorEntity = entityManager.getEntityInstance(entityId);
        const runtimeCtx = {
          entityManager,
          jsonLogicEval,
          logger,
          entitiesGateway,
        };

        // Warmup iterations for each size to ensure stable JIT optimization
        for (let i = 0; i < 10; i++) {
          scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
        }

        // Perform multiple queries and measure average (increased iterations for stability)
        const times = [];
        for (let i = 0; i < 100; i++) {
          const startTime = performance.now();
          scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        avgTimes.push(avgTime);
      }

      // Check for approximately linear scaling
      // Note: When operations are extremely fast (sub-millisecond), small timing variations
      // can cause large ratio changes. We apply more lenient checks for microsecond-level operations.
      const minMeasurableTime = 0.1; // milliseconds - below this, timing is unreliable

      const baseTime = avgTimes[0];

      // Collect assertions to perform after the loop
      const assertions = [];

      for (let i = 1; i < avgTimes.length; i++) {
        const ratio = avgTimes[i] / baseTime;
        const sizeRatio = sizes[i] / sizes[0];

        // Skip ratio checks if both times are too small to measure reliably
        // At sub-millisecond scales, timer noise dominates and makes ratio comparisons meaningless
        const isBelowNoiseFloor = baseTime < minMeasurableTime && avgTimes[i] < minMeasurableTime * 2;

        if (!isBelowNoiseFloor) {
          // Calculate allowed ratio based on measurement reliability
          const allowedRatio = baseTime < minMeasurableTime
            ? // When the baseline time is below the timer resolution, timing noise can
              // massively inflate ratios. Scale the allowed variance based on how far
              // below the measurable threshold we are so the test only fails on clear
              // non-linear growth rather than micro-timing jitter.
              sizeRatio * Math.max(
                5,  // Increased from 3 to 5 for better tolerance
                Math.ceil(minMeasurableTime / Math.max(baseTime, Number.EPSILON)) * 1.5  // Add 50% buffer
              )
            : // For measurable operations, maintain the 2x linear growth rate check
              sizeRatio * 2;

          assertions.push({ ratio, allowedRatio, size: sizes[i] });
        }
      }

      // Perform all assertions outside the loop
      assertions.forEach(({ ratio, allowedRatio }) => {
        expect(ratio).toBeLessThan(allowedRatio);
      });

      // Log scaling characteristics
      console.log('Scaling characteristics:');
      sizes.forEach((size, i) => {
        console.log(`  ${size} items: ${avgTimes[i].toFixed(2)}ms`);
      });
    });

    it('should scale reasonably with large wardrobes (100-250 items)', () => {
      // Test at larger scales where measurements are reliable and performance matters
      const sizes = [100, 150, 200, 250];
      const avgTimes = [];

      // Get the AST once since it's the same for all iterations
      const scopeAst = scopeRegistry.getScopeAst('clothing:target_topmost_torso_lower_clothing_no_accessories');

      for (const size of sizes) {
        const entityId = `perf:large_wardrobe_${size}`;
        createLargeWardrobe(entityId, size);

        const actorEntity = entityManager.getEntityInstance(entityId);
        const runtimeCtx = {
          entityManager,
          jsonLogicEval,
          logger,
          entitiesGateway,
        };

        // Warmup iterations for each size to ensure stable JIT optimization
        for (let i = 0; i < 10; i++) {
          scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
        }

        // Perform multiple queries and measure average
        const times = [];
        for (let i = 0; i < 50; i++) {
          const startTime = performance.now();
          scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        avgTimes.push(avgTime);
      }

      // At these scales, times should be measurable (> 0.1ms), but on fast
      // environments the timings can dip below the noise floor. Handle that
      // explicitly so the ratio calculation doesn't amplify jitter.
      const minMeasurableTime = 0.1; // milliseconds
      const baseTime = avgTimes[0];
      const isNoiseDominated = baseTime < minMeasurableTime;

      for (let i = 1; i < avgTimes.length; i++) {
        const ratio = avgTimes[i] / baseTime;
        const sizeRatio = sizes[i] / sizes[0];

        // When both measurements are under the timer resolution, ratio-based
        // checks become meaningless—skip to absolute thresholds instead.
        const withinNoiseFloor =
          isNoiseDominated && avgTimes[i] < minMeasurableTime * 2;

        if (!withinNoiseFloor) {
          // Allow for some non-linearity, but catch exponential growth. When
          // operating below the noise floor, give extra tolerance proportional
          // to how far below the measurable threshold we are.
          const maxAllowedRatio = isNoiseDominated
            ? Math.pow(sizeRatio, 2) *
                Math.max(
                  2.5, // Baseline tolerance for sub-millisecond jitter
                  Math.ceil(minMeasurableTime / Math.max(baseTime, Number.EPSILON))
                )
            : Math.pow(sizeRatio, 2) * 1.5;

          expect(ratio).toBeLessThan(maxAllowedRatio);
        }

        // Also ensure absolute performance stays reasonable
        expect(avgTimes[i]).toBeLessThan(50); // Max 50ms even at 250 items
      }

      // Log scaling characteristics
      console.log('Large wardrobe scaling characteristics:');
      sizes.forEach((size, i) => {
        const ratio = i > 0 ? (avgTimes[i] / avgTimes[0]).toFixed(2) : '1.00';
        console.log(`  ${size} items: ${avgTimes[i].toFixed(2)}ms (${ratio}x baseline)`);
      });
    });
  });

  describe('Concurrent Access Performance', () => {
    it('should handle multiple entities efficiently', () => {
      // Create multiple entities with wardrobes
      const entityCount = 10;
      const entityIds = [];
      
      for (let i = 0; i < entityCount; i++) {
        const entityId = `perf:entity_${i}`;
        createLargeWardrobe(entityId, 20);
        entityIds.push(entityId);
      }

      // Get the AST once since it's the same for all iterations
      const scopeAst = scopeRegistry.getScopeAst('clothing:target_topmost_torso_lower_clothing_no_accessories');

      // Measure performance for each entity
      const times = [];
      
      for (const entityId of entityIds) {
        const actorEntity = entityManager.getEntityInstance(entityId);
        const runtimeCtx = {
          entityManager,
          jsonLogicEval,
          logger,
          entitiesGateway,
        };
        
        const startTime = performance.now();
        for (let i = 0; i < 10; i++) {
          scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
        }
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const totalTime = times.reduce((a, b) => a + b, 0);

      // Performance should remain consistent across entities
      expect(avgTime).toBeLessThan(100); // Average < 100ms for 10 queries
      expect(totalTime).toBeLessThan(1000); // Total < 1 second for all entities

      console.log(`Multi-entity performance (${entityCount} entities):
        Average per entity: ${avgTime.toFixed(2)}ms
        Total time: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Edge Case Performance', () => {
    it('should fail fast when circuit breaker conditions are met', () => {
      // Create entity with invalid/missing data
      const entityId = 'perf:invalid';
      entityManager.createEntity(entityId);
      entityManager.addComponent(entityId, 'core:actor', {
        name: 'Invalid Actor',
      });
      // No equipment component

      // Get the AST and entity
      const scopeAst = scopeRegistry.getScopeAst('clothing:target_topmost_torso_lower_clothing_no_accessories');
      const actorEntity = entityManager.getEntityInstance(entityId);
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        entitiesGateway,
      };

      // Should fail quickly without performance penalty
      const startTime = performance.now();
      const result = scopeEngine.resolve(scopeAst, actorEntity, runtimeCtx);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5); // Should fail fast < 5ms
      expect(Array.from(result)).toEqual([]);
    });

    it('should handle deeply nested equipment structures efficiently', () => {
      const entityId = 'perf:nested';
      entityManager.createEntity(entityId);
      entityManager.addComponent(entityId, 'core:actor', {
        name: 'Nested Equipment Actor',
      });

      // Create deeply nested equipment structure
      const equipment = {};
      const slots = Array.from({ length: 20 }, (_, i) => `slot_${i}`);

      for (const slot of slots) {
        equipment[slot] = {
          outer: `${entityId}:outer_${slot}`,
          base: `${entityId}:base_${slot}`,
          underwear: `${entityId}:underwear_${slot}`,
          accessories: `${entityId}:accessories_${slot}`,
        };

        // Create items for each layer
        ['outer', 'base', 'underwear', 'accessories'].forEach(layer => {
          const itemId = `${entityId}:${layer}_${slot}`;
          entityManager.createEntity(itemId);
          entityManager.addComponent(itemId, 'clothing:item', {
            name: itemId,
            slot: slot,
            layer: layer,
          });
          entityManager.addComponent(itemId, 'clothing:coverage_mapping', {
            covers: [slot],
            coveragePriority: layer,
          });
        });
      }

      entityManager.addComponent(entityId, 'clothing:equipment', {
        equipped: equipment,
      });

      // Measure performance
      const times = [];
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        coverageAnalyzer.analyzeCoverageBlocking(equipment, entityId);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      // Should handle complex structures efficiently
      expect(avgTime).toBeLessThan(20); // Average < 20ms

      console.log(`Nested structure performance:
        Average: ${avgTime.toFixed(2)}ms for ${Object.keys(equipment).length} slots`);
    });
  });
});