// tests/services/browserStorageProvider.test.js

/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  jest,
  beforeEach,
  afterEach,
  test,
} from '@jest/globals';
import { BrowserStorageProvider } from '../../src/storage/browserStorageProvider'; // Adjust path as needed

// --- Mock ILogger ---
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// --- Mock File System Access API ---
let mockFileSystemState;

const createMockWritableStream = (targetPath) => ({
  write: jest.fn().mockImplementation(async function (data) {
    mockFileSystemState[this.targetPathValue] = new Uint8Array(data);
  }),
  close: jest.fn().mockResolvedValue(undefined),
  targetPathValue: targetPath,
});

const createMockFileHandle = (name, fullPath) => ({
  name,
  kind: 'file',
  fullPath,
  createWritable: jest.fn().mockImplementation(async function () {
    if (this.fullPath === undefined) {
      throw new Error(
        "Mock FileHandle: fullPath is undefined on 'this' when creating writable."
      );
    }
    return createMockWritableStream(this.fullPath);
  }),
  getFile: jest.fn().mockImplementation(async function () {
    if (
      mockFileSystemState[this.fullPath] &&
      mockFileSystemState[this.fullPath].__isFileMock
    ) {
      return {
        name: this.name,
        arrayBuffer: async () =>
          mockFileSystemState[this.fullPath].content.buffer,
      };
    }
    const error = new Error(`Mock: File.getFile() not found: ${this.fullPath}`);
    error.name = 'NotFoundError';
    throw error;
  }),
});

const mockDirectoryHandleProto = {
  kind: 'directory',
  getFileHandle: jest.fn(),
  getDirectoryHandle: jest.fn(),
  removeEntry: jest.fn().mockResolvedValue(undefined),
  values: jest.fn().mockImplementation(async function* () {}),
  queryPermission: jest.fn().mockResolvedValue('granted'),
  requestPermission: jest.fn().mockResolvedValue('granted'),
};

const originalShowDirectoryPicker = global.window
  ? global.window.showDirectoryPicker
  : undefined;

beforeEach(() => {
  jest.clearAllMocks();
  mockFileSystemState = {};
  global.window.showDirectoryPicker = jest.fn().mockImplementation(async () => {
    return {
      ...mockDirectoryHandleProto,
      name: 'testRoot',
      fullPath: '', // Representing the root
    };
  });
});

afterEach(() => {
  if (global.window) {
    global.window.showDirectoryPicker = originalShowDirectoryPicker;
  }
});

