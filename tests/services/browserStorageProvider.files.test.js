// tests/services/browserStorageProvider.files.test.js
// -----------------------------------------------------------------------------
// Focused tests for BrowserStorageProvider readFile, deleteFile and fileExists
// which were previously uncovered. These tests mock the File System Access API
// enough to exercise the different code paths without performing real IO.
// -----------------------------------------------------------------------------

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { BrowserStorageProvider } from '../../src/storage/browserStorageProvider.js';

// Helper to create a minimal mock directory handle with an in-memory file map.
const createMockRootHandle = (fileMap) => {
  const handle = {
    name: 'root',
    kind: 'directory',
    getFileHandle: jest.fn(async (name, opts) => {
      if (fileMap[name]) {
        return {
          name,
          getFile: async () => ({
            arrayBuffer: async () => fileMap[name].buffer,
          }),
        };
      }
      const err = new Error('Not found');
      err.name = 'NotFoundError';
      throw err;
    }),
    getDirectoryHandle: jest.fn(async () => handle),
    removeEntry: jest.fn(async (name) => {
      if (fileMap[name]) {
        delete fileMap[name];
        return;
      }
      const err = new Error('NotFoundError');
      err.name = 'NotFoundError';
      throw err;
    }),
    values: jest.fn().mockImplementation(async function* () {
      for (const name of Object.keys(fileMap)) {
        yield { kind: 'file', name };
      }
    }),
    queryPermission: jest.fn().mockResolvedValue('granted'),
    requestPermission: jest.fn().mockResolvedValue('granted'),
  };
  return handle;
};

describe('BrowserStorageProvider file operations', () => {
  /** @type {BrowserStorageProvider} */
  let provider;
  /** @type {ReturnType<typeof createMockRootHandle>} */
  let rootHandle;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const dispatcher = { dispatch: jest.fn() };
    const files = { 'read.sav': new Uint8Array([1, 2, 3]) };
    rootHandle = createMockRootHandle(files);
    global.window.showDirectoryPicker = jest.fn(async () => rootHandle);
    provider = new BrowserStorageProvider({
      logger: mockLogger,
      safeEventDispatcher: dispatcher,
    });
  });

  it('readFile returns contents when file exists', async () => {
    const data = await provider.readFile('read.sav');
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });

  it('fileExists returns false when file missing', async () => {
    const exists = await provider.fileExists('missing.sav');
    expect(exists).toBe(false);
  });

  it('fileExists returns true when file exists', async () => {
    const exists = await provider.fileExists('read.sav');
    expect(exists).toBe(true);
  });

  it('readFile throws when file missing', async () => {
    await expect(provider.readFile('missing.sav')).rejects.toThrow(
      'File not found'
    );
  });

  it('deleteFile succeeds when file present', async () => {
    const result = await provider.deleteFile('read.sav');
    expect(result.success).toBe(true);
  });

  it('deleteFile returns success false when root selection aborted', async () => {
    rootHandle.queryPermission.mockResolvedValue('denied');
    rootHandle.requestPermission.mockResolvedValue('denied');
    const result = await provider.deleteFile('read.sav');
    expect(result.success).toBe(false);
  });
});
