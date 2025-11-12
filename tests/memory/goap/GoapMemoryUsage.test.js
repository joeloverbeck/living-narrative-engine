/**
 * @file GOAP Memory Usage Tests
 * @description Memory stability validation for GOAP decision making workflows.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

describe('GOAP Memory Reliability', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await createGoapTestBed();
  }, 30000);

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  it('should detect no memory leaks over 100 turns', async () => {
    testBed.logger.info('=== Test: Memory Leak Detection (100 turns) ===');

    // Step 1: Setup
    await testBed.loadMods(['core', 'positioning', 'items']);

    // Create 3 actors (smaller set for long-running test)
    const actors = await Promise.all([
      testBed.createActor({
        name: 'MemoryActor1',
        type: 'goap',
        components: {
          'core:hunger': { value: 20 },
          'core:position': { locationId: 'test_location' },
        },
      }),
      testBed.createActor({
        name: 'MemoryActor2',
        type: 'goap',
        components: {
          'core:energy': { value: 30 },
          'core:position': { locationId: 'test_location' },
        },
      }),
      testBed.createActor({
        name: 'MemoryActor3',
        type: 'goap',
        components: {
          'core:hunger': { value: 25 },
          'core:position': { locationId: 'test_location' },
        },
      }),
    ]);

    // Prepare actor data
    const actorData = [];
    for (const actor of actors) {
      const context = testBed.createContext({ actorId: actor.id });
      context.entities = { [actor.id]: { components: actor.getAllComponents() } };
      const actions = await testBed.getAvailableActions(actor, context);
      actorData.push({ actor, context, actions });
    }

    // Step 2: Capture baseline memory
    if (global.gc) {
      global.gc();
    }
    const memoryBefore = process.memoryUsage();
    testBed.logger.info(
      `Baseline memory: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );

    // Step 3: Run 100 turns
    testBed.logger.info('Running 100 turns...');
    const sampleInterval = 10; // Sample every 10 turns

    for (let turn = 1; turn <= 100; turn++) {
      // Each actor makes a decision
      for (const data of actorData) {
        await testBed.makeGoapDecision(data.actor, data.context, data.actions);
      }

      // Sample memory at intervals
      if (turn % sampleInterval === 0) {
        const currentMemory = process.memoryUsage();
        testBed.logger.info(
          `Turn ${turn}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
        );
      }
    }

    // Step 4: Force garbage collection and measure final memory
    if (global.gc) {
      global.gc();
    }

    // Wait a bit for GC to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const memoryAfter = process.memoryUsage();
    testBed.logger.info(`Final memory: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // Step 5: Analyze memory growth
    const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;
    const memoryGrowthPercent = (memoryGrowth / memoryBefore.heapUsed) * 100;

    testBed.logger.info(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
    testBed.logger.info(`Memory growth: ${memoryGrowthPercent.toFixed(1)}%`);

    // Memory growth should be reasonable (< 50 MB or < 100% growth)
    // This is a loose threshold to account for normal cache growth
    expect(memoryGrowthMB).toBeLessThan(50);

    testBed.logger.info('✓ No significant memory leaks detected');
  }, 120000);
});
