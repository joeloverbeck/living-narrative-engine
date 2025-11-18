/**
 * @file Integration tests for FileTraceOutputHandler covering real network and filesystem flows
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import FileTraceOutputHandler from '../../../../src/actions/tracing/fileTraceOutputHandler.js';
import {
  getEndpointConfig,
  resetEndpointConfig,
} from '../../../../src/config/endpointConfig.js';
import { createTestBed } from '../../../common/testBed.js';
import {
  createTempDirectory,
  cleanupTempDirectory,
} from '../../../common/mockFactories/actionTracingExtended.js';

/**
 * Helper to wait for the handler queue to drain before assertions
 *
 * @param {FileTraceOutputHandler} handler - Handler instance
 * @param {number} [timeout] - Maximum wait time in milliseconds
 */
async function waitForQueueToDrain(handler, timeout = 1000) {
  const start = Date.now();
  while (!handler.isQueueEmpty() && Date.now() - start < timeout) {
     
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  await new Promise((resolve) => setTimeout(resolve, 25));
}

class InMemoryDirectoryHandle {
  constructor(name = 'root') {
    this.name = name;
    this.directories = new Map();
    this.fileContents = new Map();
  }

  async getDirectoryHandle(name, options = {}) {
    if (!this.directories.has(name)) {
      if (!options.create) {
        throw new Error('Directory does not exist');
      }
      this.directories.set(name, new InMemoryDirectoryHandle(name));
    }
    return this.directories.get(name);
  }

  async getFileHandle(fileName, options = {}) {
    if (!this.fileContents.has(fileName) && !options.create) {
      throw new Error('File does not exist');
    }
    const fileContents = this.fileContents;
    return {
      async createWritable() {
        return {
          async write(content) {
            fileContents.set(fileName, content);
          },
          async close() {},
        };
      },
    };
  }

  getFileNames() {
    return Array.from(this.fileContents.keys());
  }

  getFileContent(fileName) {
    return this.fileContents.get(fileName);
  }

  getDirectory(name) {
    return this.directories.get(name);
  }
}

describe('FileTraceOutputHandler integration', () => {
  let testBed;
  let tempDirectory;
  let originalEnv;
  let originalWindowFetch;

  beforeEach(async () => {
    testBed = createTestBed();
    tempDirectory = await createTempDirectory('file-trace-handler');

    originalEnv = {
      PROXY_HOST: process.env.PROXY_HOST,
      PROXY_PORT: process.env.PROXY_PORT,
      PROXY_USE_HTTPS: process.env.PROXY_USE_HTTPS,
    };

    originalWindowFetch = global.window?.fetch;
    if (global.window) {
      global.window.fetch = (...args) => global.fetch(...args);
    }
  });

  afterEach(async () => {
    await cleanupTempDirectory(tempDirectory);

    process.env.PROXY_HOST = originalEnv.PROXY_HOST;
    process.env.PROXY_PORT = originalEnv.PROXY_PORT;
    process.env.PROXY_USE_HTTPS = originalEnv.PROXY_USE_HTTPS;
    resetEndpointConfig();

    if (global.window) {
      global.window.fetch = originalWindowFetch;
    }
  });

  it('writes traces through the live server endpoint and records statistics', async () => {
    const fetchMock = jest.fn().mockImplementation(async (url, options) => {
      if (!options?.body) {
        throw new Error('Missing request body');
      }

      const requestBody = JSON.parse(options.body);
      const filePath = path.join(tempDirectory, requestBody.fileName);
      await fs.writeFile(filePath, requestBody.traceData, 'utf-8');

      return {
        ok: true,
        json: async () => ({
          success: true,
          fileName: requestBody.fileName,
          path: filePath,
        }),
      };
    });

    if (global.window) {
      global.window.fetch = fetchMock;
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'bar' },
      {
        actionId: 'core:test_action',
        actorId: 'integration_actor',
        isComplete: true,
      }
    );

    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    const files = await fs.readdir(tempDirectory);
    expect(files.length).toBe(1);

    const fileContent = await fs.readFile(
      path.join(tempDirectory, files[0]),
      'utf-8'
    );
    const parsed = JSON.parse(fileContent);

    expect(parsed.metadata.actionId).toBe('core:test_action');
    expect(parsed.metadata.actorId).toBe('integration_actor');
    expect(parsed.trace.foo).toBe('bar');

    const stats = handler.getStatistics();
    expect(stats.isInitialized).toBe(true);
    expect(stats.batchOperations.totalBatches).toBe(0);
    expect(stats.queuedTraces).toBe(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('writes batched traces via batch endpoint when available', async () => {
    const fetchMock = jest.fn().mockImplementation(async (url, options) => {
      if (!options?.body) {
        throw new Error('Missing request body for batch');
      }

      const requestBody = JSON.parse(options.body);

      if (url.endsWith('/api/traces/write-batch')) {
        for (const trace of requestBody.traces) {
          const filePath = path.join(tempDirectory, trace.fileName);
          await fs.writeFile(filePath, trace.traceData, 'utf-8');
        }

        return {
          ok: true,
          json: async () => ({
            success: true,
            successCount: requestBody.traces.length,
            failureCount: 0,
            totalSize: requestBody.traces.reduce(
              (sum, trace) => sum + trace.traceData.length,
              0
            ),
          }),
        };
      }

      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Unexpected URL' }),
      };
    });

    if (global.window) {
      global.window.fetch = fetchMock;
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const batchPayload = [
      {
        content: JSON.stringify({ foo: 'one' }),
        originalTrace: {
          actionId: 'core:first_action',
          actorId: 'actor_a',
        },
      },
      {
        content: JSON.stringify({ foo: 'two' }),
        originalTrace: {
          actionId: 'core:second_action',
          actorId: 'actor_b',
        },
      },
    ];

    const result = await handler.writeBatch(batchPayload);
    expect(result).toBe(true);

    await waitForQueueToDrain(handler);

    const files = await fs.readdir(tempDirectory);
    expect(files.length).toBe(2);

    const stats = handler.getStatistics();
    expect(stats.batchOperations.totalBatches).toBe(1);
    expect(stats.batchOperations.totalBatchedTraces).toBe(2);
    expect(stats.batchOperations.batchSuccessRate).toBe(100);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to individual trace writes when batch endpoint is missing', async () => {
    const writtenFiles = [];

    if (global.window) {
      global.window.fetch = jest
        .fn()
        .mockImplementation(async (url, options) => {
          if (url.endsWith('/api/traces/write-batch')) {
            return {
              ok: false,
              status: 404,
              json: async () => ({ success: false, error: 'Not Found' }),
            };
          }

          if (url.endsWith('/api/traces/write')) {
            const request = JSON.parse(options.body);
            const filePath = path.join(tempDirectory, request.fileName);
            await fs.writeFile(filePath, request.traceData, 'utf-8');
            writtenFiles.push(filePath);

            return {
              ok: true,
              json: async () => ({
                success: true,
                fileName: request.fileName,
                path: filePath,
              }),
            };
          }

          return {
            ok: false,
            status: 500,
            json: async () => ({ success: false, error: 'Unexpected URL' }),
          };
        });
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const batchPayload = [
      {
        content: JSON.stringify({ foo: 'fallback-one' }),
        originalTrace: {
          actionId: 'core:fallback_action',
          actorId: 'actor_c',
        },
      },
      {
        content: JSON.stringify({ foo: 'fallback-two' }),
        originalTrace: {
          actionId: 'core:fallback_action',
          actorId: 'actor_d',
        },
      },
    ];

    const result = await handler.writeBatch(batchPayload);
    expect(result).toBe(true);

    await waitForQueueToDrain(handler);

    expect(global.window.fetch).toHaveBeenCalledTimes(3);
    expect(writtenFiles.length).toBe(2);

    const stats = handler.getStatistics();
    expect(stats.batchOperations.totalBatches).toBe(1);
    expect(stats.batchOperations.totalBatchedTraces).toBe(2);
    expect(stats.batchOperations.batchSuccessRate).toBe(100);
  });

  it('returns false when batch endpoint fails with server error', async () => {
    if (global.window) {
      global.window.fetch = jest.fn().mockImplementation(async (url) => {
        if (url.endsWith('/api/traces/write-batch')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ success: false, error: 'Simulated failure' }),
          };
        }

        return {
          ok: false,
          status: 500,
          json: async () => ({ success: false, error: 'Unexpected URL' }),
        };
      });
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const batchPayload = [
      {
        content: JSON.stringify({ foo: 'error-one' }),
        originalTrace: {
          actionId: 'core:error_action',
          actorId: 'actor_e',
        },
      },
    ];

    const result = await handler.writeBatch(batchPayload);
    expect(result).toBe(false);

    const files = await fs.readdir(tempDirectory);
    expect(files.length).toBe(0);

    const stats = handler.getStatistics();
    expect(stats.batchOperations.totalBatches).toBe(1);
    expect(stats.batchOperations.batchSuccessRate).toBe(0);
  });

  it('uses File System Access API fallback when server is unreachable', async () => {
    const rootHandle = new InMemoryDirectoryHandle('root');
    const traceDirectoryManager = {
      async selectDirectory() {
        return rootHandle;
      },
      async ensureSubdirectoryExists(directoryHandle, name) {
        return directoryHandle.getDirectoryHandle(name, { create: true });
      },
    };

    if (global.window) {
      global.window.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network down'));
      global.window.showDirectoryPicker = jest
        .fn()
        .mockResolvedValue(rootHandle);
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'virtual-traces',
      traceDirectoryManager,
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'filesystem' },
      {
        actionId: 'core:fs_action',
        actorId: 'actor_fs',
      }
    );
    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    const tracesDirectory = rootHandle.getDirectory('traces');
    const storedFileNames = tracesDirectory.getFileNames();
    expect(storedFileNames.length).toBe(1);

    const storedContent = tracesDirectory.getFileContent(storedFileNames[0]);
    const parsed = JSON.parse(storedContent);
    expect(parsed.trace.foo).toBe('filesystem');
  });

  it('downloads trace when no filesystem APIs are available', async () => {
    const savedWindow = global.window;
    global.window = undefined;

    const clickSpy = jest.fn();
    const appendSpy = jest
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => {});
    const removeSpy = jest
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => {});
    const createObjectURLSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:integration');
    const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = jest.fn(() => ({
      style: {},
      click: clickSpy,
      set href(value) {
        this._href = value;
      },
      get href() {
        return this._href;
      },
      set download(value) {
        this._download = value;
      },
      get download() {
        return this._download;
      },
    }));

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'downloads',
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace('plain text content', {
      actionId: 'core:text_action',
      actorId: 'actor_text',
      _outputFormat: 'text',
    });

    await waitForQueueToDrain(handler);

    expect(success).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    document.createElement = originalCreateElement;
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    global.window = savedWindow;
  });

  it('short-circuits network requests when testMode is enabled', async () => {
    const fetchSpy = jest.fn();
    if (global.window) {
      global.window.fetch = fetchSpy;
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'test-mode-traces',
      logger: testBed.mockLogger,
      testMode: true,
    });

    const success = await handler.writeTrace(
      { foo: 'test-mode' },
      {
        actionId: 'core:test_mode',
        actorId: 'actor_tm',
      }
    );

    await waitForQueueToDrain(handler);

    expect(success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs errors when a custom batch writer throws during execution', async () => {
    const batchWriter = jest.fn(() => {
      throw new Error('Injected batch failure');
    });

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
      batchWriter,
    });

    const result = await handler.writeBatch([
      {
        content: JSON.stringify({ foo: 'broken' }),
        originalTrace: {
          actionId: 'core:batch_error',
          actorId: 'actor_batch',
        },
      },
    ]);

    expect(result).toBe(false);
    expect(batchWriter).toHaveBeenCalledTimes(1);
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'Failed to write trace batch',
      expect.objectContaining({
        error: 'Injected batch failure',
        batchSize: 1,
      })
    );
  });

  it('captures queue processing failures without leaving the queue locked', async () => {
    const queueImplementation = {
      items: [],
      length: 0,
      push(item) {
        this.items.push(item);
        this.length = this.items.length;
      },
      shift() {
        const value = this.items.shift();
        this.length = this.items.length;
        if (value?.originalTrace?.actionId === 'core:queue_failure') {
          throw new Error('Queue shift failure');
        }
        return value;
      },
    };

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
      queueImplementation,
    });

    const result = await handler.writeTrace(
      { foo: 'queue' },
      {
        actionId: 'core:queue_failure',
        actorId: 'actor_queue',
      }
    );

    expect(result).toBe(true);

    await waitForQueueToDrain(handler);

    expect(handler.isQueueEmpty()).toBe(true);
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'Error processing trace queue',
      expect.any(Error)
    );
  });

  it('recovers when a custom queue temporarily reports zero length', async () => {
    const queueImplementation = {
      items: [],
      _length: 0,
      lengthOverrideActive: true,
      get length() {
        return this.lengthOverrideActive ? 0 : this._length;
      },
      set length(value) {
        this._length = value;
      },
      push(item) {
        this.items.push(item);
        this.length = this.items.length;
      },
      shift() {
        const value = this.items.shift();
        this.length = this.items.length;
        return value;
      },
    };

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
      queueImplementation,
    });

    const first = await handler.writeTrace(
      { foo: 'delayed' },
      {
        actionId: 'core:delayed_queue',
        actorId: 'actor_delay',
      }
    );
    expect(first).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    queueImplementation.lengthOverrideActive = false;

    const second = await handler.writeTrace(
      { foo: 'processed' },
      {
        actionId: 'core:processed_queue',
        actorId: 'actor_delay',
      }
    );
    expect(second).toBe(true);

    await waitForQueueToDrain(handler);

    expect(handler.isQueueEmpty()).toBe(true);
    expect(queueImplementation.items).toHaveLength(0);
  });

  it('logs failures that occur while generating filenames for traces', async () => {
    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'bad-filename' },
      {
        actionId: { invalid: true },
        actorId: 'actor_bad',
      }
    );

    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'Failed to write trace to file',
      expect.objectContaining({
        actionId: { invalid: true },
        actorId: 'actor_bad',
        error: expect.any(String),
      })
    );
  });

  it('reports server response details when the trace endpoint fails', async () => {
    if (global.window) {
      global.window.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({
          error: 'boom',
          details: 'trace invalid',
        }),
      });
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'server-fail' },
      {
        actionId: 'core:server_fail',
        actorId: 'actor_fail',
      }
    );

    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    expect(global.window.fetch).toHaveBeenCalledTimes(1);
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'FileTraceOutputHandler: Server endpoint write failed',
      expect.objectContaining({
        status: 500,
        statusText: 'Internal Server Error',
        error: 'boom',
        details: 'trace invalid',
      })
    );
  });

  it('logs connectivity guidance when fetch throws network and CORS errors', async () => {
    if (global.window) {
      global.window.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failed to fetch: server offline'))
        .mockRejectedValueOnce(new Error('CORS violation: blocked'));
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const first = await handler.writeTrace(
      { foo: 'first-error' },
      {
        actionId: 'core:first_error',
        actorId: 'actor_error',
      }
    );
    expect(first).toBe(true);
    await waitForQueueToDrain(handler);

    const second = await handler.writeTrace(
      { foo: 'second-error' },
      {
        actionId: 'core:second_error',
        actorId: 'actor_error',
      }
    );
    expect(second).toBe(true);
    await waitForQueueToDrain(handler);

    const errorCalls = testBed.mockLogger.error.mock.calls.map(
      (call) => call[0]
    );

    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'FileTraceOutputHandler: Failed to write to server endpoint',
      expect.objectContaining({
        fileName: expect.any(String),
        error: expect.stringContaining('Failed to fetch'),
      })
    );
    expect(
      errorCalls.some(
        (message) =>
          typeof message === 'string' &&
          message.includes('Server appears to be offline or unreachable')
      )
    ).toBe(true);
    expect(errorCalls).toContain(
      'FileTraceOutputHandler: CORS error - check server CORS configuration'
    );
  });

  it('returns false when batch server access is unavailable in the browser environment', async () => {
    if (global.window) {
      const originalFetch = global.window.fetch;
      delete global.window.fetch;

      const handler = new FileTraceOutputHandler({
        outputDirectory: tempDirectory,
        logger: testBed.mockLogger,
      });

      const result = await handler.writeBatch([
        {
          content: JSON.stringify({ foo: 'missing-fetch' }),
          originalTrace: {
            actionId: 'core:missing_fetch',
            actorId: 'actor_missing',
          },
        },
      ]);

      expect(result).toBe(false);

      global.window.fetch = originalFetch;
    }
  });

  it('logs errors when batch server calls reject', async () => {
    if (global.window) {
      global.window.fetch = jest
        .fn()
        .mockRejectedValue(new Error('batch offline'));
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const result = await handler.writeBatch([
      {
        content: JSON.stringify({ foo: 'reject' }),
        originalTrace: {
          actionId: 'core:batch_reject',
          actorId: 'actor_reject',
        },
      },
    ]);

    expect(result).toBe(false);
    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'Batch server write failed',
      expect.objectContaining({
        error: 'batch offline',
        batchSize: 1,
      })
    );
  });

  it('logs debug information when File System Access API writes fail', async () => {
    const failingHandle = {
      getFileHandle: jest.fn().mockRejectedValue(new Error('no permission')),
    };

    const traceDirectoryManager = {
      selectDirectory: jest.fn().mockResolvedValue({ name: 'root' }),
      ensureSubdirectoryExists: jest.fn().mockResolvedValue(failingHandle),
    };

    if (global.window) {
      global.window.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Failure',
        json: jest.fn().mockResolvedValue({ error: 'no server' }),
      });
      global.window.showDirectoryPicker = jest.fn();
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'fs-failure',
      traceDirectoryManager,
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'fs-failure' },
      {
        actionId: 'core:fs_fail',
        actorId: 'actor_fs_fail',
      }
    );

    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    expect(traceDirectoryManager.selectDirectory).toHaveBeenCalled();
    expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
      'File System API write failed, will use download fallback',
      'no permission'
    );

    if (global.window) {
      delete global.window.showDirectoryPicker;
    }
  });

  it('logs when it cannot establish a directory handle via the manager', async () => {
    const traceDirectoryManager = {
      selectDirectory: jest.fn().mockRejectedValue(new Error('user cancelled')),
      ensureSubdirectoryExists: jest.fn(),
    };

    if (global.window) {
      global.window.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Failure',
        json: jest.fn().mockResolvedValue({ error: 'no server' }),
      });
      global.window.showDirectoryPicker = jest.fn();
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'fs-handle-failure',
      traceDirectoryManager,
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'fs-handle' },
      {
        actionId: 'core:fs_handle',
        actorId: 'actor_fs_handle',
      }
    );

    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    expect(traceDirectoryManager.selectDirectory).toHaveBeenCalled();
    expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
      'Could not establish directory handle',
      'user cancelled'
    );

    if (global.window) {
      delete global.window.showDirectoryPicker;
    }
  });

  it('logs download failures when the fallback cannot create a blob URL', async () => {
    const savedCreateObjectURL = URL.createObjectURL;
    const savedRevokeObjectURL = URL.revokeObjectURL;
    const savedAppendChild = document.body.appendChild;
    const savedRemoveChild = document.body.removeChild;
    const savedCreateElement = document.createElement;
    const savedWindow = global.window;

    URL.createObjectURL = jest.fn(() => {
      throw new Error('blob failure');
    });
    URL.revokeObjectURL = jest.fn();
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
    document.createElement = jest.fn(() => ({
      style: {},
      click: jest.fn(),
    }));
    global.window = undefined;

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'download-failure',
      logger: testBed.mockLogger,
    });

    const success = await handler.writeTrace(
      { foo: 'download' },
      {
        actionId: 'core:download_fail',
        actorId: 'actor_download_fail',
      }
    );

    expect(success).toBe(true);

    await waitForQueueToDrain(handler);

    expect(testBed.mockLogger.error).toHaveBeenCalledWith(
      'Failed to download trace file',
      expect.any(Error)
    );

    document.createElement = savedCreateElement;
    document.body.appendChild = savedAppendChild;
    document.body.removeChild = savedRemoveChild;
    URL.createObjectURL = savedCreateObjectURL;
    URL.revokeObjectURL = savedRevokeObjectURL;
    global.window = savedWindow;
  });

  it('resets directory handles when changing the output directory', async () => {
    const writeRecorderOne = [];
    const writeRecorderTwo = [];

    const createWritableFactory = (recorder) => async () => ({
      async write(content) {
        recorder.push(content);
      },
      async close() {},
    });

    const tracesHandleOne = {
      getFileHandle: jest.fn().mockResolvedValue({
        createWritable: createWritableFactory(writeRecorderOne),
      }),
    };

    const tracesHandleTwo = {
      getFileHandle: jest.fn().mockResolvedValue({
        createWritable: createWritableFactory(writeRecorderTwo),
      }),
    };

    const traceDirectoryManager = {
      selectDirectory: jest
        .fn()
        .mockResolvedValueOnce({ name: 'root-one' })
        .mockResolvedValueOnce({ name: 'root-two' }),
      ensureSubdirectoryExists: jest
        .fn()
        .mockResolvedValueOnce(tracesHandleOne)
        .mockResolvedValueOnce(tracesHandleTwo),
    };

    if (global.window) {
      global.window.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network down'));
      global.window.showDirectoryPicker = jest.fn();
    }

    const handler = new FileTraceOutputHandler({
      outputDirectory: 'fs-reset',
      traceDirectoryManager,
      logger: testBed.mockLogger,
    });

    const firstSuccess = await handler.writeTrace(
      { foo: 'first' },
      {
        actionId: 'core:first_reset',
        actorId: 'actor_reset',
      }
    );
    expect(firstSuccess).toBe(true);

    await waitForQueueToDrain(handler);

    expect(traceDirectoryManager.selectDirectory).toHaveBeenCalledTimes(1);

    traceDirectoryManager.selectDirectory.mockClear();
    traceDirectoryManager.ensureSubdirectoryExists.mockClear();

    handler.setOutputDirectory('fs-reset-next');

    const secondSuccess = await handler.writeTrace(
      { foo: 'second' },
      {
        actionId: 'core:second_reset',
        actorId: 'actor_reset',
      }
    );
    expect(secondSuccess).toBe(true);

    await waitForQueueToDrain(handler);

    expect(traceDirectoryManager.selectDirectory).toHaveBeenCalledTimes(1);
    expect(
      traceDirectoryManager.ensureSubdirectoryExists
    ).toHaveBeenCalledTimes(1);
    expect(writeRecorderOne.length).toBeGreaterThanOrEqual(1);
    expect(writeRecorderTwo.length).toBeGreaterThanOrEqual(1);
    expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
      'Output directory set to: fs-reset-next'
    );

    if (global.window) {
      delete global.window.showDirectoryPicker;
    }
  });

  it('rejects invalid batch payloads', async () => {
    const handler = new FileTraceOutputHandler({
      outputDirectory: tempDirectory,
      logger: testBed.mockLogger,
    });

    const result = await handler.writeBatch(null);
    expect(result).toBe(false);
  });

  it('regenerates endpoint configuration between tests to pick up environment changes', () => {
    process.env.PROXY_HOST = 'localhost';
    process.env.PROXY_PORT = '5555';
    process.env.PROXY_USE_HTTPS = 'false';
    resetEndpointConfig();

    const config = getEndpointConfig();
    expect(config.getTracesWriteEndpoint()).toContain('5555');
  });
});
