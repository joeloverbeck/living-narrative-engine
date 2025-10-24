/**
 * @file Unit tests for browser-based TraceDirectoryManager
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TraceDirectoryManager from '../../../../src/actions/tracing/traceDirectoryManager.js';

describe('TraceDirectoryManager', () => {
  let manager;
  let mockStorageProvider;
  let mockLogger;
  let mockDirectoryHandle;
  let originalWindow;
  let mockShowDirectoryPicker;

  beforeEach(() => {
    // Save original window
    originalWindow = global.window;

    // Mock FileSystemDirectoryHandle
    mockDirectoryHandle = {
      name: 'test-dir',
      kind: 'directory',
      getDirectoryHandle: jest.fn().mockImplementation(() => {
        // Return a new mock directory handle for each call
        return Promise.resolve({
          name: 'sub-dir',
          kind: 'directory',
          getDirectoryHandle: jest.fn().mockImplementation(() => {
            return Promise.resolve({
              name: 'sub-sub-dir',
              kind: 'directory',
              getDirectoryHandle: jest.fn().mockResolvedValue({
                name: 'deep-dir',
                kind: 'directory',
                getDirectoryHandle: jest.fn().mockResolvedValue({
                  name: 'deeper-dir',
                  kind: 'directory',
                  getDirectoryHandle: jest.fn().mockResolvedValue({
                    name: 'deepest-dir',
                    kind: 'directory',
                    getDirectoryHandle: jest.fn(),
                  }),
                }),
              }),
            });
          }),
        });
      }),
      queryPermission: jest.fn().mockResolvedValue('granted'),
      requestPermission: jest.fn().mockResolvedValue('granted'),
    };

    // Create a mock for showDirectoryPicker
    mockShowDirectoryPicker = jest.fn().mockResolvedValue(mockDirectoryHandle);

    // Mock window with showDirectoryPicker - ensure it's properly available
    global.window = {
      ...global.window, // Preserve any existing window properties
      showDirectoryPicker: mockShowDirectoryPicker,
    };

    // Also make sure window.showDirectoryPicker is available directly
    if (!global.window) {
      global.window = {};
    }
    global.window.showDirectoryPicker = mockShowDirectoryPicker;

    mockStorageProvider = {
      writeFileAtomically: jest.fn().mockResolvedValue({ success: true }),
      listFiles: jest.fn().mockResolvedValue([]),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    manager = new TraceDirectoryManager({
      storageProvider: mockStorageProvider,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.window = originalWindow;
  });

  describe('Constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(manager).toBeDefined();
      expect(() => manager.clearCache()).not.toThrow();
    });

    it('should validate storage provider dependency', () => {
      expect(
        () =>
          new TraceDirectoryManager({
            storageProvider: null,
            logger: mockLogger,
          })
      ).toThrow('Missing required dependency');
    });

    it('should validate storage provider has required methods', () => {
      const invalidProvider = { someMethod: jest.fn() };
      expect(
        () =>
          new TraceDirectoryManager({
            storageProvider: invalidProvider,
            logger: mockLogger,
          })
      ).toThrow('Invalid or missing method');
    });

    it('should handle missing logger gracefully with fallback', () => {
      const consoleDebug = jest.spyOn(console, 'debug').mockImplementation();
      const managerWithoutLogger = new TraceDirectoryManager({
        storageProvider: mockStorageProvider,
        logger: null,
      });
      expect(managerWithoutLogger).toBeDefined();
      consoleDebug.mockRestore();
    });
  });

  describe('Directory Creation', () => {
    it('should create directory when it does not exist', async () => {
      // Mock is already set up in beforeEach
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'actions',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.path).toBe('traces/actions');
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith(
        'traces',
        { create: true }
      );
      expect(firstSubDir.getDirectoryHandle).toHaveBeenCalledWith('actions', {
        create: true,
      });
    });

    it('should handle permission denial', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('denied');
      mockDirectoryHandle.requestPermission.mockResolvedValue('denied');
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
      // The warning is logged in #getRootDirectoryHandle
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User denied write permission to directory'
      );
    });

    it('should cache successful directory operations', async () => {
      // Setup proper mock chain for successful directory creation
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'actions',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      // First call
      const result1 = await manager.ensureDirectoryExists('./traces/actions');
      // Second call
      const result2 = await manager.ensureDirectoryExists('./traces/actions');

      expect(result1.success).toBe(true);
      expect(result1.created).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);
      expect(result2.existed).toBe(true);

      // Should only create directory once
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledTimes(1); // traces only, since second call is cached
    });

    it('should handle user cancellation', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      mockShowDirectoryPicker.mockRejectedValue(abortError);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'User denied directory access or cancelled selection'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User cancelled directory selection'
      );
    });

    it('should handle nested directory creation', async () => {
      // Setup proper mock chain for nested directories
      const yearDir = {
        name: '2024',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: '01',
          kind: 'directory',
          getDirectoryHandle: jest.fn().mockResolvedValue({
            name: '15',
            kind: 'directory',
          }),
        }),
      };
      const actionsDir = {
        name: 'actions',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValueOnce(yearDir),
      };
      const tracesDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValueOnce(actionsDir),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(tracesDir);

      const result = await manager.ensureDirectoryExists(
        './traces/actions/2024/01/15'
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('traces/actions/2024/01/15');
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith(
        'traces',
        { create: true }
      );
      expect(tracesDir.getDirectoryHandle).toHaveBeenCalledWith('actions', {
        create: true,
      });
      expect(actionsDir.getDirectoryHandle).toHaveBeenCalledWith('2024', {
        create: true,
      });
    });

    it('should handle directory creation errors', async () => {
      const error = new Error('Failed to create');
      error.name = 'NotAllowedError';
      // Ensure root handle is obtained successfully first
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle unexpected errors while finalizing directory creation', async () => {
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'actions',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Logger failure');
      expect(result.path).toBe('./traces/actions');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to ensure directory exists',
        expect.any(Error),
        { path: './traces/actions' }
      );
    });

    it('should handle empty directory path', async () => {
      await expect(manager.ensureDirectoryExists('')).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null directory path', async () => {
      await expect(manager.ensureDirectoryExists(null)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle undefined directory path', async () => {
      await expect(manager.ensureDirectoryExists(undefined)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Path Validation', () => {
    it('should validate safe paths', () => {
      const result = manager.validateDirectoryPath('./traces/actions');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedPath).toBe('traces/actions');
    });

    it('should normalize paths with extra slashes', () => {
      const result = manager.validateDirectoryPath(
        './traces//actions/archive/'
      );

      expect(result.isValid).toBe(true);
      expect(result.normalizedPath).toBe('traces/actions/archive');
    });

    it('should normalize paths with backslashes', () => {
      const result = manager.validateDirectoryPath('traces\\actions\\test');

      expect(result.isValid).toBe(true);
      expect(result.normalizedPath).toBe('traces/actions/test');
    });

    it('should reject path traversal attempts', () => {
      const result = manager.validateDirectoryPath('../../etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Path contains directory traversal sequences'
      );
    });

    it('should reject path traversal with backslashes', () => {
      const result = manager.validateDirectoryPath('..\\..\\etc\\passwd');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Path contains directory traversal sequences'
      );
    });

    it('should reject paths with null bytes', () => {
      const result = manager.validateDirectoryPath('traces/test\0/actions');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path contains null bytes');
    });

    it('should reject paths with invalid characters', () => {
      const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
      for (const char of invalidChars) {
        const result = manager.validateDirectoryPath(`traces/test${char}dir`);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Path contains invalid characters');
      }
    });

    it('should reject reserved Windows names', () => {
      const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];
      for (const name of reservedNames) {
        const result = manager.validateDirectoryPath(`traces/${name}/test`);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(`Path contains reserved name: ${name}`);
      }
    });

    it('should reject reserved names case-insensitively', () => {
      const result = manager.validateDirectoryPath('traces/CON/test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Path contains reserved name: CON');
    });

    it('should reject paths exceeding maximum length', () => {
      const longPath = 'a'.repeat(256);
      const result = manager.validateDirectoryPath(longPath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Path exceeds maximum length (255 characters)'
      );
    });

    it('should accept paths at maximum length', () => {
      const maxPath = 'a'.repeat(255);
      const result = manager.validateDirectoryPath(maxPath);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty path validation', () => {
      expect(() => manager.validateDirectoryPath('')).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null path validation', () => {
      expect(() => manager.validateDirectoryPath(null)).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle undefined path validation', () => {
      expect(() => manager.validateDirectoryPath(undefined)).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should clear directory cache', async () => {
      // Setup proper mock for successful directory creation
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'actions',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      await manager.ensureDirectoryExists('./traces/actions');
      expect(manager.getCachedDirectories()).toContain('traces/actions');

      manager.clearCache();
      expect(manager.getCachedDirectories()).toEqual([]);
    });

    it('should clear root handle when clearing cache', async () => {
      // Setup proper mock for first directory creation
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'actions',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      await manager.ensureDirectoryExists('./traces/actions');
      manager.clearCache();

      // Setup mock for second directory creation after cache clear
      const secondSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'rules',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(
        secondSubDir
      );

      // Should prompt for new root handle after cache clear
      await manager.ensureDirectoryExists('./traces/rules');
      expect(mockShowDirectoryPicker).toHaveBeenCalledTimes(2);
    });

    it('should provide list of cached directories', async () => {
      // Setup proper mock for first directory
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest
          .fn()
          .mockResolvedValueOnce({
            name: 'actions',
            kind: 'directory',
          })
          .mockResolvedValueOnce({
            name: 'rules',
            kind: 'directory',
          }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);
      // For second call, reuse the same traces directory from cache
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      await manager.ensureDirectoryExists('./traces/actions');
      await manager.ensureDirectoryExists('./traces/rules');

      const cached = manager.getCachedDirectories();
      expect(cached).toContain('traces/actions');
      expect(cached).toContain('traces/rules');
      expect(cached).toHaveLength(2);
    });

    it('should log cache clear statistics', () => {
      manager.clearCache();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Directory creation cache cleared',
        { clearedCount: 0 }
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Ensure showDirectoryPicker succeeds for error handling tests
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
    });

    it('should handle NotAllowedError', async () => {
      const error = new Error('Not allowed');
      error.name = 'NotAllowedError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle NotFoundError', async () => {
      const error = new Error('Not found');
      error.name = 'NotFoundError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Directory or parent directory not found');
    });

    it('should handle QuotaExceededError', async () => {
      const error = new Error('Quota exceeded');
      error.name = 'QuotaExceededError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage quota exceeded');
    });

    it('should handle TypeMismatchError', async () => {
      const error = new Error('Type mismatch');
      error.name = 'TypeMismatchError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a directory');
    });

    it('should handle InvalidStateError', async () => {
      const error = new Error('Invalid state');
      error.name = 'InvalidStateError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid directory state');
    });

    it('should handle SecurityError', async () => {
      const error = new Error('Security error');
      error.name = 'SecurityError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security restrictions');
    });

    it('should handle AbortError during directory creation', async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted by the user');
    });

    it('should handle unknown errors', async () => {
      const error = new Error('Unknown error');
      error.name = 'UnknownError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser filesystem error: Unknown error');
    });

    it('should handle errors without message', async () => {
      const error = new Error();
      error.name = 'SomeError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser filesystem error: SomeError');
    });

    it('should handle errors without name or message', async () => {
      const error = {};
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser filesystem error: unknown');
    });

    it('should handle generic exceptions during ensureDirectoryExists', async () => {
      mockShowDirectoryPicker.mockRejectedValue(new Error('Generic error'));

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'User denied directory access or cancelled selection'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get root directory handle',
        expect.any(Error)
      );
    });
  });

  describe('Permission Handling', () => {
    it('should request permission when not granted initially', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('prompt');
      mockDirectoryHandle.requestPermission.mockResolvedValue('granted');

      // Setup proper mock for successful directory creation after permission granted
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'actions',
          kind: 'directory',
        }),
      };
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(firstSubDir);

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(true);
      expect(mockDirectoryHandle.requestPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    it('should handle permission request denial', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('prompt');
      mockDirectoryHandle.requestPermission.mockResolvedValue('denied');

      const result = await manager.ensureDirectoryExists('./traces/actions');

      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
    });

    it('should reuse root handle when permissions are already granted', async () => {
      // Setup proper mock for first directory
      const firstSubDir = {
        name: 'traces',
        kind: 'directory',
        getDirectoryHandle: jest
          .fn()
          .mockResolvedValueOnce({
            name: 'actions',
            kind: 'directory',
          })
          .mockResolvedValueOnce({
            name: 'rules',
            kind: 'directory',
          }),
      };
      mockDirectoryHandle.getDirectoryHandle
        .mockResolvedValueOnce(firstSubDir)
        .mockResolvedValueOnce(firstSubDir);

      await manager.ensureDirectoryExists('./traces/actions');
      await manager.ensureDirectoryExists('./traces/rules');

      // Should only prompt once
      expect(mockShowDirectoryPicker).toHaveBeenCalledTimes(1);
    });
  });

  describe('Path Normalization', () => {
    it('should normalize various path formats to consistent format', async () => {
      const paths = [
        './traces/actions',
        'traces/actions/',
        'traces//actions',
        './traces//actions/',
        'traces\\actions',
      ];

      for (const path of paths) {
        manager.clearCache(); // Clear cache to test each path independently

        // Setup proper mock for each iteration
        const firstSubDir = {
          name: 'traces',
          kind: 'directory',
          getDirectoryHandle: jest.fn().mockResolvedValue({
            name: 'actions',
            kind: 'directory',
          }),
        };
        mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(
          firstSubDir
        );

        const result = await manager.ensureDirectoryExists(path);
        expect(result.path).toBe('traces/actions');
      }
    });
  });

  describe('Invalid Path Rejection', () => {
    it('should reject and log invalid paths before attempting creation', async () => {
      const result = await manager.ensureDirectoryExists('../../../etc');

      expect(result.success).toBe(false);
      expect(result.error).toContain('directory traversal');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid directory path',
        expect.objectContaining({
          path: '../../../etc',
          errors: expect.arrayContaining([
            'Path contains directory traversal sequences',
          ]),
        })
      );
      // Should not attempt to create directory
      expect(mockShowDirectoryPicker).not.toHaveBeenCalled();
    });

    it('should reject paths with multiple validation errors', async () => {
      const result = await manager.ensureDirectoryExists('../con/test<>');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3); // traversal + reserved + invalid chars
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Directory Selection (selectDirectory)', () => {
    it('should successfully select directory with granted permissions', async () => {
      const result = await manager.selectDirectory();

      expect(result).toBe(mockDirectoryHandle);
      expect(mockShowDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
        startIn: 'documents',
      });
      expect(mockDirectoryHandle.queryPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Directory selected for export',
        { name: 'test-dir' }
      );
    });

    it('should request permission when not initially granted', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('prompt');
      mockDirectoryHandle.requestPermission.mockResolvedValue('granted');

      const result = await manager.selectDirectory();

      expect(result).toBe(mockDirectoryHandle);
      expect(mockDirectoryHandle.requestPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Directory selected for export',
        { name: 'test-dir' }
      );
    });

    it('should return null when permission request is denied', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('prompt');
      mockDirectoryHandle.requestPermission.mockResolvedValue('denied');

      const result = await manager.selectDirectory();

      expect(result).toBe(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User denied write permission to directory'
      );
    });

    it('should handle user cancellation during directory selection', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      mockShowDirectoryPicker.mockRejectedValue(abortError);

      const result = await manager.selectDirectory();

      expect(result).toBe(null);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User cancelled directory selection'
      );
    });

    it('should handle generic errors during directory selection', async () => {
      const genericError = new Error('Generic selection error');
      mockShowDirectoryPicker.mockRejectedValue(genericError);

      const result = await manager.selectDirectory();

      expect(result).toBe(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to select directory',
        genericError
      );
    });

    it('should handle permission query errors', async () => {
      mockDirectoryHandle.queryPermission.mockRejectedValue(
        new Error('Permission query failed')
      );

      const result = await manager.selectDirectory();

      expect(result).toBe(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to select directory',
        expect.any(Error)
      );
    });

    it('should handle permission request errors', async () => {
      mockDirectoryHandle.queryPermission.mockResolvedValue('prompt');
      mockDirectoryHandle.requestPermission.mockRejectedValue(
        new Error('Permission request failed')
      );

      const result = await manager.selectDirectory();

      expect(result).toBe(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to select directory',
        expect.any(Error)
      );
    });
  });

  describe('Subdirectory Management (ensureSubdirectoryExists)', () => {
    let mockParentHandle;

    beforeEach(() => {
      mockParentHandle = {
        name: 'parent-dir',
        kind: 'directory',
        getDirectoryHandle: jest.fn().mockResolvedValue({
          name: 'child-dir',
          kind: 'directory',
        }),
      };
    });

    it('should successfully create subdirectory', async () => {
      const result = await manager.ensureSubdirectoryExists(
        mockParentHandle,
        'child-dir'
      );

      expect(result).toEqual({
        name: 'child-dir',
        kind: 'directory',
      });
      expect(mockParentHandle.getDirectoryHandle).toHaveBeenCalledWith(
        'child-dir',
        { create: true }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Subdirectory ensured', {
        name: 'child-dir',
      });
    });

    it('should return null for null parent handle', async () => {
      const result = await manager.ensureSubdirectoryExists(null, 'child-dir');

      expect(result).toBe(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Parent directory handle is required'
      );
    });

    it('should return null for undefined parent handle', async () => {
      const result = await manager.ensureSubdirectoryExists(
        undefined,
        'child-dir'
      );

      expect(result).toBe(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Parent directory handle is required'
      );
    });

    it('should handle subdirectory creation errors', async () => {
      const creationError = new Error('Failed to create subdirectory');
      mockParentHandle.getDirectoryHandle.mockRejectedValue(creationError);

      const result = await manager.ensureSubdirectoryExists(
        mockParentHandle,
        'child-dir'
      );

      expect(result).toBe(null);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to ensure subdirectory exists',
        creationError,
        { subdirectoryName: 'child-dir' }
      );
    });

    it('should validate subdirectory name', async () => {
      await expect(
        manager.ensureSubdirectoryExists(mockParentHandle, '')
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate subdirectory name for null', async () => {
      await expect(
        manager.ensureSubdirectoryExists(mockParentHandle, null)
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate subdirectory name for undefined', async () => {
      await expect(
        manager.ensureSubdirectoryExists(mockParentHandle, undefined)
      ).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle different types of filesystem errors in subdirectory creation', async () => {
      const errorTypes = [
        { name: 'NotAllowedError', message: 'Not allowed' },
        { name: 'QuotaExceededError', message: 'Quota exceeded' },
        { name: 'SecurityError', message: 'Security error' },
      ];

      for (const errorType of errorTypes) {
        const error = new Error(errorType.message);
        error.name = errorType.name;
        mockParentHandle.getDirectoryHandle.mockRejectedValueOnce(error);

        const result = await manager.ensureSubdirectoryExists(
          mockParentHandle,
          'test-dir'
        );

        expect(result).toBe(null);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to ensure subdirectory exists',
          error,
          { subdirectoryName: 'test-dir' }
        );
      }
    });
  });
});
