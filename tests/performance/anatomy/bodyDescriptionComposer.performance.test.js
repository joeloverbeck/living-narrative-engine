import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer - Performance Tests', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;

  const createEntityWithAllDescriptors = () => ({
    id: 'performance-test-entity',
    hasComponent: jest.fn().mockReturnValue(true),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return { body: { root: 'torso-1' } };
      }
      if (componentId === 'descriptors:build') {
        return { build: 'athletic' };
      }
      if (componentId === 'descriptors:body_composition') {
        return { composition: 'lean' };
      }
      if (componentId === 'descriptors:body_hair') {
        return { density: 'moderate' };
      }
      return null;
    }),
  });

  beforeEach(() => {
    // Create mocks for required dependencies
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn().mockReturnValue('test description'),
      buildMultipleDescription: jest
        .fn()
        .mockReturnValue('test multiple description'),
      getPlural: jest.fn().mockReturnValue('tests'),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue([]),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest
        .fn()
        .mockReturnValue(['build', 'body_composition', 'body_hair']),
      getGroupedParts: jest.fn().mockReturnValue(new Set()),
    };

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
      generateDescription: jest.fn(),
      generateSimpleDescription: jest.fn(),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  describe('Extraction Method Performance', () => {
    it('should execute body composition extraction quickly', () => {
      const entity = createEntityWithAllDescriptors();
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBodyCompositionDescription(entity);
      }
      const totalTime = performance.now() - start;

      // Should complete 10k iterations in under 100ms
      expect(totalTime).toBeLessThan(100);

      // Average time per call should be under 0.01ms
      expect(totalTime / iterations).toBeLessThan(0.01);
    });

    it('should execute body hair extraction quickly', () => {
      const entity = createEntityWithAllDescriptors();
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBodyHairDescription(entity);
      }
      const totalTime = performance.now() - start;

      // Should complete 10k iterations in under 100ms
      expect(totalTime).toBeLessThan(100);

      // Average time per call should be under 0.01ms
      expect(totalTime / iterations).toBeLessThan(0.01);
    });

    it('should execute build extraction quickly', () => {
      const entity = createEntityWithAllDescriptors();
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBuildDescription(entity);
      }
      const totalTime = performance.now() - start;

      // Should complete 10k iterations in under 100ms
      expect(totalTime).toBeLessThan(100);

      // Average time per call should be under 0.01ms
      expect(totalTime / iterations).toBeLessThan(0.01);
    });

    it('should handle null entities efficiently', () => {
      const iterations = 100000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        composer.extractBodyCompositionDescription(null);
        composer.extractBodyHairDescription(null);
        composer.extractBuildDescription(null);
      }
      const totalTime = performance.now() - start;

      // Null checks should be extremely fast (300k calls in under 50ms)
      expect(totalTime).toBeLessThan(50);
    });
  });

  describe('composeDescription Performance', () => {
    it('should compose descriptions efficiently with body-level descriptors', async () => {
      const entity = createEntityWithAllDescriptors();

      // Note: Performance tests should be realistic with async operations
      const iterations = 100; // Reduced for async operations

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await composer.composeDescription(entity);
      }
      const totalTime = performance.now() - start;

      // Should complete 100 iterations in reasonable time
      expect(totalTime).toBeLessThan(1000);

      // Average time per composition should be under 10ms
      expect(totalTime / iterations).toBeLessThan(10);
    });

    it('should handle multiple descriptor combinations efficiently', async () => {
      const testCases = [
        // Only build
        {
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === ANATOMY_BODY_COMPONENT_ID) {
              return { body: { root: 'torso-1' } };
            }
            if (componentId === 'descriptors:build') {
              return { build: 'athletic' };
            }
            return null;
          }),
        },
        // Build + composition
        {
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === ANATOMY_BODY_COMPONENT_ID) {
              return { body: { root: 'torso-1' } };
            }
            if (componentId === 'descriptors:build') {
              return { build: 'athletic' };
            }
            if (componentId === 'descriptors:body_composition') {
              return { composition: 'lean' };
            }
            return null;
          }),
        },
        // All three descriptors
        createEntityWithAllDescriptors(),
      ];

      const iterations = 50; // Test multiple scenarios
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const testCase of testCases) {
          await composer.composeDescription(testCase);
        }
      }

      const totalTime = performance.now() - start;
      const totalOperations = iterations * testCases.length;

      // Should handle all combinations efficiently
      expect(totalTime).toBeLessThan(2000);
      expect(totalTime / totalOperations).toBeLessThan(15);
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive calls without degradation', async () => {
      const entity = createEntityWithAllDescriptors();
      const times = [];

      // Warmup phase to ensure JIT compilation
      for (let i = 0; i < 1000; i++) {
        composer.extractBodyCompositionDescription(entity);
        composer.extractBodyHairDescription(entity);
        composer.extractBuildDescription(entity);
      }

      // Measure performance over multiple batches to detect degradation
      for (let batch = 0; batch < 10; batch++) {
        const batchStart = performance.now();

        for (let i = 0; i < 100; i++) {
          composer.extractBodyCompositionDescription(entity);
          composer.extractBodyHairDescription(entity);
          composer.extractBuildDescription(entity);
        }

        const batchTime = performance.now() - batchStart;
        times.push(batchTime);
      }

      // Performance should not degrade significantly over time
      const firstBatchTime = times[0];
      const lastBatchTime = times[times.length - 1];
      const degradationRatio = lastBatchTime / firstBatchTime;

      // Last batch should not be more than 3x slower than first batch
      // Note: Using 3x threshold to account for JS runtime variability (JIT, GC, etc.)
      expect(degradationRatio).toBeLessThan(3);

      // All batches should complete within reasonable time
      times.forEach((time) => {
        expect(time).toBeLessThan(50); // 300 operations in under 50ms
      });
    });

    it('should handle concurrent-like operations without interference', async () => {
      const entity = createEntityWithAllDescriptors();

      // Simulate concurrent-like access patterns
      const promises = Array.from({ length: 20 }, async () => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          await composer.composeDescription(entity);
        }
        return performance.now() - start;
      });

      const times = await Promise.all(promises);

      // All concurrent operations should complete in reasonable time
      times.forEach((time) => {
        expect(time).toBeLessThan(1000); // 100 compositions in under 1s
      });

      // Performance should be consistent across concurrent operations
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const variance = maxTime / avgTime;

      // Maximum time should not be more than 3x the average
      expect(variance).toBeLessThan(3);
    });
  });
});
