/**
 * @file Unit tests for ActionTraceOutputService export functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';

describe('ActionTraceOutputService - Export Functionality', () => {
  let service;
  let mockStorageAdapter;
  let mockTraceDirectoryManager;
  let mockLogger;
  let mockEventBus;
  let mockJsonFormatter;
  let mockHumanReadableFormatter;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set default File System Access API availability for main tests
    // Individual test suites can override this as needed
    global.window.showDirectoryPicker = jest.fn();
    // Mock storage adapter
    mockStorageAdapter = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      getAllKeys: jest.fn(),
    };

    // Mock trace directory manager
    mockTraceDirectoryManager = {
      selectDirectory: jest.fn(),
      ensureSubdirectoryExists: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Mock formatters
    mockJsonFormatter = {
      format: jest.fn((data) => JSON.stringify(data, null, 2)),
    };

    mockHumanReadableFormatter = {
      format: jest.fn((data) => `Formatted: ${JSON.stringify(data)}`),
    };

    // Create service instance
    service = new ActionTraceOutputService({
      storageAdapter: mockStorageAdapter,
      traceDirectoryManager: mockTraceDirectoryManager,
      logger: mockLogger,
      eventBus: mockEventBus,
      jsonFormatter: mockJsonFormatter,
      humanReadableFormatter: mockHumanReadableFormatter,
    });
  });

  describe('exportTracesToFileSystem', () => {
    it('should prompt user for directory selection', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'test-dir',
        getFileHandle: jest.fn(),
      };
      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue([]);

      // Act
      const result = await service.exportTracesToFileSystem();

      // Assert
      expect(mockTraceDirectoryManager.selectDirectory).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('No traces found to export');
    });

    it('should handle permission denial gracefully', async () => {
      // Setup
      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(null);

      // Act
      const result = await service.exportTracesToFileSystem();

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('User cancelled directory selection');
    });

    it('should export traces to selected directory', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn(),
            close: jest.fn(),
          }),
        }),
      };

      const mockTraces = [
        {
          id: 'trace-1',
          timestamp: Date.now(),
          data: { actionType: 'test', actorId: 'actor-1' },
        },
        {
          id: 'trace-2',
          timestamp: Date.now(),
          data: { actionType: 'test', actorId: 'actor-2' },
        },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      const result = await service.exportTracesToFileSystem();

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalTraces).toBe(2);
      expect(result.exportedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledTimes(2);
    });

    it('should generate appropriate file names', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn(),
            close: jest.fn(),
          }),
        }),
      };

      const mockTraces = [
        {
          id: 'trace-1',
          timestamp: new Date('2024-01-01T12:00:00.000Z').getTime(),
          data: { actionType: 'move', actorId: 'actor-1' },
        },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      await service.exportTracesToFileSystem(null, 'json');

      // Assert
      const calls = mockDirectoryHandle.getFileHandle.mock.calls;
      expect(calls[0][0]).toMatch(/move.*\.json$/);
    });

    it('should format traces correctly for export', async () => {
      // Setup
      const writtenContent = [];
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn((content) => writtenContent.push(content)),
            close: jest.fn(),
          }),
        }),
      };

      const mockTraces = [
        {
          id: 'trace-1',
          timestamp: Date.now(),
          data: { actionType: 'test', value: 123 },
        },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      await service.exportTracesToFileSystem(null, 'json');

      // Assert
      expect(writtenContent.length).toBe(1);
      const parsed = JSON.parse(writtenContent[0]);
      expect(parsed).toBeDefined();
    });

    it('should handle export errors for individual traces', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest
          .fn()
          .mockResolvedValueOnce({
            createWritable: jest.fn().mockResolvedValue({
              write: jest.fn(),
              close: jest.fn(),
            }),
          })
          .mockRejectedValueOnce(new Error('Write failed')),
      };

      const mockTraces = [
        { id: 'trace-1', timestamp: Date.now(), data: {} },
        { id: 'trace-2', timestamp: Date.now(), data: {} },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      const result = await service.exportTracesToFileSystem();

      // Assert
      expect(result.success).toBe(true);
      expect(result.exportedCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    it('should prevent concurrent exports', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn(),
            close: jest.fn(),
          }),
        }),
      };

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue([
        { id: 'trace-1', timestamp: Date.now(), data: {} },
      ]);

      // Act
      const promise1 = service.exportTracesToFileSystem();
      const promise2 = service.exportTracesToFileSystem();

      // Assert
      await expect(promise2).rejects.toThrow('Export already in progress');
      await promise1; // Let first export complete
    });

    it('should dispatch progress events during export', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn(),
            close: jest.fn(),
          }),
        }),
      };

      const mockTraces = [
        { id: 'trace-1', timestamp: Date.now(), data: {} },
        { id: 'trace-2', timestamp: Date.now(), data: {} },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      await service.exportTracesToFileSystem();

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TRACE_EXPORT_PROGRESS',
          payload: expect.objectContaining({
            progress: expect.any(Number),
            current: expect.any(Number),
            total: 2,
          }),
        })
      );
    });

    it('should filter traces by IDs when provided', async () => {
      // Setup
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn(),
            close: jest.fn(),
          }),
        }),
      };

      const mockTraces = [
        { id: 'trace-1', timestamp: Date.now(), data: {} },
        { id: 'trace-2', timestamp: Date.now(), data: {} },
        { id: 'trace-3', timestamp: Date.now(), data: {} },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      const result = await service.exportTracesToFileSystem([
        'trace-1',
        'trace-3',
      ]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalTraces).toBe(2);
      expect(result.exportedCount).toBe(2);
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledTimes(2);
    });

    it('should support text format export', async () => {
      // Setup
      const writtenContent = [];
      const mockDirectoryHandle = {
        name: 'export-dir',
        getFileHandle: jest.fn().mockResolvedValue({
          createWritable: jest.fn().mockResolvedValue({
            write: jest.fn((content) => writtenContent.push(content)),
            close: jest.fn(),
          }),
        }),
      };

      const mockTraces = [
        {
          id: 'trace-1',
          timestamp: Date.now(),
          data: { actionType: 'test', value: 123 },
        },
      ];

      mockTraceDirectoryManager.selectDirectory.mockResolvedValue(
        mockDirectoryHandle
      );
      mockTraceDirectoryManager.ensureSubdirectoryExists.mockResolvedValue(
        mockDirectoryHandle
      );
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      await service.exportTracesToFileSystem(null, 'text');

      // Assert
      expect(writtenContent.length).toBe(1);
      expect(writtenContent[0]).toContain('Trace ID: trace-1');
      expect(writtenContent[0]).toContain('Formatted:'); // From mock formatter
    });
  });

  describe('exportTracesAsDownload', () => {
    beforeEach(() => {
      // Reset global DOM API mocks for this test suite
      jest.clearAllMocks();

      // DOM APIs (URL, Blob) are now mocked globally in jest.setup.js
      // File System Access API is unavailable for fallback testing
      global.window.showDirectoryPicker = undefined;

      // Mock document.createElement specifically for download tests
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };
      global.document.createElement = jest.fn(() => mockAnchor);
    });

    it('should fall back to download when File System Access API not supported', async () => {
      // Setup - File System Access API unavailable (already set in beforeEach)
      const mockTraces = [{ id: 'trace-1', timestamp: Date.now(), data: {} }];
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      const result = await service.exportTracesToFileSystem();

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('download');
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });

    it('should create download with correct filename', async () => {
      // Setup
      const mockTraces = [{ id: 'trace-1', timestamp: Date.now(), data: {} }];
      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Act
      const result = await service.exportTracesAsDownload('json');

      // Assert
      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/action-traces-\d+\.json/);
    });

    it('should handle empty trace list', async () => {
      // Setup
      mockStorageAdapter.getItem.mockResolvedValue([]);

      // Act
      const result = await service.exportTracesAsDownload();

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('No traces to export');
    });
  });
});
