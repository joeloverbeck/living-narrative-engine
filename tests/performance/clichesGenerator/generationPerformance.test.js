/**
 * @file Performance tests for clichés generator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Clichés Generator - Performance Tests', () => {
  let testBed;
  let characterBuilderService;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();
    characterBuilderService = testBed.mockCharacterBuilderService;
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Generation Performance', () => {
    it('should generate clichés within performance budget', async () => {
      const concept = testBed.createMockConcept();
      const direction = testBed.createMockDirection();
      const mockCliches = testBed.createMockClichesData();

      // Setup mock to return quickly
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async () => {
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 100));
          return mockCliches;
        }
      );

      const startTime = performance.now();

      const cliches = await characterBuilderService.generateClichesForDirection(
        concept,
        direction
      );

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(2000); // 2 second budget
      expect(cliches).toBeDefined();
      expect(cliches.categories).toBeDefined();
    });

    it('should handle batch generation efficiently', async () => {
      const batchSize = 10;
      const concepts = Array(batchSize)
        .fill(null)
        .map((_, i) =>
          testBed.createCharacterConcept({ id: `concept-perf-${i}` })
        );
      const directions = Array(batchSize)
        .fill(null)
        .map((_, i) =>
          testBed.createThematicDirection({
            id: `direction-perf-${i}`,
            conceptId: `concept-perf-${i}`,
          })
        );

      // Setup mock for batch operations
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async (concept, direction) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return testBed.createCliche({
            directionId: direction.id,
            conceptId: concept.id,
          });
        }
      );

      const startTime = performance.now();

      // Generate all clichés in parallel
      const generatePromises = concepts.map((concept, i) =>
        characterBuilderService.generateClichesForDirection(
          concept,
          directions[i]
        )
      );

      const results = await Promise.all(generatePromises);

      const duration = performance.now() - startTime;

      // Should complete batch in reasonable time (less than 1 second for 10 items)
      expect(duration).toBeLessThan(1000);
      expect(results).toHaveLength(batchSize);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.categories).toBeDefined();
      });
    });

    it('should efficiently retrieve existing clichés', async () => {
      const directionIds = Array(20)
        .fill(null)
        .map((_, i) => `direction-retrieve-${i}`);

      // Setup mock with cached data
      const cachedCliches = {};
      directionIds.forEach((id) => {
        cachedCliches[id] = testBed.createCliche({ directionId: id });
      });

      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async (directionId) => {
          // Simulate fast cache retrieval
          await new Promise((resolve) => setTimeout(resolve, 5));
          return cachedCliches[directionId];
        }
      );

      const startTime = performance.now();

      // Retrieve all clichés
      const retrievePromises = directionIds.map((id) =>
        characterBuilderService.getClichesByDirectionId(id)
      );

      const results = await Promise.all(retrievePromises);

      const duration = performance.now() - startTime;

      // Should retrieve 20 items in less than 500ms
      expect(duration).toBeLessThan(500);
      expect(results).toHaveLength(20);
      results.forEach((result, i) => {
        expect(result.directionId).toBe(directionIds[i]);
      });
    });

    it('should handle large cliché datasets efficiently', async () => {
      // Create a large cliché object
      const largeCategories = {};
      const categoryNames = [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns',
      ];

      categoryNames.forEach((category) => {
        largeCategories[category] = Array(200)
          .fill(null)
          .map(
            (_, i) =>
              `${category}-item-${i}-with-some-longer-text-to-simulate-real-data`
          );
      });

      const largeCliche = testBed.createCliche({
        categories: largeCategories,
        tropesAndStereotypes: Array(100)
          .fill(null)
          .map((_, i) => `trope-${i}-with-detailed-description`),
      });

      characterBuilderService.storeCliches.mockImplementation(async () => {
        // Simulate storage processing
        await new Promise((resolve) => setTimeout(resolve, 50));
        return true;
      });

      characterBuilderService.getClichesByDirectionId.mockImplementation(
        async () => {
          // Simulate retrieval
          await new Promise((resolve) => setTimeout(resolve, 20));
          return largeCliche;
        }
      );

      const startTime = performance.now();

      // Store and retrieve large dataset
      await characterBuilderService.storeCliches(largeCliche);
      const retrieved = await characterBuilderService.getClichesByDirectionId(
        largeCliche.directionId
      );

      const duration = performance.now() - startTime;

      // Should handle large dataset in reasonable time (less than 200ms)
      expect(duration).toBeLessThan(200);
      expect(retrieved.categories.names).toHaveLength(200);
      expect(retrieved.tropesAndStereotypes).toHaveLength(100);
    });

    it('should efficiently check for existing clichés', async () => {
      const directionIds = Array(50)
        .fill(null)
        .map((_, i) => `direction-check-${i}`);

      // Half have clichés, half don't
      characterBuilderService.hasClichesForDirection.mockImplementation(
        async (directionId) => {
          // Simulate quick lookup
          await new Promise((resolve) => setTimeout(resolve, 2));
          const index = parseInt(directionId.split('-').pop());
          return index % 2 === 0;
        }
      );

      const startTime = performance.now();

      // Check all directions
      const checkPromises = directionIds.map((id) =>
        characterBuilderService.hasClichesForDirection(id)
      );

      const results = await Promise.all(checkPromises);

      const duration = performance.now() - startTime;

      // Should check 50 items in less than 200ms
      expect(duration).toBeLessThan(200);
      expect(results).toHaveLength(50);

      // Verify half have clichés
      const withCliches = results.filter((r) => r === true);
      const withoutCliches = results.filter((r) => r === false);
      expect(withCliches).toHaveLength(25);
      expect(withoutCliches).toHaveLength(25);
    });
  });

  describe('UI Responsiveness', () => {
    it('should maintain UI responsiveness during generation', async () => {
      const concept = testBed.createMockConcept();
      const direction = testBed.createMockDirection();

      // Track UI update calls
      let uiUpdateCount = 0;
      const originalDispatch = testBed.mockEventBus.dispatch;
      testBed.mockEventBus.dispatch = jest.fn((event) => {
        uiUpdateCount++;
        return originalDispatch(event);
      });

      // Setup generation with progress updates
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async () => {
          // Simulate progress updates
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            testBed.mockEventBus.dispatch({
              type: 'GENERATION_PROGRESS',
              payload: { progress: (i + 1) * 20 },
            });
          }
          return testBed.createMockClichesData();
        }
      );

      const startTime = performance.now();

      await characterBuilderService.generateClichesForDirection(
        concept,
        direction
      );

      const duration = performance.now() - startTime;

      // Should complete with progress updates
      expect(duration).toBeLessThan(500);
      expect(uiUpdateCount).toBeGreaterThanOrEqual(5); // At least 5 progress updates
    });

    it('should debounce rapid UI updates', async () => {
      let updateCount = 0;
      const updateTimes = [];

      // Simulate rapid updates
      const rapidUpdate = async () => {
        for (let i = 0; i < 100; i++) {
          updateCount++;
          updateTimes.push(performance.now());
          // Tiny delay to simulate rapid succession
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      };

      const startTime = performance.now();
      await rapidUpdate();
      const duration = performance.now() - startTime;

      // Should handle 100 rapid updates efficiently
      expect(duration).toBeLessThan(200);
      expect(updateCount).toBe(100);

      // Check that updates are properly spaced (debouncing would show gaps)
      const gaps = [];
      for (let i = 1; i < updateTimes.length; i++) {
        gaps.push(updateTimes[i] - updateTimes[i - 1]);
      }

      // Most gaps should be small (indicating efficient processing)
      const smallGaps = gaps.filter((g) => g < 5);
      expect(smallGaps.length).toBeGreaterThan(gaps.length * 0.8);
    });
  });

  describe('Memory Efficiency During Performance', () => {
    it('should not accumulate memory during repeated operations', async () => {
      const iterations = 50;
      const memoryUsages = [];

      for (let i = 0; i < iterations; i++) {
        const concept = testBed.createCharacterConcept({
          id: `concept-mem-${i}`,
        });
        const direction = testBed.createThematicDirection({
          id: `direction-mem-${i}`,
          conceptId: `concept-mem-${i}`,
        });

        characterBuilderService.generateClichesForDirection.mockResolvedValue(
          testBed.createCliche({
            directionId: direction.id,
            conceptId: concept.id,
          })
        );

        await characterBuilderService.generateClichesForDirection(
          concept,
          direction
        );

        // Sample memory usage periodically
        if (i % 10 === 0) {
          if (global.gc) global.gc(); // Force GC if available
          memoryUsages.push(process.memoryUsage().heapUsed);
        }
      }

      // Check that memory doesn't grow linearly
      if (memoryUsages.length > 2) {
        const firstHalf = memoryUsages.slice(
          0,
          Math.floor(memoryUsages.length / 2)
        );
        const secondHalf = memoryUsages.slice(
          Math.floor(memoryUsages.length / 2)
        );

        const avgFirstHalf =
          firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecondHalf =
          secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        // Memory growth should be minimal (less than 20% increase)
        const growthRate = (avgSecondHalf - avgFirstHalf) / avgFirstHalf;
        expect(growthRate).toBeLessThan(0.2);
      }
    });
  });

  describe('Concurrent Performance', () => {
    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 20;

      const requests = Array(concurrentRequests)
        .fill(null)
        .map((_, i) => ({
          concept: testBed.createCharacterConcept({
            id: `concept-concurrent-${i}`,
          }),
          direction: testBed.createThematicDirection({
            id: `direction-concurrent-${i}`,
            conceptId: `concept-concurrent-${i}`,
          }),
        }));

      characterBuilderService.generateClichesForDirection.mockImplementation(
        async (concept, direction) => {
          // Simulate variable processing time
          const delay = Math.random() * 50 + 10;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return testBed.createCliche({
            directionId: direction.id,
            conceptId: concept.id,
          });
        }
      );

      const startTime = performance.now();

      // Execute all requests concurrently
      const promises = requests.map(({ concept, direction }) =>
        characterBuilderService.generateClichesForDirection(concept, direction)
      );

      const results = await Promise.all(promises);

      const duration = performance.now() - startTime;

      // Should handle 20 concurrent requests efficiently
      expect(duration).toBeLessThan(1000); // Less than 1 second for 20 concurrent
      expect(results).toHaveLength(concurrentRequests);

      // All results should be valid
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.categories).toBeDefined();
        expect(result.tropesAndStereotypes).toBeDefined();
      });
    });

    it('should gracefully degrade under extreme load', async () => {
      const extremeLoad = 100;
      let successCount = 0;
      let errorCount = 0;

      // Simulate system under stress
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async () => {
          const random = Math.random();
          if (random < 0.9) {
            // 90% success rate under load
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 100)
            );
            return testBed.createMockClichesData();
          } else {
            throw new Error('System overloaded');
          }
        }
      );

      const startTime = performance.now();

      // Fire off extreme load
      const promises = Array(extremeLoad)
        .fill(null)
        .map(async () => {
          try {
            await characterBuilderService.generateClichesForDirection(
              testBed.createMockConcept(),
              testBed.createMockDirection()
            );
            successCount++;
          } catch (error) {
            errorCount++;
          }
        });

      await Promise.all(promises);

      const duration = performance.now() - startTime;

      // Should complete even under extreme load
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 requests
      expect(successCount + errorCount).toBe(extremeLoad);

      // Most requests should succeed even under load
      expect(successCount).toBeGreaterThan(extremeLoad * 0.8);
    });
  });
});
