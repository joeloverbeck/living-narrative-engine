import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TraceDirectoryManager from '../../../../src/actions/tracing/traceDirectoryManager.js';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class FakeDirectoryHandle {
  constructor(name, options = {}) {
    this.name = name;
    this.children = new Map();
    this.permission = options.permission ?? 'granted';
    this.failures = new Map(Object.entries(options.failures || {}));
  }

  async getDirectoryHandle(name, { create }) {
    if (this.failures.has(name)) {
      const failure = this.failures.get(name);
      if (typeof failure === 'function') {
        throw failure();
      }
      throw failure;
    }

    let child = this.children.get(name);
    if (!child) {
      if (!create) {
        const notFound = new Error('NotFound');
        notFound.name = 'NotFoundError';
        throw notFound;
      }
      child = new FakeDirectoryHandle(name, { permission: this.permission });
      this.children.set(name, child);
    }
    return child;
  }

  async queryPermission() {
    return this.permission;
  }

  async requestPermission() {
    this.permission = 'granted';
    return this.permission;
  }
}

describe('TraceDirectoryManager integration', () => {
  let originalShowDirectoryPicker;
  let logger;
  let storageProvider;
  let rootHandle;
  let directoryManager;

  beforeAll(() => {
    originalShowDirectoryPicker = window.showDirectoryPicker;
  });

  afterAll(() => {
    window.showDirectoryPicker = originalShowDirectoryPicker;
  });

  beforeEach(() => {
    logger = createEnhancedMockLogger();
    storageProvider = {
      writeFileAtomically: jest.fn(),
      listFiles: jest.fn().mockResolvedValue([]),
    };

    rootHandle = new FakeDirectoryHandle('traces-root');
    window.showDirectoryPicker = jest.fn().mockResolvedValue(rootHandle);

    directoryManager = new TraceDirectoryManager({
      storageProvider,
      logger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates nested directories, normalizes paths, and caches successful results', async () => {
    const result = await directoryManager.ensureDirectoryExists(
      './exports/\\session//2024/'
    );

    expect(result).toMatchObject({
      success: true,
      path: 'exports/session/2024',
      created: true,
      writable: true,
    });
    expect(
      rootHandle.children.get('exports')?.children.get('session')
    ).toBeDefined();
    expect(logger.info).toHaveBeenCalledWith(
      'Trace directory created successfully',
      expect.objectContaining({ path: 'exports/session/2024' })
    );

    const cached = await directoryManager.ensureDirectoryExists(
      'exports/session/2024'
    );
    expect(cached.cached).toBe(true);
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(1);
    expect(directoryManager.getCachedDirectories()).toEqual([
      'exports/session/2024',
    ]);
  });

  it('returns validation errors for unsafe paths and formats filesystem failures', async () => {
    const invalid = await directoryManager.ensureDirectoryExists('../bad/path');
    expect(invalid.success).toBe(false);
    expect(invalid.errors).toContain(
      'Path contains directory traversal sequences'
    );

    const permissionError = new Error('permission blocked');
    permissionError.name = 'NotAllowedError';

    directoryManager.clearCache();
    rootHandle = new FakeDirectoryHandle('traces-root', {
      failures: { blocked: permissionError },
    });
    window.showDirectoryPicker.mockResolvedValueOnce(rootHandle);

    const failed = await directoryManager.ensureDirectoryExists('blocked/logs');
    expect(failed.success).toBe(false);
    expect(failed.error).toContain('Permission denied');

    const errorCases = [
      ['NotFoundError', 'Directory or parent directory not found.'],
      ['TypeMismatchError', 'Path component exists but is not a directory.'],
      ['InvalidStateError', 'Invalid directory state or handle.'],
      ['SecurityError', 'Security restrictions prevent this operation.'],
      ['AbortError', 'Operation was aborted by the user.'],
      ['QuotaExceededError', 'Storage quota exceeded.'],
      ['CustomError', 'Browser filesystem error: boom'],
    ];

    for (const [name, expectedMessage] of errorCases) {
      directoryManager.clearCache();
      const errorHandle = new FakeDirectoryHandle('root', {
        failures: {
          scenario: Object.assign(new Error('boom'), { name }),
        },
      });
      window.showDirectoryPicker.mockResolvedValueOnce(errorHandle);

      const result =
        await directoryManager.ensureDirectoryExists('scenario/path');
      expect(result.success).toBe(false);
      expect(result.error).toBe(expectedMessage);
    }
  });

  it('gracefully handles permission denials and user cancellation', async () => {
    rootHandle.queryPermission = jest.fn().mockResolvedValue('prompt');
    rootHandle.requestPermission = jest.fn().mockResolvedValue('denied');

    const denied =
      await directoryManager.ensureDirectoryExists('exports/denied');
    expect(denied.success).toBe(false);
    expect(denied.error).toContain(
      'User denied directory access or cancelled selection'
    );

    const abortForRoot = new Error('cancelled');
    abortForRoot.name = 'AbortError';
    directoryManager.clearCache();
    window.showDirectoryPicker.mockImplementationOnce(async () => {
      throw abortForRoot;
    });

    const rootCancelled =
      await directoryManager.ensureDirectoryExists('exports/again');
    expect(rootCancelled.success).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      'User cancelled directory selection'
    );

    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';
    window.showDirectoryPicker.mockImplementationOnce(async () => {
      throw abortError;
    });

    const selection = await directoryManager.selectDirectory();
    expect(selection).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      'User cancelled directory selection'
    );
  });

  it('ensures subdirectories, reports invalid parents, and clears caches correctly', async () => {
    await directoryManager.ensureDirectoryExists('exports/subset');
    const handle = await directoryManager.selectDirectory();
    expect(handle).toBe(rootHandle);

    const subdirectory = await directoryManager.ensureSubdirectoryExists(
      rootHandle,
      'logs'
    );
    expect(subdirectory).toBeInstanceOf(FakeDirectoryHandle);
    expect(rootHandle.children.has('logs')).toBe(true);

    const missingParent = await directoryManager.ensureSubdirectoryExists(
      null,
      'fail'
    );
    expect(missingParent).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Parent directory handle is required'
    );

    directoryManager.clearCache();
    expect(logger.debug).toHaveBeenCalledWith(
      'Directory creation cache cleared',
      expect.objectContaining({ clearedCount: 1 })
    );

    const newHandle = new FakeDirectoryHandle('fresh-root');
    window.showDirectoryPicker.mockResolvedValueOnce(newHandle);
    await directoryManager.ensureDirectoryExists('exports/subset');
    expect(window.showDirectoryPicker).toHaveBeenCalledTimes(3);
  });

  it('validates directory paths for reserved names and invalid characters', () => {
    const reserved = directoryManager.validateDirectoryPath('logs/con');
    expect(reserved.isValid).toBe(false);
    expect(reserved.errors).toContain('Path contains reserved name: con');

    const invalidChars = directoryManager.validateDirectoryPath('logs/qa?');
    expect(invalidChars.isValid).toBe(false);
    expect(invalidChars.errors).toContain('Path contains invalid characters');

    const nullByte = directoryManager.validateDirectoryPath('logs/zero\0here');
    expect(nullByte.isValid).toBe(false);
    expect(nullByte.errors).toContain('Path contains null bytes');

    const longPath = 'x'.repeat(260);
    const longResult = directoryManager.validateDirectoryPath(longPath);
    expect(longResult.isValid).toBe(false);
    expect(longResult.errors).toContain(
      'Path exceeds maximum length (255 characters)'
    );

    const safe = directoryManager.validateDirectoryPath('logs/safe');
    expect(safe.isValid).toBe(true);
  });

  it('logs and returns errors when directory selection fails unexpectedly', async () => {
    logger.info.mockImplementationOnce(() => {
      throw new Error('logger explode');
    });

    const result =
      await directoryManager.ensureDirectoryExists('exports/failure');
    expect(result.success).toBe(false);
    expect(result.error).toBe('logger explode');
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to ensure directory exists',
      expect.any(Error),
      expect.objectContaining({ path: 'exports/failure' })
    );
  });

  it('supports directory selection permission workflows and error reporting', async () => {
    const permissionHandle = new FakeDirectoryHandle('prompt-root', {
      permission: 'prompt',
    });
    permissionHandle.requestPermission = jest.fn().mockResolvedValue('granted');
    window.showDirectoryPicker.mockResolvedValueOnce(permissionHandle);

    const granted = await directoryManager.selectDirectory();
    expect(granted).toBe(permissionHandle);
    expect(permissionHandle.requestPermission).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('Directory selected for export', {
      name: 'prompt-root',
    });

    const deniedHandle = new FakeDirectoryHandle('denied-root', {
      permission: 'prompt',
    });
    deniedHandle.requestPermission = jest.fn().mockResolvedValue('denied');
    window.showDirectoryPicker.mockResolvedValueOnce(deniedHandle);

    const deniedSelection = await directoryManager.selectDirectory();
    expect(deniedSelection).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'User denied write permission to directory'
    );

    const selectionError = new Error('fs failed');
    window.showDirectoryPicker.mockImplementationOnce(async () => {
      throw selectionError;
    });
    const failedSelection = await directoryManager.selectDirectory();
    expect(failedSelection).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to select directory',
      selectionError
    );

    directoryManager.clearCache();
    window.showDirectoryPicker.mockImplementationOnce(async () => {
      throw new Error('root failure');
    });
    const rootFailure =
      await directoryManager.ensureDirectoryExists('exports/missing');
    expect(rootFailure.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to get root directory handle',
      expect.any(Error)
    );

    const failingParent = new FakeDirectoryHandle('parent');
    failingParent.getDirectoryHandle = jest.fn().mockImplementation(() => {
      const err = new Error('dir mismatch');
      err.name = 'TypeMismatchError';
      throw err;
    });

    const subdirectoryFailure = await directoryManager.ensureSubdirectoryExists(
      failingParent,
      'child'
    );
    expect(subdirectoryFailure).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to ensure subdirectory exists',
      expect.any(Error),
      expect.objectContaining({ subdirectoryName: 'child' })
    );
  });
});
