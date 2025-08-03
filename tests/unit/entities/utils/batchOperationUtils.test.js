/**
 * @file batchOperationUtils.test.js - Unit tests for batch operation utilities
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  processBatch,
  processSequentialBatch,
  processParallelBatch,
  processWithConcurrency,
  validateBatchProcessingOptions,
} from '../../../../src/entities/utils/batchOperationUtils.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

// Mock the configUtils to avoid initialization issues
jest.mock('../../../../src/entities/utils/configUtils.js', () => ({
  validateBatchSize: jest.fn(),
}));

describe('batchOperationUtils', () => {
  let mockProcessor;
  let mockProgressCallback;

  beforeEach(() => {
    mockProcessor = jest.fn();
    mockProgressCallback = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBatchProcessingOptions', () => {
    describe('Valid options', () => {
      it('should accept valid options object', () => {
        const validOptions = {
          batchSize: 10,
          stopOnError: true,
          enableParallel: false,
          maxConcurrency: 3,
          onProgress: mockProgressCallback,
        };

        expect(() =>
          validateBatchProcessingOptions(validOptions)
        ).not.toThrow();
      });

      it('should accept empty options object', () => {
        expect(() => validateBatchProcessingOptions({})).not.toThrow();
      });

      it('should accept undefined optional properties', () => {
        const options = {
          batchSize: undefined,
          maxConcurrency: undefined,
          onProgress: undefined,
        };

        expect(() => validateBatchProcessingOptions(options)).not.toThrow();
      });
    });

    describe('Invalid options', () => {
      it('should throw error if options is not an object', () => {
        expect(() => validateBatchProcessingOptions(null)).toThrow(
          InvalidArgumentError
        );
        expect(() => validateBatchProcessingOptions('string')).toThrow(
          InvalidArgumentError
        );
        expect(() => validateBatchProcessingOptions(123)).toThrow(
          InvalidArgumentError
        );
      });

      it('should throw error for invalid maxConcurrency', () => {
        expect(() =>
          validateBatchProcessingOptions({ maxConcurrency: 0 })
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validateBatchProcessingOptions({ maxConcurrency: -1 })
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validateBatchProcessingOptions({ maxConcurrency: 'invalid' })
        ).toThrow(InvalidArgumentError);
      });

      it('should throw error for invalid onProgress', () => {
        expect(() =>
          validateBatchProcessingOptions({ onProgress: 'not-a-function' })
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validateBatchProcessingOptions({ onProgress: 123 })
        ).toThrow(InvalidArgumentError);
      });
    });
  });

  describe('processSequentialBatch', () => {
    describe('Successful processing', () => {
      it('should process items sequentially and return results', async () => {
        const items = [1, 2, 3];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processSequentialBatch(items, mockProcessor);

        expect(result.successes).toEqual([2, 4, 6]);
        expect(result.failures).toEqual([]);
        expect(result.totalProcessed).toBe(3);
        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
        expect(mockProcessor).toHaveBeenCalledTimes(3);
        expect(mockProcessor).toHaveBeenNthCalledWith(1, 1);
        expect(mockProcessor).toHaveBeenNthCalledWith(2, 2);
        expect(mockProcessor).toHaveBeenNthCalledWith(3, 3);
      });

      it('should handle empty array', async () => {
        const result = await processSequentialBatch([], mockProcessor);

        expect(result.successes).toEqual([]);
        expect(result.failures).toEqual([]);
        expect(result.totalProcessed).toBe(0);
        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(0);
        expect(mockProcessor).not.toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should handle individual item failures', async () => {
        const items = [1, 2, 3];
        const error = new Error('Processing failed');
        mockProcessor
          .mockResolvedValueOnce(2) // item 1 succeeds
          .mockRejectedValueOnce(error) // item 2 fails
          .mockResolvedValueOnce(6); // item 3 succeeds

        const result = await processSequentialBatch(items, mockProcessor);

        expect(result.successes).toEqual([2, 6]);
        expect(result.failures).toEqual([{ item: 2, error }]);
        expect(result.totalProcessed).toBe(3);
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
      });

      it('should continue processing after failures', async () => {
        const items = [1, 2, 3, 4];
        mockProcessor
          .mockRejectedValueOnce(new Error('Fail 1'))
          .mockRejectedValueOnce(new Error('Fail 2'))
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(8);

        const result = await processSequentialBatch(items, mockProcessor);

        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(2);
        expect(result.totalProcessed).toBe(4);
      });
    });
  });

  describe('processParallelBatch', () => {
    describe('Successful processing', () => {
      it('should process items in parallel with default concurrency', async () => {
        const items = [1, 2, 3];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processParallelBatch(items, mockProcessor);

        expect(result.successes).toEqual(expect.arrayContaining([2, 4, 6]));
        expect(result.failures).toEqual([]);
        expect(result.totalProcessed).toBe(3);
        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
        expect(mockProcessor).toHaveBeenCalledTimes(3);
      });

      it('should process items with custom concurrency', async () => {
        const items = [1, 2, 3, 4, 5];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processParallelBatch(items, mockProcessor, 2);

        expect(result.successes).toEqual(
          expect.arrayContaining([2, 4, 6, 8, 10])
        );
        expect(result.totalProcessed).toBe(5);
        expect(result.successCount).toBe(5);
        expect(result.failureCount).toBe(0);
      });

      it('should handle empty array', async () => {
        const result = await processParallelBatch([], mockProcessor);

        expect(result.successes).toEqual([]);
        expect(result.failures).toEqual([]);
        expect(result.totalProcessed).toBe(0);
        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(0);
      });
    });

    describe('Error handling', () => {
      it('should handle individual item failures in parallel', async () => {
        const items = [1, 2, 3];
        const error = new Error('Processing failed');
        mockProcessor
          .mockResolvedValueOnce(2)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(6);

        const result = await processParallelBatch(items, mockProcessor);

        expect(result.successes).toEqual(expect.arrayContaining([2, 6]));
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].item).toBe(2);
        expect(result.failures[0].error).toBe(error);
        expect(result.totalProcessed).toBe(3);
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
      });
    });
  });

  describe('processWithConcurrency', () => {
    describe('Concurrency control', () => {
      it('should process items with concurrency limit', async () => {
        const items = [1, 2, 3, 4, 5];

        mockProcessor.mockImplementation(async (item) => {
          // Add small delay to test concurrency
          await new Promise((resolve) => setTimeout(resolve, 10));
          return item * 2;
        });

        const result = await processWithConcurrency(items, mockProcessor, 2);

        expect(result).toHaveLength(5);

        // All should succeed
        const successes = result.filter((r) => r.success);
        expect(successes).toHaveLength(5);

        // Verify results are correct
        const resultValues = successes
          .map((s) => s.result)
          .sort((a, b) => a - b);
        expect(resultValues).toEqual([2, 4, 6, 8, 10]);
      });

      it('should handle failures in concurrent processing', async () => {
        const items = [1, 2, 3];
        const error = new Error('Processing failed');

        mockProcessor
          .mockResolvedValueOnce(2)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(6);

        const result = await processWithConcurrency(items, mockProcessor, 2);

        expect(result).toHaveLength(3);

        const successes = result.filter((r) => r.success);
        const failures = result.filter((r) => !r.success);

        expect(successes).toHaveLength(2);
        expect(failures).toHaveLength(1);
        expect(failures[0].error).toBe(error);
      });
    });
  });

  describe('processBatch', () => {
    describe('Input validation', () => {
      it('should throw error if items is not an array', async () => {
        await expect(processBatch('not-array', mockProcessor)).rejects.toThrow(
          InvalidArgumentError
        );
        await expect(processBatch(null, mockProcessor)).rejects.toThrow(
          InvalidArgumentError
        );
        await expect(processBatch(123, mockProcessor)).rejects.toThrow(
          InvalidArgumentError
        );
      });

      it('should throw error if processor is not a function', async () => {
        await expect(processBatch([], 'not-function')).rejects.toThrow(
          InvalidArgumentError
        );
        await expect(processBatch([], null)).rejects.toThrow(
          InvalidArgumentError
        );
        await expect(processBatch([], 123)).rejects.toThrow(
          InvalidArgumentError
        );
      });
    });

    describe('Sequential processing (default)', () => {
      it('should process items sequentially by default', async () => {
        const items = [1, 2, 3, 4, 5];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processBatch(items, mockProcessor, {
          batchSize: 2,
        });

        expect(result.successes).toEqual([2, 4, 6, 8, 10]);
        expect(result.failures).toEqual([]);
        expect(result.totalProcessed).toBe(5);
        expect(result.successCount).toBe(5);
        expect(result.failureCount).toBe(0);
        expect(typeof result.processingTime).toBe('number');
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
      });

      it('should handle batch processing with custom batch size', async () => {
        const items = [1, 2, 3, 4, 5, 6, 7];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processBatch(items, mockProcessor, {
          batchSize: 3,
        });

        expect(result.successCount).toBe(7);
        expect(result.failureCount).toBe(0);
        expect(mockProcessor).toHaveBeenCalledTimes(7);
      });
    });

    describe('Parallel processing', () => {
      it('should process items in parallel when enabled', async () => {
        const items = [1, 2, 3, 4];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processBatch(items, mockProcessor, {
          batchSize: 2,
          enableParallel: true,
          maxConcurrency: 2,
        });

        expect(result.successCount).toBe(4);
        expect(result.failureCount).toBe(0);
        expect(result.totalProcessed).toBe(4);
      });
    });

    describe('Progress tracking', () => {
      it('should call progress callback during processing', async () => {
        const items = [1, 2, 3, 4, 5, 6];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        await processBatch(items, mockProcessor, {
          batchSize: 2,
          onProgress: mockProgressCallback,
        });

        expect(mockProgressCallback).toHaveBeenCalledTimes(3); // 3 batches

        // Check first progress call
        expect(mockProgressCallback).toHaveBeenNthCalledWith(1, {
          batchIndex: 0,
          totalBatches: 3,
          processedItems: 2,
          totalItems: 6,
          successes: 2,
          failures: 0,
        });

        // Check last progress call
        expect(mockProgressCallback).toHaveBeenNthCalledWith(3, {
          batchIndex: 2,
          totalBatches: 3,
          processedItems: 6,
          totalItems: 6,
          successes: 6,
          failures: 0,
        });
      });
    });

    describe('Error handling', () => {
      it('should continue processing when stopOnError is false', async () => {
        const items = [1, 2, 3, 4];
        const error = new Error('Processing failed');
        mockProcessor
          .mockResolvedValueOnce(2)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(8);

        const result = await processBatch(items, mockProcessor, {
          batchSize: 2,
          stopOnError: false,
        });

        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(1);
        expect(result.totalProcessed).toBe(4);
      });

      it('should stop processing when stopOnError is true and batch fails', async () => {
        const items = [1, 2, 3, 4, 5, 6];
        const error = new Error('Processing failed');
        mockProcessor
          .mockResolvedValueOnce(2) // First batch succeeds
          .mockResolvedValueOnce(4)
          .mockRejectedValueOnce(error) // Second batch has failure
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(10) // Third batch would succeed but should be skipped
          .mockResolvedValueOnce(12);

        const result = await processBatch(items, mockProcessor, {
          batchSize: 2,
          stopOnError: true,
        });

        expect(result.totalProcessed).toBe(4); // Only first 2 batches processed
        expect(mockProcessor).toHaveBeenCalledTimes(4);
      });

      it('should handle batch-level errors gracefully', async () => {
        const items = [1, 2, 3, 4];
        // Mock the internal batch processing to throw
        const originalError = new Error('Batch processing failed');

        mockProcessor.mockImplementation(() => {
          throw originalError;
        });

        const result = await processBatch(items, mockProcessor, {
          batchSize: 2,
          stopOnError: false,
        });

        expect(result.failures.length).toBeGreaterThan(0);
        expect(result.failureCount).toBeGreaterThan(0);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty array', async () => {
        const result = await processBatch([], mockProcessor);

        expect(result.successes).toEqual([]);
        expect(result.failures).toEqual([]);
        expect(result.totalProcessed).toBe(0);
        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(0);
        expect(typeof result.processingTime).toBe('number');
        expect(mockProcessor).not.toHaveBeenCalled();
      });

      it('should handle single item', async () => {
        const items = [42];
        mockProcessor.mockResolvedValue(84);

        const result = await processBatch(items, mockProcessor);

        expect(result.successes).toEqual([84]);
        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
        expect(mockProcessor).toHaveBeenCalledWith(42);
      });

      it('should handle items count less than batch size', async () => {
        const items = [1, 2];
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processBatch(items, mockProcessor, {
          batchSize: 10,
        });

        expect(result.successCount).toBe(2);
        expect(result.totalProcessed).toBe(2);
      });
    });

    describe('Default options', () => {
      it('should use default options when not provided', async () => {
        const items = Array.from({ length: 100 }, (_, i) => i + 1);
        mockProcessor.mockImplementation((item) => Promise.resolve(item * 2));

        const result = await processBatch(items, mockProcessor);

        expect(result.successCount).toBe(100);
        expect(result.failureCount).toBe(0);
        // Should use default batch size of 50
        expect(mockProcessor).toHaveBeenCalledTimes(100);
      });
    });

    describe('Options validation integration', () => {
      it('should validate options before processing', async () => {
        const items = [1, 2, 3];

        await expect(
          processBatch(items, mockProcessor, {
            maxConcurrency: -1,
          })
        ).rejects.toThrow(InvalidArgumentError);

        await expect(
          processBatch(items, mockProcessor, {
            onProgress: 'not-a-function',
          })
        ).rejects.toThrow(InvalidArgumentError);
      });
    });
  });
});
