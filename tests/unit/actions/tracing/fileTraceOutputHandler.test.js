/**
 * @file Unit tests for FileTraceOutputHandler
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

describe('FileTraceOutputHandler', () => {
  let handler;
  let mockLogger;
  let mockTraceDirectoryManager;
  let originalWindow;
  let originalDocument;
  let originalFetch;

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
    // Store original globals
    originalWindow = global.window;
    originalDocument = global.document;
    originalFetch = global.fetch;

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock trace directory manager
    mockTraceDirectoryManager = {
      selectDirectory: jest.fn(),
      ensureSubdirectoryExists: jest.fn(),
    };

    // Create jest mock for fetch first
    const mockFetch = jest.fn();

    // Mock window and document for browser APIs
    global.window = {
      showDirectoryPicker: jest.fn(),
      fetch: mockFetch,
    };

    // Ensure window.fetch is accessible via global.fetch
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
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn(),
    };

    global.Blob = jest.fn((content, options) => ({
      content,
      options,
    }));

    // Ensure File System API detection works properly
    Object.defineProperty(global.window, 'showDirectoryPicker', {
      value: jest.fn(),
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // No need to sync again since they already point to the same mock
  });

  afterEach(() => {
    // Restore original globals
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
    
    // Enhanced cleanup to prevent memory leaks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.runOnlyPendingTimers();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear any remaining references
    handler = null;
    mockLogger = null;
    mockTraceDirectoryManager = null;
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './custom-traces',
        traceDirectoryManager: mockTraceDirectoryManager,
        logger: mockLogger,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'FileTraceOutputHandler initialized',
        expect.objectContaining({
          outputDirectory: './custom-traces',
          hasDirectoryManager: true,
        })
      );
    });

    it('should use default output directory when not provided', () => {
      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'FileTraceOutputHandler initialized',
        expect.objectContaining({
          outputDirectory: './traces',
          hasDirectoryManager: false,
        })
      );
    });

    it('should validate trace directory manager if provided', () => {
      const invalidManager = { someMethod: jest.fn() };

      expect(() => {
        new FileTraceOutputHandler({
          traceDirectoryManager: invalidManager,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should work without logger (using default)', () => {
      expect(() => {
        handler = new FileTraceOutputHandler({
          outputDirectory: './traces',
        });
      }).not.toThrow();
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './traces',
        logger: mockLogger,
      });
    });

    it('should initialize successfully when File System Access API is supported', async () => {
      const result = await handler.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'File System Access API supported - traces can be saved to filesystem'
      );
    });

    it('should handle when File System Access API is not supported', async () => {
      delete global.window.showDirectoryPicker;

      const result = await handler.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'File System Access API not supported - will use download fallback'
      );
    });

    it('should return true if already initialized', async () => {
      await handler.initialize();
      mockLogger.info.mockClear();

      const result = await handler.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      // Mock the window check to throw an error
      const originalWindow = global.window;
      delete global.window;

      // Mock console error to catch the internal error
      handler = new FileTraceOutputHandler({
        logger: {
          ...mockLogger,
          error: jest.fn(() => {
            throw new Error('Initialization error');
          }),
        },
      });

      // This should gracefully handle the error
      const result = await handler.initialize();

      // The implementation returns true even on error
      expect(result).toBe(true);

      global.window = originalWindow;
    });
  });

  describe('writeTrace', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './traces',
        logger: mockLogger,
      });
    });

    it('should queue trace for processing', async () => {
      const traceData = { action: 'test', result: 'success' };
      const originalTrace = { actionId: 'test-action', actorId: 'test-actor' };

      const result = await handler.writeTrace(traceData, originalTrace);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'FileTraceOutputHandler: Trace queued for processing',
        expect.objectContaining({
          actionId: 'test-action',
          actorId: 'test-actor',
          queueLength: 1,
        })
      );
    });

    it('should initialize if not already initialized', async () => {
      const initializeSpy = jest.spyOn(handler, 'initialize');

      await handler.writeTrace({}, {});

      expect(initializeSpy).toHaveBeenCalled();
    });

    it('should handle queueing errors', async () => {
      // Mock Date.now to throw an error
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        throw new Error('Date error');
      });

      const result = await handler.writeTrace({}, {});

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to queue trace for writing',
        expect.any(Error)
      );

      Date.now = originalDateNow;
    });

    it('should start processing queue if not already processing', async () => {
      // Use a small delay to allow async processing to start
      await handler.writeTrace({}, {});

      // Give the async queue processor time to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // The queue should be processing
      const stats = handler.getStatistics();
      expect(stats.queuedTraces).toBe(0); // Should be processed
    });
  });

  describe('file writing mechanisms', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './traces',
        logger: mockLogger,
      });
    });

    describe('server endpoint writing', () => {
      it('should successfully write via server endpoint', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            path: './traces/test.json',
            size: 1024,
            fileName: 'test.json',
          }),
        });

        const traceData = { test: 'data' };
        const originalTrace = { actionId: 'test', actorId: 'actor' };

        await handler.writeTrace(traceData, originalTrace);

        // Wait for async processing
        await waitForQueueProcessing(handler);

        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/traces/write',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('test'),
          })
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'FileTraceOutputHandler: Trace written to server successfully',
          expect.objectContaining({
            path: './traces/test.json',
            size: 1024,
            fileName: 'test.json',
          })
        );
      });

      it('should handle server endpoint errors', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({
            error: 'Server error',
            details: 'Disk full',
          }),
        });

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'FileTraceOutputHandler: Server endpoint write failed',
          expect.objectContaining({
            status: 500,
            statusText: 'Internal Server Error',
            error: 'Server error',
            details: 'Disk full',
          })
        );
      });

      it('should handle network failures', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'FileTraceOutputHandler: Server appears to be offline or unreachable at http://localhost:3001'
        );
      });

      it('should handle CORS errors', async () => {
        global.fetch.mockRejectedValueOnce(new Error('CORS policy blocked'));

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'FileTraceOutputHandler: CORS error - check server CORS configuration'
        );
      });

      it('should skip server endpoint in non-browser environment', async () => {
        global.window = undefined;
        global.fetch = undefined;

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        // Fetch should not be called since it's undefined
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'FileTraceOutputHandler: Not in browser environment or fetch unavailable',
          expect.any(Object)
        );
      });
    });

    describe('File System Access API writing', () => {
      it('should handle successful File System API write', async () => {
        // Setup mock File System API that succeeds
        const mockWritable = {
          write: jest.fn().mockResolvedValue(),
          close: jest.fn().mockResolvedValue(),
        };

        const mockFileHandle = {
          createWritable: jest.fn().mockResolvedValue(mockWritable),
        };

        const mockDirectoryHandle = {
          getFileHandle: jest.fn().mockResolvedValue(mockFileHandle),
        };

        // Create a clean mock
        const cleanTraceManager = {
          selectDirectory: jest.fn().mockResolvedValue(mockDirectoryHandle),
          ensureSubdirectoryExists: jest
            .fn()
            .mockResolvedValue(mockDirectoryHandle),
        };

        handler = new FileTraceOutputHandler({
          outputDirectory: './traces',
          traceDirectoryManager: cleanTraceManager,
          logger: mockLogger,
        });

        // Make server fail first
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

        // Write trace
        await handler.writeTrace({ test: 'data' }, { actionId: 'test' });

        // Allow full processing
        await waitForQueueProcessing(handler, 200);

        // Verify File System API was attempted
        expect(cleanTraceManager.selectDirectory).toHaveBeenCalled();
        expect(cleanTraceManager.ensureSubdirectoryExists).toHaveBeenCalledWith(
          mockDirectoryHandle,
          'traces'
        );
        expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalled();
        expect(mockWritable.write).toHaveBeenCalled();
        expect(mockWritable.close).toHaveBeenCalled();
      });

      it('should write using File System Access API when available', async () => {
        // Mock successful File System Access API
        const mockWritable = {
          write: jest.fn(),
          close: jest.fn(),
        };

        const mockFileHandle = {
          createWritable: jest.fn(() => Promise.resolve(mockWritable)),
        };

        const mockDirectoryHandle = {
          getFileHandle: jest.fn(() => Promise.resolve(mockFileHandle)),
        };

        mockTraceDirectoryManager.selectDirectory.mockResolvedValueOnce(
          mockDirectoryHandle
        );
        mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValueOnce(
          mockDirectoryHandle
        );

        handler = new FileTraceOutputHandler({
          outputDirectory: './traces',
          traceDirectoryManager: mockTraceDirectoryManager,
          logger: mockLogger,
        });

        // Make server endpoint fail to trigger File System API
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({}),
        });

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        expect(mockTraceDirectoryManager.selectDirectory).toHaveBeenCalled();
        expect(
          mockTraceDirectoryManager.ensureSubdirectoryExists
        ).toHaveBeenCalledWith(mockDirectoryHandle, 'traces');
        expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith(
          expect.stringContaining('trace_'),
          { create: true }
        );
      });

      it('should handle File System Access API failures gracefully', async () => {
        // Reset the mock to ensure clean state
        mockTraceDirectoryManager.selectDirectory.mockClear();
        mockTraceDirectoryManager.ensureSubdirectoryExists.mockClear();

        mockTraceDirectoryManager.selectDirectory.mockRejectedValueOnce(
          new Error('User cancelled')
        );

        handler = new FileTraceOutputHandler({
          outputDirectory: './traces',
          traceDirectoryManager: mockTraceDirectoryManager,
          logger: mockLogger,
        });

        // Make server endpoint fail
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        // Since File System API fails, it should fall back to download
        expect(mockTraceDirectoryManager.selectDirectory).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Could not establish directory handle',
          'User cancelled'
        );
      });
    });

    describe('download fallback', () => {
      it('should handle download errors gracefully', async () => {
        // Mock createElement to throw error
        const originalCreateElement = global.document.createElement;
        global.document.createElement = jest.fn(() => {
          throw new Error('DOM error');
        });

        // Make server endpoint fail
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({}),
        });

        // Remove File System Access API
        delete global.window.showDirectoryPicker;

        await handler.writeTrace({}, {});

        // Wait for async processing
        await waitForQueueProcessing(handler);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to download trace file',
          expect.any(Error)
        );

        // Restore original
        global.document.createElement = originalCreateElement;
      });
    });
  });

  describe('filename generation', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });
    });

    it('should sanitize special characters in filenames', async () => {
      const trace = {
        actionId: 'test/action:special',
        actorId: 'actor@domain.com',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ path: 'test' }),
      });

      await handler.writeTrace({}, trace);

      // Wait for async processing
      await waitForQueueProcessing(handler);

      const fetchCall = global.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.fileName).toMatch(
        /^trace_test_action_special_actor_domain_com_.*\.json$/
      );
      expect(body.fileName).not.toContain('/');
      expect(body.fileName).not.toContain(':');
      expect(body.fileName).not.toContain('@');
    });

    it('should handle missing action and actor IDs', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ path: 'test' }),
      });

      await handler.writeTrace({}, {});

      // Wait for async processing
      await waitForQueueProcessing(handler);

      const fetchCall = global.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.fileName).toMatch(/^trace_unknown_unknown_.*\.json$/);
    });
  });

  describe('trace content formatting', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './test-traces',
        logger: mockLogger,
      });
    });

    it('should format trace content with metadata', async () => {
      const traceData = {
        action: 'test-action',
        result: 'success',
      };

      const originalTrace = {
        actionId: 'action-123',
        actorId: 'actor-456',
        isComplete: true,
        hasError: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ path: 'test' }),
      });

      await handler.writeTrace(traceData, originalTrace);

      // Wait for async processing
      await waitForQueueProcessing(handler);

      const fetchCall = global.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const content = JSON.parse(body.traceData);

      expect(content).toMatchObject({
        timestamp: expect.any(String),
        outputDirectory: './test-traces',
        trace: traceData,
        metadata: {
          actionId: 'action-123',
          actorId: 'actor-456',
          isComplete: true,
          hasError: false,
          generatedBy: 'Living Narrative Engine Action Tracing System',
        },
      });
    });
  });

  describe('queue processing', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });
    });

    it('should process multiple traces sequentially', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ path: 'test' }),
      });

      // Queue multiple traces
      await handler.writeTrace({ trace: 1 }, { actionId: 'action1' });
      await handler.writeTrace({ trace: 2 }, { actionId: 'action2' });
      await handler.writeTrace({ trace: 3 }, { actionId: 'action3' });

      // Wait for all to process
      await waitForQueueProcessing(handler);

      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Check that all traces were processed
      const stats = handler.getStatistics();
      expect(stats.queuedTraces).toBe(0);
    });

    it('should handle errors during queue processing', async () => {
      // First call fails, second succeeds
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ path: 'test' }),
        });

      await handler.writeTrace({ trace: 1 }, { actionId: 'action1' });
      await handler.writeTrace({ trace: 2 }, { actionId: 'action2' });

      // Wait for processing
      await waitForQueueProcessing(handler);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalled();

      // Second trace should still be processed
      const stats = handler.getStatistics();
      expect(stats.queuedTraces).toBe(0);
    });

    it('should prevent concurrent queue processing', async () => {
      // Slow fetch to ensure overlap
      global.fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ path: 'test' }),
                }),
              50
            )
          )
      );

      // Write multiple traces rapidly
      const promises = [
        handler.writeTrace({ trace: 1 }, {}),
        handler.writeTrace({ trace: 2 }, {}),
        handler.writeTrace({ trace: 3 }, {}),
      ];

      await Promise.all(promises);

      // The queue should be processing
      const stats = handler.getStatistics();
      expect(stats.isProcessingQueue).toBe(true);

      // Wait for processing to complete
      await waitForQueueProcessing(handler, 300);

      const finalStats = handler.getStatistics();
      expect(finalStats.isProcessingQueue).toBe(false);
      expect(finalStats.queuedTraces).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return complete statistics', () => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './stats-test',
        traceDirectoryManager: mockTraceDirectoryManager,
        logger: mockLogger,
      });

      const stats = handler.getStatistics();

      expect(stats).toEqual({
        isInitialized: false,
        outputDirectory: './stats-test',
        queuedTraces: 0,
        isProcessingQueue: false,
        hasDirectoryManager: true,
        hasDirectoryHandle: false,
        supportsFileSystemAPI: true,
        batchOperations: {
          totalBatches: 0,
          totalBatchedTraces: 0,
          batchSuccessRate: 0,
          avgBatchSize: 0,
        }
      });
    });

    it('should update statistics after operations', async () => {
      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });

      await handler.initialize();
      await handler.writeTrace({}, {});

      const stats = handler.getStatistics();

      expect(stats.isInitialized).toBe(true);
      expect(stats.queuedTraces).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setOutputDirectory', () => {
    it('should update output directory and reset handles', () => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './original',
        traceDirectoryManager: mockTraceDirectoryManager,
        logger: mockLogger,
      });

      handler.setOutputDirectory('./new-directory');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Output directory set to: ./new-directory'
      );

      const stats = handler.getStatistics();
      expect(stats.outputDirectory).toBe('./new-directory');
      expect(stats.hasDirectoryHandle).toBe(false);
    });
  });

  describe('initialization edge cases', () => {
    it('should handle queue processing errors', async () => {
      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });

      // Mock internal method to throw error
      const originalProcess = handler._processTraceQueue;

      // Add a trace that will cause processing error
      await handler.writeTrace(null, {}); // null will cause JSON stringify error

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged error
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('edge cases and environment handling', () => {
    it('should handle missing window object gracefully', async () => {
      global.window = undefined;

      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });

      const result = await handler.initialize();
      expect(result).toBe(true);

      await handler.writeTrace({}, {});

      // Should not throw
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to write trace to file'),
        expect.any(Object)
      );
    });

    it('should handle missing fetch gracefully', async () => {
      global.window.fetch = undefined;

      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });

      await handler.writeTrace({}, {});

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'FileTraceOutputHandler: Not in browser environment or fetch unavailable',
        expect.any(Object)
      );
    });

    it('should handle malformed server responses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      handler = new FileTraceOutputHandler({
        logger: mockLogger,
      });

      await handler.writeTrace({}, {});

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'FileTraceOutputHandler: Server endpoint write failed',
        expect.objectContaining({
          status: 500,
          error: 'Unknown error',
        })
      );
    });

    it('should handle File System API permission denial', async () => {
      const mockError = new DOMException(
        'User denied permission',
        'NotAllowedError'
      );

      mockTraceDirectoryManager.selectDirectory.mockRejectedValueOnce(
        mockError
      );

      handler = new FileTraceOutputHandler({
        traceDirectoryManager: mockTraceDirectoryManager,
        logger: mockLogger,
      });

      // Make server fail to trigger File System API
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      await handler.writeTrace({}, {});

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Could not establish directory handle',
        expect.stringContaining('User denied permission')
      );
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      handler = new FileTraceOutputHandler({
        outputDirectory: './test-traces',
        traceDirectoryManager: mockTraceDirectoryManager,
        logger: mockLogger,
      });
    });

    describe('writeBatch method', () => {
      it('should successfully write batch via server endpoint', async () => {
        const mockBatchResponse = {
          success: true,
          successCount: 2,
          failureCount: 0,
          totalSize: 2048
        };

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockBatchResponse,
        });

        const traceBatch = [
          {
            content: 'trace content 1',
            originalTrace: { actionId: 'action1', actorId: 'actor1' }
          },
          {
            content: 'trace content 2', 
            originalTrace: { actionId: 'action2', actorId: 'actor2', _outputFormat: 'text' }
          }
        ];

        const result = await handler.writeBatch(traceBatch);

        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3001/api/traces/write-batch',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('traces')
          })
        );

        const callArgs = global.fetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        expect(requestBody.traces).toHaveLength(2);
        expect(requestBody.outputDirectory).toBe('./test-traces');
        expect(requestBody.traces[0].traceData).toBe('trace content 1');
      });

      it('should fall back to individual writes when batch endpoint returns 404', async () => {
        // Mock batch endpoint returning 404
        global.fetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not Found' })
          })
          // Mock individual write success
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, path: './trace1' })
          })
          .mockResolvedValueOnce({
            ok: true, 
            json: async () => ({ success: true, path: './trace2' })
          });

        const traceBatch = [
          { content: 'content1', originalTrace: { actionId: 'action1' } },
          { content: 'content2', originalTrace: { actionId: 'action2' } }
        ];

        const result = await handler.writeBatch(traceBatch);

        // Wait for queue processing of individual writes
        await waitForQueueProcessing(handler);

        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(3); // 1 batch + 2 individual
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Batch endpoint unavailable, falling back to individual writes'
        );
        
        // Check that this was counted as a successful batch operation
        const stats = handler.getStatistics();
        expect(stats.batchOperations.totalBatches).toBe(1);
        expect(stats.batchOperations.batchSuccessRate).toBe(100);
      });

      it('should handle empty batch array', async () => {
        const result = await handler.writeBatch([]);

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'writeBatch requires non-empty array'
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should handle invalid batch input', async () => {
        const result = await handler.writeBatch(null);

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'writeBatch requires non-empty array'
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should handle batch server errors gracefully', async () => {
        global.fetch
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' })
          })
          // Individual write also fails
          .mockRejectedValueOnce(new Error('Individual write failed'));

        const traceBatch = [
          { content: 'content', originalTrace: { actionId: 'action1' } }
        ];

        const result = await handler.writeBatch(traceBatch);

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Batch write failed',
          expect.objectContaining({
            status: 500,
            error: 'Internal Server Error'
          })
        );
      });

      it('should handle network errors in batch operation', async () => {
        // First call - batch endpoint network error
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        const traceBatch = [
          { content: 'content', originalTrace: { actionId: 'action1' } }
        ];

        const result = await handler.writeBatch(traceBatch);

        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Batch server write failed',
          expect.objectContaining({
            error: 'Network error',
            batchSize: 1
          })
        );
      });

      it('should track batch statistics correctly', async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, successCount: 2 })
        });

        const traceBatch = [
          { content: 'content1', originalTrace: { actionId: 'action1' } },
          { content: 'content2', originalTrace: { actionId: 'action2' } }
        ];

        await handler.writeBatch(traceBatch);

        const stats = handler.getStatistics();
        expect(stats.batchOperations.totalBatches).toBe(1);
        expect(stats.batchOperations.totalBatchedTraces).toBe(2);
        expect(stats.batchOperations.batchSuccessRate).toBe(100);
        expect(stats.batchOperations.avgBatchSize).toBe(2);
      });

      it('should handle mixed success/failure in fallback mode', async () => {
        // Mock batch endpoint 404, then individual write responses
        global.fetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404
          })
          // First individual write succeeds
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
          })
          // Second individual write fails
          .mockRejectedValueOnce(new Error('Write failed'));

        const traceBatch = [
          { content: 'content1', originalTrace: { actionId: 'action1' } },
          { content: 'content2', originalTrace: { actionId: 'action2' } }
        ];

        const result = await handler.writeBatch(traceBatch);

        // Wait for queue processing
        await waitForQueueProcessing(handler);

        expect(result).toBe(true); // Should return true if at least one succeeds
      });
    });

    describe('batch statistics', () => {
      beforeEach(() => {
        handler = new FileTraceOutputHandler({
          outputDirectory: './test-traces',
          logger: mockLogger,
        });
      });

      it('should return zero stats for new handler', () => {
        const stats = handler.getStatistics();
        
        expect(stats.batchOperations.totalBatches).toBe(0);
        expect(stats.batchOperations.totalBatchedTraces).toBe(0);
        expect(stats.batchOperations.batchSuccessRate).toBe(0);
        expect(stats.batchOperations.avgBatchSize).toBe(0);
      });

      it('should calculate success rate correctly', async () => {
        // First batch succeeds
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

        await handler.writeBatch([
          { content: 'content1', originalTrace: { actionId: 'action1' } }
        ]);

        // Second batch fails
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 500
        });

        await handler.writeBatch([
          { content: 'content2', originalTrace: { actionId: 'action2' } }
        ]);

        const stats = handler.getStatistics();
        expect(stats.batchOperations.totalBatches).toBe(2);
        expect(stats.batchOperations.batchSuccessRate).toBe(50);
      });
    });
  });
});
