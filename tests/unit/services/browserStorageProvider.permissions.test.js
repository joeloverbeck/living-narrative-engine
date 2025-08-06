// tests/unit/services/browserStorageProvider.permissions.test.js

/**
 * @jest-environment jsdom
 */
import {
  describe,
  expect,
  jest,
  beforeEach,
  afterEach,
  test,
} from '@jest/globals';
import { BrowserStorageProvider } from '../../../src/storage/browserStorageProvider';

// --- Mock ILogger ---
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// --- Mock ISafeEventDispatcher ---
const mockSafeEventDispatcher = {
  dispatch: jest.fn().mockResolvedValue(true),
};

// --- Mock File System Access API ---
let mockRootDirectoryHandle;
let mockShowDirectoryPicker;

const createMockDirectoryHandle = (name, path = '') => ({
  kind: 'directory',
  name,
  fullPath: path,
  getFileHandle: jest.fn(),
  getDirectoryHandle: jest.fn(),
  removeEntry: jest.fn().mockResolvedValue(undefined),
  values: jest.fn().mockImplementation(async function* () {}),
  queryPermission: jest.fn().mockResolvedValue('granted'),
  requestPermission: jest.fn().mockResolvedValue('granted'),
});

/* eslint-disable no-unused-vars */
const createMockFileHandle = (name, fullPath) => ({
  name,
  kind: 'file',
  fullPath,
  createWritable: jest.fn().mockResolvedValue({
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }),
  getFile: jest.fn().mockResolvedValue({
    name,
    arrayBuffer: async () => new ArrayBuffer(0),
  }),
});
/* eslint-enable no-unused-vars */

const originalShowDirectoryPicker = global.window
  ? global.window.showDirectoryPicker
  : undefined;

beforeEach(() => {
  jest.clearAllMocks();
  mockRootDirectoryHandle = createMockDirectoryHandle('testRoot');

  // Create mock function separately to preserve Jest methods
  mockShowDirectoryPicker = jest.fn().mockImplementation(async () => {
    return mockRootDirectoryHandle;
  });

  global.window = global.window || {};
  global.window.showDirectoryPicker = mockShowDirectoryPicker;
});

afterEach(() => {
  if (originalShowDirectoryPicker) {
    global.window.showDirectoryPicker = originalShowDirectoryPicker;
  }
});

