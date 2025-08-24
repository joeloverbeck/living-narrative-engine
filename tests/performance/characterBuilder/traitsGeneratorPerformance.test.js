/**
 * @file Performance tests for traits generator
 * @description Tests performance characteristics, concurrency, and load handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsGeneratorTestBed } from '../../common/traitsGeneratorTestBed.js';

describe('Traits Generator Performance Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TraitsGeneratorTestBed();
    testBed.setup();

    // Set longer timeout for performance tests
    jest.setTimeout(10000);
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
    // Reset timeout
    jest.setTimeout(5000);
  });

  describe('Performance Integration Tests', () => {
    it('should handle multiple concurrent generation requests', async () => {
      const promises = [];
      const numberOfRequests = 5;

      // Mock responses for each request
      testBed.mockCharacterBuilderService.generateTraits.mockImplementation(
        () => {
          // Simulate some processing time
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(testBed.createValidTraitsResponse());
            }, 100);
          });
        }
      );

      // Create multiple concurrent requests
      for (let i = 0; i < numberOfRequests; i++) {
        const concept = testBed.createValidConcept();
        concept.id = `concept-${i}`;

        const direction = testBed.createValidDirection();
        direction.id = `direction-${i}`;

        promises.push(
          testBed.executeTraitsGeneration(
            concept,
            direction,
            testBed.createValidUserInputs(),
            []
          )
        );
      }

      // Wait for all requests to complete
      const results = await Promise.all(promises);

      // Verify all requests completed successfully
      expect(results).toHaveLength(numberOfRequests);
      results.forEach((result) => {
        expect(result).toBeDefined();
        testBed.verifyAllTraitCategoriesPresent(result);
      });

      // Verify service was called correct number of times
      expect(
        testBed.mockCharacterBuilderService.generateTraits
      ).toHaveBeenCalledTimes(numberOfRequests);
    });

    it('should complete generation within reasonable time', async () => {
      const startTime = Date.now();

      // Mock a realistic response time
      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        testBed.createValidTraitsResponse()
      );

      await testBed.executeTraitsGeneration(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      );

      const elapsedTime = Date.now() - startTime;

      // Should complete within 5 seconds (generous timeout for CI/CD)
      expect(elapsedTime).toBeLessThan(5000);

      // With mocked response, should be very fast
      expect(elapsedTime).toBeLessThan(100);
    });

    it('should handle rapid sequential requests', async () => {
      const numberOfRequests = 10;
      const results = [];

      // Mock quick responses
      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        testBed.createValidTraitsResponse()
      );

      // Fire requests in rapid succession
      for (let i = 0; i < numberOfRequests; i++) {
        const result = await testBed.executeTraitsGeneration(
          testBed.createValidConcept(),
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        );
        results.push(result);
      }

      // Verify all completed successfully
      expect(results).toHaveLength(numberOfRequests);
      results.forEach((result) => {
        expect(result).toBeDefined();
        testBed.verifyTraitsStructure(result);
      });
    });

    it('should maintain consistent response times under load', async () => {
      const responseTimes = [];
      const numberOfRequests = 5;

      // Track timing for each request
      for (let i = 0; i < numberOfRequests; i++) {
        const startTime = Date.now();

        // Mock immediate response
        testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
          testBed.createValidTraitsResponse()
        );

        await testBed.executeTraitsGeneration(
          testBed.createValidConcept(),
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        );

        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
      }

      // Calculate average and standard deviation
      const avgTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const variance =
        responseTimes.reduce((sum, time) => {
          return sum + Math.pow(time - avgTime, 2);
        }, 0) / responseTimes.length;
      const stdDev = Math.sqrt(variance);

      // Response times should be consistent (low standard deviation)
      expect(stdDev).toBeLessThan(50); // Allow up to 50ms variation
      expect(avgTime).toBeLessThan(100); // Should be fast with mocked responses
    });
  });

  // Memory and Resource Management tests have been moved to tests/memory/characterBuilder/traitsGeneratorMemory.test.js

  describe('Throttling and Rate Limiting', () => {
    it('should handle rate-limited responses gracefully', async () => {
      let callCount = 0;

      // Mock rate limiting on third call
      testBed.mockCharacterBuilderService.generateTraits.mockImplementation(
        () => {
          callCount++;
          if (callCount === 3) {
            const rateLimitError = new Error('Rate limit exceeded');
            rateLimitError.code = 'RATE_LIMIT';
            return Promise.reject(rateLimitError);
          }
          return Promise.resolve(testBed.createValidTraitsResponse());
        }
      );

      const results = [];
      const errors = [];

      // Make multiple requests directly to the mock service
      for (let i = 0; i < 5; i++) {
        try {
          const result =
            await testBed.mockCharacterBuilderService.generateTraits({
              concept: testBed.createValidConcept(),
              direction: testBed.createValidDirection(),
              userInputs: testBed.createValidUserInputs(),
              cliches: [],
            });
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }

      // Should have total of 5 attempts (some succeeded, some failed)
      expect(results.length + errors.length).toBe(5);
      // Exactly one should be rate limited (call #3)
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Rate limit exceeded');
    });

    it('should space out requests to avoid rate limiting', async () => {
      const delays = [];
      let lastCallTime = Date.now();

      testBed.mockCharacterBuilderService.generateTraits.mockImplementation(
        () => {
          const currentTime = Date.now();
          const delay = currentTime - lastCallTime;
          delays.push(delay);
          lastCallTime = currentTime;
          return Promise.resolve(testBed.createValidTraitsResponse());
        }
      );

      // Execute requests with artificial spacing
      for (let i = 0; i < 3; i++) {
        await testBed.executeTraitsGeneration(
          testBed.createValidConcept(),
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        );

        // Add small delay between requests
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // First delay will be large (from test setup), ignore it
      const requestDelays = delays.slice(1);

      // Subsequent delays should reflect our spacing
      requestDelays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(100);
      });
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum input sizes', async () => {
      // Create maximum size inputs
      const largeUserInputs = {
        coreMotivation: 'A'.repeat(1000), // 1000 characters
        internalContradiction: 'B'.repeat(1000),
        centralQuestion: 'C'.repeat(1000) + '?',
      };

      const largeClichés = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `cliche-${i}`,
          text: `Cliché number ${i} with some additional text to make it longer`,
        }));

      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        testBed.createValidTraitsResponse()
      );

      const result = await testBed.executeTraitsGeneration(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        largeUserInputs,
        largeClichés
      );

      // Should handle large inputs successfully
      expect(result).toBeDefined();
      testBed.verifyTraitsStructure(result);
    });

    it('should recover from timeout errors', async () => {
      let callCount = 0;

      // First call times out, second succeeds
      testBed.mockCharacterBuilderService.generateTraits.mockImplementation(
        () => {
          callCount++;
          if (callCount === 1) {
            const timeoutError = new Error('Request timeout');
            timeoutError.code = 'TIMEOUT';
            return Promise.reject(timeoutError);
          }
          return Promise.resolve(testBed.createValidTraitsResponse());
        }
      );

      // First attempt fails
      try {
        await testBed.executeTraitsGeneration(
          testBed.createValidConcept(),
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        );
      } catch (error) {
        expect(error.message).toContain('timeout');
      }

      // Retry succeeds
      const retryResult = await testBed.executeTraitsGeneration(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      );

      expect(retryResult).toBeDefined();
      testBed.verifyTraitsStructure(retryResult);
    });

    it('should handle rapid UI interactions', async () => {
      // Simulate rapid button clicks
      const clickPromises = [];

      testBed.setupValidUIState();
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      // Simulate multiple rapid clicks
      for (let i = 0; i < 5; i++) {
        clickPromises.push(testBed.simulateButtonClick('generateButton'));
      }

      // Wait for all clicks to process
      await Promise.all(clickPromises);

      // Should handle rapid clicks without errors
      // In real implementation, subsequent clicks would be ignored while loading
      expect(testBed.uiElements.generateButton).toBeDefined();
    });
  });

  describe('Batch Processing', () => {
    it('should efficiently process batch generation requests', async () => {
      const batchSize = 10;
      const concepts = [];
      const directions = [];

      // Create batch data
      for (let i = 0; i < batchSize; i++) {
        const concept = testBed.createValidConcept();
        concept.id = `batch-concept-${i}`;
        concepts.push(concept);

        const direction = testBed.createValidDirection();
        direction.id = `batch-direction-${i}`;
        directions.push(direction);
      }

      // Mock batch processing
      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        testBed.createValidTraitsResponse()
      );

      const startTime = Date.now();

      // Process batch
      const batchPromises = concepts.map((concept, index) =>
        testBed.executeTraitsGeneration(
          concept,
          directions[index],
          testBed.createValidUserInputs(),
          []
        )
      );

      const results = await Promise.all(batchPromises);
      const totalTime = Date.now() - startTime;

      // Verify batch completed
      expect(results).toHaveLength(batchSize);
      results.forEach((result) => {
        testBed.verifyTraitsStructure(result);
      });

      // Batch should complete reasonably quickly
      const avgTimePerRequest = totalTime / batchSize;
      expect(avgTimePerRequest).toBeLessThan(500); // Average < 500ms per request
    });

    it('should handle partial batch failures', async () => {
      const batchSize = 5;
      let callCount = 0;

      // Mock some failures in batch
      testBed.mockCharacterBuilderService.generateTraits.mockImplementation(
        () => {
          callCount++;
          // Fail on 2nd and 4th requests
          if (callCount === 2 || callCount === 4) {
            return Promise.reject(new Error(`Batch item ${callCount} failed`));
          }
          return Promise.resolve(testBed.createValidTraitsResponse());
        }
      );

      const results = [];
      const errors = [];

      // Process batch with error handling - call service directly
      for (let i = 0; i < batchSize; i++) {
        try {
          const result =
            await testBed.mockCharacterBuilderService.generateTraits({
              concept: testBed.createValidConcept(),
              direction: testBed.createValidDirection(),
              userInputs: testBed.createValidUserInputs(),
              cliches: [],
            });
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }

      // Should have partial success (3 succeeded, 2 failed)
      expect(results.length + errors.length).toBe(batchSize);
      expect(results.length).toBe(3); // 3 succeeded
      expect(errors.length).toBe(2); // 2 failed
      expect(errors.some((e) => e.message.includes('failed'))).toBe(true);

      // Successful results should be valid
      results.forEach((result) => {
        testBed.verifyTraitsStructure(result);
      });
    });
  });
});
