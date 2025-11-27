/**
 * @file tests/memory/anatomy/anatomyCacheManager.scalability.memory.test.js
 * @description Memory stability tests for anatomy cache manager scalability.
 * Tests memory behavior with 10+ concurrent character generations.
 * Extracted from tests/integration/anatomy/anatomyCacheManager.scalability.test.js
 * to run under the dedicated memory test runner with GC exposure.
 * @see tickets/ANACACISO-004-scalability-test.md
 * @see specs/anatomy-cache-isolation.spec.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('AnatomyCacheManager - Scalability Memory Tests', () => {
  jest.setTimeout(60000); // 1 minute for memory tests

  let testBed;

  beforeEach(async () => {
    // Force garbage collection before each test if available
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();
  });

  afterEach(async () => {
    testBed.cleanup();

    // Force garbage collection after each test
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  it('should maintain memory stability with 10+ characters', async () => {
    // Arrange: 12 characters for stress test
    const recipes = Array.from({ length: 12 }, (_, i) =>
      ['anatomy:human_male', 'anatomy:human_female', 'anatomy:tortoise_person'][i % 3]
    );

    // Force garbage collection before measuring
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));

    // Measure initial memory
    const initialMemory = process.memoryUsage().heapUsed;

    // Act: Generate all characters
    await Promise.all(
      recipes.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
    );

    // Force garbage collection after generation
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));

    // Measure final memory
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Assert: Memory increase is reasonable
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for 12 characters`);
    console.log(`  Initial heap: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Final heap: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);

    // Expect <100MB increase for 12 characters when GC is properly exposed
    // This threshold is generous to account for normal heap growth patterns
    // With --expose-gc, memory should stabilize around 50-70MB increase
    expect(memoryIncreaseMB).toBeLessThan(100);
  });

  it('should not leak memory across multiple character generation batches', async () => {
    const batchCount = 3;
    const charactersPerBatch = 4;
    const memorySnapshots = [];

    // Force initial garbage collection
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));

    memorySnapshots.push({
      label: 'start',
      heapUsed: process.memoryUsage().heapUsed,
    });

    for (let batch = 0; batch < batchCount; batch++) {
      const recipes = Array.from({ length: charactersPerBatch }, (_, i) =>
        ['anatomy:human_male', 'anatomy:human_female', 'anatomy:tortoise_person'][i % 3]
      );

      // Generate characters
      await Promise.all(
        recipes.map(recipeId => testBed.createCharacterFromRecipe(recipeId))
      );

      // Force garbage collection between batches
      if (global.gc) {
        global.gc();
      }
      await new Promise(resolve => setTimeout(resolve, 25));

      memorySnapshots.push({
        label: `batch_${batch + 1}`,
        heapUsed: process.memoryUsage().heapUsed,
      });
    }

    // Final garbage collection
    if (global.gc) {
      global.gc();
    }
    await new Promise(resolve => setTimeout(resolve, 50));

    memorySnapshots.push({
      label: 'end',
      heapUsed: process.memoryUsage().heapUsed,
    });

    // Log results
    console.log('Memory snapshots across batches:');
    memorySnapshots.forEach(snap => {
      console.log(`  ${snap.label}: ${(snap.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    // Calculate growth rate between batches
    const growthRates = [];
    for (let i = 1; i < memorySnapshots.length - 1; i++) {
      const growth = memorySnapshots[i].heapUsed - memorySnapshots[i - 1].heapUsed;
      growthRates.push(growth);
    }

    // We have 3 batches, so growthRates should have at least 2 entries
    // This assertion ensures we have enough data for our growth ratio check
    expect(growthRates.length).toBeGreaterThanOrEqual(2);

    // Later batches should not grow significantly more than earlier batches
    // (would indicate a memory leak)
    const laterGrowth = growthRates[growthRates.length - 1];
    const earlierGrowth = growthRates[0];

    // Later batches should grow at most 3x the earlier batches
    // (accounting for cache warming and normal variation)
    const growthRatio = Math.abs(laterGrowth) / Math.max(Math.abs(earlierGrowth), 1024 * 1024);

    console.log(`Growth ratio (later/earlier): ${growthRatio.toFixed(2)}`);
    expect(growthRatio).toBeLessThan(3); // Allow some variance

    // Total memory increase should be reasonable
    const totalIncrease = memorySnapshots[memorySnapshots.length - 1].heapUsed -
                         memorySnapshots[0].heapUsed;
    const totalIncreaseMB = totalIncrease / 1024 / 1024;

    console.log(`Total memory increase: ${totalIncreaseMB.toFixed(2)}MB for ${batchCount * charactersPerBatch} characters`);

    // With GC exposed, should stay well under 150MB for 12 characters
    expect(totalIncreaseMB).toBeLessThan(150);
  });
});
