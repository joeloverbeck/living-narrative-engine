/**
 * @file Additional coverage tests for FileTraceOutputHandler
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

describe('FileTraceOutputHandler uncovered branches', () => {
  let originalWindow;
  let originalDocument;
  let originalFetch;
  let originalURL;
  let originalBlob;
  let mockLogger;

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    originalFetch = global.fetch;
    originalURL = global.URL;
    originalBlob = global.Blob;

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockFetch = jest.fn();

    global.window = {
      fetch: mockFetch,
      showDirectoryPicker: jest.fn(),
    };
    global.fetch = mockFetch;
    global.document = {
      createElement: jest.fn(() => ({
        style: {},
        click: jest.fn(),
        href: '',
        download: '',
      })),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      },
    };
    global.URL = {
      createObjectURL: jest.fn(() => 'blob:mock'),
      revokeObjectURL: jest.fn(),
    };
    global.Blob = jest.fn();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
    global.URL = originalURL;
    global.Blob = originalBlob;
    jest.clearAllMocks();
  });

  const waitForMicrotaskQueue = (delay = 10) =>
    new Promise((resolve) => setTimeout(resolve, delay));

  it('logs and returns false when initialization throws', async () => {
    const throwingLogger = {
      ...mockLogger,
      info: jest.fn(() => {
        throw new Error('info failure');
      }),
    };

    const handler = new FileTraceOutputHandler({
      logger: throwingLogger,
    });

    const result = await handler.initialize();

    expect(result).toBe(false);
    expect(throwingLogger.error).toHaveBeenCalledWith(
      'Failed to initialize FileTraceOutputHandler',
      expect.any(Error)
    );
  });

  it('captures errors thrown while processing a batch', async () => {
    const handler = new FileTraceOutputHandler({
      logger: mockLogger,
      batchWriter: () => {
        throw new Error('batch failure');
      },
    });

    const result = await handler.writeBatch([
      {
        content: 'trace content',
        originalTrace: { actionId: 'action-1', actorId: 'actor-1' },
      },
    ]);

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to write trace batch',
      expect.objectContaining({
        error: 'batch failure',
        batchSize: 1,
      })
    );
  });

  it('reports queue emptiness via isQueueEmpty()', () => {
    const handler = new FileTraceOutputHandler({ logger: mockLogger });
    expect(handler.isQueueEmpty()).toBe(true);
  });

  it('prevents queue processing when the queue reports no items', async () => {
    const guardQueue = {
      push: jest.fn(),
      shift: jest.fn(() => {
        throw new Error('shift should not be called');
      }),
    };
    Object.defineProperty(guardQueue, 'length', {
      get: () => 0,
      configurable: true,
    });

    const handler = new FileTraceOutputHandler({
      logger: mockLogger,
      queueImplementation: guardQueue,
    });

    await handler.writeTrace({ some: 'data' }, { actionId: 'a', actorId: 'b' });
    await waitForMicrotaskQueue();

    expect(guardQueue.push).toHaveBeenCalled();
    expect(guardQueue.shift).not.toHaveBeenCalled();
    expect(handler.isQueueEmpty()).toBe(true);
  });

  it('logs queue processing errors when the queue fails during shift', async () => {
    const failingQueue = {
      _length: 0,
      push: jest.fn(function push(item) {
        this._length = 1;
        this._stored = item;
      }),
      shift: jest.fn(function shift() {
        this._length = 0;
        throw new Error('queue failure');
      }),
    };
    Object.defineProperty(failingQueue, 'length', {
      get() {
        return this._length;
      },
      configurable: true,
    });

    const handler = new FileTraceOutputHandler({
      logger: mockLogger,
      queueImplementation: failingQueue,
    });

    await handler.writeTrace({ some: 'data' }, { actionId: 'q', actorId: 'w' });
    await waitForMicrotaskQueue();

    expect(failingQueue.push).toHaveBeenCalled();
    expect(failingQueue.shift).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing trace queue',
      expect.any(Error)
    );
  });

  it('validates custom queue implementations for required properties', () => {
    expect(() => {
      new FileTraceOutputHandler({
        logger: mockLogger,
        queueImplementation: {
          push: jest.fn(),
          shift: jest.fn(),
        },
      });
    }).toThrow(
      "Invalid trace queue implementation: missing required 'length' property."
    );
  });

  it('validates custom queue implementations for numeric length', () => {
    const queueImplementation = {
      push: jest.fn(),
      shift: jest.fn(),
    };
    Object.defineProperty(queueImplementation, 'length', {
      value: Number.NaN,
      configurable: true,
    });

    expect(() => {
      new FileTraceOutputHandler({
        logger: mockLogger,
        queueImplementation,
      });
    }).toThrow(
      "Invalid trace queue implementation: 'length' property must resolve to a number."
    );
  });

  it('logs failures encountered during file writing', async () => {
    const problematicTrace = {
      actorId: 'actor-problem',
      actionId: 'problem-action',
    };

    const circularTraceData = {};
    circularTraceData.self = circularTraceData;

    const handler = new FileTraceOutputHandler({ logger: mockLogger });

    await handler.writeTrace(circularTraceData, problematicTrace);
    await waitForMicrotaskQueue();

    const errorCalls = mockLogger.error.mock.calls;
    const hasWriteFailureLog = errorCalls.some(
      ([message, details]) =>
        message === 'Failed to write trace to file' &&
        typeof details?.error === 'string' &&
        details.error.length > 0 &&
        details?.actorId === 'actor-problem'
    );

    expect(hasWriteFailureLog).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('short-circuits server writes while in test mode', async () => {
    const handler = new FileTraceOutputHandler({
      logger: mockLogger,
      testMode: true,
    });

    const result = await handler.writeTrace(
      { trace: 'test' },
      { actionId: 'test', actorId: 'actor' }
    );
    await waitForMicrotaskQueue();

    expect(result).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'FileTraceOutputHandler: Skipping server endpoint in test mode'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns false for batch writes when no browser environment is available', async () => {
    global.window = undefined;
    global.fetch = undefined;

    const handler = new FileTraceOutputHandler({ logger: mockLogger });

    const result = await handler.writeBatch([
      { content: 'trace', originalTrace: { actionId: 'a', actorId: 'b' } },
    ]);

    expect(result).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('logs File System API failures before falling back to downloads', async () => {
    const mockWritableError = new Error('write failed');
    const failingDirectoryHandle = {
      getFileHandle: jest.fn(() => {
        throw mockWritableError;
      }),
    };

    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => failingDirectoryHandle),
      ensureSubdirectoryExists: jest.fn(async () => failingDirectoryHandle),
    };

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const handler = new FileTraceOutputHandler({
      logger: mockLogger,
      traceDirectoryManager,
    });

    await handler.writeTrace(
      { payload: 'fs-error' },
      { actionId: 'fs-action', actorId: 'fs-actor' }
    );
    await waitForMicrotaskQueue();

    expect(traceDirectoryManager.selectDirectory).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'File System API write failed, will use download fallback',
      'write failed'
    );
  });
});
