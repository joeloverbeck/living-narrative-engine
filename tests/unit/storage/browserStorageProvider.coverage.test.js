/**
 * @file Additional coverage tests for BrowserStorageProvider.
 * @jest-environment node
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { BrowserStorageProvider } from '../../../src/storage/browserStorageProvider.js';
import { StorageErrorCodes } from '../../../src/storage/storageErrors.js';
jest.mock('../../../src/utils/systemErrorDispatchUtils.js', () => ({
  dispatchSystemErrorEvent: jest.fn().mockResolvedValue(undefined),
}));

const { dispatchSystemErrorEvent } = jest.requireMock(
  '../../../src/utils/systemErrorDispatchUtils.js'
);

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createRootHandle = () => ({
  name: 'root',
  kind: 'directory',
  queryPermission: jest.fn().mockResolvedValue('granted'),
  requestPermission: jest.fn().mockResolvedValue('granted'),
  getDirectoryHandle: jest.fn(),
  getFileHandle: jest.fn(),
  removeEntry: jest.fn().mockResolvedValue(undefined),
  values: jest.fn().mockImplementation(async function* values() {}),
});

const createFileHandle = ({ name, arrayBuffer, writable }) => ({
  name,
  kind: 'file',
  createWritable:
    writable ||
    jest.fn().mockResolvedValue({
      write: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  getFile:
    arrayBuffer &&
    jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
    }),
});

const expectDispatch = (messageMatcher) => {
  expect(dispatchSystemErrorEvent).toHaveBeenCalledWith(
    expect.objectContaining({ dispatch: expect.any(Function) }),
    expect.stringMatching(messageMatcher),
    expect.any(Object),
    expect.any(Object)
  );
};

describe('BrowserStorageProvider additional coverage', () => {
  let logger;
  let dispatcher;
  let originalWindow;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    dispatchSystemErrorEvent.mockClear();
    originalWindow = global.window;
    global.window = {
      ...(originalWindow || {}),
      showDirectoryPicker: jest.fn(),
    };
  });

  afterEach(() => {
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      delete global.window;
    }
    jest.restoreAllMocks();
  });

  it('throws a descriptive error when logger dependency is missing', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(
      () => new BrowserStorageProvider({ safeEventDispatcher: dispatcher })
    ).toThrow('BrowserStorageProvider requires a valid ILogger instance.');

    expect(consoleError).toHaveBeenCalledWith(
      'BrowserStorageProvider requires a valid ILogger instance.'
    );
    consoleError.mockRestore();
  });

  it('reuses the cached root directory handle when permission remains granted', async () => {
    const rootHandle = createRootHandle();
    rootHandle.getFileHandle.mockResolvedValue(
      createFileHandle({ name: 'file' })
    );
    global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

    const provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });

    await provider.fileExists('first.sav');
    global.window.showDirectoryPicker.mockClear();

    rootHandle.queryPermission.mockResolvedValueOnce('granted');
    await provider.fileExists('second.sav');

    expect(global.window.showDirectoryPicker).not.toHaveBeenCalled();
    expect(rootHandle.queryPermission).toHaveBeenCalled();
    expect(rootHandle.requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission again when the cached handle loses access and succeeds', async () => {
    const rootHandle = createRootHandle();
    rootHandle.getFileHandle.mockResolvedValue(
      createFileHandle({ name: 'file' })
    );
    rootHandle.queryPermission
      .mockResolvedValueOnce('granted')
      .mockResolvedValueOnce('prompt');
    rootHandle.requestPermission.mockResolvedValueOnce('granted');
    global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

    const provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });

    await provider.fileExists('first.sav');
    global.window.showDirectoryPicker.mockClear();

    await provider.fileExists('second.sav');

    expect(rootHandle.requestPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    });
    expect(global.window.showDirectoryPicker).not.toHaveBeenCalled();
  });

  it('clears the cached handle and reprompts when permission is denied', async () => {
    const firstHandle = createRootHandle();
    firstHandle.getFileHandle.mockResolvedValue(
      createFileHandle({ name: 'file' })
    );
    firstHandle.queryPermission
      .mockResolvedValueOnce('granted')
      .mockResolvedValueOnce('denied');
    firstHandle.requestPermission.mockResolvedValueOnce('denied');

    const replacementHandle = createRootHandle();
    replacementHandle.getFileHandle.mockResolvedValue(
      createFileHandle({ name: 'file' })
    );

    global.window.showDirectoryPicker
      .mockResolvedValueOnce(firstHandle)
      .mockResolvedValueOnce(replacementHandle);

    const provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });

    await provider.fileExists('first.sav');
    await provider.fileExists('second.sav');

    expect(firstHandle.requestPermission).toHaveBeenCalled();
    expect(global.window.showDirectoryPicker).toHaveBeenCalledTimes(2);
  });

  it('logs a warning when the user aborts directory selection and resolves false for existence checks', async () => {
    const abortError = new Error('No selection');
    abortError.name = 'AbortError';
    global.window.showDirectoryPicker.mockRejectedValueOnce(abortError);

    const provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });

    const exists = await provider.fileExists('file.sav');
    expect(exists).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'User aborted root directory selection.'
    );
  });

  it('dispatches a system error when directory selection fails unexpectedly', async () => {
    global.window.showDirectoryPicker.mockRejectedValueOnce(new Error('boom'));

    const provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });

    await expect(provider.readFile('file.sav')).rejects.toThrow(
      /Failed to obtain root directory handle: boom/
    );
    expectDispatch(/Error selecting root directory/);
  });

  it('dispatches an error when permissions remain denied after directory selection', async () => {
    const deniedHandle = createRootHandle();
    deniedHandle.queryPermission.mockResolvedValueOnce('prompt');
    deniedHandle.requestPermission.mockResolvedValueOnce('denied');
    global.window.showDirectoryPicker.mockResolvedValueOnce(deniedHandle);

    const provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: dispatcher,
    });

    await expect(provider.readFile('file.sav')).rejects.toThrow(
      /Permission denied for the selected directory/
    );
    expectDispatch(/Permission explicitly denied/);
  });

  describe('writeFileAtomically error handling', () => {
    const data = new Uint8Array([1, 2, 3]);

    it('reports failures when writing the temporary file and attempts cleanup', async () => {
      const rootHandle = createRootHandle();
      const tempHandle = createFileHandle({ name: 'file.tmp' });
      tempHandle.createWritable.mockRejectedValueOnce(new Error('temp fail'));
      rootHandle.getFileHandle.mockImplementation(async (name) => {
        if (name.endsWith('.tmp')) {
          return tempHandle;
        }
        return createFileHandle({ name });
      });
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });
      jest.spyOn(provider, 'deleteFile').mockResolvedValue({ success: true });

      const result = await provider.writeFileAtomically('file.sav', data);

      expect(result).toEqual({
        success: false,
        error: 'Failed to write to temporary file: temp fail',
      });
      expectDispatch(/temporary file file\.sav\.tmp/);
      expect(provider.deleteFile).toHaveBeenCalledWith('file.sav.tmp');
    });

    it('warns when cleaning up after a temporary write failure also fails', async () => {
      const rootHandle = createRootHandle();
      const tempHandle = createFileHandle({ name: 'file.tmp' });
      tempHandle.createWritable.mockRejectedValueOnce(new Error('temp fail'));
      rootHandle.getFileHandle.mockImplementation(async (name) => {
        if (name.endsWith('.tmp')) {
          return tempHandle;
        }
        return createFileHandle({ name });
      });
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });
      jest
        .spyOn(provider, 'deleteFile')
        .mockRejectedValueOnce(new Error('cleanup boom'));

      const result = await provider.writeFileAtomically('file.sav', data);

      expect(result.success).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not clean up temporary file file.sav.tmp'
        ),
        expect.any(Error)
      );
    });

    it('returns a descriptive error when replacing the final file fails', async () => {
      const rootHandle = createRootHandle();
      const tempHandle = createFileHandle({ name: 'file.tmp' });
      const finalHandle = createFileHandle({ name: 'file.sav' });
      finalHandle.createWritable.mockRejectedValueOnce(new Error('final fail'));
      rootHandle.getFileHandle.mockImplementation(async (name) => {
        if (name.endsWith('.tmp')) return tempHandle;
        return finalHandle;
      });
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.writeFileAtomically('file.sav', data);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Failed to replace original file/);
      expectDispatch(/Error writing to final file/);
    });

    it('warns when cleanup after success fails but still reports success', async () => {
      const rootHandle = createRootHandle();
      const tempHandle = createFileHandle({ name: 'file.tmp' });
      const finalHandle = createFileHandle({ name: 'file.sav' });
      rootHandle.getFileHandle.mockImplementation(async (name) => {
        if (name.endsWith('.tmp')) return tempHandle;
        return finalHandle;
      });
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });
      jest
        .spyOn(provider, 'deleteFile')
        .mockRejectedValueOnce(new Error('cleanup fail'))
        .mockResolvedValueOnce({ success: true });

      const result = await provider.writeFileAtomically('file.sav', data);

      expect(result).toEqual({ success: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to clean up temporary file file.sav.tmp'
        ),
        expect.any(Error)
      );
    });

    it('dispatches errors when creating intermediate directories fails even with create=true', async () => {
      const rootHandle = createRootHandle();
      rootHandle.getDirectoryHandle.mockRejectedValueOnce(
        new Error('disk offline')
      );
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.writeFileAtomically(
        'nested/file.sav',
        data
      );

      expect(result.success).toBe(false);
      expectDispatch(/Failed to get\/create directory handle/);
    });
  });

  describe('listFiles', () => {
    it('returns file names matching the provided pattern and filters .tmp files', async () => {
      const rootHandle = createRootHandle();
      const directoryHandle = {
        kind: 'directory',
        values: jest.fn().mockImplementation(async function* () {
          yield { kind: 'file', name: 'keep.txt' };
          yield { kind: 'file', name: 'discard.tmp' };
          yield { kind: 'directory', name: 'nested' };
        }),
      };
      rootHandle.getDirectoryHandle.mockResolvedValue(directoryHandle);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const results = await provider.listFiles('saves', '\\.(txt|sav)$');
      expect(results).toEqual(['keep.txt']);
      expect(logger.debug).toHaveBeenCalledWith(
        'BrowserStorageProvider: Found 1 files in "saves" matching "\\.(txt|sav)$".'
      );
    });

    it('returns the root handle when listing the top-level directory', async () => {
      const rootHandle = createRootHandle();
      rootHandle.values.mockImplementation(async function* () {
        yield { kind: 'file', name: 'root.sav' };
      });
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const results = await provider.listFiles('/', '.*');
      expect(results).toEqual(['root.sav']);
      expect(rootHandle.getDirectoryHandle).not.toHaveBeenCalled();
    });

    it('wraps NotFound errors with a StorageErrorCodes flag', async () => {
      const rootHandle = createRootHandle();
      const notFound = Object.assign(new Error('missing'), {
        name: 'NotFoundError',
      });
      rootHandle.getDirectoryHandle.mockRejectedValue(notFound);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.listFiles('ghost', '.*')).rejects.toMatchObject({
        message: 'Directory not found: ghost',
        code: StorageErrorCodes.FILE_NOT_FOUND,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'BrowserStorageProvider: Directory not found for listing: "ghost".'
      );
    });

    it('returns an empty list when root selection was not completed', async () => {
      global.window.showDirectoryPicker.mockRejectedValueOnce(
        new Error('oops')
      );

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const files = await provider.listFiles('any', '.*');
      expect(files).toEqual([]);
      expectDispatch(/Error selecting root directory/);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('root directory selection was not completed')
      );
    });

    it('dispatches and returns an empty list for unexpected directory errors', async () => {
      const rootHandle = createRootHandle();
      const directoryHandle = {
        values: jest.fn().mockImplementation(async function* () {
          throw new Error('iteration failure');
        }),
      };
      rootHandle.getDirectoryHandle.mockResolvedValue(directoryHandle);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const files = await provider.listFiles('saves', '.*');
      expect(files).toEqual([]);
      expectDispatch(/Error listing files/);
    });
  });

  describe('readFile', () => {
    it('returns file contents as a Uint8Array', async () => {
      const data = new Uint8Array([5, 6, 7]);
      const rootHandle = createRootHandle();
      rootHandle.getFileHandle.mockResolvedValue(
        createFileHandle({ name: 'file.sav', arrayBuffer: data.buffer })
      );
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const contents = await provider.readFile('file.sav');
      expect(Array.from(contents)).toEqual([5, 6, 7]);
    });

    it('throws a descriptive error when the file is not found', async () => {
      const rootHandle = createRootHandle();
      const notFound = Object.assign(new Error('missing file'), {
        name: 'NotFoundError',
      });
      rootHandle.getFileHandle.mockRejectedValue(notFound);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.readFile('ghost.sav')).rejects.toThrow(
        /File not found: ghost.sav/
      );
      expectDispatch(/Error reading file/);
    });

    it('rejects invalid normalized file paths early', async () => {
      const rootHandle = createRootHandle();
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.readFile('/')).rejects.toThrow(/Invalid file path/);
      expectDispatch(/Error reading file/);
    });

    it('dispatches a detailed error when the resolved file name is empty', async () => {
      const rootHandle = createRootHandle();
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.readFile('folder/   ')).rejects.toThrow(
        /Could not extract file name from path/
      );
      expectDispatch(/Invalid file path supplied/);
    });

    it('guards against file traversal attempts in the file name segment', async () => {
      const rootHandle = createRootHandle();
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.readFile('folder/..')).rejects.toMatchObject({
        name: 'SecurityError',
      });
      expectDispatch(/Refused file path traversal attempt/);
    });

    it('propagates root handle selection issues as descriptive errors', async () => {
      global.window.showDirectoryPicker.mockRejectedValueOnce(
        new Error('blocked')
      );

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.readFile('file.sav')).rejects.toThrow(
        /Cannot read file: Root directory selection was not completed/
      );
    });

    it('rethrows unexpected file read errors after dispatching', async () => {
      const rootHandle = createRootHandle();
      const fileHandle = {
        name: 'file.sav',
        kind: 'file',
        createWritable: jest.fn(),
        getFile: jest.fn().mockRejectedValue(new Error('boom')),
      };
      rootHandle.getFileHandle.mockResolvedValue(fileHandle);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      await expect(provider.readFile('file.sav')).rejects.toThrow('boom');
      expectDispatch(/Error reading file/);
    });
  });

  describe('deleteFile', () => {
    it('removes the target file when it exists', async () => {
      const rootHandle = createRootHandle();
      const fileHandle = createFileHandle({ name: 'file.sav' });
      rootHandle.getFileHandle.mockResolvedValue(fileHandle);
      rootHandle.removeEntry.mockResolvedValue(undefined);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.deleteFile('file.sav');
      expect(result).toEqual({ success: true });
      expect(rootHandle.removeEntry).toHaveBeenCalledWith('file.sav');
    });

    it('treats missing files as a successful deletion with context', async () => {
      const rootHandle = createRootHandle();
      const notFound = Object.assign(new Error('missing'), {
        name: 'NotFoundError',
      });
      rootHandle.getFileHandle.mockRejectedValue(notFound);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.deleteFile('ghost.sav');
      expect(result.success).toBe(true);
      expect(result.error).toMatch(/File not found for deletion/);
      expectDispatch(/Error deleting file/);
    });

    it('propagates root handle errors when deletion cannot proceed', async () => {
      global.window.showDirectoryPicker.mockRejectedValueOnce(
        new Error('no root')
      );

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.deleteFile('file.sav');
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining(
          'Cannot delete file: Root directory selection was not completed'
        ),
      });
    });

    it('reports unexpected deletion errors', async () => {
      const rootHandle = createRootHandle();
      const fileHandle = createFileHandle({ name: 'file.sav' });
      rootHandle.getFileHandle.mockResolvedValue(fileHandle);
      rootHandle.removeEntry.mockRejectedValueOnce(new Error('boom'));
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.deleteFile('file.sav');
      expect(result).toEqual({ success: false, error: 'boom' });
      expectDispatch(/Error deleting file/);
    });

    it('validates that a deletable path resolves to a filename', async () => {
      const rootHandle = createRootHandle();
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const result = await provider.deleteFile('/');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid file path provided/);
      expectDispatch(/Error deleting file/);
    });
  });

  describe('fileExists', () => {
    it('returns true when the file can be resolved', async () => {
      const rootHandle = createRootHandle();
      rootHandle.getFileHandle.mockResolvedValue(
        createFileHandle({ name: 'file' })
      );
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const exists = await provider.fileExists('file.sav');
      expect(exists).toBe(true);
    });

    it('returns false for missing files after dispatching a detailed event', async () => {
      const rootHandle = createRootHandle();
      const notFound = Object.assign(new Error('missing'), {
        name: 'NotFoundError',
      });
      rootHandle.getFileHandle.mockRejectedValue(notFound);
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const exists = await provider.fileExists('ghost.sav');
      expect(exists).toBe(false);
      expectDispatch(/Failed to get\/create file handle/);
    });

    it('returns false when root selection fails', async () => {
      global.window.showDirectoryPicker.mockRejectedValueOnce(
        new Error('blocked')
      );

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const exists = await provider.fileExists('file.sav');
      expect(exists).toBe(false);
    });

    it('logs and returns false when an unexpected error occurs', async () => {
      const rootHandle = createRootHandle();
      rootHandle.getFileHandle.mockRejectedValue(new Error('boom'));
      global.window.showDirectoryPicker.mockResolvedValue(rootHandle);

      const provider = new BrowserStorageProvider({
        logger,
        safeEventDispatcher: dispatcher,
      });

      const exists = await provider.fileExists('file.sav');
      expect(exists).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error checking file existence for file.sav'),
        expect.any(Error)
      );
    });
  });
});
