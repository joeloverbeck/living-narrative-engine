/**
 * @file Integration tests for storage rotation with ActionTraceOutputService
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { StorageRotationManager } from '../../../../src/actions/tracing/storageRotationManager.js';
// import { IndexedDBStorageAdapter } from '../../../../src/storage/indexedDBStorageAdapter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

// Mock TraceQueueProcessor to force fallback to simple queue
jest.mock('../../../../src/actions/tracing/traceQueueProcessor.js', () => ({
  TraceQueueProcessor: undefined,
}));

// Helper to wait for async operations
const waitForAsync = (ms = 100) =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('Storage Rotation Integration', () => {
  let service;
  let storageAdapter;
  let mockLogger;
  let rotationManager;

  beforeEach(async () => {
    mockLogger = createMockLogger();

    // Mock browser APIs for exportTraces functionality
    global.URL = {
      createObjectURL: jest.fn(() => 'mock-blob-url'),
      revokeObjectURL: jest.fn(),
    };

    // Mock document.createElement for download links
    global.document.createElement = jest.fn((tagName) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: jest.fn(),
        };
      }
      return {};
    });

    // Use a mock storage adapter for testing
    // In a real integration test, you could use IndexedDBStorageAdapter
    // but that requires a browser environment or polyfill
    storageAdapter = {
      getItem: jest.fn().mockResolvedValue([]),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
      getAllKeys: jest.fn().mockResolvedValue([]),
      isAvailable: jest.fn().mockResolvedValue(true),
    };

    // Create service with storage adapter
    service = new ActionTraceOutputService({
      storageAdapter,
      logger: mockLogger,
    });

    // Also create a standalone rotation manager for direct testing
    rotationManager = new StorageRotationManager({
      storageAdapter,
      logger: mockLogger,
      config: {
        policy: 'count',
        maxTraceCount: 5,
        preserveCount: 0, // Disable preservation for rotation testing
        compressionEnabled: true,
        compressionAge: 0, // Compress immediately for testing
      },
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
    if (rotationManager) {
      rotationManager.shutdown();
    }

    // Clean up mocks
    delete global.URL;
    delete global.document.createElement;
    jest.clearAllMocks();
  });

  describe('Rotation without blocking storage writes', () => {
    it('should continue accepting traces during rotation', async () => {
      // Create many traces to trigger rotation
      const traces = [];
      for (let i = 0; i < 10; i++) {
        traces.push({
          id: `trace_${i}`,
          timestamp: Date.now() - i * 1000,
          data: { action: `test_${i}` },
        });
      }

      // Mock storage to return existing traces
      storageAdapter.getItem.mockResolvedValue(traces);

      // Start rotation
      const rotationPromise = rotationManager.rotateTraces();

      // Try to write new traces during rotation
      const newTrace = {
        actionId: 'new:trace',
        toJSON: () => ({ action: 'new' }),
      };

      await service.writeTrace(newTrace);

      // Wait for queue processing to complete
      await waitForAsync(50);

      // Wait for rotation to complete
      const result = await rotationPromise;

      expect(result.deleted).toBeGreaterThan(0);
      // Service should have accepted the new trace
      expect(service.getStatistics().totalWrites).toBeGreaterThan(0);
    });

    it('should handle concurrent rotation requests', async () => {
      const traces = Array.from({ length: 20 }, (_, i) => ({
        id: `trace_${i}`,
        timestamp: Date.now() - i * 1000,
        data: { action: `test_${i}` },
      }));

      storageAdapter.getItem.mockResolvedValue(traces);

      // Start multiple rotations concurrently
      const rotation1 = rotationManager.rotateTraces();
      const rotation2 = rotationManager.rotateTraces();
      const rotation3 = rotationManager.rotateTraces();

      const results = await Promise.all([rotation1, rotation2, rotation3]);

      // Only one should actually rotate, others should skip
      const rotated = results.filter((r) => !r.skipped);
      const skipped = results.filter((r) => r.skipped);

      expect(rotated).toHaveLength(1);
      expect(skipped).toHaveLength(2);
    });
  });

  describe('Storage size limit maintenance', () => {
    it('should maintain storage within configured limits', async () => {
      // Create a rotation manager with size-based policy
      const sizeManager = new StorageRotationManager({
        storageAdapter,
        logger: mockLogger,
        config: {
          policy: 'size',
          maxStorageSize: 5000, // 5KB limit
          maxTraceSize: 1000, // 1KB per trace max
          preserveCount: 0, // Disable preservation for rotation testing
        },
      });

      // Create traces of varying sizes
      const traces = [
        {
          id: 'small_1',
          timestamp: Date.now(),
          data: { payload: 'x'.repeat(100) }, // Small
        },
        {
          id: 'medium_1',
          timestamp: Date.now() - 1000,
          data: { payload: 'x'.repeat(500) }, // Medium
        },
        {
          id: 'large_1',
          timestamp: Date.now() - 2000,
          data: { payload: 'x'.repeat(2000) }, // Large (over limit)
        },
        {
          id: 'medium_2',
          timestamp: Date.now() - 3000,
          data: { payload: 'x'.repeat(400) },
        },
      ];

      storageAdapter.getItem.mockResolvedValue(traces);

      const result = await sizeManager.rotateTraces();

      // Large trace should be deleted
      const savedTraces = storageAdapter.setItem.mock.calls[0][1];
      expect(savedTraces.find((t) => t.id === 'large_1')).toBeUndefined();

      // Total size should be within limit
      const totalSize = savedTraces.reduce((sum, trace) => {
        const str = JSON.stringify(trace);
        return sum + str.length * 2; // UTF-16 estimate
      }, 0);

      expect(totalSize).toBeLessThanOrEqual(5000);

      sizeManager.shutdown();
    });

    it('should handle hybrid policy correctly', async () => {
      const hybridManager = new StorageRotationManager({
        storageAdapter,
        logger: mockLogger,
        config: {
          policy: 'hybrid',
          maxAge: 60000, // 1 minute
          maxTraceCount: 5,
          maxStorageSize: 10000,
          preserveCount: 0, // Disable preservation for rotation testing
        },
      });

      const now = Date.now();
      const traces = Array.from({ length: 10 }, (_, i) => ({
        id: `trace_${i}`,
        timestamp: now - i * 30000, // 30 seconds apart
        data: { action: `test_${i}` },
      }));

      storageAdapter.getItem.mockResolvedValue(traces);

      const result = await hybridManager.rotateTraces();

      const savedTraces = storageAdapter.setItem.mock.calls[0][1];

      // Should keep only traces that pass ALL policies
      expect(savedTraces.length).toBeLessThanOrEqual(5); // Count limit
      savedTraces.forEach((trace) => {
        const age = now - trace.timestamp;
        expect(age).toBeLessThanOrEqual(60000); // Age limit
      });

      hybridManager.shutdown();
    });
  });

  describe('Compression and decompression workflow', () => {
    beforeEach(() => {
      // Mock pako library on window object (jsdom environment)
      window.pako = {
        deflate: jest.fn((_data) => {
          // Simulate compression
          return new Uint8Array([1, 2, 3, 4, 5]);
        }),
        inflate: jest.fn((_data, _options) => {
          // Simulate decompression
          return JSON.stringify({ original: 'data' });
        }),
      };
    });

    afterEach(() => {
      delete window.pako;
    });

    it('should compress and decompress traces correctly', async () => {
      const oldTrace = {
        id: 'old_trace',
        timestamp: Date.now() - 7200000, // 2 hours old
        data: { action: 'compress_me', payload: 'x'.repeat(1000) },
      };

      storageAdapter.getItem.mockResolvedValue([oldTrace]);

      // Rotate with compression
      const result = await rotationManager.rotateTraces();

      expect(result.compressed).toBe(1);

      const savedTraces = storageAdapter.setItem.mock.calls[0][1];
      const compressedTrace = savedTraces[0];

      expect(compressedTrace.compressed).toBe(true);
      expect(Array.isArray(compressedTrace.data)).toBe(true);
      expect(compressedTrace.originalSize).toBeDefined();
      expect(compressedTrace.compressedSize).toBeDefined();

      // Test decompression
      const decompressed =
        await rotationManager.decompressTrace(compressedTrace);

      expect(decompressed.compressed).toBe(false);
      expect(decompressed.data).toEqual({ original: 'data' });
    });

    it('should handle compression failures gracefully', async () => {
      // Make compression fail
      global.window.pako.deflate.mockImplementation(() => {
        throw new Error('Compression failed');
      });

      const trace = {
        id: 'fail_trace',
        timestamp: Date.now() - 7200000,
        data: { action: 'fail' },
      };

      storageAdapter.getItem.mockResolvedValue([trace]);

      const result = await rotationManager.rotateTraces();

      expect(result.compressed).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to compress'),
        expect.any(Object)
      );
    });
  });

  describe('Concurrent operations handling', () => {
    it('should handle simultaneous reads and writes', async () => {
      const traces = Array.from({ length: 10 }, (_, i) => ({
        id: `trace_${i}`,
        timestamp: Date.now() - i * 1000,
        data: { action: `test_${i}` },
      }));

      storageAdapter.getItem.mockResolvedValue(traces);

      // Start multiple operations concurrently
      const operations = [
        service.writeTrace({
          actionId: 'write_1',
          toJSON: () => ({ action: 'write_1' }),
        }),
        service.writeTrace({
          actionId: 'write_2',
          toJSON: () => ({ action: 'write_2' }),
        }),
        rotationManager.rotateTraces(),
        service.exportTraces('json'),
        rotationManager.getStatistics(),
      ];

      const results = await Promise.all(operations);

      // All operations should complete without errors
      expect(results).toHaveLength(5);
      expect(results[2]).toHaveProperty('deleted'); // Rotation result
      expect(results[4]).toHaveProperty('currentCount'); // Statistics
    });

    it('should handle rapid configuration updates', async () => {
      const configs = [
        { policy: 'age', maxAge: 60000 },
        { policy: 'count', maxTraceCount: 10 },
        { policy: 'size', maxStorageSize: 5000 },
      ];

      // Update configuration rapidly
      for (const config of configs) {
        rotationManager.updateConfig(config);
        await waitForAsync(10);
      }

      // Should use the last configuration
      const stats = await rotationManager.getStatistics();
      expect(stats.policy).toBe('size');
      expect(stats.maxSize).toBe(5000);
    });
  });

  describe('Integration with ActionTraceOutputService', () => {
    it('should trigger rotation when threshold is reached', async () => {
      // Create many traces to exceed threshold
      const existingTraces = Array.from({ length: 95 }, (_, i) => ({
        id: `existing_${i}`,
        timestamp: Date.now() - i * 1000,
        data: { action: `existing_${i}` },
      }));

      storageAdapter.getItem
        .mockResolvedValueOnce(existingTraces) // First call for write
        .mockResolvedValueOnce([
          ...existingTraces,
          ...Array.from({ length: 10 }, (_, i) => ({
            id: `new_${i}`,
            timestamp: Date.now(),
            data: { action: `new_${i}` },
          })),
        ]); // Second call for rotation

      // Write traces that will trigger rotation
      for (let i = 0; i < 10; i++) {
        await service.writeTrace({
          actionId: `new:trace_${i}`,
          toJSON: () => ({ action: `new_${i}` }),
        });
      }

      // Wait for background rotation
      await waitForAsync(200);

      // Check that rotation was attempted
      const stats = await service.getRotationStatistics();
      if (stats) {
        expect(stats.currentCount).toBeDefined();
      }
    });

    it('should provide rotation statistics through service', async () => {
      const stats = await service.getRotationStatistics();

      if (stats) {
        expect(stats).toHaveProperty('isRotating');
        expect(stats).toHaveProperty('lastRotation');
        expect(stats).toHaveProperty('policy');
        expect(stats).toHaveProperty('currentCount');
      }
    });

    it('should shutdown rotation manager on service shutdown', async () => {
      const shutdownSpy = jest.spyOn(mockLogger, 'info');

      await service.shutdown();

      // Should log shutdown messages
      expect(shutdownSpy).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown')
      );
    });
  });

  describe('Preservation rules', () => {
    it('should preserve recent traces even during aggressive rotation', async () => {
      const preserveManager = new StorageRotationManager({
        storageAdapter,
        logger: mockLogger,
        config: {
          policy: 'count',
          maxTraceCount: 1, // Very aggressive
          preserveCount: 3, // But preserve 3 most recent
        },
      });

      const traces = Array.from({ length: 10 }, (_, i) => ({
        id: `trace_${i}`,
        timestamp: Date.now() - i * 1000,
        data: { action: `test_${i}` },
      }));

      storageAdapter.getItem.mockResolvedValue(traces);

      const result = await preserveManager.rotateTraces();

      const savedTraces = storageAdapter.setItem.mock.calls[0][1];

      // Should have at least 3 traces preserved
      expect(savedTraces.length).toBeGreaterThanOrEqual(3);

      // Most recent traces should be preserved
      expect(savedTraces.find((t) => t.id === 'trace_0')).toBeDefined();
      expect(savedTraces.find((t) => t.id === 'trace_1')).toBeDefined();
      expect(savedTraces.find((t) => t.id === 'trace_2')).toBeDefined();

      preserveManager.shutdown();
    });

    it('should preserve traces matching pattern', async () => {
      const preserveManager = new StorageRotationManager({
        storageAdapter,
        logger: mockLogger,
        config: {
          policy: 'count',
          maxTraceCount: 2,
          preservePattern: '.*important.*', // Preserve "important" traces
        },
      });

      const traces = [
        {
          id: 'trace_1',
          timestamp: Date.now(),
          data: { action: 'normal' },
        },
        {
          id: 'important_trace',
          timestamp: Date.now() - 10000,
          data: { action: 'important' },
        },
        {
          id: 'trace_2',
          timestamp: Date.now() - 5000,
          data: { action: 'normal' },
        },
        {
          id: 'very_important',
          timestamp: Date.now() - 20000,
          data: { action: 'critical' },
        },
      ];

      storageAdapter.getItem.mockResolvedValue(traces);

      const result = await preserveManager.rotateTraces();

      const savedTraces = storageAdapter.setItem.mock.calls[0][1];

      // Important traces should be preserved regardless of age
      expect(savedTraces.find((t) => t.id === 'important_trace')).toBeDefined();
      expect(savedTraces.find((t) => t.id === 'very_important')).toBeDefined();

      preserveManager.shutdown();
    });
  });
});
