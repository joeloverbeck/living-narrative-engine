/**
 * @jest-environment node
 */
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { BrowserStorageProvider } from '../../../src/storage/browserStorageProvider.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { StorageErrorCodes } from '../../../src/storage/storageErrors.js';

// Reusable helper for a basic mock directory handle
const createMockDirHandle = (files = {}) => ({
  kind: 'directory',
  name: 'mock',
  values: jest.fn().mockImplementation(async function* () {
    for (const [name, kind] of Object.entries(files)) {
      yield { kind, name };
    }
  }),
  getDirectoryHandle: jest.fn(async (name) => {
    if (files[name] === 'directory') {
      return createMockDirHandle();
    }
    const err = new Error('NotFound');
    err.name = 'NotFoundError';
    throw err;
  }),
  queryPermission: jest.fn().mockResolvedValue('granted'),
  requestPermission: jest.fn().mockResolvedValue('granted'),
  getFileHandle: jest.fn(),
  removeEntry: jest.fn(),
});

describe('BrowserStorageProvider listFiles and helpers', () => {
  let provider;
  let rootHandle;
  let logger;
  let dispatcher;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    dispatcher = { dispatch: jest.fn() };
    rootHandle = createMockDirHandle();
    global.window = { showDirectoryPicker: jest.fn(async () => rootHandle) };
    provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });
  });

  afterEach(() => {
    delete global.window;
  });

  it('lists files matching pattern while ignoring .tmp', async () => {
    const files = {
      'slot1.sav': 'file',
      'slot2.sav': 'file',
      'temp.tmp': 'file',
      folder: 'directory',
    };
    rootHandle.values.mockImplementation(async function* () {
      for (const [name, kind] of Object.entries(files)) {
        yield { name, kind };
      }
    });

    const results = await provider.listFiles('', '\\.(sav)$');
    expect(results).toEqual(['slot1.sav', 'slot2.sav']);
  });

  it('throws FILE_NOT_FOUND when directory missing', async () => {
    rootHandle.getDirectoryHandle.mockImplementation(async () => {
      const err = new Error('none');
      err.name = 'NotFoundError';
      throw err;
    });
    await expect(provider.listFiles('missing', '.*')).rejects.toMatchObject({
      message: 'Directory not found: missing',
      code: StorageErrorCodes.FILE_NOT_FOUND,
    });
  });

  it('returns empty array when user aborts root selection', async () => {
    global.window.showDirectoryPicker.mockRejectedValue({
      name: 'AbortError',
      message: 'cancel',
    });
    const results = await provider.listFiles('dir', '.*');
    expect(results).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns empty array and dispatches error on unexpected failure', async () => {
    rootHandle.getDirectoryHandle.mockRejectedValue(new Error('boom'));
    const results = await provider.listFiles('dir', '.*');
    expect(results).toEqual([]);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Error listing files'),
      })
    );
  });

  it('deleteFile reports not-found as success with message', async () => {
    rootHandle.getFileHandle = jest.fn(async () => {
      const err = new Error('nf');
      err.name = 'NotFoundError';
      throw err;
    });
    const result = await provider.deleteFile('gone.sav');
    expect(result.success).toBe(true);
    expect(result.error).toContain('File not found for deletion');
  });

  it('fileExists returns false when user aborts root selection', async () => {
    global.window.showDirectoryPicker.mockRejectedValue({
      name: 'AbortError',
      message: 'cancel',
    });
    const exists = await provider.fileExists('any.sav');
    expect(exists).toBe(false);
  });
});
