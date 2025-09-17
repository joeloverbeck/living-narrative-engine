/**
 * @file Unit tests for ActionTraceOutputService naming conventions
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ActionTraceOutputService,
  NamingStrategy,
  TimestampFormat,
} from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockActionTraceFilter } from '../../../common/mockFactories/actionTracing.js';

// Mock dependencies to prevent side effects
jest.mock('../../../../src/actions/tracing/storageRotationManager.js', () => ({
  StorageRotationManager: jest.fn().mockImplementation(() => ({
    forceRotation: jest.fn().mockResolvedValue(undefined),
    getStatistics: jest.fn().mockResolvedValue({}),
    shutdown: jest.fn(),
  })),
}));

jest.mock('../../../../src/actions/tracing/traceQueueProcessor.js', () => ({
  TraceQueueProcessor: undefined,
}));

describe('ActionTraceOutputService - Naming Conventions', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;
  let traceIds;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();
    traceIds = [];

    // Create mock storage adapter that captures trace IDs
    mockStorageAdapter = {
      getItem: jest.fn().mockResolvedValue([]),
      setItem: jest.fn().mockImplementation((key, traces) => {
        // Capture only the new trace IDs (not previously stored ones)
        const lastTrace = traces[traces.length - 1];
        if (lastTrace && !traceIds.includes(lastTrace.id)) {
          traceIds.push(lastTrace.id);
        }
        return Promise.resolve();
      }),
      removeItem: jest.fn().mockResolvedValue(undefined),
      getAllKeys: jest.fn().mockResolvedValue([]),
      clear: jest.fn().mockResolvedValue(undefined),
      isAvailable: jest.fn().mockResolvedValue(true),
    };

    // Mock Date.now() for predictable timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1705315845123); // 2024-01-15 10:50:45.123 UTC

    // Mock performance.now() for hash generation
    jest.spyOn(performance, 'now').mockReturnValue(123456.789);

    // Mock Math.random() for hash generation
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to create service and process a trace synchronously
  /**
   *
   * @param namingOptions
   * @param trace
   */
  async function createServiceAndWriteTrace(namingOptions, trace) {
    const service = new ActionTraceOutputService({
      storageAdapter: mockStorageAdapter,
      logger: mockLogger,
      actionTraceFilter: mockActionTraceFilter,
      namingOptions,
    });

    // Write trace - this queues it
    await service.writeTrace(trace);

    // Since we're using simple queue (no TraceQueueProcessor),
    // we need to trigger processing synchronously
    // The service should have already started processing

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    return service;
  }

  describe('Timestamp-First Strategy', () => {
    it('should generate timestamp-first trace IDs with compact format', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/^20240115_105045_movement-go_[a-f0-9]{6}$/);
    });

    it('should generate timestamp-first trace IDs with unix format', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.UNIX,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        actionId: 'core:attack',
        toJSON: () => ({ actionId: 'core:attack' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/^1705315845123_core-attack_[a-f0-9]{6}$/);
    });

    it('should generate timestamp-first trace IDs with human-readable format', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.HUMAN,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        actionId: 'core:examine',
        toJSON: () => ({ actionId: 'core:examine' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(
        /^2024-01-15_10h50m45s_core-examine_[a-f0-9]{6}$/
      );
    });
  });

  describe('Action-First Strategy', () => {
    it('should generate action-first trace IDs', async () => {
      const namingOptions = {
        strategy: NamingStrategy.ACTION_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        actionId: 'core:talk',
        toJSON: () => ({ actionId: 'core:talk' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/^core-talk_20240115_105045_[a-f0-9]{6}$/);
    });
  });

  describe('Sequential Strategy', () => {
    it('should generate sequential trace IDs', async () => {
      const namingOptions = {
        strategy: NamingStrategy.SEQUENTIAL,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      };

      const service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        namingOptions,
      });

      const trace1 = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      const trace2 = {
        actionId: 'core:attack',
        toJSON: () => ({ actionId: 'core:attack' }),
      };

      await service.writeTrace(trace1);
      await service.writeTrace(trace2);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockStorageAdapter.setItem).toHaveBeenCalledTimes(2);
      expect(traceIds[0]).toBe('trace_000001_movement-go_20240115_105045');
      expect(traceIds[1]).toBe('trace_000002_core-attack_20240115_105045');
    });
  });

  describe('Action ID Sanitization', () => {
    it('should sanitize action IDs with special characters', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      };

      const testCases = [
        { input: 'core:action-name', expected: 'core-action-name' },
        { input: 'special@chars#here!', expected: 'special-chars-here-' },
        { input: 'spaces in name', expected: 'spaces-in-name' },
        { input: '.leading.dots.', expected: 'leading-dots' },
        {
          input: 'very_long_action_id_that_exceeds_maximum_length_limit',
          expected: 'very_long_action_id_that_excee',
        },
      ];

      for (const testCase of testCases) {
        traceIds = [];
        mockStorageAdapter.setItem.mockClear();
        mockStorageAdapter.getItem.mockResolvedValue([]); // Reset storage

        const trace = {
          actionId: testCase.input,
          toJSON: () => ({ actionId: testCase.input }),
        };

        await createServiceAndWriteTrace(namingOptions, trace);

        expect(mockStorageAdapter.setItem).toHaveBeenCalled();
        expect(traceIds[0]).toContain(testCase.expected);
      }
    });

    it('should handle empty or invalid action IDs', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      };

      const testCases = [null, '', undefined];

      for (const actionId of testCases) {
        traceIds = [];
        mockStorageAdapter.setItem.mockClear();
        mockStorageAdapter.getItem.mockResolvedValue([]); // Reset storage

        const trace = {
          actionId,
          toJSON: () => ({ actionId }),
        };

        await createServiceAndWriteTrace(namingOptions, trace);

        expect(mockStorageAdapter.setItem).toHaveBeenCalled();
        expect(traceIds[0]).toContain('unknown');
      }
    });
  });

  describe('Error Indication', () => {
    it('should include error indicators in trace IDs', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      };

      const errorTrace = {
        actionId: 'core:attack',
        error: true,
        toJSON: () => ({ actionId: 'core:attack', error: true }),
      };

      await createServiceAndWriteTrace(namingOptions, errorTrace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/20240115_105045_core-attack_ERROR$/);
    });

    it('should detect errors from execution property', async () => {
      const namingOptions = {
        strategy: NamingStrategy.ACTION_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      };

      const errorTrace = {
        actionId: 'core:examine',
        execution: { error: 'Something went wrong' },
        toJSON: () => ({
          actionId: 'core:examine',
          execution: { error: 'Something went wrong' },
        }),
      };

      await createServiceAndWriteTrace(namingOptions, errorTrace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/core-examine_20240115_105045_ERROR$/);
    });
  });

  describe('Hash Generation', () => {
    it('should generate browser-compatible hashes', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/[a-f0-9]{6}$/);
    });

    it('should respect configurable hash length', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 8,
      };

      const trace = {
        actionId: 'core:examine',
        toJSON: () => ({ actionId: 'core:examine' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toMatch(/[a-f0-9]{8}$/);
    });

    it('should not include hash when disabled', async () => {
      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: false,
      };

      const trace = {
        actionId: 'core:talk',
        toJSON: () => ({ actionId: 'core:talk' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      expect(traceIds[0]).toBe('20240115_105045_core-talk');
      expect(traceIds[0]).not.toMatch(/[a-f0-9]{6}$/);
    });
  });

  describe('Uniqueness Within Session', () => {
    it('should maintain uniqueness for identical traces', async () => {
      // Allow actual random values for uniqueness test
      jest.spyOn(Math, 'random').mockRestore();
      let perfCounter = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => perfCounter++);

      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 6,
      };

      const service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        namingOptions,
      });

      const trace = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      // Write same trace multiple times
      const ids = [];
      let existingTraces = [];

      for (let i = 0; i < 5; i++) {
        traceIds = [];
        mockStorageAdapter.setItem.mockClear();
        mockStorageAdapter.getItem.mockResolvedValue(existingTraces);

        await service.writeTrace(trace);
        await new Promise((resolve) => setTimeout(resolve, 10));

        if (traceIds[0]) {
          ids.push(traceIds[0]);
          // Add to existing traces for next iteration
          existingTraces.push({
            id: traceIds[0],
            timestamp: Date.now(),
            data: {},
          });
        }
      }

      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Default Configuration', () => {
    it('should use default naming options when not specified', async () => {
      const trace = {
        actionId: 'core:examine',
        toJSON: () => ({ actionId: 'core:examine' }),
      };

      // Create service without naming options
      const service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        // No namingOptions specified
      });

      await service.writeTrace(trace);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      // Should default to TIMESTAMP_FIRST with COMPACT format and hash
      expect(traceIds[0]).toMatch(/^20240115_105045_core-examine_[a-f0-9]{6}$/);
    });
  });

  describe('Structured Trace Support', () => {
    it('should handle ActionAwareStructuredTrace', async () => {
      const namingOptions = {
        strategy: NamingStrategy.ACTION_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        getTracedActions: () =>
          new Map([
            ['core:attack', { stages: {} }],
            ['core:defend', { stages: {} }],
          ]),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      // Should use first action from traced actions
      expect(traceIds[0]).toMatch(/^core-attack_20240115_105045_[a-f0-9]{6}$/);
    });
  });

  describe('Integration with Existing Storage', () => {
    it('should integrate with existing trace storage', async () => {
      const existingTraces = [
        { id: 'existing_trace_1', timestamp: Date.now() - 10000, data: {} },
        { id: 'existing_trace_2', timestamp: Date.now() - 5000, data: {} },
      ];

      mockStorageAdapter.getItem.mockResolvedValue(existingTraces);

      const namingOptions = {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.COMPACT,
        includeHash: true,
        hashLength: 6,
      };

      const trace = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      await createServiceAndWriteTrace(namingOptions, trace);

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      const storedTraces = mockStorageAdapter.setItem.mock.calls[0][1];

      // Should preserve existing traces
      expect(storedTraces.length).toBe(3);
      expect(storedTraces[0]).toEqual(existingTraces[0]);
      expect(storedTraces[1]).toEqual(existingTraces[1]);

      // New trace should have proper naming
      expect(storedTraces[2].id).toMatch(
        /^20240115_105045_movement-go_[a-f0-9]{6}$/
      );
    });
  });
});
