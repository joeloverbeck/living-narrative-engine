/**
 * @file Memory efficiency tests for ClicheErrorHandler service
 * 
 * Tests memory leak detection and resource management for error handling
 * operations in the cliché generation system.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClicheErrorHandler } from '../../../src/characterBuilder/services/clicheErrorHandler.js';
import { ClicheError } from '../../../src/errors/clicheErrors.js';

describe('ClicheErrorHandler - Memory Tests', () => {
  let errorHandler;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Create error handler instance with test configuration
    errorHandler = new ClicheErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      retryConfig: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
      },
    });

    // Clear mock calls between tests
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Leak Detection', () => {
    it('should handle high volume of errors without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many errors
      for (let i = 0; i < 1000; i++) {
        const error = new ClicheError(`Error ${i}`);
        await errorHandler.handleError(error, {
          operation: `operation_${i % 10}`,
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 15MB)
      expect(memoryIncrease).toBeLessThan(15 * 1024 * 1024);
    });

    it('should not accumulate memory over multiple error handling cycles', async () => {
      const memorySnapshots = [];
      const cycleCount = 5;
      const errorsPerCycle = 200;

      for (let cycle = 0; cycle < cycleCount; cycle++) {
        // Take memory snapshot before cycle
        if (global.gc) global.gc();
        const cycleStartMemory = process.memoryUsage().heapUsed;

        // Process errors in this cycle
        for (let i = 0; i < errorsPerCycle; i++) {
          const error = new ClicheError(`Cycle ${cycle} Error ${i}`);
          await errorHandler.handleError(error, {
            operation: `cycle_${cycle}_op_${i % 5}`,
          });
        }

        // Take memory snapshot after cycle
        if (global.gc) global.gc();
        const cycleEndMemory = process.memoryUsage().heapUsed;
        
        memorySnapshots.push({
          cycle,
          memoryUsed: cycleEndMemory - cycleStartMemory,
        });
      }

      // Check that memory usage doesn't grow linearly
      // Later cycles shouldn't use significantly more memory than earlier ones
      expect(memorySnapshots.length).toBeGreaterThanOrEqual(3);
      
      const firstCycleMemory = memorySnapshots[0].memoryUsed;
      const lastCycleMemory = memorySnapshots[memorySnapshots.length - 1].memoryUsed;
      
      // Memory usage in last cycle should not be more than 2x the first cycle
      // This would indicate a memory leak
      const memoryGrowthRatio = lastCycleMemory / firstCycleMemory;
      expect(memoryGrowthRatio).toBeLessThan(2);
    });

    it('should properly clean up circuit breaker state', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const operations = ['op1', 'op2', 'op3', 'op4', 'op5'];

      // Trigger circuit breakers for multiple operations
      for (const operation of operations) {
        // Trigger circuit breaker by causing multiple failures
        for (let i = 0; i < 10; i++) {
          const error = new ClicheError(`Circuit breaker test ${i}`);
          await errorHandler.handleError(error, { operation });
        }
      }

      // Reset all circuit breakers
      for (const operation of operations) {
        errorHandler.resetCircuitBreaker(operation);
      }

      // Process more errors to ensure cleanup worked
      for (let i = 0; i < 100; i++) {
        const error = new ClicheError(`Post-reset error ${i}`);
        await errorHandler.handleError(error, {
          operation: operations[i % operations.length],
        });
      }

      // Force garbage collection
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should not leak memory when error statistics are tracked', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const statsChecks = [];

      // Generate many unique error types and operations
      for (let i = 0; i < 500; i++) {
        const error = new ClicheError(`Unique error ${i}`);
        await errorHandler.handleError(error, {
          operation: `unique_operation_${i}`,
        });
        
        // Periodically check statistics (simulating real usage)
        if (i % 50 === 0) {
          const stats = errorHandler.getErrorStatistics();
          statsChecks.push(stats);
        }
      }

      // Verify all statistics checks returned valid data
      expect(statsChecks.length).toBeGreaterThan(0);
      statsChecks.forEach(stats => {
        expect(stats).toBeDefined();
      });

      // Force garbage collection
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Even with many unique operations, memory should be bounded
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });
});