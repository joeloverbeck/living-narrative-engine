/**
 * @file Unit tests for FileTraceOutputHandler multi-format support
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import FileTraceOutputHandler from '../../../../src/actions/tracing/fileTraceOutputHandler.js';
import { createTestBed } from '../../../common/testBed.js';
import { createMockFetch } from '../../../common/mockFactories/actionTracing.js';

describe('FileTraceOutputHandler - Multi-Format Support', () => {
  let testBed;
  let handler;
  let mockLogger;
  let mockTraceDirectoryManager;
  let originalFetch;
  let mockFetch;

  // Helper function to wait for queue processing
  const waitForQueueProcessing = async (handlerInstance, maxWaitMs = 200) => {
    const realDateNow = Date.now
      ? Date.now.bind(Date)
      : () => new Date().getTime();
    const startTime = realDateNow();
    while (
      handlerInstance.getStatistics().isProcessingQueue &&
      realDateNow() - startTime < maxWaitMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    // Wait a bit more to ensure all async operations complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  };

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    mockTraceDirectoryManager = {
      selectDirectory: jest.fn(),
      ensureSubdirectoryExists: jest.fn(),
    };

    // Store and mock global fetch
    originalFetch = global.fetch;
    mockFetch = createMockFetch();
    global.fetch = mockFetch;

    handler = new FileTraceOutputHandler({
      outputDirectory: './test-traces',
      traceDirectoryManager: mockTraceDirectoryManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('Multi-Format Writing', () => {
    it('should write multiple formatted traces in parallel', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace({ actionId: 'test_action' }),
        },
        {
          content: '=== Test Trace ===',
          fileName: 'test.txt',
          originalTrace: testBed.createMockTrace({
            actionId: 'test_action',
            _outputFormat: 'text',
          }),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            filePath: '/path/to/file',
          }),
      });

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify the batch endpoint was called with correct data
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/traces/write-batch',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Verify both traces were sent in the batch
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.traces).toHaveLength(2);
      expect(requestBody.traces[0].traceData).toBe('{"test": "json"}');
      expect(requestBody.traces[1].traceData).toBe('=== Test Trace ===');
    });

    it('should handle partial failures gracefully', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
        {
          content: '=== Test Trace ===',
          fileName: 'test.txt',
          originalTrace: testBed.createMockTrace({ _outputFormat: 'text' }),
        },
      ];

      // Mock the batch endpoint to fail with non-404 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await handler.writeBatch(formattedTraces);

      // Should fail when batch endpoint returns error
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Batch write failed'),
        expect.any(Object)
      );
    });

    it('should return false if all writes fail', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      mockFetch.mockRejectedValue(new Error('Server down'));

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(false);
    });

    it('should handle empty or invalid batch gracefully', async () => {
      // Test with empty array
      let result = await handler.writeBatch([]);
      expect(result).toBe(false);

      // Test with null
      result = await handler.writeBatch(null);
      expect(result).toBe(false);

      // Test with non-array
      result = await handler.writeBatch('invalid');
      expect(result).toBe(false);
    });
  });

  describe('Server Endpoint Integration', () => {
    it('should use batch endpoint when available', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
        {
          content: '=== Test Trace ===',
          fileName: 'test.txt',
          originalTrace: testBed.createMockTrace({ _outputFormat: 'text' }),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            successCount: 2,
            failureCount: 0,
            totalSize: 2048,
          }),
      });

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/traces/write-batch',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should fallback to individual writes when batch endpoint unavailable', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      // Mock batch endpoint returning 404, then individual endpoint succeeding
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Not found' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      // Spy on individual writeTrace to verify fallback
      const writeTraceSpy = jest.spyOn(handler, 'writeTrace');

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/traces/write-batch',
        expect.any(Object)
      );

      // Wait for the fallback individual writes to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should handle server errors gracefully', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Batch write failed'),
        expect.any(Object)
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing writeTrace interface', async () => {
      const traceData = testBed.createMockTrace();
      const originalTrace = testBed.createMockTrace();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await handler.writeTrace(traceData, originalTrace);

      expect(result).toBe(true);

      // Wait for queue processing
      await waitForQueueProcessing(handler);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle writeTrace with different data formats', async () => {
      const jsonTrace = testBed.createMockTrace();
      const textTrace = testBed.createMockTrace({ _outputFormat: 'text' });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Write JSON format
      await handler.writeTrace('{"json": "data"}', jsonTrace);

      // Write text format
      await handler.writeTrace('=== Text Data ===', textTrace);

      // Wait for queue processing
      await waitForQueueProcessing(handler);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should validate input parameters', async () => {
      // Test with null input
      let result = await handler.writeBatch(null);
      expect(result).toBe(false);

      // Test with empty array
      result = await handler.writeBatch([]);
      expect(result).toBe(false);

      // Test with non-array
      result = await handler.writeBatch('invalid');
      expect(result).toBe(false);
    });

    it('should handle network timeouts gracefully', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
      );

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Batch server write failed'),
        expect.any(Object)
      );
    });

    it('should handle malformed server responses', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await handler.writeBatch(formattedTraces);

      expect(result).toBe(false);
    });
  });

  describe('File Name Generation', () => {
    it('should generate appropriate file names for different formats', async () => {
      const jsonTrace = testBed.createMockTrace({
        actionId: 'test_action',
        actorId: 'test_actor',
      });
      const textTrace = testBed.createMockTrace({
        actionId: 'test_action',
        actorId: 'test_actor',
        _outputFormat: 'text',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await handler.writeTrace('{"test": "json"}', jsonTrace);
      await handler.writeTrace('=== Text ===', textTrace);

      await waitForQueueProcessing(handler);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const calls = mockFetch.mock.calls;
      const jsonCall = calls.find((call) =>
        JSON.parse(call[1].body).fileName.endsWith('.json')
      );
      const textCall = calls.find((call) =>
        JSON.parse(call[1].body).fileName.endsWith('.txt')
      );

      expect(jsonCall).toBeDefined();
      expect(textCall).toBeDefined();
    });

    it('should sanitize unsafe characters in file names', async () => {
      const trace = testBed.createMockTrace({
        actionId: 'test/action:special*chars',
        actorId: 'actor<>name|unsafe',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await handler.writeTrace('{"test": "data"}', trace);
      await waitForQueueProcessing(handler);

      expect(mockFetch).toHaveBeenCalled();

      const call = mockFetch.mock.calls[0];
      const fileName = JSON.parse(call[1].body).fileName;

      // Should not contain unsafe characters
      expect(fileName).not.toMatch(/[<>:|*?"]/);
      expect(fileName).toMatch(/trace_.*\.json$/);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track batch operation statistics', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
        {
          content: '=== Test ===',
          fileName: 'test.txt',
          originalTrace: testBed.createMockTrace({ _outputFormat: 'text' }),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await handler.writeBatch(formattedTraces);

      const stats = handler.getStatistics();

      expect(stats.batchOperations).toBeDefined();
      expect(stats.batchOperations.totalBatches).toBeGreaterThan(0);
      expect(stats.batchOperations.totalBatchedTraces).toBeGreaterThan(0);
    });

    it('should calculate batch success rate correctly', async () => {
      const formattedTraces = [
        {
          content: '{"test": "json"}',
          fileName: 'test.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      // First batch succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await handler.writeBatch(formattedTraces);

      // Second batch fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await handler.writeBatch(formattedTraces);

      const stats = handler.getStatistics();

      expect(stats.batchOperations.batchSuccessRate).toBeCloseTo(50, 0);
    });

    it('should calculate average batch size', async () => {
      const smallBatch = [
        {
          content: '{"test": "json"}',
          fileName: 'test1.json',
          originalTrace: testBed.createMockTrace(),
        },
      ];

      const largeBatch = [
        {
          content: '{"test1": "json"}',
          fileName: 'test2.json',
          originalTrace: testBed.createMockTrace(),
        },
        {
          content: '{"test2": "json"}',
          fileName: 'test3.json',
          originalTrace: testBed.createMockTrace(),
        },
        {
          content: '=== Test ===',
          fileName: 'test4.txt',
          originalTrace: testBed.createMockTrace({ _outputFormat: 'text' }),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await handler.writeBatch(smallBatch);
      await handler.writeBatch(largeBatch);

      const stats = handler.getStatistics();

      expect(stats.batchOperations.avgBatchSize).toBeCloseTo(2, 0);
    });
  });

  describe('Performance Validation', () => {
    it('should handle large batch operations efficiently', async () => {
      const largeBatch = Array.from({ length: 50 }, (_, i) => ({
        content: `{"test": "json${i}"}`,
        fileName: `test${i}.json`,
        originalTrace: testBed.createMockTrace({ actionId: `action${i}` }),
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const startTime = performance.now();
      const result = await handler.writeBatch(largeBatch);
      const duration = performance.now() - startTime;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should queue individual writes efficiently', async () => {
      const traces = Array.from({ length: 10 }, (_, i) =>
        testBed.createMockTrace({ actionId: `action${i}` })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const startTime = performance.now();

      // Queue multiple traces quickly
      const promises = traces.map((trace) =>
        handler.writeTrace(`{"test": "data${trace.actionId}"}`, trace)
      );

      await Promise.all(promises);
      await waitForQueueProcessing(handler);

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(500); // Should complete efficiently
    });
  });
});
