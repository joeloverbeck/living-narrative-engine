import {
  describe,
  it,
  beforeAll,
  afterEach,
  expect,
} from '@jest/globals';
import {
  StorageRotationManager,
  RotationPolicy,
} from '../../../../src/actions/tracing/storageRotationManager.js';
import {
  IndexedDBStorageAdapter,
} from '../../../../src/storage/indexedDBStorageAdapter.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class ControlledTimerService {
  constructor() {
    this.lastTimer = null;
    this.intervals = new Set();
  }

  setInterval(callback, delay) {
    const handle = { callback, delay, cleared: false };
    this.lastTimer = handle;
    this.intervals.add(handle);
    return handle;
  }

  clearInterval(handle) {
    if (!handle) {
      return;
    }
    handle.cleared = true;
    this.intervals.delete(handle);
    if (this.lastTimer === handle) {
      this.lastTimer = null;
    }
  }
}

const deleteDatabase = async (name) => {
  if (!global.indexedDB) {
    return;
  }

  await new Promise((resolve) => {
    const request = global.indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

describe('StorageRotationManager with IndexedDBStorageAdapter', () => {
  /** @type {RecordingLogger} */
  let logger;
  /** @type {ControlledTimerService} */
  let timerService;
  /** @type {IndexedDBStorageAdapter} */
  let storageAdapter;
  /** @type {StorageRotationManager} */
  let rotationManager;
  /** @type {string[]} */
  const databases = [];

  beforeAll(() => {
    if (typeof window !== 'undefined' && !window.pako) {
      // eslint-disable-next-line global-require
      window.pako = require('pako');
    }
  });

  afterEach(async () => {
    if (rotationManager) {
      rotationManager.shutdown();
      rotationManager = undefined;
    }

    if (storageAdapter) {
      storageAdapter.close();
      storageAdapter = undefined;
    }

    while (databases.length) {
      const name = databases.pop();
      // eslint-disable-next-line no-await-in-loop
      await deleteDatabase(name);
    }
  });

  const createAdapter = async () => {
    logger = new RecordingLogger();
    timerService = new ControlledTimerService();
    const dbName = `storage-rotation-it-${Date.now()}-${Math.random()}`;
    databases.push(dbName);
    storageAdapter = new IndexedDBStorageAdapter({ logger, dbName });
    await storageAdapter.initialize();
    return { dbName };
  };

  const createRotationManager = (config) => {
    rotationManager = new StorageRotationManager({
      storageAdapter,
      logger,
      config,
      timerService,
    });
    return rotationManager;
  };

  it('rotates traces with hybrid policy, compression, and preservation using real storage', async () => {
    await createAdapter();

    const now = Date.now();
    const traces = [
      {
        id: 'trace_recent',
        timestamp: now,
        data: { action: 'recent' },
      },
      {
        id: 'trace_bigint',
        timestamp: now - 500,
        data: { value: '42' },
      },
      {
        id: 'trace_sum_overflow',
        timestamp: now - 1000,
        data: { payload: 'C'.repeat(700) },
      },
      {
        id: 'trace_oversize',
        timestamp: now - 1500,
        data: { payload: 'D'.repeat(800) },
      },
      {
        id: 'trace_compressible',
        timestamp: now - 2000,
        data: { message: 'E'.repeat(100) },
      },
      {
        id: 'trace_old',
        timestamp: now - 70000,
        data: { action: 'old' },
      },
      {
        id: 'preserve-special',
        timestamp: now - 80000,
        data: { action: 'preserve' },
      },
    ];

    await storageAdapter.setItem('actionTraces', traces);

    const originalGetItem = storageAdapter.getItem.bind(storageAdapter);
    const originalSetItem = storageAdapter.setItem.bind(storageAdapter);

    storageAdapter.getItem = async (key) => {
      const value = await originalGetItem(key);
      if (key === 'actionTraces' && Array.isArray(value)) {
        return value.map((trace) => {
          if (trace.id === 'trace_bigint') {
            return {
              ...trace,
              data: { ...trace.data, forceSizeError: true },
            };
          }
          return trace;
        });
      }
      return value;
    };

    storageAdapter.setItem = async (key, value) => {
      if (key === 'actionTraces' && Array.isArray(value)) {
        const sanitized = value.map((trace) => {
          if (trace.id === 'trace_bigint' && trace.data) {
            const { forceSizeError, ...rest } = trace.data;
            return {
              ...trace,
              data: rest,
            };
          }
          return trace;
        });
        return originalSetItem(key, sanitized);
      }
      return originalSetItem(key, value);
    };

    createRotationManager({
      policy: RotationPolicy.HYBRID,
      maxTraceCount: 5,
      maxAge: 60000,
      maxStorageSize: 1500,
      maxTraceSize: 1400,
      preserveCount: 1,
      preservePattern: 'special',
      compressionEnabled: true,
      compressionAge: 1000,
      rotationInterval: 5000,
    });

    const originalStringify = JSON.stringify;
    JSON.stringify = function jsonStringifyWithForcedError(value, replacer, space) {
      if (value && typeof value === 'object' && value.forceSizeError) {
        throw new Error('forced stringify failure');
      }
      return originalStringify.call(this, value, replacer, space);
    };

    let results;
    try {
      results = await rotationManager.rotateTraces();
    } finally {
      JSON.stringify = originalStringify;
    }
    expect(results.deleted).toBe(3);
    expect(results.compressed).toBe(2);
    expect(results.errors).toBe(0);

    const stored = await storageAdapter.getItem('actionTraces');
    expect(stored).toHaveLength(4);
    const storedIds = stored.map((t) => t.id);
    expect(storedIds).toEqual(
      expect.arrayContaining([
        'trace_recent',
        'trace_bigint',
        'trace_compressible',
        'preserve-special',
      ])
    );
    expect(storedIds).not.toContain('trace_oversize');
    expect(storedIds).not.toContain('trace_sum_overflow');
    expect(storedIds).not.toContain('trace_old');

    const compressedTrace = stored.find(
      (trace) => trace.id === 'trace_compressible'
    );
    expect(compressedTrace.compressed).toBe(true);
    expect(Array.isArray(compressedTrace.data)).toBe(true);

    const decompressed = await rotationManager.decompressTrace(compressedTrace);
    expect(decompressed.compressed).toBe(false);
    expect(decompressed.data.message.startsWith('E')).toBe(true);

    const invalidCompressed = {
      id: 'corrupted',
      compressed: true,
      data: [120, 3, 255],
    };
    const errorResult = await rotationManager.decompressTrace(invalidCompressed);
    expect(errorResult).toBe(invalidCompressed);
    expect(logger.errorLogs.some(([message]) => message.includes('Failed to decompress trace'))).toBe(true);

    const stats = await rotationManager.getStatistics();
    expect(stats.currentCount).toBe(4);
    expect(stats.compressedCount).toBe(2);
    expect(stats.preservedCount).toBe(1);
    expect(stats.policy).toBe(RotationPolicy.HYBRID);

    const clearedWithPreservation = await rotationManager.clearAllTraces(true);
    expect(clearedWithPreservation).toBe(3);
    const preservedOnly = await storageAdapter.getItem('actionTraces');
    expect(preservedOnly).toHaveLength(1);
    expect(preservedOnly[0].id).toBe('preserve-special');

    await storageAdapter.setItem('actionTraces', stored);
    const clearedAll = await rotationManager.clearAllTraces(false);
    expect(clearedAll).toBe(stored.length);
    const afterClearAll = await storageAdapter.getItem('actionTraces');
    expect(afterClearAll).toHaveLength(0);

    await storageAdapter.setItem('actionTraces', stored);
    rotationManager.updateConfig({
      policy: 'unknown-policy',
      rotationInterval: 250,
    });
    expect(timerService.lastTimer?.delay).toBe(250);
    expect(logger.infoLogs.some(([message]) =>
      message.includes('StorageRotationManager: Configuration updated')
    )).toBe(true);

    const forcedResults = await rotationManager.forceRotation();
    expect(forcedResults.deleted).toBe(0);
    expect(logger.warnLogs.some(([message]) =>
      message.includes('Unknown policy')
    )).toBe(true);
  });

  it('captures storage errors when persistence fails during rotation', async () => {
    await createAdapter();

    await storageAdapter.setItem('actionTraces', [
      {
        id: 'rotate-me',
        timestamp: Date.now(),
        data: { entry: 'value' },
      },
    ]);

    const failingAdapter = {
      getItem: (key) => storageAdapter.getItem(key),
      setItem: async () => {
        throw new Error('simulated persistence failure');
      },
      removeItem: (key) => storageAdapter.removeItem(key),
    };

    rotationManager = new StorageRotationManager({
      storageAdapter: failingAdapter,
      logger,
      config: {
        policy: RotationPolicy.COUNT,
        maxTraceCount: 1,
      },
      timerService,
    });

    const results = await rotationManager.rotateTraces();
    expect(results.errors).toBe(1);
    expect(logger.errorLogs.some(([message]) =>
      message.includes('StorageRotationManager: Rotation error')
    )).toBe(true);
  });
});
