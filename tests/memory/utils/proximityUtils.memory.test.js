/**
 * @file Memory usage tests for proximity utility functions
 * @description Tests memory efficiency and leak detection for proximity utilities
 * to ensure they don't consume excessive memory during high-volume operations.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getAdjacentSpots,
  findAdjacentOccupants,
  validateProximityParameters,
} from '../../../src/utils/proximityUtils.js';

describe('ProximityUtils Memory Leak Detection', () => {
  beforeEach(async () => {
    // Force GC before each test if available
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    } else if (global.gc) {
      global.gc();
    }
  });

  afterEach(async () => {
    // Clean up and force GC after each test
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    } else if (global.gc) {
      global.gc();
    }
  });

  describe('getAdjacentSpots Memory Usage', () => {
    it('should not create memory leaks in repeated getAdjacentSpots calls', () => {
      // Get baseline memory
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations to test for leaks
      for (let i = 0; i < 10000; i++) {
        // Use varied parameters to test different execution paths
        const spotIndex = Math.floor(Math.random() * 10);
        const totalSpots = 10;
        getAdjacentSpots(spotIndex, totalSpots);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`getAdjacentSpots memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      // Should not increase by more than 3MB (adjusted for test environment overhead)
      expect(memoryIncrease).toBeLessThan(3 * 1024 * 1024);
    });

    it('should handle memory efficiently across different furniture sizes', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const sizes = [1, 2, 5, 10];
      
      // Test each size multiple times
      sizes.forEach(size => {
        for (let i = 0; i < 2000; i++) {
          const spotIndex = Math.floor(Math.random() * size);
          getAdjacentSpots(spotIndex, size);
        }
      });
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`getAdjacentSpots (varied sizes) memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      // Should not create memory leaks regardless of furniture size (adjusted for test environment)
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });

    it('should not accumulate memory from result arrays', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const results = [];
      
      // Store results to ensure they're not being optimized away
      for (let i = 0; i < 5000; i++) {
        const result = getAdjacentSpots(5, 10);
        if (i % 1000 === 0) {
          results.push(result); // Keep some references to test realistic usage
        }
      }
      
      // Clear references
      results.length = 0;
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`getAdjacentSpots (with result storage) memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('findAdjacentOccupants Memory Usage', () => {
    it('should not create memory leaks in repeated findAdjacentOccupants calls', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Test with various furniture configurations
      for (let i = 0; i < 1000; i++) {
        // Create new furniture component each iteration to test object creation
        const furnitureComponent = { spots: new Array(10).fill(null) };
        furnitureComponent.spots[0] = `game:actor_${i % 5}_a`;
        furnitureComponent.spots[2] = `game:actor_${i % 5}_b`;
        furnitureComponent.spots[5] = `game:actor_${i % 5}_c`;
        furnitureComponent.spots[8] = `game:actor_${i % 5}_d`;
        
        const spotIndex = i % 10;
        findAdjacentOccupants(furnitureComponent, spotIndex);
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`findAdjacentOccupants memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      // Should not increase by more than 1MB as specified in workflow
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle large furniture arrays without memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create a large furniture component
      const largeSpots = new Array(10).fill(null);
      for (let i = 0; i < 10; i += 2) {
        largeSpots[i] = `game:large_furniture_occupant_${i}`;
      }
      const largeFurniture = { spots: largeSpots };
      
      // Use the same furniture multiple times
      for (let i = 0; i < 2000; i++) {
        const spotIndex = i % 10;
        findAdjacentOccupants(largeFurniture, spotIndex);
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`findAdjacentOccupants (large furniture) memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should not leak memory from result arrays', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const furniture = { 
        spots: ['game:a', 'game:b', 'game:c', 'game:d', 'game:e', 
                'game:f', 'game:g', 'game:h', 'game:i', 'game:j']
      };
      
      const results = [];
      
      // Call function many times, occasionally storing results
      for (let i = 0; i < 3000; i++) {
        const result = findAdjacentOccupants(furniture, i % 10);
        if (i % 500 === 0) {
          results.push([...result]); // Deep copy to test memory usage
        }
      }
      
      // Clear stored results
      results.length = 0;
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`findAdjacentOccupants (with result storage) memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });
  });

  describe('validateProximityParameters Memory Usage', () => {
    it('should not create memory leaks in repeated parameter validation', () => {
      // Create mock logger following project patterns
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Test with many validation calls
      for (let i = 0; i < 5000; i++) {
        validateProximityParameters(
          `furniture:test_item_${i % 100}`, 
          `game:actor_entity_${i % 50}`, 
          i % 10, 
          mockLogger
        );
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`validateProximityParameters memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      // Should not increase by more than 1MB (adjusted for test environment overhead)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle varying string lengths without memory leaks', () => {
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Test with varying string lengths to stress string handling
      for (let i = 0; i < 2000; i++) {
        const longFurnitureId = `furniture:very_long_furniture_name_with_many_characters_${i}`;
        const longActorId = `game:extremely_detailed_actor_identifier_with_extensive_naming_${i}`;
        
        validateProximityParameters(longFurnitureId, longActorId, i % 10, mockLogger);
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`validateProximityParameters (long strings) memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      expect(memoryIncrease).toBeLessThan(512 * 1024);
    });
  });

  describe('Combined Operations Memory Usage', () => {
    it('should handle realistic workflow without cumulative memory leaks', () => {
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate realistic usage patterns
      for (let i = 0; i < 1000; i++) {
        const furnitureId = `furniture:item_${i % 20}`;
        const actorId = `game:character_${i % 30}`;
        const spotIndex = i % 10;
        
        // Step 1: Validate (this is typically done first)
        validateProximityParameters(furnitureId, actorId, spotIndex, mockLogger);
        
        // Step 2: Get adjacent spots
        const adjacentSpots = getAdjacentSpots(spotIndex, 10);
        
        // Step 3: Create furniture and find occupants
        const furniture = { spots: new Array(10).fill(null) };
        furniture.spots[adjacentSpots[0]] = 'game:someone';
        if (adjacentSpots[1] !== undefined) {
          furniture.spots[adjacentSpots[1]] = 'game:someone_else';
        }
        
        const occupants = findAdjacentOccupants(furniture, spotIndex);
        
        // Use the results to prevent optimization
        if (occupants.length > 0 && i % 100 === 0) {
          // Occasional processing to simulate real usage
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Combined operations memory increase: ${(memoryIncrease / 1024).toFixed(2)} KB`);
      
      // Combined operations should not create significant memory leaks
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024); // 2MB threshold for combined operations
    });

    it('should maintain stable memory usage across multiple iterations', () => {
      const mockLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
      const measurements = [];
      
      // Take multiple measurements to check for progressive memory growth
      for (let iteration = 0; iteration < 3; iteration++) {
        if (global.gc) {
          global.gc();
        }
        
        const beforeMemory = process.memoryUsage().heapUsed;
        
        // Perform operations
        for (let i = 0; i < 1000; i++) {
          validateProximityParameters(`f:${i}`, `a:${i}`, i % 10, mockLogger);
          getAdjacentSpots(i % 10, 10);
          
          const furniture = { spots: new Array(10).fill(null) };
          furniture.spots[0] = `game:${i}`;
          findAdjacentOccupants(furniture, 1);
        }
        
        if (global.gc) {
          global.gc();
        }
        
        const afterMemory = process.memoryUsage().heapUsed;
        const iterationIncrease = afterMemory - beforeMemory;
        measurements.push(iterationIncrease);
        
        console.log(`Iteration ${iteration + 1} memory increase: ${(iterationIncrease / 1024).toFixed(2)} KB`);
      }
      
      // Each iteration should not progressively increase memory usage
      // Each iteration should not progressively increase memory usage (indicating no cumulative leaks)
      measurements.forEach(increase => {
        expect(increase).toBeLessThan(2 * 1024 * 1024); // Each iteration < 2MB
      });
      
      // Later iterations shouldn't be significantly worse than earlier ones
      for (let i = 1; i < measurements.length; i++) {
        const ratio = measurements[i] / measurements[0];
        expect(ratio).toBeLessThan(3); // No more than 3x growth between iterations
      }
    });
  });
});