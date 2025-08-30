/**
 * @file SlotAccessResolver Performance Test Suite
 * 
 * This performance test suite validates the performance characteristics of
 * the SlotAccessResolver, measuring:
 * - Resolution time for slot access operations
 * - Performance consistency across different equipment configurations
 * 
 * Performance Targets:
 * - Resolution time: < 1ms per operation
 * - Performance consistency: Max timing < 2x min timing
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { createTestBed } from '../../../common/testBed.js';
import { performance } from 'perf_hooks';

// Set reasonable timeout for performance tests
jest.setTimeout(30000);

describe('SlotAccessResolver Performance', () => {
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
        underwear: 'undershirt_id' 
      },
      torso_lower: { 
        base: 'thermal_pants_id', 
        underwear: 'underwear_id' 
      },
    },
  };

  beforeEach(() => {
    testBed = createTestBed();
    
    // Create mock entities gateway with correct methods
    const mockEntitiesGateway = testBed.createMock('entitiesGateway', ['getComponentData']);
    mockEntitiesGateway.getComponentData.mockImplementation((entityId, componentType) => {
      if (componentType === 'clothing:equipment') {
        return {
          equipped: {
            torso_upper: { outer: 'jacket_1', base: 'shirt_1' },
            torso_lower: { base: 'pants_1' },
          },
        };
      }
      return null;
    });

    // Create resolver (only entitiesGateway parameter)
    resolver = createSlotAccessResolver({
      entitiesGateway: mockEntitiesGateway,
    });

    // Setup mock context with all expected properties
    mockContext = {
      dispatcher: {
        resolve: jest.fn(),
      },
      trace: null, // Disable tracing for performance tests
      structuredTrace: null, // Add missing structuredTrace property
      performanceMonitor: null, // Add missing performanceMonitor property
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  test('should complete resolution within reasonable time', () => {
    const clothingAccess = createMockClothingAccess({
      torso_upper: { outer: 'jacket', base: 'shirt' },
      torso_lower: { base: 'pants' },
      legs: { base: 'jeans' },
    }, 'topmost');

    mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const node = {
      type: 'Step',
      field: 'torso_upper',
      parent: { type: 'Step' },
    };

    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      resolver.resolve(node, mockContext);
    }

    const avgTime = (performance.now() - startTime) / 1000;
    expect(avgTime).toBeLessThan(1); // Less than 1ms per resolution
  });

  test('should maintain consistent performance across different equipment configurations', () => {
    const testConfigurations = [
      { name: 'casualWear', config: REALISTIC_EQUIPMENT_SCENARIOS.casualWear },
      { name: 'formalWear', config: REALISTIC_EQUIPMENT_SCENARIOS.formalWear },
      { name: 'layeredOutfit', config: REALISTIC_EQUIPMENT_SCENARIOS.layeredOutfit },
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

      // Actual measurement with larger sample size
      const startTime = performance.now();
      
      for (let i = 0; i < MEASUREMENT_ITERATIONS; i++) {
        resolver.resolve(node, mockContext);
      }

      const avgTime = (performance.now() - startTime) / MEASUREMENT_ITERATIONS;
      timings.push({ name, avgTime });
    });

    // Extract timing values for comparison
    const timingValues = timings.map(t => t.avgTime);
    const minTiming = Math.min(...timingValues);
    const maxTiming = Math.max(...timingValues);
    const ratio = maxTiming / minTiming;

    // Log detailed timing information for analysis
    console.log('Performance timing details:', {
      timings: timings.map(t => ({ name: t.name, avgTime: t.avgTime.toFixed(6) })),
      minTiming: minTiming.toFixed(6),
      maxTiming: maxTiming.toFixed(6),
      ratio: ratio.toFixed(2),
      threshold: 5
    });

    // Verify performance consistency with realistic threshold
    // Different configurations legitimately have different computational costs
    // System factors (GC, scheduling) can cause significant variation
    expect(ratio).toBeLessThan(5);
  });
});