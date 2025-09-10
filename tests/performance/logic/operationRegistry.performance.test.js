/**
 * @file operationRegistry.performance.test.js
 * @description Performance tests for OperationRegistry handler registration and lookup
 *
 * Performance Thresholds:
 * - Sequential registrations: <100ms for 1000 operations
 * - Concurrent lookups: <50ms for 1000 lookups
 * - Large registry lookups: <0.1ms average with 10,000 handlers
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import OperationRegistry from '../../../src/logic/operationRegistry.js';

describe('OperationRegistry Performance', () => {
  let logger;

  beforeEach(() => {
    // Create mock logger
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    };
  });

  describe('Performance Characteristics', () => {
    it('should handle rapid sequential registrations efficiently', () => {
      // Arrange
      const operationRegistry = new OperationRegistry({ logger });
      const numOperations = 1000;
      const startTime = performance.now();

      // Act - Register many handlers
      for (let i = 0; i < numOperations; i++) {
        operationRegistry.register(`PERF_TEST_OP_${i}`, jest.fn());
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert - Should complete quickly (< 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);

      // Verify all handlers are accessible
      for (let i = 0; i < numOperations; i++) {
        expect(operationRegistry.getHandler(`PERF_TEST_OP_${i}`)).toBeDefined();
      }
    });

    it('should handle concurrent handler lookups efficiently', async () => {
      // Arrange - Pre-register handlers
      const operationRegistry = new OperationRegistry({ logger });
      const numHandlers = 100;
      for (let i = 0; i < numHandlers; i++) {
        operationRegistry.register(`CONCURRENT_OP_${i}`, jest.fn());
      }

      // Act - Concurrent lookups
      const lookupPromises = [];
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const opIndex = i % numHandlers;
        lookupPromises.push(
          Promise.resolve(
            operationRegistry.getHandler(`CONCURRENT_OP_${opIndex}`)
          )
        );
      }

      await Promise.all(lookupPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert - Should handle 1000 lookups quickly
      expect(duration).toBeLessThan(50);
    });

    it('should maintain performance with large registry', () => {
      // Arrange - Create large registry
      const registry = new OperationRegistry({ logger });
      const numOps = 10000;

      for (let i = 0; i < numOps; i++) {
        registry.register(`LARGE_REGISTRY_OP_${i}`, jest.fn());
      }

      // Act - Time lookups
      const startTime = performance.now();
      const lookups = 1000;

      for (let i = 0; i < lookups; i++) {
        const randomIndex = Math.floor(Math.random() * numOps);
        registry.getHandler(`LARGE_REGISTRY_OP_${randomIndex}`);
      }

      const endTime = performance.now();
      const avgLookupTime = (endTime - startTime) / lookups;

      // Assert - Average lookup should be < 0.1ms even with 10k handlers
      expect(avgLookupTime).toBeLessThan(0.1);
    });
  });
});
