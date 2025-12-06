/**
 * @file SlotAccessResolver Memory Test Suite
 *
 * This memory test suite validates the memory management characteristics of
 * the SlotAccessResolver, focusing on:
 * - Memory stability during repeated operations
 * - Performance consistency after garbage collection
 * - Memory leak detection under various equipment configurations
 * - Performance degradation due to memory pressure
 *
 * Memory Targets:
 * - Memory increase <20MB after 10k operations
 * - Performance stability after GC (max/min ratio <10x)
 * - No memory leaks during configuration changes
 *
 * Note: Run with NODE_ENV=test node --expose-gc ./node_modules/.bin/jest
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { createTestBed } from '../../common/testBed.js';
import { performance } from 'perf_hooks';

// Set reasonable timeout for memory tests
jest.setTimeout(120000); // 2 minutes

describe('SlotAccessResolver Memory', () => {
  let resolver;
  let testBed;
  let mockContext;

  // Test utilities and helper functions
  const createMockClothingAccess = (equipment, mode = 'topmost') => {
    return {
      __clothingSlotAccess: true,
      equipped: equipment,
      mode: mode,
      type: 'clothing_slot_access',
    };
  };

  // Test data sets for realistic equipment scenarios
  const REALISTIC_EQUIPMENT_SCENARIOS = {
    casualWear: {
      torso_upper: { base: 'tshirt_id' },
      torso_lower: { base: 'jeans_id' },
      feet: { base: 'sneakers_id' },
    },
    formalWear: {
      torso_upper: { outer: 'suit_jacket_id', base: 'dress_shirt_id' },
      torso_lower: { base: 'dress_pants_id' },
      feet: { base: 'dress_shoes_id' },
      hands: { accessories: 'watch_id' },
    },
    layeredOutfit: {
      torso_upper: {
        outer: 'winter_coat_id',
        base: 'sweater_id',
        underwear: 'undershirt_id',
      },
      torso_lower: {
        base: 'thermal_pants_id',
        underwear: 'underwear_id',
      },
    },
  };

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock entities gateway with correct methods
    const mockEntitiesGateway = testBed.createMock('entitiesGateway', [
      'getComponentData',
    ]);
    mockEntitiesGateway.getComponentData.mockImplementation(
      (entityId, componentType) => {
        if (componentType === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: { outer: 'jacket_1', base: 'shirt_1' },
              torso_lower: { base: 'pants_1' },
            },
          };
        }
        return null;
      }
    );

    // Create resolver (only entitiesGateway parameter)
    resolver = createSlotAccessResolver({
      entitiesGateway: mockEntitiesGateway,
    });

    // Setup mock context with all expected properties
    mockContext = {
      dispatcher: {
        resolve: jest.fn(),
      },
      trace: null, // Disable tracing for memory tests
      structuredTrace: null,
      performanceMonitor: null,
    };

    // Force GC before each test for clean baseline
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    testBed.cleanup();

    // Force GC after each test for cleanup
    if (global.gc) {
      global.gc();
    }
  });

  test('should maintain stable memory usage during intensive operations', () => {
    const clothingAccess = createMockClothingAccess(
      {
        torso_upper: { outer: 'jacket', base: 'shirt' },
        torso_lower: { base: 'pants' },
        legs: { base: 'jeans' },
      },
      'topmost'
    );

    mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const node = {
      type: 'Step',
      field: 'torso_upper',
      parent: { type: 'Step' },
    };

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many resolutions
    for (let i = 0; i < 10000; i++) {
      resolver.resolve(node, mockContext);
    }

    // Force garbage collection to get accurate memory measurement
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const totalIncrease = finalMemory - initialMemory;

    console.log(
      `Memory increase after 10k resolutions: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
    );

    // Should not have significant memory leak
    // Allow 20MB increase for object allocation overhead
    expect(totalIncrease).toBeLessThan(20 * 1024 * 1024);
  });

  test('should maintain performance consistency across equipment configurations after GC', () => {
    const testConfigurations = [
      { name: 'casualWear', config: REALISTIC_EQUIPMENT_SCENARIOS.casualWear },
      { name: 'formalWear', config: REALISTIC_EQUIPMENT_SCENARIOS.formalWear },
      {
        name: 'layeredOutfit',
        config: REALISTIC_EQUIPMENT_SCENARIOS.layeredOutfit,
      },
    ];

    const node = {
      type: 'Step',
      field: 'torso_upper',
      parent: { type: 'Step' },
    };

    const timings = [];
    const WARMUP_ITERATIONS = 50;
    const MEASUREMENT_ITERATIONS = 1000;

    testConfigurations.forEach(({ name, config: equipment }) => {
      const clothingAccess = createMockClothingAccess(equipment, 'topmost');
      mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      // Warmup period to stabilize JIT compilation
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        resolver.resolve(node, mockContext);
      }

      // Force GC before measurement to ensure clean memory state
      if (global.gc) {
        global.gc();
      }

      // Actual measurement with larger sample size
      const startTime = performance.now();

      for (let i = 0; i < MEASUREMENT_ITERATIONS; i++) {
        resolver.resolve(node, mockContext);
      }

      const avgTime = (performance.now() - startTime) / MEASUREMENT_ITERATIONS;
      timings.push({ name, avgTime });
    });

    // Extract timing values for comparison
    const timingValues = timings.map((t) => t.avgTime);
    const minTiming = Math.min(...timingValues);
    const maxTiming = Math.max(...timingValues);
    const ratio = maxTiming / minTiming;

    // Log detailed timing information for analysis
    console.log('Performance timing details (after GC):', {
      timings: timings.map((t) => ({
        name: t.name,
        avgTime: t.avgTime.toFixed(6),
      })),
      minTiming: minTiming.toFixed(6),
      maxTiming: maxTiming.toFixed(6),
      ratio: ratio.toFixed(2),
      threshold: 10,
    });

    // Verify performance consistency with realistic threshold
    // After GC, different configurations should have more consistent performance
    // Memory pressure is eliminated, so variance should be primarily from computational complexity
    expect(ratio).toBeLessThan(10);
  });

  test('should not leak memory when switching between configurations', () => {
    const configurations = Object.values(REALISTIC_EQUIPMENT_SCENARIOS);
    const node = {
      type: 'Step',
      field: 'torso_upper',
      parent: { type: 'Step' },
    };

    const initialMemory = process.memoryUsage().heapUsed;

    // Cycle through configurations multiple times
    for (let cycle = 0; cycle < 100; cycle++) {
      configurations.forEach((equipment) => {
        const clothingAccess = createMockClothingAccess(equipment, 'topmost');
        mockContext.dispatcher.resolve.mockReturnValue(
          new Set([clothingAccess])
        );

        // Perform some resolutions
        for (let i = 0; i < 10; i++) {
          resolver.resolve(node, mockContext);
        }
      });

      // Periodic GC to detect leaks early
      if (cycle % 25 === 0 && global.gc) {
        global.gc();
      }
    }

    // Final GC and memory check
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const totalIncrease = finalMemory - initialMemory;

    console.log(
      `Memory increase after configuration switching: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`
    );

    // Should not accumulate memory across configuration changes
    // Allow 10MB for caching and residual objects
    expect(totalIncrease).toBeLessThan(10 * 1024 * 1024);
  });

  test('should handle memory pressure gracefully without performance collapse', () => {
    // Create large equipment configurations to induce memory pressure
    const largeEquipment = {
      torso_upper: { outer: 'coat', base: 'shirt', underwear: 'undershirt' },
      torso_lower: { outer: 'pants', base: 'shorts', underwear: 'underwear' },
      legs: { base: 'jeans', outer: 'leggings' },
      feet: { base: 'socks', outer: 'shoes', accessories: 'laces' },
      hands: { base: 'gloves', accessories: 'ring' },
      head: { base: 'cap', accessories: 'headband' },
      neck: { base: 'scarf', accessories: 'necklace' },
    };

    const clothingAccess = createMockClothingAccess(largeEquipment, 'topmost');
    mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const node = {
      type: 'Step',
      field: 'torso_upper',
      parent: { type: 'Step' },
    };

    const timings = [];
    const SAMPLE_SIZE = 5;
    const ITERATIONS_PER_SAMPLE = 1000;

    // Take multiple samples without GC to simulate memory pressure
    for (let sample = 0; sample < SAMPLE_SIZE; sample++) {
      const startTime = performance.now();

      for (let i = 0; i < ITERATIONS_PER_SAMPLE; i++) {
        resolver.resolve(node, mockContext);
      }

      const avgTime = (performance.now() - startTime) / ITERATIONS_PER_SAMPLE;
      timings.push(avgTime);
    }

    // Calculate performance degradation
    const firstTiming = timings[0];
    const lastTiming = timings[timings.length - 1];
    const degradationRatio = lastTiming / firstTiming;

    console.log('Memory pressure performance:', {
      firstTiming: firstTiming.toFixed(6),
      lastTiming: lastTiming.toFixed(6),
      degradationRatio: degradationRatio.toFixed(2),
      allTimings: timings.map((t) => t.toFixed(6)),
    });

    // Performance should not collapse under memory pressure
    // Allow up to 3x degradation for GC effects
    expect(degradationRatio).toBeLessThan(3);

    // Verify we can recover with GC
    if (global.gc) {
      global.gc();
    }

    const startTime = performance.now();
    for (let i = 0; i < ITERATIONS_PER_SAMPLE; i++) {
      resolver.resolve(node, mockContext);
    }
    const recoveredTiming =
      (performance.now() - startTime) / ITERATIONS_PER_SAMPLE;

    console.log('After GC recovery:', {
      recoveredTiming: recoveredTiming.toFixed(6),
      recoveryRatio: (recoveredTiming / firstTiming).toFixed(2),
    });

    // Should recover to near-original performance after GC
    expect(recoveredTiming / firstTiming).toBeLessThan(2);
  });
});
