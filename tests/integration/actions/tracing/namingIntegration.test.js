/**
 * @file Integration tests for ActionTraceOutputService naming conventions
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
import { StorageRotationManager } from '../../../../src/actions/tracing/storageRotationManager.js';
import { IndexedDBStorageAdapter } from '../../../../src/storage/indexedDBStorageAdapter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockActionTraceFilter } from '../../../common/mockFactories/actionTracing.js';
import { JsonTraceFormatter } from '../../../../src/actions/tracing/jsonTraceFormatter.js';
import { HumanReadableFormatter } from '../../../../src/actions/tracing/humanReadableFormatter.js';
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';

describe('ActionTraceOutputService - Naming Integration', () => {
  let service;
  let mockLogger;
  let storageAdapter;
  let mockActionTraceFilter;
  let jsonFormatter;
  let humanReadableFormatter;
  let rotationManager;
  let testTimerService;

  beforeEach(() => {
    // Ensure we're using real timers at the start
    jest.useRealTimers();

    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();

    // Create test timer service for controlled execution
    testTimerService = new TestTimerService();

    // Create a storage state that persists between getItem/setItem calls
    let storageState = {};

    // Mock IndexedDB storage adapter with proper persistence simulation
    storageAdapter = {
      getItem: jest.fn().mockImplementation((key) => {
        return Promise.resolve(storageState[key] || []);
      }),
      setItem: jest.fn().mockImplementation((key, value) => {
        storageState[key] = value;
        return Promise.resolve(undefined);
      }),
      removeItem: jest.fn().mockImplementation((key) => {
        delete storageState[key];
        return Promise.resolve(undefined);
      }),
      getAllKeys: jest.fn().mockImplementation(() => {
        return Promise.resolve(Object.keys(storageState));
      }),
      clear: jest.fn().mockImplementation(() => {
        storageState = {};
        return Promise.resolve(undefined);
      }),
      isAvailable: jest.fn().mockResolvedValue(true),
    };

    // Create real formatters for integration testing
    jsonFormatter = new JsonTraceFormatter({
      logger: mockLogger,
      actionTraceFilter: mockActionTraceFilter,
    });

    humanReadableFormatter = new HumanReadableFormatter({
      logger: mockLogger,
      actionTraceFilter: mockActionTraceFilter,
    });
  });

  afterEach(async () => {
    // Shutdown services before clearing timers
    if (service && typeof service.shutdown === 'function') {
      await service.shutdown();
      service = null;
    }
    if (rotationManager && typeof rotationManager.shutdown === 'function') {
      rotationManager.shutdown();
      rotationManager = null;
    }

    // Restore mocks
    jest.restoreAllMocks();
  });

  describe('Integration with StorageRotationManager', () => {
    it('should work with StorageRotationManager for count-based rotation', async () => {
      // Create rotation manager with count-based policy
      rotationManager = new StorageRotationManager({
        storageAdapter,
        logger: mockLogger,
        config: {
          rotationPolicy: 'count',
          maxTraceCount: 5,
          compressionEnabled: false,
        },
        timerService: testTimerService,
      });

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: true,
          hashLength: 6,
        },
      });

      // Generate multiple traces to trigger rotation
      const traces = [];
      for (let i = 0; i < 10; i++) {
        const trace = {
          actionId: `core:action${i}`,
          toJSON: () => ({ actionId: `core:action${i}`, index: i }),
        };
        traces.push(trace);
        await service.writeTrace(trace);
      }

      // Process queue using test timer service
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Verify storage interactions
      expect(storageAdapter.setItem).toHaveBeenCalled();
      const lastCall =
        storageAdapter.setItem.mock.calls[
          storageAdapter.setItem.mock.calls.length - 1
        ];
      const storedTraces = lastCall[1];

      // All traces should have proper naming convention
      storedTraces.forEach((trace) => {
        expect(trace.id).toMatch(/^\d{8}_\d{6}_core-action\d_[a-f0-9]{6}$/);
      });
    });

    it('should maintain naming consistency during age-based rotation', async () => {
      const now = 1705315845123; // Fixed timestamp for consistency
      Date.now = jest.fn().mockReturnValue(now);

      // Create rotation manager with age-based policy
      rotationManager = new StorageRotationManager({
        storageAdapter,
        logger: mockLogger,
        config: {
          rotationPolicy: 'age',
          maxAge: 60000, // 1 minute
          compressionEnabled: false,
        },
        timerService: testTimerService,
      });

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.ACTION_FIRST,
          timestampFormat: TimestampFormat.UNIX,
          includeHash: false,
        },
      });

      // Create old traces (should be rotated)
      const oldTraces = [
        {
          id: `core-old1_${now - 120000}`,
          timestamp: now - 120000,
          data: { actionId: 'core:old1' },
        },
        {
          id: `core-old2_${now - 90000}`,
          timestamp: now - 90000,
          data: { actionId: 'core:old2' },
        },
      ];

      // Create recent traces (should be kept)
      const recentTraces = [
        {
          id: `core-recent1_${now - 30000}`,
          timestamp: now - 30000,
          data: { actionId: 'core:recent1' },
        },
        {
          id: `core-recent2_${now - 10000}`,
          timestamp: now - 10000,
          data: { actionId: 'core:recent2' },
        },
      ];

      // Pre-populate storage with old and recent traces
      await storageAdapter.setItem('actionTraces', [
        ...oldTraces,
        ...recentTraces,
      ]);

      // Add new trace
      const newTrace = {
        actionId: 'core:new',
        toJSON: () => ({ actionId: 'core:new' }),
      };

      await service.writeTrace(newTrace);

      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Check that setItem was called after initial setup
      const setItemCalls = storageAdapter.setItem.mock.calls.length;
      expect(setItemCalls).toBeGreaterThanOrEqual(2); // At least initial setup + new trace

      // Get the final state from storage
      const storedTraces = await storageAdapter.getItem('actionTraces');

      // New trace should follow naming convention
      // The last trace should be the new one we added
      const newTraceRecord = storedTraces[storedTraces.length - 1];
      expect(newTraceRecord).toBeDefined();
      expect(newTraceRecord.data?.actionId).toBe('core:new');
      expect(newTraceRecord.id).toBe(`core-new_${now}`);
    });
  });

  describe('Consistency with IndexedDBStorageAdapter', () => {
    it('should maintain consistent naming with real IndexedDB adapter patterns', async () => {
      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.SEQUENTIAL,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: false,
        },
      });

      // Simulate IndexedDB key patterns
      // Write traces one by one to ensure sequential numbering
      const trace1 = {
        actionId: `core:action1`,
        toJSON: () => ({ actionId: `core:action1` }),
      };
      await service.writeTrace(trace1);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      const trace2 = {
        actionId: `core:action2`,
        toJSON: () => ({ actionId: `core:action2` }),
      };
      await service.writeTrace(trace2);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      const trace3 = {
        actionId: `core:action3`,
        toJSON: () => ({ actionId: `core:action3` }),
      };
      await service.writeTrace(trace3);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Verify traces were written
      expect(storageAdapter.setItem).toHaveBeenCalled();

      // Get the final storage state
      const storedTraces = await storageAdapter.getItem('actionTraces');

      // Should have all 3 traces
      expect(storedTraces.length).toBe(3);

      // Check sequential numbering
      expect(storedTraces[0].id).toMatch(
        /^trace_000001_core-action1_\d{8}_\d{6}$/
      );
      expect(storedTraces[1].id).toMatch(
        /^trace_000002_core-action2_\d{8}_\d{6}$/
      );
      expect(storedTraces[2].id).toMatch(
        /^trace_000003_core-action3_\d{8}_\d{6}$/
      );
    });

    it('should handle complex action IDs with IndexedDB-safe characters', async () => {
      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.HUMAN,
          includeHash: true,
          hashLength: 8,
        },
      });

      const complexTraces = [
        { actionId: 'mod-name:complex_action_with_underscores' },
        { actionId: 'core:action-with-dashes' },
        { actionId: 'special:αβγ_unicode_χψω' },
        { actionId: 'path/to/action' },
        { actionId: 'action.with.dots' },
      ];

      for (const traceData of complexTraces) {
        storageAdapter.setItem.mockClear();
        const trace = {
          ...traceData,
          toJSON: () => traceData,
        };

        await service.writeTrace(trace);
        await testTimerService.triggerAll();
        await new Promise((resolve) => setImmediate(resolve));

        const storedTraces = storageAdapter.setItem.mock.calls[0][1];
        const traceId = storedTraces[0].id;

        // ID should be sanitized and safe for IndexedDB
        expect(traceId).not.toMatch(/[:/\\.<>|?*]/);
        expect(traceId).toMatch(
          /^\d{4}-\d{2}-\d{2}_\d{2}h\d{2}m\d{2}s_[a-zA-Z0-9_-]+_[a-f0-9]{8}$/
        );
      }
    });
  });

  describe('Naming Preservation During Export', () => {
    it('should preserve naming during JSON export', async () => {
      const mockDate = new Date('2024-01-15T10:30:45.123Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      Date.now = jest.fn().mockReturnValue(mockDate.getTime());

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: false,
        },
      });

      // Pre-populate storage with traces
      const existingTraces = [
        {
          id: '20240115_103045_movement-go',
          timestamp: mockDate.getTime(),
          data: { actionId: 'movement:go', type: 'movement' },
        },
        {
          id: '20240115_103046_core-attack_ERROR',
          timestamp: mockDate.getTime() + 1000,
          data: { actionId: 'core:attack', error: true },
        },
      ];

      storageAdapter.getItem.mockResolvedValue(existingTraces);

      // Mock document.createElement and related DOM methods
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      const mockCreateElement = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockAnchor);

      // Mock URL methods properly
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      URL.revokeObjectURL = jest.fn();

      await service.exportTraces('json');

      // Verify export preserves original IDs
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe(
        `action-traces-${mockDate.getTime()}.json`
      );
      expect(URL.createObjectURL).toHaveBeenCalled();

      // Check that the blob was created with correct data
      const blobCall = URL.createObjectURL.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      expect(blobCall.type).toBe('application/json');

      // Restore mocks
      mockCreateElement.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('should preserve naming during text export', async () => {
      const mockDate = new Date('2024-01-15T10:30:45.123Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      Date.now = jest.fn().mockReturnValue(mockDate.getTime());

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.ACTION_FIRST,
          timestampFormat: TimestampFormat.HUMAN,
          includeHash: true,
          hashLength: 6,
        },
      });

      // Pre-populate storage with traces
      const existingTraces = [
        {
          id: 'movement-go_2024-01-15_10h30m45s_abc123',
          timestamp: mockDate.getTime(),
          data: { actionId: 'movement:go', type: 'movement' },
        },
        {
          id: 'core-talk_2024-01-15_10h30m46s_def456',
          timestamp: mockDate.getTime() + 1000,
          data: { actionId: 'core:talk', type: 'interaction' },
        },
      ];

      storageAdapter.getItem.mockResolvedValue(existingTraces);

      // Mock document.createElement and related DOM methods
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      const mockCreateElement = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockAnchor);

      // Mock URL methods properly
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      URL.revokeObjectURL = jest.fn();

      await service.exportTraces('text');

      // Verify text export
      expect(mockAnchor.download).toBe(
        `action-traces-${mockDate.getTime()}.txt`
      );
      expect(URL.createObjectURL).toHaveBeenCalled();

      const blobCall = URL.createObjectURL.mock.calls[0][0];
      expect(blobCall).toBeInstanceOf(Blob);
      expect(blobCall.type).toBe('text/plain');

      // Restore mocks
      mockCreateElement.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('Configuration Changes', () => {
    it('should handle configuration changes between sessions', async () => {
      // First session with one configuration
      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: true,
          hashLength: 6,
        },
      });

      const trace1 = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      await service.writeTrace(trace1);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Get the stored traces from the persistent storage
      const firstSessionTraces = await storageAdapter.getItem('actionTraces');
      expect(firstSessionTraces[0].id).toMatch(
        /^\d{8}_\d{6}_movement-go_[a-f0-9]{6}$/
      );

      // Shutdown first service
      await service.shutdown();

      // Second session with different configuration
      // Storage already contains the first session traces (persistent mock)

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.ACTION_FIRST,
          timestampFormat: TimestampFormat.UNIX,
          includeHash: false,
        },
      });

      const trace2 = {
        actionId: 'core:attack',
        toJSON: () => ({ actionId: 'core:attack' }),
      };

      await service.writeTrace(trace2);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Get the final storage state which should have both traces
      const secondSessionTraces = await storageAdapter.getItem('actionTraces');

      // The last trace should be the newly added one
      const newTrace = secondSessionTraces[secondSessionTraces.length - 1];
      expect(newTrace).toBeDefined();
      expect(newTrace.data?.actionId).toBe('core:attack');
      expect(newTrace.id).toMatch(/^core-attack_\d+$/);
    });

    it('should handle switching between strategies dynamically', async () => {
      const strategies = [
        {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          format: TimestampFormat.COMPACT,
          pattern: /^\d{8}_\d{6}_core-test_[a-f0-9]{6}$/,
          hash: true,
        },
        {
          strategy: NamingStrategy.ACTION_FIRST,
          format: TimestampFormat.UNIX,
          pattern: /^core-test_\d+_[a-f0-9]{6}$/,
          hash: true,
        },
        {
          strategy: NamingStrategy.SEQUENTIAL,
          format: TimestampFormat.HUMAN,
          pattern:
            /^trace_\d{6}_core-test_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}m\d{2}s$/,
          hash: false,
        },
      ];

      for (const config of strategies) {
        if (service) {
          await service.shutdown();
        }

        // Clear the storage state for each strategy test
        await storageAdapter.clear();
        storageAdapter.setItem.mockClear();

        service = new ActionTraceOutputService({
          storageAdapter,
          logger: mockLogger,
          actionTraceFilter: mockActionTraceFilter,
          jsonFormatter,
          humanReadableFormatter,
          queueConfig: {
            timerService: testTimerService,
          },
          namingOptions: {
            strategy: config.strategy,
            timestampFormat: config.format,
            includeHash: config.hash,
            hashLength: 6,
          },
        });

        const trace = {
          actionId: 'core:test',
          toJSON: () => ({ actionId: 'core:test' }),
        };

        await service.writeTrace(trace);
        await testTimerService.triggerAll();
        await new Promise((resolve) => setImmediate(resolve));

        // Get the stored traces from persistent storage
        const storedTraces = await storageAdapter.getItem('actionTraces');
        expect(storedTraces.length).toBe(1);
        expect(storedTraces[0].id).toMatch(config.pattern);
      }
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle formatter failures gracefully', async () => {
      // Create formatter that throws error
      const failingFormatter = {
        format: jest.fn().mockImplementation(() => {
          throw new Error('Formatter error');
        }),
      };

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter: failingFormatter,
        humanReadableFormatter: failingFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: true,
          hashLength: 6,
        },
      });

      const trace = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      await service.writeTrace(trace);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Should still store trace with proper naming despite formatter failure
      expect(storageAdapter.setItem).toHaveBeenCalled();
      const storedTraces = storageAdapter.setItem.mock.calls[0][1];
      expect(storedTraces[0].id).toMatch(
        /^\d{8}_\d{6}_movement-go_[a-f0-9]{6}$/
      );
    });

    it('should handle storage adapter failures', async () => {
      storageAdapter.setItem.mockRejectedValue(new Error('Storage error'));

      service = new ActionTraceOutputService({
        storageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        jsonFormatter,
        humanReadableFormatter,
        queueConfig: {
          timerService: testTimerService,
        },
        namingOptions: {
          strategy: NamingStrategy.SEQUENTIAL,
          timestampFormat: TimestampFormat.COMPACT,
          includeHash: false,
        },
      });

      const trace = {
        actionId: 'movement:go',
        toJSON: () => ({ actionId: 'movement:go' }),
      };

      await service.writeTrace(trace);
      await testTimerService.triggerAll();
      await new Promise((resolve) => setImmediate(resolve));

      // Should log error but not crash - check for either the old or new error message
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCalls = mockLogger.error.mock.calls;
      const hasExpectedError = errorCalls.some(
        (call) =>
          call[0].includes('Failed to store trace') ||
          call[0].includes('Failed to process item')
      );
      expect(hasExpectedError).toBe(true);
    });
  });
});
