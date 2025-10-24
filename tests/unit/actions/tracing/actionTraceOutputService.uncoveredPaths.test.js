/**
 * @file Additional coverage tests for ActionTraceOutputService uncovered paths
 * @description Ensures legacy branches and error handling paths are exercised
 */

let mockFileOutputHandler;

jest.mock('../../../../src/actions/tracing/fileTraceOutputHandler.js', () => {
  return class MockFileTraceOutputHandler {
    constructor(deps) {
      mockFileOutputHandler = {
        initialize: jest.fn().mockResolvedValue(true),
        writeTrace: jest.fn().mockResolvedValue(true),
        setOutputDirectory: jest.fn(),
        isQueueEmpty: jest.fn().mockReturnValue(true),
        _deps: deps,
      };
      Object.assign(this, mockFileOutputHandler);
    }
  };
});

let mockTraceQueueProcessor;
jest.mock('../../../../src/actions/tracing/traceQueueProcessor.js', () => ({
  get TraceQueueProcessor() {
    return mockTraceQueueProcessor;
  },
}));

let mockStorageRotationManager;
jest.mock('../../../../src/actions/tracing/storageRotationManager.js', () => ({
  get StorageRotationManager() {
    return mockStorageRotationManager;
  },
}));

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import {
  createMockStorageAdapter,
  createMockTimerService,
} from '../../../common/mockFactories/actionTracing.js';

describe('ActionTraceOutputService uncovered paths', () => {
  let mockLogger;
  let mockStorageAdapter;
  let mockTimerService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockStorageAdapter();
    mockTimerService = createMockTimerService();
    mockTraceQueueProcessor = undefined;
    mockStorageRotationManager = undefined;
    mockFileOutputHandler = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Queue resume scheduling (line 390)', () => {
    it('should schedule queue resume when items remain after processing', async () => {
      jest.useFakeTimers();
      mockTimerService.setTimeout.mockImplementation((callback, delay) => {
        return setTimeout(callback, delay);
      });

      const service = new ActionTraceOutputService({
        logger: mockLogger,
        storageAdapter: mockStorageAdapter,
        timerService: mockTimerService,
      });

      const trace = {
        toJSON: jest.fn().mockReturnValue({ test: true }),
      };

      await service.writeTrace(trace);

      // Reset timer call tracking to focus on resume scheduling
      mockTimerService.setTimeout.mockClear();

      service.__TEST_ONLY_scheduleQueueResume();

      expect(mockTimerService.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );
    });
  });

  describe('Store trace guard (line 402)', () => {
    it('should throw when storage adapter is not available', async () => {
      const service = new ActionTraceOutputService({ logger: mockLogger });

      await expect(
        service.__TEST_ONLY_storeTrace({ toJSON: () => ({}) })
      ).rejects.toThrow('Storage adapter not available');
    });
  });

  describe('Default output handler file mode (lines 525-548)', () => {
    const buildWriteData = () => ({
      message: 'test',
      writeMetadata: {
        writeSequence: 1,
      },
    });

    const buildTrace = () => ({
      actionId: 'test:action',
      actorId: 'test-actor',
    });

    it('logs success when file output handler writes successfully', async () => {
      const service = new ActionTraceOutputService({
        logger: mockLogger,
        outputToFiles: true,
        testMode: true,
      });

      await service.__TEST_ONLY_defaultOutputHandler(
        buildWriteData(),
        buildTrace()
      );

      expect(mockFileOutputHandler.writeTrace).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'test' }),
        expect.objectContaining({ actionId: 'test:action' })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Trace written to file', {
        actionId: 'test:action',
        actorId: 'test-actor',
        writeSequence: 1,
      });
    });

    it('warns when file output handler indicates failure', async () => {
      const service = new ActionTraceOutputService({
        logger: mockLogger,
        outputToFiles: true,
        testMode: true,
      });

      mockFileOutputHandler.writeTrace.mockResolvedValueOnce(false);

      await service.__TEST_ONLY_defaultOutputHandler(
        buildWriteData(),
        buildTrace()
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'File output failed, falling back to console logging',
        expect.objectContaining({
          actionId: 'test:action',
          actorId: 'test-actor',
        })
      );
    });

    it('logs error when file output handler throws', async () => {
      const service = new ActionTraceOutputService({
        logger: mockLogger,
        outputToFiles: true,
        testMode: true,
      });

      mockFileOutputHandler.writeTrace.mockRejectedValueOnce(
        new Error('disk full')
      );

      await service.__TEST_ONLY_defaultOutputHandler(
        buildWriteData(),
        buildTrace()
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'File output error, falling back to console logging',
        expect.objectContaining({
          error: 'disk full',
          actionId: 'test:action',
          actorId: 'test-actor',
        })
      );
    });
  });

  describe('waitForFileOperations early exit (line 663)', () => {
    it('resolves immediately when no file output handler exists', async () => {
      const service = new ActionTraceOutputService({ logger: mockLogger });

      await expect(service.waitForFileOperations()).resolves.toBeUndefined();
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        'File operations may not have completed within timeout'
      );
    });
  });

  describe('Shutdown wait loop (lines 1390-1391)', () => {
    it('waits for processing to complete while queue is active', async () => {
      jest.useFakeTimers();

      // Slow storage adapter to keep processing active
      let resolveSetItem;
      mockStorageAdapter.setItem.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSetItem = resolve;
          })
      );

      const service = new ActionTraceOutputService({
        logger: mockLogger,
        storageAdapter: mockStorageAdapter,
        timerService: mockTimerService,
      });

      const trace = {
        toJSON: jest.fn().mockReturnValue({ test: true }),
      };

      const writePromise = service.writeTrace(trace);

      // Trigger queued processing and allow async handler to start
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect(typeof resolveSetItem).toBe('function');

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const shutdownPromise = service.shutdown();

      // Allow the shutdown wait loop to iterate once
      jest.advanceTimersByTime(100);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

      // Finish storage to let shutdown resolve
      if (resolveSetItem) {
        resolveSetItem();
      }

      await Promise.resolve();
      jest.runOnlyPendingTimers();

      await writePromise;
      await shutdownPromise;

      setTimeoutSpy.mockRestore();
    });
  });
});
