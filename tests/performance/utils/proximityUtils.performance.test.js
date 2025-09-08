/**
 * @file Performance benchmarks for proximity utility functions
 * @description Tests the performance characteristics of proximity utilities
 * under high-volume operations to ensure production readiness.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getAdjacentSpots,
  findAdjacentOccupants,
  validateProximityParameters,
} from '../../../src/utils/proximityUtils.js';

describe('ProximityUtils Performance Benchmarks', () => {
  describe('getAdjacentSpots Performance', () => {
    it('should execute getAdjacentSpots quickly for high-volume operations', () => {
      const startTime = performance.now();
      
      // Test with 10,000 operations as specified in workflow
      for (let i = 0; i < 10000; i++) {
        // Vary the parameters to test different code paths
        const spotIndex = Math.floor(Math.random() * 10);
        const totalSpots = 10;
        getAdjacentSpots(spotIndex, totalSpots);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`getAdjacentSpots: 10,000 operations completed in ${duration.toFixed(2)}ms`);
      
      // Should complete 10k operations in <100ms as per workflow requirement
      expect(duration).toBeLessThan(100);
    });

    it('should handle edge positions efficiently', () => {
      const startTime = performance.now();
      
      // Test edge positions specifically (first and last spots)
      for (let i = 0; i < 5000; i++) {
        getAdjacentSpots(0, 10); // First spot
        getAdjacentSpots(9, 10); // Last spot
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`getAdjacentSpots (edge cases): 10,000 operations completed in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(50); // Edge cases should be even faster
    });

    it('should scale linearly with furniture size', () => {
      const sizes = [2, 5, 10];
      const iterations = 3000;
      
      sizes.forEach(size => {
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
          const spotIndex = Math.floor(Math.random() * size);
          getAdjacentSpots(spotIndex, size);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`getAdjacentSpots (size ${size}): ${iterations} operations in ${duration.toFixed(2)}ms`);
        
        // Performance should not significantly degrade with larger furniture
        expect(duration).toBeLessThan(100);
      });
    });
  });

  describe('findAdjacentOccupants Performance', () => {
    it('should handle findAdjacentOccupants efficiently with large furniture', () => {
      // Create test furniture with 10 spots as specified in workflow
      const largeSpots = new Array(10).fill(null);
      largeSpots[0] = 'game:alice';
      largeSpots[2] = 'game:bob';
      largeSpots[5] = 'game:charlie';
      largeSpots[7] = 'game:diana';
      largeSpots[9] = 'game:eve';
      
      const furnitureComponent = { spots: largeSpots };
      
      const startTime = performance.now();
      
      // Test with 5,000 operations as specified in workflow
      for (let i = 0; i < 5000; i++) {
        const spotIndex = Math.floor(Math.random() * 10);
        findAdjacentOccupants(furnitureComponent, spotIndex);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`findAdjacentOccupants: 5,000 operations completed in ${duration.toFixed(2)}ms`);
      
      // Should complete 5k operations in <50ms as per workflow requirement
      expect(duration).toBeLessThan(50);
    });

    it('should handle sparse vs dense occupancy efficiently', () => {
      // Test sparse occupancy (few occupants)
      const sparseSpots = new Array(10).fill(null);
      sparseSpots[1] = 'game:alice';
      sparseSpots[8] = 'game:bob';
      const sparseFurniture = { spots: sparseSpots };

      // Test dense occupancy (many occupants) 
      const denseSpots = new Array(10).fill('game:occupant');
      denseSpots[2] = null; // Leave one empty
      denseSpots[6] = null; // Leave another empty
      const denseFurniture = { spots: denseSpots };

      const testCases = [
        { name: 'sparse', furniture: sparseFurniture },
        { name: 'dense', furniture: denseFurniture }
      ];

      testCases.forEach(({ name, furniture }) => {
        const startTime = performance.now();
        
        for (let i = 0; i < 2500; i++) {
          const spotIndex = Math.floor(Math.random() * 10);
          findAdjacentOccupants(furniture, spotIndex);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`findAdjacentOccupants (${name}): 2,500 operations in ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(30);
      });
    });

    it('should handle furniture size variations efficiently', () => {
      const sizes = [2, 5, 10];
      const iterations = 1000;
      
      sizes.forEach(size => {
        // Create furniture with mixed occupancy
        const spots = new Array(size).fill(null);
        for (let i = 0; i < size; i += 2) {
          spots[i] = `game:actor_${i}`;
        }
        const furniture = { spots };
        
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
          const spotIndex = Math.floor(Math.random() * size);
          findAdjacentOccupants(furniture, spotIndex);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`findAdjacentOccupants (size ${size}): ${iterations} operations in ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(50);
      });
    });
  });

  describe('validateProximityParameters Performance', () => {
    it('should validate parameters efficiently', () => {
      // Create mock logger that follows the existing test patterns
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      
      const startTime = performance.now();
      
      // Test with 1,000 operations as specified in workflow
      for (let i = 0; i < 1000; i++) {
        validateProximityParameters(
          `furniture:test_${i % 10}`, 
          `game:actor_${i % 20}`, 
          i % 10, 
          mockLogger
        );
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`validateProximityParameters: 1,000 operations completed in ${duration.toFixed(2)}ms`);
      
      // Should complete 1k validations in <10ms as per workflow requirement
      expect(duration).toBeLessThan(10);
    });

    it('should handle varying parameter complexity efficiently', () => {
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      
      const testCases = [
        { name: 'simple IDs', furniturePrefix: 'f', actorPrefix: 'a' },
        { name: 'namespaced IDs', furniturePrefix: 'furniture:long_name', actorPrefix: 'game:complex_actor' },
        { name: 'mixed IDs', furniturePrefix: 'mod:furniture_with_underscores', actorPrefix: 'core:actor' }
      ];
      
      testCases.forEach(({ name, furniturePrefix, actorPrefix }) => {
        const startTime = performance.now();
        
        for (let i = 0; i < 500; i++) {
          validateProximityParameters(
            `${furniturePrefix}_${i}`, 
            `${actorPrefix}_${i}`, 
            i % 10, 
            mockLogger
          );
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`validateProximityParameters (${name}): 500 operations in ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(8);
      });
    });
  });

  describe('Combined Operations Performance', () => {
    it('should handle realistic workflow scenarios efficiently', () => {
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      
      // Create realistic furniture setup
      const furniture = {
        spots: ['game:alice', null, 'game:bob', null, 'game:charlie', null, 'game:diana', null, null, 'game:eve']
      };
      
      const startTime = performance.now();
      
      // Simulate realistic usage: validate params, get adjacent spots, find occupants
      for (let i = 0; i < 1000; i++) {
        const furnitureId = `furniture:couch_${i % 5}`;
        const actorId = `game:actor_${i % 10}`;
        const spotIndex = i % 10;
        
        // Step 1: Validate parameters
        validateProximityParameters(furnitureId, actorId, spotIndex, mockLogger);
        
        // Step 2: Get adjacent spots
        getAdjacentSpots(spotIndex, furniture.spots.length);
        
        // Step 3: Find adjacent occupants
        findAdjacentOccupants(furniture, spotIndex);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Combined workflow: 1,000 complete workflows in ${duration.toFixed(2)}ms`);
      
      // Combined operations should complete within reasonable time
      expect(duration).toBeLessThan(50);
    });
  });
});