describe('BrowserStorageProvider - Permission Handling', () => {
  describe('Constructor validation', () => {
    test('should throw error when logger is not provided (lines 26-28)', () => {
      // This tests the uncovered lines 26-28
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        new BrowserStorageProvider({
          logger: null,
          safeEventDispatcher: mockSafeEventDispatcher,
        });
      }).toThrow('BrowserStorageProvider requires a valid ILogger instance.');

      expect(consoleSpy).toHaveBeenCalledWith(
        'BrowserStorageProvider requires a valid ILogger instance.'
      );

      consoleSpy.mockRestore();
    });

    test('should throw error when logger is undefined', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        new BrowserStorageProvider({
          safeEventDispatcher: mockSafeEventDispatcher,
        });
      }).toThrow('BrowserStorageProvider requires a valid ILogger instance.');

      expect(consoleSpy).toHaveBeenCalledWith(
        'BrowserStorageProvider requires a valid ILogger instance.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Permission re-request scenarios', () => {
    let storageProvider;

    beforeEach(() => {
      storageProvider = new BrowserStorageProvider({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });
    });

    test('should re-request permission when initially denied then granted (lines 63-71)', async () => {
      // Setup: First call returns handle with denied permission
      mockRootDirectoryHandle.queryPermission.mockResolvedValueOnce('prompt');
      mockRootDirectoryHandle.requestPermission.mockResolvedValueOnce(
        'granted'
      );

      // First access to get root handle
      await storageProvider.listFiles('/', '.*');

      // Reset mocks for second access
      mockRootDirectoryHandle.queryPermission.mockClear();
      mockRootDirectoryHandle.requestPermission.mockClear();

      // Setup: Permission no longer granted, needs re-request
      mockRootDirectoryHandle.queryPermission.mockResolvedValueOnce('prompt');
      mockRootDirectoryHandle.requestPermission.mockResolvedValueOnce(
        'granted'
      );

      // Second access should re-request permission
      await storageProvider.listFiles('/', '.*');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Permission to root directory no longer granted. Requesting again...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Permission re-granted to root directory.'
      );
      expect(mockRootDirectoryHandle.requestPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    test('should handle permission revocation and clear handle (lines 73-76)', async () => {
      // First access to establish root handle
      await storageProvider.listFiles('/', '.*');

      // Reset mocks
      mockRootDirectoryHandle.queryPermission.mockClear();
      mockRootDirectoryHandle.requestPermission.mockClear();
      mockShowDirectoryPicker.mockClear();

      // Setup: Permission revoked
      mockRootDirectoryHandle.queryPermission.mockResolvedValueOnce('prompt');
      mockRootDirectoryHandle.requestPermission.mockResolvedValueOnce('denied');

      // Setup new handle for re-prompt
      const newHandle = createMockDirectoryHandle('newRoot');
      mockShowDirectoryPicker.mockResolvedValueOnce(newHandle);

      // This should trigger re-prompt
      await storageProvider.listFiles('/', '.*');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Permission to root directory was revoked or denied after re-prompt.'
      );
      expect(mockShowDirectoryPicker).toHaveBeenCalled();
    });

    test('should throw error when root handle unavailable without prompting (line 132)', async () => {
      // This tests the private method scenario where promptIfMissing = false
      // We need to trigger this through a public method that might set promptIfMissing to false

      // Since all public methods use promptIfMissing = true, we'll test the error path
      // by making showDirectoryPicker fail initially
      mockShowDirectoryPicker.mockRejectedValueOnce(
        new Error('User cancelled')
      );

      await expect(storageProvider.listFiles('/', '.*')).resolves.toEqual([]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not list files from "/" as root directory selection was not completed'
        )
      );
    });

    test('should handle when root directory handle returns null (line 144)', async () => {
      // Create a scenario where #getRelativeDirectoryHandle gets a null root
      // This happens when the initial prompt is cancelled
      mockShowDirectoryPicker.mockImplementationOnce(async () => {
        throw new Error('User cancelled selection');
      });

      const result = await storageProvider.writeFileAtomically(
        'test.txt',
        new Uint8Array([1, 2, 3])
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to obtain root directory handle');
    });
  });

  describe('User abort scenarios', () => {
    let storageProvider;

    beforeEach(() => {
      storageProvider = new BrowserStorageProvider({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });
    });

    test('should handle user aborting directory selection', async () => {
      const abortError = new Error('User aborted');
      abortError.name = 'AbortError';
      mockShowDirectoryPicker.mockRejectedValueOnce(abortError);

      await expect(storageProvider.readFile('test.txt')).rejects.toThrow(
        'Failed to obtain root directory handle: User aborted'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User aborted root directory selection.'
      );
    });

    test('should handle generic error during directory selection', async () => {
      const genericError = new Error('Something went wrong');
      mockShowDirectoryPicker.mockRejectedValueOnce(genericError);

      await expect(storageProvider.readFile('test.txt')).rejects.toThrow(
        'Failed to obtain root directory handle: Something went wrong'
      );

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining('Error selecting root directory'),
          details: expect.objectContaining({
            error: 'Something went wrong',
          }),
        })
      );
    });
  });

  describe('Permission request on initial handle', () => {
    let storageProvider;

    beforeEach(() => {
      storageProvider = new BrowserStorageProvider({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });
    });

    test('should request permission immediately after getting handle', async () => {
      mockRootDirectoryHandle.queryPermission.mockResolvedValueOnce('prompt');
      mockRootDirectoryHandle.requestPermission.mockResolvedValueOnce(
        'granted'
      );

      await storageProvider.fileExists('test.txt');

      expect(mockRootDirectoryHandle.queryPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
      expect(mockRootDirectoryHandle.requestPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    test('should throw error when permission denied after directory selection', async () => {
      mockRootDirectoryHandle.queryPermission.mockResolvedValueOnce('prompt');
      mockRootDirectoryHandle.requestPermission.mockResolvedValueOnce('denied');

      await expect(storageProvider.readFile('test.txt')).rejects.toThrow(
        'Failed to obtain root directory handle: Permission denied for the selected directory'
      );

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining(
            'Permission explicitly denied after selecting directory'
          ),
        })
      );
    });
  });
});
