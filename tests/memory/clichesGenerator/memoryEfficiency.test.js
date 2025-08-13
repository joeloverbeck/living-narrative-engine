/**
 * @file Memory efficiency tests for clichés generator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Clichés Generator - Memory Tests', () => {
  let testBed;
  let characterBuilderService;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.initialize();
    characterBuilderService = testBed.mockCharacterBuilderService;
  });

  afterEach(async () => {
    await testBed.cleanup();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during batch generation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const memorySnapshots = [initialMemory];

      // Setup mock for generation
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async (concept, direction) => {
          // Simulate some processing
          await new Promise((resolve) => setTimeout(resolve, 10));
          return testBed.createCliche({
            directionId: direction.id,
            conceptId: concept.id,
          });
        }
      );

      // Generate multiple batches
      for (let i = 0; i < 10; i++) {
        const concept = testBed.createMockConcept();
        const direction = testBed.createMockDirection();

        await characterBuilderService.generateClichesForDirection(
          concept,
          direction
        );

        // Take memory snapshot after each batch
        if (i % 2 === 0) {
          if (global.gc) global.gc();
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      // Force garbage collection if available
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Check for linear memory growth pattern (indicates leak)
      if (memorySnapshots.length > 3) {
        const firstThird = memorySnapshots.slice(
          0,
          Math.floor(memorySnapshots.length / 3)
        );
        const lastThird = memorySnapshots.slice(
          -Math.floor(memorySnapshots.length / 3)
        );

        const avgFirst =
          firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
        const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

        const growthRate = (avgLast - avgFirst) / avgFirst;
        // Growth rate should be minimal (less than 20%)
        expect(growthRate).toBeLessThan(0.2);
      }
    });

    it('should properly clean up after failed generations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Alternate between success and failure
      for (let i = 0; i < 20; i++) {
        const concept = testBed.createCharacterConcept({
          id: `concept-cleanup-${i}`,
        });
        const direction = testBed.createThematicDirection({
          id: `direction-cleanup-${i}`,
          conceptId: `concept-cleanup-${i}`,
        });

        if (i % 2 === 0) {
          // Success case
          characterBuilderService.generateClichesForDirection.mockResolvedValueOnce(
            testBed.createCliche({
              directionId: direction.id,
              conceptId: concept.id,
            })
          );
          await characterBuilderService.generateClichesForDirection(
            concept,
            direction
          );
        } else {
          // Failure case
          characterBuilderService.generateClichesForDirection.mockRejectedValueOnce(
            new Error('Generation failed')
          );
          try {
            await characterBuilderService.generateClichesForDirection(
              concept,
              direction
            );
          } catch (error) {
            // Expected error, continue
          }
        }
      }

      // Force garbage collection
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should be properly cleaned up even with failures
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB increase
    });

    it('should not accumulate memory with large cliché objects', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and process large cliché objects
      for (let i = 0; i < 5; i++) {
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

        // Create large arrays for each category
        categoryNames.forEach((category) => {
          largeCategories[category] = Array(500)
            .fill(null)
            .map(
              (_, j) =>
                `${category}-item-${i}-${j}-with-some-very-long-text-to-increase-memory-usage`
            );
        });

        const largeCliche = testBed.createCliche({
          directionId: `large-direction-${i}`,
          categories: largeCategories,
          tropesAndStereotypes: Array(200)
            .fill(null)
            .map(
              (_, j) =>
                `trope-${i}-${j}-with-detailed-description-and-more-text`
            ),
        });

        // Store and retrieve
        characterBuilderService.storeCliches.mockResolvedValueOnce(true);
        characterBuilderService.getClichesByDirectionId.mockResolvedValueOnce(
          largeCliche
        );

        await characterBuilderService.storeCliches(largeCliche);
        await characterBuilderService.getClichesByDirectionId(
          `large-direction-${i}`
        );

        // Clear reference to allow garbage collection
        // largeCliche = null; // This happens automatically when loop continues
      }

      // Force garbage collection
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should be released after processing
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB retained
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should efficiently handle concurrent operations without memory spikes', async () => {
      const concurrentCount = 30;
      const memoryBefore = process.memoryUsage().heapUsed;

      // Setup mock for concurrent operations
      characterBuilderService.generateClichesForDirection.mockImplementation(
        async (concept, direction) => {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 50)
          );
          return testBed.createCliche({
            directionId: direction.id,
            conceptId: concept.id,
          });
        }
      );

      // Create all requests
      const requests = Array(concurrentCount)
        .fill(null)
        .map((_, i) => ({
          concept: testBed.createCharacterConcept({ id: `concurrent-${i}` }),
          direction: testBed.createThematicDirection({
            id: `concurrent-dir-${i}`,
            conceptId: `concurrent-${i}`,
          }),
        }));

      // Execute concurrently
      const promises = requests.map(({ concept, direction }) =>
        characterBuilderService.generateClichesForDirection(concept, direction)
      );

      await Promise.all(promises);

      // Check memory after concurrent operations
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryUsed = memoryAfter - memoryBefore;

      // Memory usage should be reasonable for 30 concurrent operations
      const memoryPerOperation = memoryUsed / concurrentCount;
      expect(memoryPerOperation).toBeLessThan(500 * 1024); // Less than 500KB per operation
    });

    it('should release memory after clearing cliché cache', async () => {
      // Simulate cache population
      const cacheSize = 50;
      const cachedCliches = {};

      for (let i = 0; i < cacheSize; i++) {
        const cliche = testBed.createCliche({
          directionId: `cached-${i}`,
          categories: {
            names: Array(20)
              .fill(null)
              .map((_, j) => `name-${i}-${j}`),
            physicalDescriptions: Array(20)
              .fill(null)
              .map((_, j) => `desc-${i}-${j}`),
            personalityTraits: Array(20)
              .fill(null)
              .map((_, j) => `trait-${i}-${j}`),
            skillsAbilities: Array(20)
              .fill(null)
              .map((_, j) => `skill-${i}-${j}`),
            typicalLikes: Array(20)
              .fill(null)
              .map((_, j) => `like-${i}-${j}`),
            typicalDislikes: Array(20)
              .fill(null)
              .map((_, j) => `dislike-${i}-${j}`),
            commonFears: Array(20)
              .fill(null)
              .map((_, j) => `fear-${i}-${j}`),
            genericGoals: Array(20)
              .fill(null)
              .map((_, j) => `goal-${i}-${j}`),
            backgroundElements: Array(20)
              .fill(null)
              .map((_, j) => `background-${i}-${j}`),
            overusedSecrets: Array(20)
              .fill(null)
              .map((_, j) => `secret-${i}-${j}`),
            speechPatterns: Array(20)
              .fill(null)
              .map((_, j) => `pattern-${i}-${j}`),
          },
        });
        cachedCliches[`cached-${i}`] = cliche;
      }

      const memoryWithCache = process.memoryUsage().heapUsed;

      // Clear cache
      Object.keys(cachedCliches).forEach((key) => {
        delete cachedCliches[key];
      });

      // Force garbage collection
      if (global.gc) global.gc();

      const memoryAfterClear = process.memoryUsage().heapUsed;

      // Memory should be significantly reduced after clearing cache
      const memoryReleased = memoryWithCache - memoryAfterClear;
      expect(memoryReleased).toBeGreaterThan(0);
    });

    it('should handle memory efficiently during UI updates', async () => {
      const updateCount = 100;
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate UI update events
      const events = [];
      for (let i = 0; i < updateCount; i++) {
        const event = {
          type: 'CLICHE_GENERATION_PROGRESS',
          payload: {
            progress: i,
            directionId: `direction-${i}`,
            message: `Processing item ${i} of ${updateCount}`,
            timestamp: Date.now(),
          },
        };
        events.push(event);

        // Simulate event dispatch
        testBed.mockEventBus.dispatch(event);

        // Small delay to simulate real-time updates
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Clear events array
      events.length = 0;

      // Force garbage collection
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // UI updates should not cause significant memory accumulation
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024); // Less than 2MB
    });
  });

  describe('Resource Cleanup', () => {
    it('should properly clean up event listeners', async () => {
      // Track event listener count
      const eventTypes = [
        'GENERATION_START',
        'GENERATION_COMPLETE',
        'GENERATION_ERROR',
      ];
      const listeners = new Map();

      // Setup listeners that will actually be called
      eventTypes.forEach((eventType) => {
        const listener = jest.fn();
        listeners.set(eventType, listener);

        // Mock the subscribe to actually register callbacks
        if (!testBed.eventCallbacks.has(eventType)) {
          testBed.eventCallbacks.set(eventType, []);
        }
        testBed.eventCallbacks.get(eventType).push(listener);
      });

      // Simulate multiple generation cycles
      for (let i = 0; i < 10; i++) {
        // Trigger callbacks for GENERATION_START
        const startCallbacks =
          testBed.eventCallbacks.get('GENERATION_START') || [];
        startCallbacks.forEach((cb) =>
          cb({ type: 'GENERATION_START', payload: { id: i } })
        );

        // Trigger callbacks for GENERATION_COMPLETE
        const completeCallbacks =
          testBed.eventCallbacks.get('GENERATION_COMPLETE') || [];
        completeCallbacks.forEach((cb) =>
          cb({ type: 'GENERATION_COMPLETE', payload: { id: i } })
        );
      }

      // Check that listeners were called
      const startListener = listeners.get('GENERATION_START');
      const completeListener = listeners.get('GENERATION_COMPLETE');

      if (startListener) {
        expect(startListener).toHaveBeenCalledTimes(10);
      }
      if (completeListener) {
        expect(completeListener).toHaveBeenCalledTimes(10);
      }

      // Clean up should remove listeners
      await testBed.cleanup();

      // Verify cleanup removed the callbacks
      expect(testBed.eventCallbacks.size).toBe(0);
    });

    it('should clean up DOM references properly', async () => {
      // Create multiple DOM elements
      const elementsCreated = [];

      for (let i = 0; i < 20; i++) {
        const div = document.createElement('div');
        div.id = `cliche-element-${i}`;
        div.innerHTML = `<span>Cliche content ${i}</span>`;
        document.body.appendChild(div);
        elementsCreated.push(div);
      }

      const memoryWithDOM = process.memoryUsage().heapUsed;

      // Clean up DOM
      elementsCreated.forEach((element) => {
        element.remove();
      });
      elementsCreated.length = 0;

      // Also clean up test bed DOM
      await testBed.cleanup();

      // Force garbage collection
      if (global.gc) global.gc();

      const memoryAfterCleanup = process.memoryUsage().heapUsed;

      // DOM cleanup should free memory
      expect(memoryAfterCleanup).toBeLessThanOrEqual(memoryWithDOM);

      // Verify DOM is actually cleaned
      expect(document.body.innerHTML).toBe('');
    });

    it('should not retain references to old test data', async () => {
      const testRuns = 5;
      const memorySnapshots = [];

      for (let run = 0; run < testRuns; run++) {
        // Create test data for this run
        const runData = {
          concepts: Array(10)
            .fill(null)
            .map((_, i) =>
              testBed.createCharacterConcept({ id: `run-${run}-concept-${i}` })
            ),
          directions: Array(10)
            .fill(null)
            .map((_, i) =>
              testBed.createThematicDirection({
                id: `run-${run}-direction-${i}`,
              })
            ),
          cliches: Array(10)
            .fill(null)
            .map((_, i) =>
              testBed.createCliche({ directionId: `run-${run}-direction-${i}` })
            ),
        };

        // Process the data
        for (let i = 0; i < runData.concepts.length; i++) {
          characterBuilderService.storeCharacterConcept.mockResolvedValueOnce(
            true
          );
          characterBuilderService.storeThematicDirection.mockResolvedValueOnce(
            true
          );
          characterBuilderService.storeCliches.mockResolvedValueOnce(true);

          await characterBuilderService.storeCharacterConcept(
            runData.concepts[i]
          );
          await characterBuilderService.storeThematicDirection(
            runData.directions[i]
          );
          await characterBuilderService.storeCliches(runData.cliches[i]);
        }

        // Clear run data
        runData.concepts = null;
        runData.directions = null;
        runData.cliches = null;

        // Take memory snapshot
        if (global.gc) global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Memory should stabilize, not grow linearly
      if (memorySnapshots.length >= 3) {
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const firstSnapshot = memorySnapshots[0];
        const growthRate = (lastSnapshot - firstSnapshot) / firstSnapshot;

        // Growth should be minimal across runs
        expect(growthRate).toBeLessThan(0.3); // Less than 30% growth
      }
    });
  });
});
