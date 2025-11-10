/**
 * @file Performance tests for GOAP effects generation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Effects Generation Performance', () => {
  let testBed;
  let effectsGenerator;
  let effectsAnalyzer;
  let dataRegistry;

  beforeAll(async () => {
    testBed = createTestBed();

    // Load all mods for performance testing
    await testBed.loadAllMods();

    effectsGenerator = testBed.resolve('IEffectsGenerator');
    effectsAnalyzer = testBed.resolve('IEffectsAnalyzer');
    dataRegistry = testBed.resolve('IDataRegistry');
  });

  describe('Batch Generation Performance', () => {
    it('should generate effects for 200 actions in under 5 seconds', () => {
      // Get all action IDs from all loaded mods
      const allActions = dataRegistry.getAll('actions');
      const actionIds = Array.from(allActions.keys());

      // Ensure we have enough actions to test
      expect(actionIds.length).toBeGreaterThan(100);

      const startTime = Date.now();
      const effectsMap = new Map();

      for (const actionId of actionIds) {
        try {
          const effects = effectsGenerator.generateForAction(actionId);
          if (effects) {
            effectsMap.set(actionId, effects);
          }
        } catch {
          // Skip actions that can't be generated (expected for some actions)
          continue;
        }
      }

      const duration = Date.now() - startTime;

      expect(effectsMap.size).toBeGreaterThan(50);
      expect(duration).toBeLessThan(5000); // < 5 seconds

      // Log performance metrics
      console.log(`\nPerformance Metrics:`);
      console.log(`  Total actions: ${actionIds.length}`);
      console.log(`  Generated effects: ${effectsMap.size}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Average: ${Math.round(duration / effectsMap.size)}ms per action`);
    });

    it('should maintain performance with repeated generations', () => {
      const actionIds = [
        'positioning:sit_down',
        'positioning:stand_up',
        'items:pick_up_item',
        'items:drop_item'
      ];

      const iterations = 10;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        for (const actionId of actionIds) {
          try {
            effectsGenerator.generateForAction(actionId);
          } catch {
            // Skip if action not found
            continue;
          }
        }

        durations.push(Date.now() - startTime);
      }

      // Calculate average duration
      const avgDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;

      // Standard deviation should be low (consistent performance)
      const variance =
        durations
          .map(d => Math.pow(d - avgDuration, 2))
          .reduce((sum, v) => sum + v, 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be less than 20% of average
      expect(stdDev).toBeLessThan(avgDuration * 0.2);

      console.log(`\nRepeated Generation Metrics:`);
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Average duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Standard deviation: ${stdDev.toFixed(2)}ms`);
    });
  });

  describe('Single Action Analysis Performance', () => {
    it('should analyze complex rule in under 100ms', () => {
      // Find a complex action with multiple operations
      const complexActionId = 'items:pick_up_item'; // Known to have conditionals

      const startTime = Date.now();
      const effects = effectsAnalyzer.analyzeRule(complexActionId);
      const duration = Date.now() - startTime;

      expect(effects).toBeDefined();
      expect(duration).toBeLessThan(100); // < 100ms

      console.log(`\nComplex Rule Analysis:`);
      console.log(`  Action: ${complexActionId}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Effects count: ${effects?.effects?.length || 0}`);
    });

    it('should analyze simple rule in under 10ms', () => {
      // Find a simple action with few operations
      const simpleActionId = 'positioning:sit_down';

      const startTime = Date.now();
      const effects = effectsAnalyzer.analyzeRule(simpleActionId);
      const duration = Date.now() - startTime;

      expect(effects).toBeDefined();
      expect(duration).toBeLessThan(10); // < 10ms

      console.log(`\nSimple Rule Analysis:`);
      console.log(`  Action: ${simpleActionId}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Effects count: ${effects?.effects?.length || 0}`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during batch generation', () => {
      const actionIds = Array.from(dataRegistry.getAll('actions').keys()).slice(
        0,
        50
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate effects multiple times
      for (let i = 0; i < 5; i++) {
        for (const actionId of actionIds) {
          try {
            effectsGenerator.generateForAction(actionId);
          } catch {
            // Skip
            continue;
          }
        }

        // Force garbage collection between iterations
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10);

      console.log(`\nMemory Usage:`);
      console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('Validation Performance', () => {
    it('should validate effects quickly', () => {
      const actionIds = Array.from(dataRegistry.getAll('actions').keys()).slice(
        0,
        20
      );

      const startTime = Date.now();

      for (const actionId of actionIds) {
        try {
          const effects = effectsGenerator.generateForAction(actionId);
          if (effects) {
            effectsGenerator.validateEffects(actionId, effects);
          }
        } catch {
          // Skip
          continue;
        }
      }

      const duration = Date.now() - startTime;

      // Should validate 20 actions in under 500ms
      expect(duration).toBeLessThan(500);

      console.log(`\nValidation Performance:`);
      console.log(`  Actions validated: 20`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Average: ${Math.round(duration / 20)}ms per action`);
    });
  });
});