describe('BrowserStorageProvider - writeFileAtomically', () => {
  let storageProvider;
  let rootDirHandleMockInstance;

  beforeEach(async () => {
    storageProvider = new BrowserStorageProvider({ logger: mockLogger });
    rootDirHandleMockInstance = await global.window.showDirectoryPicker();
    // Ensure subsequent calls in #getRootDirectoryHandle within a single test execution
    // don't re-trigger showDirectoryPicker if not intended.
    global.window.showDirectoryPicker.mockResolvedValue(
      rootDirHandleMockInstance
    );
  });

  test('should successfully write data to a new file in the root', async () => {
    const filePath = 'newFile.sav';
    const tempFilePath = `${filePath}.tmp`;
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    const tempFileHandleMock = createMockFileHandle(tempFilePath, tempFilePath);
    const finalFileHandleMock = createMockFileHandle(filePath, filePath);

    rootDirHandleMockInstance.getFileHandle.mockImplementation(
      async (name, options) => {
        if (name === tempFilePath) {
          if (options && options.create)
            mockFileSystemState[tempFilePath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return tempFileHandleMock;
        }
        if (name === filePath) {
          if (options && options.create)
            mockFileSystemState[filePath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return finalFileHandleMock;
        }
        throw new Error(`Unexpected getFileHandle in root: ${name}`);
      }
    );

    rootDirHandleMockInstance.removeEntry.mockImplementation(async (name) => {
      if (name === tempFilePath) {
        delete mockFileSystemState[tempFilePath];
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected removeEntry in root: ${name}`);
    });

    const result = await storageProvider.writeFileAtomically(filePath, data);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const tempStreamInstance =
      await tempFileHandleMock.createWritable.mock.results[0].value;
    expect(tempStreamInstance.write).toHaveBeenCalledWith(data);
    expect(tempStreamInstance.close).toHaveBeenCalledTimes(1);

    const finalStreamInstance =
      await finalFileHandleMock.createWritable.mock.results[0].value;
    expect(finalStreamInstance.write).toHaveBeenCalledWith(data);
    expect(finalStreamInstance.close).toHaveBeenCalledTimes(1);
    expect(mockFileSystemState[filePath]).toEqual(data);

    expect(rootDirHandleMockInstance.removeEntry).toHaveBeenCalledWith(
      tempFilePath
    );
    expect(mockFileSystemState[tempFilePath]).toBeUndefined();

    expect(mockLogger.info).toHaveBeenCalledWith(
      `BrowserStorageProvider: Successfully wrote ${data.byteLength} bytes to temporary file ${tempFilePath}.`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `BrowserStorageProvider: Successfully replaced/wrote final file ${filePath}.`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `BrowserStorageProvider: Successfully cleaned up temporary file ${tempFilePath}.`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `BrowserStorageProvider: Atomic write to ${filePath} completed successfully.`
    );
  });

  test('should successfully write a file, creating an intermediate directory', async () => {
    const dirPath = 'saves';
    const fileName = 'myGame.sav';
    const filePath = `${dirPath}/${fileName}`;
    const tempFileName = `${fileName}.tmp`;
    const tempFilePath = `${dirPath}/${tempFileName}`;
    const data = new Uint8Array([10, 20, 30]);

    const savesDirHandleMock = {
      ...mockDirectoryHandleProto,
      name: dirPath,
      fullPath: dirPath,
      getFileHandle: jest.fn(),
      removeEntry: jest.fn(),
    };
    const tempFileHandleMock = createMockFileHandle(tempFileName, tempFilePath);
    const finalFileHandleMock = createMockFileHandle(fileName, filePath);

    rootDirHandleMockInstance.getDirectoryHandle.mockImplementation(
      async (name, options) => {
        if (name === dirPath) {
          // For create or lookup
          if (options && options.create && !mockFileSystemState[dirPath]) {
            mockFileSystemState[dirPath] = { __isDirectoryMock: true };
          }
          if (mockFileSystemState[dirPath]?.__isDirectoryMock) {
            return savesDirHandleMock;
          }
        }
        throw new Error(`Unexpected directory handle request in root: ${name}`);
      }
    );

    savesDirHandleMock.getFileHandle.mockImplementation(
      async (name, options) => {
        if (name === tempFileName) {
          if (options && options.create)
            mockFileSystemState[tempFilePath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return tempFileHandleMock;
        }
        if (name === fileName) {
          if (options && options.create)
            mockFileSystemState[filePath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return finalFileHandleMock;
        }
        throw new Error(`Unexpected getFileHandle in ${dirPath}: ${name}`);
      }
    );

    savesDirHandleMock.removeEntry.mockImplementation(async (name) => {
      if (name === tempFileName) {
        delete mockFileSystemState[tempFilePath];
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected removeEntry in ${dirPath}: ${name}`);
    });

    const result = await storageProvider.writeFileAtomically(filePath, data);

    expect(result.success).toBe(true);
    expect(rootDirHandleMockInstance.getDirectoryHandle).toHaveBeenCalledWith(
      dirPath,
      { create: true }
    ); // For temp file creation path
    expect(rootDirHandleMockInstance.getDirectoryHandle).toHaveBeenCalledWith(
      dirPath,
      { create: true }
    ); // For final file creation path
    // For delete, #getRelativeDirectoryHandle is called with create:false. The mock above handles it.

    const tempStreamInstance =
      await tempFileHandleMock.createWritable.mock.results[0].value;
    expect(tempStreamInstance.write).toHaveBeenCalledWith(data);

    const finalStreamInstance =
      await finalFileHandleMock.createWritable.mock.results[0].value;
    expect(finalStreamInstance.write).toHaveBeenCalledWith(data);
    expect(mockFileSystemState[filePath]).toEqual(data);

    expect(savesDirHandleMock.removeEntry).toHaveBeenCalledWith(tempFileName);
    expect(mockFileSystemState[tempFilePath]).toBeUndefined();

    expect(mockLogger.info).toHaveBeenCalledWith(
      `BrowserStorageProvider: Atomic write to ${filePath} completed successfully.`
    );
  });

  test('should return error if underlying tempFileHandle.createWritable fails', async () => {
    const filePath = 'errorFile.sav';
    const tempFilePath = `${filePath}.tmp`;
    const data = new Uint8Array([1]);

    const erroringTempFileHandleMock = createMockFileHandle(
      tempFilePath,
      tempFilePath
    );
    erroringTempFileHandleMock.createWritable = jest
      .fn()
      .mockRejectedValue(new Error('Failed to create temp writable'));

    rootDirHandleMockInstance.getFileHandle.mockImplementation(async (name) => {
      if (name === tempFilePath) return erroringTempFileHandleMock;
      throw new Error(
        'Test setup error: unexpected getFileHandle call for non-temp file'
      );
    });
    rootDirHandleMockInstance.removeEntry.mockImplementation(async (name) => {
      // For cleanup
      if (name === tempFilePath) {
        delete mockFileSystemState[tempFilePath];
        return Promise.resolve(undefined);
      }
    });

    const result = await storageProvider.writeFileAtomically(filePath, data);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Failed to write to temporary file: Failed to create temp writable'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error writing to temporary file ${tempFilePath}`
      ),
      expect.objectContaining({ message: 'Failed to create temp writable' })
    );
    expect(rootDirHandleMockInstance.removeEntry).toHaveBeenCalledWith(
      tempFilePath
    );
  });

  test('should return error if temp writable.write fails', async () => {
    const filePath = 'writeError.sav';
    const tempFilePath = `${filePath}.tmp`;
    const data = new Uint8Array([1]);

    const mockTempStreamWithError = createMockWritableStream(tempFilePath);
    mockTempStreamWithError.write = jest
      .fn()
      .mockRejectedValue(new Error('Temp disk quota exceeded'));

    const tempFileHandleWithStreamErrorMock = createMockFileHandle(
      tempFilePath,
      tempFilePath
    );
    tempFileHandleWithStreamErrorMock.createWritable = jest
      .fn()
      .mockResolvedValue(mockTempStreamWithError);

    rootDirHandleMockInstance.getFileHandle.mockImplementation(async (name) => {
      if (name === tempFilePath) return tempFileHandleWithStreamErrorMock;
      throw new Error(
        'Test setup error: unexpected getFileHandle call for non-temp file'
      );
    });
    rootDirHandleMockInstance.removeEntry.mockImplementation(async (name) => {
      // For cleanup
      if (name === tempFilePath) {
        delete mockFileSystemState[tempFilePath];
        return Promise.resolve(undefined);
      }
    });

    const result = await storageProvider.writeFileAtomically(filePath, data);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Failed to write to temporary file: Temp disk quota exceeded'
    );
    expect(mockTempStreamWithError.write).toHaveBeenCalledWith(data);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error writing to temporary file ${tempFilePath}`
      ),
      expect.objectContaining({ message: 'Temp disk quota exceeded' })
    );
    expect(rootDirHandleMockInstance.removeEntry).toHaveBeenCalledWith(
      tempFilePath
    );
  });

  test('should return error and keep temp file if final write fails', async () => {
    const filePath = 'finalWriteError.sav';
    const tempFilePath = `${filePath}.tmp`;
    const data = new Uint8Array([1, 2, 3]);

    const tempFileHandleMock = createMockFileHandle(tempFilePath, tempFilePath);
    const finalFileHandleMockWithError = createMockFileHandle(
      filePath,
      filePath
    );
    finalFileHandleMockWithError.createWritable = jest
      .fn()
      .mockRejectedValue(new Error('Final write failed'));

    rootDirHandleMockInstance.getFileHandle.mockImplementation(
      async (name, options) => {
        if (name === tempFilePath) {
          if (options && options.create)
            mockFileSystemState[tempFilePath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return tempFileHandleMock;
        }
        if (name === filePath) {
          // Don't create mockFileSystemState entry here as the write will fail
          return finalFileHandleMockWithError;
        }
        throw new Error(`Unexpected getFileHandle in root: ${name}`);
      }
    );

    rootDirHandleMockInstance.removeEntry.mockImplementation(async (name) => {
      // Should not be called for tempFilePath in this test case
      expect(name).not.toBe(tempFilePath);
      throw new Error(
        'removeEntry called unexpectedly in final write fail test'
      );
    });

    const result = await storageProvider.writeFileAtomically(filePath, data);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      `Failed to replace original file with new data: Final write failed. Temporary data saved at ${tempFilePath}.`
    );

    const tempStream =
      await tempFileHandleMock.createWritable.mock.results[0].value;
    expect(tempStream.write).toHaveBeenCalledWith(data);
    expect(mockFileSystemState[tempFilePath]).toEqual(data); // Temp file should contain the data

    expect(finalFileHandleMockWithError.createWritable).toHaveBeenCalled();
    expect(rootDirHandleMockInstance.removeEntry).not.toHaveBeenCalledWith(
      tempFilePath
    ); // Crucial check

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error writing to final file ${filePath} (replacing original): Final write failed`
      ),
      expect.objectContaining({ message: 'Final write failed' })
    );
  });

  test('should correctly handle paths with leading/trailing slashes', async () => {
    const filePathWithSlashes = '/slashedDir/slashedFile.sav/';
    const normalizedPath = 'slashedDir/slashedFile.sav';
    const dirName = 'slashedDir';
    const fileName = 'slashedFile.sav';
    const tempFileName = `${fileName}.tmp`;
    const tempNormalizedPath = `${dirName}/${tempFileName}`;
    const data = new Uint8Array([7, 8, 9]);

    const slashedDirHandleMock = {
      ...mockDirectoryHandleProto,
      name: dirName,
      fullPath: dirName,
      getFileHandle: jest.fn(),
      removeEntry: jest.fn(),
    };
    const tempFileHandleMock = createMockFileHandle(
      tempFileName,
      tempNormalizedPath
    );
    const finalFileHandleMock = createMockFileHandle(fileName, normalizedPath);

    rootDirHandleMockInstance.getDirectoryHandle.mockImplementation(
      async (name, options) => {
        if (name === dirName) {
          if (options && options.create && !mockFileSystemState[dirName]) {
            mockFileSystemState[dirName] = { __isDirectoryMock: true };
          }
          if (mockFileSystemState[dirName]?.__isDirectoryMock) {
            return slashedDirHandleMock;
          }
        }
        throw new Error(
          `Mock: Directory (slashed) not found or unexpected: ${name}`
        );
      }
    );

    slashedDirHandleMock.getFileHandle.mockImplementation(
      async (name, options) => {
        if (name === tempFileName) {
          if (options && options.create)
            mockFileSystemState[tempNormalizedPath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return tempFileHandleMock;
        }
        if (name === fileName) {
          if (options && options.create)
            mockFileSystemState[normalizedPath] = {
              __isFileMock: true,
              content: new Uint8Array(),
            };
          return finalFileHandleMock;
        }
        throw new Error(`Unexpected getFileHandle in ${dirName}: ${name}`);
      }
    );

    slashedDirHandleMock.removeEntry.mockImplementation(async (name) => {
      if (name === tempFileName) {
        delete mockFileSystemState[tempNormalizedPath];
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected removeEntry in ${dirName}: ${name}`);
    });

    const result = await storageProvider.writeFileAtomically(
      filePathWithSlashes,
      data
    );

    expect(result.success).toBe(true); // This was failing
    expect(rootDirHandleMockInstance.getDirectoryHandle).toHaveBeenCalledWith(
      dirName,
      { create: true }
    ); // Called for temp file path
    expect(rootDirHandleMockInstance.getDirectoryHandle).toHaveBeenCalledWith(
      dirName,
      { create: true }
    ); // Called for final file path

    expect(slashedDirHandleMock.getFileHandle).toHaveBeenCalledWith(
      tempFileName,
      { create: true }
    );
    const tempStream =
      await tempFileHandleMock.createWritable.mock.results[0].value;
    expect(tempStream.write).toHaveBeenCalledWith(data);

    expect(slashedDirHandleMock.getFileHandle).toHaveBeenCalledWith(fileName, {
      create: true,
    });
    const finalStream =
      await finalFileHandleMock.createWritable.mock.results[0].value;
    expect(finalStream.write).toHaveBeenCalledWith(data);

    expect(mockFileSystemState[normalizedPath]).toEqual(data);
    expect(slashedDirHandleMock.removeEntry).toHaveBeenCalledWith(tempFileName);
    expect(mockFileSystemState[tempNormalizedPath]).toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalledWith(
      `BrowserStorageProvider: Atomic write to ${normalizedPath} completed successfully.`
    );
  });
});
