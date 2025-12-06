import { BrowserStorageProvider } from '../../../src/storage/browserStorageProvider.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { StorageErrorCodes } from '../../../src/storage/storageErrors.js';

const normalizePath = (value) => value.replace(/^\/+|\/+$/g, '');

class RecordingValidatedEventDispatcher {
  constructor(eventLog) {
    this.eventLog = eventLog;
  }

  async dispatch(eventName, payload) {
    this.eventLog.push({ eventName, payload });
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class FakeFileSystem {
  constructor() {
    this.files = new Map();
    this.directories = new Map();
    this.directories.set('', new FakeDirectoryHandle(this, ''));
    this.permissionState = 'granted';
    this.permissionRequests = 0;
    this.failures = new Map();
    this.showDirectoryPickerCalls = 0;
    this.permissionRequestHandler = null;
  }

  setPermission(state) {
    this.permissionState = state;
  }

  onPermissionRequest(handler) {
    this.permissionRequestHandler = handler;
  }

  failNext(operation, path, error) {
    const normalized = normalizePath(path || '');
    this.failures.set(`${operation}:${normalized}`, error);
  }

  takeFailure(operation, path) {
    const key = `${operation}:${normalizePath(path || '')}`;
    if (this.failures.has(key)) {
      const error = this.failures.get(key);
      this.failures.delete(key);
      throw error;
    }
  }

  getRootHandle() {
    return this.directories.get('');
  }

  hasFile(path) {
    return this.files.has(normalizePath(path));
  }

  getFileBytes(path) {
    const data = this.files.get(normalizePath(path));
    return data ? new Uint8Array(data) : null;
  }

  async showDirectoryPicker() {
    this.showDirectoryPickerCalls += 1;
    this.takeFailure('showDirectoryPicker', 'root');
    return this.getRootHandle();
  }
}

class FakeDirectoryHandle {
  constructor(fs, path) {
    this.fs = fs;
    this.path = normalizePath(path);
    this.name = this.path.split('/').pop() || 'root';
  }

  async queryPermission() {
    return this.fs.permissionState;
  }

  async requestPermission() {
    this.fs.permissionRequests += 1;
    if (this.fs.permissionRequestHandler) {
      const result = await this.fs.permissionRequestHandler();
      if (result) {
        this.fs.permissionState = result;
      }
    } else {
      this.fs.permissionState = 'granted';
    }
    return this.fs.permissionState;
  }

  async getDirectoryHandle(name, options = {}) {
    const childPath = this.path ? `${this.path}/${name}` : name;
    this.fs.takeFailure('dir', childPath);
    const normalized = normalizePath(childPath);
    const existing = this.fs.directories.get(normalized);
    if (existing) {
      return existing;
    }
    if (options.create) {
      const handle = new FakeDirectoryHandle(this.fs, normalized);
      this.fs.directories.set(normalized, handle);
      return handle;
    }
    const error = new Error(`Directory not found: ${normalized}`);
    error.name = 'NotFoundError';
    throw error;
  }

  async getFileHandle(name, options = {}) {
    const filePath = this.path ? `${this.path}/${name}` : name;
    this.fs.takeFailure('file', filePath);
    const normalized = normalizePath(filePath);
    if (this.fs.files.has(normalized)) {
      return new FakeFileHandle(this.fs, normalized);
    }
    if (options.create) {
      this.fs.files.set(normalized, new Uint8Array());
      return new FakeFileHandle(this.fs, normalized);
    }
    const error = new Error(`File not found: ${normalized}`);
    error.name = 'NotFoundError';
    throw error;
  }

  async *values() {
    const prefix = this.path ? `${this.path}/` : '';
    for (const dirPath of this.fs.directories.keys()) {
      if (dirPath === '') continue;
      if (!dirPath.startsWith(prefix)) continue;
      const remainder = dirPath.slice(prefix.length);
      if (!remainder.includes('/')) {
        yield { kind: 'directory', name: remainder };
      }
    }
    for (const filePath of this.fs.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const remainder = filePath.slice(prefix.length);
      if (!remainder.includes('/')) {
        yield { kind: 'file', name: remainder };
      }
    }
  }

  async removeEntry(name) {
    const filePath = this.path ? `${this.path}/${name}` : name;
    this.fs.takeFailure('remove', filePath);
    const normalized = normalizePath(filePath);
    if (this.fs.files.has(normalized)) {
      this.fs.files.delete(normalized);
      return;
    }
    const error = new Error(`File not found: ${normalized}`);
    error.name = 'NotFoundError';
    throw error;
  }
}

class FakeFileHandle {
  constructor(fs, path) {
    this.fs = fs;
    this.path = normalizePath(path);
    this.name = this.path.split('/').pop();
  }

  async getFile() {
    this.fs.takeFailure('getFile', this.path);
    if (!this.fs.files.has(this.path)) {
      const error = new Error(`File not found: ${this.path}`);
      error.name = 'NotFoundError';
      throw error;
    }
    const data = this.fs.files.get(this.path);
    const clone = new Uint8Array(data);
    return {
      async arrayBuffer() {
        return clone.buffer.slice(
          clone.byteOffset,
          clone.byteOffset + clone.byteLength
        );
      },
    };
  }

  async createWritable() {
    this.fs.takeFailure('createWritable', this.path);
    const fsRef = this.fs;
    const filePath = this.path;
    let buffer = null;
    return {
      async write(content) {
        fsRef.takeFailure('write', filePath);
        if (content instanceof Uint8Array) {
          buffer = new Uint8Array(content);
        } else if (content instanceof ArrayBuffer) {
          buffer = new Uint8Array(content);
        } else if (ArrayBuffer.isView(content)) {
          buffer = new Uint8Array(
            content.buffer.slice(
              content.byteOffset,
              content.byteOffset + content.byteLength
            )
          );
        } else if (typeof content === 'string') {
          buffer = new TextEncoder().encode(content);
        } else {
          buffer = new Uint8Array();
        }
      },
      async close() {
        fsRef.takeFailure('close', filePath);
        fsRef.files.set(filePath, buffer ?? new Uint8Array());
      },
    };
  }
}

describe('BrowserStorageProvider integration', () => {
  let logger;
  let safeDispatcher;
  let eventLog;
  let fs;
  let provider;
  let originalShowDirectoryPicker;

  beforeAll(() => {
    originalShowDirectoryPicker = window.showDirectoryPicker;
  });

  beforeEach(() => {
    fs = new FakeFileSystem();
    eventLog = [];
    logger = new ConsoleLogger(LogLevel.ERROR);
    logger.setLogLevel(LogLevel.ERROR);
    const validatedDispatcher = new RecordingValidatedEventDispatcher(eventLog);
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    window.showDirectoryPicker = () => fs.showDirectoryPicker();
    provider = new BrowserStorageProvider({
      logger,
      safeEventDispatcher: safeDispatcher,
    });
  });

  afterEach(() => {
    window.showDirectoryPicker = originalShowDirectoryPicker;
  });

  test('performs an atomic write, read, list and delete cycle', async () => {
    const encoder = new TextEncoder();
    const payload = encoder.encode('{"state":"ok"}');

    const writeResult = await provider.writeFileAtomically(
      '/saves/story1.json',
      payload
    );

    expect(writeResult).toEqual({ success: true });
    expect(fs.getFileBytes('/saves/story1.json')).toEqual(
      new Uint8Array(payload)
    );
    expect(fs.hasFile('/saves/story1.json.tmp')).toBe(false);

    const exists = await provider.fileExists('/saves/story1.json');
    expect(exists).toBe(true);

    const readBack = await provider.readFile('/saves/story1.json');
    expect(Array.from(readBack)).toEqual(Array.from(payload));

    const files = await provider.listFiles('/saves', '\\.json$');
    expect(files).toEqual(['story1.json']);

    const deleteResult = await provider.deleteFile('/saves/story1.json');
    expect(deleteResult.success).toBe(true);
    expect(await provider.fileExists('/saves/story1.json')).toBe(false);

    expect(eventLog).toHaveLength(1);
    expect(eventLog[0]).toMatchObject({
      eventName: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: expect.stringContaining('Failed to get/create file handle'),
      },
    });
    expect(fs.showDirectoryPickerCalls).toBe(1);
  });

  test('re-requests permissions when the cached handle loses access', async () => {
    const encoder = new TextEncoder();
    await provider.writeFileAtomically(
      '/saves/story2.json',
      encoder.encode('x')
    );

    fs.setPermission('denied');
    fs.onPermissionRequest(() => 'granted');

    const files = await provider.listFiles('/saves', '\\.(json|txt)$');
    expect(files).toContain('story2.json');
    expect(fs.permissionRequests).toBe(1);
    expect(fs.showDirectoryPickerCalls).toBe(1);
  });

  test('dispatches system error events when temporary write fails', async () => {
    const encoder = new TextEncoder();
    fs.failNext('write', 'saves/story3.json.tmp', new Error('temp failure'));

    const result = await provider.writeFileAtomically(
      '/saves/story3.json',
      encoder.encode('payload')
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('temporary file');
    expect(fs.hasFile('/saves/story3.json.tmp')).toBe(false);

    expect(eventLog).toHaveLength(1);
    expect(eventLog[0].eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(eventLog[0].payload.message).toContain('temporary file');
  });

  test('handles missing directories and propagates detailed errors', async () => {
    await expect(
      provider.listFiles('/missing', '\\.(json)$')
    ).rejects.toMatchObject({
      message: 'Directory not found: /missing',
      code: StorageErrorCodes.FILE_NOT_FOUND,
    });

    await expect(provider.readFile('/missing/file.json')).rejects.toThrow(
      'File not found'
    );

    const deleteResult = await provider.deleteFile('/missing/file.json');
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.error).toContain('File not found');

    const exists = await provider.fileExists('/missing/file.json');
    expect(exists).toBe(false);
  });

  test('surfaces root handle failures through system events', async () => {
    const abortError = new Error('User cancelled');
    abortError.name = 'AbortError';
    fs.failNext('showDirectoryPicker', 'root', abortError);

    await expect(provider.listFiles('/anywhere', '.*')).resolves.toEqual([]);

    expect(eventLog).toHaveLength(0);

    const exists = await provider.fileExists('/anything');
    expect(exists).toBe(false);

    const encoder = new TextEncoder();
    await provider.writeFileAtomically(
      '/saves/story4.json',
      encoder.encode('ok')
    );

    fs.failNext('dir', 'saves', new Error('boom'));
    const files = await provider.listFiles('/saves', 'story');
    expect(files).toEqual([]);
    expect(eventLog[eventLog.length - 1].payload.message).toContain(
      'Error listing files'
    );
  });
});
