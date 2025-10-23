import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import IndexedDBStorageAdapter from '../../../src/storage/indexedDBStorageAdapter.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

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

describe('IndexedDBStorageAdapter integration', () => {
  let originalIndexedDB;
  /** @type {string[]} */
  let databasesToCleanup;

  beforeEach(() => {
    originalIndexedDB = global.indexedDB;
    databasesToCleanup = [];
  });

  afterEach(async () => {
    for (const name of databasesToCleanup) {
      await deleteDatabase(name);
    }
    databasesToCleanup = [];
    if (global.indexedDB !== originalIndexedDB) {
      global.indexedDB = originalIndexedDB;
      if (typeof window !== 'undefined') {
        window.indexedDB = originalIndexedDB;
      }
    }
  });

  afterAll(() => {
    if (originalIndexedDB) {
      global.indexedDB = originalIndexedDB;
      if (typeof window !== 'undefined') {
        window.indexedDB = originalIndexedDB;
      }
    }
  });

  const createAdapter = () => {
    const logger = createLogger();
    const dbName = `integration-db-${Date.now()}-${Math.random()}`;
    databasesToCleanup.push(dbName);
    const adapter = new IndexedDBStorageAdapter({ logger, dbName });
    return { adapter, logger, dbName };
  };

  it('performs full storage lifecycle against real IndexedDB', async () => {
    const { adapter, logger, dbName } = createAdapter();

    await Promise.all([adapter.initialize(), adapter.initialize()]);

    await adapter.initialize();
    await adapter.setItem('trace-1', { foo: 'bar' });
    await adapter.setItem('trace-2', 'value');

    expect(await adapter.getItem('trace-1')).toEqual({ foo: 'bar' });
    expect(await adapter.getItem('missing')).toBeNull();

    const keys = await adapter.getAllKeys();
    expect(new Set(keys)).toEqual(new Set(['trace-1', 'trace-2']));
    expect(await adapter.count()).toBe(2);

    await adapter.removeItem('trace-1');
    expect(await adapter.getItem('trace-1')).toBeNull();
    expect(await adapter.count()).toBe(1);

    await adapter.clear();
    expect(await adapter.count()).toBe(0);

    adapter.close();
    expect(logger.debug).toHaveBeenCalledWith(
      'IndexedDBStorageAdapter: Database connection closed'
    );

    await deleteDatabase(dbName);
  });

  it('reinitializes after close and validates availability', async () => {
    const { adapter, dbName } = createAdapter();

    await adapter.initialize();
    adapter.close();

    await adapter.setItem('after-close', { active: true });
    expect(await adapter.getItem('after-close')).toEqual({ active: true });

    await adapter.removeItem('after-close');
    const available = await adapter.isAvailable();
    expect(available).toBe(true);

    adapter.close();
    await deleteDatabase(dbName);
  });

  it('propagates initialization errors when IndexedDB.open fails', async () => {
    const { adapter, logger, dbName } = createAdapter();
    const realIndexedDB = originalIndexedDB;

    const failingOpenIndexedDB = {
      open: () => {
        const request = { error: new Error('simulated open failure') };
        setTimeout(() => {
          if (typeof request.onerror === 'function') {
            request.onerror();
          }
        }, 0);
        return request;
      },
      deleteDatabase: realIndexedDB.deleteDatabase.bind(realIndexedDB),
    };

    global.indexedDB = failingOpenIndexedDB;
    if (typeof window !== 'undefined') {
      window.indexedDB = failingOpenIndexedDB;
    }

    await expect(adapter.initialize()).rejects.toThrow(
      /Failed to open IndexedDB: simulated open failure/
    );
    expect(logger.error).toHaveBeenCalledWith(
      'IndexedDBStorageAdapter: Failed to open database',
      expect.any(Error)
    );

    global.indexedDB = realIndexedDB;
    if (typeof window !== 'undefined') {
      window.indexedDB = realIndexedDB;
    }

    await deleteDatabase(dbName);
  });

  it('returns false from isAvailable when IndexedDB is unavailable', async () => {
    const { adapter, logger } = createAdapter();

    const saved = originalIndexedDB;
    global.indexedDB = undefined;
    if (typeof window !== 'undefined') {
      window.indexedDB = undefined;
    }

    await expect(adapter.isAvailable()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'IndexedDBStorageAdapter: Storage availability check failed',
      expect.any(Error)
    );

    global.indexedDB = saved;
    if (typeof window !== 'undefined') {
      window.indexedDB = saved;
    }
  });

  it('surfaces errors from object store operations and unexpected closures', async () => {
    const { adapter, logger, dbName } = createAdapter();
    const realIndexedDB = originalIndexedDB;
    let throwOnNextTransaction = false;
    let triggerTransactionError = false;
    let nextGetMode = 'request-error';
    let nextPutMode = 'request-error';
    let nextDeleteMode = 'throw';
    let nextGetAllKeysMode = 'request-error';
    let nextClearMode = 'throw';
    let nextCountMode = 'request-error';

    const createFailingRequest = (message) => {
      const request = { error: new Error(message) };
      setTimeout(() => {
        if (typeof request.onerror === 'function') {
          request.onerror();
        }
      }, 0);
      return request;
    };

    const failingStore = {
      get: () => {
        if (nextGetMode === 'throw') {
          nextGetMode = 'request-error';
          throw new Error('get throw failure');
        }
        return createFailingRequest('get failure');
      },
      put: () => {
        if (nextPutMode === 'throw') {
          nextPutMode = 'request-error';
          throw new Error('set throw failure');
        }
        return createFailingRequest('set failure');
      },
      delete: () => {
        if (nextDeleteMode === 'throw') {
          nextDeleteMode = 'request-error';
          throw new Error('delete failure');
        }
        return createFailingRequest('remove failure');
      },
      getAllKeys: () => {
        if (nextGetAllKeysMode === 'throw') {
          nextGetAllKeysMode = 'request-error';
          throw new Error('keys throw failure');
        }
        return createFailingRequest('keys failure');
      },
      clear: () => {
        if (nextClearMode === 'throw') {
          nextClearMode = 'request-error';
          throw new Error('clear failure');
        }
        return createFailingRequest('clear request failure');
      },
      count: () => {
        if (nextCountMode === 'throw') {
          nextCountMode = 'request-error';
          throw new Error('count throw failure');
        }
        return createFailingRequest('count failure');
      },
    };

    const failingDb = {
      close: jest.fn(),
      objectStoreNames: { contains: () => true },
      createObjectStore: () => ({ createIndex: jest.fn() }),
      onclose: null,
      transaction: (storeNames, mode) => {
        if (throwOnNextTransaction) {
          throwOnNextTransaction = false;
          throw new Error('transaction boom');
        }
        const txn = {
          objectStore: () => failingStore,
          error: new Error('transaction failure'),
        };
        if (triggerTransactionError) {
          triggerTransactionError = false;
          setTimeout(() => {
            if (typeof txn.onerror === 'function') {
              txn.onerror();
            }
          }, 0);
        }
        return txn;
      },
    };

    const failingIndexedDB = {
      open: () => {
        const request = { result: failingDb };
        setTimeout(() => {
          if (typeof request.onupgradeneeded === 'function') {
            request.onupgradeneeded({
              oldVersion: 0,
              newVersion: 1,
              target: { result: failingDb },
            });
          }
          if (typeof request.onsuccess === 'function') {
            request.onsuccess();
          }
        }, 0);
        return request;
      },
      deleteDatabase: realIndexedDB.deleteDatabase.bind(realIndexedDB),
    };

    global.indexedDB = failingIndexedDB;
    if (typeof window !== 'undefined') {
      window.indexedDB = failingIndexedDB;
    }

    await adapter.initialize();
    failingDb.onclose();
    expect(logger.warn).toHaveBeenCalledWith(
      'IndexedDBStorageAdapter: Database connection closed unexpectedly'
    );

    await expect(adapter.getItem('k')).rejects.toThrow('Failed to get item: get failure');
    nextGetMode = 'throw';
    throwOnNextTransaction = true;
    await expect(adapter.getItem('boom')).rejects.toThrow('transaction boom');

    throwOnNextTransaction = true;
    await expect(adapter.setItem('txn', 'value')).rejects.toThrow('transaction boom');
    triggerTransactionError = true;
    await expect(adapter.setItem('fail', 'value')).rejects.toThrow(
      'Transaction failed: transaction failure'
    );
    nextPutMode = 'request-error';
    await expect(adapter.setItem('request-fail', 'value')).rejects.toThrow(
      'Failed to set item: set failure'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'IndexedDBStorageAdapter: Transaction error',
      expect.any(Error)
    );

    await expect(adapter.removeItem('nope')).rejects.toThrow('delete failure');
    await expect(adapter.removeItem('again')).rejects.toThrow(
      'Failed to remove item: remove failure'
    );

    await expect(adapter.getAllKeys()).rejects.toThrow(
      'Failed to get keys: keys failure'
    );
    nextGetAllKeysMode = 'throw';
    await expect(adapter.getAllKeys()).rejects.toThrow('keys throw failure');

    await expect(adapter.clear()).rejects.toThrow('clear failure');
    nextClearMode = 'request-error';
    await expect(adapter.clear()).rejects.toThrow(
      'Failed to clear storage: clear request failure'
    );

    await expect(adapter.count()).rejects.toThrow('Failed to count items: count failure');
    nextCountMode = 'throw';
    await expect(adapter.count()).rejects.toThrow('count throw failure');

    global.indexedDB = realIndexedDB;
    if (typeof window !== 'undefined') {
      window.indexedDB = realIndexedDB;
    }

    await deleteDatabase(dbName);
  });
});
